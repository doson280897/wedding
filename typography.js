(() => {
  "use strict";

  // Fit short display copy to its actual container, not a device breakpoint.
  // Explicit <br> lines remain deliberate; paragraphs keep a readable size.
  const nodes = [...document.querySelectorAll('[data-text-fit]')];
  const pending = new Set();
  const visible = new Set();
  const widths = new WeakMap();
  let frame = 0;
  let generation = 0;
  const versions = new WeakMap();

  const queue = node => {
    pending.add(node);
    if (!frame) frame = requestAnimationFrame(fit);
  };
  const queueVisible = () => visible.forEach(queue);
  const queueAll = () => nodes.forEach(queue);
  const reset = node => {
    node.style.removeProperty('font-size');
    node.style.removeProperty('letter-spacing');
  };

  function fit() {
    frame = 0;
    const version = ++generation;
    const batch = [...pending].filter(node => node.isConnected && node.getClientRects().length && node.clientWidth);
    pending.clear();
    // Batch writes, then measurements, then writes. No scroll-time polling.
    for (const node of batch) {
      versions.set(node, version);
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
      const scale = natural <= available ? 1 : Math.min(1, Math.max(0, (available - 2) / Math.max(1, natural)));
      const minimum = parseFloat(css.getPropertyValue('--text-fit-min')) || 18;
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
    // Font rasterization/italic overhang can differ from the initial ratio.
    // Verify the actual result, with a bounded correction rather than a loop.
    requestAnimationFrame(() => verify(batch, version, 3));
  }

  function verify(batch, version, remaining) {
    if (!remaining) return;
    const corrections = [];
    for (const node of batch) {
      if (versions.get(node) !== version || node.dataset.typeMode !== 'line' || !node.clientWidth) continue;
      if (node.scrollWidth <= node.clientWidth + 1) continue;
      const css = getComputedStyle(node);
      const padding = parseFloat(css.paddingLeft) + parseFloat(css.paddingRight);
      const scale = (node.clientWidth - padding - 2) / Math.max(1,node.scrollWidth - padding);
      const minimum = parseFloat(css.getPropertyValue('--text-fit-min')) || 18;
      const parts = [node,...node.querySelectorAll('em,span,strong')].map(part => {
        const style=getComputedStyle(part);
        return {part,size:parseFloat(style.fontSize),spacing:parseFloat(style.letterSpacing)};
      });
      corrections.push({node,parts,scale,minimum});
    }
    for (const {node,parts,scale,minimum} of corrections) {
      if (parts[0].size * scale < minimum) {node.dataset.typeMode='wrap';continue;}
      for(const {part,size,spacing} of parts) {
        part.style.fontSize=(size*scale).toFixed(3)+'px';
        if(Number.isFinite(spacing)) part.style.letterSpacing=(spacing*scale).toFixed(3)+'px';
      }
    }
    if(corrections.length) requestAnimationFrame(()=>verify(batch,version,remaining-1));
  }

  const tidyParagraphs = () => {
    document.querySelectorAll('[data-text-flow="prose"]').forEach(node => {
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
        // WebKit can defer intersection updates after scroll/rotation. A
        // changed container must invalidate all its headings, even offscreen.
        parents.get(entry.target).forEach(queue);
      }
    });
    parents.forEach((_,parent) => observer.observe(parent));
  }
  let previousWidth = window.WeddingLayout.viewport().layoutWidth;
  window.WeddingLayout.subscribe(view => {
    if (view.layoutWidth !== previousWidth) {previousWidth=view.layoutWidth;queueAll();}
  });
  // Fallback browsers must also re-fit panels revealed after initial load.
  if (!('IntersectionObserver' in window)) {
    const observer = new MutationObserver(queueVisible);
    document.querySelectorAll('#wmModal,#wgModal,#settingsPanel,#linkToolScreen,#partySelector,#calendarDialog').forEach(node =>
      observer.observe(node,{attributes:true,attributeFilter:['hidden','open']}));
  }
  document.fonts?.ready.then(queueAll).catch(() => {});
  document.fonts?.addEventListener?.('loadingdone', queueAll);
  document.addEventListener('wedding:languagechange', () => {tidyParagraphs();queueAll();});
})();
