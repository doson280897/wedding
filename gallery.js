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
  const lightbox = document.getElementById("albumLightbox");
  const lightboxStage = document.getElementById("albumLightboxStage");
  const lightboxImage = document.getElementById("albumLightboxImage");
  const lightboxCounter = document.getElementById("albumLightboxCounter");
  const lightboxClose = document.getElementById("albumLightboxClose");
  const lightboxPrev = document.getElementById("albumLightboxPrev");
  const lightboxNext = document.getElementById("albumLightboxNext");
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

  function versionedAsset(photo) {
    const url = new URL(photo.src, document.baseURI);
    url.searchParams.set("v", photo.v || buildId);
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
  let lastTouchTap = { time:0, index:-1 };
  let lightboxIndex = 0;
  let lightboxReturnFocus = null;
  let lightboxPointer = null;
  const decodeQueue = [];
  let activeDecodes = 0;
  const MAX_DECODE_CONCURRENCY = 4;

  const wrap = index => ((index % photos.length) + photos.length) % photos.length;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function slideCenterAt(index) {
    const slide = slides[index]?.slide;
    return slide ? slide.offsetLeft + slide.offsetWidth / 2 : 0;
  }

  function preserveViewportAnchor(mutator) {
    if (!slides.length || recentering) {
      mutator();
      return;
    }
    const anchorIndex = nearestSlotIndex();
    const anchor = slides[anchorIndex]?.slide;
    const before = anchor ? anchor.offsetLeft + anchor.offsetWidth / 2 : 0;
    mutator();
    const after = anchor ? anchor.offsetLeft + anchor.offsetWidth / 2 : before;
    viewport.scrollLeft += after - before;
  }

  function applyItemRatio(item, ratio, preserve = true) {
    if (!item?.slide || !item.card) return;
    const safeRatio = clamp(Number(ratio) || .78, .56, 1.9);
    item.ratio = safeRatio;

    const resize = () => {
      const cardHeight = item.card.getBoundingClientRect().height || (viewport.clientWidth < 700 ? 360 : 460);
      const imageHeight = Math.max(150, cardHeight - 27);
      const compact = viewport.clientWidth < 700;
      const minWidth = compact ? Math.min(172, viewport.clientWidth * .46) : 190;
      const maxWidth = compact ? viewport.clientWidth * .84 : Math.min(650, viewport.clientWidth * .70);
      const width = clamp(imageHeight * safeRatio, minWidth, maxWidth);
      item.slide.style.width = width + "px";
    };

    if (preserve) preserveViewportAnchor(resize);
    else resize();
  }

  function refreshAdaptiveWidths() {
    slides.forEach(item => {
      const photo = photos[item.photoIndex];
      applyItemRatio(item, photo?.ratio || item.ratio || .78, false);
    });
  }

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
    if (lightbox && !lightbox.hidden) updateLightbox();
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
    // The ring is intentionally bounded to 31 nodes, so eagerly fetching all
    // ring images prevents blank frames during a strong native flick.
    img.loading = "eager";
    img.fetchPriority = Math.abs(slotIndex - centerSlot) <= 4 ? "high" : "auto";

    const label = document.createElement("span");
    label.className = "album-card-number";

    const item = { slide, card, img, label, photoIndex:-1, ratio:.78, tapStart:null };

    img.addEventListener("load", () => {
      if (item.photoIndex < 0 || !img.naturalWidth || !img.naturalHeight) return;
      const ratio = img.naturalWidth / img.naturalHeight;
      const photo = photos[item.photoIndex];
      if (photo) photo.ratio = ratio;
      applyItemRatio(item, ratio, true);
      warmDecode(img);
      requestDepthRender();
    });

    slide.addEventListener("dblclick", event => {
      if (item.photoIndex < 0) return;
      event.preventDefault();
      openLightbox(item.photoIndex, slide);
    });

    slide.addEventListener("pointerdown", event => {
      if (event.pointerType === "mouse") return;
      item.tapStart = { x:event.clientX, y:event.clientY, time:performance.now() };
    }, { passive:true });

    slide.addEventListener("pointerup", event => {
      if (event.pointerType === "mouse" || !item.tapStart || item.photoIndex < 0) return;
      const start = item.tapStart;
      item.tapStart = null;
      const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (moved > 14 || performance.now() - start.time > 420) return;

      const now = performance.now();
      if (lastTouchTap.index === item.photoIndex && now - lastTouchTap.time < 330) {
        lastTouchTap = { time:0, index:-1 };
        openLightbox(item.photoIndex, slide);
      } else {
        lastTouchTap = { time:now, index:item.photoIndex };
      }
    }, { passive:true });

    card.append(img, label);
    slide.append(card);
    space.append(slide);

    return item;
  }

  function pumpDecodeQueue() {
    while (activeDecodes < MAX_DECODE_CONCURRENCY && decodeQueue.length) {
      const img = decodeQueue.shift();
      if (!img?.decode || !img.isConnected) continue;
      activeDecodes++;
      img.decode().catch(() => {}).finally(() => {
        activeDecodes--;
        pumpDecodeQueue();
      });
    }
  }

  function warmDecode(img) {
    if (!img?.decode || decodeQueue.includes(img)) return;
    decodeQueue.push(img);
    pumpDecodeQueue();
  }

  function setPhoto(item, photoIndex) {
    const nextIndex = wrap(photoIndex);
    if (item.photoIndex === nextIndex) return;
    item.photoIndex = nextIndex;
    const photo = photos[nextIndex];
    applyItemRatio(item, photo?.ratio || .78, !recentering);
    item.img.src = versionedAsset(photo);
    item.label.textContent = `${String(nextIndex + 1).padStart(2, "0")} / ${String(photos.length).padStart(2, "0")}`;
    warmDecode(item.img);
  }

  function syncWindowSources() {
    const order = [centerSlot];
    for (let distance = 1; distance <= centerSlot; distance++) {
      if (centerSlot - distance >= 0) order.push(centerSlot - distance);
      if (centerSlot + distance < slides.length) order.push(centerSlot + distance);
    }
    order.forEach(slotIndex => {
      const item = slides[slotIndex];
      setPhoto(item, settledIndex + slotIndex - centerSlot);
      const distance = Math.abs(slotIndex - centerSlot);
      item.img.fetchPriority = distance <= 4 ? "high" : "auto";
      item.slide.dataset.slot = String(slotIndex);
    });
  }

  function refreshLayoutMetrics() {
    if (!slides.length) return;
    refreshAdaptiveWidths();
  }

  function nearestSlotIndex() {
    if (!slides.length) return centerSlot;
    const center = viewport.scrollLeft + viewport.clientWidth / 2;
    let nearest = 0;
    let best = Infinity;
    for (let index = 0; index < slides.length; index++) {
      const distance = Math.abs(slideCenterAt(index) - center);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    }
    return nearest;
  }

  function targetScrollLeft(slotIndex) {
    if (!slides.length) return viewport.scrollLeft;
    slotIndex = clamp(slotIndex, 0, slides.length - 1);
    return slideCenterAt(slotIndex) - viewport.clientWidth / 2;
  }

  function scrollToSlot(slotIndex, behavior = "smooth") {
    if (!slides.length) return;
    slotIndex = clamp(slotIndex, 0, slides.length - 1);
    viewport.scrollTo({
      left: targetScrollLeft(slotIndex),
      behavior: reducedMotion ? "auto" : behavior
    });
  }


  let lastActiveStart = -1;
  let lastActiveEnd = -1;

  function hideOutsideActiveZone(start, end) {
    if (lastActiveStart < 0) {
      slides.forEach((item, index) => {
        if (index >= start && index <= end) return;
        item.card.style.opacity = "0";
        item.card.style.transform = "translate3d(0,34px,-220px) scale(.8)";
        item.card.classList.remove("is-main");
        item.slide.classList.remove("is-active-zone");
        item.slide.style.zIndex = "1";
      });
    } else {
      for (let index = lastActiveStart; index <= lastActiveEnd; index++) {
        if (index >= start && index <= end) continue;
        const item = slides[index];
        if (!item) continue;
        item.card.style.opacity = "0";
        item.card.style.transform = "translate3d(0,34px,-220px) scale(.8)";
        item.card.classList.remove("is-main");
        item.slide.classList.remove("is-active-zone");
        item.slide.style.zIndex = "1";
      }
    }
    lastActiveStart = start;
    lastActiveEnd = end;
  }

  function renderDepth() {
    scrollFrame = 0;
    if (!slides.length) return;

    const compact = viewport.clientWidth < 700;
    const viewportCenter = viewport.scrollLeft + viewport.clientWidth / 2;
    const anchorIndex = nearestSlotIndex();
    const activeRadius = compact ? 5 : 6;
    const start = Math.max(0, anchorIndex - activeRadius);
    const end = Math.min(slides.length - 1, anchorIndex + activeRadius);
    hideOutsideActiveZone(start, end);

    const depthUnit = compact
      ? Math.max(170, viewport.clientWidth * .52)
      : Math.max(235, Math.min(360, viewport.clientWidth * .29));

    for (let index = start; index <= end; index++) {
      const item = slides[index];
      const relative = (slideCenterAt(index) - viewportCenter) / depthUnit;
      const abs = Math.abs(relative);

      if (abs > 4.8) {
        item.card.style.opacity = "0";
        item.card.style.transform = "translate3d(0,34px,-240px) scale(.8)";
        item.card.classList.remove("is-main");
        item.slide.classList.remove("is-active-zone");
        item.slide.style.zIndex = "1";
        continue;
      }

      const y = Math.min(abs * abs * (compact ? 7 : 9), compact ? 30 : 40);
      const z = -Math.min(abs * abs * (compact ? 46 : 58), compact ? 205 : 280);
      const ry = clamp(-relative * (compact ? 10 : 9), -32, 32);
      const rz = clamp(relative * (compact ? .38 : .30), -1.4, 1.4);
      const scale = Math.max(compact ? .83 : .85, 1 - abs * (compact ? .06 : .05));
      const opacity = Math.max(.24, 1 - abs * .18);

      item.card.style.opacity = String(opacity);
      item.card.style.transform = `translate3d(0,${y}px,${z}px) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${scale})`;
      item.card.classList.toggle("is-main", abs < .34);
      item.slide.classList.add("is-active-zone");
      item.slide.style.zIndex = String(70 - Math.round(abs * 9));
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
    const selectedItem = slides[clamp(centerSlot + delta, 0, slides.length - 1)];
    const beforeSelectedCenter = selectedItem
      ? selectedItem.slide.offsetLeft + selectedItem.slide.offsetWidth / 2
      : 0;
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
    lastActiveStart = -1;
    lastActiveEnd = -1;

    refreshAdaptiveWidths();
    const afterSelectedCenter = selectedItem
      ? selectedItem.slide.offsetLeft + selectedItem.slide.offsetWidth / 2
      : beforeSelectedCenter;

    // Variable-width cards: compensate by the selected card's actual pixel
    // displacement, not by a fixed step.
    viewport.scrollLeft = before + (afterSelectedCenter - beforeSelectedCenter);
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

  function updateLightbox() {
    if (!photos.length || !lightboxImage || !lightboxCounter) return;
    lightboxIndex = wrap(lightboxIndex);
    const photo = photos[lightboxIndex];
    lightboxImage.src = versionedAsset(photo);
    lightboxImage.alt = tr("album.fullscreenPhotoAlt")
      .replace("{current}", String(lightboxIndex + 1))
      .replace("{total}", String(photos.length));
    lightboxCounter.textContent = `${String(lightboxIndex + 1).padStart(2, "0")} / ${String(photos.length).padStart(2, "0")}`;

    [-1, 1].forEach(delta => {
      const neighbor = new Image();
      neighbor.decoding = "async";
      neighbor.src = versionedAsset(photos[wrap(lightboxIndex + delta)]);
    });
  }

  function openLightbox(index, returnFocus = null) {
    if (!lightbox || !photos.length) return;
    lightboxIndex = wrap(index);
    lightboxReturnFocus = returnFocus || document.activeElement;
    updateLightbox();
    lightbox.hidden = false;
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("album-lightbox-open");
    requestAnimationFrame(() => lightboxClose?.focus({ preventScroll:true }));
  }

  function closeLightbox() {
    if (!lightbox || lightbox.hidden) return;
    lightbox.hidden = true;
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("album-lightbox-open");
    lightboxPointer = null;
    if (lightboxImage) lightboxImage.removeAttribute("src");
    lightboxReturnFocus?.focus?.({ preventScroll:true });
    lightboxReturnFocus = null;
  }

  function stepLightbox(delta) {
    if (!photos.length) return;
    lightboxIndex = wrap(lightboxIndex + delta);
    updateLightbox();
  }

  lightboxClose?.addEventListener("click", closeLightbox);
  lightboxPrev?.addEventListener("click", () => stepLightbox(-1));
  lightboxNext?.addEventListener("click", () => stepLightbox(1));

  lightboxStage?.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    lightboxPointer = { id:event.pointerId, x:event.clientX, y:event.clientY };
    lightboxStage.setPointerCapture?.(event.pointerId);
  });

  lightboxStage?.addEventListener("pointerup", event => {
    if (!lightboxPointer || event.pointerId !== lightboxPointer.id) return;
    const dx = event.clientX - lightboxPointer.x;
    const dy = event.clientY - lightboxPointer.y;
    lightboxPointer = null;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
    stepLightbox(dx < 0 ? 1 : -1);
  });

  lightboxStage?.addEventListener("pointercancel", () => {
    lightboxPointer = null;
  });

  document.addEventListener("keydown", event => {
    if (!lightbox || lightbox.hidden) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeLightbox();
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      stepLightbox(-1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      stepLightbox(1);
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = [lightboxClose, lightboxPrev, lightboxNext].filter(Boolean);
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
    if (lightbox && !lightbox.hidden) return;
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
      refreshLayoutMetrics();
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
      refreshLayoutMetrics();
      centerCurrentWithoutAnimation();
    }, 90);
  });

  async function start() {
    setStatus("album.loading");
    try {
      const manifestUrl = new URL("./images/manifest.json", document.baseURI);
      manifestUrl.searchParams.set("v", buildId);
      manifestUrl.searchParams.set("t", String(Date.now()));
      const response = await fetch(manifestUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const manifest = await response.json();
      const list = Array.isArray(manifest) ? manifest : manifest.photos;
      if (!Array.isArray(list)) throw new Error("Invalid manifest");

      photos = list
        .filter(photo => photo && typeof photo.src === "string" && photo.src)
        .map(photo => {
          const width = Number(photo.width);
          const height = Number(photo.height);
          return {
            ...photo,
            ratio: width > 0 && height > 0 ? width / height : Number(photo.ratio) || 0
          };
        });
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
    }, { rootMargin:"1400px 0px", threshold:0 });
    lazyObserver.observe(albumSection);
  } else {
    start();
  }
})();