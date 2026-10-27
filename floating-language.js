(() => {
  "use strict";
  const control = document.querySelector(".language-switch");
  if (!control) return;
  const edgeGap = 8;
  const key = "wedding:floating-controls:v2";
  const coarse = matchMedia("(hover: none), (pointer: coarse)");
  let positions = {};
  try { positions = JSON.parse(sessionStorage.getItem(key) || "{}") || {}; } catch (_) {}
  const save = () => {
    try { sessionStorage.setItem(key, JSON.stringify(positions)); } catch (_) {}
  };
  const anchor = (edge, top) => {
    const height = control.getBoundingClientRect().height;
    control.dataset.floatEdge = edge;
    control.style.top = Math.max(edgeGap, Math.min(innerHeight - height - edgeGap, top)) + "px";
    control.style.bottom = "auto";
    control.style.left = edge === "left" ? edgeGap + "px" : "auto";
    control.style.right = edge === "right" ? edgeGap + "px" : "auto";
  };
  const snap = () => {
    const rect = control.getBoundingClientRect();
    const edge = rect.left + rect.width / 2 < innerWidth / 2 ? "left" : "right";
    anchor(edge, rect.top);
    positions.language = { edge, top: parseFloat(control.style.top) };
    save();
  };
  control.classList.add("floating-control");
  const saved = positions.language;
  if (saved && ["left", "right"].includes(saved.edge)) anchor(saved.edge, Number(saved.top) || edgeGap);
  let idleTimer, drag, suppress = false, startedIdle = false;
  const wake = () => { clearTimeout(idleTimer); control.classList.remove("is-idle"); };
  const idle = (delay = 2600) => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { snap(); control.classList.add("is-idle"); }, delay);
  };
  const move = event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 6) {
      drag.moved = true;
      control.classList.add("is-dragging");
      control.style.right = "auto";
      control.style.bottom = "auto";
    }
    if (!drag.moved) return;
    event.preventDefault();
    const rect = control.getBoundingClientRect();
    control.style.left = Math.max(edgeGap, Math.min(innerWidth - rect.width - edgeGap, drag.left + dx)) + "px";
    control.style.top = Math.max(edgeGap, Math.min(innerHeight - rect.height - edgeGap, drag.top + dy)) + "px";
  };
  const finish = event => {
    if (!drag || event.pointerId !== drag.id) return;
    const moved = drag.moved;
    drag = null;
    control.classList.remove("is-dragging");
    window.removeEventListener("pointermove", move, true);
    window.removeEventListener("pointerup", finish, true);
    window.removeEventListener("pointercancel", finish, true);
    if (moved) {
      suppress = true;
      setTimeout(() => { suppress = false; }, 150);
      snap();
      idle(1050);
    } else idle();
  };
  control.addEventListener("pointerdown", event => {
    if (event.button != null && event.button !== 0) return;
    startedIdle = control.classList.contains("is-idle");
    wake();
    const rect = control.getBoundingClientRect();
    control.style.left = rect.left + "px";
    control.style.top = rect.top + "px";
    control.style.right = "auto";
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, moved: false };
    window.addEventListener("pointermove", move, { capture: true, passive: false });
    window.addEventListener("pointerup", finish, true);
    window.addEventListener("pointercancel", finish, true);
  }, { passive: true });
  control.addEventListener("click", event => {
    if (suppress || (coarse.matches && startedIdle)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      suppress = false;
      startedIdle = false;
      wake();
      idle(3400);
      return;
    }
    startedIdle = false;
    wake();
    idle();
  }, true);
  control.addEventListener("pointerenter", wake);
  control.addEventListener("pointerleave", () => idle());
  control.addEventListener("focusin", wake);
  control.addEventListener("focusout", () => idle());
  window.addEventListener("resize", () => {
    if (control.classList.contains("is-dragging")) return;
    const position = positions.language;
    if (position) anchor(position.edge, position.top);
  });
  idle(1500);
})();
