(() => {
  "use strict";
  const i18n = window.WeddingI18n;
  const tr = key => i18n ? i18n.t(key) : key;
  const params = new URLSearchParams(window.location.search);
  const partyParam = params.get("party");
  const selectedParty = partyParam === "bride" || partyParam === "groom" ? partyParam : null;
  const partySelector = document.getElementById("partySelector");
  const languageButtons = Array.from(document.querySelectorAll(".language-switch [data-lang]"));

  if (selectedParty) {
    document.documentElement.dataset.party = selectedParty;
    document.documentElement.classList.remove("party-pending");
  } else {
    document.documentElement.classList.add("party-pending");
    const partyButtons = Array.from(document.querySelectorAll("[data-party-select]"));
    requestAnimationFrame(() => partyButtons[0]?.focus({preventScroll:true}));

    partyButtons.forEach(button => button.addEventListener("click", () => {
      const side = button.dataset.partySelect;
      if (side !== "bride" && side !== "groom") return;
      const url = new URL(window.location.href);
      url.searchParams.set("party", side);
      url.hash = "";
      window.location.replace(url.href);
    }));

    document.addEventListener("keydown", event => {
      if (!document.documentElement.classList.contains("party-pending") || event.key !== "Tab") return;
      const focusable = [...languageButtons, ...partyButtons].filter(button => !button.disabled);
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
  const envelopeGuest = document.getElementById("envelopeGuest");

  function updateGuest() {
    const guestLabel = displayGuest || tr("guest.default");
    const heroTemplate = tr(selectedParty === "bride" ? "guest.heroBride" : "guest.heroGroom");
    const heroText = heroTemplate.replace("{guest}", guestLabel);
    if (guestNode) guestNode.textContent = heroText;
    if (envelopeGuest) envelopeGuest.textContent = displayGuest ? tr("guest.prefix") + displayGuest : tr("envelope.invite");
  }

  const weddingDates = {
    bride: {
      time: new Date("2026-11-14T09:00:00+07:00").getTime(),
      titleKey: "countdown.brideTitle",
      ariaKey: "countdown.brideAria"
    },
    groom: {
      time: new Date("2026-11-29T09:00:00+07:00").getTime(),
      titleKey: "countdown.groomTitle",
      ariaKey: "countdown.groomAria"
    }
  };
  const timer = document.getElementById("timer");
  const countdownTitle = document.getElementById("countdownTitle");
  const selectedWedding = selectedParty || (Date.now() < weddingDates.bride.time ? "bride" : "groom");

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
    if (document.hidden) return;
    const delay = 1030 - (Date.now() % 1000);
    countdownTimer = window.setTimeout(scheduleCountdown, delay);
  }
  scheduleCountdown();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) window.clearTimeout(countdownTimer);
    else scheduleCountdown();
  });

  function buildSchedule(side) {
    if (side === "bride") {
      return {
        filename: tr("calendar.brideFile"),
        events: [
          {title:tr("calendar.brideCeremonyTitle"),start:"20261114T020000Z",end:"20261114T030000Z",place:tr("calendar.brideCeremonyPlace"),note:tr("calendar.brideCeremonyNote")},
          {title:tr("calendar.brideReceptionTitle"),start:"20261114T040000Z",end:"20261114T060000Z",place:tr("calendar.brideReceptionPlace"),note:tr("calendar.brideReceptionNote")}
        ]
      };
    }
    return {
      filename: tr("calendar.groomFile"),
      events: [
        {title:tr("calendar.groomCeremonyTitle"),start:"20261129T020000Z",end:"20261129T030000Z",place:tr("calendar.groomPlace"),note:tr("calendar.groomCeremonyNote")},
        {title:tr("calendar.groomReceptionTitle"),start:"20261129T040000Z",end:"20261129T060000Z",place:tr("calendar.groomPlace"),note:tr("calendar.groomReceptionNote")}
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
        "UID:" + button.dataset.calendar + "-" + index + "-2026@wedding.doson280897.github.io",
        "DTSTAMP:" + timestamp,
        "DTSTART:" + event.start,
        "DTEND:" + event.end,
        "SUMMARY:" + escapeICS(event.title),
        "DESCRIPTION:" + escapeICS(event.note + " (" + tr("calendar.timezone") + ")"),
        "LOCATION:" + escapeICS(event.place),
        "END:VEVENT"
      ].join("\r\n")).join("\r\n");
      const calendar = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Son Nga Wedding//Wedding Calendar//VI","CALSCALE:GREGORIAN","METHOD:PUBLISH",body,"END:VCALENDAR"].join("\r\n") + "\r\n";
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

  const intro = document.getElementById("envelopeIntro");
  const openInvitation = document.getElementById("openInvitation");
  const closeInvitation = document.getElementById("closeInvitation");
  const skipInvitation = document.getElementById("skipInvitation");
  if (intro && selectedParty) {
    intro.hidden = false;
    document.body.classList.add("envelope-locked");
    window.setTimeout(() => openInvitation?.focus({preventScroll:true}), 0);

    let opened = false;
    let leaving = false;

    const enterInvitation = (instant = false) => {
      if (leaving) return;
      leaving = true;

      if (instant || matchMedia("(prefers-reduced-motion: reduce)").matches) {
        intro.hidden = true;
        document.body.classList.remove("envelope-locked");
        return;
      }

      intro.classList.add("is-leaving");
      window.setTimeout(() => {
        intro.hidden = true;
        document.body.classList.remove("envelope-locked");
      }, 260);
    };

    const openEnvelope = () => {
      if (opened || leaving) return;
      opened = true;

      // Open flap and lift the card in the same frame: no staged delays or auto-close timer.
      requestAnimationFrame(() => {
        intro.classList.add("is-flap-open", "is-card-lifted", "is-opened");
        openInvitation?.setAttribute("disabled", "");
        skipInvitation?.setAttribute("disabled", "");
        closeInvitation?.focus({preventScroll:true});
      });
    };

    openInvitation?.addEventListener("click", openEnvelope);
    closeInvitation?.addEventListener("click", () => enterInvitation(false));
    skipInvitation?.addEventListener("click", () => enterInvitation(true));

    document.addEventListener("keydown", event => {
      if (intro.hidden || !document.body.classList.contains("envelope-locked")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (opened) enterInvitation(false);
        else enterInvitation(true);
        return;
      }
      if (event.key !== "Tab") return;

      const envelopeActions = opened
        ? [closeInvitation]
        : [openInvitation, skipInvitation];
      const focusable = [...languageButtons, ...envelopeActions].filter(button => button && !button.disabled);
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

  const musicButton = document.getElementById("musicToggle");
  const YOUTUBE_MUSIC_ID = selectedParty === "bride" ? "9UDP2boblXk" : "BunWcLGUGuQ";
  let youtubePlayer = null;
  let youtubePlayerReady = false;
  let youtubePlayerPromise = null;
  let musicPlaying = false;

  function setMusicUI() {
    if (!musicButton) return;
    musicButton.setAttribute("aria-pressed", String(musicPlaying));
    musicButton.setAttribute("aria-label", tr(musicPlaying ? "music.disableAria" : "music.enableAria"));
    musicButton.setAttribute("title", tr("music.title"));
    const label = musicButton.querySelector(".music-label");
    if (label) label.textContent = tr(musicPlaying ? "music.on" : "music.off");
  }

  function loadYouTubeIframeAPI() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (window.__weddingYouTubeApiPromise) return window.__weddingYouTubeApiPromise;

    window.__weddingYouTubeApiPromise = new Promise((resolve, reject) => {
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        try { previousReady?.(); } catch (_) {}
        resolve(window.YT);
      };

      const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      if (existing) return;

      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("YouTube IFrame API failed to load"));
      document.head.appendChild(script);
    });

    return window.__weddingYouTubeApiPromise;
  }

  function initYouTubeMusicPlayer() {
    if (youtubePlayerPromise) return youtubePlayerPromise;

    youtubePlayerPromise = loadYouTubeIframeAPI().then(() => new Promise((resolve, reject) => {
      let host = document.getElementById("youtubeWeddingMusic");
      if (!host) {
        host = document.createElement("div");
        host.id = "youtubeWeddingMusic";
        host.setAttribute("aria-hidden", "true");
        host.style.cssText =
          "position:fixed;width:2px;height:2px;left:-9999px;bottom:0;opacity:.01;pointer-events:none;overflow:hidden;";
        document.body.appendChild(host);
      }

      youtubePlayer = new window.YT.Player(host, {
        width: "2",
        height: "2",
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
            youtubePlayerReady = true;
            try { event.target.setVolume(70); } catch (_) {}
            resolve(event.target);
          },
          onStateChange: event => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              musicPlaying = true;
            } else if (
              event.data === window.YT.PlayerState.PAUSED ||
              event.data === window.YT.PlayerState.ENDED
            ) {
              musicPlaying = false;
            }
            setMusicUI();
          },
          onError: error => {
            musicPlaying = false;
            setMusicUI();
            reject(new Error("YouTube player error " + error.data));
          }
        }
      });
    }));

    return youtubePlayerPromise;
  }

  // Preload the YouTube player without autoplay. On Safari this keeps the actual
  // playVideo() call inside a later user tap instead of creating the iframe after the tap.
  initYouTubeMusicPlayer().catch(() => {});

  musicButton?.addEventListener("click", () => {
    if (!youtubePlayerReady || !youtubePlayer) {
      // Do not show a false "playing" state. The player is already preloading;
      // a second tap after it is ready will start playback under Safari's gesture policy.
      initYouTubeMusicPlayer().catch(() => {});
      return;
    }

    if (musicPlaying) {
      youtubePlayer.pauseVideo();
    } else {
      youtubePlayer.playVideo();
    }
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
    const pairs = {
      envelope: brideFirst
        ? '<span>Tố Nga</span><em>&amp;</em><span>Thành Sơn</span>'
        : '<span>Thành Sơn</span><em>&amp;</em><span>Tố Nga</span>',
      hero: brideFirst
        ? 'TỐ NGA <span>&amp;</span> THÀNH SƠN'
        : 'THÀNH SƠN <span>&amp;</span> TỐ NGA',
      closing: brideFirst
        ? 'Tố Nga <span>&amp;</span> Thành Sơn'
        : 'Thành Sơn <span>&amp;</span> Tố Nga',
      footer: brideFirst
        ? '© 2026 TỐ NGA &amp; THÀNH SƠN'
        : '© 2026 THÀNH SƠN &amp; TỐ NGA',
      menu: brideFirst
        ? 'TỐ NGA <span>♡</span> THÀNH SƠN'
        : 'THÀNH SƠN <span>♡</span> TỐ NGA'
    };

    document.querySelectorAll("[data-party-name-pair]").forEach(node => {
      const key = node.dataset.partyNamePair;
      if (pairs[key]) node.innerHTML = pairs[key];
    });
  }

  function refreshPartyLabels() {
    if (!selectedParty) return;

    const ceremonyLabel = document.getElementById("heroCeremonyLabel");
    if (ceremonyLabel) {
      ceremonyLabel.textContent = tr(selectedParty === "bride" ? "hero.brideOverline" : "hero.groomOverline");
    }

    const brideFirst = selectedParty === "bride";
    const coupleHeading = document.getElementById("coupleHeading");
    if (coupleHeading) {
      coupleHeading.innerHTML = tr(brideFirst ? "couple.headingBrideFirst" : "couple.headingGroomFirst");
    }

    const menuCoupleLabel = document.getElementById("menuCoupleLabel");
    if (menuCoupleLabel) {
      menuCoupleLabel.textContent = tr(brideFirst ? "menu.coupleBrideFirst" : "menu.coupleGroomFirst");
    }

    document.title = tr(brideFirst ? "page.titleBride" : "page.titleGroom");
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
    const heroAnimationObserver = new IntersectionObserver(entries => {
      const visible = entries[0]?.isIntersecting !== false;
      heroPhoto.style.animationPlayState = visible ? "running" : "paused";
      heroPhoto.style.willChange = visible ? "transform" : "auto";
    }, {threshold:0});
    heroAnimationObserver.observe(hero);
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

})();