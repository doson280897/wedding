(() => {
  "use strict";
  const detectApp = ua => {
    ua = String(ua || "");
    if (/Zalo|ZBrowser/i.test(ua)) return "zalo";
    if (/Messenger|FBAN\/Messenger/i.test(ua)) return "messenger";
    if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A/i.test(ua)) return "facebook";
    if (/Instagram/i.test(ua)) return "instagram";
    if (/TikTok|musical_ly|BytedanceWebview/i.test(ua)) return "tiktok";
    if (/MicroMessenger/i.test(ua)) return "wechat";
    if (/Line\/|Line\(/i.test(ua)) return "line";
    if (/; wv\)|; wv;|\bWebView\b/i.test(ua)) return "webview";
    return null;
  };
  const toAndroidIntent = href => {
    let url;
    try { url = new URL(href); } catch (_) { return null; }
    if (!["https:", "http:"].includes(url.protocol)) return null;
    return "intent://" + url.host + url.pathname + url.search + 
      "#Intent;scheme=" + url.protocol.slice(0, -1) +
      ";action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE" +
      ";S.browser_fallback_url=" + encodeURIComponent(url.href) + ";end";
  };
  if (typeof module === "object" && module.exports) {
    module.exports = { detectApp, toAndroidIntent };
    return;
  }
  const app = detectApp(navigator.userAgent);
  const box = document.getElementById("browserHandoff");
  if (!app || !box || !window.WeddingI18n) return;
  const t = key => window.WeddingI18n.t(key);
  const open = document.getElementById("browserHandoffOpen");
  const copy = document.getElementById("browserHandoffCopy");
  const status = document.getElementById("browserHandoffStatus");
  const desc = document.getElementById("browserHandoffDescription");
  const steps = document.getElementById("browserHandoffSteps");
  const android = /Android/i.test(navigator.userAgent);
  const key = "wedding-inapp-browser-dismissed-v1";
  let context = "general";
  const wasDismissed = () => { try { return sessionStorage.getItem(key) === "1"; } catch (_) { return false; } };
  const render = () => {
    desc.textContent = t(context === "calendar" ? "browser.calendarDescription" : "browser.description");
    steps.textContent = t(app === "zalo" ? "browser.stepsZalo" : "browser.stepsOther");
    open.href = location.href; // Preserve ?party, ?to and language.
    open.target = android ? "_self" : "_blank";
    open.rel = "noopener noreferrer";
  };
  const show = (kind="general", force=false) => {
    if (!force && wasDismissed()) return;
    context = kind;
    status.textContent = "";
    render();
    box.hidden = false;
  };
  const hide = () => {
    box.hidden = true;
    try { sessionStorage.setItem(key, "1"); } catch (_) {}
  };
  open.addEventListener("click", event => {
    status.textContent = t("browser.attemptHint");
    if (!android) return; // iOS cannot request a system browser chooser.
    const intent = toAndroidIntent(location.href);
    if (!intent) return;
    event.preventDefault();
    try { location.assign(intent); } catch (_) {}
  });
  copy.addEventListener("click", async () => {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(location.href);
        ok = true;
      }
    } catch (_) {}
    if (!ok) {
      const field = document.createElement("textarea");
      field.value = location.href;
      field.readOnly = true;
      field.style.cssText = "position:fixed;top:-1000px;left:-1000px";
      document.body.append(field);
      field.select();
      try { ok = document.execCommand("copy"); } catch (_) {}
      field.remove();
    }
    status.textContent = t(ok ? "browser.copied" : "browser.copyFail");
  });
  document.getElementById("browserHandoffDismiss").addEventListener("click", hide);
  document.getElementById("browserHandoffClose").addEventListener("click", hide);
  document.addEventListener("wedding:languagechange", render);
  window.WeddingExternalBrowser = {isEmbedded:true,app,request:kind=>show(kind||"general",true)};
  const reveal = () => setTimeout(() => show(),800);
  if (document.documentElement.classList.contains("wax-pending"))
    document.addEventListener("wedding:waxopen",reveal,{once:true});
  else reveal();
})();