(() => {
  "use strict";
  const i18n = window.WeddingI18n;
  const tr = (key) => (i18n ? i18n.t(key) : key);
  const info = window.WEDDING_INFO;
  const partyInfo = (side) => info.parties[side];
  const params = new URLSearchParams(window.location.search);
  const partyParam = params.get("party");
  const singleMode = info.wedding?.mode === "single";
  const linkToolInitial = params.get("tool") === "links";
  // In a single-reception wedding, old ?party=bride/groom links remain usable
  // but always resolve to the only celebration rather than a party selector.
  const selectedParty = singleMode
    ? "single"
    : partyParam === "bride" || partyParam === "groom"
      ? partyParam
      : null;
  document.documentElement.dataset.weddingMode = singleMode ? "single" : "double";
  const partySelector = document.getElementById("partySelector");
  // Language buttons are owned by i18n.js; no duplicate click handlers here.

  // Keep the invitation anchored to the top while the entrance gate is active.
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  const resetInvitationScroll = () => window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  resetInvitationScroll();
  window.addEventListener("pageshow", () => {
    // Slow external resources can delay pageshow until after a reduced-motion
    // entrance has finished. Never pull a guest back from content they opened.
    if (document.documentElement.classList.contains("wax-pending")) resetInvitationScroll();
  });

  if (selectedParty) {
    document.documentElement.dataset.party = selectedParty;
    document.documentElement.classList.remove("party-pending");
  } else {
    document.documentElement.classList.add("party-pending");
    const partyButtons = Array.from(document.querySelectorAll("[data-party-select]"));
    requestAnimationFrame(() => {
      if (!document.documentElement.classList.contains("link-tool-active")) {
        partyButtons[0]?.focus({ preventScroll: true });
      }
    });

    partyButtons.forEach((button) =>
      button.addEventListener("click", () => {
        const side = button.dataset.partySelect;
        if (side !== "bride" && side !== "groom") return;
        const url = new URL(window.location.href);
        url.searchParams.set("party", side);
        url.hash = "";
        // Switch to the selected invitation within the same history entry.
        // Preserve this tab's language through the page reload.
        try {
          history.replaceState(history.state, "", url.href);
          window.location.reload();
        } catch (_) {
          window.location.replace(url.href);
        }
      }),
    );

    document.addEventListener("keydown", (event) => {
      if (
        !document.documentElement.classList.contains("party-pending") ||
        document.documentElement.classList.contains("link-tool-active") ||
        event.key !== "Tab"
      )
        return;
      const adminLink = document.querySelector(".party-admin-link");
      const settingsTrigger = document.getElementById("settingsTrigger");
      const settingsPanel = document.getElementById("settingsPanel");
      const settingsButtons = settingsPanel?.hidden
        ? []
        : [...settingsPanel.querySelectorAll("button")];
      const focusable = [settingsTrigger, ...settingsButtons, ...partyButtons, adminLink].filter(
        (element) => element && !element.disabled && !element.hidden,
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  const rawGuest = params.get("to");
  const displayGuest = rawGuest ? rawGuest.replace(/[_+]/g, " ").trim().slice(0, 100) : "";
  const guestNode = document.getElementById("gateGuestName");

  function updateGuest() {
    if (guestNode) {
      // Guest-supplied text stays plain text, including angle brackets/quotes.
      guestNode.textContent = displayGuest;
      guestNode.hidden = !displayGuest;
    }
  }

  const makeWeddingDate = (side, targetTime, titleKey, ariaKey) => ({
    time: new Date(
      partyInfo(side).date + "T" + partyInfo(side)[targetTime] + ":00" + info.site.timezone,
    ).getTime(),
    titleKey,
    ariaKey,
  });
  const weddingDates = {
    bride: makeWeddingDate("bride", "ceremonyTime", "countdown.brideTitle", "countdown.brideAria"),
    groom: makeWeddingDate("groom", "ceremonyTime", "countdown.groomTitle", "countdown.groomAria"),
    single: makeWeddingDate(
      "single",
      "receptionTime",
      "countdown.singleTitle",
      "countdown.singleAria",
    ),
  };
  const timer = document.getElementById("timer");
  const countdownTitle = document.getElementById("countdownTitle");
  const selectedWedding =
    selectedParty || (Date.now() < weddingDates.bride.time ? "bride" : "groom");

  function ensureTimerBoxes() {
    if (!timer) return;
    const units = [
      ["days", "countdown.days"],
      ["hours", "countdown.hours"],
      ["minutes", "countdown.minutes"],
      ["seconds", "countdown.seconds"],
    ];
    if (!document.getElementById("days")) {
      timer.innerHTML = units
        .map((item) => '<div><strong id="' + item[0] + '">00</strong><small></small></div>')
        .join("");
    }
    units.forEach((item) => {
      const node = document.querySelector("#" + item[0] + " + small");
      if (node && node.textContent !== tr(item[1])) node.textContent = tr(item[1]);
    });
  }

  function countdown() {
    if (!timer) return;
    const wedding = weddingDates[selectedWedding];
    const remain = Math.max(0, wedding.time - Date.now());
    const title = tr(wedding.titleKey);
    if (countdownTitle && countdownTitle.textContent !== title) countdownTitle.textContent = title;
    const label = tr(wedding.ariaKey);
    if (timer.getAttribute("aria-label") !== label) timer.setAttribute("aria-label", label);
    if (!remain) {
      const finished = document.createElement("p");
      finished.className = "finished";
      finished.textContent = tr("countdown.finished");
      timer.replaceChildren(finished);
      return;
    }
    ensureTimerBoxes();
    const values = [
      Math.floor(remain / 86400000),
      Math.floor(remain / 3600000) % 24,
      Math.floor(remain / 60000) % 60,
      Math.floor(remain / 1000) % 60,
    ];
    ["days", "hours", "minutes", "seconds"].forEach((id, index) => {
      const node = document.getElementById(id);
      const value = String(values[index]).padStart(2, "0");
      if (node && node.textContent !== value) node.textContent = value;
    });
  }

  let countdownTimer = 0;
  function scheduleCountdown() {
    window.clearTimeout(countdownTimer);
    countdown();
    // Do not keep a 1 Hz timer alive after the event has finished.
    if (document.hidden || weddingDates[selectedWedding].time <= Date.now()) return;
    const delay = 1030 - (Date.now() % 1000);
    countdownTimer = window.setTimeout(scheduleCountdown, delay);
  }
  if (selectedParty && !linkToolInitial) scheduleCountdown();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) window.clearTimeout(countdownTimer);
    else if (selectedParty && !linkToolInitial) scheduleCountdown();
  });

  const themeColor = document.getElementById("themeColor");
  const setBrowserTheme = (color) => themeColor?.setAttribute("content", color);
  const setContentBrowserTheme = () => {
    const gateVisible = document.documentElement.classList.contains("wax-pending");
    setBrowserTheme(gateVisible ? "#0b161e" : "#0b0e0e");
  };
  setContentBrowserTheme();

  const moonlightGate = document.getElementById("moonlightGate");
  const waxOpenButton = document.getElementById("waxOpenButton");
  const reducedGateMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const updateGateVisibility = () => {
    moonlightGate?.classList.toggle("is-motion-paused", document.hidden);
  };
  document.addEventListener("visibilitychange", updateGateVisibility);
  updateGateVisibility();
  // One optional sound clip for the whole lock-to-door sequence. It starts
  // directly on the seal gesture and is independent from the gate animation.
  const introSoundUrl =
    typeof info.site?.introSound === "string" ? info.site.introSound.trim() : "";
  const introSound =
    selectedParty && !linkToolInitial && introSoundUrl ? new Audio(introSoundUrl) : null;
  if (introSound) {
    introSound.preload = "auto";
    introSound.volume = 0.75;
  }
  const playIntroSound = () => {
    if (!introSound || reducedGateMotion) return;
    try {
      introSound.currentTime = 0;
      introSound.play().catch(() => {}); // A failed SFX must not block the gate.
    } catch (_) {}
  };
  // Hold the standalone invitation after passing through the gate,
  // then crossfade the night sky and the real hero together.
  const GATE_UNLOCK_MS = 1400;
  const GATE_AWAKEN_MS = 180;
  const GATE_DOOR_MS = 2400;
  const GATE_REVEAL_BEAT_MS = 2000;
  const GATE_HANDOFF_MS = 1100;
  // CSS and the fallback timers share one clock.
  for (const [name, time] of [
    ["unlock", GATE_UNLOCK_MS],
    ["door", GATE_DOOR_MS],
    ["handoff", GATE_HANDOFF_MS],
  ]) {
    document.documentElement.style.setProperty("--gate-" + name + "-time", time + "ms");
  }
  let gateOpening = false;
  let doorSettled = false;
  const lastGateDoor = moonlightGate?.querySelector(".moonlight-gate__door--right");
  // Create a fixed, sparse arrangement only on interaction; no continuous
  // DOM allocation or canvas render loop during the cinematic intro.
  const spawnGateSparkles = () => {
    if (reducedGateMotion || !moonlightGate) return;
    const dust = moonlightGate.querySelector(".moonlight-gate__dust");
    if (!dust || dust.childElementCount) return;
    const positions = [
      [11, 19],
      [21, 32],
      [8, 49],
      [26, 69],
      [15, 80],
      [32, 13],
      [37, 40],
      [12, 62],
      [85, 18],
      [92, 36],
      [78, 54],
      [89, 70],
      [74, 81],
      [67, 23],
      [95, 59],
      [70, 11],
      [39, 77],
      [61, 74],
    ];
    const nodes = document.createDocumentFragment();
    positions
      .slice(0, matchMedia("(pointer: coarse)").matches ? 8 : 12)
      .forEach(([x, y], index) => {
        const star = document.createElement("i");
        star.className = "moonlight-gate__spark";
        star.style.setProperty("--sx", x + "%");
        star.style.setProperty("--sy", y + "%");
        star.style.setProperty("--size", (index % 5 === 0 ? 4.5 : 3) + "px");
        star.style.setProperty("--duration", 1.45 + (index % 4) * 0.32 + "s");
        star.style.setProperty("--delay", -index * 0.29 + "s");
        nodes.append(star);
      });
    dust.append(nodes);
  };

  // The trail follows the exact past positions of the moving head, not an SVG
  // rotated by a guessed angle. Works on portrait and landscape viewports.
  const meteorCanvas = moonlightGate?.querySelector(".moonlight-gate__meteor-canvas");
  let meteorFrame = 0;
  let meteorResizeObserver = null;
  const stopGateMeteors = () => {
    if (meteorFrame) cancelAnimationFrame(meteorFrame);
    meteorFrame = 0;
    resumeGateMeteors = null;
    meteorResizeObserver?.disconnect();
    meteorResizeObserver = null;
    if (meteorCanvas) {
      const ctx = meteorCanvas.getContext("2d");
      ctx?.clearRect(0, 0, meteorCanvas.width, meteorCanvas.height);
    }
  };
  let resumeGateMeteors = null;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (meteorFrame) cancelAnimationFrame(meteorFrame);
      meteorFrame = 0;
    } else if (!moonlightGate?.hidden && resumeGateMeteors && !meteorFrame) {
      meteorFrame = requestAnimationFrame(resumeGateMeteors);
    }
  });
  const startGateMeteors = () => {
    if (reducedGateMotion || !meteorCanvas) return;
    const ctx = meteorCanvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    stopGateMeteors();
    const tracks = [
      { from: [1.03, -0.23], to: [-0.31, 1.27], delay: 180, duration: 2650, strength: 1 },
      { from: [1.13, -0.25], to: [-0.22, 1.28], delay: 780, duration: 2750, strength: 0.82 },
    ];
    const start = performance.now();
    let lastPaint = -Infinity;
    let width = 0,
      height = 0,
      density = 0;
    const fit = () => {
      const rect = meteorCanvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      // Decorative trails need no high-DPI full-screen backing store.
      const d = Math.min(1, 960 / w, 960 / h);
      if (w === width && h === height && d === density) return;
      width = w;
      height = h;
      density = d;
      meteorCanvas.width = Math.round(width * density);
      meteorCanvas.height = Math.round(height * density);
      ctx.setTransform(density, 0, 0, density, 0, 0);
    };
    // Measure on size changes, never force a layout read on every canvas frame.
    fit();
    if ("ResizeObserver" in window) {
      meteorResizeObserver = new ResizeObserver(fit);
      meteorResizeObserver.observe(meteorCanvas);
    }
    const render = (timestamp) => {
      meteorFrame = 0;
      if (moonlightGate.hidden || document.hidden) return;
      // Cap canvas work at 30fps independently of 60/120Hz door animation.
      if (timestamp - lastPaint < 32) {
        meteorFrame = requestAnimationFrame(render);
        return;
      }
      lastPaint = timestamp;
      if (!meteorResizeObserver) fit();
      ctx.clearRect(0, 0, width, height);
      const elapsed = timestamp - start;
      const mobile = width <= 650;
      tracks.forEach((track, index) => {
        if (index === 1 && mobile) return;
        // Keep trails alive for the entire invitation; the gate owns their fade.
        const cycle = (elapsed - track.delay) % (track.duration + 650);
        const t = elapsed < track.delay ? -1 : cycle / track.duration;
        if (t <= 0 || t >= 1) return;
        const x0 = track.from[0] * width,
          y0 = track.from[1] * height;
        const dx = (track.to[0] - track.from[0]) * width;
        const dy = (track.to[1] - track.from[1]) * height;
        const hx = x0 + dx * t,
          hy = y0 + dy * t;
        const prev = Math.max(0, t - (mobile ? 0.19 : 0.14));
        const tx = x0 + dx * prev,
          ty = y0 + dy * prev;
        const strength = track.strength * Math.min(1, t * 12, (1 - t) * 11);

        ctx.save();
        const trail = ctx.createLinearGradient(tx, ty, hx, hy);
        trail.addColorStop(0, "rgba(232,169,103,0)");
        trail.addColorStop(0.24, "rgba(242,187,113,.10)");
        trail.addColorStop(0.6, "rgba(251,216,164,.44)");
        trail.addColorStop(0.88, "rgba(255,238,203,.85)");
        trail.addColorStop(1, "rgba(255,253,235,1)");
        ctx.strokeStyle = trail;
        ctx.lineCap = "round";
        const stroke = (size, alpha) => {
          ctx.globalAlpha = strength * alpha;
          ctx.lineWidth = size;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(hx, hy);
          ctx.stroke();
        };
        stroke(18, 0.14);
        stroke(6, 0.29);
        stroke(1.7, 0.9);

        // A few subtle fragments remain at places the star passed earlier.
        const distance = Math.hypot(dx, dy) || 1;
        const sideX = -dy / distance,
          sideY = dx / distance;
        for (let i = 0; i < (mobile ? 3 : 5); i++) {
          const age = 0.016 + i * 0.017;
          if (t <= age) continue;
          const offset = Math.sin((i + index * 11) * 8.7) * (1.8 + i * 0.45);
          const px = x0 + dx * (t - age) + sideX * offset;
          const py = y0 + dy * (t - age) + sideY * offset;
          ctx.globalAlpha = strength * Math.max(0, 0.27 - age * 1.55);
          ctx.fillStyle = i % 3 === 0 ? "#fff0cd" : "#dcb276";
          ctx.beginPath();
          ctx.arc(px, py, i % 3 === 0 ? 0.8 : 0.48, 0, Math.PI * 2);
          ctx.fill();
        }
        const halo = ctx.createRadialGradient(hx, hy, 0, hx, hy, 19);
        halo.addColorStop(0, "rgba(255,254,237,.94)");
        halo.addColorStop(0.16, "rgba(255,238,198,.63)");
        halo.addColorStop(0.48, "rgba(244,186,106,.16)");
        halo.addColorStop(1, "rgba(244,186,106,0)");
        ctx.globalAlpha = strength;
        ctx.fillStyle = halo;
        ctx.fillRect(hx - 19, hy - 19, 38, 38);
        ctx.restore();
      });
      meteorFrame = requestAnimationFrame(render);
    };
    resumeGateMeteors = render;
    meteorFrame = requestAnimationFrame(render);
  };
  const gateTimers = new Set();
  const scheduleGate = (callback, delay) => {
    const timer = window.setTimeout(() => {
      gateTimers.delete(timer);
      callback();
    }, delay);
    gateTimers.add(timer);
    return timer;
  };
  const clearGateTimers = () => {
    gateTimers.forEach((timer) => window.clearTimeout(timer));
    gateTimers.clear();
  };

  const completeMoonlightGate = () => {
    if (!moonlightGate || moonlightGate.hidden) return;
    clearGateTimers();
    stopGateMeteors();
    if (introSound) {
      introSound.pause();
      try {
        introSound.currentTime = 0;
      } catch (_) {}
    }
    lastGateDoor?.removeEventListener("animationend", onDoorAnimationEnd);
    moonlightGate.hidden = true;
    moonlightGate.classList.remove(
      "is-unlocking",
      "is-awakening",
      "is-opening",
      "is-opened",
      "is-inviting",
      "is-handoff",
      "is-leaving",
    );
    document.documentElement.classList.remove("wax-pending", "gate-hero-revealing");
    setContentBrowserTheme();
    resetInvitationScroll();
    // Defer music/hero background activity until the visual handoff is complete.
    requestAnimationFrame(() => document.dispatchEvent(new Event("wedding:waxopen")));
  };
  // Warm the exact hero asset during the existing door sequence. Decoding
  // runs asynchronously and never postpones the guest's opening gesture.
  let heroPreparation = Promise.resolve();
  let heroPrepared = false;
  const prepareHero = () => {
    if (heroPrepared) return;
    heroPrepared = true;
    const src = partyInfo(selectedParty)?.images?.hero;
    if (!src) return;
    const image = document.querySelector("img.hero-photo");
    if (!image) return;
    heroPreparation = image.decode ? image.decode().catch(() => {}) : Promise.resolve();
  };
  let handoffStarted = false;
  const finishMoonlightGate = async () => {
    if (!moonlightGate || moonlightGate.hidden) return;
    if (handoffStarted) return;
    handoffStarted = true;
    // A bounded wait avoids revealing undecoded pixels on slower phones.
    // The open sky stays visible and animated throughout this short wait.
    await Promise.race([heroPreparation, new Promise((resolve) => scheduleGate(resolve, 450))]);
    if (moonlightGate.hidden) return;
    // Set the lettering's starting pose before exposing the hero. Adding
    // its backwards-filled animation later would visibly jump down by 16px.
    if (!reducedGateMotion) document.documentElement.classList.add("cinematic-entered");
    document.documentElement.classList.add("gate-hero-revealing");
    if (reducedGateMotion) {
      completeMoonlightGate();
      return;
    }
    // Animate the cover itself, the sky/title and the underlying hero in one
    // uninterrupted handoff. Keep the cover until the final animation frame.
    moonlightGate.classList.add("is-handoff");
    scheduleGate(completeMoonlightGate, GATE_HANDOFF_MS);
  };
  const settleOpenDoor = () => {
    if (doorSettled || !moonlightGate || moonlightGate.hidden) return;
    doorSettled = true;
    lastGateDoor?.removeEventListener("animationend", onDoorAnimationEnd);
    moonlightGate.classList.add("is-opened");
    // Keep the introduction and guest name together until the shared handoff.
    scheduleGate(finishMoonlightGate, GATE_REVEAL_BEAT_MS);
  };
  function onDoorAnimationEnd(event) {
    if (event.target === lastGateDoor && event.animationName === "gateDoorOpenRight") {
      settleOpenDoor();
    }
  }
  const openFromWax = () => {
    if (!moonlightGate || !waxOpenButton || gateOpening || moonlightGate.hidden) return;
    gateOpening = true;
    prepareHero();
    waxOpenButton.disabled = true;
    playIntroSound();
    spawnGateSparkles();
    if (reducedGateMotion) {
      // Keep the invitation readable even when decorative motion is disabled.
      moonlightGate.classList.add("is-opened");
      scheduleGate(finishMoonlightGate, GATE_REVEAL_BEAT_MS);
      return;
    }

    // Warm the keyhole before opening the leaves; the portal glow follows.
    moonlightGate.classList.add("is-unlocking");
    scheduleGate(() => {
      if (moonlightGate.hidden) return;
      moonlightGate.classList.remove("is-unlocking");
      moonlightGate.classList.add("is-awakening");
      scheduleGate(() => {
        if (moonlightGate.hidden) return;
        // Match the two-stage hinge's actual CSS animation end; retain the
        // time fallback for browsers which suppress animationend.
        lastGateDoor?.addEventListener("animationend", onDoorAnimationEnd);
        moonlightGate.classList.add("is-opening");
        startGateMeteors();
        scheduleGate(settleOpenDoor, GATE_DOOR_MS + 180);
      }, GATE_AWAKEN_MS);
    }, GATE_UNLOCK_MS);
  };
  if (moonlightGate && waxOpenButton) {
    if (selectedParty && !linkToolInitial) {
      moonlightGate.hidden = false;
      waxOpenButton.disabled = false;
      waxOpenButton.addEventListener("click", openFromWax, { once: true });
      requestAnimationFrame(() => {
        waxOpenButton.focus({ preventScroll: true });
        // Leave the first gate paint free, then prepare the existing hero asset.
        scheduleGate(prepareHero, 200);
      });
    } else {
      moonlightGate.hidden = true;
    }
  }
  const musicButton = document.getElementById("musicToggle");
  const musicBubble = document.getElementById("musicBubble");
  const musicBubbleTrigger = document.getElementById("musicBubbleTrigger");
  const musicBubbleActions = document.getElementById("musicBubbleActions");
  const musicBubblePause = document.getElementById("musicBubblePause");
  const musicBubbleStop = document.getElementById("musicBubbleStop");
  // A native audio element cannot open a YouTube/native video overlay.
  // Resolve relative to the page so GitHub Pages' /wedding/ prefix is retained.
  const musicAudio = selectedParty && !linkToolInitial ? document.createElement("audio") : null;
  if (musicAudio) {
    musicAudio.id = "weddingMusic";
    // Defer the source itself, so even eager media implementations do not
    // compete with the gate and hero before the guest interacts.
    musicAudio.preload = "none";
    musicAudio.loop = true;
    musicAudio.volume = 0.7;
    musicAudio.hidden = true;
    document.body.appendChild(musicAudio);
  }
  let musicPlaying = false;
  let musicEnabled = false;
  let musicHasStarted = false;
  let musicStarting = false;
  let bubbleActionsOpen = false;
  let musicWantsPlayback = false;
  let musicPlaybackFailed = false;
  let musicRequestId = 0;
  let musicStartTimer = 0;

  const clearMusicWait = () => {
    clearTimeout(musicStartTimer);
    musicStartTimer = 0;
  };

  const failMusicAttempt = (requestId) => {
    if (!musicEnabled || requestId !== musicRequestId) return;
    ++musicRequestId;
    clearMusicWait();
    musicWantsPlayback = false;
    musicPlaying = false;
    musicStarting = false;
    musicPlaybackFailed = true;
    musicAudio?.pause();
    setMusicUI();
  };

  const monitorMusicWait = (requestId) => {
    clearMusicWait();
    musicStartTimer = setTimeout(() => failMusicAttempt(requestId), 15000);
  };

  const confirmMusicPlaying = () => {
    if (!musicEnabled || !musicWantsPlayback) {
      musicAudio?.pause();
      return;
    }
    clearMusicWait();
    musicPlaying = true;
    musicStarting = false;
    musicPlaybackFailed = false;
    musicHasStarted = true;
    setMusicUI();
  };

  const setBubbleActionsOpen = (open) => {
    bubbleActionsOpen = Boolean(open && musicHasStarted && musicBubble && !musicBubble.hidden);
    if (musicBubbleActions) musicBubbleActions.hidden = !bubbleActionsOpen;
    if (musicBubbleTrigger)
      musicBubbleTrigger.setAttribute("aria-expanded", String(bubbleActionsOpen));
    musicBubble?.classList.toggle("is-expanded", bubbleActionsOpen);
  };

  function setMusicUI() {
    const state = !musicEnabled
      ? "off"
      : musicPlaying
        ? "playing"
        : musicStarting
          ? "starting"
          : "paused";
    if (musicButton) {
      musicButton.setAttribute("aria-pressed", String(musicEnabled));
      musicButton.setAttribute(
        "aria-label",
        tr(
          !musicEnabled
            ? "music.enableAria"
            : musicPlaying
              ? "music.disableAria"
              : "music.resumeAria",
        ),
      );
      musicButton.setAttribute("title", tr("music.title"));
      const label = musicButton.querySelector(".music-label");
      if (label)
        label.textContent = tr(
          !musicEnabled
            ? "music.off"
            : musicPlaying
              ? "music.on"
              : musicStarting
                ? "music.loading"
                : musicPlaybackFailed
                  ? "music.retry"
                  : "music.paused",
        );
    }
    if (musicBubble) {
      // Play audio immediately when the seal is tapped. Display its floating
      // control only after the gate is gone so it does not cover the animation.
      musicBubble.hidden = !moonlightGate?.hidden || !musicHasStarted;
      musicBubble.dataset.musicState = state;
    }
    if (!musicEnabled) setBubbleActionsOpen(false);
    if (musicBubbleTrigger) {
      musicBubbleTrigger.setAttribute(
        "aria-label",
        tr(musicPlaying ? "music.bubblePlayingAria" : "music.bubblePausedAria"),
      );
      musicBubbleTrigger.setAttribute("title", tr("music.bubbleTitle"));
    }
    if (musicBubblePause) {
      const key = musicStarting
        ? "music.cancelAria"
        : musicPlaying
          ? "music.pauseAria"
          : "music.resumeAria";
      musicBubblePause.setAttribute("aria-label", tr(key));
      musicBubblePause.setAttribute("title", tr(key));
      // Never lock Pause while the MP3 is buffering.
      musicBubblePause.disabled = false;
    }
    if (musicBubbleStop) {
      musicBubbleStop.setAttribute("aria-label", tr("music.stopAria"));
      musicBubbleStop.setAttribute("title", tr("music.stopAria"));
    }
  }

  const stopMusic = () => {
    ++musicRequestId;
    clearMusicWait();
    musicWantsPlayback = false;
    musicPlaybackFailed = false;
    musicEnabled = false;
    musicPlaying = false;
    musicStarting = false;
    musicHasStarted = false;
    musicAudio?.pause();
    try {
      if (musicAudio) musicAudio.currentTime = 0;
    } catch (_) {}
    setBubbleActionsOpen(false);
    setMusicUI();
  };

  const requestMusicPlayback = () => {
    if (!musicAudio || musicStarting || musicPlaying) return;
    const requestId = ++musicRequestId;
    clearMusicWait();
    musicEnabled = true;
    musicWantsPlayback = true;
    musicPlaybackFailed = false;
    musicStarting = true;
    setMusicUI();
    monitorMusicWait(requestId);
    try {
      // Call play directly in the gate click, before any await/timer, to keep
      // iOS user activation. Pause/resume reuses this element and currentTime.
      // A media error remains sticky until load() selects the source again.
      // Reset only failed sources; normal resume must retain currentTime.
      if (!musicAudio.hasAttribute("src")) {
        musicAudio.src = new URL(partyInfo(selectedParty).music.src, document.baseURI).href;
      } else if (musicAudio.error) musicAudio.load();
      musicAudio.play()?.catch(() => failMusicAttempt(requestId));
    } catch (_) {
      failMusicAttempt(requestId);
    }
  };

  const pauseMusic = () => {
    if (!musicEnabled || (!musicPlaying && !musicStarting)) return;
    ++musicRequestId;
    clearMusicWait();
    musicWantsPlayback = false;
    musicPlaying = false;
    musicStarting = false;
    musicPlaybackFailed = false;
    musicAudio?.pause();
    setMusicUI();
  };

  musicAudio?.addEventListener("playing", confirmMusicPlaying);
  musicAudio?.addEventListener("waiting", () => {
    if (!musicWantsPlayback || musicStarting) return;
    musicPlaying = false;
    musicStarting = true;
    monitorMusicWait(musicRequestId);
    setMusicUI();
  });
  musicAudio?.addEventListener("pause", () => {
    // Ignore queued pause events after a newer play has already resumed.
    if (!musicAudio.paused || !musicWantsPlayback) return;
    ++musicRequestId;
    clearMusicWait();
    musicWantsPlayback = false;
    musicPlaying = false;
    musicStarting = false;
    setMusicUI();
  });
  musicAudio?.addEventListener("error", () => failMusicAttempt(musicRequestId));

  musicBubbleTrigger?.addEventListener("click", () => {
    if (musicEnabled) setBubbleActionsOpen(!bubbleActionsOpen);
  });
  musicBubblePause?.addEventListener("click", () => {
    if (musicPlaying || musicStarting) pauseMusic();
    else requestMusicPlayback();
    // Return to the single unobtrusive orb after pause or resume.
    setBubbleActionsOpen(false);
  });
  musicBubbleStop?.addEventListener("click", stopMusic);
  document.addEventListener("wedding:musicdockdrag", () => setBubbleActionsOpen(false));

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (bubbleActionsOpen && musicBubble && !musicBubble.contains(event.target))
        setBubbleActionsOpen(false);
    },
    true,
  );
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && bubbleActionsOpen) {
      setBubbleActionsOpen(false);
      musicBubbleTrigger?.focus({ preventScroll: true });
    }
  });

  // Bind playback to the opening gesture; no iframe/API dependency is needed.
  if (musicAudio) {
    waxOpenButton?.addEventListener("click", requestMusicPlayback, { once: true });
    document.addEventListener("wedding:waxopen", setMusicUI, { once: true });
  }

  // Settings is the entry point for activating music. The contextual bubble
  // handles Pause/Resume and Stop without adding another permanently visible button.
  musicButton?.addEventListener("click", () => {
    if (musicEnabled && (musicPlaying || musicStarting)) stopMusic();
    else requestMusicPlayback();
  });

  function applyPartyDomOrder() {
    if (!selectedParty) return;
    const brideFirst = selectedParty === "bride";

    const couple = document.querySelector(".couple-editorial");
    const bride = couple?.querySelector(".person-bride");
    const groom = couple?.querySelector(".person-groom");
    const divider = couple?.querySelector(".couple-divider");
    if (couple && bride && groom && divider) {
      couple.append(...(brideFirst ? [bride, divider, groom] : [groom, divider, bride]));
    }

    const family = document.querySelector(".family-grid");
    const brideFamily = family?.querySelector(".family-bride");
    const groomFamily = family?.querySelector(".family-groom");
    if (family && brideFamily && groomFamily) {
      family.append(...(brideFirst ? [brideFamily, groomFamily] : [groomFamily, brideFamily]));
    }
  }

  applyPartyDomOrder();

  function renderPartyNameOrder() {
    if (!selectedParty) return;

    const brideFirst = selectedParty === "bride";
    const bride = info.couple.bride;
    const groom = info.couple.groom;
    const first = brideFirst ? bride : groom;
    const second = brideFirst ? groom : bride;

    const upper = (name) => name.toLocaleUpperCase("vi-VN");
    const escapeHtml = (value) =>
      String(value).replace(
        /[&<>"']/g,
        (character) =>
          ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
      );
    // A person's display name is one typographic unit in EVERY pair.
    // Keep the separator breakable so narrow screens wrap between people.
    const wholeName = (value) => escapeHtml(value).replace(/\s+/g, "&nbsp;");
    const pair = (left, right, separator) =>
      wholeName(left) + " <span>" + separator + "</span> " + wholeName(right);

    const pairs = {
      hero: pair(upper(first.short), upper(second.short), "&amp;"),
      gate: pair(first.short, second.short, "&amp;"),
      closing:
        '<span class="closing-name">' +
        escapeHtml(first.short) +
        '</span><span class="closing-join">&amp;</span><span class="closing-name">' +
        escapeHtml(second.short) +
        "</span>",
      footer:
        "© " +
        new Date(partyInfo(selectedParty).date + "T00:00:00Z").getUTCFullYear() +
        " " +
        pair(upper(first.short), upper(second.short), "&amp;"),
      menu: pair(upper(first.short), upper(second.short), "♡"),
    };

    document.querySelectorAll("[data-party-name-pair]").forEach((node) => {
      const key = node.dataset.partyNamePair;
      if (pairs[key]) node.innerHTML = pairs[key];
    });

    const monogram = document.getElementById("heroMonogram");
    const crest =
      '<span class="crest-first">' +
      escapeHtml(first.initial) +
      '</span><span class="crest-join">&amp;</span><span class="crest-second">' +
      escapeHtml(second.initial) +
      "</span>";
    if (monogram) {
      monogram.classList.add("wedding-crest");
      monogram.innerHTML = crest;
      monogram.setAttribute("aria-label", first.short + " & " + second.short);
    }
    document.querySelectorAll("[data-wedding-crest]").forEach((node) => {
      node.innerHTML = crest;
    });
    const promise = document.getElementById("invitationPromise");
    if (promise)
      promise.textContent = tr(
        selectedParty === "bride"
          ? "invitation.promiseBride"
          : selectedParty === "groom"
            ? "invitation.promiseGroom"
            : "invitation.promiseSingle",
      );
    // The wax seal is a shared antique lock for both ceremonies. The couple's
    // initials remain in the hero and other personalized locations.
  }

  function refreshPartyLabels() {
    if (!selectedParty) return;

    const ceremonyLabel = document.getElementById("heroCeremonyLabel");
    if (ceremonyLabel) {
      const key =
        selectedParty === "single"
          ? "hero.singleOverline"
          : selectedParty === "bride"
            ? "hero.brideOverline"
            : "hero.groomOverline";
      ceremonyLabel.textContent = tr(key);
    }

    const brideFirst = selectedParty === "bride";
    const coupleHeading = document.getElementById("coupleHeading");
    if (coupleHeading) {
      coupleHeading.innerHTML = tr(
        singleMode
          ? "couple.headingSingle"
          : brideFirst
            ? "couple.headingBrideFirst"
            : "couple.headingGroomFirst",
      );
    }

    const menuCoupleLabel = document.getElementById("menuCoupleLabel");
    if (menuCoupleLabel) {
      menuCoupleLabel.textContent = tr(
        singleMode
          ? "menu.singleCouple"
          : brideFirst
            ? "menu.coupleBrideFirst"
            : "menu.coupleGroomFirst",
      );
    }

    document.title = tr(
      singleMode ? "page.titleSingle" : brideFirst ? "page.titleBride" : "page.titleGroom",
    );
  }

  function refreshDynamicLanguage() {
    updateGuest();
    renderPartyNameOrder();
    refreshPartyLabels();
    countdown();
    setMusicUI();
  }
  document.addEventListener("wedding:languagechange", refreshDynamicLanguage);
  refreshDynamicLanguage();

  const progress = document.getElementById("progress");
  let scrollFrame = 0;
  addEventListener(
    "scroll",
    () => {
      if (scrollFrame || !progress) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        const max = document.documentElement.scrollHeight - innerHeight;
        const ratio = max ? Math.min(1, Math.max(0, scrollY / max)) : 0;
        progress.style.transform = "scaleX(" + ratio + ")";
      });
    },
    { passive: true },
  );

  const hero = document.querySelector(".hero");
  const heroPhoto = document.querySelector(".hero-photo");
  if (hero && heroPhoto && "IntersectionObserver" in window) {
    let heroInViewport = false;
    const updateHeroMotion = () => {
      const visible =
        heroInViewport &&
        !document.hidden &&
        !document.documentElement.classList.contains("wax-pending");
      heroPhoto.style.animationPlayState = visible ? "running" : "paused";
      heroPhoto.style.willChange = visible ? "transform" : "auto";
    };
    const heroAnimationObserver = new IntersectionObserver(
      (entries) => {
        heroInViewport = entries[0]?.isIntersecting !== false;
        updateHeroMotion();
      },
      { threshold: 0 },
    );
    heroAnimationObserver.observe(hero);
    document.addEventListener("wedding:waxopen", updateHeroMotion);
    document.addEventListener("visibilitychange", updateHeroMotion);
    updateHeroMotion();
  }

  const reveal = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.1, rootMargin: "80px 0px" },
    );
    reveal.forEach((node) => observer.observe(node));
  } else {
    reveal.forEach((node) => node.classList.add("visible"));
  }

  // Cinematic chapter transitions are progressive enhancement. Content stays
  // readable without IntersectionObserver and for reduced-motion visitors.
  const reducedCinematicMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const chapterTargets = document.querySelectorAll(
    ".section-head, .album-header, .couple-section > .overline, " +
      ".couple-section > .section-title, .couple-section > .section-lead, .closing-content",
  );
  if (!reducedCinematicMotion && "IntersectionObserver" in window) {
    const chapterObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          chapterObserver.unobserve(entry.target);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -5% 0px" },
    );
    chapterTargets.forEach((node, index) => {
      node.classList.add("cinematic-reveal");
      node.style.setProperty("--cinematic-order", String(index % 3));
      chapterObserver.observe(node);
    });
    document.documentElement.classList.add("cinematic-ready");
  }

  const enterCinematicHero = () => document.documentElement.classList.add("cinematic-entered");
  document.addEventListener("wedding:waxopen", enterCinematicHero, { once: true });
  if (!document.documentElement.classList.contains("wax-pending")) enterCinematicHero();
})();
