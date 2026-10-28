(() => {
  "use strict";

  const hub = document.getElementById("settingsHub");
  const trigger = document.getElementById("settingsTrigger");
  const panel = document.getElementById("settingsPanel");
  const closeButton = document.getElementById("settingsClose");
  const menuTab = document.getElementById("controlTabMenu");
  const settingsTab = document.getElementById("controlTabSettings");
  const tabs = document.getElementById("controlTabs");
  const menuContent = document.getElementById("wqPanel");
  const settingsContent = document.getElementById("settingsTabContent");
  const panelTitle = document.getElementById("controlPanelTitle");
  if (!hub || !trigger || !panel || !closeButton || !menuTab || !settingsTab ||
      !tabs || !menuContent || !settingsContent) return;
  const tr = key => window.WeddingI18n?.t(key) || key;
  const hasMenu = () => Boolean(document.documentElement.dataset.party) &&
    !document.documentElement.classList.contains("party-pending") &&
    !document.documentElement.classList.contains("link-tool-active");

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
    const viewport = window.visualViewport;
    const viewportLeft = viewport?.offsetLeft || 0;
    const viewportTop = viewport?.offsetTop || 0;
    const viewportRight = viewportLeft + (viewport?.width || innerWidth);
    const viewportBottom = viewportTop + (viewport?.height || innerHeight);
    const width = panelRect.width;
    const height = panelRect.height;
    // Clamp in viewport coordinates, then convert to the hub's local
    // position. This also works when the hub is dragged to the screen center.
    const left = Math.max(viewportLeft + edge, Math.min(viewportRight - width - edge, triggerRect.right - width));
    const roomBelow = viewportBottom - triggerRect.bottom;
    const roomAbove = triggerRect.top - viewportTop;
    const preferredTop = roomBelow >= height + edge || roomBelow >= roomAbove
      ? triggerRect.bottom + edge
      : triggerRect.top - height - edge;
    const top = Math.max(viewportTop + edge, Math.min(viewportBottom - height - edge, preferredTop));
    panel.style.left = Math.round(left - hubRect.left) + "px";
    panel.style.top = Math.round(top - hubRect.top) + "px";
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  };

  const setTab = name => {
    const showMenu = name === "menu" && hasMenu();
    tabs.hidden = !hasMenu();
    menuTab.hidden = !hasMenu();
    settingsContent.hidden = showMenu;
    menuContent.hidden = !showMenu;
    menuContent.inert = !showMenu;
    menuContent.setAttribute("aria-hidden", String(!showMenu));
    menuTab.setAttribute("aria-selected", String(showMenu));
    menuTab.tabIndex = showMenu ? 0 : -1;
    settingsTab.setAttribute("aria-selected", String(!showMenu));
    settingsTab.tabIndex = showMenu ? -1 : 0;
    if (panelTitle) panelTitle.textContent = tr(showMenu ? "menu.toggle" : "settings.title");
    if (!panel.hidden) {panel.scrollTop = 0;positionPanel();}
  };
  const setOpen = (open, restoreFocus = false) => {
    if (open) {
      setTab(hasMenu() ? "menu" : "settings");
      panel.hidden = false;
      hub.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
      hub.classList.remove("is-idle");
      positionPanel();
    } else {
      panel.hidden = true;
      hub.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
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
  menuTab.addEventListener("click", () => setTab("menu"));
  settingsTab.addEventListener("click", () => setTab("settings"));
  for (const [tab,peer,next] of [[menuTab,settingsTab,"settings"],[settingsTab,menuTab,"menu"]]) {
    tab.addEventListener("keydown", event => {
      if (!hasMenu() || !["ArrowLeft","ArrowRight"].includes(event.key)) return;
      event.preventDefault();setTab(next);peer.focus({preventScroll:true});
    });
  }
  window.WeddingControlHub = {
    close: restoreFocus => setOpen(false, restoreFocus !== false),
    showMenu: () => {if (panel.hidden) setOpen(true);setTab("menu");},
    showSettings: () => {if (panel.hidden) setOpen(true);setTab("settings");}
  };
  document.addEventListener("wedding:languagechange", () => {
    if (!panel.hidden && panelTitle) panelTitle.textContent =
      tr(menuContent.hidden ? "settings.title" : "menu.toggle");
  });
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
  window.visualViewport?.addEventListener("resize", schedulePanelPosition, { passive: true });
  window.visualViewport?.addEventListener("scroll", schedulePanelPosition, { passive: true });
  hub.addEventListener("pointerup", schedulePanelPosition);

  syncThemeControls();
  window.WeddingTheme = { getTheme: currentTheme, setTheme };
})();
