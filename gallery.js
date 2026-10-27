(() => {
  "use strict";

  const viewport = document.getElementById("albumViewport");
  const space = document.getElementById("albumSpace");
  const counter = document.getElementById("albumCount");
  const progress = document.getElementById("albumProgress");
  const status = document.getElementById("albumStatus");
  const editorialCaption = document.getElementById("albumEditorialCaption");
  const captionText = document.getElementById("albumCaptionText");

  const lightbox = document.getElementById("albumLightbox");
  const lightboxStage = document.getElementById("albumLightboxStage");
  let lightboxImage = document.getElementById("albumLightboxImage");
  const lightboxCounter = document.getElementById("albumLightboxCounter");
  const lightboxClose = document.getElementById("albumLightboxClose");
  const lightboxPrev = document.getElementById("albumLightboxPrev");
  const lightboxNext = document.getElementById("albumLightboxNext");

  if (!viewport || !space) return;

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const buildId = document.querySelector('meta[name="wedding-build"]')?.content || "dev";
  const tr = key => window.WeddingI18n ? window.WeddingI18n.t(key) : key;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  let statusKey = status?.dataset.statusKey || "album.lazy";
  let photos = [];
  let items = [];

  // Camera state. Images never change src while browsing; only transforms move.
  let position = 0;
  let targetPosition = 0;
  let sceneFrame = 0;
  let lastFrameTime = 0;
  let focusedPhotoIndex = -1;
  let drag = null;

  let wheelAccumulator = 0;
  let wheelLocked = false;
  let wheelUnlockTimer = 0;
  let lastTouchTap = { time:0, photoIndex:-1 };

  let lightboxIndex = 0;
  let lightboxReturnFocus = null;
  let lightboxPointer = null;
  let lightboxTransitioning = false;
  let lightboxQueuedDelta = 0;

  const decodeQueue = [];
  let activeDecodes = 0;
  const MAX_DECODE_CONCURRENCY = 4;

  const wrap = index => ((index % photos.length) + photos.length) % photos.length;

  const setStatus = key => {
    statusKey = key;
    if (!status) return;
    status.dataset.statusKey = key;
    status.textContent = tr(key);
  };

  function versionedAsset(photo) {
    const url = new URL(photo.src, document.baseURI);
    url.searchParams.set("v", photo.v || buildId);
    return url.href;
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

  function applyCardSize(item, ratio) {
    const safeRatio = clamp(Number(ratio) || .78, .50, 2.05);
    item.ratio = safeRatio;

    const compact = viewport.clientWidth < 700;
    const sceneHeight = viewport.clientHeight || (compact ? 520 : 680);
    let height = compact ? Math.min(sceneHeight * .61, 340) : Math.min(sceneHeight * .66, 475);

    if (safeRatio >= 1.35) height *= compact ? .61 : .64;
    else if (safeRatio >= .92) height *= .80;

    let width = height * safeRatio;
    const maxWidth = compact
      ? Math.min(viewport.clientWidth * .74, 320)
      : Math.min(viewport.clientWidth * .36, 540);

    if (width > maxWidth) {
      const factor = maxWidth / width;
      width *= factor;
      height *= factor;
    }

    const minWidth = compact ? 118 : 150;
    if (width < minWidth) {
      const factor = minWidth / width;
      width *= factor;
      height *= factor;
    }

    item.slide.style.width = Math.round(width) + "px";
    item.slide.style.height = Math.round(height) + "px";
  }

  function createItem(photo, photoIndex) {
    const slide = document.createElement("div");
    slide.className = "album-slide";
    slide.setAttribute("aria-hidden", "true");

    const card = document.createElement("div");
    card.className = "album-card";

    const img = document.createElement("img");
    img.className = "album-photo";
    img.alt = "";
    img.draggable = false;
    img.decoding = "async";
    img.loading = "eager";
    img.fetchPriority = photoIndex <= 2 || photoIndex >= photos.length - 2 ? "high" : "auto";

    const item = {
      slide,
      card,
      img,
      photoIndex,
      ratio:photo.ratio || .78,
      isMain:false,
      hidden:true,
      interactive:false
    };

    applyCardSize(item, item.ratio);

    img.addEventListener("load", () => {
      if (!img.naturalWidth || !img.naturalHeight) return;
      const ratio = img.naturalWidth / img.naturalHeight;
      photo.ratio = ratio;
      applyCardSize(item, ratio);
      warmDecode(img);
      requestSceneFrame();
    });

    img.src = versionedAsset(photo);
    warmDecode(img);

    card.append(img);
    slide.append(card);
    space.append(slide);
    return item;
  }

  function shortestRelative(photoIndex, cameraPosition) {
    if (photos.length <= 1) return 0;
    let relative = photoIndex - cameraPosition;
    relative -= Math.round(relative / photos.length) * photos.length;
    return relative;
  }

  function updateEditorialCaption(photoIndex, animate = true) {
    if (!captionText || photoIndex < 0) return;
    captionText.textContent = tr("album.caption." + (photoIndex % 5));

    if (editorialCaption && animate && !reducedMotion) {
      editorialCaption.classList.remove("is-changing");
      void editorialCaption.offsetWidth;
      editorialCaption.classList.add("is-changing");
    }
  }

  function updateProgress(photoIndex, animateCaption = true) {
    if (!photos.length || photoIndex < 0) return;

    if (counter) {
      counter.textContent =
        String(photoIndex + 1).padStart(2, "0") +
        " / " +
        String(photos.length).padStart(2, "0");
    }

    if (progress) progress.style.width = (100 * (photoIndex + 1) / photos.length) + "%";
    updateEditorialCaption(photoIndex, animateCaption);
  }

  function sceneMetrics() {
    const compact = viewport.clientWidth < 700;
    return {
      compact,
      height:viewport.clientHeight,
      firstX:compact ? viewport.clientWidth * .40 : viewport.clientWidth * .30,
      nextX:compact ? viewport.clientWidth * .215 : viewport.clientWidth * .175,
      activeRange:compact ? 3.65 : 4.65
    };
  }

  function renderScene() {
    if (!items.length) return;

    const metrics = sceneMetrics();
    const yPattern = metrics.compact
      ? [0,-.18,.16,-.25,.22,-.10]
      : [0,-.20,.17,-.27,.23,-.11];

    for (const item of items) {
      const relative = shortestRelative(item.photoIndex, position);
      const abs = Math.abs(relative);

      if (abs > metrics.activeRange) {
        if (!item.hidden) {
          item.hidden = true;
          item.slide.style.opacity = "0";
          item.slide.style.pointerEvents = "none";
          item.slide.setAttribute("aria-hidden", "true");
        }
        continue;
      }

      item.hidden = false;
      const sign = relative < 0 ? -1 : 1;
      const rank = Math.min(yPattern.length - 1, Math.round(abs));
      const variation = ((item.photoIndex % 5) - 2) / 2;

      let x = abs < .001
        ? 0
        : sign * (metrics.firstX + Math.max(0, abs - 1) * metrics.nextX);

      let y = yPattern[rank] * metrics.height + variation * (metrics.compact ? 9 : 16);
      let z = metrics.compact ? 145 - abs * 118 : 210 - abs * 145;
      let rotateY = clamp(-relative * (metrics.compact ? 13 : 12), -42, 42);
      let rotateZ = (rank ? sign * (rank % 2 ? -2.6 : 2.2) : 0) + variation * .8;
      let scale = Math.max(metrics.compact ? .54 : .50, 1.03 - abs * (metrics.compact ? .145 : .135));
      let opacity = Math.max(.14, 1 - abs * .20);

      const isMain = abs < .34;
      if (isMain) {
        x = 0;
        y = 0;
        z = metrics.compact ? 210 : 290;
        rotateY = -relative * 4;
        rotateZ = 0;
        scale = metrics.compact ? 1.08 : 1.12;
        opacity = 1;
      }

      item.slide.style.opacity = String(opacity);
      item.slide.style.zIndex = String(1000 - Math.round(abs * 90));
      item.slide.style.transform =
        "translate(-50%,-50%) " +
        "translate3d(" + x.toFixed(2) + "px," + y.toFixed(2) + "px," + z.toFixed(2) + "px) " +
        "rotateY(" + rotateY.toFixed(2) + "deg) " +
        "rotateZ(" + rotateZ.toFixed(2) + "deg) " +
        "scale(" + scale.toFixed(4) + ")";

      if (item.isMain !== isMain) {
        item.isMain = isMain;
        item.card.classList.toggle("is-main", isMain);
      }

      const interactive = abs < 2.65;
      if (item.interactive !== interactive) {
        item.interactive = interactive;
        item.slide.style.pointerEvents = interactive ? "auto" : "none";
        item.slide.setAttribute("aria-hidden", String(!interactive));
      }
    }

    const currentPhoto = wrap(Math.round(position));
    if (currentPhoto !== focusedPhotoIndex) {
      focusedPhotoIndex = currentPhoto;
      updateProgress(currentPhoto, true);
    }
  }

  function requestSceneFrame() {
    if (!sceneFrame) sceneFrame = requestAnimationFrame(tickScene);
  }

  function tickScene(time) {
    sceneFrame = 0;

    const dt = Math.min(2.4, Math.max(.35, (time - (lastFrameTime || time - 16.7)) / 16.7));
    lastFrameTime = time;

    if (!drag) {
      if (reducedMotion) {
        position = targetPosition;
      } else {
        const distance = targetPosition - position;
        const alpha = 1 - Math.pow(.78, dt);
        position += distance * alpha;

        if (Math.abs(distance) < .0015) position = targetPosition;
      }
    }

    renderScene();

    if (drag || Math.abs(targetPosition - position) > .0015) {
      requestSceneFrame();
    }
  }

  function moveTo(next, immediate = false) {
    targetPosition = next;

    if (immediate || reducedMotion) {
      position = targetPosition;
      renderScene();
      return;
    }

    requestSceneFrame();
  }

  function itemFromTarget(node) {
    const slide = node?.closest?.(".album-slide");
    return slide ? items.find(item => item.slide === slide) : null;
  }

  viewport.addEventListener("pointerdown", event => {
    if (lightbox && !lightbox.hidden) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    drag = {
      id:event.pointerId,
      pointerType:event.pointerType,
      item:itemFromTarget(event.target),
      startX:event.clientX,
      startY:event.clientY,
      lastX:event.clientX,
      lastTime:performance.now(),
      velocityX:0,
      startPosition:position,
      moved:false,
      cancelled:false
    };

    targetPosition = position;
    lastFrameTime = 0;
    viewport.classList.add("is-dragging");
    viewport.setPointerCapture?.(event.pointerId);
  });

  viewport.addEventListener("pointermove", event => {
    if (!drag || event.pointerId !== drag.id || drag.cancelled) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (!drag.moved && Math.hypot(dx, dy) > 6) {
      if (Math.abs(dy) > Math.abs(dx) * 1.15) {
        drag.cancelled = true;
        return;
      }
      drag.moved = true;
    }

    if (!drag.moved) return;
    event.preventDefault();

    const now = performance.now();
    const elapsed = Math.max(8, now - drag.lastTime);
    drag.velocityX = (event.clientX - drag.lastX) / elapsed;
    drag.lastX = event.clientX;
    drag.lastTime = now;

    const step = viewport.clientWidth < 700
      ? Math.max(145, viewport.clientWidth * .43)
      : Math.max(220, viewport.clientWidth * .22);

    position = drag.startPosition - dx / step;
    targetPosition = position;
    requestSceneFrame();
  }, { passive:false });

  function finishDrag(event) {
    if (!drag || (event.pointerId != null && event.pointerId !== drag.id)) return;

    const state = drag;
    drag = null;
    viewport.classList.remove("is-dragging");

    if (state.cancelled) return;

    if (state.moved) {
      const step = viewport.clientWidth < 700
        ? Math.max(145, viewport.clientWidth * .43)
        : Math.max(220, viewport.clientWidth * .22);

      const projected = position - state.velocityX * 150 / step;
      const maxJump = viewport.clientWidth < 700 ? 2 : 3;
      moveTo(Math.round(clamp(projected, position - maxJump, position + maxJump)));
      return;
    }

    if (!state.item) {
      moveTo(Math.round(position));
      return;
    }

    if (state.pointerType === "mouse") {
      openLightbox(state.item.photoIndex, state.item.slide);
      return;
    }

    const now = performance.now();
    if (
      lastTouchTap.photoIndex === state.item.photoIndex &&
      now - lastTouchTap.time < 330
    ) {
      lastTouchTap = { time:0, photoIndex:-1 };
      openLightbox(state.item.photoIndex, state.item.slide);
      return;
    }

    lastTouchTap = { time:now, photoIndex:state.item.photoIndex };
    const relative = shortestRelative(state.item.photoIndex, position);
    moveTo(Math.round(position + relative));
  }

  viewport.addEventListener("pointerup", finishDrag);
  viewport.addEventListener("pointercancel", event => {
    if (!drag || event.pointerId !== drag.id) return;
    drag = null;
    viewport.classList.remove("is-dragging");
    moveTo(Math.round(position));
  });

  viewport.addEventListener("wheel", event => {
    if (!photos.length || (lightbox && !lightbox.hidden) || event.ctrlKey) return;

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta) return;

    event.preventDefault();
    if (wheelLocked) return;

    wheelAccumulator += delta;
    if (Math.abs(wheelAccumulator) < 18) return;

    const direction = wheelAccumulator > 0 ? 1 : -1;
    wheelAccumulator = 0;
    wheelLocked = true;
    moveTo(Math.round(targetPosition) + direction);

    clearTimeout(wheelUnlockTimer);
    wheelUnlockTimer = setTimeout(() => {
      wheelLocked = false;
      wheelAccumulator = 0;
    }, 110);
  }, { passive:false });

  viewport.addEventListener("keydown", event => {
    if (lightbox && !lightbox.hidden) return;

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      moveTo(Math.round(targetPosition) + (event.key === "ArrowRight" ? 1 : -1));
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openLightbox(wrap(Math.round(position)), viewport);
    }
  });

  function lightboxAlt(index) {
    return tr("album.fullscreenPhotoAlt")
      .replace("{current}", String(index + 1))
      .replace("{total}", String(photos.length));
  }

  function updateLightboxMeta() {
    if (!photos.length || !lightboxImage || !lightboxCounter) return;
    lightboxImage.alt = lightboxAlt(lightboxIndex);
    lightboxCounter.textContent =
      String(lightboxIndex + 1).padStart(2, "0") +
      " / " +
      String(photos.length).padStart(2, "0");
  }

  function preloadLightboxNeighbors() {
    [-1, 1].forEach(delta => {
      const neighbor = new Image();
      neighbor.decoding = "async";
      neighbor.src = versionedAsset(photos[wrap(lightboxIndex + delta)]);
    });
  }

  async function setLightboxImage(index) {
    lightboxIndex = wrap(index);
    lightboxImage.src = versionedAsset(photos[lightboxIndex]);
    updateLightboxMeta();
    try { await lightboxImage.decode?.(); } catch (_) {}
    preloadLightboxNeighbors();
  }

  async function animateLightboxStep(delta) {
    if (!photos.length || !lightboxImage || lightboxTransitioning) {
      if (lightboxTransitioning) lightboxQueuedDelta = delta;
      return;
    }

    const direction = delta > 0 ? 1 : -1;

    if (reducedMotion || !lightboxImage.animate) {
      await setLightboxImage(lightboxIndex + delta);
      return;
    }

    lightboxTransitioning = true;
    lightboxQueuedDelta = 0;

    const outgoing = lightboxImage.cloneNode(false);
    outgoing.removeAttribute("id");
    outgoing.alt = "";
    outgoing.classList.add("album-lightbox-ghost");
    outgoing.src = lightboxImage.currentSrc || lightboxImage.src;

    const rect = lightboxImage.getBoundingClientRect();
    outgoing.style.width = rect.width + "px";
    outgoing.style.height = rect.height + "px";
    lightboxStage.append(outgoing);

    lightboxImage.style.visibility = "hidden";
    await setLightboxImage(lightboxIndex + delta);

    lightboxImage.style.visibility = "";
    lightboxImage.style.transform = "";
    lightboxImage.style.opacity = "";

    const outgoingAnimation = outgoing.animate([
      { transform:"translate(-50%,-50%) translate3d(0,0,0) scale(1)", opacity:1 },
      { transform:"translate(-50%,-50%) translate3d(" + (-direction * 8) + "vw,0,0) scale(.985)", opacity:0 }
    ], {
      duration:240,
      easing:"cubic-bezier(.22,.7,.18,1)",
      fill:"forwards"
    });

    const incomingAnimation = lightboxImage.animate([
      { transform:"translate3d(" + (direction * 7) + "vw,0,0) scale(.985)", opacity:.12 },
      { transform:"translate3d(0,0,0) scale(1)", opacity:1 }
    ], {
      duration:320,
      easing:"cubic-bezier(.18,.78,.18,1)",
      fill:"both"
    });

    await Promise.allSettled([outgoingAnimation.finished, incomingAnimation.finished]);
    outgoing.remove();
    lightboxTransitioning = false;

    if (lightboxQueuedDelta) {
      const queued = lightboxQueuedDelta;
      lightboxQueuedDelta = 0;
      animateLightboxStep(queued);
    }
  }

  function openLightbox(index, returnFocus = null) {
    if (!lightbox || !photos.length || !lightboxImage) return;

    lightboxReturnFocus = returnFocus || document.activeElement;
    lightboxIndex = wrap(index);
    lightboxImage.src = versionedAsset(photos[lightboxIndex]);
    updateLightboxMeta();
    preloadLightboxNeighbors();

    lightbox.hidden = false;
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("album-lightbox-open");

    if (!reducedMotion && lightboxImage.animate) {
      lightboxImage.animate([
        { transform:"scale(.975)", opacity:0 },
        { transform:"scale(1)", opacity:1 }
      ], { duration:280, easing:"cubic-bezier(.2,.75,.2,1)" });
    }

    requestAnimationFrame(() => lightboxClose?.focus({ preventScroll:true }));
  }

  function closeLightbox() {
    if (!lightbox || lightbox.hidden) return;

    lightbox.hidden = true;
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("album-lightbox-open");
    lightboxPointer = null;
    lightboxTransitioning = false;
    lightboxQueuedDelta = 0;

    lightboxStage?.querySelectorAll(".album-lightbox-ghost").forEach(node => node.remove());
    lightboxImage.style.transform = "";
    lightboxImage.style.opacity = "";
    lightboxImage.style.visibility = "";
    lightboxImage.removeAttribute("src");

    lightboxReturnFocus?.focus?.({ preventScroll:true });
    lightboxReturnFocus = null;
  }

  function stepLightbox(delta) {
    animateLightboxStep(delta);
  }

  lightboxClose?.addEventListener("click", closeLightbox);
  lightboxPrev?.addEventListener("click", () => stepLightbox(-1));
  lightboxNext?.addEventListener("click", () => stepLightbox(1));

  lightboxStage?.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    lightboxPointer = {
      id:event.pointerId,
      x:event.clientX,
      y:event.clientY,
      dx:0,
      horizontal:false
    };
    lightboxStage.setPointerCapture?.(event.pointerId);
  });

  lightboxStage?.addEventListener("pointermove", event => {
    if (!lightboxPointer || event.pointerId !== lightboxPointer.id || lightboxTransitioning) return;

    const dx = event.clientX - lightboxPointer.x;
    const dy = event.clientY - lightboxPointer.y;

    if (!lightboxPointer.horizontal && Math.abs(dx) > 8) {
      if (Math.abs(dy) > Math.abs(dx) * 1.15) return;
      lightboxPointer.horizontal = true;
    }

    if (!lightboxPointer.horizontal) return;
    event.preventDefault();

    lightboxPointer.dx = dx;
    const visualX = dx * .22;
    const scale = Math.max(.985, 1 - Math.min(Math.abs(dx), 180) / 12000);
    const opacity = Math.max(.72, 1 - Math.abs(dx) / 900);

    lightboxImage.style.transform =
      "translate3d(" + visualX.toFixed(2) + "px,0,0) scale(" + scale.toFixed(4) + ")";
    lightboxImage.style.opacity = String(opacity);
  }, { passive:false });

  lightboxStage?.addEventListener("pointerup", event => {
    if (!lightboxPointer || event.pointerId !== lightboxPointer.id) return;

    const dx = lightboxPointer.dx || (event.clientX - lightboxPointer.x);
    const dy = event.clientY - lightboxPointer.y;
    const horizontal = lightboxPointer.horizontal;
    lightboxPointer = null;

    lightboxImage.style.transform = "";
    lightboxImage.style.opacity = "";

    if (horizontal && Math.abs(dx) >= 48 && Math.abs(dx) >= Math.abs(dy) * 1.1) {
      stepLightbox(dx < 0 ? 1 : -1);
      return;
    }

    if (!reducedMotion && horizontal && lightboxImage.animate) {
      lightboxImage.animate([
        { transform:"translate3d(" + (dx * .22).toFixed(2) + "px,0,0) scale(.99)", opacity:.82 },
        { transform:"translate3d(0,0,0) scale(1)", opacity:1 }
      ], { duration:180, easing:"cubic-bezier(.2,.75,.2,1)" });
    }
  });

  lightboxStage?.addEventListener("pointercancel", () => {
    lightboxPointer = null;
    if (!lightboxImage) return;
    lightboxImage.style.transform = "";
    lightboxImage.style.opacity = "";
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

  document.addEventListener("wedding:languagechange", () => {
    if (status && !status.hidden) setStatus(statusKey);
    if (focusedPhotoIndex >= 0) updateEditorialCaption(focusedPhotoIndex, false);
    if (lightbox && !lightbox.hidden) updateLightboxMeta();
  });

  let resizeTimer = 0;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      for (const item of items) applyCardSize(item, item.ratio);
      requestSceneFrame();
    }, 80);
  }, { passive:true });

  async function start() {
    setStatus("album.loading");

    try {
      const manifestUrl = new URL("./images/manifest.json", document.baseURI);
      manifestUrl.searchParams.set("v", buildId);
      manifestUrl.searchParams.set("t", String(Date.now()));

      const response = await fetch(manifestUrl, { cache:"no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);

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
            ratio:width > 0 && height > 0 ? width / height : Number(photo.ratio) || 0
          };
        });

      if (!photos.length) {
        setStatus("album.empty");
        return;
      }

      space.replaceChildren();
      items = photos.map(createItem);
      position = 0;
      targetPosition = 0;
      focusedPhotoIndex = -1;
      renderScene();
      updateProgress(0, false);

      if (status) status.hidden = true;
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
    }, { rootMargin:"1200px 0px", threshold:0 });
    lazyObserver.observe(albumSection);
  } else {
    start();
  }
})();