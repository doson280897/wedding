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

test("one shared language control, in-page generator, back navigation @mobile", async ({
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

test("menu, map and gift overlays open and close on each device @mobile", async ({
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
    hero: document.documentElement.style.getPropertyValue("--hero-image"),
    music: document.getElementById("weddingMusic").src,
    configuredMusic: new URL(window.WEDDING_INFO.parties.bride.music.src, document.baseURI).href,
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

test("music orb animates when playing, pauses without hiding, stops until re-enabled", async ({
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

test("single reception shows one event, date, venue, map and gift", async ({ page }) => {
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

test("reduced-motion album can switch, close and reopen without losing its image", async ({ page }) => {
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

test("calendar chooser offers matching provider drafts and files without claiming installed apps", async ({ page }) => {
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

test("native MP3 starts in gate gesture, retries rejection, cancels late playback @mobile", async ({page}) => {
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

test("real MP3 plays across the gate transition without a video player", async ({page}) => {
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

test("responsive typography fits short sentences after resize and language changes @mobile", async ({page}) => {
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

test("adaptive layout survives rotation and interrupted album dragging", async ({page}) => {
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

test("story last row centres and hero shade follows the photo after rotation", async ({page}) => {
  test.setTimeout(60000);
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto(base+"/index.html?party=bride",{waitUntil:"domcontentloaded"});
  await page.locator('#waxOpenButton').click();
  await expect(page.locator('#moonlightGate')).toBeHidden();
  let twoColumnChecks=0;
  for(const size of [{width:393,height:850},{width:621,height:700},{width:844,height:390},{width:932,height:430},{width:1180,height:480},{width:1024,height:768},{width:1366,height:768}]) {
    await page.setViewportSize(size);
    await page.locator('.hero-media').scrollIntoViewIfNeeded();
    await expect.poll(()=>page.locator('.hero-media').evaluate(node=>{
      const photo=node.querySelector('.hero-photo'),shade=node.querySelector('.hero-shade');
      return Math.max(Math.abs(photo.offsetHeight-shade.offsetHeight),Math.abs(photo.offsetHeight-node.clientHeight));
    })).toBeLessThanOrEqual(1);
    if (size.width <= 900 || size.height <= 576) {
      const photo=page.locator('img.hero-photo');
      await expect.poll(()=>photo.evaluate(node=>node.naturalWidth)).toBeGreaterThan(0);
      expect(await photo.evaluate(node=>getComputedStyle(node).objectFit)).toBe('contain');
      const fit=await photo.evaluate(node=>{
        const box=node.getBoundingClientRect();
        return {widthError:Math.abs(box.width-node.parentElement.clientWidth),
          heightError:Math.abs(box.height-box.width*node.naturalHeight/node.naturalWidth)};
      });
      expect(fit.widthError).toBeLessThanOrEqual(1);
      expect(fit.heightError).toBeLessThanOrEqual(1);
    }
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

test("fullscreen album follows swipes in both directions and recovers cancellation @mobile @gesture", async ({page, context, browserName}) => {
  await mockWeddingAudio(page);
  await page.goto(base + "/index.html?party=groom", {waitUntil:"domcontentloaded"});
  await page.locator('#waxOpenButton').click();
  await expect(page.locator('#moonlightGate')).toBeHidden({timeout:16000});
  const viewport = page.locator('#albumViewport');
  await viewport.scrollIntoViewIfNeeded();
  await viewport.focus();
  await expect(page.locator('.album-card.is-main')).toHaveCount(1);
  await page.keyboard.press('Enter');
  const stage = page.locator('#albumLightboxStage');
  const image = page.locator('#albumLightboxImage');
  const counter = page.locator('#albumLightboxCounter');
  await expect(image).toBeVisible();
  await expect.poll(()=>image.evaluate(node=>node.naturalWidth)).toBeGreaterThan(0);
  expect(await stage.evaluate(node=>getComputedStyle(node).touchAction)).toBe('none');
  const box = await stage.boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const distance = Math.min(100, box.width * .35);
  const before = await counter.textContent();
  // Real browser input exercises capture and native gesture arbitration.
  const touch = browserName === 'chromium' && test.info().project.use.hasTouch;
  const session = touch ? await context.newCDPSession(page) : null;
  async function swipe(direction) {
    if (session) {
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
      for (let i=1;i<=6;i++) await session.send('Input.dispatchTouchEvent',{
        type:'touchMove',touchPoints:[{x:x+direction*distance*i/6,y:y+i}]
      });
      await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    } else {
      await page.mouse.move(x,y);
      await page.mouse.down();
      await page.mouse.move(x+direction*distance,y+6,{steps:6});
      await page.mouse.up();
    }
  }
  await swipe(-1);
  await expect(counter).not.toHaveText(before);
  await swipe(1);
  await expect(counter).toHaveText(before);
  // Cancelled gestures must release state so the next swipe still works.
  if (session) {
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-30,y}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  } else {
    await stage.evaluate(node=>node.addEventListener('pointerdown',event=>{
      node.dataset.testPointerId=String(event.pointerId);
    },{once:true}));
    await page.mouse.move(x,y);
    await page.mouse.down();
    await page.mouse.move(x-30,y,{steps:3});
    await stage.evaluate(node=>node.dispatchEvent(new PointerEvent('pointercancel',{
      bubbles:true,pointerId:Number(node.dataset.testPointerId)
    })));
    await page.mouse.up();
  }
  await swipe(-1);
  await expect(counter).not.toHaveText(before);
  await page.locator('#albumLightboxPrev').click();
  await expect(counter).toHaveText(before);
  await page.locator('#albumLightboxClose').click();
  await expect(page.locator('#albumLightbox')).toBeHidden();
  // The same touch stream must not zoom the page after closing the viewer.
  if (session) {
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-20,y},{x:x+20,y}]});
    for (let i=1;i<=5;i++) await session.send('Input.dispatchTouchEvent',{
      type:'touchMove',touchPoints:[{x:x-20-i*8,y},{x:x+20+i*8,y}]
    });
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect.poll(()=>page.evaluate(()=>visualViewport.scale)).toBe(1);
  }
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content',/user-scalable=no/);
  expect(await page.locator('html').evaluate(node=>getComputedStyle(node).touchAction)).toBe('pan-x pan-y');
  await session?.detach();
});
