// Wikilink hover previews ("peek before you click") — a Gwern/quartz-style
// popover for deeper reading. Scoped to `[[wikilinks]]` via the build-time
// `data-wikilink` attribute (internallinks.ts), NOT the `.wikilink` CSS class,
// so restyling links can't break it. On hover-intent we fetch the target page
// once, extract its #post-content off-DOM, and float a card near the link.
//
// Performance notes:
//  - Two delegated listeners on `document` (not one per link); survives Swup
//    swaps with no re-binding since #swup-container's contents are delegated to.
//  - Fetch only fires AFTER the open-intent delay, so pass-through hovers cost
//    nothing. Each page is fetched+parsed at most once (cache keyed by path);
//    superseded in-flight fetches are aborted.
//  - Parsing happens via DOMParser off the live DOM (no layout/reflow), and the
//    card is a single reused node. Positioning reads rects once, then writes.

import { extractPreviewHTML, isPreviewablePath } from '@/utils/link-preview';

const hoverCapable =
  typeof matchMedia === 'function' &&
  matchMedia('(hover: hover) and (pointer: fine)').matches;

const OPEN_DELAY = 180; // ms of sustained hover before we commit to fetching/showing
const CLOSE_DELAY = 300; // grace so the cursor can travel from link to card
const VIEWPORT_MARGIN = 8;

// pathname → cleaned preview HTML (or null). Values are promises so concurrent
// hovers on the same link share one fetch. Failed/empty results are evicted so
// a later hover can retry.
const cache = new Map<string, Promise<string | null>>();

let card: HTMLElement | null = null;
let body: HTMLElement | null = null;
let activeAnchor: HTMLAnchorElement | null = null;
let openTimer: ReturnType<typeof setTimeout> | undefined;
let closeTimer: ReturnType<typeof setTimeout> | undefined;
let inflight: AbortController | null = null;

function ensureCard(): HTMLElement {
  if (card && card.isConnected) return card;
  card = document.createElement('div');
  card.className = 'link-preview';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-hidden', 'true');
  body = document.createElement('div');
  body.className = 'link-preview-body prose dark:prose-dark';
  card.appendChild(body);

  // Keep the card open while the cursor is over it; close when it leaves.
  card.addEventListener('mouseenter', cancelClose);
  card.addEventListener('mouseleave', scheduleClose);
  document.body.appendChild(card);
  return card;
}

function fetchPreview(url: URL): Promise<string | null> {
  const key = url.pathname;
  const cached = cache.get(key);
  if (cached) return cached;

  inflight?.abort();
  const controller = new AbortController();
  inflight = controller;

  const promise = (async () => {
    try {
      const res = await fetch(url.href, {
        headers: { Accept: 'text/html' },
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');
      return extractPreviewHTML(doc);
    } catch {
      return null; // network error or aborted — treat as "no preview"
    }
  })();

  cache.set(key, promise);
  promise.then((html) => { if (html == null) cache.delete(key); });
  return promise;
}

function previewableAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  const el = target as Element | null;
  const a = el?.closest?.('a[data-wikilink]') as HTMLAnchorElement | null;
  if (!a) return null;
  if (a.closest('.link-preview')) return null; // links inside a preview
  if (a.dataset.noPreview === 'true') return null;
  let url: URL;
  try { url = new URL(a.href); } catch { return null; }
  if (!isPreviewablePath(url, window.location)) return null;
  return a;
}

function position(anchor: HTMLElement, el: HTMLElement) {
  el.classList.add('is-measuring');
  el.style.left = '0px';
  el.style.top = '0px';
  const r = anchor.getBoundingClientRect();
  const c = el.getBoundingClientRect();
  el.classList.remove('is-measuring');

  let left = r.left + r.width / 2 - c.width / 2;
  left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - c.width - VIEWPORT_MARGIN));

  const below = r.top - c.height - 8 < VIEWPORT_MARGIN;
  const top = below ? r.bottom + 8 : r.top - c.height - 8;
  el.classList.toggle('is-below', below);

  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(Math.max(VIEWPORT_MARGIN, top))}px`;
}

function open(anchor: HTMLAnchorElement) {
  let url: URL;
  try { url = new URL(anchor.href); } catch { return; }
  const el = ensureCard();

  fetchPreview(url).then((html) => {
    if (activeAnchor !== anchor || !html || !body) return; // moved away / nothing to show
    body.innerHTML = html;
    body.scrollTop = 0;
    el.classList.add('is-visible');
    el.setAttribute('aria-hidden', 'false');
    position(anchor, el);
  });
}

function cancelClose() { clearTimeout(closeTimer); }
function scheduleClose() {
  clearTimeout(closeTimer);
  closeTimer = setTimeout(closeNow, CLOSE_DELAY);
}
function closeNow() {
  clearTimeout(openTimer);
  clearTimeout(closeTimer);
  activeAnchor = null;
  inflight?.abort();
  if (card) {
    card.classList.remove('is-visible');
    card.setAttribute('aria-hidden', 'true');
  }
}

function onOver(e: Event) {
  const a = previewableAnchor(e.target);
  if (!a) return;
  cancelClose();
  if (a === activeAnchor) return; // already showing / pending for this link
  activeAnchor = a;
  clearTimeout(openTimer);
  openTimer = setTimeout(() => open(a), OPEN_DELAY);
}

function onOut(e: Event) {
  const to = (e as MouseEvent).relatedTarget as Element | null;
  if (to && (to.closest?.('.link-preview') || to === activeAnchor)) return;
  clearTimeout(openTimer); // cancel a not-yet-shown preview
  if (activeAnchor) scheduleClose();
}

// Delegated + global listeners are attached ONCE for the document's lifetime
// (document survives Swup navigations). Only the transient card state is reset
// per-navigation.
let booted = false;
function boot() {
  if (booted || !hoverCapable) return;
  booted = true;
  document.addEventListener('mouseover', onOver);
  document.addEventListener('mouseout', onOut);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNow(); });
  document.addEventListener('click', closeNow);
  // A scroll that isn't inside the card means the anchor is moving away — close.
  document.addEventListener('scroll', (e) => {
    if (card?.classList.contains('is-visible') && !(e.target as Element)?.closest?.('.link-preview')) {
      closeNow();
    }
  }, { passive: true, capture: true });
  // Swup swaps article content — drop any open card so it can't point at a gone link.
  document.addEventListener('astro:page-load', closeNow);
}

if (hoverCapable) {
  document.addEventListener('DOMContentLoaded', boot);
  if (document.readyState !== 'loading') boot();
}

export {};
