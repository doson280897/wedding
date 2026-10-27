(() => {
  "use strict";
  const toggle = document.getElementById("wqToggle");
  const panel = document.getElementById("wqPanel");
  const backdrop = document.getElementById("wqBackdrop");
  const closeBtn = document.getElementById("wqClose");
  if (!toggle || !panel || !backdrop || !closeBtn) return;
  const links = [...panel.querySelectorAll(".wq-link")];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let open = false;
  const setOpen = (value, restoreFocus = true) => {
    if (open === value) return;
    open = value;
    panel.classList.toggle("is-open", value);
    backdrop.hidden = !value;
    panel.setAttribute("aria-hidden", String(!value));
    panel.inert = !value;
    toggle.setAttribute("aria-expanded", String(value));
    toggle.setAttribute("aria-label", value ? "Đóng mục lục thiệp cưới" : "Mở mục lục thiệp cưới");
    document.body.classList.toggle("wq-menu-open", value);
    if (value) closeBtn.focus({preventScroll:true});
    else if (restoreFocus) toggle.focus({preventScroll:true});
  };
  toggle.addEventListener("click", () => setOpen(!open));
  closeBtn.addEventListener("click", () => setOpen(false));
  backdrop.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", event => {
    if (!open) return;
    if (event.key === "Escape") {event.preventDefault();setOpen(false);return;}
    if (event.key !== "Tab") return;
    const focusable = [closeBtn, ...links];
    if(event.shiftKey && document.activeElement===focusable[0]){event.preventDefault();focusable.at(-1).focus();}
    else if(!event.shiftKey && document.activeElement===focusable.at(-1)){event.preventDefault();focusable[0].focus();}
  });
  links.forEach(link => link.addEventListener("click", event => {
    const id = link.getAttribute("href")?.slice(1);
    const target = id && document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    setOpen(false,false);
    history.replaceState(null,"",location.pathname+location.search+"#"+encodeURIComponent(id));
    target.scrollIntoView({behavior:reduced.matches?"auto":"smooth",block:"start"});
    links.forEach(item => item.setAttribute("aria-current", String(item===link)));
  }));
})();