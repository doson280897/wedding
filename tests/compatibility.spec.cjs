const { test, expect } = require("@playwright/test");
const base = "http://127.0.0.1:8000";

// Native media mock: deterministic buffering/rejection without external video.
async function mockWeddingAudio(page, delay = 0) {
  await page.addInitScript(delay => {
    const state = new WeakMap();
    const get = audio => {
      if (!state.has(audio)) state.set(audio, {paused:true,time:0});
      return state.get(audio);
    };
    Object.defineProperty(HTMLMediaElement.prototype, "paused", {get(){return get(this).paused;}});
    Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
      get(){return get(this).time;},
      set(value){get(this).time=value;}
    });
    Object.defineProperty(HTMLMediaElement.prototype, "error", {get(){return get(this).error || null;}});
    HTMLMediaElement.prototype.load = function() {
      window.__audioReloadCalls=(window.__audioReloadCalls||0)+1;
      get(this).error=null;
      get(this).time=0;
    };
    HTMLMediaElement.prototype.play = function() {
      const audio=this;
      window.__plays=(window.__plays||0)+1;
      window.__playInActivation=navigator.userActivation?.isActive;
      if (window.__rejectNextPlay) {
        window.__rejectNextPlay=false;
        return Promise.reject(new DOMException("Blocked", "NotAllowedError"));
      }
      get(audio).paused=false;
      window.__advanceMusic=value=>{audio.currentTime=value;};
      window.__failAudio=()=>{
        get(audio).error={code:2};
        audio.dispatchEvent(new Event("error"));
      };
      window.__musicTestEmit=type=>audio.dispatchEvent(new Event(type));
      if (delay) audio.dispatchEvent(new Event("waiting"));
      return new Promise(resolve => setTimeout(() => {
        // Late playing events deliberately exercise cancellation after Pause.
        audio.dispatchEvent(new Event("playing"));
        resolve();
      },delay));
    };
    HTMLMediaElement.prototype.pause = function() {
      window.__pauses=(window.__pauses||0)+1;
      get(this).paused=true;
      this.dispatchEvent(new Event("pause"));
    };
  }, delay);
}

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

  // Language and music share the draggable settings palette.
  await page.locator("#settingsTrigger").click();
  await expect(page.locator("#settingsPanel")).toBeVisible();
  await languageControl.locator('[data-lang="en"]').click();
  await expect(page.locator(".party-admin-link")).toContainText(
    "CREATE PERSONALIZED",
  );
  // Dismiss the popover before activating a link behind it. On compact
  // mobile viewports the popover can physically cover the chooser link.
  await page.locator("#settingsClose").click();

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

  // Native Safari pickers must not expose a disabled template-only third row.
  await expect(page.locator("#linkToolParty option")).toHaveCount(2);
  expect(await page.locator("#linkToolParty option").evaluateAll(options => options.map(option => option.value))).toEqual(["bride", "groom"]);
  await page.locator("#linkToolGuest").fill("Minh & Lan");
  await page.locator("#linkToolParty").selectOption("groom");
  await page.locator('#linkToolForm button[type="submit"]').click();
  await expect(page.locator("#linkToolGenerated")).toContainText(
    "party=groom",
  );
  await expect(page.locator("#linkToolGenerated")).toContainText(
    "lang=en",
  );

  const englishInvitation = await page.locator("#linkToolPreview").getAttribute("href");
  await page.locator("#linkToolBack").click();
  await expect(page.locator("#linkToolScreen")).toBeHidden();
  await expect(page.locator("#partySelector")).toBeVisible();

  // Follow the generated URL as a recipient: its language must reach the gate
  // and every invitation section, not just the generator's preview text.
  await page.goto(englishInvitation, { waitUntil:"domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator(".moonlight-gate__reveal-overline")).toHaveText("OUR WEDDING DAY");
  await expect(page.locator(".moonlight-gate__reveal-subtitle")).toHaveText("TOGETHER · FOREVER");
  await expect(page.locator("#gateGuestLabel")).toHaveText("Cordially inviting");
  await expect(page.locator("#gateGuestName")).toHaveText("Minh & Lan");
  await expect(page.locator("#waxOpenButton")).toHaveAttribute("aria-label", "Tap the lock to open the invitation");
  await page.locator("#waxOpenButton").click();
  await expect(page.locator("#moonlightGate")).toBeHidden({ timeout:16000 });
  await expect(page.locator("#heroCeremonyLabel")).toHaveText("— GROOM'S CEREMONY —");
  await expect(page.locator('#family [data-i18n="family.title"]')).toHaveText("With joy, our families announce");
  await expect(page.locator('#events [data-i18n="events.title"]')).toHaveText("Wedding details");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(errors).toEqual([]);
});


test("unified hub shows Settings only outside and defaults to Menu inside @smoke @core", async ({page}) => {
  await page.goto(base + "/index.html",{waitUntil:"domcontentloaded"});
  await page.locator("#settingsTrigger").click();
  await expect(page.locator("#settingsTabContent")).toBeVisible();
  await expect(page.locator("#controlTabs")).toBeHidden();
  await expect(page.locator("#wqPanel")).toBeHidden();
  await page.locator("#settingsClose").click();

  await page.goto(base + "/index.html?party=bride",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#settingsHub")).toBeHidden();
  await page.locator("#waxOpenButton").click();
  await expect(page.locator("#moonlightGate")).toBeHidden({timeout:16000});
  await page.locator("#settingsTrigger").click();
  await expect(page.locator("#controlTabs")).toBeVisible();
  await expect(page.locator("#controlTabMenu")).toHaveAttribute("aria-selected","true");
  await expect(page.locator("#wqPanel")).toBeVisible();
  await expect(page.locator("#settingsTabContent")).toBeHidden();
  await page.locator("#controlTabSettings").click();
  await expect(page.locator("#settingsTabContent")).toBeVisible();
  await page.locator("#settingsClose").click();
  await page.locator("#settingsTrigger").click();
  await expect(page.locator("#controlTabMenu")).toHaveAttribute("aria-selected","true");
});

test("music bubble waits for PLAYING and resume preserves paused time @smoke @core", async ({page}) => {
  test.setTimeout(55000);
  await mockWeddingAudio(page, 400);
  await page.goto(base+"/index.html?party=bride",{waitUntil:"domcontentloaded"});
  await page.locator("#waxOpenButton").click();
  // The seal tap starts playback, while the orb stays hidden over the gate.
  await expect(page.locator("#musicBubble")).toBeHidden();
  await expect(page.locator("#moonlightGate")).toBeHidden({timeout:16000});
  await expect(page.locator("#musicBubble")).toBeVisible({timeout:3500});
  await expect(page.locator("#musicBubble")).toHaveAttribute("data-music-state","playing");
  await page.evaluate(()=>window.__advanceMusic(83.5));
  await page.locator("#musicBubbleTrigger").click();
  await page.locator("#musicBubblePause").click();
  await expect(page.locator("#musicBubble")).toHaveAttribute("data-music-state","paused");
  await page.locator("#musicBubbleTrigger").click();
  await page.locator("#musicBubblePause").click();
  await expect(page.locator("#musicBubble")).toHaveAttribute("data-music-state","playing",{timeout:3500});
  expect(await page.locator("#weddingMusic").evaluate(audio=>audio.currentTime)).toBe(83.5);
  // A connection can fail AFTER playback began, not just on the first tap.
  await page.evaluate(() => { window.__advanceMusic(127.25); window.__musicTestEmit("waiting"); });
  await expect(page.locator("#musicBubble")).toHaveAttribute("data-music-state", "starting");
  await expect(page.locator("#musicBubble")).toHaveAttribute("data-music-state", "paused", {timeout:18000});
  // A late iframe callback must not resume after the watchdog has cancelled it.
  await page.evaluate(() => window.__musicTestEmit("playing"));
  await expect(page.locator("#musicBubble")).toHaveAttribute("data-music-state", "paused");
  await page.locator("#musicBubbleTrigger").click();
  await page.locator("#musicBubblePause").click();
  await expect(page.locator("#musicBubble")).toHaveAttribute("data-music-state", "playing", {timeout:3500});
  expect(await page.locator("#weddingMusic").evaluate(audio=>audio.currentTime)).toBe(127.25);
});

test("party link, wax gate and album lightbox interactions", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(
    base + "/index.html?party=bride&to=CrossDeviceTest&lang=vi",
    { waitUntil: "domcontentloaded" },
  );
  await expect(page.locator("#moonlightGate")).toBeVisible();
  await expect(page.locator("#waxOpenButton")).toBeVisible();
  // Preload the MP3 while the gate is locked.
  await expect(page.locator("#weddingMusic")).toHaveAttribute("preload", "auto");
  await expect(page.locator("iframe[src*=youtube]")).toHaveCount(0);
  // The seal is personalized from data, not hard-coded into the HTML.
  const initials = await page.evaluate(() =>
    window.WEDDING_INFO.couple.bride.initial + " · " + window.WEDDING_INFO.couple.groom.initial
  );
  await expect(page.locator("#waxMonogram img.fairy-lock")).toHaveCount(1);
  await page.locator("#waxOpenButton").click();
  await expect(page.locator("#moonlightGate")).toHaveClass(/is-awakening/);
  await expect(page.locator("#moonlightGate")).toHaveClass(/is-opening/);
  await expect(page.locator("#moonlightGate")).toBeHidden({ timeout:16000 });
  await expect(page.locator("html")).not.toHaveClass(/wax-pending/);
  await expect(page.locator("#heroMonogram")).toContainText(initials.split(" · ")[0]);
  await page.locator("#coupleHeading").scrollIntoViewIfNeeded();
  await expect(page.locator("#coupleHeading")).toHaveClass(/is-visible/);

  await page.locator("#albumViewport").scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator(".album-slide").count()).toBeGreaterThan(0);
  const totalSlides = await page.locator(".album-slide").count();
  const loadedImages = await page.locator(".album-photo[src]").count();
  expect(loadedImages).toBeGreaterThan(0);
  if (totalSlides > 12) expect(loadedImages).toBeLessThan(totalSlides);
  // Offscreen slides must not reserve GPU compositor layers.
  const layers = await page.locator(".album-slide").evaluateAll(slides => ({
    promoted:slides.filter(slide => slide.style.willChange.includes("transform")).length,
    hiddenPromoted:slides.filter(slide =>
      slide.style.opacity === "0" && slide.style.willChange.includes("transform")).length
  }));
  expect(layers.hiddenPromoted).toBe(0);
  expect(layers.promoted).toBeGreaterThan(0);
  expect(layers.promoted).toBeLessThanOrEqual(9);
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
  await page.locator("#waxOpenButton").click();
  await expect(page.locator("#moonlightGate")).toBeHidden({ timeout:16000 });
  const hub = page.locator("#settingsTrigger");
  await expect(page.locator("#wqToggle")).toHaveCount(0);
  await hub.click();
  await expect(page.locator("#controlTabMenu")).toHaveAttribute("aria-selected","true");
  await expect(page.locator("#wqPanel")).toBeVisible();
  await page.locator('#wqPanel a[href="#locations"]').click();
  await expect(page.locator("#wmModal")).toBeVisible();
  await page.locator("#wmClose").click();
  await expect(page.locator("#wmModal")).toBeHidden();

  await hub.click();
  await expect(page.locator("#controlTabMenu")).toHaveAttribute("aria-selected","true");
  // A hidden gift popup should not fetch bank QR images on first paint.
  const activeQR = page.locator(".gift-card[data-party-scope='groom'] .gift-qr");
  await expect(activeQR).not.toHaveAttribute("src", /.+/);
  await page.locator('#wqPanel a[href="#wedding-gift"]').click();
  await expect(page.locator("#wgModal")).toBeVisible();
  await expect(activeQR).toHaveAttribute("src", /.+/);
  await page.locator("#wgClose").click();
  await expect(page.locator("#wgModal")).toBeHidden();
});


test("editing only wedding-info.js updates names, initials, dates, venue and gifts", async ({
  page,
}) => {
  await mockWeddingAudio(page);
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
    config.parties.bride.music.src = config.parties.groom.music.src;
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
  await page.locator("#waxOpenButton").click();
  await expect(page.locator("#moonlightGate")).toBeHidden({ timeout:16000 });

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
    music: decodeURI(new URL(document.getElementById("weddingMusic").src).pathname).split("/").pop(),
    configuredMusic: window.WEDDING_INFO.parties.bride.music.src,
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


test("Moonlight Gate opens from personalized wax and reveals the invitation @core", async ({ page }) => {
  await page.goto(base + "/index.html?party=bride&to=ReloadGuest", { waitUntil:"domcontentloaded" });
  const gate = page.locator("#moonlightGate");
  await expect(gate).toBeVisible();
  await expect(page.locator("#waxOpenButton")).toBeVisible();
  await expect(page.locator("#waxMonogram img.fairy-lock")).toHaveCount(1);
  await expect(page.locator(".moonlight-gate__reveal-overline")).toHaveText("NGÀY CHUNG ĐÔI");
  await expect(page.locator(".moonlight-gate__celestial")).toHaveCount(0);
  await expect(page.locator(".moonlight-gate__hint")).toHaveCount(0);
  await expect(page.locator("#settingsHub")).toBeHidden();
  await expect(page.locator("#wqToggle")).toBeHidden();
  const gateLayout = await page.evaluate(() => {
    const scene = document.querySelector(".moonlight-gate__scene").getBoundingClientRect();
    const backdrop = document.querySelector(".moonlight-gate__backdrop");
    const leftDoor = document.querySelector(".moonlight-gate__door--left");
    return {
      viewportW:innerWidth,
      viewportH:innerHeight,
      sceneW:scene.width,
      sceneH:scene.height,
      backdropZ:Number(getComputedStyle(backdrop).zIndex),
      doorZ:Number(getComputedStyle(leftDoor).zIndex)
    };
  });
  expect(Math.abs(gateLayout.sceneW - gateLayout.viewportW)).toBeLessThanOrEqual(1);
  expect(Math.abs(gateLayout.sceneH - gateLayout.viewportH)).toBeLessThanOrEqual(2);
  expect(gateLayout.backdropZ).toBeLessThan(gateLayout.doorZ);

  await page.locator("#waxOpenButton").click();
  await expect(gate).toHaveClass(/is-awakening/);
  await expect(gate).toHaveClass(/is-opening/);
  // Lightweight visual accents start with the doors, never in the pre-open view.
  const expectedSparks = await page.evaluate(() => matchMedia("(pointer: coarse)").matches ? 8 : 12);
  await expect(page.locator("#gateMagic .moonlight-gate__spark")).toHaveCount(expectedSparks);
  await expect(page.locator("#gateMagic canvas.moonlight-gate__meteor-canvas")).toHaveCount(1);
  await expect.poll(() => page.locator(".moonlight-gate__meteor-canvas")
    .evaluate(node => node.width)).toBeGreaterThan(0);
  await expect(page.locator("#gateMagic .moonlight-gate__butterfly")).toHaveCount(3);
  const celestialMotion = await page.evaluate(() => ({
    butterfly:getComputedStyle(document.querySelector(".moonlight-gate__butterfly--one")).animationName,
    spark:getComputedStyle(document.querySelector(".moonlight-gate__spark")).animationName
  }));
  expect(celestialMotion.butterfly).toBe("gateButterflyDrift");
  expect(celestialMotion.spark).toBe("gateStarTwinkle");
  // The class is applied before the browser paints its first transform frame.
  // Poll the computed 3D rotation rather than sampling that stale frame.
  const leftDoor = page.locator(".moonlight-gate__door--left");
  const rightDoor = page.locator(".moonlight-gate__door--right");
  await expect(leftDoor).toHaveCSS("transform", /matrix3d\(/);
  await expect(rightDoor).toHaveCSS("transform", /matrix3d\(/);
  const hingeState = await page.evaluate(() => {
    const left = document.querySelector(".moonlight-gate__door--left");
    const right = document.querySelector(".moonlight-gate__door--right");
    const l = getComputedStyle(left);
    const r = getComputedStyle(right);
    return {
      leftOrigin:Number.parseFloat(l.transformOrigin),
      rightOrigin:Number.parseFloat(r.transformOrigin),
      artboardWidth:document.querySelector(".fairy-artboard").clientWidth
    };
  });
  expect(hingeState.leftOrigin / hingeState.artboardWidth).toBeCloseTo(.17, 2);
  expect(hingeState.rightOrigin / hingeState.artboardWidth).toBeCloseTo(.83, 2);
  const hingeDuration = await page.locator(".moonlight-gate__door--left").evaluate(node =>
    parseFloat(getComputedStyle(node).animationDuration) * 1000
  );
  expect(hingeDuration).toBeGreaterThanOrEqual(1400);
  await expect(gate).toHaveClass(/is-opened/, { timeout:6000 });
  await expect(page.locator("#gateGreeting")).toBeVisible();
  await expect(page.locator(".moonlight-gate__reveal-names")).toContainText("Nga");
  await expect(page.locator("#gateGuestName")).toHaveText("ReloadGuest");
  await expect(page.locator(".fairy-artboard")).toHaveCSS("opacity", "0");
  const approach = await page.locator(".fairy-artboard").evaluate(node => getComputedStyle(node).transform);
  expect(approach).not.toBe("none");
  await expect(page.locator("#settingsHub")).toBeHidden();
  await expect(page.locator("#wqToggle")).toBeHidden();
  await expect(leftDoor).toBeHidden();
  const invitationMotion = await page.evaluate(() => ({
    wings:getComputedStyle(document.querySelector(".moonlight-gate__wing--left")).animationName,
    butterflies:getComputedStyle(document.querySelector(".moonlight-gate__butterfly")).animationIterationCount,
    heading:getComputedStyle(document.querySelector(".moonlight-gate__reveal-heading")).opacity
  }));
  expect(invitationMotion.wings).toBe("gateWingLeft");
  expect(invitationMotion.butterflies).toBe("infinite");
  expect(invitationMotion.heading).toBe("1");
  // The cinematic reveal beat precedes the sky/title zoom
  // out WHILE the actual hero zooms in and both layers crossfade.
  await expect(gate).toHaveClass(/is-handoff/, { timeout:4500 });
  await expect(page.locator("html")).toHaveClass(/gate-hero-revealing/);
  const handoff = await page.evaluate(() => {
    const style = node => getComputedStyle(document.querySelector(node));
    return {
      duration:parseFloat(style("#moonlightGate").transitionDuration),
      clock:parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gate-handoff-time")) / 1000,
      moving:[".moonlight-gate__backdrop", ".moonlight-gate__reveal", ".hero"].map(selector => ({
        durations:style(selector).transitionDuration.split(",").map(Number.parseFloat),
        properties:style(selector).transitionProperty
      }))
    };
  });
  // The approved faster handoff remains a real crossfade, with every moving
  // layer on the same clock. Avoid assertions tied to obsolete CSS strings.
  expect(handoff.duration).toBeGreaterThanOrEqual(.9);
  expect(handoff.duration).toBeLessThanOrEqual(1.3);
  expect(handoff.duration).toBeCloseTo(handoff.clock, 2);
  for (const layer of handoff.moving) {
    expect(layer.properties).toContain("transform");
    expect(layer.durations.every(time => Math.abs(time - handoff.duration) < .02)).toBe(true);
  }
  await expect(page.locator(".hero")).toHaveCSS("opacity","1");
  await expect(gate).toBeHidden({ timeout:16000 });
  await expect(page.locator("html")).not.toHaveClass(/wax-pending/);
  await expect(page.locator(".hero")).toBeVisible();
  await expect(page.locator("#settingsHub")).toBeVisible();
  await expect(page.locator("#wqToggle")).toHaveCount(0);
  await expect(page.locator("#controlTabMenu")).toHaveCount(1);

  // New-tab/reload baseline intentionally shows the gate again.
  await page.reload({ waitUntil:"domcontentloaded" });
  await expect(gate).toBeVisible();
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


test("Settings and Menu share identical drag, snap and tap behavior @smoke @core", async ({ page }) => {
  await page.goto(base + "/index.html?party=groom", { waitUntil:"domcontentloaded" });
  await page.locator("#waxOpenButton").click();
  await expect(page.locator("#moonlightGate")).toBeHidden({ timeout:16000 });
  const controls = [
    { id:"settingsHub", trigger:"#settingsTrigger", open:"#settingsPanel" },
  ];

  for (const control of controls) {
    const dock = page.locator("#" + control.id);
    await dock.evaluate(node => node.classList.add("is-idle"));
    await page.waitForTimeout(350);

    // Dispatch pointer gestures directly to avoid desktop hover waking the
    // button before the touch begins. The app's real drag listeners run.
    const drag = async (towardsLeft, pointerId) => page.evaluate(
      ({ id, trigger, towardsLeft, pointerId }) => {
        const node = document.getElementById(id);
        const handle = document.querySelector(trigger);
        const before = node.getBoundingClientRect();
        const startX = before.left + before.width / 2;
        const startY = before.top + before.height / 2;
        const endX = towardsLeft ? 12 : innerWidth - 12;
        const endY = Math.min(innerHeight - 66, Math.max(66, startY + (towardsLeft ? 80 : -65)));
        const props = { bubbles:true, cancelable:true, pointerId, pointerType:"touch", isPrimary:true, button:0 };
        handle.dispatchEvent(new PointerEvent("pointerdown", { ...props, clientX:startX, clientY:startY }));
        const whilePressed = node.getBoundingClientRect();
        window.dispatchEvent(new PointerEvent("pointermove", { ...props, clientX:endX, clientY:endY }));
        const duringDrag = node.getBoundingClientRect();
        window.dispatchEvent(new PointerEvent("pointerup", { ...props, clientX:endX, clientY:endY }));
        return {
          beforeWidth:before.width,
          pressedWidth:whilePressed.width,
          duringLeft:duringDrag.left,
          userMoved:node.dataset.userMoved,
        };
      }, { id:control.id, trigger:control.trigger, towardsLeft, pointerId }
    );

    const left = await drag(true, 34);
    expect(Math.abs(left.pressedWidth - left.beforeWidth)).toBeLessThan(2);
    expect(left.userMoved).toBe("true");
    await page.waitForTimeout(380);
    const afterLeft = await dock.evaluate(node => ({
      edge:node.dataset.floatEdge, left:node.getBoundingClientRect().left
    }));
    expect(afterLeft.edge).toBe("left");
    expect(afterLeft.left).toBeLessThanOrEqual(20);

    // Drag back: both dock to the nearest right edge as one shared mechanic.
    const right = await drag(false, 35);
    expect(right.userMoved).toBe("true");
    await page.waitForTimeout(380);
    const afterRight = await dock.evaluate(node => ({
      edge:node.dataset.floatEdge, right:innerWidth - node.getBoundingClientRect().right
    }));
    expect(afterRight.edge).toBe("right");
    expect(afterRight.right).toBeLessThanOrEqual(24);

    // Dragging must not accidentally open the panel; a subsequent tap does.
    await expect(page.locator("#settingsPanel")).toBeHidden();
    await page.locator(control.trigger).click();
    await expect(page.locator(control.open)).toBeVisible();
    await page.locator("#settingsClose").click();
  }
});


test("tap immediately after a drag is not swallowed on touch screens @smoke @core", async ({page}) => {
  await page.goto(base+"/index.html",{waitUntil:"domcontentloaded"});
  const trigger=page.locator("#settingsTrigger");
  await page.evaluate(() => {
    const handle=document.getElementById("settingsTrigger");
    const rect=handle.getBoundingClientRect();
    const x=rect.left+rect.width/2,y=rect.top+rect.height/2;
    const props={bubbles:true,cancelable:true,pointerId:77,pointerType:"touch",isPrimary:true,button:0};
    handle.dispatchEvent(new PointerEvent("pointerdown",{...props,clientX:x,clientY:y}));
    window.dispatchEvent(new PointerEvent("pointermove",{...props,clientX:15,clientY:Math.max(80,y-130)}));
    window.dispatchEvent(new PointerEvent("pointerup",{...props,clientX:15,clientY:Math.max(80,y-130)}));
  });
  await expect(page.locator("#settingsHub")).toHaveAttribute("data-float-edge","left");
  await page.waitForTimeout(420); // Let the edge snap settle.
  await trigger.click();
  await expect(page.locator("#settingsPanel")).toBeVisible();
});

test("music orb drags while playing, snaps to edges and keeps player running @smoke @core", async ({page}) => {
  await mockWeddingAudio(page);
  await page.goto(base+"/index.html?party=groom",{waitUntil:"domcontentloaded"});
  await page.locator("#waxOpenButton").click();
  await expect(page.locator("#moonlightGate")).toBeHidden({timeout:16000});
  // Playing was initiated by the seal, not by a second Settings click.
  const orb = page.locator("#musicBubble");
  await expect(orb).toBeVisible();
  await expect(orb).toHaveAttribute("data-music-state","playing");
  await expect(page.locator("#settingsPanel")).toBeHidden();

  const dragTo = async (toLeft,id) => page.evaluate(({toLeft,id}) => {
    const node=document.getElementById("musicBubble");
    const handle=document.getElementById("musicBubbleTrigger");
    const rect=node.getBoundingClientRect();
    const x=rect.left+rect.width/2,y=rect.top+rect.height/2;
    const x2=toLeft?10:innerWidth-10,y2=Math.max(70,y-115);
    const event=(name,xx,yy)=>new PointerEvent(name,{
      bubbles:true,cancelable:true,pointerId:id,pointerType:"touch",
      isPrimary:true,button:0,clientX:xx,clientY:yy
    });
    handle.dispatchEvent(event("pointerdown",x,y));
    window.dispatchEvent(event("pointermove",x2,y2));
    window.dispatchEvent(event("pointerup",x2,y2));
    return node.dataset.userMoved;
  },{toLeft,id});
  expect(await dragTo(false,17)).toBe("true");
  await expect(orb).toHaveAttribute("data-float-edge","right");
  await page.waitForTimeout(420);
  let position=await orb.evaluate(node=>{const r=node.getBoundingClientRect();return innerWidth-r.right;});
  expect(position).toBeLessThanOrEqual(25);
  expect(await dragTo(true,18)).toBe("true");
  await expect(orb).toHaveAttribute("data-float-edge","left");
  await page.waitForTimeout(420);
  position=await orb.evaluate(node=>node.getBoundingClientRect().left);
  expect(position).toBeLessThanOrEqual(25);
  await expect(orb).toHaveAttribute("data-music-state","playing");
  expect(await page.evaluate(()=>window.__plays)).toBe(1);
  expect(await page.evaluate(()=>window.__pauses||0)).toBe(0);
  await page.locator("#musicBubbleTrigger").click();
  await expect(page.locator("#musicBubbleActions")).toBeVisible();
});

test("personal invitation highlights its recipient only in the falling-star gate @smoke @core", async ({ page }) => {
  const guest = "Anh Minh và chị Lan";
  await page.goto(base + "/index.html?party=bride&to=" + encodeURIComponent(guest), {
    waitUntil:"domcontentloaded",
  });
  await expect(page.locator("#gateGuestLabel")).toHaveText("Trân trọng kính mời");
  await expect(page.locator("#gateGuestName")).toHaveText(guest);
  await expect(page.locator("#home #gateGreeting, #heroGreeting, #heroGuestLabel, #guestName")).toHaveCount(0);
  await page.locator("#waxOpenButton").click();
  await expect(page.locator("#moonlightGate")).toHaveClass(/is-opened/, { timeout:10000 });
  const name = page.locator(".moonlight-gate__reveal #gateGuestName");
  await expect(name).toBeVisible();
  expect(await name.evaluate(node => Number(getComputedStyle(node).fontWeight))).toBeGreaterThanOrEqual(600);
  const box = await name.boundingBox();
  const viewport = page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
  await expect(page.locator("#moonlightGate")).toBeHidden({ timeout:16000 });
  await expect(page.locator("#home")).not.toContainText(guest);
  await expect(page.locator("#home")).not.toContainText("Trân trọng kính mời");

  // The scene uses the same global language/config as the invitation.
  await page.goto(base + "/index.html?party=groom&lang=en&to=" + encodeURIComponent(guest), { waitUntil:"domcontentloaded" });
  await expect(page.locator("#gateGuestLabel")).toHaveText("Cordially inviting");
  await expect(page.locator("#gateGuestName")).toHaveText(guest);

  // No name means a complete invitation line with no empty highlighted row.
  await page.goto(base + "/index.html?party=groom", { waitUntil:"domcontentloaded" });
  await expect(page.locator("#gateGuestLabel")).toHaveText("Trân trọng kính mời");
  await expect(page.locator("#gateGuestName")).toBeHidden();
  await expect(page.locator("#gateGuestName")).toHaveText("");
});


test("F5 resets the single floating hub to bottom-right and keeps its icon centered @smoke", async ({ page }) => {
  await page.goto(base + "/index.html", { waitUntil:"domcontentloaded" });
  const hub = page.locator("#settingsHub");
  await expect(hub).toHaveClass(/floating-control/);
  await expect(page.locator("#wqToggle")).toHaveCount(0);
  await hub.evaluate(node => {
    node.dataset.userMoved = "true";
    node.dataset.floatEdge = "left";
    node.style.top = Math.round(innerHeight * .43) + "px";
    node.style.left = "8px";
    node.style.right = "auto";
  });
  await page.reload({ waitUntil:"domcontentloaded" });
  const corner = await hub.evaluate(node => {
    const r=node.getBoundingClientRect();
    return { right:innerWidth-r.right,bottom:innerHeight-r.bottom };
  });
  expect(corner.right).toBeLessThanOrEqual(30);
  expect(corner.bottom).toBeLessThanOrEqual(40);
  await hub.evaluate(node => node.classList.add("is-idle"));
  await page.waitForTimeout(350);
  const centered = await hub.evaluate(node => {
    const a=node.getBoundingClientRect();
    const b=node.querySelector("#settingsTrigger svg").getBoundingClientRect();
    return {x:Math.abs((a.left+a.width/2)-(b.left+b.width/2)),y:Math.abs((a.top+a.height/2)-(b.top+b.height/2))};
  });
  expect(centered.x).toBeLessThanOrEqual(2);
  expect(centered.y).toBeLessThanOrEqual(2);
});


test("Dark stays fixed across OS settings and tabs while language survives F5 @smoke @core", async ({
  page
}) => {
  await page.emulateMedia({ colorScheme:"dark" });
  const url = base + "/index.html";
  await page.goto(url, { waitUntil:"domcontentloaded" });
  await page.locator("#settingsTrigger").click();
  await page.locator('[data-lang="en"]').click();
  await expect(page.locator("[data-theme-option]")).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
  await expect(page.locator("html")).toHaveAttribute("lang","en");
  await page.locator("#settingsClose").click();

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
  await expect(other.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(other.locator("html")).toHaveAttribute("lang","vi");
  await expect(other.locator("#waxOpenButton")).toBeVisible();
  await other.close();

  await page.evaluate(() => history.replaceState({ ...history.state, weddingPreferences: { language: "en", theme: "light" } }, ""));
  await page.reload({ waitUntil:"domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
  await expect(page.locator("html")).toHaveAttribute("lang","en");

  const lightPage = await page.context().newPage();
  await lightPage.emulateMedia({ colorScheme:"light" });
  await lightPage.goto(url + "?party=bride", { waitUntil:"domcontentloaded" });
  await expect(lightPage.locator("html")).toHaveAttribute("data-theme","dark");
  await expect(lightPage.locator("#moonlightGate")).toBeVisible();
  await expect(lightPage.locator(".moonlight-gate__backdrop")).toBeVisible();
  await expect(lightPage.locator("#settingsHub")).toBeHidden();
  await expect(lightPage.locator('meta[name="theme-color"]')).toHaveAttribute("content","#0b161e");
  await lightPage.locator("#waxOpenButton").click();
  await expect(lightPage.locator("#moonlightGate")).toBeHidden({ timeout:16000 });
  await expect(lightPage.locator("#settingsHub")).toBeVisible();
  await lightPage.locator("#settingsTrigger").click();
  await lightPage.locator("#controlTabSettings").click();
  await expect(lightPage.locator("[data-theme-option]")).toHaveCount(0);
  await expect(lightPage.locator('meta[name="theme-color"]')).toHaveAttribute("content","#0b0e0e");
  await lightPage.close();
});



test("menu section navigation keeps Dark and preserves per-tab language on F5 @smoke", async ({ page }) => {
  await page.goto(base + "/index.html?party=bride", { waitUntil:"domcontentloaded" });
  await page.locator("#waxOpenButton").click();
  await expect(page.locator("#moonlightGate")).toBeHidden({ timeout:16000 });
  await page.locator("#settingsTrigger").click();
  await page.locator("#controlTabSettings").click();
  await page.locator('[data-lang="en"]').click();
  await expect(page.locator("[data-theme-option]")).toHaveCount(0);
  await page.locator("#settingsClose").click();

  await page.locator("#settingsTrigger").click();
  await expect(page.locator("#controlTabMenu")).toHaveAttribute("aria-selected","true");
  await page.locator('#wqPanel a[href="#album"]').click();
  await expect(page).toHaveURL(/#album$/);
  await page.reload({ waitUntil:"domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("music orb animates when playing, pauses without hiding, stops until re-enabled @smoke @core", async ({
  page,
}) => {
  await mockWeddingAudio(page);

  await page.goto(base + "/index.html?party=bride", { waitUntil: "domcontentloaded" });
  await page.locator("#waxOpenButton").click();
  await expect(page.locator("#moonlightGate")).toBeHidden({ timeout:16000 });

  const bubble = page.locator("#musicBubble");
  // The seal activated the player; the orb appears when the gate is gone.
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
  expect(await page.locator("#weddingMusic").evaluate(audio => audio.currentTime)).toBe(0);

  // The stopped bubble cannot start music itself; guests must use Settings.
  await page.locator("#settingsTrigger").click();
  await page.locator("#controlTabSettings").click();
  await page.locator("#musicToggle").evaluate(node => node.click());
  await expect(bubble).toBeVisible();
  await expect(bubble).toHaveAttribute("data-music-state", "playing");
  expect(await page.evaluate(() => window.__plays)).toBe(3);
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
  await expect(page.locator("#waxOpenButton")).toBeVisible();
  await page.locator("#waxOpenButton").click();
  await expect(page.locator("#moonlightGate")).toBeHidden({ timeout:16000 });
  await expect(page.locator("#heroCeremonyLabel")).toContainText("TIỆC CƯỚI");
  await expect(page.locator(".hero-date [data-party-date='single']")).toHaveText("21.05.2027");
  await expect(page.locator(".event-card:visible")).toHaveCount(1);
  await expect(page.locator('[data-party-scope="single"] .event-detail')).toContainText("17:30");
  await expect(page.locator(".family-card:visible")).toHaveCount(2);
  await page.locator('[data-calendar="single"]').click();
  await expect(page.locator("#calendarDialog")).toBeVisible();
  await expect(page.locator("#calendarEventField")).toBeHidden();
  await expect(page.locator("#calendarAll")).toBeHidden();
  // Android recommends Google; its native file option is inside Other apps.
  if (await page.locator("#calendarOtherOptions #calendarNative").count()) {
    await page.locator("#calendarOther summary").click();
  }
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#calendarNative").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/tiec-cuoi-.*[.]ics$/);
  await page.locator("#calendarClose").click();
  await page.locator('a[href="#map-single"].map-button').click();
  await expect(page.locator("#map-single")).toBeVisible();
  await expect(page.locator("#map-single h3")).toHaveText("Trung Tâm Tiệc Cưới Sen Vàng");
  await expect(page.locator("#map-groom")).toBeHidden();
  await page.locator("#wmClose").click();
  await page.locator("#settingsTrigger").click();
  await expect(page.locator("#controlTabMenu")).toHaveAttribute("aria-selected","true");
  await expect(page.locator("#wqPanel")).toBeVisible();
  await expect(page.locator('a[href="#wedding-gift"].wq-link')).toBeVisible();
  await page.locator('a[href="#wedding-gift"].wq-link').click();
  await expect(page.locator(".gift-card:visible")).toHaveCount(1);
  expect(errors).toEqual([]);

  // The same single-mode config must generate a link without party=.
  await page.locator("#wgClose").click();
  await page.goto(base + "/index.html?tool=links&lang=en", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#linkToolScreen")).toBeVisible();
  await expect(page.locator("#linkToolPartyField")).toBeHidden();
  await expect(page.locator("#linkToolParty option")).toHaveCount(1);
  await expect(page.locator("#linkToolParty option")).toHaveAttribute("value", "single");
  await page.locator("#linkToolGuest").fill("Alex & Jamie");
  await page.locator('#linkToolForm button[type="submit"]').click();
  const invitation = await page.locator("#linkToolGenerated").textContent();
  expect(invitation).toContain("to=Alex+%26+Jamie");
  expect(invitation).toContain("lang=en");
  expect(invitation).not.toContain("party=");
  await page.locator("#linkToolBack").click();
  await expect(page.locator("#waxOpenButton")).toBeVisible();
});


test("reduced-motion album can switch, close and reopen without losing its image @smoke @core", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(base + "/index.html?party=bride", { waitUntil: "domcontentloaded" });
  await page.locator("#waxOpenButton").click();
  await expect(page.locator("#moonlightGate")).toHaveClass(/is-opened/);
  await expect(page.locator("#gateGuestLabel")).toBeVisible();
  await expect(page.locator(".moonlight-gate__door--left")).toBeHidden();
  await expect(page.locator("#moonlightGate")).toBeHidden();
  const viewport = page.locator("#albumViewport");
  // Use the guest-facing navigation: WebKit can ignore an automation scroll
  // issued in the same rendering turn that the gate releases overflow:hidden.
  await page.locator("#settingsTrigger").click();
  await page.locator('#wqPanel a[href="#album"]').click();
  // A late load/pageshow must not undo a guest's scroll after entering.
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await expect(page.locator(".album-card.is-main")).toHaveCount(1);
  await viewport.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#albumLightbox")).toBeVisible();
  const before = await page.locator("#albumLightboxCounter").textContent();
  await page.locator("#albumLightboxNext").click();
  await expect(page.locator("#albumLightboxCounter")).not.toHaveText(before);
  await page.locator("#albumLightboxClose").click();
  await expect(page.locator("#albumLightboxImage")).toHaveCount(1);
  await viewport.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#albumLightboxImage")).toBeVisible();
  await expect.poll(() => page.locator("#albumLightboxImage").evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  await page.locator("#albumLightboxNext").click();
  await expect(page.locator("#albumLightboxCounter")).not.toHaveText(before);
});


test("album recovers after a failed manifest and restores focus after pointer viewing @smoke @core", async ({ page }) => {
  await page.emulateMedia({ reducedMotion:"reduce" });
  let requests = 0;
  await page.route("**/images/manifest.json*", route => {
    requests++;
    return requests === 1
      ? route.fulfill({ status:503, contentType:"text/plain", body:"Temporarily unavailable" })
      : route.continue();
  });
  await page.goto(base + "/index.html?party=groom&lang=en", { waitUntil:"domcontentloaded" });
  await page.locator("#waxOpenButton").click();
  await expect(page.locator("#moonlightGate")).toBeHidden({ timeout:16000 });
  const viewport = page.locator("#albumViewport");
  await viewport.scrollIntoViewIfNeeded();
  // WebKit may defer IntersectionObserver after programmatic scrolling.
  // Keyboard entry is also a supported, deterministic lazy-load trigger.
  await viewport.focus();
  await expect.poll(() => requests).toBe(1);
  const retry = page.locator("#albumRetry");
  await expect(retry).toBeVisible();
  await expect(retry).toHaveText("Try loading photos again");
  // Delayed gate/visibility callbacks must leave the failed state intact.
  await viewport.focus();
  await expect(retry).toBeVisible();
  expect(requests).toBe(1);
  await retry.click();
  await expect(retry).toBeHidden();
  await expect(page.locator("#albumStatus")).toBeHidden();
  expect(requests).toBe(2);
  const main = page.locator(".album-card.is-main .album-photo");
  await expect(main).toBeVisible();
  await expect.poll(() => main.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  await main.click();
  await expect(page.locator("#albumLightboxClose")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#albumLightbox")).toBeHidden();
  await expect(viewport).toBeFocused();
});

test("calendar chooser offers matching provider drafts and files without claiming installed apps @smoke @core", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", { configurable:true, value:() => true });
    Object.defineProperty(navigator, "share", { configurable:true, value:async data => {
      window.__calendarShared = { name:data.files[0].name, body:await data.files[0].text() };
      throw new DOMException("Cancelled", "AbortError");
    }});
  });
  await page.goto(base + "/index.html?party=bride&lang=en", { waitUntil:"domcontentloaded" });
  await page.locator("#waxOpenButton").click();
  await expect(page.locator("#moonlightGate")).toBeHidden({ timeout:16000 });
  const trigger = page.locator('[data-calendar="bride"]');
  await trigger.click();
  const dialog = page.locator("#calendarDialog");
  await expect(dialog).toBeVisible();
  await expect(page.locator("#calendarTitle")).toHaveText("Add to calendar");
  const actions = await trigger.evaluate(button => {
    const map = button.closest(".event-actions").querySelector(".map-button").getBoundingClientRect();
    const calendar = button.getBoundingClientRect();
    return { widthDelta:Math.abs(map.width-calendar.width), heightDelta:Math.abs(map.height-calendar.height), topDelta:Math.abs(map.top-calendar.top), gap:calendar.left-map.right };
  });
  expect(actions.widthDelta).toBeLessThanOrEqual(1);
  expect(actions.heightDelta).toBeLessThanOrEqual(1);
  expect(actions.topDelta).toBeLessThanOrEqual(1);
  expect(actions.gap).toBeGreaterThanOrEqual(8);
  await expect(page.locator("#calendarSuggested .calendar-option")).toHaveCount(1);
  await expect(page.locator("#calendarSuggested .calendar-option")).toHaveClass(/is-recommended/);
  await expect(page.locator("#calendarOtherOptions .calendar-option")).toHaveCount(2);
  await expect(page.locator("#calendarOther")).toHaveJSProperty("open", false);
  await expect(page.locator("#calendarOtherOptions")).toBeHidden();
  await expect(page.locator("#calendarEvent option")).toHaveCount(2);
  await expect(page.locator("#calendarEvent")).toHaveValue("1");
  const reception = new URL(await page.locator("#calendarGoogle").getAttribute("href"));
  expect(reception.searchParams.get("text")).toContain("Reception");
  expect(reception.searchParams.get("dates")).toMatch(/T\d{6}Z\/\d{8}T\d{6}Z/);
  await page.locator("#calendarEvent").selectOption("0");
  const ceremony = new URL(await page.locator("#calendarGoogle").getAttribute("href"));
  expect(ceremony.searchParams.get("text")).toContain("Ceremony");
  expect(ceremony.searchParams.get("dates")).not.toBe(reception.searchParams.get("dates"));
  const outlook = new URL(await page.locator("#calendarOutlook").getAttribute("href"));
  expect(outlook.searchParams.get("subject")).toBe(ceremony.searchParams.get("text"));
  expect(outlook.searchParams.get("location")).toBe(ceremony.searchParams.get("location"));
  await page.locator("#calendarOther summary").click();
  await expect(page.locator("#calendarOtherOptions")).toBeVisible();
  await page.locator("#calendarShare").click();
  await expect.poll(() => page.evaluate(() => window.__calendarShared?.name || "")).toMatch(/ceremony[.]ics$/);
  await expect(page.locator("#calendarStatus")).toHaveText("");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#calendarAll").click();
  const download = await downloadPromise;
  const body = require("node:fs").readFileSync(await download.path(), "utf8").replace(/\r\n /g, "");
  expect((body.match(/BEGIN:VEVENT/g) || []).length).toBe(2);
  expect(body).toContain("DTSTART:" + ceremony.searchParams.get("dates").split("/")[0]);
  expect(body).toContain("DTSTART:" + reception.searchParams.get("dates").split("/")[0]);
  await page.locator("#calendarClose").click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(page.locator("#calendarOther")).toHaveJSProperty("open", false);
  await page.locator("#calendarClose").press("Escape");
  await expect(dialog).toBeHidden();
});


test("gate ornaments and idle butterflies pause in background and stop after entry @smoke @core", async ({page}) => {
  await page.goto(base + "/index.html?party=groom&to=Guest", {waitUntil:"domcontentloaded"});
  const gate = page.locator("#moonlightGate");
  const ornaments = await page.evaluate(() => ({
    sun:getComputedStyle(document.querySelector(".moonlight-gate__orbit--sun"),"::after").animationName,
    lock:getComputedStyle(document.querySelector("#waxOpenButton"),"::after").animationName,
    rays:getComputedStyle(document.querySelector(".fairy-star")).animationName,
    delays:[...document.querySelectorAll(".fairy-star")].map(node => getComputedStyle(node).animationDelay),
    captions:document.querySelectorAll(".moonlight-gate__top-caption,.moonlight-gate__bottom-caption").length,
    butterflies:[...document.querySelectorAll(".fairy-butterfly")].map(node => getComputedStyle(node).animationName)
  }));
  expect(ornaments.sun).toBe("gateSunBreath");
  expect(ornaments.lock).toBe("fairyLockHighlight");
  expect(ornaments.rays).toBe("gateMoonTwinkle");
  expect(ornaments.delays).toHaveLength(4);
  expect(new Set(ornaments.delays).size).toBe(4);
  expect(ornaments.captions).toBe(0);
  expect(ornaments.butterflies).toEqual(Array(3).fill("fairyButterflyFlight"));
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {configurable:true, get:() => true});
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator(".fairy-star").first()).toHaveCSS("animation-play-state", "paused");
  await expect(page.locator(".fairy-butterfly").first()).toHaveCSS("animation-play-state", "paused");
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator(".fairy-star").first()).toHaveCSS("animation-play-state", "running");
  await page.locator("#waxOpenButton").click();
  await expect(gate).toHaveClass(/is-opening/);
  await expect(page.locator(".fairy-star").first()).toHaveCSS("animation-name", "none");
  await expect(page.locator(".fairy-butterfly").first()).toHaveCSS("animation-name", "none");
  await expect(gate).toBeHidden({timeout:16000});
  const stopped = await page.evaluate(() => ({
    sun:getComputedStyle(document.querySelector(".moonlight-gate__orbit--sun"),"::after").animationName,
    stars:[...document.querySelectorAll(".fairy-star")].map(node => getComputedStyle(node).animationName)
  }));
  expect(stopped.sun).toBe("none");
  expect(stopped.stars.every(name => name === "none")).toBe(true);
});


test("native MP3 starts in gate gesture, retries rejection, cancels late playback @smoke @core", async ({page}) => {
  await mockWeddingAudio(page, 400);
  const youtubeRequests=[];
  page.on("request", request=>{if (/youtube|ytimg|googlevideo/.test(request.url())) youtubeRequests.push(request.url());});
  for (const party of ["bride","groom"]) {
    await page.goto(base+"/index.html?party="+party,{waitUntil:"domcontentloaded"});
    expect(await page.locator("#weddingMusic").evaluate(audio=>decodeURI(new URL(audio.src).pathname))).toBe(
      party === "bride" ? "/audio/bride.mp3" : "/audio/groom.mp3"
    );
    await page.evaluate(()=>{window.__rejectNextPlay=true;});
    await page.locator("#waxOpenButton").click();
    expect(await page.evaluate(()=>window.__plays)).toBe(1);
    expect(await page.evaluate(()=>window.__playInActivation)).toBe(true);
    await expect(page.locator("#musicBubble")).toHaveAttribute("data-music-state","paused");
    // Retry through Settings, then cancel while play() is still pending.
    await page.locator("#musicToggle").evaluate(button=>button.click());
    await expect(page.locator("#musicBubble")).toHaveAttribute("data-music-state","starting");
    await page.locator("#musicToggle").evaluate(button=>button.click());
    await page.waitForTimeout(600);
    await expect(page.locator("#musicToggle")).toHaveAttribute("aria-pressed","false");
    expect(await page.locator("#weddingMusic").evaluate(audio=>audio.paused)).toBe(true);
    await page.locator("#musicToggle").evaluate(button=>button.click());
    await expect(page.locator("#musicBubble")).toHaveAttribute("data-music-state","playing");
    await expect(page.locator("iframe[src*=youtube]")).toHaveCount(0);
  }
  expect(youtubeRequests).toEqual([]);
});

test("real MP3 plays across the gate transition without a video player @smoke @core", async ({page}) => {
  test.setTimeout(60000);
  const videoRequests=[];
  page.on("request", request=>{if (/youtube|ytimg|googlevideo/.test(request.url())) videoRequests.push(request.url());});
  for (const party of ["bride","groom"]) {
    await page.goto(base+"/index.html?party="+party,{waitUntil:"domcontentloaded"});
    await page.locator("#waxOpenButton").click();
    await expect.poll(()=>page.locator("#weddingMusic").evaluate(audio=>audio.currentTime),{timeout:15000}).toBeGreaterThan(0.2);
    await expect(page.locator("#moonlightGate")).toBeHidden({timeout:16000});
    await expect(page.locator("#musicBubble")).toHaveAttribute("data-music-state","playing");
    expect(await page.locator("#weddingMusic").evaluate(audio=>({paused:audio.paused,error:audio.error?.code||0,loop:audio.loop}))).toEqual({paused:false,error:0,loop:true});
    await expect(page.locator("video, iframe[src*=youtube]")).toHaveCount(0);
  }
  expect(videoRequests).toEqual([]);
});


test("MP3 retry reloads failed media but normal resume preserves playback @smoke @core", async ({page}) => {
  await mockWeddingAudio(page);
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto(base+"/index.html?party=groom",{waitUntil:"domcontentloaded"});
  await page.locator("#waxOpenButton").click();
  await expect(page.locator("#moonlightGate")).toBeHidden();
  await expect(page.locator("#musicBubble")).toHaveAttribute("data-music-state","playing");
  await page.evaluate(()=>{window.__advanceMusic(42);window.__failAudio();});
  await expect(page.locator("#musicBubble")).toHaveAttribute("data-music-state","paused");
  await page.locator("#musicBubbleTrigger").click();
  await page.locator("#musicBubblePause").click();
  await expect(page.locator("#musicBubble")).toHaveAttribute("data-music-state","playing");
  expect(await page.evaluate(()=>window.__audioReloadCalls)).toBe(1);
  await page.evaluate(()=>window.__advanceMusic(37));
  await page.locator("#musicBubbleTrigger").click();
  await page.locator("#musicBubblePause").click();
  await page.locator("#musicBubbleTrigger").click();
  await page.locator("#musicBubblePause").click();
  await expect(page.locator("#musicBubble")).toHaveAttribute("data-music-state","playing");
  expect(await page.locator("#weddingMusic").evaluate(audio=>audio.currentTime)).toBe(37);
  expect(await page.evaluate(()=>window.__audioReloadCalls)).toBe(1);
});

test("album loads after the gate without IntersectionObserver @smoke @core", async ({page}) => {
  await page.addInitScript(()=>{delete window.IntersectionObserver;});
  await page.emulateMedia({reducedMotion:"reduce"});
  let manifestRequests=0;
  page.on("request",request=>{if(request.url().includes("images/manifest.json")) manifestRequests++;});
  await page.goto(base+"/index.html?party=bride",{waitUntil:"domcontentloaded"});
  expect(await page.evaluate(()=>"IntersectionObserver" in window)).toBe(false);
  expect(manifestRequests).toBe(0);
  await page.locator("#waxOpenButton").click();
  await expect(page.locator("#moonlightGate")).toBeHidden();
  await page.locator("#settingsTrigger").click();
  await page.locator('#wqPanel a[href="#album"]').click();
  await expect(page.locator(".album-card.is-main")).toHaveCount(1);
  await expect.poll(()=>page.locator(".album-card.is-main img").evaluate(image=>image.naturalWidth)).toBeGreaterThan(0);
  expect(manifestRequests).toBe(1);
  await page.locator("#albumViewport").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#albumLightbox")).toBeVisible();
  await page.locator("#albumLightboxNext").click();
  await expect(page.locator("#albumLightboxCounter")).toHaveText(/^02 \/ /);
});

test("closing names stay whole and modal close buttons stay at the right edge @smoke @core", async ({page}) => {
  test.setTimeout(60000);
  await page.emulateMedia({reducedMotion:"reduce"});
  for (const width of [320,393,430]) {
    await page.setViewportSize({width,height:850});
    await page.goto(base+"/index.html?party=groom",{waitUntil:"domcontentloaded"});
    await page.locator("#waxOpenButton").click();
    await expect(page.locator("#moonlightGate")).toBeHidden();
    await page.locator("#closingNames").scrollIntoViewIfNeeded();
    await page.evaluate(()=>document.fonts.ready);
    const names=await page.locator("#closingNames").evaluate(node=>({
      overflow:node.scrollWidth-node.clientWidth,
      names:[...node.querySelectorAll('.closing-name')].map(name=>({text:name.textContent,wrap:getComputedStyle(name).whiteSpace})),
    }));
    expect(names.overflow).toBeLessThanOrEqual(1);
    expect(names.names).toEqual([{text:"Thành Sơn",wrap:"nowrap"},{text:"Tố Nga",wrap:"nowrap"}]);
    await page.locator("#settingsTrigger").click();
    await page.locator('#wqPanel a[href="#locations"]').click();
    const mapGap=await page.locator("#wmClose").evaluate(button=>{
      const a=button.getBoundingClientRect(),b=button.closest('.wm-dialog').getBoundingClientRect();
      return {gap:b.right-a.right,width:a.width,height:a.height};
    });
    expect(mapGap.gap).toBeLessThanOrEqual(16);
    expect(mapGap.gap).toBeGreaterThanOrEqual(8);
    expect(mapGap.width).toBeGreaterThanOrEqual(44);
    expect(mapGap.height).toBeGreaterThanOrEqual(44);
    await page.locator("#wmClose").click();
    await page.locator("#settingsTrigger").click();
    await page.locator('#wqPanel a[href="#wedding-gift"]').click();
    const giftGap=await page.locator("#wgClose").evaluate(button=>{
      const a=button.getBoundingClientRect(),b=button.closest('.wg-dialog').getBoundingClientRect();
      return b.right-a.right;
    });
    expect(giftGap).toBeLessThanOrEqual(16);
    expect(giftGap).toBeGreaterThanOrEqual(8);
    await page.locator("#wgClose").click();
  }
});

test("couple names stay whole across gate, hero, menu, profiles and footer @smoke @core", async ({page}) => {
  test.setTimeout(90000);
  await page.emulateMedia({reducedMotion:"reduce"});
  for (const party of ["bride","groom"]) {
    for (const width of [320,393,430]) {
      await page.setViewportSize({width,height:850});
      await page.goto(base+"/index.html?party="+party,{waitUntil:"domcontentloaded"});
      await page.evaluate(()=>document.fonts.ready);
      const pairs=await page.locator('[data-party-name-pair]:not(#closingNames)').evaluateAll(nodes=>nodes.map(node=>({
        key:node.dataset.partyNamePair,
        names:[...node.childNodes].filter(child=>child.nodeType===Node.TEXT_NODE)
          .map(child=>child.textContent.trim()).filter(Boolean),
      })));
      for (const pair of pairs) {
        const text=pair.names.join(" ").toLocaleUpperCase("vi-VN");
        expect(text).toContain("THÀNH\u00a0SƠN");
        expect(text).toContain("TỐ\u00a0NGA");
      }
      await page.locator("#waxOpenButton").click();
      await expect(page.locator("#moonlightGate")).toHaveClass(/is-opened/);
      const gateOverflow=await page.locator('[data-party-name-pair="gate"]').evaluate(node=>node.scrollWidth-node.clientWidth);
      expect(gateOverflow).toBeLessThanOrEqual(1);
      await expect(page.locator("#moonlightGate")).toBeHidden();
      await page.locator("#heroNames").scrollIntoViewIfNeeded();
      expect(await page.locator("#heroNames").evaluate(node=>node.scrollWidth-node.clientWidth)).toBeLessThanOrEqual(1);
      for (const selector of ['.person-copy h3','.family-card h4']) {
        for (const heading of await page.locator(selector).all()) {
          await heading.scrollIntoViewIfNeeded();
          expect(await heading.textContent()).toMatch(/(?:THÀNH\u00a0SƠN|TỐ\u00a0NGA|Thành\u00a0Sơn|Tố\u00a0Nga)$/);
          expect(await heading.evaluate(node=>node.scrollWidth-node.clientWidth)).toBeLessThanOrEqual(1);
        }
      }
    }
  }
});

test("responsive typography fits short sentences after resize and language changes @smoke @core", async ({page}) => {
  test.setTimeout(120000);
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto(base+"/index.html?party=groom",{waitUntil:"domcontentloaded"});
  await page.locator("#waxOpenButton").click();
  await expect(page.locator("#moonlightGate")).toBeHidden();
  const fonts=[];
  for (const locale of ['vi','en']) {
    if(locale==='en') {
      await page.locator('#settingsTrigger').click();
      await page.locator('#controlTabSettings').click();
      await page.locator('[data-lang="en"]').click();
      await page.locator('#settingsClose').click();
    }
    for(const width of [320,360,393,430,768,1024]) {
      await page.setViewportSize({width,height:850});
      for(const selector of ['[data-i18n="family.title"]','#coupleHeading','.promise-copy h3','.album-header h2','[data-i18n="events.title"]']) {
        for(const heading of await page.locator(selector).all()) {
          await heading.scrollIntoViewIfNeeded();
          await expect.poll(()=>heading.evaluate(node=>node.scrollWidth-node.clientWidth),{message:`${locale} ${width}px ${selector}`}).toBeLessThanOrEqual(1);
          await expect(heading).toHaveAttribute('data-type-mode','line');
          const lines=await heading.evaluate(node=>{
            const range=document.createRange();range.selectNodeContents(node);
            return new Set([...range.getClientRects()].filter(r=>r.width).map(r=>Math.round(r.top))).size;
          });
          // Mixed fonts can have different ascenders; the block still must fit one line.
          const size=await heading.evaluate(node=>({height:node.clientHeight,line:parseFloat(getComputedStyle(node).lineHeight)||parseFloat(getComputedStyle(node).fontSize)*1.5}));
          expect(size.height).toBeLessThanOrEqual(size.line+2);
          expect(lines).toBeGreaterThan(0);
        }
      }
      if(locale==='vi') fonts.push(await page.locator('[data-i18n="family.title"]').evaluate(node=>parseFloat(getComputedStyle(node).fontSize)));
    }
  }
  expect(Math.max(...fonts)).toBeGreaterThan(Math.min(...fonts)+2);
  expect(await page.locator('[data-i18n="family.lead"]').textContent()).toMatch(/\S\u00a0\S+$/);
});

test("adaptive layout survives rotation and interrupted album dragging @smoke @core", async ({page}) => {
  test.setTimeout(60000);
  await mockWeddingAudio(page);
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto(base+"/index.html?party=groom",{waitUntil:"domcontentloaded"});
  await page.locator('#waxOpenButton').click();
  await expect(page.locator('#moonlightGate')).toBeHidden();
  await page.locator('#settingsTrigger').click();
  await page.locator('#wqPanel a[href="#album"]').click();
  const album=page.locator('#albumViewport');
  await album.focus();
  await expect(page.locator('.album-card.is-main')).toHaveCount(1);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#albumCount')).toHaveText(/^02 \/ /);
  await expect(album).toBeInViewport();
  const point=await album.evaluate(node=>{
    const r=node.getBoundingClientRect();
    return {x:r.left+r.width/2,y:(Math.max(0,r.top)+Math.min(innerHeight,r.bottom))/2};
  });
  await page.mouse.move(point.x,point.y);
  await page.mouse.down();
  await expect(album).toHaveClass(/is-dragging/);
  await page.mouse.move(point.x+15,point.y);
  await page.setViewportSize({width:337,height:760});
  await page.mouse.up();
  await expect(album).not.toHaveClass(/is-dragging/);
  await expect(page.locator('#albumLightbox')).toBeHidden();
  for(const size of [{width:812,height:375},{width:621,height:700},{width:1024,height:768},{width:393,height:850}]) {
    await page.setViewportSize(size);
    await album.scrollIntoViewIfNeeded();
    await expect(page.locator('#albumCount')).toHaveText(/^02 \/ /);
    await expect.poll(()=>page.locator('.album-slide').filter({has:page.locator('.album-card.is-main')}).evaluate(node=>{
      const a=node.getBoundingClientRect(),b=document.getElementById('albumViewport').getBoundingClientRect();
      return Math.abs((a.left+a.right-b.left-b.right)/2);
    })).toBeLessThanOrEqual(4);
    await page.locator('#settingsTrigger').click();
    await expect.poll(()=>page.locator('#settingsPanel').evaluate(node=>{
      const r=node.getBoundingClientRect(),v=visualViewport;
      return Math.max(0,(v?.offsetLeft||0)-r.left,r.right-(v?(v.offsetLeft+v.width):innerWidth),(v?.offsetTop||0)-r.top,r.bottom-(v?(v.offsetTop+v.height):innerHeight));
    })).toBeLessThanOrEqual(2);
    await page.locator('#settingsClose').click();
  }
  expect(await page.evaluate(()=>window.__plays)).toBe(1);
  await expect(page.locator('#musicBubble')).toHaveAttribute('data-music-state','playing');
});


test("story last row centres and hero shade follows the photo after rotation @smoke @core", async ({page}) => {
  test.setTimeout(60000);
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto(base+"/index.html?party=bride",{waitUntil:"domcontentloaded"});
  await page.locator('#waxOpenButton').click();
  await expect(page.locator('#moonlightGate')).toBeHidden();
  let twoColumnChecks=0;
  for(const size of [{width:393,height:850},{width:621,height:700},{width:844,height:390},{width:1024,height:768},{width:1366,height:768}]) {
    await page.setViewportSize(size);
    await page.locator('.hero-media').scrollIntoViewIfNeeded();
    await expect.poll(()=>page.locator('.hero-media').evaluate(node=>{
      const photo=node.querySelector('.hero-photo'),shade=node.querySelector('.hero-shade');
      return Math.max(Math.abs(photo.offsetHeight-shade.offsetHeight),Math.abs(photo.offsetHeight-node.clientHeight));
    })).toBeLessThanOrEqual(1);
    await page.locator('.promise-grid').scrollIntoViewIfNeeded();
    const geometry=await page.locator('.promise-grid').evaluate(node=>{
      const g=node.getBoundingClientRect(),cards=[...node.children].map(n=>n.getBoundingClientRect());
      const [a,b,c]=cards;
      return {twoColumns:Math.abs(a.left-b.left)>10&&c.top>Math.max(a.top,b.top)+Math.min(a.height,b.height)/2,
        center:Math.abs((c.left+c.right-g.left-g.right)/2),widthDiff:Math.abs(a.width-c.width)};
    });
    if(geometry.twoColumns){
      twoColumnChecks++;
      expect(geometry.center).toBeLessThanOrEqual(2);
      expect(geometry.widthDiff).toBeLessThanOrEqual(2);
    }
  }
  expect(twoColumnChecks).toBeGreaterThan(0);
});
