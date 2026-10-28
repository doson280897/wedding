(() => {
  "use strict";

  const hub = document.getElementById("settingsHub");
  const trigger = document.getElementById("settingsTrigger");
  const panel = document.getElementById("settingsPanel");
  const closeButton = document.getElementById("settingsClose");
  if (!hub || !trigger || !panel || !closeButton) return;

  const themeButtons = [...panel.querySelectorAll("[data-theme-option]")];
  const themeMeta = document.getElementById("themeColor");

  const currentTheme = () => document.documentElement.dataset.theme === "light" ? "light" : "dark";

  const syncThemeControls = () => {
    const theme = currentTheme();
    for (const button of themeButtons) {
      const active = button.dataset.themeOption === theme;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }

    // The envelope uses its own paper/chrome color regardless of the theme.
    const envelopeVisible = document.body.classList.contains("envelope-locked") ||
      document.documentElement.classList.contains("envelope-pending");
    if (themeMeta && !envelopeVisible) {
      themeMeta.content = theme === "light" ? "#f5f0e6" : "#0b0e0e";
    }
  };

  const setTheme = (next, persist = true) => {
    if (next !== "light" && next !== "dark") return;
    document.documentElement.dataset.theme = next;
    if (persist) {
      try { localStorage.setItem("wedding-theme", next); } catch (_) {}
    }
    syncThemeControls();
    document.dispatchEvent(new CustomEvent("wedding:themechange", { detail: { theme: next } }));
  };

  const positionPanel = () => {
    if (panel.hidden) return;
    const rect = trigger.getBoundingClientRect();
    const panelHeight = panel.getBoundingClientRect().height;
    const bottomSpace = innerHeight - rect.bottom;
    const topSpace = rect.top;
    hub.classList.toggle("panel-above", bottomSpace < panelHeight + 18 && topSpace > bottomSpace);
    // A dragged hub may sit away from the edge. Anchor to the nearest side,
    // so the panel always expands inward rather than past the phone viewport.
    hub.classList.toggle("panel-left", rect.left + rect.width / 2 < innerWidth / 2);
  };

  const setOpen = (open, restoreFocus = false) => {
    panel.hidden = !open;
    hub.classList.toggle("is-open", open);
    trigger.setAttribute("aria-expanded", String(open));
    if (open) {
      hub.classList.remove("is-idle");
      positionPanel();
    } else {
      hub.classList.remove("panel-above", "panel-left");
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
  document.addEventListener("wedding:envelopeexit", syncThemeControls);
  window.addEventListener("resize", positionPanel, { passive: true });
  window.addEventListener("scroll", positionPanel, { passive: true });
  hub.addEventListener("pointerup", () => requestAnimationFrame(positionPanel));

  window.addEventListener("storage", event => {
    if (event.key === "wedding-theme") setTheme(event.newValue === "light" ? "light" : "dark", false);
  });

  syncThemeControls();
  window.WeddingTheme = { getTheme: currentTheme, setTheme };
})();
