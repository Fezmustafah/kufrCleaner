// Extracted from PostLayout.astro so the script always loads via BaseLayout.
// Init no-ops when no .rough-ann elements are in the DOM.

import { annotate } from 'rough-notation';
import type { RoughAnnotation, RoughAnnotationConfig, RoughAnnotationType } from 'rough-notation/lib/model.js';

declare global {
  interface Window {
    initializeAnnotations?: (opts?: { animate?: boolean }) => void;
    _roughAnnotations?: RoughAnnotation[];
    _annRun?: () => void;
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

let _annLastPath = '';
function runAnnotations() {
  const path = window.location.pathname;
  if (path === _annLastPath) return;
  _annLastPath = path;
  setTimeout(() => initAnnotations({ animate: false }), 250);
}
window._annRun = runAnnotations;

document.addEventListener('DOMContentLoaded', () => {
  if (_annLastPath) return;
  _annLastPath = window.location.pathname;
  initAnnotations({ animate: true });
});
document.addEventListener('astro:page-load', runAnnotations);
if (document.readyState !== 'loading' && !_annLastPath) {
  _annLastPath = window.location.pathname;
  setTimeout(() => initAnnotations({ animate: false }), 250);
}
window.addEventListener('pageshow', e => {
  if (e.persisted) { _annLastPath = ''; initAnnotations({ animate: true }); }
});

let _annLastDark = document.documentElement.classList.contains('dark');
new MutationObserver(() => {
  const isDark = document.documentElement.classList.contains('dark');
  if (isDark !== _annLastDark) { _annLastDark = isDark; initAnnotations({ animate: false }); }
}).observe(document.documentElement, { attributeFilter: ['class'] });
