// Behaviour for MobileTableOfContents.astro: tap the bar to open/close the
// panel, dim the page behind it, and track the current section as you scroll
// (updating both the active link and the bar's label). Loaded globally from
// BaseLayout; no-ops when no mobile TOC is in the DOM. Listeners run through an
// AbortController so each Swup navigation tears down the previous page's
// handlers (same pattern as toc-client / marginalia-client).

let cleanup: (() => void) | null = null;

// header (3.5rem) + a little breathing room, matched to the heading
// scroll-margin-top so "current section" flips as a heading clears the navbar.
const SPY_OFFSET = 80;

function initMobileToc() {
  cleanup?.();
  cleanup = null;

  const root = document.querySelector<HTMLElement>('[data-mobile-toc]');
  if (!root) return;
  const bar = root.querySelector<HTMLButtonElement>('#mobile-toc-bar');
  const current = root.querySelector<HTMLElement>('#mobile-toc-current');
  const backdrop = root.querySelector<HTMLElement>('.mobile-toc-backdrop');
  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('.mobile-toc-link'));
  if (!bar || !links.length) return;

  const linkBySlug = new Map<string, HTMLAnchorElement>();
  links.forEach(l => { if (l.dataset.slug) linkBySlug.set(l.dataset.slug, l); });

  const controller = new AbortController();
  const { signal } = controller;

  const open = () => {
    root.classList.add('is-open');
    bar.setAttribute('aria-expanded', 'true');
  };
  const close = () => {
    root.classList.remove('is-open');
    bar.setAttribute('aria-expanded', 'false');
  };
  const toggle = () => (root.classList.contains('is-open') ? close() : open());

  bar.addEventListener('click', e => { e.stopPropagation(); toggle(); }, { signal });
  backdrop?.addEventListener('click', close, { signal });
  // Native anchor jump handles the scroll (heading scroll-margin-top clears the
  // fixed navbar); just close the panel.
  links.forEach(l => l.addEventListener('click', close, { signal }));
  document.addEventListener('click', e => {
    if (root.classList.contains('is-open') && !root.contains(e.target as Node)) close();
  }, { signal });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
  }, { signal });

  // Scroll-spy: current = the last heading whose top has scrolled past the
  // offset line. Updates the active link and the collapsed bar's label.
  const article = document.getElementById('post-content');
  const headingEls: HTMLElement[] = [];
  if (article) {
    article
      .querySelectorAll<HTMLElement>('h2[id], h3[id], h4[id], h5[id], h6[id]')
      .forEach(h => { if (linkBySlug.has(h.id)) headingEls.push(h); });
  }

  // Stuck detection: once the bar reaches its sticky line under the navbar,
  // flag it so CSS can fill the transparent navbar band (see .is-stuck::before).
  // Sticky line = the bar's CSS `top` (3.5rem, or 3rem below md where the
  // navbar is h-12) — read it live so the breakpoint stays in CSS only.
  const stickTop = () => parseFloat(getComputedStyle(root).top) || 56;
  const updateStuck = () => {
    root.classList.toggle('is-stuck', bar.getBoundingClientRect().top <= stickTop() + 0.5);
  };

  let activeSlug = '';
  const setActive = (slug: string) => {
    if (slug === activeSlug) return;
    activeSlug = slug;
    const link = linkBySlug.get(slug);
    links.forEach(l => l.classList.toggle('is-active', l === link));
    if (current && link) current.textContent = link.textContent;
  };

  const recompute = () => {
    if (!headingEls.length) return;
    let cur = headingEls[0].id;
    for (const h of headingEls) {
      if (h.getBoundingClientRect().top - SPY_OFFSET <= 0) cur = h.id;
      else break;
    }
    setActive(cur);
  };

  updateStuck();
  recompute(); // safe with no headings — early-returns
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { updateStuck(); recompute(); ticking = false; });
  };
  document.addEventListener('scroll', onScroll, { passive: true, signal });
  window.addEventListener('resize', onScroll, { passive: true, signal });

  cleanup = () => { controller.abort(); close(); root.classList.remove('is-stuck'); };
}

function boot() { initMobileToc(); }

document.addEventListener('DOMContentLoaded', boot);
document.addEventListener('astro:page-load', boot);
// Hard refresh: this module can load as an async chunk after DOMContentLoaded
// already fired, so the listener above never runs. init is idempotent.
if (document.readyState !== 'loading') requestAnimationFrame(boot);
// bfcache restore (back/forward) — listeners were torn down with the old page.
window.addEventListener('pageshow', e => { if (e.persisted) boot(); });

export {};
