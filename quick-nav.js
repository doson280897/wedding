(() => {
  "use strict";
  const panel = document.getElementById("wqPanel");
  if (!panel) return;
  const links = [...document.querySelectorAll("#wqPanel .wq-link, [data-guest-action]")];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const settingsTrigger = document.getElementById("settingsTrigger");
  const settingsFocusable = () => [settingsTrigger, ...document.querySelectorAll(
    '.settings-hub .settings-panel:not([hidden]) button:not([hidden])'
  )];
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
    const items = focusable.filter(node => node && !node.disabled && !node.hidden && node.getClientRects().length);
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
      if (frame.src !== frame.dataset.src) frame.src = frame.dataset.src;
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
  document.querySelectorAll('a[href="#map-bride"],a[href="#map-groom"],a[href="#map-single"]').forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      setMapOpen(true, link.getAttribute("href").slice(1));
    });
  });

  const setGiftOpen = value => {
    if (!giftModal || !giftBackdrop || !giftClose) return;
    if (value) {
      giftPreviousFocus = panel.contains(document.activeElement) ? settingsTrigger : document.activeElement;
      // Loading only the active celebration's QR avoids hidden bank-image traffic.
      giftModal.querySelectorAll(".gift-card[data-party-scope] .gift-qr[data-src]").forEach(image => {
        if (image.closest("[data-party-scope]")?.dataset.partyScope !==
            document.documentElement.dataset.party) return;
        image.src = image.dataset.src;
        image.removeAttribute("data-src");
      });
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
      else settingsTrigger?.focus({preventScroll:true});
    }
  };
  giftClose?.addEventListener("click", () => setGiftOpen(false));
  giftBackdrop?.addEventListener("click", () => setGiftOpen(false));

  // The unified hub owns opening, closing, and tab state.
  document.addEventListener("keydown", event => {
    if (giftOpen) {
      if (event.key === "Escape") {event.preventDefault();setGiftOpen(false);return;}
      if (event.key === "Tab") trapFocus(event, [giftClose, ...giftModal.querySelectorAll('a[href]'), ...settingsFocusable()]);
      return;
    }
    if (mapOpen) {
      if (event.key === "Escape") {event.preventDefault();setMapOpen(false);return;}
      if (event.key === "Tab") trapFocus(event, [mapClose, ...mapModal.querySelectorAll('a[href]'), ...settingsFocusable()]);
    }
  });
  links.forEach(link => link.addEventListener("click", event => {
    const id = link.getAttribute("href")?.slice(1);
    const target = id && document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    window.WeddingControlHub?.close(false);
    if (id === "locations") {
      const activeParty = document.documentElement.dataset.party;
      setMapOpen(true, ["bride", "groom", "single"].includes(activeParty) ? "map-" + activeParty : null);
      return;
    }
    if (id === "wedding-gift") { setGiftOpen(true); return; }
    history.replaceState(history.state,"",location.pathname+location.search+"#"+encodeURIComponent(id));
    target.scrollIntoView({behavior:reduced.matches?"auto":"smooth",block:"start"});
    links.forEach(item => item.setAttribute("aria-current", String(item===link)));
  }));

  // Both visible orbs share one compositor-friendly drag/snap controller.
  // The main hub starts bottom-right; music stays bottom-left until moved.
  const hub = document.getElementById("settingsHub");
  const musicDock = document.getElementById("musicBubble");
  const FLOAT_EDGE = 8;
  const FLOAT_GAP = 12;
  const FLOAT_IDLE_DELAY = 2600;
  const SNAP_MS = 340;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const coarsePointer = window.matchMedia("(hover: none), (pointer: coarse)");
  const readSafeArea = () => {
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;inset:0;" +
      "padding-top:env(safe-area-inset-top,0px);" +
      "padding-right:env(safe-area-inset-right,0px);" +
      "padding-bottom:env(safe-area-inset-bottom,0px);" +
      "padding-left:env(safe-area-inset-left,0px)";
    document.body.append(probe);
    const css = getComputedStyle(probe);
    const inset = side => parseFloat(css.getPropertyValue("padding-" + side)) || 0;
    const result = {top:inset("top"),right:inset("right"),
      bottom:inset("bottom"),left:inset("left")};
    probe.remove();
    return result;
  };
  const safeArea = readSafeArea();
  // Insets can change after rotation; do not cache the portrait notch forever.
  window.addEventListener("resize", () => Object.assign(safeArea, readSafeArea()), {passive:true});
  const visualBounds = () => {
    const view = window.visualViewport;
    return {left:view?.offsetLeft || 0,top:view?.offsetTop || 0,
      width:view?.width || innerWidth,height:view?.height || innerHeight};
  };
  const visualCenter = () => {const view=visualBounds();return view.left+view.width/2;};

  const minLeft = () => FLOAT_EDGE + safeArea.left;
  const minTop = () => FLOAT_EDGE + safeArea.top;
  const clamp = (value, min, max) => Math.max(min, Math.min(Math.max(min, max), value));
  const bounds = rect => {
    const viewport = visualBounds();
    const left = viewport.left + minLeft();
    const top = viewport.top + minTop();
    const bottom = viewport.top + viewport.height;
    return {
      left,
      right:Math.max(left, viewport.left + viewport.width - rect.width - FLOAT_EDGE - safeArea.right),
      top,
      bottom:Math.max(top, bottom - rect.height - FLOAT_EDGE - safeArea.bottom)
    };
  };
  const visible = node => node?.isConnected && !node.hidden &&
    getComputedStyle(node).display !== "none";

  // Keep snapped controls anchored to the actual screen edge so a compact
  // Settings icon grows INWARD when its label expands.
  const anchor = (node, edge, top) => {
    if (!node?.isConnected || !visible(node)) return;
    const rect = node.getBoundingClientRect();
    const limits = bounds(rect);
    node.dataset.floatEdge = edge;
    node.style.transform = "none";
    node.style.top = clamp(top,limits.top,limits.bottom) + "px";
    node.style.bottom = "auto";
    if (edge === "left") {
      node.style.left = limits.left + "px";
      node.style.right = "auto";
    } else {
      node.style.right = Math.max(0, innerWidth - limits.right - rect.width) + "px";
      node.style.left = "auto";
    }
  };

  const initialPosition = node => {
    if (!visible(node)) return;
    // Let the browser compositor keep the default docks at the viewport
    // bottom during momentum scrolling and Safari toolbar expansion.
    // Converting bottom into a cached top pixel value lets it fall offscreen.
    const edge = node === hub ? "right" : "left";
    node.dataset.floatEdge = edge;
    node.style.transform = "none";
    node.style.top = "auto";
    const view = visualBounds();
    node.style.bottom = Math.max(FLOAT_EDGE + safeArea.bottom,
      innerHeight - view.top - view.height + FLOAT_EDGE + safeArea.bottom) + "px";
    node.style.left = edge === "left" ? (view.left + minLeft()) + "px" : "auto";
    node.style.right = edge === "right"
      ? Math.max(0, innerWidth - view.left - view.width + FLOAT_EDGE + safeArea.right) + "px" : "auto";
  };
  const setupFloating = (node,handle) => {
    if (!handle) return;
    node.classList.add("floating-control");
    if (node === hub) initialPosition(node);

    let drag = null;
    let frame = 0;
    let glideTimer = 0;
    let glideFrame = 0;
    let idleTimer = 0;
    // Consume only the synthetic click produced by a drag release.
    // A NEW pointerdown must always be allowed to activate immediately.
    let suppressDragClick = false;
    let tapStartedIdle = false;

    const cancelGlide = () => {
      clearTimeout(glideTimer);
      cancelAnimationFrame(glideFrame);
      if (!node.classList.contains("is-snapping")) return;
      const rect = node.getBoundingClientRect();
      node.classList.add("is-dragging");
      node.classList.remove("is-snapping");
      node.style.transform = "none";
      node.style.left = rect.left + "px";
      node.style.top = rect.top + "px";
      node.style.right = "auto";
      node.style.bottom = "auto";
      node.classList.remove("is-dragging");
    };
    const wake = () => {
      clearTimeout(idleTimer);
      if (drag || node.classList.contains("is-snapping")) return;
      node.classList.remove("is-idle");
      if (node.dataset.userMoved !== "true") initialPosition(node);
    };
    const settleIdle = () => {
      if (drag || node.classList.contains("is-snapping") ||
          (node === hub && node.classList.contains("is-open"))) return;
      if (node === hub) node.classList.add("is-idle");
      if (node.dataset.userMoved === "true") {
        anchor(node,node.dataset.floatEdge || "right",node.getBoundingClientRect().top);
      } else initialPosition(node);
    };
    const scheduleIdle = (delay = FLOAT_IDLE_DELAY) => {
      clearTimeout(idleTimer);
      if (node === hub) idleTimer = setTimeout(settleIdle,delay);
    };
    const avoidOverlap = (edge, proposedTop, rect) => {
      const other = node === hub ? musicDock : hub;
      if (!visible(other)) return proposedTop;
      const their = other.getBoundingClientRect();
      const theirEdge = other.dataset.floatEdge ||
        (their.left + their.width / 2 < visualCenter() ? "left" : "right");
      if (theirEdge !== edge || proposedTop + rect.height + FLOAT_GAP <= their.top ||
          their.bottom + FLOAT_GAP <= proposedTop) return proposedTop;
      const limits = bounds(rect);
      const above = their.top - rect.height - FLOAT_GAP;
      const below = their.bottom + FLOAT_GAP;
      if (above >= limits.top) return above;
      if (below <= limits.bottom) return below;
      return proposedTop;
    };
    const glide = () => {
      if (!visible(node)) return;
      const rect = node.getBoundingClientRect();
      const edge = rect.left + rect.width / 2 < visualCenter() ? "left" : "right";
      const limits = bounds(rect);
      const top = clamp(avoidOverlap(edge,rect.top,rect),limits.top,limits.bottom);
      const targetLeft = edge === "left" ? limits.left : limits.right;
      node.dataset.floatEdge = edge;
      node.style.transform = "none";
      node.style.left = rect.left + "px";
      node.style.top = rect.top + "px";
      node.style.right = "auto";
      node.style.bottom = "auto";
      // Read one layout frame so the browser can animate from this exact spot.
      void node.offsetWidth;
      node.classList.remove("is-dragging");
      node.classList.add("is-snapping");
      const finish = () => {
        if (!node.classList.contains("is-snapping")) return;
        node.classList.remove("is-snapping");
        anchor(node,edge,top);
        scheduleIdle(900);
      };
      if (reducedMotion.matches) {
        node.style.left = targetLeft + "px";
        node.style.top = top + "px";
        finish();
      } else {
        glideFrame = requestAnimationFrame(() => {
          node.style.left = targetLeft + "px";
          node.style.top = top + "px";
        });
        glideTimer = setTimeout(finish,SNAP_MS + 55);
      }
    };
    const paintDrag = () => {
      frame = 0;
      if (!drag?.moved) return;
      const limits = drag.bounds;
      const left = clamp(drag.left + drag.dx,limits.left,limits.right);
      const top = clamp(drag.top + drag.dy,limits.top,limits.bottom);
      node.style.transform =
        "translate3d(" + (left - drag.left) + "px," + (top - drag.top) + "px,0)";
    };
    const move = event => {
      if (!drag || event.pointerId !== drag.id) return;
      drag.dx = event.clientX - drag.startX;
      drag.dy = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(drag.dx,drag.dy) > 6) {
        drag.moved = true;
        tapStartedIdle = false;
        const rect = node.getBoundingClientRect();
        node.classList.add("is-dragging");
        node.style.left = rect.left + "px";
        node.style.top = rect.top + "px";
        node.style.right = "auto";
        node.style.bottom = "auto";
        drag.left = rect.left;
        drag.top = rect.top;
        drag.bounds = bounds(rect);
        if (node === hub) window.WeddingControlHub?.close(false);
        else document.dispatchEvent(new Event("wedding:musicdockdrag"));
      }
      if (!drag.moved) return;
      if (event.cancelable) event.preventDefault();
      if (!frame) frame = requestAnimationFrame(paintDrag);
    };
    const end = event => {
      if (!drag || (event.pointerId != null && event.pointerId !== drag.id)) return;
      const moved = drag.moved;
      // Resolve the final pointer coordinates before the glide. No trailing
      // animation frame is allowed to overwrite the release position.
      if (frame) {cancelAnimationFrame(frame);frame=0;}
      if (moved) paintDrag();
      drag = null;
      window.removeEventListener("pointermove",move,true);
      window.removeEventListener("pointerup",end,true);
      window.removeEventListener("pointercancel",end,true);
      if (moved) {
        node.dataset.userMoved = "true";
        suppressDragClick = true;
        glide();
      } else {
        scheduleIdle();
      }
    };
    handle.addEventListener("pointerdown", event => {
      if (event.button != null && event.button !== 0) return;
      if (!visible(node) || drag) return;
      cancelGlide();
      // A new gesture is not the trailing click from the previous drag.
      suppressDragClick = false;
      tapStartedIdle = node.classList.contains("is-idle");
      // Do not expand a collapsed hit target underneath the pointer.
      if (!tapStartedIdle && node === hub) wake();
      const rect = node.getBoundingClientRect();
      drag = {
        id:event.pointerId,startX:event.clientX,startY:event.clientY,
        left:rect.left,top:rect.top,dx:0,dy:0,moved:false,
        bounds:bounds(rect)
      };
      window.addEventListener("pointermove",move,{capture:true,passive:false});
      window.addEventListener("pointerup",end,true);
      window.addEventListener("pointercancel",end,true);
    },{passive:true});
    // Capture prevents the post-drag synthetic click from opening Settings
    // or the music action menu, without interfering with normal taps.
    node.addEventListener("click",event => {
      if (event.target.closest(".settings-panel,.music-float-actions")) return;
      if (suppressDragClick) {
        suppressDragClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      tapStartedIdle = false;
      if (node === hub) {wake();scheduleIdle();}
    },true);
    handle.addEventListener("pointerenter", () => {
      if (!coarsePointer.matches && node === hub) wake();
    });
    handle.addEventListener("pointerleave", () => {
      if (!coarsePointer.matches) scheduleIdle();
    });
    handle.addEventListener("focus", () => {
      if (!tapStartedIdle && node === hub) wake();
    });
    if (node === hub) {
      node.addEventListener("focusout",() => scheduleIdle());
      document.addEventListener("wedding:settingsclosed",() => scheduleIdle(1100));
    }
    const reset = () => {
      cancelGlide();
      if (drag) return;
      if (node.dataset.userMoved === "true") {
        anchor(node,node.dataset.floatEdge || "right",node.getBoundingClientRect().top);
      } else initialPosition(node);
    };
    let viewportFrame = 0;
    const scheduleViewportReset = () => {
      if (viewportFrame) return;
      viewportFrame = requestAnimationFrame(() => {
        viewportFrame = 0;
        reset();
      });
    };
    window.addEventListener("resize",scheduleViewportReset,{passive:true});
    window.visualViewport?.addEventListener("resize",scheduleViewportReset,{passive:true});
    window.visualViewport?.addEventListener("scroll",scheduleViewportReset,{passive:true});
    if (node === musicDock) {
      // The orb is initially hidden; its first real PLAYING event gives it
      // dimensions and therefore a valid dock position.
      new MutationObserver(() => {
        if (!visible(node)) return;
        if (node.dataset.userMoved !== "true") initialPosition(node);
        else anchor(node,node.dataset.floatEdge || "left",node.getBoundingClientRect().top);
      }).observe(node,{attributes:true,attributeFilter:["hidden"]});
    }
    scheduleIdle(1500);
  };

  setupFloating(hub,document.getElementById("settingsTrigger"));
  setupFloating(musicDock,document.getElementById("musicBubbleTrigger"));

})();