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
  const RING_SIZE = 31;
  const buildId = document.querySelector('meta[name="wedding-build"]')?.content || "dev";

  function versionedAsset(src) {
    const url = new URL(src, document.baseURI);
    url.searchParams.set("v", buildId);
    return url.href;
  }

  let photos = [];
  let slides = [];
  let centerSlot = Math.floor(RING_SIZE / 2);
  let settledIndex = 0;
  let scrollFrame = 0;
  let scrollEndTimer = 0;
  let mouseDrag = null;
  let recentering = false;

  const wrap = index => ((index % photos.length) + photos.length) % photos.length;
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

  function createSlide(slotIndex) {
    const slide = document.createElement("div");
    slide.className = "album-slide";
    slide.dataset.slot = String(slotIndex);
    slide.setAttribute("aria-hidden", "true");

    const card = document.createElement("div");
    card.className = "album-card";

    const img = document.createElement("img");
    img.className = "album-photo";
    img.alt = "";
    img.draggable = false;
    img.decoding = "async";
    img.loading = Math.abs(slotIndex - centerSlot) <= 6 ? "eager" : "lazy";
    img.fetchPriority = Math.abs(slotIndex - centerSlot) <= 3 ? "high" : "low";

    const label = document.createElement("span");
    label.className = "album-card-number";

    card.append(img, label);
    slide.append(card);
    space.append(slide);

    return { slide, card, img, photoIndex: -1 };
  }

  function setPhoto(item, photoIndex) {
    const nextIndex = wrap(photoIndex);
    if (item.photoIndex === nextIndex) return;
    item.photoIndex = nextIndex;
    item.img.src = versionedAsset(photos[nextIndex].src);
    item.label.textContent = `${String(nextIndex + 1).padStart(2, "0")} / ${String(photos.length).padStart(2, "0")}`;
  }

  function syncWindowSources() {
    slides.forEach((item, slotIndex) => {
      setPhoto(item, settledIndex + slotIndex - centerSlot);
      const distance = Math.abs(slotIndex - centerSlot);
      item.img.fetchPriority = distance <= 3 ? "high" : "low";
      item.slide.dataset.slot = String(slotIndex);
    });
  }

  function nearestSlotIndex() {
    if (!slides.length) return centerSlot;
    const center = viewport.scrollLeft + viewport.clientWidth / 2;
    let nearest = centerSlot;
    let best = Infinity;

    for (let slotIndex = 0; slotIndex < slides.length; slotIndex++) {
      const item = slides[slotIndex];
      const itemCenter = item.slide.offsetLeft + item.slide.offsetWidth / 2;
      const distance = Math.abs(itemCenter - center);
      if (distance < best) {
        best = distance;
        nearest = slotIndex;
      }
    }

    return nearest;
  }

  function targetScrollLeft(slotIndex) {
    const item = slides[slotIndex];
    if (!item) return viewport.scrollLeft;
    return item.slide.offsetLeft + item.slide.offsetWidth / 2 - viewport.clientWidth / 2;
  }

  function scrollToSlot(slotIndex, behavior = "smooth") {
    if (!slides.length) return;
    slotIndex = clamp(slotIndex, 0, slides.length - 1);
    viewport.scrollTo({
      left: targetScrollLeft(slotIndex),
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
        item.card.style.transform = "translate3d(0,36px,-240px) scale(.78)";
        item.card.classList.remove("is-main");
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
      item.card.classList.toggle("is-main", abs < 0.42);
      item.slide.style.zIndex = String(60 - Math.round(abs * 8));
    }
  }

  function requestDepthRender() {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(renderDepth);
  }

  // Seamless ring: rotate only off-screen edge nodes, then compensate the
  // scroll offset by exactly the same physical distance in the SAME JS task.
  // The centered pixels therefore never move; there is no visible "jump back".
  function rotateRingSeamlessly(delta) {
    if (!delta || !slides.length) return;

    recentering = true;
    const step = slides[0].slide.offsetWidth || 1;
    const before = viewport.scrollLeft;
    const oldSnap = viewport.style.scrollSnapType;
    const oldBehavior = viewport.style.scrollBehavior;

    viewport.style.scrollSnapType = "none";
    viewport.style.scrollBehavior = "auto";

    if (delta > 0) {
      for (let i = 0; i < delta; i++) {
        settledIndex = wrap(settledIndex + 1);
        const first = slides.shift();
        slides.push(first);
        space.append(first.slide);
        setPhoto(first, settledIndex + centerSlot);
      }
    } else {
      for (let i = 0; i < -delta; i++) {
        settledIndex = wrap(settledIndex - 1);
        const last = slides.pop();
        slides.unshift(last);
        space.prepend(last.slide);
        setPhoto(last, settledIndex - centerSlot);
      }
    }

    slides.forEach((item, slotIndex) => {
      item.slide.dataset.slot = String(slotIndex);
    });

    // DOM rotation moved the selected card by delta * step. Compensate that
    // exact distance before the browser can paint a frame.
    viewport.scrollLeft = before - delta * step;
    renderDepth();

    requestAnimationFrame(() => {
      viewport.style.scrollSnapType = oldSnap;
      viewport.style.scrollBehavior = oldBehavior;
      recentering = false;
      viewport.classList.remove("is-scrolling");
      viewport.classList.add("is-settled");
      renderDepth();
    });
  }

  function centerCurrentWithoutAnimation() {
    if (!slides.length) return;
    recentering = true;
    const oldSnap = viewport.style.scrollSnapType;
    const oldBehavior = viewport.style.scrollBehavior;
    viewport.style.scrollSnapType = "none";
    viewport.style.scrollBehavior = "auto";
    viewport.scrollLeft = targetScrollLeft(centerSlot);
    renderDepth();
    requestAnimationFrame(() => {
      viewport.style.scrollSnapType = oldSnap;
      viewport.style.scrollBehavior = oldBehavior;
      recentering = false;
      renderDepth();
    });
  }

  function finishScroll() {
    if (recentering || !slides.length) return;
    window.clearTimeout(scrollEndTimer);

    const slotIndex = nearestSlotIndex();
    const target = targetScrollLeft(slotIndex);

    // Mandatory snap normally lands exactly on a card. This correction only
    // handles browsers that fire scrollend a couple of pixels early.
    if (Math.abs(viewport.scrollLeft - target) > 2) {
      scrollToSlot(slotIndex, "smooth");
      return;
    }

    const delta = slotIndex - centerSlot;
    if (delta) {
      rotateRingSeamlessly(delta);
      updateProgress(true);
    } else {
      viewport.classList.remove("is-scrolling");
      viewport.classList.add("is-settled");
      renderDepth();
    }
  }

  function scheduleFallbackScrollEnd() {
    window.clearTimeout(scrollEndTimer);
    scrollEndTimer = window.setTimeout(finishScroll, 160);
  }

  viewport.addEventListener("scroll", () => {
    requestDepthRender();
    if (recentering) return;

    viewport.classList.add("is-scrolling");
    viewport.classList.remove("is-settled");
    if (!("onscrollend" in window)) scheduleFallbackScrollEnd();
  }, { passive: true });

  if ("onscrollend" in window) {
    viewport.addEventListener("scrollend", finishScroll, { passive: true });
  }

  // Touch stays entirely native so iOS/Android keep their own kinetic scrolling.
  // Mouse gets drag support without a second momentum engine.
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
    scrollToSlot(nearestSlotIndex(), "smooth");
  }

  viewport.addEventListener("pointerup", endMouseDrag);
  viewport.addEventListener("pointercancel", endMouseDrag);
  viewport.addEventListener("lostpointercapture", endMouseDrag);

  viewport.addEventListener("keydown", event => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const base = nearestSlotIndex();
    scrollToSlot(base + (event.key === "ArrowRight" ? 1 : -1), "smooth");
  });

  function initialize() {
    space.replaceChildren();
    slides = [];
    settledIndex = 0;

    const slotCount = photos.length === 1 ? 1 : RING_SIZE;
    centerSlot = Math.floor(slotCount / 2);

    for (let slotIndex = 0; slotIndex < slotCount; slotIndex++) {
      slides.push(createSlide(slotIndex));
    }

    syncWindowSources();
    updateProgress(false);

    requestAnimationFrame(() => {
      viewport.style.scrollBehavior = "auto";
      scrollToSlot(centerSlot, "auto");
      viewport.style.scrollBehavior = "";
      renderDepth();
      viewport.classList.add("is-settled");
    });
  }

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      centerCurrentWithoutAnimation();
    }, 90);
  });

  async function start() {
    setStatus("album.loading");
    try {
      const manifestUrl = new URL("./images.json", document.baseURI);
      manifestUrl.searchParams.set("v", buildId);
      manifestUrl.searchParams.set("t", String(Date.now()));
      const response = await fetch(manifestUrl, { cache: "no-store" });
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