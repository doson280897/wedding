/* Face detection runs offline. Only lightweight crop geometry runs in the browser. */
(() => {
  "use strict";
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  function framing(width, height, frameWidth, frameHeight, faces) {
    if (
      ![width, height, frameWidth, frameHeight].every((v) => Number.isFinite(v) && v > 0) ||
      !Array.isArray(faces) ||
      !faces.length ||
      !faces.every(
        (box) =>
          Array.isArray(box) &&
          box.length === 4 &&
          box.every(Number.isFinite) &&
          box[2] > 0 &&
          box[3] > 0,
      )
    )
      return null;
    // Include hair and a margin around the face; keep that region below the arch tip.
    const left = clamp(Math.min(...faces.map(([x, , w]) => x - w * 0.25)), 0, 1);
    const right = clamp(Math.max(...faces.map(([x, , w]) => x + w * 1.25)), 0, 1);
    const top = clamp(Math.min(...faces.map(([, y, , h]) => y - h * 0.65)), 0, 1);
    const bottom = clamp(Math.max(...faces.map(([, y, , h]) => y + h * 1.2)), 0, 1);
    const scale = Math.max(frameWidth / width, frameHeight / height);
    const rw = width * scale,
      rh = height * scale;
    if ((right - left) * rw > frameWidth * 0.85 || (bottom - top) * rh > frameHeight * 0.75)
      return { fit: "contain", position: "50% 50%" };
    const position = (rendered, frame, center, target) => {
      if (Math.abs(rendered - frame) < 0.01) return 50;
      const offset = clamp(frame * target - rendered * center, frame - rendered, 0);
      return (100 * offset) / (frame - rendered);
    };
    return {
      fit: "cover",
      position: `${position(rw, frameWidth, (left + right) / 2, 0.5)}% ${position(rh, frameHeight, (top + bottom) / 2, 0.43)}%`,
    };
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { framing };
    return;
  }
  const images = [...document.querySelectorAll(".portrait img[data-info-src]")];
  let metadata = {};
  const update = (img) => {
    const src = img.dataset.infoSrc
      .split(".")
      .reduce((value, key) => value?.[key], window.WEDDING_INFO);
    const entry = metadata[src];
    const result =
      entry &&
      framing(img.naturalWidth, img.naturalHeight, img.clientWidth, img.clientHeight, entry.faces);
    if (result && entry.width === img.naturalWidth && entry.height === img.naturalHeight) {
      img.style.objectFit = result.fit;
      img.style.objectPosition = result.position;
      img.dataset.framing = "auto";
    } else {
      img.style.objectFit = "cover";
      const fallback = img.dataset.infoPosition
        ?.split(".")
        .reduce((value, key) => value?.[key], window.WEDDING_INFO);
      img.style.objectPosition =
        fallback && CSS.supports("object-position", fallback) ? fallback : "50% 0%";
      img.dataset.framing = "fallback";
    }
  };
  const refresh = () => images.forEach(update);
  images.forEach((img) => img.addEventListener("load", () => update(img)));
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(refresh);
    images.forEach((img) => observer.observe(img));
  } else window.addEventListener("resize", refresh, { passive: true });
  document.addEventListener("wedding:languagechange", refresh);
  const version = new URL(document.currentScript.src).search;
  fetch(`images/optimized/portrait-focus.json${version}`)
    .then((response) => {
      if (!response.ok) throw new Error("Portrait metadata unavailable");
      return response.json();
    })
    .then((data) => {
      if (data.version === 1) metadata = data.images || {};
      refresh();
    })
    .catch(() => {
      refresh();
    });
  refresh();
})();
