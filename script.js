// Guest-name, timer, scroll animations and portrait demo fallbacks.
const params = new URLSearchParams(window.location.search);
const guest = params.get('to');
const guestNode = document.getElementById('guestName');
if (guest && guestNode) {
  const display = guest.replace(/[_+]/g, ' ').trim().slice(0, 100);
  if (display) guestNode.textContent = `Trân trọng kính mời ${display}`;
}
const targetDate = new Date('2026-11-14T11:00:00+07:00').getTime();
let timerId;
function countdown() {
  const remain = Math.max(0, targetDate - Date.now());
  if (!remain) {
    clearInterval(timerId);
    document.getElementById('timer').innerHTML = '<p class="finished">Ngày vui đã đến ♡</p>';
    return;
  }
  const values = [Math.floor(remain / 86400000), Math.floor(remain / 3600000) % 24,
    Math.floor(remain / 60000) % 60, Math.floor(remain / 1000) % 60];
  ['days','hours','minutes','seconds'].forEach((id, index) => {
    document.getElementById(id).textContent = String(values[index]).padStart(2,'0');
  });
}
countdown();
timerId = setInterval(countdown, 1000);
const progress = document.getElementById('progress');
addEventListener('scroll', () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  progress.style.width = `${max ? scrollY / max * 100 : 0}%`;
}, {passive:true});
const reveal = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('visible'); io.unobserve(entry.target); }
  }), {threshold:.1});
  reveal.forEach(node => io.observe(node));
} else reveal.forEach(node => node.classList.add('visible'));
// Until real portraits are copied into assets/, show sample photos.
document.querySelectorAll('img[data-demo-src]').forEach(img => {
  img.addEventListener('error', function fallback() {
    img.removeEventListener('error', fallback);
    img.src = img.dataset.demoSrc;
  });
});
