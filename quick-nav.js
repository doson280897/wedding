(() => {
  "use strict";
  const toggle = document.getElementById("wqToggle");
  const panel = document.getElementById("wqPanel");
  const backdrop = document.getElementById("wqBackdrop");
  const closeBtn = document.getElementById("wqClose");
  if (!toggle || !panel || !backdrop || !closeBtn) return;
  const links = [...panel.querySelectorAll(".wq-link")];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const tr = key => window.WeddingI18n ? window.WeddingI18n.t(key) : key;
  const languageButtons = [...document.querySelectorAll(".language-switch [data-lang]")];

  const mapModal = document.getElementById("wmModal");
  const mapBackdrop = document.getElementById("wmBackdrop");
  const mapClose = document.getElementById("wmClose");
  let mapOpen = false;
  let mapPreviousFocus = null;

  const giftModal = document.getElementById("wgModal");
  const giftBackdrop = document.getElementById("wgBackdrop");
  const giftClose = document.getElementById("wgClose");
  let giftOpen = false;
  let giftPreviousFocus = null;

  const trapFocus = (event, focusable) => {
    const items = focusable.filter(node => node && !node.disabled && !node.hidden);
    if (!items.length) return;
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const ensureMapsLoaded = targetId => {
    if (!mapModal) return;
    const target = targetId && document.getElementById(targetId);
    const frames = target
      ? [target.querySelector("iframe[data-src]")].filter(Boolean)
      : [...mapModal.querySelectorAll("iframe[data-src]")];
    frames.forEach(frame => {
      frame.src = frame.dataset.src;
      frame.removeAttribute("data-src");
    });
  };

  const setMapOpen = (value, targetId = null) => {
    if (!mapModal || !mapBackdrop || !mapClose) return;
    if (value) {
      if (!mapOpen) mapPreviousFocus = document.activeElement;
      ensureMapsLoaded(targetId);
      mapOpen = true;
      mapModal.hidden = false;
      mapBackdrop.hidden = false;
      mapModal.setAttribute("aria-hidden", "false");
      document.body.classList.add("wm-open");
      const target = targetId && document.getElementById(targetId);
      mapModal.querySelectorAll(".location-card").forEach(card => card.classList.toggle("wm-highlight", !!target && card === target));
      mapModal.querySelector(".wm-dialog").scrollTop = 0;
      mapClose.focus({preventScroll:true});
      if (target) requestAnimationFrame(() => target.scrollIntoView({block:"nearest",behavior:"auto"}));
    } else {
      mapOpen = false;
      mapModal.hidden = true;
      mapBackdrop.hidden = true;
      mapModal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("wm-open");
      if (mapPreviousFocus && document.contains(mapPreviousFocus)) mapPreviousFocus.focus({preventScroll:true});
    }
  };
  mapClose?.addEventListener("click", () => setMapOpen(false));
  mapBackdrop?.addEventListener("click", () => setMapOpen(false));
  document.querySelectorAll('a[href="#map-bride"],a[href="#map-groom"]').forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      setMapOpen(true, link.getAttribute("href").slice(1));
    });
  });

  const setGiftOpen = value => {
    if (!giftModal || !giftBackdrop || !giftClose) return;
    if (value) {
      giftPreviousFocus = panel.contains(document.activeElement) ? toggle : document.activeElement;
      giftOpen = true;
      giftModal.hidden = false;
      giftBackdrop.hidden = false;
      giftModal.setAttribute("aria-hidden", "false");
      document.body.classList.add("wg-open");
      giftClose.focus({preventScroll:true});
    } else {
      giftOpen = false;
      giftModal.hidden = true;
      giftBackdrop.hidden = true;
      giftModal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("wg-open");
      if (giftPreviousFocus && document.contains(giftPreviousFocus)) giftPreviousFocus.focus({preventScroll:true});
      else toggle.focus({preventScroll:true});
    }
  };
  giftClose?.addEventListener("click", () => setGiftOpen(false));
  giftBackdrop?.addEventListener("click", () => setGiftOpen(false));

  let open = false;
  const setOpen = (value, restoreFocus = true) => {
    if (open === value) return;
    open = value;
    panel.classList.toggle("is-open", value);
    backdrop.hidden = !value;
    panel.setAttribute("aria-hidden", String(!value));
    panel.inert = !value;
    toggle.setAttribute("aria-expanded", String(value));
    toggle.setAttribute("aria-label", tr(value ? "menu.closeAria" : "menu.openAria"));
    document.body.classList.toggle("wq-menu-open", value);
    if (value) closeBtn.focus({preventScroll:true});
    else if (restoreFocus) toggle.focus({preventScroll:true});
  };
  toggle.addEventListener("click", () => setOpen(!open));
  closeBtn.addEventListener("click", () => setOpen(false));
  backdrop.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", event => {
    if (giftOpen) {
      if (event.key === "Escape") {event.preventDefault();setGiftOpen(false);return;}
      if (event.key === "Tab") {
        trapFocus(event, [giftClose, ...giftModal.querySelectorAll('a[href]'), ...languageButtons]);
      }
      return;
    }
    if (mapOpen) {
      if (event.key === "Escape") {event.preventDefault();setMapOpen(false);return;}
      if (event.key === "Tab") {
        trapFocus(event, [mapClose, ...mapModal.querySelectorAll('a[href]'), ...languageButtons]);
      }
      return;
    }
    if (!open) return;
    if (event.key === "Escape") {event.preventDefault();setOpen(false);return;}
    if (event.key !== "Tab") return;
    trapFocus(event, [closeBtn, ...links, ...languageButtons]);
  });
  const refreshLanguage = () => {
    toggle.setAttribute("aria-label", tr(open ? "menu.closeAria" : "menu.openAria"));
  };
  document.addEventListener("wedding:languagechange", refreshLanguage);
  refreshLanguage();

  links.forEach(link => link.addEventListener("click", event => {
    const id = link.getAttribute("href")?.slice(1);
    const target = id && document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    setOpen(false,false);
    if (id === "locations") {
      const activeParty = document.documentElement.dataset.party;
      setMapOpen(true, activeParty === "bride" || activeParty === "groom" ? "map-" + activeParty : null);
      return;
    }
    if (id === "wedding-gift") { setGiftOpen(true); return; }
    history.replaceState(null,"",location.pathname+location.search+"#"+encodeURIComponent(id));
    target.scrollIntoView({behavior:reduced.matches?"auto":"smooth",block:"start"});
    links.forEach(item => item.setAttribute("aria-current", String(item===link)));
  }));
})();