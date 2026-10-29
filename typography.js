(() => {
  "use strict";

  // Fit short display copy to its actual container, not a device breakpoint.
  // Explicit <br> lines remain deliberate; paragraphs keep a readable size.
  const selector = [
    '.section-title', '.album-header h2', '.family-card h3', '.family-card h4',
    '.promise-copy h3', '.person-copy h3', '.location-info h3', '.gift-card h3',
    '.closing h2', '.wq-heading', '#partySelectorTitle', '#linkToolTitle',
    '.overline', '.album-eyebrow', '.event-label', '.hero-count-title',
    '.moonlight-gate__recipient-label', '.moonlight-gate__reveal-subtitle'
  ].join(',');
  const nodes = [...document.querySelectorAll(selector)];
  const pending = new Set();
  const visible = new Set();
  const widths = new WeakMap();
  let frame = 0;

  const queue = node => {
    pending.add(node);
    if (!frame) frame = requestAnimationFrame(fit);
  };
  const queueVisible = () => visible.forEach(queue);
  const reset = node => {
    node.style.removeProperty('font-size');
    node.style.removeProperty('letter-spacing');
  };

  function fit() {
    frame = 0;
    const batch = [...pending].filter(node => node.isConnected && node.getClientRects().length && node.clientWidth);
    pending.clear();
    // Batch writes, then measurements, then writes. No scroll-time polling.
    for (const node of batch) {
      node.dataset.typeMode = 'line';
      reset(node);
      node.querySelectorAll('em,span,strong').forEach(reset);
    }
    const measurements = batch.map(node => {
      const css = getComputedStyle(node);
      const size = parseFloat(css.fontSize);
      const padding = parseFloat(css.paddingLeft) + parseFloat(css.paddingRight);
      const available = node.clientWidth - padding;
      const natural = node.scrollWidth - padding;
      const scale = Math.min(1, Math.max(0, (available - 2) / Math.max(1, natural)));
      const minimum = node.matches('h2,h3,h4') ? 18 : 8;
      const parts = [node, ...node.querySelectorAll('em,span,strong')].map(part => {
        const style = getComputedStyle(part);
        return {part,size:parseFloat(style.fontSize),spacing:parseFloat(style.letterSpacing)};
      });
      return {node,scale,minimum,size,parts};
    });
    for (const {node,scale,minimum,size,parts} of measurements) {
      if (size * scale < minimum) {
        // Very long custom/translated copy may need balanced lines instead
        // of illegibly small type, clipping or a horizontal scrollbar.
        node.dataset.typeMode = 'wrap';
        continue;
      }
      if (scale >= .995) continue;
      for (const {part,size:partSize,spacing} of parts) {
        part.style.fontSize = (partSize * scale).toFixed(3) + 'px';
        if (Number.isFinite(spacing)) part.style.letterSpacing = (spacing * scale).toFixed(3) + 'px';
      }
    }
  }

  const tidyParagraphs = () => {
    document.querySelectorAll('.section-lead,.promise-copy p,.closing-note,.person-copy p,.family-address,.event-address,.lunar,.location-info p,.invitation-promise,.handwriting,.album-header > p:last-child').forEach(node => {
      if (node.childElementCount) return;
      const text = node.textContent.replace(/(\S+)\s+(\S+)\s*$/, '$1\u00a0$2');
      if (text !== node.textContent) node.textContent = text;
    });
  };
  nodes.forEach(node => node.classList.add('responsive-line'));
  tidyParagraphs();

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {visible.add(entry.target);queue(entry.target);}
        else visible.delete(entry.target);
      }
    }, {rootMargin:'240px 0px'});
    nodes.forEach(node => observer.observe(node));
  } else {
    nodes.forEach(node => {visible.add(node);queue(node);});
  }
  if ('ResizeObserver' in window) {
    const parents = new Map();
    for (const node of nodes) {
      const siblings = parents.get(node.parentElement) || [];
      siblings.push(node);
      parents.set(node.parentElement, siblings);
    }
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (widths.get(entry.target) === width) continue;
        widths.set(entry.target, width);
        parents.get(entry.target).forEach(node => {if (visible.has(node)) queue(node);});
      }
    });
    parents.forEach((_,parent) => observer.observe(parent));
  }
  window.addEventListener('resize', queueVisible, {passive:true});
  document.fonts?.ready.then(queueVisible).catch(() => {});
  document.fonts?.addEventListener?.('loadingdone', queueVisible);
  document.addEventListener('wedding:languagechange', () => {tidyParagraphs();queueVisible();});
})();
