"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");

test("repeated public builds preserve templates and media bytes, exclude private build files", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "wedding-build-"));
  try {
    for (const entry of fs.readdirSync(root)) {
      if (["node_modules", "dist", ".git", "test-results"].includes(entry)) continue;
      fs.cpSync(path.join(root, entry), path.join(temp, entry), { recursive: true });
    }
    const template = fs.readFileSync(path.join(temp, "index.html"));
    // Exercise a configured optional sound and a local custom share image.
    const infoPath = path.join(temp, "wedding-info.js");
    const vm = require("node:vm");
    const context = { window: {} };
    vm.runInNewContext(fs.readFileSync(infoPath, "utf8"), context);
    const info = context.window.WEDDING_INFO;
    info.site.description.vi = "Literal $& and $` and $' <preview>";
    info.couple.bride.initial = "$&";
    info.site.introSound = info.parties.bride.music.src;
    info.site.socialImage = info.parties.bride.images.hero;
    fs.writeFileSync(infoPath, "window.WEDDING_INFO = " + JSON.stringify(info) + ";");
    for (const sha of ["first-build", "second-build"]) {
      execFileSync(process.execPath, ["scripts/build-site.cjs"], {
        cwd: temp,
        env: { ...process.env, BUILD_SHA: sha },
      });
      assert.deepEqual(fs.readFileSync(path.join(temp, "index.html")), template);
      const html = fs.readFileSync(path.join(temp, "dist/index.html"), "utf8");
      assert.ok(html.includes(sha));
      assert.ok(!html.includes("__BUILD_ID__"));
      assert.ok(!html.includes("__WEDDING_"));
      assert.ok(html.includes("Literal $&amp; and $` and $&#39; &lt;preview&gt;"));
      assert.ok(
        fs.readFileSync(path.join(temp, "dist/favicon-bride.svg"), "utf8").includes("$&amp;"),
      );
      for (const file of [
        info.site.introSound,
        info.site.socialImage,
        info.site.entrance.image,
        info.site.entrance.lock,
        ...Object.values(info.parties).map((party) => party.gift.qrImage),
      ]) {
        assert.deepEqual(
          fs.readFileSync(path.join(temp, "dist", file)),
          fs.readFileSync(path.join(temp, file)),
        );
      }
      for (const file of [
        "tests",
        "scripts",
        "build-wedding.cjs",
        "wedding-deploy-info.json",
        "images/original",
      ]) {
        assert.ok(!fs.existsSync(path.join(temp, "dist", file)), "Unexpected public file: " + file);
      }
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
