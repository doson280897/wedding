const { test, expect } = require("@playwright/test");
const base = "http://127.0.0.1:8000";

test("locked gate does not request MP3 before interaction @mobile", async ({ page }) => {
  const audioRequests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith(".mp3")) audioRequests.push(request.url());
  });
  await page.goto(base + "/?party=groom", { waitUntil: "networkidle" });
  await expect(page.locator("#waxOpenButton")).toBeVisible();
  expect(audioRequests).toEqual([]);
  const started = page.waitForRequest((request) =>
    new URL(request.url()).pathname.endsWith(".mp3"),
  );
  await page.locator("#waxOpenButton").click();
  await started;
});

test("map can reopen without navigating to undefined and returns focus to menu @mobile", async ({
  page,
}) => {
  const badRequests = [];
  page.on("request", (request) => {
    if (request.url().includes("undefined")) badRequests.push(request.url());
  });
  await page.route("https://maps.google.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "Map" }),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(base + "/?party=bride");
  await page.locator("#waxOpenButton").click();
  await expect(page.locator("#moonlightGate")).toBeHidden();
  let source;
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.locator("#settingsTrigger").click();
    await page.locator('#wqPanel a[href="#locations"]').click();
    await expect(page.locator("#wmModal")).toBeVisible();
    const current = await page.locator("#map-bride iframe").getAttribute("src");
    if (source) expect(current).toBe(source);
    source = current;
    await page.locator("#wmClose").click();
    await expect(page.locator("#settingsTrigger")).toBeFocused();
  }
  expect(badRequests).toEqual([]);
});

test("large album wraps both ways and bounds retained full-quality image sources", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/images/manifest.json*", async (route) => {
    const response = await route.fetch();
    const manifest = await response.json();
    const first = manifest.photos[0];
    manifest.shuffle = false;
    manifest.photos = Array.from({ length: 150 }, (_, index) => ({ ...first, v: String(index) }));
    manifest.total = 150;
    await route.fulfill({ json: manifest });
  });
  await page.goto(base + "/?party=bride");
  await page.locator("#waxOpenButton").click();
  await expect(page.locator("#moonlightGate")).toBeHidden();
  const viewport = page.locator("#albumViewport");
  await viewport.scrollIntoViewIfNeeded();
  await viewport.focus();
  await expect(page.locator(".album-card.is-main")).toHaveCount(1);
  await viewport.press("ArrowLeft");
  await expect(page.locator("#albumCount")).toHaveText("150 / 150");
  await viewport.press("ArrowRight");
  await expect(page.locator("#albumCount")).toHaveText("01 / 150");
  for (let index = 0; index < 50; index++) await viewport.press("ArrowRight");
  await expect(page.locator("#albumCount")).toHaveText("51 / 150");
  expect(await page.locator(".album-photo[src]").count()).toBeLessThanOrEqual(32);
  await expect(page.locator(".album-card.is-main")).toHaveCount(1);
  await viewport.press("Enter");
  await expect
    .poll(() => page.locator("#albumLightboxImage").evaluate((image) => image.naturalWidth))
    .toBeGreaterThan(0);
});
