(() => {
  "use strict";

  // View choices belong to the CURRENT TAB, not to the browser account.
  // History state survives F5 and our same-tab URL updates but is not shared
  // with a freshly opened tab. No localStorage/sessionStorage is needed.
  const previous = history.state && typeof history.state === "object" ? history.state : {};
  const saved = previous.weddingPreferences || {};
  const languageParam = new URLSearchParams(location.search).get("lang");

  const state = {
    language:
      saved.language === "vi" || saved.language === "en"
        ? saved.language
        : languageParam === "en"
          ? "en"
          : "vi",
  };

  const persist = () => {
    try {
      const current = history.state && typeof history.state === "object" ? history.state : {};
      history.replaceState({ ...current, weddingPreferences: { ...state } }, "");
    } catch (_) {
      // Private browsing can restrict History APIs; viewing still works.
    }
  };

  const setLanguage = (value) => {
    if (value !== "vi" && value !== "en") return;
    state.language = value;
    persist();
  };
  document.documentElement.dataset.theme = "dark";
  document.documentElement.lang = state.language;
  persist();

  window.WeddingPreferences = {
    getLanguage: () => state.language,
    setLanguage,
  };
})();
