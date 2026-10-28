(() => {
  "use strict";

  const hub = document.getElementById("settingsHub");
  const trigger = document.getElementById("settingsTrigger");
  const panel = document.getElementById("settingsPanel");
  const closeButton = document.getElementById("settingsClose");
  if (!hub || !trigger || !panel || !closeButton) return;

  const themeButtons = [...panel.querySelectorAll("[data-theme-option]")];

  const currentTheme = () => document.documentElement.dataset.theme === "light" ? "light" : "dark";

  const syncThemeControls = () => {
    const theme = currentTheme();
    for (const button of themeButtons) {
      const active = button.dataset.themeOption === theme;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }

  };

  const setTheme = (next, persist = true) => {
    if (next !== "light" && next !== "dark") return;
    document.documentElement.dataset.theme = next;
    if (persist) window.WeddingPreferences?.setTheme(next);
    syncThemeControls();
    document.dispatchEvent(new CustomEvent("wedding:themechange", { detail: { theme: next } }));
  };

  const positionPanel = () => {
    if (panel.hidden) return;
    const triggerRect = trigger.getBoundingClientRect();
    const hubRect = hub.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const edge = 10;
    const width = panelRect.width;
    const height = panelRect.height;
    // Clamp in viewport coordinates, then convert to the hub's local
    // position. This also works when the hub is dragged to the screen center.
    const left = Math.max(edge, Math.min(innerWidth - width - edge, triggerRect.right - width));
    const roomBelow = innerHeight - triggerRect.bottom;
    const roomAbove = triggerRect.top;
    const preferredTop = roomBelow >= height + edge || roomBelow >= roomAbove
      ? triggerRect.bottom + edge
      : triggerRect.top - height - edge;
    const top = Math.max(edge, Math.min(innerHeight - height - edge, preferredTop));
    panel.style.left = Math.round(left - hubRect.left) + "px";
    panel.style.top = Math.round(top - hubRect.top) + "px";
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  };

  const setOpen = (open, restoreFocus = false) => {
    panel.hidden = !open;
    hub.classList.toggle("is-open", open);
    trigger.setAttribute("aria-expanded", String(open));
    if (open) {
      hub.classList.remove("is-idle");
      positionPanel();
    } else {
      panel.style.left = "";
      panel.style.top = "";
      panel.style.right = "";
      panel.style.bottom = "";
      document.dispatchEvent(new Event("wedding:settingsclosed"));
      if (restoreFocus) trigger.focus({ preventScroll: true });
    }
  };

  trigger.addEventListener("click", () => setOpen(panel.hidden));
  closeButton.addEventListener("click", () => setOpen(false, true));

  themeButtons.forEach(button => button.addEventListener("click", () => {
    setTheme(button.dataset.themeOption);
  }));

  // Keep language, theme and music in a single compact panel, but let the
  // existing language and YouTube handlers control their own behavior.
  document.addEventListener("pointerdown", event => {
    if (!panel.hidden && !hub.contains(event.target)) setOpen(false);
  }, true);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !panel.hidden) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(false, true);
    }
  }, true);

  const navToggle = document.getElementById("wqToggle");
  navToggle?.addEventListener("click", () => setOpen(false));
  document.querySelector(".party-admin-link")?.addEventListener("click", () => setOpen(false));
  window.addEventListener("popstate", () => setOpen(false));
  // A dragging/scrolling settings palette can emit many events per frame.
  // Coalesce layout reads and writes to one positioning pass.
  let positionFrame = 0;
  const schedulePanelPosition = () => {
    if (panel.hidden || positionFrame) return;
    positionFrame = requestAnimationFrame(() => {
      positionFrame = 0;
      positionPanel();
    });
  };
  window.addEventListener("resize", schedulePanelPosition, { passive: true });
  window.addEventListener("scroll", schedulePanelPosition, { passive: true });
  hub.addEventListener("pointerup", schedulePanelPosition);

  syncThemeControls();
  window.WeddingTheme = { getTheme: currentTheme, setTheme };
})();
