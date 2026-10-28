const { test, expect } = require("@playwright/test");
const base = "http://127.0.0.1:8000";

test("one shared language control, in-page generator, back navigation @smoke @core", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(base + "/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#partySelector")).toBeVisible();
  const languageControl = page.locator(".language-switch");
  await expect(languageControl).toHaveCount(1);
  await expect(languageControl).toBeVisible();
  await expect(page.locator(".party-admin-link")).toBeVisible();

  // Language and appearance now share the draggable settings palette.
  await page.locator("#settingsTrigger").click();
  await expect(page.locator("#settingsPanel")).toBeVisible();
  await languageControl.locator('[data-lang="en"]').click();
  await expect(page.locator(".party-admin-link")).toContainText(
    "CREATE PERSONALIZED",
  );

  const oldControl = await languageControl.elementHandle();
  await page.locator(".party-admin-link").click();
  await expect(page.locator("#linkToolScreen")).toBeVisible();
  expect(
    await page.evaluate(
      element => element === document.querySelector(".language-switch"),
      oldControl,
    ),
  ).toBe(true);
  await expect(page.locator("#linkToolTitle")).toHaveText(
    "Create a personalized invitation",
  );

  await page.locator("#linkToolGuest").fill("Minh & Lan");
  await page.locator("#linkToolParty").selectOption("groom");
  await page.locator('#linkToolForm button[type="submit"]').click();
  await expect(page.locator("#linkToolGenerated")).toContainText(
    "party=groom",
  );
  await expect(page.locator("#linkToolGenerated")).toContainText(
    "lang=en",
  );

  await page.locator("#linkToolBack").click();
  await expect(page.locator("#linkToolScreen")).toBeHidden();
  await expect(page.locator("#partySelector")).toBeVisible();
  expect(errors).toEqual([]);
});


test("party link, envelope and album lightbox interactions", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(
    base + "/index.html?party=bride&to=CrossDeviceTest&lang=vi",
    { waitUntil: "domcontentloaded" },
  );
  await expect(page.locator("#envelopeIntro")).toBeVisible();
  // The seal is personalized from data, not hard-coded into the HTML.
  const initials = await page.evaluate(() =>
    window.WEDDING_INFO.couple.bride.initial + " · " + window.WEDDING_INFO.couple.groom.initial
  );
  await expect(page.locator("#envelopeMonogram")).toHaveText(initials);
  await page.locator("#skipInvitation").click();
  await expect(page.locator("#envelopeIntro")).toBeHidden();
  await expect(page.locator("#heroMonogram")).toContainText(initials.split(" · ")[0]);
  await page.locator(".couple-section .section-title").scrollIntoViewIfNeeded();
  await expect(page.locator(".couple-section .section-title")).toHaveClass(/is-visible/);

  await page.locator("#albumViewport").scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator(".album-slide").count()).toBeGreaterThan(0);
  const totalSlides = await page.locator(".album-slide").count();
  const loadedImages = await page.locator(".album-photo[src]").count();
  expect(loadedImages).toBeGreaterThan(0);
  if (totalSlides > 12) expect(loadedImages).toBeLessThan(totalSlides);
  await expect(page.locator(".album-card.is-main")).toHaveCount(1);
  // A CSS filter animates from dim to full illumination in ~500ms.
  // Wait for the final frame rather than asserting during interpolation.
  await expect.poll(() => page.locator(".album-card.is-main .album-photo")
    .evaluate(node => getComputedStyle(node).filter)).toBe("none");
  const lighting = await page.evaluate(() => ({
    focused:getComputedStyle(document.querySelector(".album-card.is-main .album-photo")).filter,
    adjacent:getComputedStyle(document.querySelector(".album-card:not(.is-main) .album-photo")).filter,
  }));
  expect(lighting.focused).toBe("none");
  expect(lighting.adjacent).toContain("brightness");

  await page.locator("#albumViewport").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#albumLightbox")).toBeVisible();

  // Interrupt a transition with a close to detect stale async work.
  await page.locator("#albumLightboxNext").click();
  await page.locator("#albumLightboxClose").click();
  await expect(page.locator("#albumLightbox")).toBeHidden();
  expect(errors).toEqual([]);
});


test("short screens can scroll and avoid horizontal page overflow @smoke", async ({
  page,
}) => {
  await page.goto(base + "/index.html", { waitUntil: "domcontentloaded" });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(4);
  await page.locator(".party-admin-link").click();
  await expect(page.locator("#linkToolGuest")).toBeVisible();
  const toolOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(toolOverflow).toBeLessThanOrEqual(4);
});


test("menu, map and gift overlays open and close on each device @smoke", async ({
  page,
}) => {
  await page.goto(base + "/index.html?party=groom&to=Guest", {
    waitUntil: "domcontentloaded",
  });
  await page.locator("#skipInvitation").click();
  const menuToggle = page.locator("#wqToggle");
  // Even a collapsed idle Menu must open on the FIRST touch on phones.
  await menuToggle.evaluate(node => node.classList.add("is-idle"));
  await menuToggle.click();
  await expect(menuToggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#wqPanel")).toHaveAttribute(
    "aria-hidden",
    "false",
  );
  await page.locator('#wqPanel a[href="#locations"]').click();
  await expect(page.locator("#wmModal")).toBeVisible();
  await page.locator("#wmClose").click();
  await expect(page.locator("#wmModal")).toBeHidden();

  await menuToggle.click();
  await expect(menuToggle).toHaveAttribute("aria-expanded", "true");
  await page.locator('#wqPanel a[href="#wedding-gift"]').click();
  await expect(page.locator("#wgModal")).toBeVisible();
  await page.locator("#wgClose").click();
  await expect(page.locator("#wgModal")).toBeHidden();
});


test("editing only wedding-info.js updates names, initials, dates, venue and gifts", async ({
  page,
}) => {
  // Local YouTube API stub verifies which configured video would be played
  // without contacting YouTube or triggering autoplay.
  await page.addInitScript(() => {
    window.YT = {
      PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0 },
      Player: function (_host, options) {
        window.__configuredWeddingMusicId = options.videoId;
        const player = { setVolume() {}, playVideo() {}, pauseVideo() {} };
        setTimeout(() => options.events.onReady({ target: player }), 0);
        return player;
      },
    };
  });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  // Simulate a new couple by replacing ONLY the response body of the data file.
  await page.route("**/wedding-info.js*", async route => {
    const response = await route.fetch();
    const sandbox = { window: {} };
    require("node:vm").runInNewContext(await response.text(), sandbox);
    const config = sandbox.window.WEDDING_INFO;
    // Change structured fields only; translations and templates stay untouched.
    Object.assign(config.couple.bride, {
      short: "Mai An",
      full: "Nguyễn Thị Mai An",
      initial: "M",
    });
    Object.assign(config.couple.groom, {
      short: "Tuấn Minh",
      full: "Trần Tuấn Minh",
      initial: "T",
    });
    config.parties.bride.date = "2027-03-15";
    config.parties.bride.music.youtubeId = config.parties.groom.music.youtubeId;
    config.parties.bride.images.hero = config.parties.groom.images.hero;
    config.parties.bride.venue.name = {
      vi: "Nhà hàng Hoa Sen",
      en: "Hoa Sen Venue",
    };
    await route.fulfill({
      response,
      body: "window.WEDDING_INFO = " + JSON.stringify(config) + ";",
    });
  });

  await page.goto(base + "/index.html?party=bride&lang=en", {
    waitUntil: "domcontentloaded",
  });
  await page.locator("#skipInvitation").click();

  await expect(page.locator("#heroMonogram")).toContainText("M");
  await expect(page.locator("#heroMonogram")).toContainText("T");
  await expect(page.locator("#heroNames")).toContainText("MAI AN");
  await expect(page.locator("#heroNames")).toContainText("TUẤN MINH");
  await expect(page.locator(".person-bride .person-copy h3")).toHaveText(
    "NGUYỄN THỊ MAI AN",
  );
  await expect(page.locator(".hero-date [data-party-date='bride']")).toHaveText(
    "15.03.2027",
  );
  await expect(page.locator("#map-bride h3")).toHaveText("Hoa Sen Venue");
  await expect(page.locator(".gift-card[data-party-scope='bride'] h3")).toHaveText(
    "NGUYỄN THỊ MAI AN",
  );
  const computed = await page.evaluate(() => ({
    hero: document.documentElement.style.getPropertyValue("--hero-bride-image"),
    music: window.__configuredWeddingMusicId,
    configuredMusic: window.WEDDING_INFO.parties.bride.music.youtubeId,
    calendarFilename: window.WeddingI18n.t("calendar.brideFile"),
  }));
  expect(computed.hero).toContain("hero_groom.webp");
  expect(computed.music).toBe(computed.configuredMusic);
  expect(computed.calendarFilename).toContain("mai-an-tuan-minh.ics");

  await page.goto(base + "/index.html?tool=links&lang=en", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator(".link-tool-eyebrow")).toContainText(
    "Mai An & Tuấn Minh",
  );
  await expect(page.locator(".link-tool-eyebrow")).toContainText("2027");
  expect(errors).toEqual([]);
});


test("F5 keeps the invitation open within the same tab @core", async ({ page }) => {
  const url = base + "/index.html?party=bride&to=ReloadGuest&lang=vi";
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#envelopeIntro")).toBeVisible();
  await expect(page.locator(".invitation-card")).toBeHidden();
  const visualContrast = await page.evaluate(() => ({
    stage:getComputedStyle(document.getElementById("envelopeIntro")).backgroundColor,
    card:getComputedStyle(document.querySelector(".invitation-card")).backgroundColor
  }));
  expect(visualContrast.stage).toBe("rgb(97, 118, 106)");
  expect(visualContrast.card).toBe("rgb(255, 250, 240)");

  // Global Dark/Light must update the locked envelope itself, not only content
  // behind it. Also verify the browser chrome and the toggle button state.
  await page.locator("#settingsTrigger").click();
  await expect(page.locator("#settingsPanel")).toBeVisible();
  await page.locator('[data-theme-option="light"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator(".envelope-intro")).toHaveCSS("background-color", "rgb(238, 230, 220)");
  await expect(page.locator("#themeColor")).toHaveAttribute("content", "#eee6dc");
  await page.locator('[data-theme-option="dark"]').click();
  await expect(page.locator(".envelope-intro")).toHaveCSS("background-color", "rgb(97, 118, 106)");
  await expect(page.locator("#themeColor")).toHaveAttribute("content", "#61766a");
  await page.locator("#settingsClose").click();
  await expect(page.locator("#envelopeStageHit")).toBeVisible();
  await expect(page.locator(".envelope-seal")).toBeVisible();
  // The original diamond flap pointed upward as if already opened.
  // A sealed envelope must have its triangular flap pointing DOWN,
  // layered above the paper pocket and aligned with the wax seal.
  const sealedFlap = await page.locator(".envelope-flap").evaluate(node => {
    const flap = node.getBoundingClientRect();
    const wax = document.querySelector(".envelope-seal").getBoundingClientRect();
    const front = document.querySelector(".envelope-front");
    const style = getComputedStyle(node);
    return {
      path: style.clipPath,
      flapLayer: Number(style.zIndex),
      frontLayer: Number(getComputedStyle(front).zIndex),
      waxCenterY: wax.top + wax.height / 2,
      flapTipY: flap.top + flap.height * .62
    };
  });
  expect(sealedFlap.path).toContain("50% 62%");
  expect(sealedFlap.flapLayer).toBeGreaterThan(sealedFlap.frontLayer);
  expect(Math.abs(sealedFlap.waxCenterY - sealedFlap.flapTipY)).toBeLessThan(6);

  // The seal emits one burst; the exit flash bridges into the hero.
  // They must never replay on F5 in the same tab.
  await page.locator("#openInvitation").click();
  await expect(page.locator("#envelopeIntro")).toHaveClass(/is-seal-cracking/);
  await expect(page.locator("#envelopeIntro")).toHaveClass(/is-flap-open/);
  await expect(page.locator("#envelopeBurst")).toHaveCount(0);
  await expect(page.locator("#floatingPetals")).toHaveCount(0);
  // The flap stays present while it folds ABOVE the sealed pocket. No
  // backface culling, even after the card is extracted.
  await expect(page.locator(".invitation-card")).toBeHidden();
  await expect.poll(() => page.locator(".envelope-flap").evaluate(node =>
    getComputedStyle(node).transform
  )).toMatch(/matrix\(1, 0, 0, -1, 0, 0\)/);
  const openedFlap = await page.locator(".envelope-flap").evaluate(node => ({
    opacity:getComputedStyle(node).opacity,
    backface:getComputedStyle(node).backfaceVisibility,
    foldedTop:node.getBoundingClientRect().top,
    pocketTop:document.querySelector(".envelope-front").getBoundingClientRect().top
  }));
  expect(openedFlap.opacity).toBe("1");
  expect(openedFlap.backface).toBe("visible");
  expect(openedFlap.foldedTop).toBeLessThan(openedFlap.pocketTop);
  await expect(page.locator("#closeInvitation")).toBeVisible();
  await expect(page.locator(".invitation-card")).toBeVisible();
  await expect(page.locator("#envelopeCooldown")).toBeVisible();
  // Verify actual rendered contrast of the timer's digits against its surface.
  const timerContrast = await page.locator("#envelopeCooldown").evaluate(node => {
    const luminance = color => {
      const rgb = color.match(/[0-9.]+/g).slice(0,3).map(Number);
      const channels = rgb.map(channel => {
        const n = channel / 255;
        return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4;
      });
      return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    };
    const bg = luminance(getComputedStyle(node).backgroundColor);
    const text = luminance(getComputedStyle(node.querySelector("span")).color);
    return (Math.max(bg,text) + .05) / (Math.min(bg,text) + .05);
  });
  expect(timerContrast).toBeGreaterThanOrEqual(7);
  // The pocket remains fixed while the card rises out of it.
  const pocket = await page.locator(".envelope-front").evaluate(node => {
    const style = getComputedStyle(node);
    return {transform:style.transform,opacity:style.opacity};
  });
  expect(pocket.opacity).toBe("1");
  expect(["none","matrix(1, 0, 0, 1, 0, 0)","matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)"]).toContain(pocket.transform);
  await expect(page.locator("#envelopeStageHit")).toBeHidden();
  expect(await page.locator(".invitation-card").evaluate(node =>
    getComputedStyle(node).animationName
  )).toContain("luxInvitationFlight");
  await page.locator("#closeInvitation").click();
  await expect(page.locator("#invitationReveal")).toBeVisible();
  await expect(page.locator("#invitationPortal")).toHaveCount(0);
  await expect(page.locator("#envelopeIntro")).toBeHidden();
  await expect(page.locator("#invitationReveal")).toBeHidden({ timeout: 3000 });
  await expect(page.locator("#invitationPortal")).toHaveCount(0);
  await expect(page.locator("#floatingPetals")).toHaveCount(0);
  await expect(page.locator("html")).toHaveClass(/golden-signature-entered/);
  const brideShort = await page.evaluate(() => window.WEDDING_INFO.couple.bride.short.toLocaleUpperCase("vi-VN"));
  await expect(page.locator("#heroNames")).toContainText(brideShort);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#envelopeIntro")).toBeHidden();
  await expect(page.locator("#envelopeBurst")).toHaveCount(0);
  await expect(page.locator("#invitationReveal")).toBeHidden();
  await expect(page.locator("#invitationPortal")).toHaveCount(0);
  await expect(page.locator("#floatingPetals")).toHaveCount(0);
  await expect(page.locator("html")).toHaveClass(/envelope-resumed/);
  await expect(page.locator("html")).not.toHaveClass(/golden-signature-entered/);
  await expect(page.locator("body")).not.toHaveClass(/envelope-locked/);
  expect(await page.evaluate(() => history.state?.weddingEnvelopeOpened)).toBe(
    JSON.stringify(["bride", "ReloadGuest"]),
  );
});


test("reduced motion opens the envelope without particles or flash", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(base + "/index.html?party=groom&to=QuietGuest", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#envelopeIntro")).toBeVisible();
  await expect(page.locator(".invitation-card")).toBeHidden();
  await page.locator("#envelopeStageHit").click();
  await expect(page.locator("#closeInvitation")).toBeVisible();
  await expect(page.locator(".invitation-card")).toBeVisible();
  await expect(page.locator("#envelopeBurst")).toHaveCount(0);
  await expect(page.locator(".envelope-flap")).toHaveCSS("opacity", "1");
  await expect(page.locator(".envelope-flap")).toHaveCSS("transform", "matrix(1, 0, 0, -1, 0, 0)");
  await expect(page.locator(".envelope-burst-particle")).toHaveCount(0);
  await page.locator("#closeInvitation").click();
  await expect(page.locator("#envelopeIntro")).toBeHidden();
  await expect(page.locator("#invitationReveal")).toBeHidden();
  await expect(page.locator("#invitationPortal")).toHaveCount(0);
  await expect(page.locator("#floatingPetals")).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveClass(/envelope-locked/);
});


test("settings palette provides light/dark, persistent language and music in one place @smoke @core", async ({
  page,
}) => {
  await page.goto(base + "/index.html", { waitUntil: "domcontentloaded" });
  const hub = page.locator("#settingsHub");
  await expect(hub).toHaveCount(1);
  await expect(page.locator("#settingsPanel")).toBeHidden();
  // Music control is inside this single hub and no longer floats separately.
  expect(await page.locator("#musicToggle").evaluate(node => node.closest("#settingsHub") !== null)).toBe(true);
  await page.locator("#settingsTrigger").click();
  await expect(page.locator("#settingsPanel")).toBeVisible();
  await page.locator('[data-theme-option="light"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator('[data-theme-option="light"]')).toHaveAttribute("aria-pressed", "true");
  expect(await page.locator("html").evaluate(node =>
    getComputedStyle(node).getPropertyValue("--paper-ivory").trim()
  )).toBe("#f6f1e8");
  const lightBackground = await page.locator(".party-selector-card").evaluate(
    node => getComputedStyle(node).backgroundImage,
  );
  await page.locator('[data-lang="en"]').click();
  await expect(page.locator("#settingsPanel .settings-row-label").first()).toHaveText("Language");
  await page.locator("#settingsClose").click();
  await expect(page.locator("#settingsPanel")).toBeHidden();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.locator("#settingsTrigger").click();
  await expect(page.locator('[data-lang="en"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-theme-option="dark"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const darkBackground = await page.locator(".party-selector-card").evaluate(
    node => getComputedStyle(node).backgroundImage,
  );
  expect(lightBackground).not.toBe(darkBackground);
});


test("settings popover stays inside phone and tablet viewport when hub is dragged @smoke", async ({
  page,
}) => {
  await page.goto(base + "/index.html", { waitUntil: "domcontentloaded" });
  await page.locator("#settingsHub").evaluate(node => {
    // Real dragging marks the hub as user-moved; without this flag the
    // pointerdown handler correctly snaps it back to its default corner.
    node.dataset.userMoved = "true";
    node.dataset.floatEdge = "left";
    node.style.top = Math.max(10, innerHeight - 64) + "px";
    node.style.left = Math.floor(innerWidth / 2) + "px";
    node.style.right = "auto";
  });
  await page.locator("#settingsTrigger").click();
  await expect(page.locator("#settingsPanel")).toBeVisible();
  const rect = await page.locator("#settingsPanel").evaluate(node => {
    const r = node.getBoundingClientRect();
    return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, viewportW:innerWidth, viewportH:innerHeight };
  });
  expect(rect.left).toBeGreaterThanOrEqual(4);
  expect(rect.right).toBeLessThanOrEqual(rect.viewportW - 4);
  expect(rect.top).toBeGreaterThanOrEqual(4);
  expect(rect.bottom).toBeLessThanOrEqual(rect.viewportH - 4);
});


test("personal invitation puts bold recipient below the greeting in both places", async ({
  page,
}) => {
  const guest = "Anh Minh và chị Lan";
  await page.goto(base + "/index.html?party=bride&to=" + encodeURIComponent(guest), {
    waitUntil:"domcontentloaded",
  });
  await expect(page.locator("#envelopeGuestLabel")).toHaveText("Kính mời");
  await expect(page.locator("#envelopeGuest")).toHaveText(guest);
  const envelopeStyle = await page.locator("#envelopeGuest").evaluate(node => ({
    weight:getComputedStyle(node).fontWeight,
    below:node.getBoundingClientRect().top >= document.getElementById("envelopeGuestLabel").getBoundingClientRect().top,
  }));
  expect(Number(envelopeStyle.weight)).toBeGreaterThanOrEqual(600);
  expect(envelopeStyle.below).toBe(true);
  await page.locator("#skipInvitation").click();
  await expect(page.locator("#heroGuestLabel")).toHaveText("Kính mời");
  await expect(page.locator("#guestName")).toHaveText(guest);
  await expect(page.locator("#guestName")).toBeVisible();
  await page.locator("#settingsTrigger").click();
  await page.locator('[data-lang="en"]').click();
  await expect(page.locator("#envelopeGuestLabel")).toHaveText("Cordially inviting");
  await expect(page.locator("#heroGuestLabel")).toHaveText("Cordially inviting");
  await expect(page.locator("#guestName")).toHaveText(guest);

  // A generic link must not render an empty personalized-name line.
  await page.goto(base + "/index.html?party=groom", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#envelopeGuest")).toBeHidden();
  await page.locator("#skipInvitation").click();
  await expect(page.locator("#guestName")).toBeHidden();
});


test("F5 resets settings and menu positions to opposite right corners @smoke", async ({ page }) => {
  await page.goto(base + "/index.html", { waitUntil:"domcontentloaded" });
  const hub = page.locator("#settingsHub");
  const menu = page.locator("#wqToggle");
  await expect(hub).toHaveClass(/floating-control/);
  await expect(menu).toHaveClass(/floating-control/);

  // Simulate actual drag placement and check it does NOT survive F5.
  for (const control of [hub, menu]) {
    await control.evaluate(node => {
      node.dataset.userMoved = "true";
      node.dataset.floatEdge = "left";
      node.style.top = Math.round(innerHeight * .43) + "px";
      node.style.left = "8px";
      node.style.right = "auto";
      node.style.bottom = "auto";
    });
  }
  await page.reload({ waitUntil:"domcontentloaded" });

  const corners = await page.evaluate(() => {
    const settings = document.getElementById("settingsHub").getBoundingClientRect();
    const menu = document.getElementById("wqToggle").getBoundingClientRect();
    return {
      settings: { right: innerWidth - settings.right, top:settings.top },
      menu: { right:innerWidth - menu.right, bottom:innerHeight - menu.bottom }
    };
  });
  expect(corners.settings.right).toBeLessThanOrEqual(30);
  expect(corners.settings.top).toBeLessThanOrEqual(40);
  expect(corners.menu.right).toBeLessThanOrEqual(30);
  expect(corners.menu.bottom).toBeLessThanOrEqual(40);

  // Both collapsed SVGs must sit at the actual center after reload.
  await hub.evaluate(node => node.classList.add("is-idle"));
  await menu.evaluate(node => node.classList.add("is-idle"));
  await page.waitForTimeout(350); // Wait for CSS width/padding transition.
  const centers = await page.evaluate(() => {
    const offset = (outer, icon) => {
      const a = outer.getBoundingClientRect();
      const b = icon.getBoundingClientRect();
      return {
        x: Math.abs((a.left + a.width / 2) - (b.left + b.width / 2)),
        y: Math.abs((a.top + a.height / 2) - (b.top + b.height / 2)),
      };
    };
    return {
      settings: offset(document.querySelector("#settingsHub"), document.querySelector("#settingsTrigger svg")),
      menu: offset(document.querySelector("#wqToggle"), document.querySelector("#wqToggle svg")),
    };
  });
  for (const coordinate of [centers.settings, centers.menu]) {
    expect(coordinate.x).toBeLessThanOrEqual(2);
    expect(coordinate.y).toBeLessThanOrEqual(2);
  }
});


test("a new tab starts in VN and Dark even after the first tab was changed @smoke @core", async ({
  page
}) => {
  const url = base + "/index.html";
  await page.goto(url, { waitUntil:"domcontentloaded" });
  await page.locator("#settingsTrigger").click();
  await page.locator('[data-lang="en"]').click();
  await page.locator('[data-theme-option="light"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme","light");
  await expect(page.locator("html")).toHaveAttribute("lang","en");

  await page.evaluate(destination => {
    const a = document.createElement("a");
    a.href = destination + "?party=groom";
    a.target = "_blank";
    a.rel = "opener";
    a.id = "newTabWithPreferencesTest";
    a.textContent = "open new tab";
    document.querySelector(".party-selector-card").append(a);
  }, url);
  const popupPromise = page.waitForEvent("popup");
  await page.locator("#newTabWithPreferencesTest").click();
  const other = await popupPromise;
  await other.waitForLoadState("domcontentloaded");
  await expect(other.locator("html")).toHaveAttribute("data-theme","dark");
  await expect(other.locator("html")).toHaveAttribute("lang","vi");
  await expect(other.locator("#envelopeIntro")).toBeVisible();
  await other.close();

  await page.reload({ waitUntil:"domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-theme","light");
  await expect(page.locator("html")).toHaveAttribute("lang","en");
});


test("music orb animates when playing, pauses without hiding, stops until re-enabled @smoke @core", async ({
  page,
}) => {
  // Deterministic YouTube mock: no external network or media autoplay required.
  await page.addInitScript(() => {
    window.YT = {
      PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0 },
      Player: function (_host, options) {
        const player = {
          setVolume() {},
          playVideo() {
            window.__musicTestPlayCalls = (window.__musicTestPlayCalls || 0) + 1;
            options.events.onStateChange({ data: 1 });
          },
          pauseVideo() {
            options.events.onStateChange({ data: 2 });
          },
          stopVideo() {
            window.__musicTestStopCalls = (window.__musicTestStopCalls || 0) + 1;
            options.events.onStateChange({ data: 0 });
          },
        };
        queueMicrotask(() => {
          window.__musicMockReady = true;
          options.events.onReady({ target: player });
        });
        return player;
      },
    };
  });

  await page.goto(base + "/index.html?party=bride", { waitUntil: "domcontentloaded" });
  await page.locator("#skipInvitation").click();
  await page.waitForFunction(() => window.__musicMockReady === true);

  const bubble = page.locator("#musicBubble");
  await expect(bubble).toBeHidden();
  await page.locator("#settingsTrigger").click();
  await page.locator("#musicToggle").click();
  await expect(bubble).toBeVisible();
  await expect(bubble).toHaveAttribute("data-music-state", "playing");
  await expect(page.locator("#musicToggle")).toHaveAttribute("aria-pressed", "true");

  const note = page.locator(".music-float-note svg");
  const playingAnimation = await note.evaluate(node => getComputedStyle(node).animationName);
  expect(playingAnimation).toContain("musicFloatSway");

  await page.locator("#musicBubbleTrigger").click();
  await expect(page.locator("#musicBubbleActions")).toBeVisible();
  await expect(page.locator("#musicBubbleStop svg")).toBeVisible();
  const playingBackground = await page.locator("#musicBubbleTrigger").evaluate(
    node => getComputedStyle(node).backgroundImage,
  );

  await page.locator("#musicBubblePause").click();
  await expect(bubble).toBeVisible();
  await expect(bubble).toHaveAttribute("data-music-state", "paused");
  expect(await note.evaluate(node => getComputedStyle(node).animationName)).toBe("none");
  const pausedBackground = await page.locator("#musicBubbleTrigger").evaluate(
    node => getComputedStyle(node).backgroundImage,
  );
  expect(pausedBackground).not.toBe(playingBackground);
  await expect(page.locator("#musicBubbleActions")).toBeHidden();

  await page.locator("#musicBubbleTrigger").click();
  await page.locator("#musicBubblePause").click();
  await expect(bubble).toHaveAttribute("data-music-state", "playing");
  await expect(page.locator("#musicBubbleActions")).toBeHidden();
  await page.locator("#musicBubbleTrigger").click();
  await page.locator("#musicBubbleStop").click();
  await expect(bubble).toBeHidden();
  await expect(page.locator("#musicToggle")).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => window.__musicTestStopCalls)).toBe(1);

  // The stopped bubble cannot start music itself; guests must use Settings.
  await page.locator("#settingsTrigger").click();
  await page.locator("#musicToggle").click();
  await expect(bubble).toBeVisible();
  await expect(bubble).toHaveAttribute("data-music-state", "playing");
  expect(await page.evaluate(() => window.__musicTestPlayCalls)).toBe(3);
});


test("music bubble stays clickable above the unopened envelope and can cancel loading @smoke", async ({ page }) => {
  await page.addInitScript(() => {
    window.YT = {
      PlayerState: { PLAYING:1, PAUSED:2, ENDED:0 },
      Player: function (_host, options) {
        const player = {
          setVolume() {},
          playVideo() { window.__pendingPlays = (window.__pendingPlays || 0) + 1; },
          pauseVideo() { window.__pauseCalls = (window.__pauseCalls || 0) + 1; },
          stopVideo() { window.__stopCalls = (window.__stopCalls || 0) + 1; },
          getPlayerState() { return -1; },
        };
        window.__emitLatePlaying = () => options.events.onStateChange({data:1,target:player});
        queueMicrotask(() => options.events.onReady({target:player}));
        return player;
      },
    };
  });

  await page.goto(base + "/index.html?party=bride", {waitUntil:"domcontentloaded"});
  await expect(page.locator("#envelopeIntro")).toBeVisible();
  await page.locator("#settingsTrigger").click();
  await page.locator("#musicToggle").click();

  const bubble = page.locator("#musicBubble");
  await expect(bubble).toBeVisible();
  await expect(bubble).toHaveAttribute("data-music-state","starting");
  const note = bubble.locator(".music-float-note svg");
  expect(await note.evaluate(node => getComputedStyle(node).animationName)).toBe("none");

  // On the unopened envelope the orb must be interactable, not merely
  // visible behind the overlay (Playwright performs a real hit-test).
  await page.locator("#musicBubbleTrigger").click();
  await expect(page.locator("#musicBubbleActions")).toBeVisible();
  await expect(page.locator("#musicBubblePause")).toBeEnabled();
  await expect(page.locator("#musicBubblePause .music-float-pause-icon")).toBeVisible();
  await page.locator("#musicBubblePause").click();
  await expect(bubble).toHaveAttribute("data-music-state","paused");
  await expect(bubble).toBeVisible();

  await page.locator("#musicBubbleTrigger").click();
  await page.locator("#musicBubbleStop").click();
  await expect(bubble).toBeHidden();
  expect(await page.evaluate(() => window.__stopCalls)).toBe(1);
  await page.evaluate(() => window.__emitLatePlaying());
  await expect(bubble).toBeHidden();
});


test("music confirms playing from player state even if YouTube sends no PLAYING event", async ({ page }) => {
  await page.addInitScript(() => {
    window.YT = {
      PlayerState: { PLAYING:1, PAUSED:2, ENDED:0 },
      Player: function (_host, options) {
        let state = -1;
        const player = {
          setVolume() {},
          playVideo() { state = 1; },
          pauseVideo() { state = 2; },
          stopVideo() { state = 0; },
          getPlayerState() { return state; },
        };
        queueMicrotask(() => options.events.onReady({target:player}));
        return player;
      },
    };
  });

  await page.goto(base + "/index.html?party=groom", {waitUntil:"domcontentloaded"});
  await page.locator("#skipInvitation").click();
  await page.locator("#settingsTrigger").click();
  await page.locator("#musicToggle").click();
  await expect(page.locator("#musicBubble")).toHaveAttribute("data-music-state","playing", {timeout:4000});
  await expect(page.locator("#musicToggle .music-label")).not.toContainText("ĐANG TẢI");
  await page.locator("#musicBubbleTrigger").click();
  await page.locator("#musicBubblePause").click();
  await expect(page.locator("#musicBubble")).toHaveAttribute("data-music-state","paused");
});


test("music loading times out into a retryable paused state instead of freezing", async ({ page }) => {
  await page.addInitScript(() => {
    // Only shorten the product's 10s playback watchdog; leave other timers alone.
    const originalTimeout = window.setTimeout;
    window.setTimeout = (callback, delay, ...args) =>
      originalTimeout(callback, delay === 10000 ? 180 : delay, ...args);
    window.__allowMusicPlay = false;
    window.YT = {
      PlayerState: { PLAYING:1, PAUSED:2, ENDED:0 },
      Player: function (_host, options) {
        const player = {
          setVolume() {},
          playVideo() {
            if (window.__allowMusicPlay) {
              options.events.onStateChange({data:1, target:player});
            }
          },
          pauseVideo() {},
          stopVideo() {},
          getPlayerState() { return window.__allowMusicPlay ? 1 : -1; },
        };
        queueMicrotask(() => options.events.onReady({target:player}));
        return player;
      },
    };
  });

  await page.goto(base + "/index.html?party=bride", {waitUntil:"domcontentloaded"});
  await page.locator("#skipInvitation").click();
  await page.locator("#settingsTrigger").click();
  await page.locator("#musicToggle").click();

  await expect(page.locator("#musicBubble")).toHaveAttribute("data-music-state","paused", {timeout:3000});
  await expect(page.locator("#musicToggle .music-label")).toContainText("THỬ LẠI");
  await page.locator("#musicBubbleTrigger").click();
  await expect(page.locator("#musicBubblePause")).toBeEnabled();
  await page.evaluate(() => window.__allowMusicPlay = true);
  await page.locator("#musicBubblePause").click();
  await expect(page.locator("#musicBubble")).toHaveAttribute("data-music-state","playing", {timeout:3000});
});


test("single reception shows one event, date, venue, map and gift @smoke", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/wedding-info.js*", async route => {
    const response = await route.fetch();
    const context = {window:{}};
    require("node:vm").runInNewContext(await response.text(),context);
    const config = context.window.WEDDING_INFO;
    config.wedding.mode = "single";
    config.parties.single.date = "2027-05-21";
    config.parties.single.receptionTime = "17:30";
    config.parties.single.receptionEnd = "20:00";
    config.parties.single.venue.name = {vi:"Trung Tâm Tiệc Cưới Sen Vàng",en:"Golden Lotus Wedding Hall"};
    await route.fulfill({response,body:"window.WEDDING_INFO = "+JSON.stringify(config)+";"});
  });
  await page.goto(base+"/index.html?to=Minh%20va%20Lan",{waitUntil:"domcontentloaded"});
  await expect(page.locator("html")).toHaveAttribute("data-wedding-mode","single");
  await expect(page.locator("#partySelector")).toBeHidden();
  await expect(page.locator("#envelopeIntro")).toBeVisible();
  await expect(page.locator(".envelope-date [data-party-date='single']")).toHaveText("21 · 05 · 2027");
  await page.locator("#skipInvitation").click();
  await expect(page.locator("#heroCeremonyLabel")).toContainText("TIỆC CƯỚI");
  await expect(page.locator(".hero-date [data-party-date='single']")).toHaveText("21.05.2027");
  await expect(page.locator(".event-card:visible")).toHaveCount(1);
  await expect(page.locator('[data-party-scope="single"] .event-detail')).toContainText("17:30");
  await expect(page.locator(".family-card:visible")).toHaveCount(2);
  const downloadPromise = page.waitForEvent("download");
  await page.locator('[data-calendar="single"]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/tiec-cuoi-.*[.]ics$/);
  await page.locator('a[href="#map-single"].map-button').click();
  await expect(page.locator("#map-single")).toBeVisible();
  await expect(page.locator("#map-single h3")).toHaveText("Trung Tâm Tiệc Cưới Sen Vàng");
  await expect(page.locator("#map-groom")).toBeHidden();
  await page.locator("#wmClose").click();
  const navigationToggle = page.locator("#wqToggle");
  await navigationToggle.evaluate(node => node.classList.add("is-idle"));
  await navigationToggle.click();
  // A genuine one-tap action on mobile must open the panel even while the
  // toggle is collapsed; previous tests only noticed after a 30s timeout.
  await expect(page.locator("#wqPanel")).toHaveClass(/is-open/);
  await expect(page.locator('a[href="#wedding-gift"].wq-link')).toBeVisible();
  await page.locator('a[href="#wedding-gift"].wq-link').click();
  await expect(page.locator(".gift-card:visible")).toHaveCount(1);
  expect(errors).toEqual([]);

  // The same single-mode config must generate a link without party=.
  await page.locator("#wgClose").click();
  await page.goto(base + "/index.html?tool=links&lang=en", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#linkToolScreen")).toBeVisible();
  await expect(page.locator("#linkToolPartyField")).toBeHidden();
  await page.locator("#linkToolGuest").fill("Alex & Jamie");
  await page.locator('#linkToolForm button[type="submit"]').click();
  const invitation = await page.locator("#linkToolGenerated").textContent();
  expect(invitation).toContain("to=Alex+%26+Jamie");
  expect(invitation).toContain("lang=en");
  expect(invitation).not.toContain("party=");
  await page.locator("#linkToolBack").click();
  await expect(page.locator("#envelopeIntro")).toBeVisible();
});
