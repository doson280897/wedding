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
  document.addEventListener("wedding:languagechange", () => {
    if (status && !status.hidden) setStatus(statusKey);
    updateEditorialCaption(false);
  });
  if (!viewport || !space) return;

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DURATION = reducedMotion ? 0 : 720;
  const TOTAL_SLOTS = 7; // -3 .. +3, edge slots are invisible buffers
  const VISIBLE_RADIUS = 2;

  let photos = [];
  let current = 0;
  let slots = [];
  let moving = false;
  let pendingDirection = 0;
  let down = null;
  let lastAnimation = null;

  const wrap = i => ((i % photos.length) + photos.length) % photos.length;

  function updateEditorialCaption(animate = true) {
    if (!captionNumber || !captionText || !photos.length) return;
    captionNumber.textContent = String(current + 1).padStart(2, "0");
    captionText.textContent = tr("album.caption." + (current % 5));
    if (editorialCaption && animate && !reducedMotion) {
      editorialCaption.classList.remove("is-changing");
      void editorialCaption.offsetWidth;
      editorialCaption.classList.add("is-changing");
    }
  }

  function updateProgress(animateCaption = true) {
    counter.textContent = `${String(current + 1).padStart(2, "0")} / ${String(photos.length).padStart(2, "0")}`;
    progress.style.width = `${100 * (current + 1) / photos.length}%`;
    updateEditorialCaption(animateCaption);
  }

  function createSlot(relative) {
    const node = document.createElement("div");
    node.className = "album-card";
    node.setAttribute("aria-hidden", "true");
    const img = document.createElement("img");
    img.className = "album-photo";
    img.alt = "";
    img.draggable = false;
    img.decoding = "async";
    img.loading = relative === 0 ? "eager" : "lazy";
    img.fetchPriority = relative === 0 ? "high" : "low";
    const label = document.createElement("span");
    label.className = "album-card-number";
    node.append(img, label);
    space.append(node);
    return { node, img, label, relative, photoIndex: -1 };
  }

  function setPhoto(slot, imageIndex) {
    imageIndex = wrap(imageIndex);
    if (slot.photoIndex === imageIndex) return;
    slot.photoIndex = imageIndex;
    slot.img.src = photos[imageIndex].src;
    slot.label.textContent = `${String(imageIndex + 1).padStart(2, "0")} / ${String(photos.length).padStart(2, "0")}`;
  }

  function place(slot, relative, animate) {
    const abs = Math.abs(relative);
    const compact = viewport.clientWidth < 700;
    const gap = compact ? Math.min(viewport.clientWidth * .48, 190) : Math.min(viewport.clientWidth * .255, 305);
    const x = gap * relative * (1 + .07 * abs);
    const y = relative === 0 ? -4 : (compact ? 11 : 16) + abs * (compact ? 6 : 9);
    const zStep = compact ? 155 : 190;
    const z = relative === 0 ? (compact ? 128 : 156) : -abs * zStep;
    const ry = relative === 0 ? 0 : -Math.sign(relative) * Math.min(23 + abs * 11, 52);
    const rz = relative === 0 ? 0 : relative * .55;
    const scale = relative === 0 ? (compact ? 1.12 : 1.1) : abs === 1 ? .84 : abs === 2 ? .68 : .58;
    const opacity = abs > VISIBLE_RADIUS ? 0 : abs === 0 ? 1 : abs === 1 ? .64 : .24;
    const blur = abs === 0 ? 0 : abs === 1 ? .7 : 2.2;
    const brightness = abs === 0 ? 1 : abs === 1 ? .78 : .58;

    slot.node.style.transition = animate
      ? `transform ${DURATION}ms cubic-bezier(.18,.78,.18,1), opacity ${DURATION}ms ease`
      : "none";
    slot.node.style.transform = `translate3d(${x}px,${y}px,${z}px) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${scale})`;
    slot.node.style.opacity = String(opacity);
    slot.node.style.zIndex = String(30 - abs);
    slot.node.style.pointerEvents = "none";
    slot.node.style.setProperty("--album-depth-blur", blur + "px");
    slot.node.style.setProperty("--album-depth-brightness", String(brightness));
    slot.node.classList.toggle("is-main", relative === 0);
    slot.node.classList.toggle("is-near", abs === 1);
    slot.node.classList.toggle("is-far", abs >= 2);
    slot.relative = relative;
  }

  function initialize() {
    space.replaceChildren();
    slots = [];
    for (let relative = -3; relative <= 3; relative++) {
      const slot = createSlot(relative);
      setPhoto(slot, current + relative);
      place(slot, relative, false);
      slots.push(slot);
    }
    updateProgress(false);
  }

  // 7 physical frames: 5 visible + 2 invisible buffers.
  // All visible frames move smoothly in one direction. We recycle only
  // the off-screen frame, after the animation, without visible jumps.
  function move(direction) {
    if (photos.length < 2) return;
    if (moving) { pendingDirection = direction; return; }
    moving = true;
    current = wrap(current + direction);
    updateProgress(true);
    viewport.classList.add("is-dollying");

    slots.forEach(slot => place(slot, slot.relative - direction, true));

    clearTimeout(lastAnimation);
    lastAnimation = setTimeout(() => {
      const far = slots.find(slot => slot.relative === -4 * direction);
      if (far) {
        const freshRelative = 3 * direction;
        // Relocate only outside the visible area; nothing teleports on-screen.
        place(far, freshRelative, false);
        setPhoto(far, current + freshRelative);
      }
      moving = false;
      viewport.classList.remove("is-dollying");
      if (pendingDirection) {
        const next = pendingDirection;
        pendingDirection = 0;
        move(next);
      }
    }, DURATION + 24);
  }

  viewport.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    down = { x: e.clientX, y: e.clientY };
    if (e.pointerType === "mouse") viewport.setPointerCapture?.(e.pointerId);
  });
  viewport.addEventListener("pointerup", e => {
    if (!down) return;
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    down = null;
    if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy) * 1.1) {
      move(dx < 0 ? 1 : -1);
    }
  });
  viewport.addEventListener("pointercancel", () => { down = null; });
  viewport.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      move(e.key === "ArrowRight" ? 1 : -1);
    }
  });

  // Subtle camera tilt on desktop, deliberately small to avoid GPU overload.
  let raf = 0;
  viewport.addEventListener("pointermove", e => {
    if (down || e.pointerType !== "mouse" || reducedMotion) return;
    const rect = viewport.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - .5;
    const py = (e.clientY - rect.top) / rect.height - .5;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      space.style.transform = `rotateY(${-px * 3}deg) rotateX(${py * 2}deg)`;
    });
  }, { passive: true });
  viewport.addEventListener("pointerleave", () => {
    cancelAnimationFrame(raf);
    space.style.transform = "";
  });
  window.addEventListener("resize", () => {
    slots.forEach(slot => place(slot, slot.relative, false));
  });

  async function start() {
    setStatus("album.loading");
    try {
      const response = await fetch("./images.json", { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const manifest = await response.json();
      const list = Array.isArray(manifest) ? manifest : manifest.photos;
      if (!Array.isArray(list)) throw new Error("Invalid manifest");
      photos = list.filter(p => p && typeof p.src === "string" && p.src);
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
    }, { rootMargin:"600px 0px", threshold:0 });
    lazyObserver.observe(albumSection);
  } else {
    start();
  }
})();
