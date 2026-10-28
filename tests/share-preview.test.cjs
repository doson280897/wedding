"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const template = [
  "index.html",
  "link-tool.html",
  "style.css",
  "favicon-bride.svg",
  "favicon-groom.svg",
  "build-wedding.cjs",
];
const original = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "wedding-info.js"), "utf8"), original);

function buildWithSocialImage(socialImage) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "wedding-meta-test-"));
  try {
    for (const filename of template) {
      fs.copyFileSync(path.join(root, filename), path.join(directory, filename));
    }
    const info = JSON.parse(JSON.stringify(original.window.WEDDING_INFO));
    info.site.socialImage = socialImage;
    fs.writeFileSync(
      path.join(directory, "wedding-info.js"),
      "window.WEDDING_INFO = " + JSON.stringify(info) + ";",
    );
    execFileSync(process.execPath, ["build-wedding.cjs"], {
      cwd: directory,
      env: { ...process.env, GITHUB_ACTIONS: "false", BUILD_SHA: "1234567890abcdef" },
    });
    const output = fs.readFileSync(path.join(directory, "index.html"), "utf8");
    assert.ok(!output.includes("__WEDDING_IMAGE_MIME__"));
    assert.ok(!output.includes("__WEDDING_IMAGE_URL__"));
    assert.ok(!output.includes("__BUILD_ID__"));
    return output;
  } finally {
    fs.rmSync(directory, { force: true, recursive: true });
  }
}

test("default hero-generated preview keeps correct JPEG metadata", () => {
  const result = buildWithSocialImage("og-preview.jpg");
  assert.match(result, /property="og:image:type" content="image\/jpeg"/);
  assert.match(result, /property="og:image:width" content="1200"/);
  assert.match(result, /property="og:image:height" content="630"/);
  assert.match(result, /og-preview[.]jpg/);
});

test("custom PNG social preview has correct MIME and no false dimensions", () => {
  const result = buildWithSocialImage("images/custom-preview.png");
  assert.match(result, /property="og:image:type" content="image\/png"/);
  assert.match(result, /images\/custom-preview[.]png/);
  assert.doesNotMatch(result, /property="og:image:(?:width|height)"/);
});

test("external WebP social preview does not inherit 1200×630 dimensions", () => {
  const result = buildWithSocialImage("https://example.org/invitation.webp");
  assert.match(result, /property="og:image:type" content="image\/webp"/);
  assert.match(result, /https:\/\/example[.]org\/invitation[.]webp/);
  assert.doesNotMatch(result, /property="og:image:(?:width|height)"/);
});
