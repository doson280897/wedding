/**
 * Build adapter: reads the ONLY editable wedding-info.js file and fills
 * static metadata, favicons and asset versions for GitHub Pages previews.
 * Do not put personal wedding information here.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = __dirname;
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "wedding-info.js"), "utf8"), context, {
  filename: "wedding-info.js",
  timeout: 1500,
});
const wedding = context.window.WEDDING_INFO;
if (!wedding?.site || !wedding?.couple?.bride || !wedding?.couple?.groom || !wedding?.parties) {
  throw new Error("Missing required fields in wedding-info.js");
}

const build = (process.env.BUILD_SHA || "local-dev").slice(0, 12);
const names = wedding.couple;
const escapeXml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );
const siteUrl = new URL(wedding.site.url);
const assetUrl = new URL(wedding.site.socialImage, siteUrl).href;
const imageExt = path.extname(new URL(assetUrl).pathname).toLowerCase();
const imageMimes = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};
const imageMime = imageMimes[imageExt];
if (!imageMime) throw new Error("Unsupported socialImage file type: " + wedding.site.socialImage);
const namePair = names.bride.short + " · " + names.groom.short;
const meta = {
  __WEDDING_TITLE__: (wedding.site.titlePrefix?.vi || "Thiệp cưới") + " | " + namePair,
  __WEDDING_DESCRIPTION__: wedding.site.description?.vi || "",
  __WEDDING_SITE_NAME__: (wedding.site.titlePrefix?.vi || "Thiệp cưới") + " " + namePair,
  __WEDDING_URL__: siteUrl.href,
  __WEDDING_IMAGE_URL__: assetUrl,
  __WEDDING_IMAGE_MIME__: imageMime,
  __WEDDING_IMAGE_ALT__: namePair,
};

for (const filename of ["index.html", "link-tool.html", "style.css"]) {
  const target = path.join(root, filename);
  let html = fs.readFileSync(target, "utf8").replaceAll("__BUILD_ID__", build);
  if (filename === "index.html" && wedding.site.socialImage !== "og-preview.jpg") {
    // Custom images may have a different aspect ratio; avoid false 1200×630 metadata.
    html = html.replace(/\s*<meta\s+property="og:image:(?:width|height)"[^>]*>/g, "");
  }
  for (const [placeholder, value] of Object.entries(meta)) {
    html = html.replaceAll(placeholder, () => escapeXml(value));
  }
  fs.writeFileSync(target, html);
}
for (const side of ["bride", "groom"]) {
  const first = wedding.couple[side === "bride" ? "bride" : "groom"].initial;
  const second = wedding.couple[side === "bride" ? "groom" : "bride"].initial;
  const target = path.join(root, "favicon-" + side + ".svg");
  const content = fs
    .readFileSync(target, "utf8")
    .replaceAll("__FIRST_INITIAL__", () => escapeXml(first))
    .replaceAll("__SECOND_INITIAL__", () => escapeXml(second));
  fs.writeFileSync(target, content);
}
fs.writeFileSync(path.join(root, "wedding-deploy-info.json"), JSON.stringify(wedding));
fs.writeFileSync(path.join(root, "version.json"), JSON.stringify({ build }));
console.log("Wedding template built from wedding-info.js at", build);
