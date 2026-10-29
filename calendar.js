(() => {
  "use strict";

  const escapeICS = value => String(value).replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  // RFC 5545 limits physical lines to 75 octets, not 75 characters.
  const foldLine = value => {
    const encoder = new TextEncoder();
    let result = "", bytes = 0;
    for (const char of value) {
      const size = encoder.encode(char).length;
      if (bytes + size > 75) { result += "\r\n "; bytes = 1; }
      result += char;
      bytes += size;
    }
    return result;
  };
  const toISO = value => value.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, "$1-$2-$3T$4:$5:$6Z");
  const buildICS = (events, { side, date, hostname, timezone, now = new Date() }) => {
    const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//" + hostname + "//Wedding Invitation//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
    for (const event of events) lines.push(
      "BEGIN:VEVENT", "UID:" + side + "-" + (event.uidIndex ?? event.id) + "-" + date + "@" + hostname,
      "DTSTAMP:" + stamp, "DTSTART:" + event.start, "DTEND:" + event.end,
      "SUMMARY:" + escapeICS(event.title), "DESCRIPTION:" + escapeICS(event.note + " (" + timezone + ")"),
      "LOCATION:" + escapeICS(event.place), "END:VEVENT"
    );
    lines.push("END:VCALENDAR");
    return lines.map(foldLine).join("\r\n") + "\r\n";
  };
  const providerURL = (provider, event, timezone) => {
    const url = new URL(provider === "google" ? "https://calendar.google.com/calendar/render" : "https://outlook.live.com/calendar/0/deeplink/compose");
    const details = event.note + "\n" + timezone;
    const fields = provider === "google"
      ? { action:"TEMPLATE", text:event.title, dates:event.start + "/" + event.end, details, location:event.place }
      : { path:"/calendar/action/compose", rru:"addevent", subject:event.title, startdt:toISO(event.start), enddt:toISO(event.end), body:details, location:event.place };
    for (const [key, value] of Object.entries(fields)) url.searchParams.set(key, value);
    return url.href.replace(/\+/g, "%20");
  };
  const recommendedProvider = ({ platform = "", userAgent = "" } = {}) => {
    const device = platform + " " + userAgent;
    if (/iPhone|iPad|iPod|Mac/i.test(device)) return "native";
    if (/Android/i.test(device)) return "google";
    if (/Win/i.test(device)) return "outlook";
    return "native";
  };
  if (typeof module === "object" && module.exports) {
    module.exports = { buildICS, providerURL, recommendedProvider };
    return;
  }

  const dialog = document.getElementById("calendarDialog");
  if (!dialog || !window.WeddingI18n) return;
  const info = window.WEDDING_INFO;
  const tr = key => window.WeddingI18n.t(key);
  const eventSelect = document.getElementById("calendarEvent");
  const eventField = document.getElementById("calendarEventField");
  const native = document.getElementById("calendarNative");
  const share = document.getElementById("calendarShare");
  const all = document.getElementById("calendarAll");
  const close = document.getElementById("calendarClose");
  const status = document.getElementById("calendarStatus");
  const platform = navigator.userAgentData?.platform || navigator.platform || "";
  const apple = /iPhone|iPad|iPod|Mac/i.test(platform + " " + navigator.userAgent);
  const recommended = recommendedProvider({ platform, userAgent:navigator.userAgent });
  const suggested = document.getElementById("calendarSuggested");
  const other = document.getElementById("calendarOther");
  const otherOptions = document.getElementById("calendarOtherOptions");
  const appRows = [...dialog.querySelectorAll("[data-calendar-app]")];
  let side = null, schedule = null, returnFocus = null, generation = 0;

  const utc = (party, time) => new Date(info.parties[party].date + "T" + time + ":00" + info.site.timezone)
    .toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const buildSchedule = party => {
    const details = info.parties[party];
    const single = party === "single";
    const kinds = single ? ["reception"] : ["ceremony", "reception"];
    return {
      filename:tr("calendar." + party + "File"),
      events:kinds.map(kind => {
        const title = kind === "ceremony" ? "Ceremony" : "Reception";
        const place = single ? "singleReceptionPlace" : party === "bride" ? "bride" + title + "Place" : "groomPlace";
        return {
          id:kind, uidIndex:single || kind === "ceremony" ? 0 : 1, title:tr("calendar." + party + title + "Title"),
          start:utc(party, details[kind + "Time"]), end:utc(party, details[kind + "End"]),
          place:tr("calendar." + place), note:tr("calendar." + party + title + "Note"),
          time:details[kind + "Time"]
        };
      })
    };
  };
  const selectedEvent = () => schedule?.events[Number(eventSelect.value) || 0];
  const fileFor = (whole = false) => {
    const events = whole ? schedule.events : [selectedEvent()];
    const name = whole || schedule.events.length === 1 ? schedule.filename
      : schedule.filename.replace(/\.ics$/i, "-" + selectedEvent().id + ".ics");
    const body = buildICS(events, { side, date:info.parties[side].date, hostname:new URL(info.site.url).hostname, timezone:tr("calendar.timezone") });
    return new File([body], name, { type:"text/calendar;charset=utf-8" });
  };
  const download = whole => {
    const file = fileFor(whole);
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    status.textContent = tr("calendar.fileHint");
  };
  const updateChoices = () => {
    if (!schedule) return;
    generation++;
    status.textContent = "";
    const event = selectedEvent();
    document.getElementById("calendarEventPlace").textContent = event.place;
    for (const provider of ["google", "outlook"]) {
      document.getElementById("calendar" + (provider === "google" ? "Google" : "Outlook")).href = providerURL(provider, event, tr("calendar.timezone"));
    }
    document.getElementById("calendarNativeLabel").textContent = tr(apple ? "calendar.apple" : "calendar.device");
    all.hidden = schedule.events.length < 2;
    let canShare = false;
    try { canShare = Boolean(navigator.share && navigator.canShare?.({ files:[fileFor()] })); } catch (_) {}
    share.hidden = !canShare;
    appRows.forEach(row => {
      const preferred = row.dataset.calendarApp === recommended;
      row.classList.toggle("is-recommended", preferred);
      (preferred ? suggested : otherOptions).append(row);
    });
  };
  const updateSchedule = () => {
    const previous = selectedEvent()?.id;
    schedule = buildSchedule(side);
    eventSelect.replaceChildren(...schedule.events.map((event, index) => {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = tr("calendar." + event.id) + " · " + event.time;
      return option;
    }));
    const index = schedule.events.findIndex(event => event.id === previous);
    eventSelect.value = String(index >= 0 ? index : schedule.events.length - 1);
    eventField.hidden = schedule.events.length === 1;
    document.getElementById("calendarSummary").textContent = info.parties[side].date.split("-").reverse().join("/");
    updateChoices();
  };
  const finish = () => {
    generation++;
    document.body.classList.remove("calendar-open");
    returnFocus?.focus({ preventScroll:true });
    returnFocus = null;
  };
  const closeDialog = () => {
    if (typeof dialog.close === "function") dialog.close();
    else { dialog.removeAttribute("open"); finish(); }
  };
  document.querySelectorAll("[data-calendar]").forEach(button => button.addEventListener("click", () => {
    if (!["bride", "groom", "single"].includes(button.dataset.calendar)) return;
    side = button.dataset.calendar;
    schedule = null;
    returnFocus = button;
    other.open = false;
    window.WeddingControlHub?.close(false);
    updateSchedule();
    document.body.classList.add("calendar-open");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    close.focus({ preventScroll:true });
  }));
  eventSelect.addEventListener("change", updateChoices);
  native.addEventListener("click", () => download(false));
  all.addEventListener("click", () => download(true));
  close.addEventListener("click", closeDialog);
  dialog.addEventListener("close", finish);
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog();
  });
  dialog.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); closeDialog(); }
  });
  share.addEventListener("click", async () => {
    const current = generation;
    try {
      await navigator.share({ files:[fileFor()], title:selectedEvent().title });
      // Opening an app is not confirmation that the guest saved the event.
    } catch (error) {
      if (current === generation && dialog.open && error?.name !== "AbortError") status.textContent = tr("calendar.shareFail");
    }
  });
  document.addEventListener("wedding:languagechange", () => {
    if (dialog.open) updateSchedule();
  });
})();
