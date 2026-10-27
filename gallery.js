(() => {
  "use strict";

  const viewport = document.getElementById("albumViewport");
  const space = document.getElementById("albumSpace");
  const counter = document.getElementById("albumCount");
  const progress = document.getElementById("albumProgress");
  const status = document.getElementById("albumStatus");
  const editorialCaption = document.getElementById("albumEditorialCaption");
  const captionNumber = document.getElementById("albumCaptionNumber");
  const captionText = document.getElementById("albumCaptionText");
  const tr = key => window.WeddingI18n ? window.WeddingI18n.t(key) : key;

  let statusKey = status?.dataset.statusKey || "album.lazy";
  const setStatus = key => {
    statusKey = key;
    if (status) {
      status.dataset.statusKey = key;
      status.textContent = tr(key);
    }
  };

  if (!viewport || !space) return;

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let photos = [];
  let slides = [];
  let settledIndex = 0;
  let scrollFrame = 0;
  let scrollEndTimer = 0;
  let mouseDrag = null;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function updateEditorialCaption(animate = true) {
    if (!captionNumber || !captionText || !photos.length) return;
    captionNumber.textContent = String(settledIndex + 1).padStart(2, "0");
    captionText.textContent = tr("album.caption." + (settledIndex % 5));
    if (editorialCaption && animate && !reducedMotion) {
      editorialCaption.classList.remove("is-changing");
      void editorialCaption.offsetWidth;
      editorialCaption.classList.add("is-changing");
    }
  }

  function updateProgress(animateCaption = true) {
    if (!photos.length) return;
    if (counter) {
      counter.textContent = `${String(settledIndex + 1).padStart(2, "0")} / ${String(photos.length).padStart(2, "0")}`;
    }
    if (progress) progress.style.width = `${100 * (settledIndex + 1) / photos.length}%`;
    updateEditorialCaption(animateCaption);
  }

  document.addEventListener("wedding:languagechange", () => {
    if (status && !status.hidden) setStatus(statusKey);
    updateEditorialCaption(false);
  });

  function createSlide(photo, index) {
    const slide = document.createElement("div");
    slide.className = "album-slide";
    slide.dataset.index = String(index);
    slide.setAttribute("aria-hidden", "true");

    const card = document.createElement("div");
    card.className = "album-card";

    const img = document.createElement("img");
    img.className = "album-photo";
    img.src = photo.src;
    img.alt = "";
    img.draggable = false;
    img.decoding = "async";
    // Album is initialized before it enters view, so eager loading the optimized
    // thumbnails avoids decode/fetch hitches during a fast native fling.
    img.loading = "eager";
    img.fetchPriority = index < 4 ? "high" : "auto";

    const label = document.createElement("span");
    label.className = "album-card-number";
    label.textContent = `${String(index + 1).padStart(2, "0")} / ${String(photos.length).padStart(2, "0")}`;

    card.append(img, label);
    slide.append(card);
    space.append(slide);
    return { slide, card, img, index };
  }

  function nearestIndex() {
    if (!slides.length) return 0;
    const center = viewport.scrollLeft + viewport.clientWidth / 2;
    let nearest = 0;
    let best = Infinity;
    for (const item of slides) {
      const itemCenter = item.slide.offsetLeft + item.slide.offsetWidth / 2;
      const distance = Math.abs(itemCenter - center);
      if (distance < best) {
        best = distance;
        nearest = item.index;
      }
    }
    return nearest;
  }

  function targetScrollLeft(index) {
    const item = slides[index];
    if (!item) return viewport.scrollLeft;
    return item.slide.offsetLeft + item.slide.offsetWidth / 2 - viewport.clientWidth / 2;
  }

  function scrollToIndex(index, behavior = "smooth") {
    index = clamp(index, 0, slides.length - 1);
    viewport.scrollTo({
      left: targetScrollLeft(index),
      behavior: reducedMotion ? "auto" : behavior
    });
  }

  function renderDepth() {
    scrollFrame = 0;
    if (!slides.length) return;

    const center = viewport.scrollLeft + viewport.clientWidth / 2;
    const compact = viewport.clientWidth < 700;
    const step = slides[0]?.slide.offsetWidth || 1;

    for (const item of slides) {
      const itemCenter = item.slide.offsetLeft + item.slide.offsetWidth / 2;
      const relative = (itemCenter - center) / step;
      const abs = Math.abs(relative);

      if (abs > 4.2) {
        item.card.style.opacity = "0";
        item.card.style.transform = `translate3d(0,36px,-240px) scale(.78)`;
        item.slide.style.zIndex = "1";
        continue;
      }

      const y = Math.min(abs * abs * (compact ? 8 : 10), compact ? 34 : 44);
      const z = -Math.min(abs * abs * (compact ? 46 : 58), compact ? 210 : 280);
      const ry = clamp(-relative * (compact ? 9 : 8), -28, 28);
      const rz = clamp(relative * (compact ? .42 : .32), -1.6, 1.6);
      const scale = Math.max(compact ? .82 : .84, 1 - abs * (compact ? .065 : .055));
      const opacity = Math.max(.22, 1 - abs * .19);

      item.card.style.opacity = String(opacity);
      item.card.style.transform = `translate3d(0,${y}px,${z}px) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${scale})`;
      item.slide.style.zIndex = String(60 - Math.round(abs * 8));
    }
  }

  function requestDepthRender() {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(renderDepth);
  }

  function finishScroll() {
    window.clearTimeout(scrollEndTimer);
    const index = nearestIndex();
    const target = targetScrollLeft(index);

    // CSS scroll-snap is mandatory; this is only a small safety correction for
    // engines that report scroll-end a fraction before the final snap pixel.
    if (Math.abs(viewport.scrollLeft - target) > 2) {
      scrollToIndex(index, "smooth");
      return;
    }

    if (index !== settledIndex) {
      settledIndex = index;
      updateProgress(true);
    }

    slides.forEach((item, itemIndex) => {
      item.card.classList.toggle("is-main", itemIndex === settledIndex);
    });
    viewport.classList.remove("is-scrolling");
    viewport.classList.add("is-settled");
    requestDepthRender();
  }

  function scheduleFallbackScrollEnd() {
    window.clearTimeout(scrollEndTimer);
    scrollEndTimer = window.setTimeout(finishScroll, 150);
  }

  viewport.addEventListener("scroll", () => {
    viewport.classList.add("is-scrolling");
    viewport.classList.remove("is-settled");
    requestDepthRender();
    if (!("onscrollend" in window)) scheduleFallbackScrollEnd();
  }, { passive: true });

  if ("onscrollend" in window) {
    viewport.addEventListener("scrollend", finishScroll, { passive: true });
  }

  // Touch uses native scrolling/momentum. Mouse still gets click-and-drag,
  // but without a second custom physics engine.
  viewport.addEventListener("pointerdown", event => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    mouseDrag = { id:event.pointerId, x:event.clientX, left:viewport.scrollLeft };
    viewport.classList.add("is-dragging");
    viewport.setPointerCapture?.(event.pointerId);
  });

  viewport.addEventListener("pointermove", event => {
    if (!mouseDrag || event.pointerId !== mouseDrag.id) return;
    viewport.scrollLeft = mouseDrag.left - (event.clientX - mouseDrag.x);
  });

  function endMouseDrag(event) {
    if (!mouseDrag || (event.pointerId != null && event.pointerId !== mouseDrag.id)) return;
    mouseDrag = null;
    viewport.classList.remove("is-dragging");
    scrollToIndex(nearestIndex(), "smooth");
  }

  viewport.addEventListener("pointerup", endMouseDrag);
  viewport.addEventListener("pointercancel", endMouseDrag);
  viewport.addEventListener("lostpointercapture", endMouseDrag);

  viewport.addEventListener("keydown", event => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const base = nearestIndex();
    scrollToIndex(base + (event.key === "ArrowRight" ? 1 : -1), "smooth");
  });

  function initialize() {
    space.replaceChildren();
    slides = photos.map(createSlide);
    settledIndex = 0;
    updateProgress(false);

    requestAnimationFrame(() => {
      scrollToIndex(0, "auto");
      renderDepth();
      slides[0]?.card.classList.add("is-main");
      viewport.classList.add("is-settled");
    });
  }

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      scrollToIndex(settledIndex, "auto");
      renderDepth();
    }, 80);
  });

  async function start() {
    setStatus("album.loading");
    try {
      const response = await fetch("./images.json", { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const manifest = await response.json();
      const list = Array.isArray(manifest) ? manifest : manifest.photos;
      if (!Array.isArray(list)) throw new Error("Invalid manifest");

      photos = list.filter(photo => photo && typeof photo.src === "string" && photo.src);
      if (!photos.length) {
        setStatus("album.empty");
        return;
      }

      initialize();
      status.hidden = true;
    } catch (error) {
      console.error(error);
      setStatus("album.error");
    }
  }

  const albumSection = document.getElementById("album") || viewport;
  if ("IntersectionObserver" in window) {
    const lazyObserver = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        lazyObserver.disconnect();
        start();
      }
    }, { rootMargin:"700px 0px", threshold:0 });
    lazyObserver.observe(albumSection);
  } else {
    start();
  }
})();