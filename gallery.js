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
  const lightboxImage = document.getElementById("albumLightboxImage");
  const lightboxCounter = document.getElementById("albumLightboxCounter");
  const lightboxClose = document.getElementById("albumLightboxClose");
  const lightboxPrev = document.getElementById("albumLightboxPrev");
  const lightboxNext = document.getElementById("albumLightboxNext");

  if (!viewport || !space) return;

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const buildId = document.querySelector('meta[name="wedding-build"]')?.content || "dev";
  const tr = key => window.WeddingI18n ? window.WeddingI18n.t(key) : key;

  let statusKey = status?.dataset.statusKey || "album.lazy";
  let photos = [];
  let items = [];
  let radius = 0;
  let slotBase = 0;

  let position = 0;
  let target = 0;
  let velocity = 0;
  let raf = 0;
  let lastFrame = 0;
  let focusedPhotoIndex = -1;

  let drag = null;
  let wheelAccumulator = 0;
  let wheelLocked = false;
  let wheelUnlockTimer = 0;
  let lastTouchTap = { time:0, photoIndex:-1 };

  let lightboxIndex = 0;
  let lightboxReturnFocus = null;
  let lightboxPointer = null;

  const decodeQueue = [];
  let activeDecodes = 0;
  const MAX_DECODE_CONCURRENCY = 4;

  const wrap = index => ((index % photos.length) + photos.length) % photos.length;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

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
    if (!item?.slide || !item?.card) return;

    const safeRatio = clamp(Number(ratio) || .78, .50, 2.05);
    item.ratio = safeRatio;

    const compact = viewport.clientWidth < 700;
    const sceneH = viewport.clientHeight || (compact ? 520 : 680);
    let photoH = compact ? Math.min(sceneH * .61, 340) : Math.min(sceneH * .66, 475);

    if (safeRatio >= 1.35) photoH *= compact ? .61 : .64;
    else if (safeRatio >= .92) photoH *= .80;

    let photoW = photoH * safeRatio;
    const maxW = compact ? Math.min(viewport.clientWidth * .74, 320) : Math.min(viewport.clientWidth * .36, 540);

    if (photoW > maxW) {
      const factor = maxW / photoW;
      photoW *= factor;
      photoH *= factor;
    }

    const minW = compact ? 118 : 150;
    if (photoW < minW) {
      const factor = minW / photoW;
      photoW *= factor;
      photoH *= factor;
    }

    item.slide.style.width = Math.round(photoW) + "px";
    item.slide.style.height = Math.round(photoH) + "px";
  }

  function setItemPhoto(item, virtualIndex) {
    item.virtualIndex = virtualIndex;
    const photoIndex = wrap(virtualIndex);
    if (item.photoIndex === photoIndex) return;

    item.photoIndex = photoIndex;
    const photo = photos[photoIndex];
    applyCardSize(item, photo?.ratio || .78);
    item.img.src = versionedAsset(photo);
    item.img.fetchPriority = Math.abs(virtualIndex - Math.round(position)) <= 2 ? "high" : "auto";
    warmDecode(item.img);
  }

  function createItem(virtualIndex) {
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

    const item = { slide, card, img, virtualIndex, photoIndex:-1, ratio:.78 };

    img.addEventListener("load", () => {
      if (item.photoIndex < 0 || !img.naturalWidth || !img.naturalHeight) return;
      const ratio = img.naturalWidth / img.naturalHeight;
      const photo = photos[item.photoIndex];
      if (photo) photo.ratio = ratio;
      applyCardSize(item, ratio);
      warmDecode(img);
      renderScene();
    });

    card.append(img);
    slide.append(card);
    space.append(slide);
    setItemPhoto(item, virtualIndex);
    return item;
  }

  function rebuildItems() {
    space.replaceChildren();
    items = [];
    if (!photos.length) return;

    radius = photos.length === 1 ? 0 : Math.min(5, Math.floor((photos.length - 1) / 2));
    slotBase = Math.round(position);

    for (let offset = -radius; offset <= radius; offset++) {
      items.push(createItem(slotBase + offset));
    }
  }

  function syncSlots(newBase) {
    if (!items.length || newBase === slotBase) return;

    if (Math.abs(newBase - slotBase) > items.length) {
      slotBase = newBase;
      items.forEach((item, index) => setItemPhoto(item, slotBase + index - radius));
      return;
    }

    while (slotBase < newBase) {
      slotBase++;
      const first = items.shift();
      const lastVirtual = items.at(-1)?.virtualIndex ?? slotBase;
      setItemPhoto(first, lastVirtual + 1);
      items.push(first);
    }

    while (slotBase > newBase) {
      slotBase--;
      const last = items.pop();
      const firstVirtual = items[0]?.virtualIndex ?? slotBase;
      setItemPhoto(last, firstVirtual - 1);
      items.unshift(last);
    }
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
      width:viewport.clientWidth,
      height:viewport.clientHeight,
      firstX:compact ? viewport.clientWidth * .40 : viewport.clientWidth * .30,
      nextX:compact ? viewport.clientWidth * .215 : viewport.clientWidth * .175
    };
  }

  function renderScene() {
    if (!items.length) return;

    const nearestVirtual = Math.round(position);
    syncSlots(nearestVirtual);

    const metrics = sceneMetrics();
    const yPattern = metrics.compact ? [0,-.18,.16,-.25,.22,-.10] : [0,-.20,.17,-.27,.23,-.11];

    items.forEach(item => {
      const relative = item.virtualIndex - position;
      const abs = Math.abs(relative);
      const sign = relative < 0 ? -1 : 1;

      if (abs > radius + .72) {
        item.slide.style.opacity = "0";
        item.slide.style.pointerEvents = "none";
        return;
      }

      const rank = Math.min(yPattern.length - 1, Math.round(abs));
      const seed = Math.abs(item.photoIndex >= 0 ? item.photoIndex : item.virtualIndex);
      const variation = ((seed % 5) - 2) / 2;

      let x = 0;
      if (abs > .001) {
        x = sign * (metrics.firstX + Math.max(0, abs - 1) * metrics.nextX);
      }

      let y = yPattern[rank] * metrics.height + variation * (metrics.compact ? 9 : 16);
      let z = metrics.compact ? 145 - abs * 118 : 210 - abs * 145;
      let rotateY = clamp(-relative * (metrics.compact ? 13 : 12), -42, 42);
      let rotateZ = (rank ? sign * (rank % 2 ? -2.6 : 2.2) : 0) + variation * .8;
      let scale = Math.max(metrics.compact ? .52 : .48, 1.03 - abs * (metrics.compact ? .145 : .135));
      let opacity = Math.max(.12, 1 - abs * .20);

      if (abs < .34) {
        x = 0;
        y = 0;
        z = metrics.compact ? 210 : 290;
        rotateY = -relative * 4;
        rotateZ = 0;
        scale = metrics.compact ? 1.08 : 1.12;
        opacity = 1;
      }

      const blur = abs > 2.4 ? Math.min(2.2, (abs - 2.4) * .8) : 0;

      item.slide.style.opacity = String(opacity);
      item.slide.style.zIndex = String(1000 - Math.round(abs * 90));
      item.slide.style.pointerEvents = abs < 2.65 ? "auto" : "none";
      item.slide.style.filter = blur ? "blur(" + blur.toFixed(2) + "px)" : "none";
      item.slide.style.transform =
        "translate(-50%,-50%) " +
        "translate3d(" + x.toFixed(2) + "px," + y.toFixed(2) + "px," + z.toFixed(2) + "px) " +
        "rotateY(" + rotateY.toFixed(2) + "deg) " +
        "rotateZ(" + rotateZ.toFixed(2) + "deg) " +
        "scale(" + scale.toFixed(4) + ")";

      item.card.classList.toggle("is-main", abs < .34);
      item.slide.classList.toggle("is-distant", abs > 2.2);
      item.slide.setAttribute("aria-hidden", String(abs > 2.15));
    });

    const currentPhoto = wrap(nearestVirtual);
    if (currentPhoto !== focusedPhotoIndex) {
      focusedPhotoIndex = currentPhoto;
      updateProgress(currentPhoto, true);
    }
  }

  function tick(time) {
    raf = 0;
    const dt = Math.min(2, Math.max(.35, (time - (lastFrame || time - 16.7)) / 16.7));
    lastFrame = time;

    if (!drag) {
      if (reducedMotion) {
        position = target;
        velocity = 0;
      } else {
        const distance = target - position;
        velocity += distance * .115 * dt;
        velocity *= Math.pow(.70, dt);
        position += velocity * dt;

        if (Math.abs(distance) < .0015 && Math.abs(velocity) < .0012) {
          position = target;
          velocity = 0;
        }
      }
    }

    renderScene();

    if (drag || Math.abs(target - position) > .0015 || Math.abs(velocity) > .0012) {
      requestSceneFrame();
    }
  }

  function requestSceneFrame() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function moveToVirtual(next, immediate = false) {
    target = next;
    if (immediate || reducedMotion) {
      position = target;
      velocity = 0;
      renderScene();
      return;
    }
    requestSceneFrame();
  }

  function itemFromTarget(targetNode) {
    const slide = targetNode?.closest?.(".album-slide");
    return slide ? items.find(item => item.slide === slide) : null;
  }

  viewport.addEventListener("pointerdown", event => {
    if (lightbox && !lightbox.hidden) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const item = itemFromTarget(event.target);
    drag = {
      id:event.pointerId,
      pointerType:event.pointerType,
      item,
      startX:event.clientX,
      startY:event.clientY,
      lastX:event.clientX,
      lastTime:performance.now(),
      velocityX:0,
      startPosition:position,
      moved:false
    };

    velocity = 0;
    target = position;
    viewport.classList.add("is-dragging");
    viewport.setPointerCapture?.(event.pointerId);
  });

  viewport.addEventListener("pointermove", event => {
    if (!drag || event.pointerId !== drag.id) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (!drag.moved && Math.hypot(dx, dy) > 6) {
      if (Math.abs(dy) > Math.abs(dx) * 1.15) return;
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
    target = position;
    renderScene();
  }, { passive:false });

  function finishDrag(event) {
    if (!drag || (event.pointerId != null && event.pointerId !== drag.id)) return;

    const state = drag;
    drag = null;
    viewport.classList.remove("is-dragging");

    if (state.moved) {
      const step = viewport.clientWidth < 700
        ? Math.max(145, viewport.clientWidth * .43)
        : Math.max(220, viewport.clientWidth * .22);

      const projected = position - state.velocityX * 180 / step;
      const maxJump = viewport.clientWidth < 700 ? 2 : 3;
      moveToVirtual(Math.round(clamp(projected, position - maxJump, position + maxJump)));
      return;
    }

    if (!state.item || state.item.photoIndex < 0) {
      moveToVirtual(Math.round(position));
      return;
    }

    if (state.pointerType === "mouse") {
      openLightbox(state.item.photoIndex, state.item.slide);
      return;
    }

    const now = performance.now();
    if (lastTouchTap.photoIndex === state.item.photoIndex && now - lastTouchTap.time < 330) {
      lastTouchTap = { time:0, photoIndex:-1 };
      openLightbox(state.item.photoIndex, state.item.slide);
      return;
    }

    lastTouchTap = { time:now, photoIndex:state.item.photoIndex };
    moveToVirtual(state.item.virtualIndex);
  }

  viewport.addEventListener("pointerup", finishDrag);
  viewport.addEventListener("pointercancel", event => {
    if (!drag || event.pointerId !== drag.id) return;
    drag = null;
    viewport.classList.remove("is-dragging");
    moveToVirtual(Math.round(position));
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
    moveToVirtual(Math.round(target) + direction);

    clearTimeout(wheelUnlockTimer);
    wheelUnlockTimer = setTimeout(() => {
      wheelLocked = false;
      wheelAccumulator = 0;
    }, 125);
  }, { passive:false });

  viewport.addEventListener("keydown", event => {
    if (lightbox && !lightbox.hidden) return;

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      moveToVirtual(Math.round(target) + (event.key === "ArrowRight" ? 1 : -1));
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openLightbox(wrap(Math.round(position)), viewport);
    }
  });

  function updateLightbox() {
    if (!photos.length || !lightboxImage || !lightboxCounter) return;

    lightboxIndex = wrap(lightboxIndex);
    const photo = photos[lightboxIndex];

    lightboxImage.src = versionedAsset(photo);
    lightboxImage.alt = tr("album.fullscreenPhotoAlt")
      .replace("{current}", String(lightboxIndex + 1))
      .replace("{total}", String(photos.length));

    lightboxCounter.textContent =
      String(lightboxIndex + 1).padStart(2, "0") +
      " / " +
      String(photos.length).padStart(2, "0");

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
    if (lightbox && !lightbox.hidden) updateLightbox();
  });

  let resizeTimer = 0;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      items.forEach(item => {
        const photo = photos[item.photoIndex];
        applyCardSize(item, photo?.ratio || item.ratio || .78);
      });
      renderScene();
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

      position = 0;
      target = 0;
      velocity = 0;
      focusedPhotoIndex = -1;

      rebuildItems();
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