// Extracted from PostLayout.astro so the script always loads via BaseLayout.
// Init no-ops when no .rough-ann elements are in the DOM.

import { annotate } from 'rough-notation';
import type { RoughAnnotation, RoughAnnotationConfig, RoughAnnotationType } from 'rough-notation/lib/model.js';

declare global {
  interface Window {
    initializeAnnotations?: (opts?: { animate?: boolean }) => void;
    _roughAnnotations?: RoughAnnotation[];
    _annRun?: () => void;
    _annReanchor?: () => void;
  }
}

function initAnnotations({ animate = true }: { animate?: boolean } = {}) {
  const spans = document.querySelectorAll<HTMLElement>('.rough-ann');
  if (!spans.length) return;

  // rough-notation appends SVGs to <body> outside #swup-container, so Swup doesn't clean them
  document.querySelectorAll('svg.rough-annotation').forEach(el => el.remove());
  const prev = window._roughAnnotations;
  if (prev?.length) prev.forEach(a => { try { a.hide(); } catch {} });

  const cs = getComputedStyle(document.documentElement);
  const annColor = (type: string): string =>
    cs.getPropertyValue(`--ann-${type}`).trim() ||
    cs.getPropertyValue('--ann-highlight').trim();

  const annotations: RoughAnnotation[] = [];

  spans.forEach(span => {
    const type = (span.dataset.annType ?? 'highlight') as RoughAnnotationType;
    const color = annColor(type);
    const opts: RoughAnnotationConfig = {
      type,
      color,
      iterations: 2,
      animate,
      animationDuration: 500,
    };

    if (type !== 'circle') opts.multiline = true;
    if (type === 'bracket') opts.brackets = ['left', 'right'];

    const ann = annotate(span, opts);
    ann.show();
    annotations.push(ann);
  });

  window._roughAnnotations = annotations;
}

window.initializeAnnotations = initAnnotations;

// Re-anchor existing annotations to their spans' current positions WITHOUT
// recreating them. Each RoughAnnotation carries a stable `_seed`, so calling
// show() re-renders the SAME hand-drawn squiggle at the new rect with animation
// forced off (render(svg, true)). Recreating via initAnnotations() would assign
// fresh seeds → every annotation re-sketches = shimmer. Unmoved annotations
// re-render pixel-identically, so this is safe to call on the whole set.
function reanchorAnnotations() {
  const anns = window._roughAnnotations;
  if (!anns?.length) return;
  anns.forEach(a => { try { a.show(); } catch {} });
}
window._annReanchor = reanchorAnnotations;

// Draw only once span geometry is final. Fonts load with `font-display: swap`,
// so body text reflows after first paint and shifts annotated spans. The old
// triggers (DOMContentLoaded, or a fixed 250ms timer) captured positions before
// that swap, and rough-notation only self-heals on window-resize / changes to a
// span's OWN size — never for a span displaced by upstream reflow — so
// annotations sat at stale coordinates until a manual resize/DevTools reflow.
// Gating on document.fonts.ready removes the guesswork; the window-load pass
// re-anchors for any late images that lack intrinsic dimensions.
function whenFontsReady(cb: () => void) {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (fonts && fonts.status !== 'loaded') fonts.ready.then(() => requestAnimationFrame(cb));
  else requestAnimationFrame(cb);
}

let _annLastPath = '';
function schedule(animate: boolean) {
  const path = window.location.pathname;
  if (path === _annLastPath) return;
  _annLastPath = path;
  whenFontsReady(() => initAnnotations({ animate }));
  if (document.readyState !== 'complete') {
    window.addEventListener(
      'load',
      () => requestAnimationFrame(() => initAnnotations({ animate: false })),
      { once: true }
    );
  }
}
function runAnnotations() { schedule(false); }
window._annRun = runAnnotations;

document.addEventListener('DOMContentLoaded', () => schedule(true));
document.addEventListener('astro:page-load', runAnnotations);
if (document.readyState !== 'loading') schedule(false);
window.addEventListener('pageshow', e => {
  if (e.persisted) { _annLastPath = ''; schedule(true); }
});

// Redraw with fresh colors on dark/light flips (class mutation) and palette
// switches ('themechange' fires after updateThemeCSSVariables finishes, so the
// new --ann-* values are already resolvable). Both can fire for one change —
// coalesce so we only redraw once.
let _annRedrawTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleAnnRedraw() {
  clearTimeout(_annRedrawTimer);
  _annRedrawTimer = setTimeout(() => initAnnotations({ animate: false }), 60);
}
window.addEventListener('themechange', scheduleAnnRedraw);

let _annLastDark = document.documentElement.classList.contains('dark');
new MutationObserver(() => {
  const isDark = document.documentElement.classList.contains('dark');
  if (isDark !== _annLastDark) { _annLastDark = isDark; scheduleAnnRedraw(); }
}).observe(document.documentElement, { attributeFilter: ['class'] });
