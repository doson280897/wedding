(() => {
  "use strict";

  // The generator lives inside index.html. No navigation or new language control
  // is created when opening this view; the original floating control stays mounted.
  const screen = document.getElementById("linkToolScreen");
  const entry = document.querySelector(".party-admin-link");
  const back = document.getElementById("linkToolBack");
  const form = document.getElementById("linkToolForm");
  if (!screen || !entry || !back || !form) return;

  const i18n = window.WeddingI18n;
  const t = (key) => (i18n ? i18n.t(key) : key);
  const coupleLabel = () =>
    window.WEDDING_INFO.couple.bride.short + " & " + window.WEDDING_INFO.couple.groom.short;
  const guestInput = document.getElementById("linkToolGuest");
  const partySelect = document.getElementById("linkToolParty");
  const singleMode = window.WEDDING_INFO.wedding?.mode === "single";
  // Remove unavailable choices: iOS's native picker can still list an option
  // marked hidden/disabled, so CSS/attributes alone leak the template option.
  [...partySelect.options].forEach((option) => {
    const available = singleMode
      ? option.value === "single"
      : option.value === "bride" || option.value === "groom";
    if (!available) option.remove();
  });
  if (singleMode) partySelect.value = "single";
  const result = document.getElementById("linkToolResult");
  const generated = document.getElementById("linkToolGenerated");
  const preview = document.getElementById("linkToolPreview");
  const copy = document.getElementById("linkToolCopy");
  const share = document.getElementById("linkToolShare");
  const feedback = document.getElementById("linkToolFeedback");
  const partySelector = document.getElementById("partySelector");
  const settingsControls = () => {
    const trigger = document.getElementById("settingsTrigger");
    const panel = document.getElementById("settingsPanel");
    return [trigger, ...(!panel?.hidden ? panel.querySelectorAll("button") : [])];
  };

  let invitation = "";
  let feedbackKey = "";
  let previouslyFocused = null;

  const isToolUrl = () => new URLSearchParams(location.search).get("tool") === "links";

  function setFeedback(key) {
    feedbackKey = key;
    feedback.textContent = key ? t(key) : "";
  }

  function buildInvitation() {
    const name = guestInput.value.replace(/\s+/g, " ").trim().slice(0, 100);
    const party = singleMode ? "single" : partySelect.value;
    if (
      !name ||
      !["bride", "groom", "single"].includes(party) ||
      (!singleMode && party === "single")
    ) {
      setFeedback("link.invalid");
      return false;
    }

    // Links sent to guests always open the actual invitation, never this tool.
    const url = new URL("index.html", new URL("./", location.href));
    url.searchParams.set("to", name);
    if (singleMode) url.searchParams.delete("party");
    else url.searchParams.set("party", party);
    url.searchParams.set("lang", i18n?.getLocale() || "vi");

    invitation = url.href;
    generated.textContent = invitation;
    preview.href = invitation;
    result.hidden = false;
    share.hidden = typeof navigator.share !== "function";
    return true;
  }

  function updateView() {
    const open = isToolUrl();
    const wasOpen = !screen.hidden;
    if (open === wasOpen) return;

    screen.hidden = !open;
    screen.setAttribute("aria-hidden", String(!open));
    document.documentElement.classList.toggle("link-tool-active", open);
    if (partySelector) {
      partySelector.inert = open;
      partySelector.setAttribute("aria-hidden", String(open));
    }
    if (open) {
      previouslyFocused = document.activeElement;
      document.title = t("link.title") + " | " + coupleLabel();
      requestAnimationFrame(() => guestInput.focus({ preventScroll: true }));
    } else {
      const party = new URLSearchParams(location.search).get("party");
      document.title = t(
        singleMode
          ? "page.titleSingle"
          : party === "bride"
            ? "page.titleBride"
            : party === "groom"
              ? "page.titleGroom"
              : "page.title",
      );
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      } else {
        entry.focus({ preventScroll: true });
      }
    }
  }

  entry.addEventListener("click", (event) => {
    if (
      event.defaultPrevented ||
      (event.button != null && event.button !== 0) ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey
    )
      return;
    event.preventDefault();
    if (isToolUrl()) return;
    const url = new URL(location.href);
    url.searchParams.set("tool", "links");
    url.hash = "";
    history.pushState({ ...(history.state || {}), weddingLinkTool: true }, "", url);
    updateView();
  });

  back.addEventListener("click", () => {
    if (history.state?.weddingLinkTool) {
      history.back();
      return;
    }
    const url = new URL(location.href);
    url.searchParams.delete("tool");
    if (singleMode) {
      // The single invitation is a direct root URL (no party chooser).
      // Reload it so the temporary wax gate is initialized.
      history.replaceState(history.state, "", url);
      location.reload();
      return;
    }
    history.replaceState(history.state, "", url);
    updateView();
  });

  window.addEventListener("popstate", updateView);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (buildInvitation()) setFeedback("");
  });

  copy.addEventListener("click", async () => {
    if (!invitation) return;
    try {
      await navigator.clipboard.writeText(invitation);
      setFeedback("link.copied");
    } catch (_) {
      const textarea = document.createElement("textarea");
      textarea.value = invitation;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      let success = false;
      try {
        success = document.execCommand("copy");
      } catch (_) {}
      textarea.remove();
      setFeedback(success ? "link.copied" : "link.copyFail");
    }
  });

  share.addEventListener("click", async () => {
    if (!invitation || typeof navigator.share !== "function") return;
    try {
      await navigator.share({ title: t("page.title"), url: invitation });
    } catch (error) {
      if (error?.name !== "AbortError") setFeedback("link.shareFail");
    }
  });

  if (singleMode) {
    // There is only one celebration to invite guests to.
    partySelect.value = "single";
    const description = document.querySelector(".link-tool-description");
    const brand = document.querySelector(".link-tool-eyebrow");
    if (brand) brand.dataset.i18n = "link.brandSingle";
    if (description) description.dataset.i18n = "link.singleDescription";
    back.dataset.i18n = "link.singleBack";
    back.dataset.i18nAria = "link.singleBackAria";
    const updateSingleLabels = () => {
      if (brand) brand.textContent = t("link.brandSingle");
      if (description) description.textContent = t("link.singleDescription");
      back.textContent = t("link.singleBack");
      back.setAttribute("aria-label", t("link.singleBackAria"));
    };
    updateSingleLabels();
    document.addEventListener("wedding:languagechange", updateSingleLabels);
  }

  document.addEventListener("wedding:languagechange", () => {
    if (!result.hidden) {
      const oldFeedbackKey = feedbackKey;
      if (buildInvitation()) setFeedback(oldFeedbackKey);
    } else if (feedbackKey) {
      setFeedback(feedbackKey);
    }
    if (!screen.hidden) document.title = t("link.title") + " | " + coupleLabel();
  });

  // The in-page dialog remains keyboard accessible alongside the ONE
  // floating VN/EN control that belongs to the main document.
  document.addEventListener("keydown", (event) => {
    if (screen.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      back.click();
      return;
    }
    if (event.key !== "Tab") return;
    const fields = [
      ...settingsControls(),
      back,
      guestInput,
      partySelect,
      form.querySelector('button[type="submit"]'),
      ...(!result.hidden ? [copy, share, preview] : []),
    ].filter((element) => element && !element.disabled && !element.hidden);
    if (!fields.length) return;
    if (event.shiftKey && document.activeElement === fields[0]) {
      event.preventDefault();
      fields.at(-1).focus();
    } else if (!event.shiftKey && document.activeElement === fields.at(-1)) {
      event.preventDefault();
      fields[0].focus();
    }
  });

  updateView();
})();
