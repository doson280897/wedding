(() => {
  "use strict";
  const i18n = window.WeddingI18n;
  const tr = key => i18n ? i18n.t(key) : key;
  const params = new URLSearchParams(window.location.search);
  const rawGuest = params.get("to");
  const displayGuest = rawGuest ? rawGuest.replace(/[_+]/g, " ").trim().slice(0, 100) : "";
  const guestNode = document.getElementById("guestName");
  const envelopeGuest = document.getElementById("envelopeGuest");

  function updateGuest() {
    const text = displayGuest ? tr("guest.prefix") + displayGuest : tr("hero.greeting");
    if (guestNode) guestNode.textContent = text;
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
  const countdownButtons = Array.from(document.querySelectorAll("[data-countdown]"));
  let selectedWedding = Date.now() < weddingDates.bride.time ? "bride" : "groom";

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
    countdownButtons.forEach(button => {
      const active = button.dataset.countdown === selectedWedding;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
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

  countdownButtons.forEach(button => button.addEventListener("click", () => {
    selectedWedding = button.dataset.countdown;
    countdown();
  }));
  countdown();
  window.setInterval(countdown, 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) countdown(); });

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
  const skipInvitation = document.getElementById("skipInvitation");
  let envelopeSeen = false;
  try { envelopeSeen = sessionStorage.getItem("wedding-envelope-seen-v1") === "1"; } catch (_) {}
  if (intro && !envelopeSeen) {
    intro.hidden = false;
    document.body.classList.add("envelope-locked");
    window.setTimeout(() => openInvitation?.focus({preventScroll:true}), 0);
    let closing = false;
    const closeEnvelope = () => {
      if (closing) return;
      closing = true;
      try { sessionStorage.setItem("wedding-envelope-seen-v1","1"); } catch (_) {}
      document.body.classList.remove("envelope-locked");
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        intro.hidden = true;
        return;
      }
      intro.classList.add("is-opening");
      window.setTimeout(() => { intro.hidden = true; }, 720);
    };
    openInvitation?.addEventListener("click", closeEnvelope);
    skipInvitation?.addEventListener("click", closeEnvelope);
    intro.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); closeEnvelope(); return; }
      if (event.key !== "Tab" || !openInvitation || !skipInvitation) return;
      if (event.shiftKey && document.activeElement === openInvitation) {
        event.preventDefault(); skipInvitation.focus();
      } else if (!event.shiftKey && document.activeElement === skipInvitation) {
        event.preventDefault(); openInvitation.focus();
      }
    });
  }

  const musicButton = document.getElementById("musicToggle");
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  let audioContext = null;
  let musicTimer = 0;
  let musicStep = 0;
  let musicPlaying = false;
  const melody = [392,493.88,587.33,493.88,440,523.25,659.25,523.25,392,493.88,587.33,783.99,659.25,523.25,440,392];

  function softTone(frequency, delay = 0, gainValue = 0.018) {
    if (!audioContext) return;
    const start = audioContext.currentTime + delay;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.45);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + 1.5);
  }

  function musicTick() {
    const index = musicStep++ % melody.length;
    softTone(melody[index]);
    if (index % 4 === 0) softTone(melody[index] / 2, 0, 0.009);
  }

  function setMusicUI() {
    if (!musicButton) return;
    musicButton.setAttribute("aria-pressed", String(musicPlaying));
    musicButton.setAttribute("aria-label", tr(musicPlaying ? "music.disableAria" : "music.enableAria"));
    musicButton.setAttribute("title", tr("music.title"));
    const label = musicButton.querySelector(".music-label");
    if (label) label.textContent = tr(musicPlaying ? "music.on" : "music.off");
  }

  if (musicButton && !AudioContextClass) {
    musicButton.hidden = true;
  } else {
    musicButton?.addEventListener("click", async () => {
      if (!audioContext) audioContext = new AudioContextClass();
      if (!musicPlaying) {
        await audioContext.resume();
        musicPlaying = true;
        musicTick();
        musicTimer = window.setInterval(musicTick, 1250);
      } else {
        musicPlaying = false;
        window.clearInterval(musicTimer);
        musicTimer = 0;
        await audioContext.suspend();
      }
      setMusicUI();
    });
  }

  function refreshDynamicLanguage() {
    updateGuest();
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
      progress.style.width = (max ? scrollY / max * 100 : 0) + "%";
    });
  }, {passive:true});

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

  document.querySelectorAll("img[data-demo-src]").forEach(img => {
    img.addEventListener("error", function fallback() {
      img.removeEventListener("error", fallback);
      img.src = img.dataset.demoSrc;
    });
  });
})();