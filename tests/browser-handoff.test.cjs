"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {detectApp,toAndroidIntent}=require("../browser-handoff.js");
test("detects common in-app browsers without flagging Safari or Chrome",()=>{
  assert.equal(detectApp("Zalo/25.11 Mobile"),"zalo");
  assert.equal(detectApp("FBAN/MessengerForiOS FBAV/400"),"messenger");
  assert.equal(detectApp("FBAN/FBIOS FBAV/400"),"facebook");
  assert.equal(detectApp("Instagram 130"),"instagram");
  assert.equal(detectApp("Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36"),"webview");
  assert.equal(detectApp("Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"),null);
  assert.equal(detectApp("Mozilla/5.0 (iPhone) CriOS/122.0 Mobile/15E148 Safari/604.1"),null);
});
test("intent includes original guest link in HTTPS fallback",()=>{
  const url="https://doson280897.github.io/wedding/?party=groom&to=Nguy%E1%BB%85n%20V%C4%83n%20A";
  const intent=toAndroidIntent(url);
  assert.match(intent,/^intent:\/\/doson280897.github.io\/wedding\/\?party=groom/);
  assert.equal(decodeURIComponent(intent.match(/S.browser_fallback_url=([^;]+);end$/)[1]),url);
  assert.equal(toAndroidIntent("javascript:alert(1)"),null);
});