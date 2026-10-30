"use strict";

// Build in an isolated directory: checked-in templates are never overwritten.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "wedding-info.js"), "utf8"), context, {
  timeout: 1500,
});
const info = context.window.WEDDING_INFO;

function copyLocalAsset(source) {
  if (!source || /^https?:\/\//i.test(source)) return;
  const relative = decodeURIComponent(source.split(/[?#]/)[0]);
  const target = path.resolve(output, relative);
  if (!target.startsWith(output + path.sep) || path.isAbsolute(relative)) {
    throw new Error("Asset path must stay inside the site: " + source);
  }
  const input = path.resolve(root, relative);
  if (!fs.statSync(input).isFile()) throw new Error("Missing asset: " + source);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(input, target);
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const file of fs.readdirSync(root)) {
  if (/\.(?:html|css|js|svg)$/.test(file)) copyLocalAsset(file);
}
fs.mkdirSync(path.join(output, "images"));
copyLocalAsset("images/manifest.json");
fs.cpSync(path.join(root, "images/optimized"), path.join(output, "images/optimized"), {
  recursive: true,
});
copyLocalAsset(info.site.entrance.image);
copyLocalAsset(info.site.entrance.lock);
for (const party of Object.values(info.parties)) {
  copyLocalAsset(party.music.src);
  copyLocalAsset(party.gift.qrImage);
}
copyLocalAsset(info.site.introSound);
if (info.site.socialImage !== "og-preview.jpg") copyLocalAsset(info.site.socialImage);
fs.copyFileSync(path.join(root, "build-wedding.cjs"), path.join(output, "build-wedding.cjs"));
execFileSync(process.execPath, [path.join(output, "build-wedding.cjs")], { stdio: "inherit" });
execFileSync(
  process.env.PYTHON || "python3",
  [path.join(__dirname, "build-social-preview.py"), output],
  { stdio: "inherit" },
);
for (const file of ["build-wedding.cjs", "wedding-deploy-info.json"])
  fs.unlinkSync(path.join(output, file));
console.log("Public website ready in dist/");
