// Minimal line-rail TOC (static ticks) + full text outline panel on hover.
// Ticks pop in with a staggered load animation and encode heading depth via
// width — all CSS. Panel show/hide and the page veil are CSS too (:hover /
// :has). This module only handles the dynamic bits:
//   • scroll-spy — mark which sections are on screen (in-view on tick + row)
//   • click-to-scroll — a tick or a panel row smooth-scrolls + flashes the heading
//   • overflow masks — fade the top/bottom of the rail or panel when it scrolls
//   • rail release — fade the rail out where the post body ends (footnotes)
// Loaded globally from BaseLayout; Swup-safe (re-inits on astro:page-load).
// Listeners are wired through an AbortController so each nav tears down the
// previous page's handlers (same pattern as marginalia).

import { annotate } from 'rough-notation';
import type { RoughAnnotation } from 'rough-notation/lib/model';

const tocScrollBuffer = 48;

let headingAnnotation: RoughAnnotation | null = null;
let tocCleanup: (() => void) | null = null;

function flashHeadingAnnotation(headingId: string) {
  const heading = document.getElementById(headingId);
  if (!heading) return;
  const highlight = heading.querySelector<HTMLElement>('span.highlight-span');
  if (!highlight) return;

  if (headingAnnotation) headingAnnotation.hide();
  headingAnnotation = annotate(highlight, {
    type: 'bracket',
    color: 'rgba(234, 157, 52, 0.55)',
    animate: false,
    multiline: true,
    brackets: ['left', 'right'],
  });
  window.setTimeout(() => headingAnnotation!.show(), 50);
  window.setTimeout(() => headingAnnotation?.hide(), 2550);
}

function scrollToHeading(hash: string) {
  const element = document.getElementById(hash.slice(1));
  if (!element) return;

  flashHeadingAnnotation(hash.slice(1));
  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  history.pushState(null, '', hash);
}

/* ── Overflow fade masks ──────────────────────────────────────────────────── */

function updateTocOverflow(el: HTMLElement) {
  const scrollable = el.scrollHeight > el.clientHeight + 1;
  const atStart = el.scrollTop <= 1;
  const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
  el.classList.toggle('is-scrollable', scrollable);
  el.classList.toggle('at-start', scrollable && atStart);
  el.classList.toggle('at-end', scrollable && atEnd);
}

function scrollItemIntoView(item: HTMLElement, container: HTMLElement) {
  if (container.scrollHeight <= container.clientHeight + 1) return;
  const cRect = container.getBoundingClientRect();
  const iRect = item.getBoundingClientRect();
  const before = iRect.top - cRect.top - tocScrollBuffer;
  const after = iRect.bottom - cRect.bottom + tocScrollBuffer;
  let next = container.scrollTop;
  if (before < 0) next += before;
  else if (after > 0) next += after;
  if (Math.abs(next - container.scrollTop) >= 1) container.scrollTop = next;
}

/* ── Setup ───────────────────────────────────────────────────────────────── */

function initializeTableOfContents() {
  tocCleanup?.();
  tocCleanup = null;

  const toc = document.querySelector<HTMLElement>('.toc[data-layout="minimal"]');
  if (!toc) return;
  // Hidden when the left column is display:none (<1100px) — offsetParent
  // catches ancestor hiding, which getComputedStyle(toc).display would miss.
  if (toc.offsetParent === null) return;

  const nav = toc.querySelector<HTMLElement>('#toc-vertical');
  if (!nav) return;
  const panelList = toc.querySelector<HTMLElement>('.toc-panel-list');

  // slug → every element tracking it (rail tick + panel row), so scroll-spy
  // lights up both from one observer callback.
  const bySlug = new Map<string, HTMLElement[]>();
  toc.querySelectorAll<HTMLElement>('[data-for]').forEach(el => {
    const slug = el.dataset.for;
    if (!slug) return;
    const arr = bySlug.get(slug);
    if (arr) arr.push(el);
    else bySlug.set(slug, [el]);
  });

  const article = document.getElementById('post-content');
  const headings: HTMLElement[] = [];
  if (article) {
    article
      .querySelectorAll<HTMLElement>('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]')
      .forEach(h => {
        if (bySlug.has(h.id)) headings.push(h);
      });
  }

  // Scroll-spy by CURRENT SECTION, not by heading-in-viewport: the active
  // heading is the last one you've scrolled past its activation line (just
  // below the fixed navbar). This keeps a tick lit through a section's whole
  // body — long images and all — instead of going dark between headings.
  const activationOffset = 140; // px from viewport top; clears the 3.5rem navbar
  let activeSlug: string | null = null;
  const updateActiveHeading = () => {
    if (!headings.length) return;
    let active: HTMLElement | null = null;
    for (const h of headings) {
      // Headings are in document order → tops increase; stop at the first one
      // still below the line (everything after it is too).
      if (h.getBoundingClientRect().top <= activationOffset) active = h;
      else break;
    }
    const slug = (active ?? headings[0]).id; // above the first heading → light the first
    if (slug === activeSlug) return;
    activeSlug = slug;
    bySlug.forEach((els, s) => {
      const on = s === slug;
      els.forEach(el => el.classList.toggle('in-view', on));
    });
    // Keep the active tick (and panel row) in view within their own scroll
    // container, so a long rail follows along instead of stranding the lit tick
    // off-screen. No-ops when the column isn't scrollable.
    bySlug.get(slug)?.forEach(el => {
      const container = el.closest<HTMLElement>('[data-toc-scroll]');
      if (container) scrollItemIntoView(el, container);
    });
  };

  // Replay the tick load-pop on every init — a CSS-only animation won't re-run
  // on Swup-morphed DOM. Remove → force reflow → re-add so it restarts.
  nav.classList.remove('toc-animate');
  void nav.offsetWidth;
  nav.classList.add('toc-animate');

  const controller = new AbortController();
  const { signal } = controller;

  const setPinned = (v: boolean) => toc.classList.toggle('is-pinned', v);

  // Navigation is by panel row only (ticks are decorative) → smooth-scroll +
  // flash the heading. Does not touch the pinned state.
  toc.addEventListener('click', (evt) => {
    const el = (evt.target as Element)?.closest?.('.toc-panel-item') as HTMLElement | null;
    const href = el?.dataset.href;
    if (!href?.startsWith('#')) return;
    evt.preventDefault();
    scrollToHeading(href);
  }, { signal });

  // Clicking the tick rail toggles the outline pinned open ("stay ON") so it
  // persists after the cursor leaves — a click to browse, a click to dismiss.
  nav.addEventListener('click', () => {
    setPinned(!toc.classList.contains('is-pinned'));
  }, { signal });

  // Also dismiss the pinned outline with a click anywhere outside it, or Escape.
  // Clicks inside .toc keep it open (that's how you pick headings while pinned).
  document.addEventListener('click', (evt) => {
    if (!toc.classList.contains('is-pinned')) return;
    if ((evt.target as Element)?.closest?.('.toc')) return;
    setPinned(false);
  }, { signal });
  document.addEventListener('keydown', (evt) => {
    if ((evt as KeyboardEvent).key === 'Escape') setPinned(false);
  }, { signal });

  // When the panel opens, bring the current section into view within it so a
  // long outline doesn't always open scrolled to the top.
  toc.addEventListener('mouseenter', () => {
    if (!panelList) return;
    const active = panelList.querySelector<HTMLElement>('.toc-panel-item.in-view');
    if (active) scrollItemIntoView(active, panelList);
  }, { signal });

  // Overflow fade masks on whichever column scrolls (rail and/or panel list).
  const scrollers = [nav, panelList].filter(Boolean) as HTMLElement[];
  const refreshOverflow = () => scrollers.forEach(updateTocOverflow);
  scrollers.forEach(s =>
    s.addEventListener('scroll', () => updateTocOverflow(s), { passive: true, signal })
  );
  window.addEventListener('resize', () => {
    refreshOverflow();
    updateActiveHeading();
  }, { passive: true, signal });

  // The rail accompanies the post BODY only (aarnphm): the document "ends"
  // where the end-zone begins — the colophon if present, else the footnote
  // section — and the rail bows out there (.toc-released fades it; see
  // PostLayout CSS). Bare content bottom is the last resort.
  const leftCol = document.querySelector<HTMLElement>('.post-layout-left-col');
  const releaseBoundary =
    document.querySelector<HTMLElement>('.post-colophon') ??
    document.querySelector<HTMLElement>('#post-content section.footnotes') ??
    document.getElementById('post-content');
  const releaseUsesBottom = releaseBoundary?.id === 'post-content';
  const updateTocRelease = () => {
    if (!leftCol || !releaseBoundary) return;
    const rect = releaseBoundary.getBoundingClientRect();
    const limit = releaseUsesBottom ? rect.bottom : rect.top;
    // Rail bottom is read LIVE, not cached: during Swup's enter animation
    // #swup-container carries a transform, which makes it the containing block
    // for this fixed rail — any rect cached in that window is measured against
    // the document-tall container and stays wrong forever.
    leftCol.classList.toggle('toc-released', limit < nav.getBoundingClientRect().bottom + 32);
  };

  // Scroll fires far more often than frames paint — coalesce the release check
  // (a forced-reflow read) to once per frame.
  let scrollFrame = false;
  window.addEventListener('scroll', () => {
    if (scrollFrame) return;
    scrollFrame = true;
    requestAnimationFrame(() => {
      scrollFrame = false;
      updateTocRelease();
      updateActiveHeading();
    });
  }, { passive: true, signal });

  tocCleanup = () => {
    controller.abort();
    leftCol?.classList.remove('toc-released');
    toc.classList.remove('is-pinned');
  };

  refreshOverflow();
  updateTocRelease();
  updateActiveHeading();
  // init runs while Swup's 140ms enter transition still transforms
  // #swup-container (see updateTocRelease) — re-measure after it settles.
  window.setTimeout(() => {
    refreshOverflow();
    updateTocRelease();
    updateActiveHeading();
  }, 200);
  document.fonts.ready.then(() => {
    refreshOverflow();
    updateTocRelease();
    updateActiveHeading();
  });
}

(window as any).initializeTableOfContents = initializeTableOfContents;

// If the page loaded below 1100px the rail never initialized — catch the
// crossing when the viewport widens.
let tocResizeTimer = 0;
window.addEventListener('resize', () => {
  if (tocCleanup) return; // already live; its own resize handler refreshes masks
  window.clearTimeout(tocResizeTimer);
  tocResizeTimer = window.setTimeout(initializeTableOfContents, 150);
}, { passive: true });

// Flash the heading that the URL hash points to (e.g. after clicking a search
// result section link like /posts/foo/#some-heading).
function flashHashHeading() {
  const hash = window.location.hash;
  if (!hash || hash.length <= 1) return;
  // 300 ms lets the browser finish scrolling before the annotation paints.
  window.setTimeout(() => flashHeadingAnnotation(hash.slice(1)), 300);
}

function bootToc() {
  initializeTableOfContents();
  flashHashHeading();
}

document.addEventListener('DOMContentLoaded', bootToc);

document.addEventListener('astro:page-load', () => {
  if (headingAnnotation) {
    headingAnnotation.hide();
    headingAnnotation = null;
  }
  document.querySelectorAll('svg.rough-annotation').forEach(el => el.remove());
  bootToc();
});

// Hard refresh: Astro loads this module as an async chunk that can execute
// AFTER DOMContentLoaded already fired — the listener above then never runs.
// Same guard as marginalia-client.ts. init is idempotent (tears down first).
if (document.readyState !== 'loading') requestAnimationFrame(bootToc);

// bfcache restore (back/forward): listeners were torn down with the old page
// state — re-init.
window.addEventListener('pageshow', e => {
  if (e.persisted) bootToc();
});
