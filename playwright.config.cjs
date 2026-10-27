const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30000,
  expect: { timeout: 10000 },
  use: { trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    {
      name: "Windows-sized desktop Chromium",
      use: { browserName: "chromium", viewport: { width: 1440, height: 900 } },
    },
    {
      name: "Android Pixel 5 Chromium",
      use: { ...devices["Pixel 5"], browserName: "chromium" },
    },
    {
      name: "iPhone 13 Safari WebKit",
      use: { ...devices["iPhone 13"], browserName: "webkit" },
    },
    {
      name: "iPad Mini Safari WebKit",
      use: { ...devices["iPad Mini"], browserName: "webkit" },
    },
    {
      name: "Short landscape phone WebKit",
      use: {
        browserName: "webkit",
        viewport: { width: 667, height: 375 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
  ],
});
