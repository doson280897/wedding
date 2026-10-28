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
  const settingsFocusable = () => {
    const trigger = document.getElementById("settingsTrigger");
    const options = document.getElementById("settingsPanel");
    return [trigger, ...(!options?.hidden ? options.querySelectorAll("button") : [])];
  };

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
        trapFocus(event, [giftClose, ...giftModal.querySelectorAll('a[href]'), ...settingsFocusable()]);
      }
      return;
    }
    if (mapOpen) {
      if (event.key === "Escape") {event.preventDefault();setMapOpen(false);return;}
      if (event.key === "Tab") {
        trapFocus(event, [mapClose, ...mapModal.querySelectorAll('a[href]'), ...settingsFocusable()]);
      }
      return;
    }
    if (!open) return;
    if (event.key === "Escape") {event.preventDefault();setOpen(false);return;}
    if (event.key !== "Tab") return;
    trapFocus(event, [closeBtn, ...links, ...settingsFocusable()]);
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

  // Draggable floating controls: hover on desktop, two-tap activation on touch.
  // Music now lives inside the unified settings palette, not as a separate
  // draggable button scattered across the invitation.
  const floatingControls = [
    document.querySelector(".language-switch"),
    toggle
  ].filter(Boolean);

  const FLOAT_EDGE = 8;
  const FLOAT_IDLE_DELAY = 2600;
  const FLOAT_STORE_KEY = "wedding:floating-controls:v2";
  const coarsePointer = window.matchMedia("(hover: none), (pointer: coarse)");

  let savedFloating = {};
  try {
    savedFloating = JSON.parse(sessionStorage.getItem(FLOAT_STORE_KEY) || "{}") || {};
  } catch (_) {
    savedFloating = {};
  }

  const saveFloatingPositions = () => {
    try { sessionStorage.setItem(FLOAT_STORE_KEY, JSON.stringify(savedFloating)); } catch (_) {}
  };

  const controlKey = control => {
    if (control === toggle) return "menu";
    if (control.id === "musicToggle") return "music";
    return "language";
  };

  const clampTop = (control, top) => {
    const rect = control.getBoundingClientRect();
    return Math.max(FLOAT_EDGE, Math.min(Math.max(FLOAT_EDGE, innerHeight - rect.height - FLOAT_EDGE), top));
  };

  const setEdgeAnchor = (control, edge, top) => {
    control.dataset.floatEdge = edge;
    control.style.top = clampTop(control, top) + "px";
    control.style.bottom = "auto";

    if (edge === "left") {
      control.style.left = FLOAT_EDGE + "px";
      control.style.right = "auto";
    } else {
      control.style.right = FLOAT_EDGE + "px";
      control.style.left = "auto";
    }
  };

  const snapFloatingToEdge = (control, preserveEdge = false) => {
    if (!control.isConnected) return;
    if (control.matches(".language-switch") && document.body.classList.contains("envelope-locked")) return;

    const rect = control.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const edge = preserveEdge && (control.dataset.floatEdge === "left" || control.dataset.floatEdge === "right")
      ? control.dataset.floatEdge
      : (rect.left + rect.width / 2 < innerWidth / 2 ? "left" : "right");

    const top = clampTop(control, rect.top);
    setEdgeAnchor(control, edge, top);

    savedFloating[controlKey(control)] = { edge, top };
    saveFloatingPositions();
  };

  const glideFloatingToEdge = control => {
    if (!control.isConnected) return;

    const rect = control.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const edge = rect.left + rect.width / 2 < innerWidth / 2 ? "left" : "right";
    const top = clampTop(control, rect.top);
    const targetLeft = edge === "left"
      ? FLOAT_EDGE
      : Math.max(FLOAT_EDGE, innerWidth - rect.width - FLOAT_EDGE);

    control.dataset.floatEdge = edge;
    control.style.right = "auto";
    control.style.bottom = "auto";
    control.style.top = top + "px";
    control.style.left = targetLeft + "px";

    savedFloating[controlKey(control)] = { edge, top };
    saveFloatingPositions();

    // Once the glide finishes, convert the pixel position to a true edge
    // anchor. Later expansion therefore grows inward instead of off-screen.
    setTimeout(() => {
      if (!control.isConnected || control.classList.contains("is-dragging")) return;
      if (control.dataset.floatEdge !== edge) return;
      setEdgeAnchor(control, edge, top);
    }, 330);
  };

  const restoreFloatingPosition = control => {
    if (control.matches(".language-switch") && document.body.classList.contains("envelope-locked")) return;

    const saved = savedFloating[controlKey(control)];
    if (!saved || (saved.edge !== "left" && saved.edge !== "right")) return;

    setEdgeAnchor(control, saved.edge, Number(saved.top) || FLOAT_EDGE);
  };

  const installFloatingControl = control => {
    control.classList.add("floating-control");
    restoreFloatingPosition(control);

    let idleTimer = 0;
    let armedTimer = 0;
    let drag = null;
    let suppressClick = false;
    let armed = false;
    let tapStartedIdle = false;

    const setArmed = value => {
      armed = value;
      control.classList.toggle("is-armed", value);
      clearTimeout(armedTimer);
      if (value) {
        armedTimer = setTimeout(() => {
          armed = false;
          control.classList.remove("is-armed");
        }, 3200);
      }
    };

    const wake = () => {
      clearTimeout(idleTimer);
      control.classList.remove("is-idle");
    };

    const collapseNow = () => {
      if (control.classList.contains("settings-hub") && control.classList.contains("is-open")) return;
      setArmed(false);
      snapFloatingToEdge(control, true);
      control.classList.add("is-idle");
    };

    const scheduleIdle = (delay = FLOAT_IDLE_DELAY) => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(collapseNow, delay);
    };

    const onPointerMove = event => {
      if (!drag || event.pointerId !== drag.id) return;

      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;

      if (!drag.moved && Math.hypot(dx, dy) > 6) {
        drag.moved = true;
        tapStartedIdle = false;
        setArmed(false);
        control.classList.add("is-dragging");

        const rect = control.getBoundingClientRect();
        control.style.right = "auto";
        control.style.bottom = "auto";
        control.style.left = rect.left + "px";
        control.style.top = rect.top + "px";
      }

      if (!drag.moved) return;
      event.preventDefault();

      const rect = control.getBoundingClientRect();
      const maxLeft = Math.max(FLOAT_EDGE, innerWidth - rect.width - FLOAT_EDGE);
      const maxTop = Math.max(FLOAT_EDGE, innerHeight - rect.height - FLOAT_EDGE);

      control.style.left = Math.max(FLOAT_EDGE, Math.min(maxLeft, drag.left + dx)) + "px";
      control.style.top = Math.max(FLOAT_EDGE, Math.min(maxTop, drag.top + dy)) + "px";
    };

    const finishDrag = event => {
      if (!drag || (event.pointerId != null && event.pointerId !== drag.id)) return;

      const moved = drag.moved;
      drag = null;
      control.classList.remove("is-dragging");

      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", finishDrag, true);
      window.removeEventListener("pointercancel", finishDrag, true);

      if (moved) {
        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 120);
        glideFloatingToEdge(control);
        scheduleIdle(1050);
      } else {
        scheduleIdle();
      }
    };

    control.addEventListener("pointerdown", event => {
      if (event.button != null && event.button !== 0) return;
      if (control.classList.contains("settings-hub") && event.target.closest(".settings-panel")) return;
      tapStartedIdle = control.classList.contains("is-idle");
      wake();

      const rect = control.getBoundingClientRect();
      drag = {
        id:event.pointerId,
        startX:event.clientX,
        startY:event.clientY,
        left:rect.left,
        top:rect.top,
        moved:false
      };

      window.addEventListener("pointermove", onPointerMove, { capture:true, passive:false });
      window.addEventListener("pointerup", finishDrag, { capture:true });
      window.addEventListener("pointercancel", finishDrag, { capture:true });
    }, { passive:true });

    control.addEventListener("click", event => {
      // Children in the settings palette are independent interactive controls,
      // not drag handles; don't suppress taps or reset idle while selecting.
      if (control.classList.contains("settings-hub") && event.target.closest(".settings-panel")) return;
      if (suppressClick) {
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressClick = false;
        return;
      }

      if (coarsePointer.matches && tapStartedIdle && !control.classList.contains("settings-hub")) {
        tapStartedIdle = false;
        event.preventDefault();
        event.stopImmediatePropagation();
        wake();
        setArmed(true);
        scheduleIdle(3400);
        return;
      }

      tapStartedIdle = false;
      setArmed(false);
      wake();
      scheduleIdle();
    }, true);

    control.addEventListener("pointerenter", () => {
      if (!coarsePointer.matches) wake();
    });
    control.addEventListener("pointerleave", () => {
      if (!coarsePointer.matches) scheduleIdle();
    });
    control.addEventListener("focusin", wake);
    control.addEventListener("focusout", () => scheduleIdle());

    scheduleIdle(1500);
  };

  floatingControls.forEach(installFloatingControl);

  // The envelope temporarily pins the switch next to the safe area.
  // Restore the user's saved draggable position once the envelope disappears.
  document.addEventListener("wedding:envelopeexit", () => {
    const languageControl = document.querySelector(".language-switch");
    if (languageControl) restoreFloatingPosition(languageControl);
  });

  window.addEventListener("resize", () => {
    floatingControls.forEach(control => {
      if (control.matches(".language-switch") && document.body.classList.contains("envelope-locked")) return;
      snapFloatingToEdge(control, true);
    });
  }, { passive:true });

})();