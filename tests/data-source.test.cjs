"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "wedding-info.js"), "utf8");
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox, { filename: "wedding-info.js" });
const info = sandbox.window.WEDDING_INFO;
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("one wedding-info.js holds all customer data", () => {
  assert.ok(info.site && info.couple && info.parties && info.families && info.text);
  assert.ok(["single","double"].includes(info.wedding?.mode),"Wedding mode must be single or double");
  assert.ok(info.site.url.startsWith("https://"));
  for (const side of ["bride", "groom"]) {
    const person = info.couple[side];
    const party = info.parties[side];
    assert.ok(person.short && person.full && person.initial);
    assert.match(party.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(!Number.isNaN(Date.parse(party.date + "T00:00:00Z")));
    for (const key of ["ceremonyTime", "ceremonyEnd", "receptionTime", "receptionEnd"]) {
      assert.match(party[key], /^\d{2}:\d{2}$/);
    }
    assert.match(party.music.youtubeId, /^[\w-]{11}$/);
    assert.ok(party.venue.mapUrl.startsWith("https://"));
    assert.ok(party.venue.embedUrl.startsWith("https://"));
    assert.ok(party.gift.accountNumber);
    for (const asset of [
      party.images.hero,
      party.images.ending,
      party.images.portraitMain,
      party.images.portraitSecondary,
      party.images.favicon,
      party.gift.qrImage,
    ]) {
      assert.ok(fs.existsSync(path.join(root, asset)), "Missing asset: " + asset);
    }
  }
});

test("one-reception data is independent and complete without a second-party account", () => {
  const party = info.parties.single;
  assert.ok(party,"Single-reception config must exist");
  assert.match(party.date,/^\\d{4}-\\d{2}-\\d{2}$/);
  for (const key of ["receptionTime","receptionEnd"]) {
    assert.match(party[key],/^\\d{2}:\\d{2}$/);
  }
  assert.ok(party.venue?.name && party.venue?.address);
  assert.match(party.venue.mapUrl,/^https:\/\//);
  assert.match(party.venue.embedUrl,/^https:\/\//);
  assert.match(party.music.youtubeId,/^[\\w-]{11}$/);
  assert.ok(party.gift.bank && party.gift.accountNumber && party.gift.qrImage);
  for (const file of [...Object.values(party.images),party.gift.qrImage]) {
    assert.ok(fs.existsSync(path.join(root,file)), "Missing single-party asset: "+file);
  }
  for (const locale of ["vi","en"]) {
    for (const key of ["page.titleSingle","events.singleReception","calendar.singleFile","map.singleTitle","link.single"]) {
      assert.ok(info.text[locale][key],"Missing single-reception translation: "+locale+"."+key);
    }
  }
});

test("Vietnamese and English strings have matching keys and valid data placeholders", () => {
  const vietnamese = info.text.vi;
  const english = info.text.en;
  assert.deepEqual(Object.keys(vietnamese).sort(), Object.keys(english).sort());
  const derived = /^(?:couple\.(?:bride|groom)\.(?:fullUpper|slug)|parties\.(?:bride|groom)\.(?:dateDots|dateSlashes|dateEnglish|dateSpaced|dateYear|weekday))$/;
  for (const strings of [vietnamese, english]) {
    for (const [key, value] of Object.entries(strings)) {
      assert.equal(typeof value, "string", "Non-string text: " + key);
      for (const match of value.matchAll(/\{\{([\w.]+)\}\}/g)) {
        const field = match[1];
        if (derived.test(field)) continue;
        const resolved = field.split(".").reduce((object, part) => object?.[part], info);
        assert.notEqual(resolved, undefined, "Unresolved " + field + " in " + key);
      }
    }
  }
});

test("template and engine files contain no customer-specific information", () => {
  const files = [
    "index.html", "script.js", "i18n.js", "gallery.js", "link-tool.js",
    "settings.js", "settings.css",
    "link-tool.html", "quick-nav.js", "style.css", "quick-nav.css",
    "build-wedding.cjs",
  ];
  const personalValues = [
    info.couple.bride.short,
    info.couple.bride.full,
    info.couple.groom.short,
    info.couple.groom.full,
    info.parties.bride.date,
    info.parties.groom.date,
    info.parties.bride.music.youtubeId,
    info.parties.groom.music.youtubeId,
    info.parties.bride.gift.accountNumber,
    info.parties.groom.gift.accountNumber,
  ];
  for (const file of files) {
    const code = read(file);
    for (const value of personalValues) {
      assert.ok(!code.includes(value), file + " contains customer data: " + value);
    }
  }
});

test("one shared floating language control and one data script", () => {
  const html = read("index.html");
  assert.equal((html.match(/class="language-switch settings-hub"/g) || []).length, 1);
  assert.equal((html.match(/id="settingsPanel"/g) || []).length, 1);
  assert.equal((html.match(/id="musicToggle"/g) || []).length, 1);
  assert.equal((html.match(/src="wedding-info[.]js/g) || []).length, 1);
});

test("gallery configuration has no Drive imports or remote dependencies", () => {
  assert.ok(["append", "replace"].includes(info.gallery.mode));
  assert.ok(!Object.hasOwn(info.gallery, "imports"), "Remove obsolete Drive photo IDs");
  const imageGenerator = read("generate_gallery.py");
  assert.ok(imageGenerator.includes('ALBUM_MODE == "replace"'));
  assert.ok(imageGenerator.includes('ALBUM_MODE == "append"'));
  assert.ok(!fs.existsSync(path.join(root, ".github/workflows/import-wedding-photos.yml")));
  const deploy = read(".github/workflows/deploy.yml");
  assert.ok(!deploy.includes("Import wedding album from config"));
});
