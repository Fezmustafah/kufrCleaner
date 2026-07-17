// Hover/focus tooltips for inline citations. Each `[@key]` renders as
// `<a class="cite-ref" href="#ref-<key>">[n]</a>` (remark-citations). The
// formatted reference text lives in the ReadingDeck bibliography, which ships as
// a <template data-deck-citation-template> holding one `li[data-citation-id]`
// per ref — so we read the text from there (with a live-DOM fallback). No
// client-side parse of global-refs.json needed.
//
// A single floating .citation-tooltip is reused for every ref. Hover is enabled
// only on hover-capable pointers; keyboard focus always shows it (a11y).
// Listeners run through an AbortController so each Swup navigation tears down
// the previous page's handlers.

let cleanup: (() => void) | null = null;
let tip: HTMLElement | null = null;

const HOVER_OK =
  typeof matchMedia === 'function' &&
  matchMedia('(hover: hover) and (pointer: fine)').matches;

function ensureTip(): HTMLElement {
  if (tip && tip.isConnected) return tip;
  tip = document.createElement('div');
  tip.className = 'citation-tooltip';
  tip.setAttribute('role', 'tooltip');
  tip.setAttribute('aria-hidden', 'true');
  document.body.appendChild(tip);
  return tip;
}

// key ("ref-<id>" without the leading #) → formatted reference text.
function buildLookup(): Map<string, string> {
  const map = new Map<string, string>();
  const add = (id: string | null | undefined, el: Element | null) => {
    if (!id || !el) return;
    const text = (el.querySelector('span')?.textContent ?? el.textContent ?? '').trim();
    if (text && !map.has(id)) map.set(id, text);
  };
  // Primary source: the reading-deck bibliography template.
  document
    .querySelectorAll<HTMLTemplateElement>('[data-deck-citation-template]')
    .forEach(tpl => {
      tpl.content
        .querySelectorAll<HTMLElement>('li[data-citation-id]')
        .forEach(li => add(li.dataset.citationId, li));
    });
  // Fallback: any live-rendered bibliography entries.
  document.querySelectorAll<HTMLElement>('li[id^="ref-"]').forEach(li => {
    add(li.id.slice(4), li); // strip "ref-"
  });
  return map;
}

function keyFromRef(a: HTMLAnchorElement): string | null {
  const href = a.getAttribute('href') ?? '';
  if (href.startsWith('#ref-')) return href.slice(5);
  const id = a.id; // "cite-<key>"
  return id.startsWith('cite-') ? id.slice(5) : null;
}

function position(ref: HTMLElement, el: HTMLElement) {
  const M = 8; // viewport margin
  el.style.left = '0px';
  el.style.top = '0px';
  el.classList.add('is-measuring');
  const r = ref.getBoundingClientRect();
  const t = el.getBoundingClientRect();
  el.classList.remove('is-measuring');

  let left = r.left + r.width / 2 - t.width / 2;
  left = Math.max(M, Math.min(left, window.innerWidth - t.width - M));

  // Prefer above the ref; flip below if it would clip the top.
  let top = r.top - t.height - 6;
  el.classList.toggle('is-below', top < M);
  if (top < M) top = r.bottom + 6;

  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
}

function initCitationTooltips() {
  cleanup?.();
  cleanup = null;

  const refs = Array.from(document.querySelectorAll<HTMLAnchorElement>('a.cite-ref'));
  if (!refs.length) return;

  const lookup = buildLookup();
  if (!lookup.size) return;

  const el = ensureTip();
  const controller = new AbortController();
  const { signal } = controller;

  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  const show = (ref: HTMLAnchorElement) => {
    const key = keyFromRef(ref);
    const text = key ? lookup.get(key) : undefined;
    if (!text) return;
    clearTimeout(hideTimer);
    el.textContent = text;
    el.classList.add('is-visible');
    el.setAttribute('aria-hidden', 'false');
    position(ref, el);
  };
  const hide = () => {
    hideTimer = setTimeout(() => {
      el.classList.remove('is-visible');
      el.setAttribute('aria-hidden', 'true');
    }, 80);
  };

  refs.forEach(ref => {
    if (HOVER_OK) {
      ref.addEventListener('mouseenter', () => show(ref), { signal });
      ref.addEventListener('mouseleave', hide, { signal });
    }
    // Keyboard/AT: always available.
    ref.addEventListener('focus', () => show(ref), { signal });
    ref.addEventListener('blur', hide, { signal });
  });

  // Keep the tooltip pinned to its ref: hide on scroll/resize rather than
  // chase a moving target (cheap, and the tip is transient anyway).
  window.addEventListener('scroll', () => hide(), { passive: true, signal });
  window.addEventListener('resize', () => hide(), { passive: true, signal });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); }, { signal });

  cleanup = () => { controller.abort(); el.classList.remove('is-visible'); };
}

function boot() { initCitationTooltips(); }

document.addEventListener('DOMContentLoaded', boot);
document.addEventListener('astro:page-load', boot);
if (document.readyState !== 'loading') requestAnimationFrame(boot);
window.addEventListener('pageshow', e => { if (e.persisted) boot(); });

export {};
