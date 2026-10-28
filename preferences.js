(() => {
  "use strict";

  // View choices belong to the CURRENT TAB, not to the browser account.
  // History state survives F5 and our same-tab URL updates but is not shared
  // with a freshly opened tab. No localStorage/sessionStorage is needed.
  const previous = history.state && typeof history.state === "object"
    ? history.state : {};
  const saved = previous.weddingPreferences || {};
  const languageParam = new URLSearchParams(location.search).get("lang");

  const systemTheme = (() => {
    try {
      return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
    } catch (_) {
      return "dark";
    }
  })();

  const state = {
    language: saved.language === "vi" || saved.language === "en"
      ? saved.language : (languageParam === "en" ? "en" : "vi"),
    // Keep an explicit choice within this tab. A fresh tab follows the OS;
    // browsers without color-scheme support fall back to Dark.
    theme: saved.theme === "light" || saved.theme === "dark" ? saved.theme : systemTheme,
  };

  const persist = () => {
    try {
      const current = history.state && typeof history.state === "object" ? history.state : {};
      history.replaceState({ ...current, weddingPreferences: { ...state } }, "");
    } catch (_) {
      // Private browsing can restrict History APIs; viewing still works.
    }
  };

  const setLanguage = value => {
    if (value !== "vi" && value !== "en") return;
    state.language = value;
    persist();
  };
  const setTheme = value => {
    if (value !== "light" && value !== "dark") return;
    state.theme = value;
    document.documentElement.dataset.theme = value;
    persist();
  };

  document.documentElement.dataset.theme = state.theme;
  document.documentElement.lang = state.language;
  persist();

  window.WeddingPreferences = {
    getLanguage: () => state.language,
    getTheme: () => state.theme,
    setLanguage,
    setTheme,
  };
})();
