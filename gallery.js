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
  let captions = {};
  let items = [];
  const itemBySlide = new WeakMap();
  let cachedMetrics = null;
  let loadedImageCount = 0;

  // Camera state; nearby images stay warm while transforms move.
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
  // Invalidate late decodes/animations when a viewer closes or reopens the lightbox.
  let lightboxGeneration = 0;

  const decodeQueue = [];
  let activeDecodes = 0;
  // Limit simultaneous image decodes on phones to avoid GPU/memory spikes.
  const MAX_DECODE_CONCURRENCY = matchMedia("(max-width: 700px), (pointer: coarse)").matches ? 2 : 4;
  const SAVE_DATA = Boolean(navigator.connection?.saveData);
  // Bound retained decoded photos on long albums; versioned image URLs remain cacheable.
  const MAX_RETAINED_IMAGES = SAVE_DATA ? 12 : MAX_DECODE_CONCURRENCY === 2 ? 20 : 32;
  const lightboxPreloaders = [new Image(), new Image()];

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
      if (!img?.decode || !img.isConnected || !img.hasAttribute("src")) continue;
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

    const metrics = sceneMetrics();
    const compact = metrics.compact;
    const sceneHeight = metrics.height || (compact ? 520 : 680);
    let height = compact ? Math.min(sceneHeight * .61, 340) : Math.min(sceneHeight * .66, 475);

    if (safeRatio >= 1.35) height *= compact ? .61 : .64;
    else if (safeRatio >= .92) height *= .80;

    let width = height * safeRatio;
    const maxWidth = compact
      ? Math.min(metrics.width * .74, 320)
      : Math.min(metrics.width * .36, 540);

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
    // Start offscreen slides fully hidden before their first scene render.
    slide.style.opacity = "0";
    slide.style.pointerEvents = "none";

    const card = document.createElement("div");
    card.className = "album-card";

    const img = document.createElement("img");
    img.className = "album-photo";
    img.alt = "";
    img.draggable = false;
    img.decoding = "async";
    // Images are loaded on demand in renderScene; hidden cards do not occupy memory.
    img.loading = "eager";
    img.fetchPriority = "auto";

    const item = {
      slide,
      card,
      img,
      photoIndex,
      floatY:Math.sin((photoIndex + 1) * 1.73),
      floatTilt:Math.sin((photoIndex + 1) * 2.31) * 5.2,
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

    card.append(img);
    slide.append(card);
    space.append(slide);
    itemBySlide.set(slide, item);
    return item;
  }

  function ensureItemLoaded(item, relativeDistance) {
    if (item.img.hasAttribute("src")) return;
    item.img.fetchPriority = relativeDistance < 1.7 ? "high" : "low";
    item.img.src = versionedAsset(photos[item.photoIndex]);
    loadedImageCount++;
  }

  function shortestRelative(photoIndex, cameraPosition) {
    if (photos.length <= 1) return 0;
    let relative = photoIndex - cameraPosition;
    relative -= Math.round(relative / photos.length) * photos.length;
    return relative;
  }

  function updateEditorialCaption(photoIndex, animate = true) {
    if (!captionText || photoIndex < 0) return;
    const photoCaption = photos[photoIndex]?.caption;
    const language = document.documentElement.lang === "en" ? "en" : "vi";
    const custom = typeof photoCaption === "string"
      ? photoCaption : photoCaption?.[language];
    const cycle = captions[language] || captions.vi || [];
    captionText.textContent = custom || (cycle.length ? cycle[photoIndex % cycle.length] : "");

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
    if (cachedMetrics) return cachedMetrics;
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    const compact = width < 700;
    // Read viewport geometry once, not after every slide style mutation.
    return (cachedMetrics = {
      width, height, compact,
      spacing:compact ? width * .34 : width * .285,
      activeRange:compact ? 3.25 : 4.10,
      centerZ:compact ? 235 : 325,
      depthStep:compact ? 132 : 164
    });
  }

  function trimPhotoCache(metrics) {
    if (loadedImageCount <= MAX_RETAINED_IMAGES) return;
    const keepDistance = metrics.activeRange + (SAVE_DATA ? 1.5 : 3.5);
    for (const item of items) {
      if (loadedImageCount <= MAX_RETAINED_IMAGES) break;
      if (!item.hidden || !item.img.hasAttribute("src")) continue;
      if (Math.abs(shortestRelative(item.photoIndex, position)) <= keepDistance) continue;
      // Keep nearby full-resolution cards decoded for inertia and seamless wrapping.
      item.img.removeAttribute("src");
      loadedImageCount--;
    }
  }

  function renderScene() {
    if (!items.length) return;

    const metrics = sceneMetrics();

    for (const item of items) {
      const relative = shortestRelative(item.photoIndex, position);
      const abs = Math.abs(relative);

      // Prefetch nearby cards, not the entire album at once.
      if (abs <= metrics.activeRange + (SAVE_DATA ? .25 : 1.5)) {
        ensureItemLoaded(item, abs);
      }

      if (abs > metrics.activeRange) {
        // Newly created slides already start hidden. Update the DOM only
        // when crossing the visible boundary, not for every hidden slide
        // on every animation frame (which is costly with 100+ photos).
        if (!item.hidden) {
          item.hidden = true;
          item.slide.style.willChange = "auto";
          item.slide.style.opacity = "0";
          item.slide.style.pointerEvents = "none";
          item.slide.setAttribute("aria-hidden", "true");
          if (item.isMain) {
            item.isMain = false;
            item.card.classList.remove("is-main");
          }
          item.interactive = false;
        }
        continue;
      }

      if (item.hidden) {
        item.hidden = false;
        item.slide.style.willChange = "transform, opacity";
      }

      // Stable per-photo offsets. They never jump when the camera crosses
      // half/integer boundaries; only the continuous relative value changes.
      const floatY = item.floatY * (metrics.compact ? 62 : 104);
      const floatTilt = item.floatTilt;
      const floatMix = Math.min(1, abs * .90);

      // Continuous spatial curve: neighbors stay closer to each other and
      // accelerate outward gradually instead of jumping between discrete poses.
      const spacingCurve = 1 + Math.min(abs, 3.5) * .085;
      let x = relative * metrics.spacing * spacingCurve;
      let y = floatY * floatMix;
      let z = metrics.centerZ - abs * metrics.depthStep - abs * abs * (metrics.compact ? 12 : 17);
      let rotateY = clamp(-relative * (metrics.compact ? 12.5 : 11.5), -42, 42);
      let rotateZ = floatTilt * floatMix;

      // Demo-3 hierarchy: the current photo owns the light.
      // Neighbors become much smaller/darker as they fall back in depth.
      let scale = Math.max(metrics.compact ? .46 : .42, 1.04 - abs * (metrics.compact ? .17 : .19));
      let opacity = Math.max(.10, Math.pow(.58, abs));

      // Ease the focused photo into dead center without a threshold snap.
      const focusBlend = Math.max(0, 1 - abs / .62);
      const focusEase = focusBlend * focusBlend * (3 - 2 * focusBlend);
      x *= 1 - focusEase;
      y *= 1 - focusEase;
      rotateY *= 1 - focusEase;
      rotateZ *= 1 - focusEase;
      z += focusEase * (metrics.compact ? 62 : 88);
      scale += focusEase * (metrics.compact ? .085 : .105);
      opacity += (1 - opacity) * focusEase;

      const isMain = abs < .46;

      item.slide.style.opacity = String(opacity);
      item.slide.style.zIndex = String(1000 - Math.round(abs * 80));
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
      trimPhotoCache(metrics);
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
        const alpha = 1 - Math.pow(.895, dt);
        position += distance * alpha;

        if (Math.abs(distance) < .0015) position = targetPosition;
      }
    }

    renderScene();

    // Pointer events request frames while dragging; a stationary finger needs none.
    if (!drag && Math.abs(targetPosition - position) > .0015) {
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
    return slide ? itemBySlide.get(slide) || null : null;
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
      step:sceneMetrics().width < 700
        ? Math.max(145, sceneMetrics().width * .43)
        : Math.max(220, sceneMetrics().width * .22),
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

    position = drag.startPosition - dx / drag.step;
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

      const projected = position - state.velocityX * 125 / step;
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
    const caption = document.getElementById("albumLightboxCaption");
    const language = document.documentElement.lang === "en" ? "en" : "vi";
    const custom = photos[lightboxIndex]?.caption;
    const cycle = captions[language] || captions.vi || [];
    if (caption) caption.textContent = (typeof custom === "string" ? custom : custom?.[language]) ||
      (cycle.length ? cycle[lightboxIndex % cycle.length] : "");
    lightboxImage.alt = lightboxAlt(lightboxIndex);
    lightboxCounter.textContent =
      String(lightboxIndex + 1).padStart(2, "0") +
      " / " +
      String(photos.length).padStart(2, "0");
  }

  function preloadLightboxNeighbors() {
    [-1, 1].forEach((delta, index) => {
      const neighbor = lightboxPreloaders[index];
      neighbor.decoding = "async";
      const url = versionedAsset(photos[wrap(lightboxIndex + delta)]);
      if (neighbor.src !== url) neighbor.src = url;
    });
  }

  async function decodeLightboxLayer(index) {
    const nextIndex = wrap(index);
    const image = new Image();
    image.className = "album-lightbox-incoming";
    image.alt = lightboxAlt(nextIndex);
    image.draggable = false;
    image.decoding = "async";
    image.src = versionedAsset(photos[nextIndex]);
    try { await image.decode?.(); } catch (_) {}
    return { image, index:nextIndex };
  }

  async function animateLightboxStep(delta) {
    if (!photos.length || !lightboxImage) return;

    if (lightboxTransitioning) {
      lightboxQueuedDelta = delta;
      return;
    }

    const generation = lightboxGeneration;
    const direction = delta > 0 ? 1 : -1;
    const nextIndex = wrap(lightboxIndex + delta);
    lightboxTransitioning = true;
    lightboxQueuedDelta = 0;

    if (reducedMotion || !lightboxImage.animate) {
      const decoded = await decodeLightboxLayer(nextIndex);
      if (generation !== lightboxGeneration || lightbox.hidden) return;
      decoded.image.id = "albumLightboxImage";
      lightboxImage.replaceWith(decoded.image);
      lightboxImage = decoded.image;
      lightboxIndex = decoded.index;
      updateLightboxMeta();
      preloadLightboxNeighbors();
      lightboxTransitioning = false;
      if (lightboxQueuedDelta) {
        const queued = lightboxQueuedDelta;
        lightboxQueuedDelta = 0;
        animateLightboxStep(queued);
      }
      return;
    }

    // Decode first while the current photo remains fully visible.
    const decoded = await decodeLightboxLayer(nextIndex);
    if (generation !== lightboxGeneration || lightbox.hidden) return;

    const incoming = decoded.image;
    lightboxStage.append(incoming);

    const outgoingAnimation = lightboxImage.animate([
      { transform:"translate(-50%,-50%) translate3d(0,0,0) scale(1)", opacity:1 },
      { transform:"translate(-50%,-50%) translate3d(" + (-direction * 3.2) + "vw,0,0) scale(.992)", opacity:0 }
    ], {
      duration:360,
      easing:"cubic-bezier(.22,.72,.18,1)",
      fill:"forwards"
    });

    const incomingAnimation = incoming.animate([
      { transform:"translate(-50%,-50%) translate3d(" + (direction * 6.2) + "vw,0,0) scale(.992)", opacity:0 },
      { transform:"translate(-50%,-50%) translate3d(0,0,0) scale(1)", opacity:1 }
    ], {
      duration:360,
      easing:"cubic-bezier(.18,.78,.18,1)",
      fill:"both"
    });

    await Promise.allSettled([outgoingAnimation.finished, incomingAnimation.finished]);
    if (generation !== lightboxGeneration || lightbox.hidden) {
      outgoingAnimation.cancel();
      incomingAnimation.cancel();
      incoming.remove();
      return;
    }

    // Commit the incoming layer's final pose before cancelling WAAPI effects.
    // Both layers are absolutely positioned, so removing the old one cannot
    // reflow the stage or make the new photo drop vertically.
    incoming.style.transform = "translate(-50%,-50%) translate3d(0,0,0) scale(1)";
    outgoingAnimation.cancel();
    incomingAnimation.cancel();

    incoming.id = "albumLightboxImage";
    incoming.classList.remove("album-lightbox-incoming");
    lightboxImage.replaceWith(incoming);
    lightboxImage = incoming;
    lightboxIndex = decoded.index;
    updateLightboxMeta();
    preloadLightboxNeighbors();

    lightboxTransitioning = false;

    if (lightboxQueuedDelta) {
      const queued = lightboxQueuedDelta;
      lightboxQueuedDelta = 0;
      animateLightboxStep(queued);
    }
  }

  function openLightbox(index, returnFocus = null) {
    if (!lightbox || !photos.length || !lightboxImage) return;

    lightboxGeneration++;
    lightboxTransitioning = false;
    lightboxQueuedDelta = 0;
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
        { transform:"translate(-50%,-50%) scale(.975)", opacity:0 },
        { transform:"translate(-50%,-50%) scale(1)", opacity:1 }
      ], { duration:280, easing:"cubic-bezier(.2,.75,.2,1)" });
    }

    requestAnimationFrame(() => lightboxClose?.focus({ preventScroll:true }));
  }

  function closeLightbox() {
    if (!lightbox || lightbox.hidden) return;

    lightboxGeneration++;
    lightbox.hidden = true;
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("album-lightbox-open");
    lightboxPointer = null;
    lightboxTransitioning = false;
    lightboxQueuedDelta = 0;

    lightboxStage?.querySelectorAll("img").forEach(node => {
      node.getAnimations?.().forEach(animation => animation.cancel());
    });
    lightboxStage?.querySelectorAll(".album-lightbox-incoming").forEach(node => node.remove());
    lightboxImage.style.transform = "";
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
    const scale = Math.max(.99, 1 - Math.min(Math.abs(dx), 180) / 18000);

    lightboxImage.style.transform =
      "translate(-50%,-50%) translate3d(" + visualX.toFixed(2) + "px,0,0) scale(" + scale.toFixed(4) + ")";
  }, { passive:false });

  lightboxStage?.addEventListener("pointerup", event => {
    if (!lightboxPointer || event.pointerId !== lightboxPointer.id) return;

    const dx = lightboxPointer.dx || (event.clientX - lightboxPointer.x);
    const dy = event.clientY - lightboxPointer.y;
    const horizontal = lightboxPointer.horizontal;
    lightboxPointer = null;

    lightboxImage.style.transform = "";

    if (horizontal && Math.abs(dx) >= 48 && Math.abs(dx) >= Math.abs(dy) * 1.1) {
      stepLightbox(dx < 0 ? 1 : -1);
      return;
    }

    if (!reducedMotion && horizontal && lightboxImage.animate) {
      lightboxImage.animate([
        { transform:"translate(-50%,-50%) translate3d(" + (dx * .22).toFixed(2) + "px,0,0) scale(.994)" },
        { transform:"translate(-50%,-50%) translate3d(0,0,0) scale(1)" }
      ], { duration:210, easing:"cubic-bezier(.2,.75,.2,1)" });
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
      cachedMetrics = null;
      for (const item of items) applyCardSize(item, item.ratio);
      requestSceneFrame();
    }, 80);
  }, { passive:true });

  async function start() {
    setStatus("album.loading");

    try {
      // Album data lives only in images/manifest.json.
      const manifestUrl = new URL("images/manifest.json", document.baseURI);
      manifestUrl.searchParams.set("v", buildId);
      const response = await fetch(manifestUrl, { cache:"no-cache" });
      if (!response.ok) throw new Error("Album manifest HTTP " + response.status);
      const manifest = await response.json();
      if (!manifest || !Array.isArray(manifest.photos))
        throw new Error("Invalid album: photos must be an array in images/manifest.json");
      if (typeof manifest.shuffle !== "boolean")
        throw new Error("Invalid album: shuffle must be a boolean");
      const list = manifest.photos;
      captions = manifest.captions || {};

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

      // Shuffle is configured in the manifest; false preserves manual order.
      if (manifest.shuffle) {
        for (let i = photos.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [photos[i], photos[j]] = [photos[j], photos[i]];
        }
      }

      if (!photos.length) {
        setStatus("album.empty");
        return;
      }

      space.replaceChildren();
      loadedImageCount = 0;
      cachedMetrics = null;
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
  let albumStarted = false;
  let lazyObserver = null;
  const ensureAlbumStarted = () => {
    if (albumStarted) return;
    albumStarted = true;
    lazyObserver?.disconnect();
    window.removeEventListener("scroll", checkAlbumVisibility);
    window.removeEventListener("resize", checkAlbumVisibility);
    start();
  };

  // WebKit (especially iOS emulation and some embedded WebViews) may delay
  // IntersectionObserver after programmatic scrolling. Keep a passive fallback.
  function checkAlbumVisibility() {
    if (albumStarted || document.documentElement.classList.contains("party-pending")) return;
    const rect = albumSection.getBoundingClientRect();
    if (rect.top < innerHeight + 1000 && rect.bottom > -600) ensureAlbumStarted();
  }

  if ("IntersectionObserver" in window) {
    lazyObserver = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) ensureAlbumStarted();
    }, { rootMargin:"1200px 0px", threshold:0 });
    lazyObserver.observe(albumSection);
    window.addEventListener("scroll", checkAlbumVisibility, { passive:true });
    window.addEventListener("resize", checkAlbumVisibility, { passive:true });
    viewport.addEventListener("focus", ensureAlbumStarted, { once:true });
    viewport.addEventListener("pointerdown", ensureAlbumStarted, { once:true });
    checkAlbumVisibility();
    // The entrance should not compete with a speculative album load.
    // Check visibility after opening, without fetching any distant images.
    if (document.documentElement.dataset.party) {
      document.addEventListener("wedding:waxopen", () => {
        window.setTimeout(checkAlbumVisibility, 200);
      }, { once:true });
    }
  } else {
    ensureAlbumStarted();
  }
})();