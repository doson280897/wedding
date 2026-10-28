(() => {
  "use strict";
  const i18n = window.WeddingI18n;
  const tr = key => i18n ? i18n.t(key) : key;
  const info = window.WEDDING_INFO;
  const partyInfo = side => info.parties[side];
  const params = new URLSearchParams(window.location.search);
  const partyParam = params.get("party");
  const singleMode = info.wedding?.mode === "single";
  const linkToolInitial = params.get("tool") === "links";
  // In a single-reception wedding, old ?party=bride/groom links remain usable
  // but always resolve to the only celebration rather than a party selector.
  const selectedParty = singleMode
    ? "single"
    : (partyParam === "bride" || partyParam === "groom" ? partyParam : null);
  document.documentElement.dataset.weddingMode = singleMode ? "single" : "double";
  const partySelector = document.getElementById("partySelector");
  // Language buttons are owned by i18n.js; no duplicate click handlers here.

  // Keep the invitation anchored to the top while the entrance gate is active.
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  const resetInvitationScroll = () => window.scrollTo({ top:0, left:0, behavior:"instant" });
  resetInvitationScroll();
  window.addEventListener("pageshow", resetInvitationScroll);


  if (selectedParty) {
    document.documentElement.dataset.party = selectedParty;
    document.documentElement.classList.remove("party-pending");
  } else {
    document.documentElement.classList.add("party-pending");
    const partyButtons = Array.from(document.querySelectorAll("[data-party-select]"));
    requestAnimationFrame(() => {
      if (!document.documentElement.classList.contains("link-tool-active")) {
        partyButtons[0]?.focus({preventScroll:true});
      }
    });

    partyButtons.forEach(button => button.addEventListener("click", () => {
      const side = button.dataset.partySelect;
      if (side !== "bride" && side !== "groom") return;
      const url = new URL(window.location.href);
      url.searchParams.set("party", side);
      url.hash = "";
      // Switch to the selected invitation within the same history entry.
      // This preserves this tab's theme/language through the page reload;
      // a new tab follows the OS theme (fallback Dark).
      try {
        history.replaceState(history.state, "", url.href);
        window.location.reload();
      } catch (_) {
        window.location.replace(url.href);
      }
    }));

    document.addEventListener("keydown", event => {
      if (!document.documentElement.classList.contains("party-pending") || document.documentElement.classList.contains("link-tool-active") || event.key !== "Tab") return;
      const adminLink = document.querySelector(".party-admin-link");
      const settingsTrigger = document.getElementById("settingsTrigger");
      const settingsPanel = document.getElementById("settingsPanel");
      const settingsButtons = settingsPanel?.hidden ? [] : [...settingsPanel.querySelectorAll("button")];
      const focusable = [settingsTrigger, ...settingsButtons, ...partyButtons, adminLink]
        .filter(element => element && !element.disabled && !element.hidden);
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
  const guestNode = document.getElementById("guestName");
  const heroGuestLabel = document.getElementById("heroGuestLabel");

  function updateGuest() {
    const named = Boolean(displayGuest);
    const label = tr("guest.recipientLabel");
    const heroKey = selectedParty === "single" ? "guest.heroSingle" :
      selectedParty === "bride" ? "guest.heroBride" : "guest.heroGroom";
    const heroTemplate = tr(heroKey);
    // Only personalized invitations use the two-line typographic treatment.
    // Unnamed links keep the original generic invitation message.
    if (heroGuestLabel) heroGuestLabel.textContent = named
      ? label : heroTemplate.replace("{guest}", tr("guest.default"));
    if (guestNode) {
      guestNode.textContent = named ? displayGuest : "";
      guestNode.hidden = !named;
    }
  }

  const makeWeddingDate = (side, targetTime, titleKey, ariaKey) => ({
    time: new Date(
      partyInfo(side).date + "T" + partyInfo(side)[targetTime] + ":00" + info.site.timezone
    ).getTime(),
    titleKey,
    ariaKey
  });
  const weddingDates = {
    bride: makeWeddingDate("bride","ceremonyTime","countdown.brideTitle","countdown.brideAria"),
    groom: makeWeddingDate("groom","ceremonyTime","countdown.groomTitle","countdown.groomAria"),
    single: makeWeddingDate("single","receptionTime","countdown.singleTitle","countdown.singleAria")
  };
  const timer = document.getElementById("timer");
  const countdownTitle = document.getElementById("countdownTitle");
  const selectedWedding = selectedParty ||
    (Date.now() < weddingDates.bride.time ? "bride" : "groom");

  function ensureTimerBoxes() {
    if (!timer) return;
    const units = [
      ["days","countdown.days"],
      ["hours","countdown.hours"],
      ["minutes","countdown.minutes"],
      ["seconds","countdown.seconds"]
    ];
    if (!document.getElementById("days")) {
      timer.innerHTML = units.map(item => '<div><strong id="' + item[0] + '">00</strong><small></small></div>').join("");
    }
    units.forEach(item => {
      const node = document.querySelector("#" + item[0] + " + small");
      if (node) node.textContent = tr(item[1]);
    });
  }

  function countdown() {
    if (!timer) return;
    const wedding = weddingDates[selectedWedding];
    const remain = Math.max(0, wedding.time - Date.now());
    if (countdownTitle) countdownTitle.textContent = tr(wedding.titleKey);
    timer.setAttribute("aria-label", tr(wedding.ariaKey));
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
      Math.floor(remain / 1000) % 60
    ];
    ["days","hours","minutes","seconds"].forEach((id,index) => {
      const node = document.getElementById(id);
      if (node) node.textContent = String(values[index]).padStart(2,"0");
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

  const toCalendarUTC = (side, time) => new Date(
    partyInfo(side).date + "T" + time + ":00" + info.site.timezone
  ).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

  function buildSchedule(side) {
    const details = partyInfo(side);
    if (side === "single") {
      return {
        filename: tr("calendar.singleFile"),
        events: [{
          title:tr("calendar.singleReceptionTitle"),
          start:toCalendarUTC("single",details.receptionTime),
          end:toCalendarUTC("single",details.receptionEnd),
          place:tr("calendar.singleReceptionPlace"),
          note:tr("calendar.singleReceptionNote")
        }]
      };
    }
    const ceremonyPlace = side === "bride" ? "calendar.brideCeremonyPlace" : "calendar.groomPlace";
    const receptionPlace = side === "bride" ? "calendar.brideReceptionPlace" : "calendar.groomPlace";
    return {
      filename: tr("calendar." + side + "File"),
      events: [
        {
          title:tr("calendar." + side + "CeremonyTitle"),
          start:toCalendarUTC(side, details.ceremonyTime),
          end:toCalendarUTC(side, details.ceremonyEnd),
          place:tr(ceremonyPlace),
          note:tr("calendar." + side + "CeremonyNote")
        },
        {
          title:tr("calendar." + side + "ReceptionTitle"),
          start:toCalendarUTC(side, details.receptionTime),
          end:toCalendarUTC(side, details.receptionEnd),
          place:tr(receptionPlace),
          note:tr("calendar." + side + "ReceptionNote")
        }
      ]
    };
  }

  const escapeICS = value => value.replace(/\\/g,"\\\\").replace(/\r?\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;");
  document.querySelectorAll("[data-calendar]").forEach(button => {
    button.addEventListener("click", () => {
      const schedule = buildSchedule(button.dataset.calendar);
      const timestamp = new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
      const body = schedule.events.map((event,index) => [
        "BEGIN:VEVENT",
        "UID:" + button.dataset.calendar + "-" + index + "-" + partyInfo(button.dataset.calendar).date + "@" + new URL(info.site.url).hostname,
        "DTSTAMP:" + timestamp,
        "DTSTART:" + event.start,
        "DTEND:" + event.end,
        "SUMMARY:" + escapeICS(event.title),
        "DESCRIPTION:" + escapeICS(event.note + " (" + tr("calendar.timezone") + ")"),
        "LOCATION:" + escapeICS(event.place),
        "END:VEVENT"
      ].join("\r\n")).join("\r\n");
      const calendar = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//" + new URL(info.site.url).hostname + "//Wedding Invitation//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH",body,"END:VCALENDAR"].join("\r\n") + "\r\n";
      const url = URL.createObjectURL(new Blob([calendar], {type:"text/calendar;charset=utf-8"}));
      const link = document.createElement("a");
      link.href = url;
      link.download = schedule.filename;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
  });

  const themeColor = document.getElementById("themeColor");
  const setBrowserTheme = color => themeColor?.setAttribute("content", color);
  const setContentBrowserTheme = () => {
    const isLight = document.documentElement.dataset.theme === "light";
    const gateVisible = document.documentElement.classList.contains("wax-pending");
    setBrowserTheme(gateVisible
      ? (isLight ? "#e4ddd0" : "#0b161e")
      : (isLight ? "#f5f0e6" : "#0b0e0e"));
  };
  document.addEventListener("wedding:themechange", setContentBrowserTheme);
  setContentBrowserTheme();

  const moonlightGate = document.getElementById("moonlightGate");
  const waxOpenButton = document.getElementById("waxOpenButton");
  const reducedGateMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // One optional sound clip for the whole lock-to-door sequence. It starts
  // directly on the seal gesture and is independent from the YouTube iframe.
  const introSoundUrl = typeof info.site?.introSound === "string" ? info.site.introSound.trim() : "";
  const introSound = selectedParty && !linkToolInitial && introSoundUrl
    ? new Audio(introSoundUrl) : null;
  if (introSound) {
    introSound.preload = "auto";
    introSound.volume = .75;
  }
  const playIntroSound = () => {
    if (!introSound || reducedGateMotion) return;
    try {
      introSound.currentTime = 0;
      introSound.play().catch(() => {}); // A failed SFX must not block the gate.
    } catch (_) {}
  };
  // Enjoy the names and full-screen shooting stars after the doors settle,
  // then crossfade the night sky and the real hero together.
  const GATE_UNLOCK_MS = 1600;
  const GATE_AWAKEN_MS = 240;
  const GATE_DOOR_MS = 3200;
  const GATE_REVEAL_BEAT_MS = 2200;
  const GATE_HANDOFF_MS = 1350;
  let gateOpening = false;
  let doorSettled = false;
  const leftGateDoor = moonlightGate?.querySelector(".moonlight-gate__door--left");
  // Create a fixed, sparse arrangement only on interaction; no continuous
  // DOM allocation or canvas render loop during the cinematic intro.
  const spawnGateSparkles = () => {
    if (reducedGateMotion || !moonlightGate) return;
    const dust = moonlightGate.querySelector(".moonlight-gate__dust");
    if (!dust || dust.childElementCount) return;
    const positions = [
      [11,19],[21,32],[8,49],[26,69],[15,80],[32,13],
      [37,40],[12,62],[85,18],[92,36],[78,54],[89,70],
      [74,81],[67,23],[95,59],[70,11],[39,77],[61,74]
    ];
    const nodes = document.createDocumentFragment();
    positions.forEach(([x,y],index) => {
      const star = document.createElement("i");
      star.className = "moonlight-gate__spark";
      star.style.setProperty("--sx", x + "%");
      star.style.setProperty("--sy", y + "%");
      star.style.setProperty("--size", (index % 5 === 0 ? 4.5 : 3) + "px");
      star.style.setProperty("--duration", (1.45 + index % 4 * .32) + "s");
      star.style.setProperty("--delay", (-index * .29) + "s");
      nodes.append(star);
    });
    dust.append(nodes);
  };

  // The trail follows the exact past positions of the moving head, not an SVG
  // rotated by a guessed angle. Works on portrait and landscape viewports.
  const meteorCanvas = moonlightGate?.querySelector(".moonlight-gate__meteor-canvas");
  let meteorFrame = 0;
  const stopGateMeteors = () => {
    if (meteorFrame) cancelAnimationFrame(meteorFrame);
    meteorFrame = 0;
    if (meteorCanvas) {
      const ctx = meteorCanvas.getContext("2d");
      ctx?.clearRect(0, 0, meteorCanvas.width, meteorCanvas.height);
    }
  };
  const startGateMeteors = () => {
    if (reducedGateMotion || !meteorCanvas) return;
    const ctx = meteorCanvas.getContext("2d", { alpha:true });
    if (!ctx) return;
    stopGateMeteors();
    const tracks = [
      { from:[1.03,-.23], to:[-.31,1.27], delay:450, duration:3500, strength:1 },
      { from:[1.13,-.25], to:[-.22,1.28], delay:1350, duration:3650, strength:.82 }
    ];
    const start = performance.now();
    let width = 0, height = 0, density = 0;
    const fit = () => {
      const rect = meteorCanvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      const d = Math.min(window.devicePixelRatio || 1, 1.5);
      if (w === width && h === height && d === density) return;
      width = w; height = h; density = d;
      meteorCanvas.width = Math.round(width * density);
      meteorCanvas.height = Math.round(height * density);
      ctx.setTransform(density, 0, 0, density, 0, 0);
    };
    const render = timestamp => {
      meteorFrame = 0;
      if (moonlightGate.hidden) return;
      fit();
      ctx.clearRect(0, 0, width, height);
      const elapsed = timestamp - start;
      const mobile = width <= 650;
      tracks.forEach((track, index) => {
        if (index === 1 && mobile) return;
        const t = (elapsed - track.delay) / track.duration;
        if (t <= 0 || t >= 1) return;
        const x0 = track.from[0] * width, y0 = track.from[1] * height;
        const dx = (track.to[0] - track.from[0]) * width;
        const dy = (track.to[1] - track.from[1]) * height;
        const hx = x0 + dx * t, hy = y0 + dy * t;
        const prev = Math.max(0, t - (mobile ? .19 : .14));
        const tx = x0 + dx * prev, ty = y0 + dy * prev;
        const strength = track.strength * Math.min(1, t * 12, (1 - t) * 11);

        ctx.save();
        const trail = ctx.createLinearGradient(tx, ty, hx, hy);
        trail.addColorStop(0, "rgba(232,169,103,0)");
        trail.addColorStop(.24, "rgba(242,187,113,.10)");
        trail.addColorStop(.60, "rgba(251,216,164,.44)");
        trail.addColorStop(.88, "rgba(255,238,203,.85)");
        trail.addColorStop(1, "rgba(255,253,235,1)");
        ctx.strokeStyle = trail;
        ctx.lineCap = "round";
        const stroke = (size, alpha) => {
          ctx.globalAlpha = strength * alpha;
          ctx.lineWidth = size;
          ctx.beginPath();
          ctx.moveTo(tx,ty);
          ctx.lineTo(hx,hy);
          ctx.stroke();
        };
        stroke(18,.14);
        stroke(6,.29);
        stroke(1.7,.90);

        // A few subtle fragments remain at places the star passed earlier.
        const distance = Math.hypot(dx,dy) || 1;
        const sideX = -dy / distance, sideY = dx / distance;
        for (let i = 0; i < 8; i++) {
          const age = .016 + i * .017;
          if (t <= age) continue;
          const offset = Math.sin((i + index * 11) * 8.7) * (1.8 + i * .45);
          const px = x0 + dx * (t - age) + sideX * offset;
          const py = y0 + dy * (t - age) + sideY * offset;
          ctx.globalAlpha = strength * Math.max(0, .27 - age * 1.55);
          ctx.fillStyle = i % 3 === 0 ? "#fff0cd" : "#dcb276";
          ctx.beginPath();
          ctx.arc(px, py, i % 3 === 0 ? .8 : .48, 0, Math.PI * 2);
          ctx.fill();
        }
        const halo = ctx.createRadialGradient(hx, hy, 0, hx, hy, 19);
        halo.addColorStop(0, "rgba(255,254,237,.94)");
        halo.addColorStop(.16, "rgba(255,238,198,.63)");
        halo.addColorStop(.48, "rgba(244,186,106,.16)");
        halo.addColorStop(1, "rgba(244,186,106,0)");
        ctx.globalAlpha = strength;
        ctx.fillStyle = halo;
        ctx.fillRect(hx - 19, hy - 19, 38, 38);
        ctx.restore();
      });
      if (elapsed < 5150) meteorFrame = requestAnimationFrame(render);
    };
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
    gateTimers.forEach(timer => window.clearTimeout(timer));
    gateTimers.clear();
  };

  const completeMoonlightGate = () => {
    if (!moonlightGate || moonlightGate.hidden) return;
    clearGateTimers();
    stopGateMeteors();
    if (introSound) {
      introSound.pause();
      try { introSound.currentTime = 0; } catch (_) {}
    }
    leftGateDoor?.removeEventListener("animationend", onDoorAnimationEnd);
    moonlightGate.hidden = true;
    moonlightGate.classList.remove(
      "is-unlocking", "is-awakening", "is-opening", "is-opened", "is-handoff", "is-leaving"
    );
    document.documentElement.classList.remove("wax-pending", "gate-hero-revealing");
    setContentBrowserTheme();
    resetInvitationScroll();
    // Defer music/hero background activity until the visual handoff is complete.
    requestAnimationFrame(() => document.dispatchEvent(new Event("wedding:waxopen")));
  };
  const finishMoonlightGate = () => {
    if (!moonlightGate || moonlightGate.hidden) return;
    document.documentElement.classList.add("gate-hero-revealing", "cinematic-entered");
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
    leftGateDoor?.removeEventListener("animationend", onDoorAnimationEnd);
    moonlightGate.classList.add("is-opened");
    // Hold the opened sky until both shooting stars travel off-screen.
    scheduleGate(finishMoonlightGate, GATE_REVEAL_BEAT_MS);
  };
  function onDoorAnimationEnd(event) {
    if (event.target === leftGateDoor && event.animationName === "gateDoorOpenLeft") {
      settleOpenDoor();
    }
  }
  const openFromWax = () => {
    if (!moonlightGate || !waxOpenButton || gateOpening || moonlightGate.hidden) return;
    gateOpening = true;
    waxOpenButton.disabled = true;
    playIntroSound();
    spawnGateSparkles();
    if (reducedGateMotion) {
      finishMoonlightGate();
      return;
    }

    // Only open the wings after the key has entered, turned, and freed the
    // shackle. The portal glow begins in the short beat after unlocking.
    moonlightGate.classList.add("is-unlocking");
    scheduleGate(() => {
      if (moonlightGate.hidden) return;
      moonlightGate.classList.remove("is-unlocking");
      moonlightGate.classList.add("is-awakening");
      scheduleGate(() => {
        if (moonlightGate.hidden) return;
        // Match the two-stage hinge's actual CSS animation end; retain the
        // time fallback for browsers which suppress animationend.
        leftGateDoor?.addEventListener("animationend", onDoorAnimationEnd);
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
      waxOpenButton.addEventListener("click", openFromWax, { once:true });
      requestAnimationFrame(() => waxOpenButton.focus({ preventScroll:true }));
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
  const YOUTUBE_MUSIC_ID = partyInfo(selectedParty || "groom").music.youtubeId;
  let youtubePlayer = null;
  let youtubePlayerReady = false;
  let youtubePlayerPromise = null;
  let musicPlaying = false;
  let musicEnabled = false;
  let musicHasStarted = false;
  let musicPausePosition = 0;
  let musicResumePending = false;
  let musicStarting = false;
  let bubbleActionsOpen = false;
  let musicWantsPlayback = false;
  let musicPlaybackFailed = false;
  let musicRequestId = 0;
  let musicStartTimer = 0;
  let musicStatePoll = 0;

  const clearMusicWait = () => {
    clearTimeout(musicStartTimer);
    clearInterval(musicStatePoll);
    musicStartTimer = 0;
    musicStatePoll = 0;
  };

  // PLAYING is confirmed by YouTube's event or getPlayerState(), never by
  // merely showing the bubble. The watchdog prevents endless "Loading".
  const confirmMusicPlaying = () => {
    if (!musicEnabled || !musicWantsPlayback) return;
    clearMusicWait();
    musicPlaying = true;
    musicStarting = false;
    musicPlaybackFailed = false;
    musicHasStarted = true;
    if (musicResumePending && musicPausePosition > 1) {
      musicResumePending = false;
      try {
        const now = youtubePlayer?.getCurrentTime?.();
        if (Number.isFinite(now) && now < musicPausePosition - 2) {
          youtubePlayer?.seekTo?.(musicPausePosition, true);
        }
      } catch (_) {}
    } else {
      musicResumePending = false;
    }
    setMusicUI();
  };

  const failMusicAttempt = requestId => {
    if (!musicEnabled || requestId !== musicRequestId) return;
    ++musicRequestId;
    clearMusicWait();
    musicWantsPlayback = false;
    musicPlaying = false;
    musicStarting = false;
    musicPlaybackFailed = true;
    setMusicUI();
    // If a delayed play command eventually takes effect, silence it.
    try { if (youtubePlayerReady) youtubePlayer?.pauseVideo(); } catch (_) {}
  };

  const setBubbleActionsOpen = open => {
    bubbleActionsOpen = Boolean(open && musicHasStarted && musicBubble && !musicBubble.hidden);
    if (musicBubbleActions) musicBubbleActions.hidden = !bubbleActionsOpen;
    if (musicBubbleTrigger) musicBubbleTrigger.setAttribute("aria-expanded", String(bubbleActionsOpen));
    musicBubble?.classList.toggle("is-expanded", bubbleActionsOpen);
  };

  function setMusicUI() {
    const state = !musicEnabled ? "off" : musicPlaying ? "playing" : musicStarting ? "starting" : "paused";
    if (musicButton) {
      musicButton.setAttribute("aria-pressed", String(musicEnabled));
      musicButton.setAttribute("aria-label", tr(
        !musicEnabled ? "music.enableAria" :
        musicPlaying ? "music.disableAria" : "music.resumeAria"
      ));
      musicButton.setAttribute("title", tr("music.title"));
      const label = musicButton.querySelector(".music-label");
      if (label) label.textContent = tr(
        !musicEnabled ? "music.off" : musicPlaying ? "music.on" :
        musicStarting ? "music.loading" :
        musicPlaybackFailed ? "music.retry" : "music.paused"
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
      musicBubbleTrigger.setAttribute("aria-label", tr(musicPlaying ? "music.bubblePlayingAria" : "music.bubblePausedAria"));
      musicBubbleTrigger.setAttribute("title", tr("music.bubbleTitle"));
    }
    if (musicBubblePause) {
      const key = musicStarting ? "music.cancelAria" :
        musicPlaying ? "music.pauseAria" : "music.resumeAria";
      musicBubblePause.setAttribute("aria-label", tr(key));
      musicBubblePause.setAttribute("title", tr(key));
      // Never lock Pause while YouTube is buffering or API-ready is pending.
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
    musicPausePosition = 0;
    musicResumePending = false;
    setBubbleActionsOpen(false);
    setMusicUI();
    try {
      if (youtubePlayerReady && youtubePlayer) {
        if (typeof youtubePlayer.stopVideo === "function") youtubePlayer.stopVideo();
        else youtubePlayer.pauseVideo();
      }
    } catch (_) {}
  };

  const requestMusicPlayback = () => {
    if (!selectedParty || musicStarting || musicPlaying) return;
    const requestId = ++musicRequestId;
    clearMusicWait();
    musicEnabled = true;
    musicWantsPlayback = true;
    musicPlaybackFailed = false;
    musicStarting = true;
    musicResumePending = musicHasStarted && musicPausePosition > 1;
    setMusicUI();

    musicStartTimer = setTimeout(() => {
      // Some mobile browsers block YouTube playback without sending PLAYING.
      // Switch to a retryable paused orb instead of spinning indefinitely.
      failMusicAttempt(requestId);
    }, 10000);

    musicStatePoll = setInterval(() => {
      if (!musicEnabled || !musicWantsPlayback || requestId !== musicRequestId) {
        clearMusicWait();
        return;
      }
      try {
        if (youtubePlayerReady &&
            typeof youtubePlayer?.getPlayerState === "function" &&
            youtubePlayer.getPlayerState() === window.YT?.PlayerState?.PLAYING) {
          confirmMusicPlaying();
        }
      } catch (_) {}
    }, 600);

    const play = player => {
      if (!musicEnabled || !musicWantsPlayback || requestId !== musicRequestId) return;
      try {
        if (musicResumePending && musicPausePosition > 1 &&
            typeof player.getCurrentTime === "function" &&
            typeof player.seekTo === "function") {
          const current = player.getCurrentTime();
          if (Number.isFinite(current) && current < musicPausePosition - 2) {
            player.seekTo(musicPausePosition, true);
          }
        }
        // This is called synchronously from the seal's tap if YouTube is
        // already ready, preserving mobile browsers' user activation.
        player.unMute?.();
        player.setVolume?.(70);
        player.playVideo(); // Keep the same iframe and playback position.
      } catch (_) { failMusicAttempt(requestId); }
    };
    if (youtubePlayerReady && youtubePlayer) {
      play(youtubePlayer);
    } else {
      initYouTubeMusicPlayer().then(play).catch(() => failMusicAttempt(requestId));
    }
  };

  const pauseMusic = () => {
    if (!musicEnabled || (!musicPlaying && !musicStarting)) return;
    ++musicRequestId; // Cancel even if the YouTube iframe isn't ready yet.
    clearMusicWait();
    musicWantsPlayback = false;
    musicPlaying = false;
    musicStarting = false;
    musicPlaybackFailed = false;
    try {
      const current = youtubePlayerReady ? youtubePlayer?.getCurrentTime?.() : undefined;
      if (Number.isFinite(current) && current > 0) musicPausePosition = current;
    } catch (_) {}
    musicResumePending = false;
    setMusicUI();
    try {
      if (youtubePlayerReady && youtubePlayer) youtubePlayer.pauseVideo();
    } catch (_) {}
  };

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

  document.addEventListener("pointerdown", event => {
    if (bubbleActionsOpen && musicBubble && !musicBubble.contains(event.target)) setBubbleActionsOpen(false);
  }, true);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && bubbleActionsOpen) {
      setBubbleActionsOpen(false);
      musicBubbleTrigger?.focus({ preventScroll:true });
    }
  });

  function loadYouTubeIframeAPI() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (window.__weddingYouTubeApiPromise) return window.__weddingYouTubeApiPromise;

    window.__weddingYouTubeApiPromise = new Promise((resolve, reject) => {
      const previousReady = window.onYouTubeIframeAPIReady;
      let finished = false;
      let script = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      const complete = error => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        if (error) {
          window.onYouTubeIframeAPIReady = previousReady;
          script?.remove(); // A later tap can retry instead of hanging forever.
          reject(error);
        } else {
          resolve(window.YT);
        }
      };

      const timeout = setTimeout(() => complete(new Error("YouTube API timeout")), 12000);
      window.onYouTubeIframeAPIReady = () => {
        try { previousReady?.(); } catch (_) {}
        if (window.YT?.Player) complete();
        else complete(new Error("YouTube API loaded without Player"));
      };

      if (script) {
        script.addEventListener("error", () =>
          complete(new Error("YouTube IFrame API failed to load")), { once:true });
        return;
      }

      script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => complete(new Error("YouTube IFrame API failed to load"));
      document.head.appendChild(script);
    });

    window.__weddingYouTubeApiPromise.catch(() => {
      window.__weddingYouTubeApiPromise = null;
    });
    return window.__weddingYouTubeApiPromise;
  }

  function initYouTubeMusicPlayer() {
    if (youtubePlayerPromise) return youtubePlayerPromise;

    youtubePlayerPromise = loadYouTubeIframeAPI().then(() => new Promise((resolve, reject) => {
      let readySettled = false;
      const readyTimeout = setTimeout(() => {
        if (readySettled) return;
        readySettled = true;
        youtubePlayerReady = false;
        try { youtubePlayer?.destroy?.(); } catch (_) {}
        youtubePlayer = null;
        reject(new Error("YouTube player readiness timeout"));
      }, 12000);

      let host = document.getElementById("youtubeWeddingMusic");
      if (!host) {
        host = document.createElement("div");
        host.id = "youtubeWeddingMusic";
        host.setAttribute("aria-hidden", "true");
        host.style.cssText =
          "position:fixed;width:200px;height:200px;left:-9999px;bottom:0;opacity:.01;pointer-events:none;overflow:hidden;";
        document.body.appendChild(host);
      }

      youtubePlayer = new window.YT.Player(host, {
        // YouTube requires a player iframe of at least 200px; a 2×2 iframe
        // can fail to initialize or report state on mobile Safari.
        width: "200",
        height: "200",
        videoId: YOUTUBE_MUSIC_ID,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          loop: 1,
          playlist: YOUTUBE_MUSIC_ID,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin
        },
        events: {
          onReady: event => {
            if (readySettled) return;
            readySettled = true;
            clearTimeout(readyTimeout);
            youtubePlayerReady = true;
            try { event.target.setVolume(70); } catch (_) {}
            resolve(event.target);
          },
          onStateChange: event => {
            // A late PLAYING callback after Pause/Stop must never bring the
            // music back, even if the iframe resumed itself while hidden.
            if (!musicEnabled || !musicWantsPlayback) {
              if (event.data === window.YT.PlayerState.PLAYING) {
                try { event.target.pauseVideo(); } catch (_) {}
              }
              return;
            }
            if (event.data === window.YT.PlayerState.BUFFERING && musicWantsPlayback) {
              musicPlaying = false;
              musicStarting = true;
              setMusicUI();
            } else if (event.data === window.YT.PlayerState.PLAYING) {
              if (!musicWantsPlayback) {
                // A delayed start must not restart after Pause/Stop/timeout.
                try { event.target.pauseVideo(); } catch (_) {}
                return;
              }
              confirmMusicPlaying();
            } else if (
              event.data === window.YT.PlayerState.PAUSED ||
              event.data === window.YT.PlayerState.ENDED
            ) {
              // Initial PAUSED may arrive during an in-flight play request.
              // Wait for PLAYING or timeout rather than flashing the icon.
              if (musicStarting && musicWantsPlayback) return;
              ++musicRequestId;
              clearMusicWait();
              musicWantsPlayback = false;
              musicPlaying = false;
              musicStarting = false;
              setMusicUI();
            }
          },
          onError: error => {
            failMusicAttempt(musicRequestId);
            if (!readySettled) {
              readySettled = true;
              clearTimeout(readyTimeout);
              reject(new Error("YouTube player error " + error.data));
            }
          }
        }
      });
    }));

    // Allow a later user tap to retry after a transient YouTube/network error.
    youtubePlayerPromise.catch(() => {
      youtubePlayerPromise = null;
      youtubePlayerReady = false;
    });
    return youtubePlayerPromise;
  }

  // Preload YouTube while the locked gate is displayed. A direct tap on
  // the seal starts audible music; the transition to Hero never touches the
  // player's play/pause/volume state. iOS still requires the iframe to have
  // finished loading before that first gesture; manual retry remains possible.
  if (selectedParty && !linkToolInitial) {
    initYouTubeMusicPlayer().catch(() => {});
    waxOpenButton?.addEventListener("click", requestMusicPlayback, { once:true });
    document.addEventListener("wedding:waxopen", setMusicUI, { once:true });
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

    const upper = name => name.toLocaleUpperCase("vi-VN");
    const escapeHtml = value => String(value).replace(/[&<>"']/g, character =>
      ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character])
    );
    const pair = (left, right, separator) =>
      escapeHtml(left) + " <span>" + separator + "</span> " + escapeHtml(right);

    const pairs = {
      hero: pair(upper(first.short), upper(second.short), "&amp;"),
      gate: pair(first.short, second.short, "&amp;"),
      closing: pair(first.short, second.short, "&amp;"),
      footer: "© " + new Date(partyInfo(selectedParty).date + "T00:00:00Z").getUTCFullYear() +
        " " + pair(upper(first.short), upper(second.short), "&amp;"),
      menu: pair(upper(first.short), upper(second.short), "♡")
    };

    document.querySelectorAll("[data-party-name-pair]").forEach(node => {
      const key = node.dataset.partyNamePair;
      if (pairs[key]) node.innerHTML = pairs[key];
    });

    const monogram = document.getElementById("heroMonogram");
    if (monogram) monogram.innerHTML = escapeHtml(first.initial) + " <span>&amp;</span> " + escapeHtml(second.initial);
    // The wax seal is a shared antique lock for both ceremonies. The couple's
    // initials remain in the hero and other personalized locations.
  }

  function refreshPartyLabels() {
    if (!selectedParty) return;

    const ceremonyLabel = document.getElementById("heroCeremonyLabel");
    if (ceremonyLabel) {
      const key = selectedParty === "single" ? "hero.singleOverline" :
        selectedParty === "bride" ? "hero.brideOverline" : "hero.groomOverline";
      ceremonyLabel.textContent = tr(key);
    }

    const brideFirst = selectedParty === "bride";
    const coupleHeading = document.getElementById("coupleHeading");
    if (coupleHeading) {
      coupleHeading.innerHTML = tr(singleMode ? "couple.headingSingle" :
        brideFirst ? "couple.headingBrideFirst" : "couple.headingGroomFirst");
    }

    const menuCoupleLabel = document.getElementById("menuCoupleLabel");
    if (menuCoupleLabel) {
      menuCoupleLabel.textContent = tr(singleMode ? "menu.singleCouple" :
        brideFirst ? "menu.coupleBrideFirst" : "menu.coupleGroomFirst");
    }


    document.title = tr(singleMode ? "page.titleSingle" :
      brideFirst ? "page.titleBride" : "page.titleGroom");
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
  addEventListener("scroll", () => {
    if (scrollFrame || !progress) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      const max = document.documentElement.scrollHeight - innerHeight;
      const ratio = max ? Math.min(1, Math.max(0, scrollY / max)) : 0;
      progress.style.transform = "scaleX(" + ratio + ")";
    });
  }, {passive:true});

  const hero = document.querySelector(".hero");
  const heroPhoto = document.querySelector(".hero-photo");
  if (hero && heroPhoto && "IntersectionObserver" in window) {
    let heroInViewport = false;
    const updateHeroMotion = () => {
      const visible = heroInViewport && !document.hidden &&
        !document.documentElement.classList.contains("wax-pending");
      heroPhoto.style.animationPlayState = visible ? "running" : "paused";
      heroPhoto.style.willChange = visible ? "transform" : "auto";
    };
    const heroAnimationObserver = new IntersectionObserver(entries => {
      heroInViewport = entries[0]?.isIntersecting !== false;
      updateHeroMotion();
    }, {threshold:0});
    heroAnimationObserver.observe(hero);
    document.addEventListener("wedding:waxopen", updateHeroMotion);
    document.addEventListener("visibilitychange", updateHeroMotion);
    updateHeroMotion();
  }

  const reveal = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    }), {threshold:.1, rootMargin:"80px 0px"});
    reveal.forEach(node => observer.observe(node));
  } else {
    reveal.forEach(node => node.classList.add("visible"));
  }

  // Cinematic chapter transitions are progressive enhancement. Content stays
  // readable without IntersectionObserver and for reduced-motion visitors.
  const reducedCinematicMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const chapterTargets = document.querySelectorAll(
    ".section-head, .album-header, .couple-section > .overline, " +
    ".couple-section > .section-title, .couple-section > .section-lead, .closing-content"
  );
  if (!reducedCinematicMotion && "IntersectionObserver" in window) {
    const chapterObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        chapterObserver.unobserve(entry.target);
      }
    }, {threshold:0.08, rootMargin:"0px 0px -5% 0px"});
    chapterTargets.forEach((node, index) => {
      node.classList.add("cinematic-reveal");
      node.style.setProperty("--cinematic-order", String(index % 3));
      chapterObserver.observe(node);
    });
    document.documentElement.classList.add("cinematic-ready");
  }

  const enterCinematicHero = () => document.documentElement.classList.add("cinematic-entered");
  document.addEventListener("wedding:waxopen", enterCinematicHero, { once:true });
  if (!document.documentElement.classList.contains("wax-pending")) enterCinematicHero();

})();