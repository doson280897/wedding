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
  const skipInvitation = document.getElementById("skipInvitation");
  let envelopeSeen = false;
  try { envelopeSeen = sessionStorage.getItem("wedding-envelope-seen-v3") === "1"; } catch (_) {}
  if (intro && !envelopeSeen) {
    intro.hidden = false;
    document.body.classList.add("envelope-locked");
    window.setTimeout(() => openInvitation?.focus({preventScroll:true}), 0);
    let closing = false;
    const closeEnvelope = () => {
      if (closing) return;
      closing = true;
      try { sessionStorage.setItem("wedding-envelope-seen-v3","1"); } catch (_) {}

      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        intro.hidden = true;
        document.body.classList.remove("envelope-locked");
        return;
      }

      openInvitation?.setAttribute("disabled", "");
      skipInvitation?.setAttribute("disabled", "");

      // Separate compositor phases so transform animations do not fight each other:
      // flap -> card -> crossfade. Body stays locked until the final frame.
      requestAnimationFrame(() => {
        intro.classList.add("is-flap-open");

        window.setTimeout(() => {
          intro.classList.add("is-card-lifted");

          window.setTimeout(() => {
            intro.classList.add("is-leaving");

            window.setTimeout(() => {
              intro.hidden = true;
              document.body.classList.remove("envelope-locked");
            }, 440);
          }, 620);
        }, 300);
      });
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
  let musicPlaying = false;
  let musicScheduler = 0;
  let musicStep = 0;
  let nextNoteTime = 0;
  let masterGain = null;
  let reverbGain = null;
  let dryGain = null;
  let breathNoiseBuffer = null;
  const activeMusicNodes = new Set();

  // Original pentatonic wedding theme: airy Chinese-flute mood, not based on an existing song.
  // MIDI notes use a D-major pentatonic palette (D E F# A B) with deliberate breathing spaces.
  const flutePhrase = [
    [74,1.5],[76,.5],[78,1],[81,1],[78,1.5],[76,.5],[74,2],
    [null,.75],[69,.75],[71,.5],[74,1.5],[76,.5],[78,1],[76,1],[74,2],
    [null,1],[74,.5],[76,.5],[78,1],[81,1],[83,1.5],[81,.5],[78,1],
    [76,1],[78,.5],[76,.5],[74,1.5],[71,.5],[69,2],[null,1],
    [69,.75],[74,.75],[76,.5],[78,1],[81,1.5],[78,.5],[76,1],
    [74,1],[71,1],[69,1.5],[71,.5],[74,2],[null,1],
    [78,.75],[81,.75],[83,.5],[86,1],[83,1],[81,1],[78,1.5],[76,.5],
    [74,1],[76,.5],[78,.5],[76,1],[74,1],[71,1],[69,2],[null,2]
  ];
  const BEAT = 60 / 66;

  const midiToHz = midi => 440 * Math.pow(2, (midi - 69) / 12);

  function trackNode(node) {
    activeMusicNodes.add(node);
    node.addEventListener?.("ended", () => activeMusicNodes.delete(node), {once:true});
    return node;
  }

  function createReverbImpulse(context) {
    const length = Math.floor(context.sampleRate * 2.4);
    const impulse = context.createBuffer(2, length, context.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const decay = Math.pow(1 - i / length, 2.7);
        data[i] = (Math.random() * 2 - 1) * decay * 0.42;
      }
    }
    return impulse;
  }

  function setupMusicGraph() {
    if (!audioContext || masterGain) return;

    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.0001;

    dryGain = audioContext.createGain();
    dryGain.gain.value = 0.84;

    reverbGain = audioContext.createGain();
    reverbGain.gain.value = 0.21;

    const convolver = audioContext.createConvolver();
    convolver.buffer = createReverbImpulse(audioContext);

    const gentleLowpass = audioContext.createBiquadFilter();
    gentleLowpass.type = "lowpass";
    gentleLowpass.frequency.value = 7200;
    gentleLowpass.Q.value = 0.35;

    dryGain.connect(gentleLowpass);
    gentleLowpass.connect(masterGain);
    reverbGain.connect(convolver);
    convolver.connect(masterGain);
    masterGain.connect(audioContext.destination);

    breathNoiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 2, audioContext.sampleRate);
    const noise = breathNoiseBuffer.getChannelData(0);
    for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
  }

  function routeInstrument(source, amount = 0.28) {
    if (!dryGain || !reverbGain) return;
    source.connect(dryGain);
    const send = audioContext.createGain();
    send.gain.value = amount;
    source.connect(send);
    send.connect(reverbGain);
  }

  function scheduleFlute(midi, start, durationBeats, expression = 1) {
    if (!audioContext || midi == null) return;
    const duration = durationBeats * BEAT;
    const frequency = midiToHz(midi);
    const end = start + duration;

    const body = trackNode(audioContext.createOscillator());
    body.type = "sine";
    body.frequency.setValueAtTime(frequency, start);

    const harmonic = trackNode(audioContext.createOscillator());
    harmonic.type = "triangle";
    harmonic.frequency.setValueAtTime(frequency * 2, start);

    const bodyGain = audioContext.createGain();
    const harmonicGain = audioContext.createGain();
    bodyGain.gain.setValueAtTime(0.0001, start);
    bodyGain.gain.exponentialRampToValueAtTime(0.075 * expression, start + 0.09);
    bodyGain.gain.setValueAtTime(0.064 * expression, Math.max(start + 0.11, end - 0.18));
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, end);
    harmonicGain.gain.setValueAtTime(0.0001, start);
    harmonicGain.gain.exponentialRampToValueAtTime(0.012 * expression, start + 0.11);
    harmonicGain.gain.exponentialRampToValueAtTime(0.0001, end);

    const vibrato = trackNode(audioContext.createOscillator());
    const vibratoDepth = audioContext.createGain();
    vibrato.type = "sine";
    vibrato.frequency.setValueAtTime(5.1, start);
    vibratoDepth.gain.setValueAtTime(0, start);
    vibratoDepth.gain.linearRampToValueAtTime(11, start + 0.32);
    vibratoDepth.gain.linearRampToValueAtTime(17, Math.max(start + 0.38, end - 0.12));
    vibrato.connect(vibratoDepth);
    vibratoDepth.connect(body.detune);
    vibratoDepth.connect(harmonic.detune);

    // A tiny pitch scoop mimics the natural attack of a bamboo flute.
    body.detune.setValueAtTime(-13, start);
    body.detune.linearRampToValueAtTime(0, start + 0.075);

    const fluteFilter = audioContext.createBiquadFilter();
    fluteFilter.type = "lowpass";
    fluteFilter.frequency.setValueAtTime(4300, start);
    fluteFilter.Q.value = 0.6;

    body.connect(bodyGain);
    harmonic.connect(harmonicGain);
    bodyGain.connect(fluteFilter);
    harmonicGain.connect(fluteFilter);
    routeInstrument(fluteFilter, 0.42);

    // Breath layer: band-passed noise, very low in the mix.
    const breath = trackNode(audioContext.createBufferSource());
    breath.buffer = breathNoiseBuffer;
    breath.loop = true;
    const breathFilter = audioContext.createBiquadFilter();
    breathFilter.type = "bandpass";
    breathFilter.frequency.setValueAtTime(Math.min(3600, frequency * 4.7), start);
    breathFilter.Q.value = 1.1;
    const breathGain = audioContext.createGain();
    breathGain.gain.setValueAtTime(0.0001, start);
    breathGain.gain.exponentialRampToValueAtTime(0.0065 * expression, start + 0.08);
    breathGain.gain.exponentialRampToValueAtTime(0.0001, end);
    breath.connect(breathFilter);
    breathFilter.connect(breathGain);
    routeInstrument(breathGain, 0.5);

    body.start(start);
    harmonic.start(start);
    vibrato.start(start);
    breath.start(start);
    const stopAt = end + 0.05;
    body.stop(stopAt);
    harmonic.stop(stopAt);
    vibrato.stop(stopAt);
    breath.stop(stopAt);
  }

  function schedulePluck(midi, start, gainValue = 0.025) {
    if (!audioContext) return;
    const osc = trackNode(audioContext.createOscillator());
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(midiToHz(midi), start);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2200, start);
    filter.frequency.exponentialRampToValueAtTime(650, start + 1.2);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.45);
    osc.connect(filter);
    filter.connect(gain);
    routeInstrument(gain, 0.5);
    osc.start(start);
    osc.stop(start + 1.5);
  }

  function schedulePad(rootMidi, start, beats = 8) {
    if (!audioContext) return;
    const duration = beats * BEAT;
    const padGain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 850;
    padGain.gain.setValueAtTime(0.0001, start);
    padGain.gain.exponentialRampToValueAtTime(0.012, start + 0.8);
    padGain.gain.setValueAtTime(0.009, start + duration - 0.8);
    padGain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    [0, 7].forEach((interval, index) => {
      const osc = trackNode(audioContext.createOscillator());
      osc.type = "sine";
      osc.frequency.setValueAtTime(midiToHz(rootMidi + interval), start);
      osc.detune.value = index ? 4 : -4;
      osc.connect(filter);
      osc.start(start);
      osc.stop(start + duration + 0.05);
    });
    filter.connect(padGain);
    routeInstrument(padGain, 0.7);
  }

  function scheduleMusicAhead() {
    if (!musicPlaying || !audioContext) return;
    const horizon = audioContext.currentTime + 0.7;
    while (nextNoteTime < horizon) {
      const [note, beats] = flutePhrase[musicStep % flutePhrase.length];
      const phrasePosition = musicStep % flutePhrase.length;
      if (note != null) {
        const expression = phrasePosition % 9 === 0 ? 1.08 : (phrasePosition % 5 === 0 ? 0.92 : 1);
        scheduleFlute(note, nextNoteTime, beats * 0.92, expression);
        if (phrasePosition % 4 === 0) schedulePluck(Math.max(50, note - 24), nextNoteTime, 0.018);
      }
      if (phrasePosition % 16 === 0) {
        schedulePad(50, nextNoteTime, 8);
      } else if (phrasePosition % 16 === 8) {
        schedulePad(47, nextNoteTime, 8);
      }
      nextNoteTime += beats * BEAT;
      musicStep++;
    }
  }

  function stopScheduledMusic() {
    window.clearInterval(musicScheduler);
    musicScheduler = 0;
    for (const node of activeMusicNodes) {
      try { node.stop(); } catch (_) {}
    }
    activeMusicNodes.clear();
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
      if (!audioContext) {
        audioContext = new AudioContextClass();
        setupMusicGraph();
      }
      if (!musicPlaying) {
        await audioContext.resume();
        musicPlaying = true;
        musicStep = 0;
        nextNoteTime = audioContext.currentTime + 0.09;
        masterGain.gain.cancelScheduledValues(audioContext.currentTime);
        masterGain.gain.setValueAtTime(Math.max(masterGain.gain.value, 0.0001), audioContext.currentTime);
        masterGain.gain.exponentialRampToValueAtTime(0.95, audioContext.currentTime + 0.35);
        scheduleMusicAhead();
        musicScheduler = window.setInterval(scheduleMusicAhead, 120);
      } else {
        musicPlaying = false;
        stopScheduledMusic();
        masterGain.gain.cancelScheduledValues(audioContext.currentTime);
        masterGain.gain.setValueAtTime(Math.max(masterGain.gain.value, 0.0001), audioContext.currentTime);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.18);
        window.setTimeout(() => audioContext?.suspend(), 220);
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
      const ratio = max ? Math.min(1, Math.max(0, scrollY / max)) : 0;
      progress.style.transform = "scaleX(" + ratio + ")";
    });
  }, {passive:true});

  const hero = document.querySelector(".hero");
  const heroPhoto = document.querySelector(".hero-photo");
  if (hero && heroPhoto && "IntersectionObserver" in window) {
    const heroAnimationObserver = new IntersectionObserver(entries => {
      heroPhoto.style.animationPlayState = entries[0]?.isIntersecting === false ? "paused" : "running";
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