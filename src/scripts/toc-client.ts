// Extracted from TableOfContents.astro so the script always loads via BaseLayout.
// Init no-ops when no .toc-nav is in the DOM.

import { annotate } from 'rough-notation';
import type { RoughAnnotation } from 'rough-notation/lib/model';

let tocObserver: IntersectionObserver | null = null;
let scrollTimeout: number | null = null;
let headingAnnotation: RoughAnnotation | null = null;

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
    brackets: ['left', 'right'],
  });
  window.setTimeout(() => headingAnnotation!.show(), 50);
  window.setTimeout(() => headingAnnotation?.hide(), 2550);
}

function initializeTableOfContents() {
  const nav = document.querySelector('.toc-nav') as HTMLElement | null;
  if (!nav) return;

  const tocItems = Array.from(nav.querySelectorAll<HTMLAnchorElement>('.toc-item'));
  const scrollContainer = document.getElementById('toc-scroll-container') as HTMLElement | null;
  const tocContent = document.getElementById('toc-content-list') as HTMLElement | null;
  const indicator = document.getElementById('toc-active-indicator') as HTMLElement | null;

  if (!tocItems.length) return;

  if (scrollContainer) scrollContainer.style.maxHeight = 'calc(100vh - 20rem)';

  const maxDepth = parseInt(nav.dataset.maxDepth || '6', 10);
  const selectors: string[] = [];
  for (let i = 2; i <= Math.min(maxDepth, 6); i++) selectors.push(`h${i}`);
  const headingSelector = selectors.join(', ');

  const contentSelectors = ['#post-content', '#page-content', '#project-content', '#documentation-content', '.prose'];
  let headings: HTMLElement[] = [];
  for (const c of contentSelectors) {
    const found = Array.from(document.querySelectorAll<HTMLElement>(`${c} ${headingSelector}`));
    if (found.length > 0) { headings = found; break; }
  }
  if (!headings.length) return;

  function getVisibleHeadingIds(): string[] {
    const visibleHeadingIds: string[] = [];

    headings.forEach(heading => {
      if (heading.id) {
        const rect = heading.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          visibleHeadingIds.push(heading.id);
        }
      }
    });

    if (visibleHeadingIds.length === 0 && headings.length > 0) {
      let closestHeading: string | null = null;
      let minDistance = Number.POSITIVE_INFINITY;
      headings.forEach(heading => {
        if (heading.id) {
          const distance = Math.abs(heading.getBoundingClientRect().top);
          if (distance < minDistance) {
            minDistance = distance;
            closestHeading = heading.id;
          }
        }
      });
      if (closestHeading) visibleHeadingIds.push(closestHeading);
    }

    return visibleHeadingIds;
  }

  function scrollToActiveItem(activeItems: HTMLAnchorElement[]): void {
    if (!scrollContainer || !activeItems.length) return;
    if (scrollTimeout) clearTimeout(scrollTimeout);

    scrollTimeout = window.setTimeout(() => {
      const topmost = activeItems[0];
      const bottommost = activeItems[activeItems.length - 1];
      const tocHeight = scrollContainer.clientHeight;
      const contentOffset = tocContent ? tocContent.offsetTop : 0;

      let top: number;
      if (
        bottommost.getBoundingClientRect().bottom -
        topmost.getBoundingClientRect().top < 0.9 * tocHeight
      ) {
        top = contentOffset + topmost.offsetTop - 32;
      } else {
        top = contentOffset + bottommost.offsetTop - tocHeight * 0.8;
      }

      scrollContainer.scrollTo({ top: Math.max(0, top), left: 0, behavior: 'smooth' });
    }, 100);
  }

  function updateActiveIndicator(activeItems: HTMLAnchorElement[]): void {
    if (!indicator || !tocContent) return;
    if (activeItems.length === 0) { indicator.style.opacity = '0'; return; }

    const contentRect = tocContent.getBoundingClientRect();
    const firstRect = activeItems[0].getBoundingClientRect();
    const lastRect  = activeItems[activeItems.length - 1].getBoundingClientRect();

    indicator.style.top    = `${firstRect.top - contentRect.top}px`;
    indicator.style.height = `${lastRect.bottom - firstRect.top}px`;
    indicator.style.opacity = '1';

    scrollToActiveItem(activeItems);
  }

  function updateActiveState(): void {
    if (!tocItems.length) return;
    const visibleIds = getVisibleHeadingIds();

    tocItems.forEach(item => item.classList.remove('visible'));

    const activeItems = tocItems.filter(item =>
      visibleIds.includes(item.getAttribute('data-heading') || '')
    );

    activeItems.forEach(item => item.classList.add('visible'));
    updateActiveIndicator(activeItems);
  }

  if (tocObserver) tocObserver.disconnect();

  tocObserver = new IntersectionObserver(() => {
    updateActiveState();
  }, {
    rootMargin: '0px 0px 0px 0px',
    threshold: 0,
  });

  headings.forEach(h => tocObserver!.observe(h));
  updateActiveState();

  tocItems.forEach(item => {
    item.addEventListener('click', () => {
      const headingId = item.getAttribute('data-heading');
      if (headingId) flashHeadingAnnotation(headingId);
    });
  });

  nav.addEventListener('mousemove', () => nav.classList.add('is-hovered'), { once: false });
  nav.addEventListener('mouseleave', () => nav.classList.remove('is-hovered'));
}

(window as any).initializeTableOfContents = initializeTableOfContents;

// Flash the heading that the URL hash points to (e.g. after clicking a search
// result section link like /posts/foo/#some-heading).
function flashHashHeading() {
  const hash = window.location.hash;
  if (!hash || hash.length <= 1) return;
  // 300 ms lets the browser finish scrolling before the annotation paints.
  window.setTimeout(() => flashHeadingAnnotation(hash.slice(1)), 300);
}

document.addEventListener('DOMContentLoaded', () => {
  initializeTableOfContents();
  flashHashHeading();
});

document.addEventListener('page:view', () => {
  // Clean up annotation SVGs that Swup doesn't remove (they live outside #swup).
  if (headingAnnotation) { headingAnnotation.hide(); headingAnnotation = null; }
  document.querySelectorAll('svg.rough-annotation').forEach(el => el.remove());
  initializeTableOfContents();
  flashHashHeading();
});

document.addEventListener('astro:page-load', () => {
  if (scrollTimeout) clearTimeout(scrollTimeout);
  if (headingAnnotation) { headingAnnotation.hide(); headingAnnotation = null; }
  document.querySelectorAll('svg.rough-annotation').forEach(el => el.remove());
  initializeTableOfContents();
  flashHashHeading();
});
