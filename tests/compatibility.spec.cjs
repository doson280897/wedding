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
