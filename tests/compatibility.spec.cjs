const { test, expect } = require("@playwright/test");
const base = "http://127.0.0.1:8000";

test("one shared language control, in-page generator, back navigation", async ({
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

  // The original floating control can collapse on idle. A first tap
  // wakes it; the next tap selects the language on touch devices.
  await languageControl.locator('[data-lang="vi"]').click();
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

test("short screens can scroll and avoid horizontal page overflow", async ({
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

test("menu, map and gift overlays open and close on each device", async ({
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
  await expect(control.locator(".language-option.is-active")).toBeVisible();
});


test("editing only wedding-info.js updates names, initials, dates, venue and gifts", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  // Simulate a new couple by replacing ONLY the response body of the data file.
  await page.route("**/wedding-info.js*", async route => {
    const response = await route.fetch();
    let body = await response.text();
    const changes = [
      ['"short": "Tố Nga"', '"short": "Mai An"'],
      ['"full": "Lữ Thị Tố Nga"', '"full": "Nguyễn Thị Mai An"'],
      ['"initial": "N"', '"initial": "M"'],
      ['"short": "Thành Sơn"', '"short": "Tuấn Minh"'],
      ['"full": "Đỗ Ngọc Thành Sơn"', '"full": "Trần Tuấn Minh"'],
      ['"initial": "S"', '"initial": "T"'],
      ['"date": "2026-11-14"', '"date": "2027-03-15"'],
      ['"Nhà Hàng Hương Lan"', '"Hoa Sen Venue"'],
    ];
    for (const [oldValue, newValue] of changes) {
      expect(body).toContain(oldValue);
      body = body.replace(oldValue, newValue);
    }
    await route.fulfill({ response, body });
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

  await page.goto(base + "/index.html?tool=links&lang=en", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator(".link-tool-eyebrow")).toContainText(
    "Mai An & Tuấn Minh",
  );
  await expect(page.locator(".link-tool-eyebrow")).toContainText("2027");
  expect(errors).toEqual([]);
});
