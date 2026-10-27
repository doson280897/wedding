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
  const SLOT_RADIUS = 4;
  const FRICTION = 0.0042;
  const STOP_VELOCITY = 0.00035;
  const MAX_VELOCITY = 0.02;

  let photos = [];
  let slots = [];
  let position = 0;
  let virtualCenter = 0;
  let settledLogicalIndex = 0;
  let velocity = 0;
  let motionFrame = 0;
  let dragging = false;
  let pointerId = null;
  let lastX = 0;
  let lastTime = 0;
  let dragDistance = 0;

  const wrap = i => ((i % photos.length) + photos.length) % photos.length;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function spacing() {
    const compact = viewport.clientWidth < 700;
    return compact
      ? Math.min(viewport.clientWidth * 0.68, 285)
      : Math.min(viewport.clientWidth * 0.31, 360);
  }

  function updateEditorialCaption(animate = true) {
    if (!captionNumber || !captionText || !photos.length) return;
    const current = wrap(settledLogicalIndex);
    captionNumber.textContent = String(current + 1).padStart(2, "0");
    captionText.textContent = tr("album.caption." + (current % 5));
    if (editorialCaption && animate && !reducedMotion) {
      editorialCaption.classList.remove("is-changing");
      void editorialCaption.offsetWidth;
      editorialCaption.classList.add("is-changing");
    }
  }

  function updateProgress(animateCaption = true) {
    if (!photos.length) return;
    const current = wrap(settledLogicalIndex);
    if (counter) counter.textContent = `${String(current + 1).padStart(2, "0")} / ${String(photos.length).padStart(2, "0")}`;
    if (progress) progress.style.width = `${100 * (current + 1) / photos.length}%`;
    updateEditorialCaption(animateCaption);
  }

  document.addEventListener("wedding:languagechange", () => {
    if (status && !status.hidden) setStatus(statusKey);
    updateEditorialCaption(false);
  });

  function createSlot(logicalIndex) {
    const node = document.createElement("div");
    node.className = "album-card";
    node.setAttribute("aria-hidden", "true");

    const img = document.createElement("img");
    img.className = "album-photo";
    img.alt = "";
    img.draggable = false;
    img.decoding = "async";
    img.loading = logicalIndex === 0 ? "eager" : "lazy";
    img.fetchPriority = logicalIndex === 0 ? "high" : "low";

    const label = document.createElement("span");
    label.className = "album-card-number";

    node.append(img, label);
    space.append(node);
    return { node, img, label, logicalIndex, photoIndex: -1 };
  }

  function setPhoto(slot, logicalIndex) {
    slot.logicalIndex = logicalIndex;
    const imageIndex = wrap(logicalIndex);
    if (slot.photoIndex === imageIndex) return;
    slot.photoIndex = imageIndex;
    slot.img.src = photos[imageIndex].src;
    slot.label.textContent = `${String(imageIndex + 1).padStart(2, "0")} / ${String(photos.length).padStart(2, "0")}`;
  }

  function recycleSlots() {
    const desiredCenter = Math.round(position);

    while (virtualCenter < desiredCenter) {
      const oldLeft = virtualCenter - SLOT_RADIUS;
      const slot = slots.find(item => item.logicalIndex === oldLeft);
      virtualCenter++;
      if (slot) setPhoto(slot, virtualCenter + SLOT_RADIUS);
    }

    while (virtualCenter > desiredCenter) {
      const oldRight = virtualCenter + SLOT_RADIUS;
      const slot = slots.find(item => item.logicalIndex === oldRight);
      virtualCenter--;
      if (slot) setPhoto(slot, virtualCenter - SLOT_RADIUS);
    }
  }

  function place(slot) {
    const relative = slot.logicalIndex - position;
    const abs = Math.abs(relative);
    const compact = viewport.clientWidth < 700;
    const gap = spacing();

    // A shallow continuous arc: it reads as one ribbon rather than floating cards.
    const x = gap * relative;
    const y = Math.min(abs * abs * (compact ? 7 : 10), compact ? 42 : 58);
    const z = -Math.min(abs * abs * (compact ? 44 : 58), compact ? 260 : 340);
    const ry = clamp(-relative * (compact ? 10 : 8), compact ? -32 : -28, compact ? 32 : 28);
    const rz = clamp(relative * (compact ? 0.55 : 0.38), -2.1, 2.1);
    const scale = Math.max(compact ? 0.78 : 0.8, 1 - abs * (compact ? 0.075 : 0.06));
    const opacity = abs > SLOT_RADIUS - 0.25 ? 0 : Math.max(0.18, 1 - abs * 0.2);
    const blur = abs < 0.6 ? 0 : Math.min(2.2, (abs - 0.45) * (compact ? 0.72 : 0.6));
    const brightness = abs < 0.55 ? 1 : Math.max(0.62, 1 - abs * 0.1);
    const focused = abs < 0.48;

    slot.node.style.transform = `translate3d(${x}px,${y}px,${z}px) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${scale})`;
    slot.node.style.opacity = String(opacity);
    slot.node.style.zIndex = String(50 - Math.round(abs * 5));
    slot.node.style.setProperty("--album-depth-blur", blur + "px");
    slot.node.style.setProperty("--album-depth-brightness", String(brightness));
    slot.node.classList.toggle("is-main", focused);
    slot.node.classList.toggle("is-near", !focused && abs < 1.55);
    slot.node.classList.toggle("is-far", abs >= 1.55);
  }

  function render() {
    recycleSlots();
    slots.forEach(place);

    const speed = Math.abs(velocity);
    const lean = clamp(-velocity * 150, -2.4, 2.4);
    space.style.transform = `rotateZ(${lean}deg)`;
    viewport.classList.toggle("is-moving", dragging || speed > STOP_VELOCITY);
    viewport.classList.toggle("is-dragging", dragging);
  }

  function initialize() {
    space.replaceChildren();
    slots = [];
    position = 0;
    virtualCenter = 0;
    settledLogicalIndex = 0;
    velocity = 0;

    for (let logicalIndex = -SLOT_RADIUS; logicalIndex <= SLOT_RADIUS; logicalIndex++) {
      const slot = createSlot(logicalIndex);
      setPhoto(slot, logicalIndex);
      slots.push(slot);
    }

    render();
    updateProgress(false);
    viewport.classList.add("is-settled");
  }

  function cancelMotion() {
    if (motionFrame) cancelAnimationFrame(motionFrame);
    motionFrame = 0;
  }

  function settle(targetLogicalIndex, animateCaption = true) {
    position = targetLogicalIndex;
    velocity = 0;
    settledLogicalIndex = targetLogicalIndex;
    render();
    space.style.transform = "";
    viewport.classList.remove("is-moving", "is-dragging");
    viewport.classList.add("is-settled");
    updateProgress(animateCaption);
  }

  function snapTo(targetLogicalIndex, animateCaption = true) {
    cancelMotion();
    const startPosition = position;
    const distance = targetLogicalIndex - startPosition;

    if (reducedMotion || Math.abs(distance) < 0.001) {
      settle(targetLogicalIndex, animateCaption);
      return;
    }

    const duration = 260 + Math.min(180, Math.abs(distance) * 180);
    const startTime = performance.now();
    viewport.classList.add("is-moving");
    viewport.classList.remove("is-settled");

    const frame = now => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      position = startPosition + distance * eased;
      velocity = distance * (1 - t) * 0.0018;
      render();

      if (t < 1) {
        motionFrame = requestAnimationFrame(frame);
      } else {
        motionFrame = 0;
        settle(targetLogicalIndex, animateCaption);
      }
    };

    motionFrame = requestAnimationFrame(frame);
  }

  function startInertia(initialVelocity) {
    cancelMotion();

    if (reducedMotion) {
      const direction = Math.sign(initialVelocity);
      const target = Math.round(position + (Math.abs(initialVelocity) > 0.0025 ? direction * 0.5 : 0));
      snapTo(target);
      return;
    }

    velocity = clamp(initialVelocity, -MAX_VELOCITY, MAX_VELOCITY);
    viewport.classList.add("is-moving");
    viewport.classList.remove("is-settled");
    let previous = performance.now();

    const frame = now => {
      const dt = Math.min(34, Math.max(1, now - previous));
      previous = now;

      position += velocity * dt;
      velocity *= Math.exp(-FRICTION * dt);
      render();

      if (Math.abs(velocity) > STOP_VELOCITY) {
        motionFrame = requestAnimationFrame(frame);
      } else {
        motionFrame = 0;
        snapTo(Math.round(position));
      }
    };

    motionFrame = requestAnimationFrame(frame);
  }

  function beginDrag(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    cancelMotion();
    dragging = true;
    pointerId = event.pointerId;
    lastX = event.clientX;
    lastTime = performance.now();
    dragDistance = 0;
    velocity = 0;
    viewport.classList.remove("is-settled");
    viewport.setPointerCapture?.(event.pointerId);
    render();
  }

  function drag(event) {
    if (!dragging || event.pointerId !== pointerId) return;
    const now = performance.now();
    const dx = event.clientX - lastX;
    const dt = Math.max(8, now - lastTime);
    const unitDelta = -dx / spacing();
    const instantVelocity = unitDelta / dt;

    position += unitDelta;
    dragDistance += Math.abs(dx);
    velocity = velocity * 0.68 + instantVelocity * 0.32;
    lastX = event.clientX;
    lastTime = now;
    render();
  }

  function endDrag(event) {
    if (!dragging || (event.pointerId != null && event.pointerId !== pointerId)) return;
    dragging = false;
    pointerId = null;

    if (dragDistance < 7 || Math.abs(velocity) < STOP_VELOCITY) {
      snapTo(Math.round(position));
      return;
    }

    const projected = clamp(velocity * 1.08, -MAX_VELOCITY, MAX_VELOCITY);
    startInertia(projected);
  }

  viewport.addEventListener("pointerdown", beginDrag);
  viewport.addEventListener("pointermove", drag);
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);
  viewport.addEventListener("lostpointercapture", event => {
    if (dragging && event.pointerId === pointerId) endDrag(event);
  });

  viewport.addEventListener("keydown", event => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const base = Math.round(position);
    snapTo(base + (event.key === "ArrowRight" ? 1 : -1));
  });

  window.addEventListener("resize", render);

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
    }, { rootMargin:"600px 0px", threshold:0 });
    lazyObserver.observe(albumSection);
  } else {
    start();
  }
})();