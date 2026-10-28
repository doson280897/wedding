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
  const languageButtons = Array.from(document.querySelectorAll(".language-switch [data-lang]"));

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
      timer.innerHTML = '<p class="finished">' + tr("countdown.finished") + '</p>';
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
  scheduleCountdown();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) window.clearTimeout(countdownTimer);
    else scheduleCountdown();
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
  const setContentBrowserTheme = () => setBrowserTheme(
    document.documentElement.dataset.theme === "light" ? "#f5f0e6" : "#0b0e0e"
  );
  document.addEventListener("wedding:themechange", setContentBrowserTheme);

  const moonlightGate = document.getElementById("moonlightGate");
  const waxOpenButton = document.getElementById("waxOpenButton");
  const reducedGateMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let gateOpening = false;
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
    moonlightGate.hidden = true;
    moonlightGate.classList.remove(
      "is-awakening", "is-opening", "is-blooming",
      "is-hero-revealing", "is-leaving"
    );
    document.documentElement.classList.remove("wax-pending", "gate-hero-revealing");
    setContentBrowserTheme();
    resetInvitationScroll();

    // Start persistent hero motion only after the gate is fully gone, so it
    // cannot compete with the final crossfade on iOS/WebKit.
    requestAnimationFrame(() => {
      document.dispatchEvent(new Event("wedding:waxopen"));
    });
  };

  const finishMoonlightGate = () => {
    if (!moonlightGate || moonlightGate.hidden) return;
    if (reducedGateMotion) {
      document.documentElement.classList.add("gate-hero-revealing", "cinematic-entered");
      completeMoonlightGate();
      return;
    }

    // Do not wait for the doors to stop. Fade the gate while they are still
    // moving so the viewer never sees a hard "door finished -> scene changed"
    // boundary.
    if (!moonlightGate.classList.contains("is-leaving")) {
      moonlightGate.classList.add("is-leaving");
    }
    scheduleGate(completeMoonlightGate, 1080);
  };

  const openFromWax = () => {
    if (!moonlightGate || !waxOpenButton || gateOpening || moonlightGate.hidden) return;
    gateOpening = true;
    waxOpenButton.disabled = true;

    if (reducedGateMotion) {
      finishMoonlightGate();
      return;
    }

    moonlightGate.classList.add("is-awakening");
    scheduleGate(() => {
      if (!moonlightGate || moonlightGate.hidden) return;
      moonlightGate.classList.add("is-opening");

      // Light starts leaking through while the doors are still near closed.
      scheduleGate(() => {
        if (!moonlightGate.hidden) moonlightGate.classList.add("is-blooming");
      }, 420);

      // Hero and its text enter together as one visual reveal.
      scheduleGate(() => {
        if (!moonlightGate.hidden) {
          moonlightGate.classList.add("is-hero-revealing");
          document.documentElement.classList.add("gate-hero-revealing", "cinematic-entered");
        }
      }, 700);

      // Begin dissolving the gate before the 1.62s hinge motion completes.
      scheduleGate(finishMoonlightGate, 1180);

      // Safety completion in case a browser throttles an intermediate timer.
      scheduleGate(completeMoonlightGate, 2380);
    }, 240);
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
    bubbleActionsOpen = Boolean(open && musicEnabled && musicBubble && !musicBubble.hidden);
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
      musicBubble.hidden = !musicEnabled;
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
      try { player.playVideo(); } // Synchronous when already ready for iOS gestures.
      catch (_) { failMusicAttempt(requestId); }
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
            if (!musicEnabled) return;
            if (event.data === window.YT.PlayerState.PLAYING) {
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

  // Preload the YouTube player without autoplay. On Safari this keeps the actual
  // playVideo() call inside a later user tap instead of creating the iframe after the tap.
  // Avoid network requests, iframes and CPU work on the admin landing/tool screens.
  // For guests, preload after a celebration has been selected to improve Safari playback.
  if (selectedParty && !linkToolInitial) initYouTubeMusicPlayer().catch(() => {});

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
    const wax = document.getElementById("waxMonogram");
    if (wax) wax.textContent = first.initial + " · " + second.initial;
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
      const visible = heroInViewport && !document.documentElement.classList.contains("wax-pending");
      heroPhoto.style.animationPlayState = visible ? "running" : "paused";
      heroPhoto.style.willChange = visible ? "transform" : "auto";
    };
    const heroAnimationObserver = new IntersectionObserver(entries => {
      heroInViewport = entries[0]?.isIntersecting !== false;
      updateHeroMotion();
    }, {threshold:0});
    heroAnimationObserver.observe(hero);
    document.addEventListener("wedding:waxopen", updateHeroMotion);
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