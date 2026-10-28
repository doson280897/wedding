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
  await expect(page.locator("#moonlightGate")).toBeHidden({timeout:9000});
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
  await page.addInitScript(() => {
    window.YT = {
      PlayerState:{PLAYING:1,PAUSED:2,ENDED:0,BUFFERING:3},
      Player:function(_host,options) {
        let playbackTime=0;
        const player={
          setVolume(){},
          getCurrentTime(){return playbackTime;},
          seekTo(time){playbackTime=time;window.__seeks=(window.__seeks||[]).concat(time);},
          playVideo(){
            window.__plays=(window.__plays||0)+1;
            options.events.onStateChange({data:3});
            setTimeout(()=>options.events.onStateChange({data:1}),400);
          },
          pauseVideo(){
            playbackTime=0; // Simulate an iframe that loses time while buffering.
            options.events.onStateChange({data:2});
          },
          stopVideo(){options.events.onStateChange({data:0});}
        };
        window.__advanceMusic = value => {playbackTime=value;};
        queueMicrotask(()=>options.events.onReady({target:player}));
        return player;
      }
    };
  });
  await page.goto(base+"/index.html?party=bride",{waitUntil:"domcontentloaded"});
  await page.locator("#waxOpenButton").click();
  await expect(page.locator("#moonlightGate")).toBeHidden({timeout:9000});
  await page.locator("#settingsTrigger").click();
  await page.locator("#controlTabSettings").click();
  await page.locator("#musicToggle").click();
  await expect(page.locator("#musicBubble")).toBeHidden();
  await expect(page.locator("#musicToggle .music-label")).toContainText(/ĐANG|TẢI|Loading/i);
  await expect(page.locator("#musicBubble")).toBeVisible({timeout:3500});
  await expect(page.locator("#musicBubble")).toHaveAttribute("data-music-state","playing");
  await page.evaluate(()=>window.__advanceMusic(83.5));
  await page.locator("#musicBubbleTrigger").click();
  await page.locator("#musicBubblePause").click();
  await expect(page.locator("#musicBubble")).toHaveAttribute("data-music-state","paused");
  await page.locator("#musicBubbleTrigger").click();
  await page.locator("#musicBubblePause").click();
  await expect(page.locator("#musicBubble")).toHaveAttribute("data-music-state","playing",{timeout:3500});
  const seek=await page.evaluate(()=>window.__seeks||[]);
  expect(seek.some(time=>Math.abs(time-83.5)<.01)).toBe(true);
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
  // The third-party player must not compete with the opening on first paint.
  expect(await page.evaluate(() => Boolean(window.__weddingYouTubeApiPromise))).toBe(false);
  // The seal is personalized from data, not hard-coded into the HTML.
  const initials = await page.evaluate(() =>
    window.WEDDING_INFO.couple.bride.initial + " · " + window.WEDDING_INFO.couple.groom.initial
  );
  await expect(page.locator("#waxMonogram")).toHaveText(initials);
  await page.locator("#waxOpenButton").click();
  await expect(page.locator("#moonlightGate")).toHaveClass(/is-awakening/);
  await expect(page.locator("#moonlightGate")).toHaveClass(/is-opening/);
  await expect(page.locator("#moonlightGate")).toBeHidden({ timeout:9000 });
  await expect(page.locator("html")).not.toHaveClass(/wax-pending/);
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
  await page.locator("#waxOpenButton").click();
  await expect(page.locator("#moonlightGate")).toBeHidden({ timeout:9000 });
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
  await page.locator("#waxOpenButton").click();
  await expect(page.locator("#moonlightGate")).toBeHidden({ timeout:9000 });

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


test("Moonlight Gate opens from personalized wax and reveals the invitation @core", async ({ page }) => {
  await page.goto(base + "/index.html?party=bride&to=ReloadGuest", { waitUntil:"domcontentloaded" });
  const gate = page.locator("#moonlightGate");
  await expect(gate).toBeVisible();
  await expect(page.locator("#waxOpenButton")).toBeVisible();
  await expect(page.locator("#waxMonogram")).toHaveText("N · S");
  await expect(page.locator(".moonlight-gate__reveal-overline")).toHaveText("NGÀY CHUNG ĐÔI");
  await expect(page.locator(".moonlight-gate__reveal-overline")).not.toContainText("KÍNH MỜI");
  await expect(page.locator(".moonlight-gate__celestial")).toBeVisible();
  await expect(page.locator(".moonlight-gate__hint")).toHaveCount(0);
  const celestialWidth = await page.locator(".moonlight-gate__celestial").evaluate(node =>
    node.getBoundingClientRect().width
  );
  expect(celestialWidth).toBeGreaterThanOrEqual(98);
  await expect(page.locator("#settingsHub")).toBeHidden();
  await expect(page.locator("#wqToggle")).toBeHidden();
  const gateLayout = await page.evaluate(() => {
    const scene = document.querySelector(".moonlight-gate__scene").getBoundingClientRect();
    const celestial = document.querySelector(".moonlight-gate__celestial");
    const leftDoor = document.querySelector(".moonlight-gate__door--left");
    return {
      viewportW:innerWidth,
      viewportH:innerHeight,
      sceneW:scene.width,
      sceneH:scene.height,
      celestialZ:Number(getComputedStyle(celestial).zIndex),
      doorZ:Number(getComputedStyle(leftDoor).zIndex)
    };
  });
  expect(Math.abs(gateLayout.sceneW - gateLayout.viewportW)).toBeLessThanOrEqual(1);
  expect(Math.abs(gateLayout.sceneH - gateLayout.viewportH)).toBeLessThanOrEqual(2);
  expect(gateLayout.celestialZ).toBeLessThan(gateLayout.doorZ);

  await page.locator("#waxOpenButton").click();
  await expect(gate).toHaveClass(/is-awakening/);
  await expect(gate).toHaveClass(/is-opening/);
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
      rightWidth:right.getBoundingClientRect().width
    };
  });
  expect(hingeState.leftOrigin).toBeCloseTo(0, 0);
  expect(hingeState.rightOrigin).toBeGreaterThan(100);
  const hingeDuration = await page.locator(".moonlight-gate__door--left").evaluate(node =>
    parseFloat(getComputedStyle(node).transitionDuration) * 1000
  );
  expect(hingeDuration).toBeGreaterThanOrEqual(1400);
  await expect(gate).toHaveClass(/is-opened/, { timeout:6000 });
  await expect(page.locator(".moonlight-gate__reveal-names")).toBeVisible();
  await expect(page.locator(".moonlight-gate__reveal-names")).toContainText("Nga");
  await expect(page.locator("#settingsHub")).toBeHidden();
  await expect(page.locator("#wqToggle")).toBeHidden();
  const finalHinge = await leftDoor.evaluate(node => getComputedStyle(node).transform);
  expect(finalHinge).toContain("matrix3d(");
  // A brief ~220ms beat replaces the old 1.5s hold; the sky/title zoom
  // out WHILE the actual hero zooms in and both layers crossfade.
  await expect(gate).toHaveClass(/is-handoff/, { timeout:2500 });
  await expect(page.locator("html")).toHaveClass(/gate-hero-revealing/);
  const zoomConfig = await page.evaluate(() => {
    const sky = document.querySelector(".moonlight-gate__backdrop");
    const title = document.querySelector(".moonlight-gate__reveal");
    const hero = document.querySelector(".hero");
    const cover = document.getElementById("moonlightGate");
    const rules = [...document.styleSheets].flatMap(sheet => {
      try { return [...sheet.cssRules]; } catch (_) { return []; }
    });
    const getRule = selector => rules.find(rule => rule.selectorText === selector)?.cssText || "";
    return {
      gateDuration:parseFloat(getComputedStyle(cover).transitionDuration),
      skyRule:getRule(".moonlight-gate.is-handoff .moonlight-gate__backdrop"),
      titleRule:getRule(".moonlight-gate.is-handoff .moonlight-gate__reveal"),
      heroRule:getRule("html.wax-pending .hero"),
      skyTransition:getComputedStyle(sky).transitionDuration,
      titleTransition:getComputedStyle(title).transitionDuration,
      heroTransition:getComputedStyle(hero).transitionDuration
    };
  });
  expect(zoomConfig.gateDuration).toBeGreaterThanOrEqual(1.3);
  expect(zoomConfig.skyRule).toContain("scale(1.14)");
  expect(zoomConfig.titleRule).toContain("scale(1.18)");
  expect(zoomConfig.heroRule).toContain("scale(1.08)");
  expect(zoomConfig.skyTransition).toContain("1.35s");
  expect(zoomConfig.titleTransition).toContain("1.35s");
  expect(zoomConfig.heroTransition).toContain("1.35s");
  await expect(page.locator(".hero")).toHaveCSS("opacity","1");
  await expect(gate).toBeHidden({ timeout:9000 });
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
  await expect(page.locator("#moonlightGate")).toBeHidden({ timeout:9000 });
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
  await page.addInitScript(() => {
    window.YT = {
      PlayerState:{PLAYING:1,PAUSED:2,ENDED:0,BUFFERING:3},
      Player:function(_host,options) {
        const player = {
          setVolume(){},
          playVideo() {
            window.__musicDragPlayCalls = (window.__musicDragPlayCalls || 0) + 1;
            options.events.onStateChange({data:1});
          },
          pauseVideo() {window.__musicDragPauses=(window.__musicDragPauses||0)+1;options.events.onStateChange({data:2});},
          stopVideo() {options.events.onStateChange({data:0});}
        };
        queueMicrotask(()=>options.events.onReady({target:player}));
        return player;
      }
    };
  });
  await page.goto(base+"/index.html?party=groom",{waitUntil:"domcontentloaded"});
  await page.locator("#waxOpenButton").click();
  await expect(page.locator("#moonlightGate")).toBeHidden({timeout:9000});
  await page.locator("#settingsTrigger").click();
  await page.locator("#controlTabSettings").click();
  await page.locator("#musicToggle").click();
  const orb = page.locator("#musicBubble");
  await expect(orb).toBeVisible();
  await expect(orb).toHaveAttribute("data-music-state","playing");
  await page.locator("#settingsClose").click();

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
  expect(await page.evaluate(()=>window.__musicDragPlayCalls)).toBe(1);
  expect(await page.evaluate(()=>window.__musicDragPauses||0)).toBe(0);
  await page.locator("#musicBubbleTrigger").click();
  await expect(page.locator("#musicBubbleActions")).toBeVisible();
});

test("personal invitation keeps the bold recipient in hero across languages", async ({
  page,
}) => {
  const guest = "Anh Minh và chị Lan";
  await page.goto(base + "/index.html?party=bride&to=" + encodeURIComponent(guest), {
    waitUntil:"domcontentloaded",
  });
  await page.locator("#waxOpenButton").click();
  await expect(page.locator("#moonlightGate")).toBeHidden({ timeout:9000 });
  await expect(page.locator("#heroGuestLabel")).toHaveText("Kính mời");
  await expect(page.locator("#guestName")).toHaveText(guest);
  await expect(page.locator("#guestName")).toBeVisible();
  await page.locator("#settingsTrigger").click();
  await page.locator("#controlTabSettings").click();
  await page.locator('[data-lang="en"]').click();
  await expect(page.locator("#heroGuestLabel")).toHaveText("Cordially inviting");
  await expect(page.locator("#guestName")).toHaveText(guest);

  // A generic link must not render an empty personalized-name line.
  await page.goto(base + "/index.html?party=groom", { waitUntil: "domcontentloaded" });
  await page.locator("#waxOpenButton").click();
  await expect(page.locator("#moonlightGate")).toBeHidden({ timeout:9000 });
  await expect(page.locator("#guestName")).toBeHidden();
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


test("fresh tabs follow the OS theme while explicit choices survive F5 @smoke @core", async ({
  page
}) => {
  await page.emulateMedia({ colorScheme:"dark" });
  const url = base + "/index.html";
  await page.goto(url, { waitUntil:"domcontentloaded" });
  await page.locator("#settingsTrigger").click();
  await page.locator('[data-lang="en"]').click();
  await page.locator('[data-theme-option="light"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme","light");
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
  const popupSystemTheme = await other.evaluate(() =>
    matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"
  );
  await expect(other.locator("html")).toHaveAttribute("data-theme", popupSystemTheme);
  await expect(other.locator("html")).toHaveAttribute("lang","vi");
  await expect(other.locator("#waxOpenButton")).toBeVisible();
  await other.close();

  await page.reload({ waitUntil:"domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-theme","light");
  await expect(page.locator("html")).toHaveAttribute("lang","en");

  const lightPage = await page.context().newPage();
  await lightPage.emulateMedia({ colorScheme:"light" });
  await lightPage.goto(url + "?party=bride", { waitUntil:"domcontentloaded" });
  await expect(lightPage.locator("html")).toHaveAttribute("data-theme","light");
  await expect(lightPage.locator("#moonlightGate")).toBeVisible();
  await expect(lightPage.locator(".moonlight-gate__celestial")).toBeVisible();
  await expect(lightPage.locator("#settingsHub")).toBeHidden();
  await expect(lightPage.locator('meta[name="theme-color"]')).toHaveAttribute("content","#e4ddd0");
  await lightPage.locator("#waxOpenButton").click();
  await expect(lightPage.locator("#moonlightGate")).toBeHidden({ timeout:9000 });
  await expect(lightPage.locator("#settingsHub")).toBeVisible();
  await expect(lightPage.locator('meta[name="theme-color"]')).toHaveAttribute("content","#f5f0e6");
  await lightPage.close();
});



test("menu section navigation preserves per-tab theme and language on F5 @smoke", async ({ page }) => {
  await page.goto(base + "/index.html?party=bride", { waitUntil:"domcontentloaded" });
  await page.locator("#waxOpenButton").click();
  await expect(page.locator("#moonlightGate")).toBeHidden({ timeout:9000 });
  await page.locator("#settingsTrigger").click();
  await page.locator("#controlTabSettings").click();
  await page.locator('[data-lang="en"]').click();
  await page.locator('[data-theme-option="light"]').click();
  await page.locator("#settingsClose").click();

  await page.locator("#settingsTrigger").click();
  await expect(page.locator("#controlTabMenu")).toHaveAttribute("aria-selected","true");
  await page.locator('#wqPanel a[href="#album"]').click();
  await expect(page).toHaveURL(/#album$/);
  await page.reload({ waitUntil:"domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
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
  await page.locator("#waxOpenButton").click();
  await expect(page.locator("#moonlightGate")).toBeHidden({ timeout:9000 });
  await page.waitForFunction(() => window.__musicMockReady === true);

  const bubble = page.locator("#musicBubble");
  await expect(bubble).toBeHidden();
  await page.locator("#settingsTrigger").click();
  await page.locator("#controlTabSettings").click();
  // State-machine test uses a programmatic click to avoid Firefox/YouTube actionability stalls.
  await page.locator("#musicToggle").evaluate(node => node.click());
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
  await page.locator("#controlTabSettings").click();
  await page.locator("#musicToggle").evaluate(node => node.click());
  await expect(bubble).toBeVisible();
  await expect(bubble).toHaveAttribute("data-music-state", "playing");
  expect(await page.evaluate(() => window.__musicTestPlayCalls)).toBe(3);
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
  await expect(page.locator("#moonlightGate")).toBeHidden({ timeout:9000 });
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
  await page.locator("#linkToolGuest").fill("Alex & Jamie");
  await page.locator('#linkToolForm button[type="submit"]').click();
  const invitation = await page.locator("#linkToolGenerated").textContent();
  expect(invitation).toContain("to=Alex+%26+Jamie");
  expect(invitation).toContain("lang=en");
  expect(invitation).not.toContain("party=");
  await page.locator("#linkToolBack").click();
  await expect(page.locator("#waxOpenButton")).toBeVisible();
});
