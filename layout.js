(() => {
  "use strict";

  // One source of viewport geometry for all UI. No device-name detection.
  const root = document.documentElement;
  // CSS owns gesture policy; these cancelable-event guards also cover
  // WebViews that do not fully honour touch-action or viewport constraints.
  const preventTouchZoom = (event) => {
    if (event.cancelable && (!event.touches || event.touches.length > 1)) event.preventDefault();
  };
  for (const type of ["touchstart", "touchmove", "gesturestart", "gesturechange"])
    document.addEventListener(type, preventTouchZoom, { passive: false });
  const subscribers = new Set();
  const probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText =
    "position:fixed;visibility:hidden;pointer-events:none;inset:0;" +
    "padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) " +
    "env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)";
  document.body.append(probe);
  let safe = { top: 0, right: 0, bottom: 0, left: 0 };
  let frame = 0;
  let insetKey = "";

  function readInsets() {
    const key = innerWidth + ":" + innerHeight;
    if (key === insetKey) return;
    insetKey = key;
    const css = getComputedStyle(probe);
    for (const side of ["top", "right", "bottom", "left"])
      safe[side] = parseFloat(css.getPropertyValue("padding-" + side)) || 0;
  }
  function viewport() {
    const view = window.visualViewport;
    const left = view?.offsetLeft || 0,
      top = view?.offsetTop || 0;
    const width = view?.width || innerWidth,
      height = view?.height || innerHeight;
    return {
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      layoutWidth: innerWidth,
      layoutHeight: innerHeight,
      safe: { ...safe },
    };
  }
  function publish() {
    frame = 0;
    readInsets();
    const current = viewport();
    for (const [name, value] of Object.entries({
      width: current.width,
      height: current.height,
      left: current.left,
      top: current.top,
    })) {
      const property = "--viewport-" + name;
      const text = value + "px";
      if (root.style.getPropertyValue(property) !== text) root.style.setProperty(property, text);
    }
    subscribers.forEach((callback) => callback(current));
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(publish);
  }
  window.WeddingLayout = {
    viewport,
    subscribe(callback) {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
  };
  addEventListener("resize", schedule, { passive: true });
  addEventListener("pageshow", schedule);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) schedule();
  });
  window.visualViewport?.addEventListener("resize", schedule, { passive: true });
  window.visualViewport?.addEventListener("scroll", schedule, { passive: true });
  publish();
})();
