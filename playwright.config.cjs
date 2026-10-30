const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  webServer: {
    command: "npm run serve",
    url: "http://127.0.0.1:8000/index.html",
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
  },
  testDir: "./tests",
  testMatch: "**/*.spec.cjs",
  timeout: 30000,
  expect: { timeout: 10000 },
  use: { trace: "retain-on-failure", screenshot: "only-on-failure" },
  // Main journeys run once on desktop, with a small iPhone subset and a
  // native Android swipe regression. The full matrix is manual-only.
  projects:
    process.env.WEDDING_EXTENDED_TESTS === "true"
      ? [
          {
            name: "Desktop Chromium",
            use: { browserName: "chromium", viewport: { width: 1440, height: 900 } },
          },
          { name: "Android Pixel 5", use: { ...devices["Pixel 5"], browserName: "chromium" } },
          { name: "iPhone 13 WebKit", use: { ...devices["iPhone 13"], browserName: "webkit" } },
          { name: "iPad Mini WebKit", use: { ...devices["iPad Mini"], browserName: "webkit" } },
          {
            name: "Android tablet",
            use: {
              browserName: "chromium",
              viewport: { width: 800, height: 1280 },
              isMobile: true,
              hasTouch: true,
              deviceScaleFactor: 2,
            },
          },
          {
            name: "Compact Android 320px",
            use: {
              browserName: "chromium",
              viewport: { width: 320, height: 568 },
              isMobile: true,
              hasTouch: true,
              deviceScaleFactor: 2,
            },
          },
          {
            name: "Desktop Firefox",
            use: { browserName: "firefox", viewport: { width: 1366, height: 768 } },
          },
          {
            name: "Landscape WebKit",
            use: {
              browserName: "webkit",
              viewport: { width: 667, height: 375 },
              isMobile: true,
              hasTouch: true,
              deviceScaleFactor: 2,
            },
          },
        ]
      : [
          {
            name: "Desktop Chromium",
            use: { browserName: "chromium", viewport: { width: 1440, height: 900 } },
          },
          {
            name: "iPhone WebKit",
            grep: /@mobile/,
            use: { ...devices["iPhone 13"], browserName: "webkit" },
          },
          {
            name: "Android gesture",
            grep: /@gesture/,
            use: { ...devices["Pixel 5"], browserName: "chromium" },
          },
        ],
});
