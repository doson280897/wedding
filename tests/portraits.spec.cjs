const { test, expect } = require("@playwright/test");
for (const unavailable of [false, true]) {
  test(`portraits ${unavailable ? "fall back without metadata" : "automatically frame faces after resize"} @mobile`, async ({
    page,
  }) => {
    if (unavailable)
      await page.route("**/portrait-focus.json*", (route) =>
        route.fulfill({ status: 404, body: "" }),
      );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("http://127.0.0.1:8000/?party=groom");
    // Force lazy sources to load while testing crop behavior independently of the gate animation.
    await page
      .locator(".portrait img")
      .evaluateAll((images) => images.forEach((img) => (img.loading = "eager")));
    const images = page.locator(".portrait img");
    await expect(images).toHaveCount(4);
    for (const width of [1076, 390]) {
      await page.setViewportSize({ width, height: 800 });
      for (const image of await images.all()) {
        await expect(image).toHaveAttribute("data-framing", unavailable ? "fallback" : "auto");
        await expect.poll(() => image.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
      }
      if (!unavailable) {
        await expect
          .poll(() =>
            page.evaluate(async () => {
              const data = await fetch("images/optimized/portrait-focus.json").then((r) =>
                r.json(),
              );
              return [...document.querySelectorAll(".portrait img")].every((img) => {
                const src = img.dataset.infoSrc
                  .split(".")
                  .reduce((v, k) => v[k], window.WEDDING_INFO);
                const style = getComputedStyle(img);
                const [px, py] = style.objectPosition.split(" ").map(parseFloat);
                const scale = Math.max(
                  img.clientWidth / img.naturalWidth,
                  img.clientHeight / img.naturalHeight,
                );
                if (style.objectFit === "contain") return true;
                return data.images[src].faces.every(([x, y, w, h]) => {
                  const ox = ((img.clientWidth - img.naturalWidth * scale) * px) / 100;
                  const oy = ((img.clientHeight - img.naturalHeight * scale) * py) / 100;
                  return (
                    x * img.naturalWidth * scale + ox >= -1 &&
                    (x + w) * img.naturalWidth * scale + ox <= img.clientWidth + 1 &&
                    y * img.naturalHeight * scale + oy >= -1 &&
                    (y + h) * img.naturalHeight * scale + oy <= img.clientHeight + 1
                  );
                });
              });
            }),
          )
          .toBe(true);
      }
    }
    await page.evaluate(() => document.dispatchEvent(new CustomEvent("wedding:languagechange")));
    await expect(images.first()).toHaveAttribute("data-framing", unavailable ? "fallback" : "auto");
  });
}
