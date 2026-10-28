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
  await page.locator("#skipInvitation").click();
  await expect(page.locator("#envelopeIntro")).toBeHidden();

  await page.locator("#albumViewport").scrollIntoViewIfNeeded();
  await expect(page.locator(".album-slide")).toHaveCount(30, {
    timeout: 15000,
  });
  const loadedImages = await page.locator(".album-photo[src]").count();
  expect(loadedImages).toBeGreaterThan(0);
  expect(loadedImages).toBeLessThan(18);

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

test("legacy generator URL redirects to the shared in-page view", async ({ page }) => {
  await page.goto(base + "/link-tool.html?lang=en", {
    waitUntil: "domcontentloaded",
  });
  await expect(page).toHaveURL(/index[.]html[?]tool=links&lang=en/);
  await expect(page.locator("#linkToolScreen")).toBeVisible();
  await expect(page.locator("#linkToolTitle")).toHaveText(
    "Create a personalized invitation",
  );
  await expect(page.locator(".language-switch")).toHaveCount(1);
});

test("menu, map and gift overlays open and close on each device @smoke", async ({
  page,
}) => {
  await page.goto(base + "/index.html?party=groom&to=Guest", {
    waitUntil: "domcontentloaded",
  });
  await page.locator("#skipInvitation").click();
  const menuToggle = page.locator("#wqToggle");
  await menuToggle.click();
  if ((await menuToggle.getAttribute("aria-expanded")) !== "true") {
    await menuToggle.click();
  }
  await expect(page.locator("#wqPanel")).toHaveAttribute(
    "aria-hidden",
    "false",
  );
  await page.locator('#wqPanel a[href="#locations"]').click();
  await expect(page.locator("#wmModal")).toBeVisible();
  await page.locator("#wmClose").click();
  await expect(page.locator("#wmModal")).toBeHidden();

  await menuToggle.click();
  if ((await menuToggle.getAttribute("aria-expanded")) !== "true") {
    await menuToggle.click();
  }
  await page.locator('#wqPanel a[href="#wedding-gift"]').click();
  await expect(page.locator("#wgModal")).toBeVisible();
  await page.locator("#wgClose").click();
  await expect(page.locator("#wgModal")).toBeHidden();
});


test("floating language pill really shrinks on touch and desktop", async ({ page }) => {
  await page.goto(base + "/index.html", { waitUntil: "domcontentloaded" });
  const control = page.locator(".language-switch");
  await expect(control).toBeVisible();
  await expect(control).toHaveClass(/floating-control/);

  // Compare rendered layout, not just the visibility of VN/EN text.
  await control.evaluate(node => node.classList.remove("is-idle"));
  await page.waitForTimeout(450);
  const expandedWidth = await control.evaluate(node => node.getBoundingClientRect().width);

  await control.evaluate(node => node.classList.add("is-idle"));
  await page.waitForTimeout(450);
  const collapsedWidth = await control.evaluate(node => node.getBoundingClientRect().width);

  expect(collapsedWidth).toBeLessThanOrEqual(48);
  expect(expandedWidth).toBeGreaterThan(collapsedWidth + 12);
  await expect(page.locator("#settingsTrigger")).toBeVisible();
  await expect(page.locator("#settingsPanel")).toBeHidden();
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

  // A real envelope open + close should persist only for this tab.
  await page.locator("#openInvitation").click();
  await expect(page.locator("#closeInvitation")).toBeVisible();
  await page.locator("#closeInvitation").click();
  await expect(page.locator("#envelopeIntro")).toBeHidden();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#envelopeIntro")).toBeHidden();
  await expect(page.locator("html")).toHaveClass(/envelope-resumed/);
  await expect(page.locator("body")).not.toHaveClass(/envelope-locked/);
  expect(await page.evaluate(() => history.state?.weddingEnvelopeOpened)).toBe(
    JSON.stringify(["bride", "ReloadGuest"]),
  );
});

test("a newly opened tab still shows the envelope", async ({ page }) => {
  const url = base + "/index.html?party=groom&to=TabGuest";
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.locator("#skipInvitation").click();
  await expect(page.locator("#envelopeIntro")).toBeHidden();

  // Open from the already-entered tab; this also catches sessionStorage-clone
  // regressions when the new tab has a same-origin opener.
  await page.evaluate(destination => {
    const link = document.createElement("a");
    link.href = destination;
    link.target = "_blank";
    link.rel = "opener";
    link.id = "testOpenNewInvitationTab";
    link.textContent = "Open invitation in new tab";
    document.body.append(link);
  }, url);
  const popupPromise = page.waitForEvent("popup");
  await page.locator("#testOpenNewInvitationTab").click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  await expect(popup.locator("#envelopeIntro")).toBeVisible();
  await expect(popup.locator("html")).not.toHaveClass(/envelope-resumed/);
  await popup.close();
});

test("previously entered guest/party does not suppress another invitation", async ({
  page,
}) => {
  await page.goto(base + "/index.html?party=bride&to=FirstGuest", {
    waitUntil: "domcontentloaded",
  });
  await page.locator("#skipInvitation").click();
  await expect(page.locator("#envelopeIntro")).toBeHidden();

  // Even if a router reuses history.state when the URL changes, the
  // party + personalized guest must match before skipping the envelope.
  await page.evaluate(() => {
    const next = new URL(location.href);
    next.searchParams.set("party", "groom");
    next.searchParams.set("to", "SecondGuest");
    history.replaceState(history.state, "", next);
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#envelopeIntro")).toBeVisible();
});


test("a deploy cache refresh keeps the already opened invitation in the same tab", async ({
  page,
}) => {
  const url = base + "/index.html?party=bride&to=DeployGuest";
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.locator("#skipInvitation").click();
  await expect(page.locator("#envelopeIntro")).toBeHidden();

  await page.route("**/version.json*", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ build: "test-deploy-new-version" }),
    }),
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/[_]v=test-deploy-new-version/);
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator("#envelopeIntro")).toBeHidden();
  expect(await page.evaluate(() => history.state?.weddingEnvelopeOpened)).toBe(
    JSON.stringify(["bride", "DeployGuest"]),
  );
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
    node.style.top = Math.max(10, innerHeight - 64) + "px";
    node.style.left = Math.floor(innerWidth / 2) + "px";
    node.style.right = "auto";
  });
  await page.locator("#settingsTrigger").click();
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
});

test("unnamed invitation remains generic instead of showing an empty recipient name", async ({
  page,
}) => {
  await page.goto(base + "/index.html?party=groom", { waitUntil:"domcontentloaded" });
  await expect(page.locator("#envelopeGuestLabel")).toHaveText("Trân trọng kính mời");
  await expect(page.locator("#envelopeGuest")).toBeHidden();
  await page.locator("#skipInvitation").click();
  await expect(page.locator("#guestName")).toBeHidden();
  await expect(page.locator("#heroGuestLabel")).toContainText("Trân trọng kính mời");
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
});

test("collapsed settings icon is centered both vertically and horizontally @smoke", async ({ page }) => {
  await page.goto(base + "/index.html", { waitUntil:"domcontentloaded" });
  const dock = page.locator("#settingsHub");
  await dock.evaluate(node => node.classList.add("is-idle"));
  const result = await dock.evaluate(node => {
    const bounds = node.getBoundingClientRect();
    const icon = node.querySelector(".settings-trigger svg").getBoundingClientRect();
    const label = node.querySelector(".settings-trigger-label");
    return {
      dx:Math.abs((bounds.left + bounds.width / 2) - (icon.left + icon.width / 2)),
      dy:Math.abs((bounds.top + bounds.height / 2) - (icon.top + icon.height / 2)),
      labelDisplay:getComputedStyle(label).display
    };
  });
  expect(result.dx).toBeLessThanOrEqual(2);
  expect(result.dy).toBeLessThanOrEqual(2);
  expect(result.labelDisplay).toBe("none");
});

test("light palette remains light when opening an invitation @smoke @core", async ({ page }) => {
  await page.goto(base + "/index.html", { waitUntil:"domcontentloaded" });
  await page.locator("#settingsTrigger").click();
  await page.locator('[data-theme-option="light"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme","light");
  await page.locator("#settingsClose").click();

  await page.locator('[data-party-select="bride"]').click();
  await expect(page.locator("#envelopeIntro")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme","light");
  await page.locator("#skipInvitation").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme","light");

  const hub = page.locator("#settingsHub");
  await hub.evaluate(node => node.classList.add("is-idle"));
  const actual = await hub.evaluate(node => {
    const color = getComputedStyle(node).backgroundColor;
    const root = document.documentElement.dataset.theme;
    const parsed = color.match(/[\\d.]+/g)?.slice(0,3).map(Number) || [];
    return {color,root,parsed};
  });
  expect(actual.root).toBe("light");
  expect(actual.parsed.length).toBe(3);
  expect(actual.parsed[0]).toBeGreaterThan(180);
  expect(actual.parsed[1]).toBeGreaterThan(170);
  expect(actual.parsed[2]).toBeGreaterThan(150);
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
    a.href = destination;
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
  await other.close();

  await page.reload({ waitUntil:"domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-theme","light");
  await expect(page.locator("html")).toHaveAttribute("lang","en");
});
