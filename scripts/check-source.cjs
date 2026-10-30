"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
for (const directory of [root, path.join(root, "scripts"), path.join(root, "tests")]) {
  for (const file of fs.readdirSync(directory)) {
    if (/\.(?:js|cjs)$/.test(file))
      execFileSync(process.execPath, ["--check", path.join(directory, file)], { stdio: "inherit" });
  }
}
console.log("JavaScript syntax checked.");
