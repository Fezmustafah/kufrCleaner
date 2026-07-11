// Minimal line-rail TOC behaviour, ported from aarnphm.github.io (Quartz)
// toc.inline.ts and adapted to this repo's Swup lifecycle: loaded globally
// from BaseLayout, re-inits on astro:page-load, no-ops when no rail is in
// the DOM. Listeners are wired through an AbortController so each nav
// tears down the previous page's handlers (same pattern as marginalia).

import { annotate } from 'rough-notation';
import type { RoughAnnotation } from 'rough-notation/lib/model';

const tocScrollBuffer = 48;
const tocHoverSigma = 42;
const tocHoverRadius = tocHoverSigma * 3;
const tocHoverLerp = 0.32;
const tocHoverEpsilon = 0.08;

interface TocButtonMetric {
  button: HTMLButtonElement;
  fill: HTMLElement | null;
  centerY: number;
  label: string;
  touched: boolean;
}

let headingAnnotation: RoughAnnotation | null = null;
let tocCleanup: (() => void) | null = null;
let tocObserver: IntersectionObserver | null = null;

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

/* ── Geometry helpers (verbatim port) ────────────────────────────────────── */

function readTocButtonMetrics(buttons: NodeListOf<HTMLButtonElement>): TocButtonMetric[] {
  const metrics: TocButtonMetric[] = [];
  buttons.forEach(button => {
    metrics.push({
      button,
      fill: button.querySelector<HTMLElement>('.fill'),
      centerY: button.offsetTop + button.offsetHeight / 2,
      label: button.getAttribute('aria-label') ?? '',
      touched: false,
    });
  });
  return metrics;
}

function readTocMaxScale(nav: HTMLElement, metrics: TocButtonMetric[]): number {
  const baseWidth = Math.max(1, metrics[0]?.fill?.offsetWidth ?? 1);
  return Math.max(1, nav.clientWidth / baseWidth);
}

function firstTocMetricIndexAt(metrics: TocButtonMetric[], centerY: number): number {
  let low = 0;
  let high = metrics.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (metrics[mid].centerY < centerY) low = mid + 1;
    else high = mid;
  }
  return low;
}

function nearestTocMetric(metrics: TocButtonMetric[], centerY: number): TocButtonMetric | null {
  const nextIndex = firstTocMetricIndexAt(metrics, centerY);
  const previous = metrics[nextIndex - 1];
  const next = metrics[nextIndex];
  if (!previous) return next ?? null;
  if (!next) return previous;
  return centerY - previous.centerY <= next.centerY - centerY ? previous : next;
}

function updateTocButtonFill(metric: TocButtonMetric, mouseY: number, maxScale: number): void {
  const { fill } = metric;
  if (!fill) return;
  const distance = mouseY - metric.centerY;
  const falloff = Math.exp(-(distance * distance) / (2 * tocHoverSigma * tocHoverSigma));
  const scale = 1 + (maxScale - 1) * falloff;
  fill.style.animation = 'none';
  fill.style.transform = `scaleX(${scale.toFixed(3)})`;
}

function resetTocButton(button: HTMLButtonElement) {
  const fill = button.querySelector<HTMLElement>('.fill');
  button.classList.remove('is-active');
  if (!fill) return;
  fill.style.animation = 'none';
  fill.style.transform = 'scaleX(1)';
  fill.style.opacity = '';
}

function resetTocButtons(buttons?: NodeListOf<HTMLButtonElement>) {
  buttons?.forEach(resetTocButton);
}

function hideTocLabel(toc: HTMLElement) {
  toc.querySelector<HTMLElement>('.toc-card')?.classList.remove('is-visible');
}

const CHIP_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>';

const maxChips = 2;

function fillTocCard(card: HTMLElement, button: HTMLButtonElement, label: string) {
  const title = card.querySelector<HTMLElement>('.toc-card-title');
  const excerpt = card.querySelector<HTMLElement>('.toc-card-excerpt');
  const footer = card.querySelector<HTMLElement>('.toc-card-footer');
  if (title) title.textContent = label;
  if (excerpt) excerpt.textContent = button.dataset.excerpt || '';

  if (!footer) return;
  footer.textContent = '';
  let children: string[] = [];
  try {
    children = JSON.parse(button.dataset.children || '[]');
  } catch { /* malformed data attribute — footer stays empty */ }

  children.slice(0, maxChips).forEach(name => {
    const chip = document.createElement('span');
    chip.className = 'toc-card-chip';
    chip.innerHTML = CHIP_ICON;
    const nm = document.createElement('span');
    nm.className = 'toc-card-chip-name';
    nm.textContent = name;
    chip.appendChild(nm);
    footer.appendChild(chip);
  });
  if (children.length > maxChips) {
    const more = document.createElement('span');
    more.className = 'toc-card-more';
    more.textContent = `+${children.length - maxChips}`;
    footer.appendChild(more);
  }
}

function updateTocLabel(
  toc: HTMLElement,
  metric: TocButtonMetric,
  activeButton: HTMLButtonElement | null,
  labelY: number,
): HTMLButtonElement {
  const { button } = metric;
  const card = toc.querySelector<HTMLElement>('.toc-card');
  if (!card) return button;

  if (button !== activeButton) {
    activeButton?.classList.remove('is-active');
    button.classList.add('is-active');
    fillTocCard(card, button, metric.label);
  }

  // Clamp so the card (translateY(-50%)-centred on the cursor) stays on screen
  const tocTop = toc.getBoundingClientRect().top;
  const half = card.offsetHeight / 2;
  const minY = 12 + half - tocTop;
  const maxY = window.innerHeight - 12 - half - tocTop;
  const clampedY = Math.min(Math.max(labelY, minY), Math.max(minY, maxY));

  toc.style.setProperty('--toc-label-y', `${clampedY.toFixed(1)}px`);
  card.classList.add('is-visible');
  return button;
}

function updateTocOverflow(nav: HTMLElement) {
  const scrollable = nav.scrollHeight > nav.clientHeight + 1;
  const atStart = nav.scrollTop <= 1;
  const atEnd = nav.scrollTop + nav.clientHeight >= nav.scrollHeight - 1;
  nav.classList.toggle('is-scrollable', scrollable);
  nav.classList.toggle('at-start', scrollable && atStart);
  nav.classList.toggle('at-end', scrollable && atEnd);
}

function scrollTocButtonIntoView(button: HTMLButtonElement) {
  const nav = button.closest<HTMLElement>('#toc-vertical');
  if (!nav || nav.scrollHeight <= nav.clientHeight + 1) return;

  const navRect = nav.getBoundingClientRect();
  const buttonRect = button.getBoundingClientRect();
  const before = buttonRect.top - navRect.top - tocScrollBuffer;
  const after = buttonRect.bottom - navRect.bottom + tocScrollBuffer;
  let nextScroll = nav.scrollTop;

  if (before < 0) nextScroll += before;
  else if (after > 0) nextScroll += after;

  if (Math.abs(nextScroll - nav.scrollTop) >= 1) nav.scrollTop = nextScroll;
}

/* ── Setup ───────────────────────────────────────────────────────────────── */

function initializeTableOfContents() {
  tocCleanup?.();
  tocCleanup = null;
  tocObserver?.disconnect();
  tocObserver = null;
  document.body.classList.remove('toc-hovering', 'toc-scrolling');

  const toc = document.querySelector<HTMLElement>('.toc[data-layout="minimal"]');
  if (!toc) return;
  // Hidden when the left column is display:none (<1100px) — offsetParent
  // catches ancestor hiding, which getComputedStyle(toc).display would miss.
  if (toc.offsetParent === null) return;

  const nav = toc.querySelector<HTMLElement>('#toc-vertical');
  if (!nav) return;

  const buttons = toc.querySelectorAll<HTMLButtonElement>('button[data-for]');
  if (buttons.length === 0) return;

  // Map slug → rail button, observe the matching article headings
  const entryBySlug = new Map<string, HTMLButtonElement>();
  buttons.forEach(b => {
    const slug = b.dataset.for;
    if (slug) entryBySlug.set(slug, b);
  });

  const article = document.getElementById('post-content');
  const headings: HTMLElement[] = [];
  if (article) {
    article
      .querySelectorAll<HTMLElement>('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]')
      .forEach(h => {
        if (entryBySlug.has(h.id)) headings.push(h);
      });
  }

  tocObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const button = entryBySlug.get(entry.target.id);
      if (!button) continue;
      const windowHeight = entry.rootBounds?.height;
      if (!windowHeight) continue;

      const inView = entry.boundingClientRect.y < windowHeight && entry.boundingClientRect.bottom > 0;
      button.classList.toggle('in-view', inView);
      if (entry.isIntersecting) scrollTocButtonIntoView(button);
    }
  });
  headings.forEach(h => tocObserver!.observe(h));

  const controller = new AbortController();
  const { signal } = controller;

  let metrics = readTocButtonMetrics(buttons);
  let maxScale = readTocMaxScale(nav, metrics);
  let navViewportTop = nav.getBoundingClientRect().top;

  let frame = 0;
  let currentMouseY = 0;
  let targetMouseY = 0;
  let activeButton: HTMLButtonElement | null = null;
  let hovering = false;
  let touchedMetrics: TocButtonMetric[] = [];
  let nextTouchedMetrics: TocButtonMetric[] = [];
  let scrollEndTimer = 0;

  const setTocScrolling = (scrolling: boolean) => {
    document.body.classList.toggle('toc-scrolling', scrolling);
  };

  const clearTocScrolling = () => {
    if (scrollEndTimer !== 0) {
      window.clearTimeout(scrollEndTimer);
      scrollEndTimer = 0;
    }
    setTocScrolling(false);
  };

  const refreshTocGeometry = () => {
    navViewportTop = nav.getBoundingClientRect().top;
    metrics = readTocButtonMetrics(buttons);
    maxScale = readTocMaxScale(nav, metrics);
    updateTocOverflow(nav);
  };

  const scheduleHover = () => {
    if (frame === 0) frame = requestAnimationFrame(updateHover);
  };

  const onMouseEnter = (evt: MouseEvent) => {
    hovering = true;
    toc.classList.add('is-hovering');
    document.body.classList.add('toc-hovering');
    navViewportTop = nav.getBoundingClientRect().top;
    targetMouseY = evt.clientY - navViewportTop;
    currentMouseY = targetMouseY;
    scheduleHover();
  };

  const onMouseLeave = () => {
    hovering = false;
    toc.classList.remove('is-hovering');
    clearTocScrolling();
    if (frame !== 0) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    activeButton?.classList.remove('is-active');
    activeButton = null;
    document.body.classList.remove('toc-hovering');
    hideTocLabel(toc);
    resetTocButtons(buttons);
    touchedMetrics.length = 0;
    nextTouchedMetrics.length = 0;
  };

  const updateHover = () => {
    frame = 0;
    currentMouseY += (targetMouseY - currentMouseY) * tocHoverLerp;

    const contentMouseY = currentMouseY + nav.scrollTop;
    nextTouchedMetrics.length = 0;
    const startIndex = firstTocMetricIndexAt(metrics, contentMouseY - tocHoverRadius);
    const endIndex = firstTocMetricIndexAt(metrics, contentMouseY + tocHoverRadius);

    for (let index = startIndex; index < endIndex; index++) {
      const metric = metrics[index];
      metric.touched = true;
      updateTocButtonFill(metric, contentMouseY, maxScale);
      nextTouchedMetrics.push(metric);
    }

    for (const metric of touchedMetrics) {
      if (!metric.touched) resetTocButton(metric.button);
    }
    for (const metric of nextTouchedMetrics) {
      metric.touched = false;
    }

    const previousTouchedMetrics = touchedMetrics;
    touchedMetrics = nextTouchedMetrics;
    nextTouchedMetrics = previousTouchedMetrics;

    const nearestMetric = nearestTocMetric(metrics, contentMouseY);
    if (nearestMetric) {
      activeButton = updateTocLabel(toc, nearestMetric, activeButton, currentMouseY);
    }

    if (hovering && Math.abs(targetMouseY - currentMouseY) > tocHoverEpsilon) {
      scheduleHover();
    }
  };

  const onPointerMove = (evt: PointerEvent) => {
    // Restore hover state after a click cleared it (cursor never left the
    // rail, so mouseenter won't fire again).
    if (!hovering) {
      hovering = true;
      toc.classList.add('is-hovering');
      document.body.classList.add('toc-hovering');
      navViewportTop = nav.getBoundingClientRect().top;
    }
    targetMouseY = evt.clientY - navViewportTop;
    scheduleHover();
  };

  // The rail accompanies the post BODY only (aarnphm): the document "ends"
  // where the end-zone begins — footnotes if present, else the actions/
  // colophon/connections block — and the rail bows out there (.toc-released
  // fades it; see PostLayout CSS). Bare content bottom is the last resort.
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
    // Release when the "rest" scrolls up into the rail's own zone (the rail
    // is fixed-centered; mid-viewport alone can be unreachable when the
    // footnote section sits at the very end of a short document).
    const railBottom = nav.getBoundingClientRect().bottom;
    leftCol.classList.toggle('toc-released', limit < railBottom + 32);
  };

  const onPageScroll = () => {
    updateTocRelease();
    if (!hovering) return;
    setTocScrolling(true);
    if (scrollEndTimer !== 0) window.clearTimeout(scrollEndTimer);
    scrollEndTimer = window.setTimeout(() => {
      scrollEndTimer = 0;
      setTocScrolling(false);
    }, 140);
  };

  const onClick = (evt: MouseEvent) => {
    if (!(evt.target instanceof Element)) return;
    // The visible bar is a scaleX transform — its hit box is a 3px strip.
    // A click anywhere on the rail resolves to the nearest bar instead.
    let button = evt.target.closest<HTMLButtonElement>('button[data-href]');
    if (!button) {
      const y = evt.clientY - nav.getBoundingClientRect().top + nav.scrollTop;
      button = nearestTocMetric(metrics, y)?.button ?? null;
    }
    if (!button) return;
    const href = button.dataset.href;
    if (!href?.startsWith('#')) return;

    evt.preventDefault();
    scrollToHeading(href);
    // Drop the veil so the navigation is visible; hovering resets with it and
    // the next pointermove restores both (see onPointerMove).
    hovering = false;
    activeButton = null; // resetTocButtons strips is-active; force re-apply on next hover frame
    toc.classList.remove('is-hovering');
    document.body.classList.remove('toc-hovering');
    hideTocLabel(toc);
    resetTocButtons(buttons);
  };

  nav.addEventListener('click', onClick, { signal });
  nav.addEventListener('mouseenter', onMouseEnter, { signal });
  nav.addEventListener('mouseleave', onMouseLeave, { signal });
  nav.addEventListener('pointermove', onPointerMove, { passive: true, signal });
  window.addEventListener('scroll', onPageScroll, { passive: true, signal });
  window.addEventListener('resize', refreshTocGeometry, { passive: true, signal });
  nav.addEventListener(
    'scroll',
    () => {
      updateTocOverflow(nav);
      if (toc.classList.contains('is-hovering')) scheduleHover();
    },
    { passive: true, signal },
  );

  tocCleanup = () => {
    controller.abort();
    if (frame !== 0) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    activeButton = null;
    leftCol?.classList.remove('toc-released');
    document.body.classList.remove('toc-hovering', 'toc-scrolling');
  };

  updateTocRelease();
  requestAnimationFrame(refreshTocGeometry);
  document.fonts.ready.then(() => requestAnimationFrame(refreshTocGeometry));
}

(window as any).initializeTableOfContents = initializeTableOfContents;

// If the page loaded below 1100px the rail never initialized — catch the
// crossing when the viewport widens.
let tocResizeTimer = 0;
window.addEventListener('resize', () => {
  if (tocCleanup) return; // already live; its own resize handler refreshes geometry
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
