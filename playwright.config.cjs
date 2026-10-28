const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30000,
  expect: { timeout: 10000 },
  use: { trace: "retain-on-failure", screenshot: "only-on-failure" },
  // On ordinary pushes, run every functional test once on Chromium and a
  // compact smoke subset on Android, iOS and Firefox. Run the 8-device full
  // matrix only when the workflow is manually dispatched in extended mode.
  projects: process.env.WEDDING_EXTENDED_TESTS === "true"
    ? [
        {name:"Desktop Chromium",use:{browserName:"chromium",viewport:{width:1440,height:900}}},
        {name:"Android Pixel 5",use:{...devices["Pixel 5"],browserName:"chromium"}},
        {name:"iPhone 13 WebKit",use:{...devices["iPhone 13"],browserName:"webkit"}},
        {name:"iPad Mini WebKit",use:{...devices["iPad Mini"],browserName:"webkit"}},
        {name:"Android tablet",use:{browserName:"chromium",viewport:{width:800,height:1280},isMobile:true,hasTouch:true,deviceScaleFactor:2}},
        {name:"Compact Android 320px",use:{browserName:"chromium",viewport:{width:320,height:568},isMobile:true,hasTouch:true,deviceScaleFactor:2}},
        {name:"Desktop Firefox",use:{browserName:"firefox",viewport:{width:1366,height:768}}},
        {name:"Landscape WebKit",use:{browserName:"webkit",viewport:{width:667,height:375},isMobile:true,hasTouch:true,deviceScaleFactor:2}},
      ]
    : [
        {name:"Desktop Chromium - full functionality",use:{browserName:"chromium",viewport:{width:1440,height:900}}},
        {name:"Android Pixel - smoke",grep:/@smoke/,use:{...devices["Pixel 5"],browserName:"chromium"}},
        {name:"iPhone WebKit - smoke",grep:/@smoke/,use:{...devices["iPhone 13"],browserName:"webkit"}},
        {name:"Desktop Firefox - core",grep:/@core/,use:{browserName:"firefox",viewport:{width:1366,height:768}}},
      ],
});
