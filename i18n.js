(() => {
  "use strict";
  // All user-specific information and both language dictionaries live in wedding-info.js.
  const info = window.WEDDING_INFO;
  if (!info?.couple || !info?.parties || !info?.text) {
    console.error("Missing wedding-info.js — load it before i18n.js");
    return;
  }
  const translations = info.text;
  const pad2 = value => String(value).padStart(2, "0");
  const dateParts = side => {
    const [year, month, day] = String(info.parties[side]?.date || "").split("-").map(Number);
    return { year, month, day };
  };
  const formatDate = (side, style = "dots", localeCode = "vi") => {
    const { year, month, day } = dateParts(side);
    if (!year || !month || !day) return "";
    if (style === "spaced") return [pad2(day), pad2(month), year].join(" · ");
    if (style === "slashes") return [pad2(day), pad2(month), year].join("/");
    if (style === "english") return new Intl.DateTimeFormat("en-US", { dateStyle:"long", timeZone:"UTC" })
      .format(new Date(Date.UTC(year, month - 1, day)));
    if (style === "weekday") {
      const lang = localeCode === "en" ? "en-US" : "vi-VN";
      return new Intl.DateTimeFormat(lang, { weekday:"long", timeZone:"UTC" })
        .format(new Date(Date.UTC(year, month - 1, day))).toLocaleUpperCase(lang);
    }
    return [pad2(day), pad2(month), year].join(".");
  };
  const getInfo = (path, language = locale) => {
    const name = String(path || "").trim();
    const derivedName = /^couple\.(bride|groom)\.fullUpper$/.exec(name);
    if (derivedName) return info.couple[derivedName[1]].full.toLocaleUpperCase("vi-VN");
    const derivedSlug = /^couple\.(bride|groom)\.slug$/.exec(name);
    if (derivedSlug) return String(info.couple[derivedSlug[1]].short).normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const derivedDate = /^parties\.(bride|groom|single)\.(dateDots|dateSlashes|dateEnglish|dateSpaced|dateYear|weekday)$/.exec(name);
    if (derivedDate) {
      if (derivedDate[2] === "dateYear") return String(dateParts(derivedDate[1]).year);
      const styles = {dateDots:"dots",dateSlashes:"slashes",dateEnglish:"english",dateSpaced:"spaced",weekday:"weekday"};
      return formatDate(derivedDate[1], styles[derivedDate[2]], language);
    }
    const value = name.split(".").reduce((node, key) => node == null ? undefined : node[key], info);
    if (value && typeof value === "object" && ("vi" in value || "en" in value))
      return renderText(value[language] ?? value.vi ?? "", language);
    return value == null ? "" : renderText(String(value), language);
  };
  const renderText = (template, language = locale) =>
    String(template ?? "").replace(/\{\{([\w.]+)\}\}/g, (_, path) => getInfo(path, language));
  const prefs = window.WeddingPreferences;
  // On an ordinary new tab the default is VN. An explicit ?lang=en link
  // intentionally remains English, and a user's choice persists on F5.
  let locale = prefs?.getLanguage() || "vi";

  const t = key => renderText((translations[locale] && translations[locale][key]) || translations.vi[key] || key);
  const build = document.querySelector('meta[name="wedding-build"]')?.content;
  const withVersion = value => {
    const url = new URL(value, document.baseURI);
    if (build && build !== "__BUILD_ID__") url.searchParams.set("v", build);
    return url;
  };
  const safeCssUrl = value =>
    'url("' + withVersion(value).href.replace(/["\\\n\r]/g, "") + '")';

  function apply() {
    document.documentElement.lang = locale;
    document.title = t("page.title");
    document.querySelectorAll("[data-i18n]").forEach(node => {
      node.textContent = t(node.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(node => {
      node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
    });
    document.querySelectorAll("[data-i18n-html]").forEach(node => {
      node.innerHTML = t(node.dataset.i18nHtml);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(node => {
      node.setAttribute("aria-label", t(node.dataset.i18nAria));
    });
    document.querySelectorAll("[data-i18n-alt]").forEach(node => {
      node.setAttribute("alt", t(node.dataset.i18nAlt));
    });
    document.querySelectorAll("[data-i18n-title]").forEach(node => {
      node.setAttribute("title", t(node.dataset.i18nTitle));
    });
    // Static placeholders for personal information, images and map links.
    document.querySelectorAll("[data-info]").forEach(node => {
      node.textContent = getInfo(node.dataset.info);
    });
    document.querySelectorAll("[data-info-src]").forEach(node => {
      // Only load the active celebration's QR; dormant bride/groom/single
      // panels must not fetch unrelated clients' bank QR images.
      const scope = node.closest("[data-party-scope]")?.dataset.partyScope;
      if (scope && scope !== document.documentElement.dataset.party) return;
      const src = getInfo(node.dataset.infoSrc);
      if (!src) return;
      const url = withVersion(src);
      // Story photos retain their full-size fallback. Let the browser select
      // a correctly sized source before assigning src, avoiding a large first
      // request followed by a second request for the responsive candidate.
      if (node.dataset.infoResponsive) {
        const image = node.dataset.infoResponsive.split(".").reduce(
          (value, key) => value?.[key], info);
        if (image && Array.isArray(image.variants)) {
          if (image.width > 0 && image.height > 0) {
            node.width = image.width;
            node.height = image.height;
          }
          if (image.sizes) node.sizes = image.sizes;
          const srcset = image.variants.filter(item => item.src && item.width > 0)
            .map(item => withVersion(item.src).href + " " + item.width + "w").join(", ");
          if (srcset && node.getAttribute("srcset") !== srcset) node.srcset = srcset;
        }
      }
      // QR codes belong to a hidden popup; defer their download until opened.
      if (node.classList.contains("gift-qr") &&
          document.getElementById("wgModal")?.hidden) {
        node.dataset.src = url.href;
        return;
      }
      if (node.getAttribute("src") !== url.href) node.src = url.href;
    });
    document.querySelectorAll("[data-info-href]").forEach(node => {
      const href = getInfo(node.dataset.infoHref);
      if (href && node.getAttribute("href") !== href) node.href = href;
    });
    document.querySelectorAll("[data-info-alt]").forEach(node => {
      node.setAttribute("alt", getInfo(node.dataset.infoAlt));
    });
    document.querySelectorAll("[data-info-embed]").forEach(node => {
      const src = getInfo(node.dataset.infoEmbed);
      if (src && node.dataset.src !== src) node.dataset.src = src;
    });
    document.querySelectorAll("[data-party-date]").forEach(node => {
      const style = "dots";
      node.textContent = formatDate(node.dataset.partyDate, style);
    });
    document.querySelectorAll("[data-party-event-date]").forEach(node => {
      node.textContent = formatDate(node.dataset.partyEventDate);
    });
    document.querySelectorAll("[data-party-weekday]").forEach(node => {
      node.textContent = formatDate(node.dataset.partyWeekday, "weekday", locale);
    });
    for (const side of ["bride", "groom", "single"]) {
      const img = getInfo("parties." + side + ".images.hero");
      const ending = getInfo("parties." + side + ".images.ending");
      if (img) document.documentElement.style.setProperty("--hero-" + side + "-image", safeCssUrl(img));
      if (ending) document.documentElement.style.setProperty("--ending-" + side + "-image", safeCssUrl(ending));
    }
    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta) descMeta.content = getInfo("site.description");
    document.querySelectorAll("[data-lang]").forEach(button => {
      const active = button.dataset.lang === locale;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function setLocale(next, persist = true) {
    if (next !== "vi" && next !== "en") return;
    locale = next;
    if (persist) prefs?.setLanguage(locale);
    apply();
    document.dispatchEvent(new CustomEvent("wedding:languagechange", {detail:{locale}}));
  }

  window.WeddingI18n = { t, getLocale: () => locale, setLocale, getInfo, formatDate, info };
  document.querySelectorAll("[data-lang]").forEach(button => {
    button.addEventListener("click", () => setLocale(button.dataset.lang));
  });
  apply();
})();