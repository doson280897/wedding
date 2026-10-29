"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildICS, providerURL } = require("../calendar.js");

const event = {
  id:"reception", title:"Tiệc cưới · Minh & Lan", start:"20261114T040000Z", end:"20261114T060000Z",
  place:"Nhà hàng, Sảnh A; Tầng 2", note:"Dòng đầu\nDòng hai \\ cùng gia đình"
};
const options = { side:"bride", date:"2026-11-14", hostname:"example.com", timezone:"GMT+07:00", now:new Date("2026-10-29T00:00:00Z") };
const unfold = value => value.replace(/\r\n /g, "");

test("calendar files preserve UTC times and escape Vietnamese text safely", () => {
  const text = buildICS([event], options);
  const plain = unfold(text);
  assert.match(plain, /DTSTART:20261114T040000Z\r\nDTEND:20261114T060000Z/);
  assert.ok(plain.includes("LOCATION:Nhà hàng\\, Sảnh A\\; Tầng 2"));
  assert.ok(plain.includes("DESCRIPTION:Dòng đầu\\nDòng hai \\\\ cùng gia đình (GMT+07:00)"));
  assert.ok(plain.endsWith("END:VCALENDAR\r\n"));
  assert.equal((plain.match(/BEGIN:VEVENT/g) || []).length, 1);
});

test("UTF-8 calendar lines fold at 75 bytes without breaking characters", () => {
  const title = "Ngày hạnh phúc · ".repeat(30);
  const text = buildICS([{ ...event, title }], options);
  for (const line of text.split("\r\n")) assert.ok(Buffer.byteLength(line, "utf8") <= 75);
  assert.ok(unfold(text).includes("SUMMARY:" + title));
  assert.equal(unfold(text).includes("�"), false);
  const all = unfold(buildICS([event, { ...event, id:"ceremony", start:"20261114T020000Z" }], options));
  assert.equal((all.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.equal(new Set([...all.matchAll(/UID:([^\r]+)/g)].map(match => match[1])).size, 2);
  const stable = unfold(buildICS([{ ...event, uidIndex:1 }], options));
  assert.ok(stable.includes("UID:bride-1-2026-11-14@example.com"));
});

test("Google and Outlook drafts use the same event, UTC dates and encoded location", () => {
  const google = new URL(providerURL("google", event, options.timezone));
  assert.equal(google.hostname, "calendar.google.com");
  assert.equal(google.searchParams.get("text"), event.title);
  assert.equal(google.searchParams.get("dates"), event.start + "/" + event.end);
  assert.equal(google.searchParams.get("location"), event.place);
  const outlook = new URL(providerURL("outlook", event, options.timezone));
  assert.equal(outlook.hostname, "outlook.live.com");
  assert.equal(outlook.searchParams.get("subject"), event.title);
  assert.equal(outlook.searchParams.get("startdt"), "2026-11-14T04:00:00Z");
  assert.equal(outlook.searchParams.get("enddt"), "2026-11-14T06:00:00Z");
  assert.equal(outlook.searchParams.get("location"), event.place);
  assert.equal(outlook.searchParams.get("body"), event.note + "\n" + options.timezone);
});
