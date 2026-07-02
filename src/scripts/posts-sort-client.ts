// Posts sort + client-side "load more" for the all-posts page.
//
// Loaded globally from BaseLayout (like toc-client / annotations-client) so it
// survives Swup navigation. It no-ops on every page that has no sort root.
//
// The /posts page renders ALL visible posts wrapped in `.post-item` divs that
// carry data-date / data-modified / data-length / data-title. We reorder those
// wrappers and reveal them in batches of `data-batch` — keeping the initial
// paint light (images on hidden cards lazy-load only when shown).
//
// Back-button restore: Swup destroys the /posts DOM when you open an article,
// so returning re-renders /posts fresh and the reveal count + scroll position
// would be lost. We persist { visible, sort, scrollY } in sessionStorage per
// URL and restore it ONLY on back/forward navigation, so a fresh click on the
// Posts link still starts at the top with the first batch.

type SortMode = 'newest' | 'updated' | 'longest' | 'shortest' | 'az' | 'za';

interface PostsState {
  visible: number;
  sort: SortMode;
  scrollY: number;
}

const STATE_PREFIX = 'postsState:';
const stateKey = () => STATE_PREFIX + location.pathname + location.search;

// True when the current page view came from the browser back/forward button
// (reload path) or a bfcache restore. Fresh navigations report 'navigate'.
let cameFromBFCache = false;
function isBackForward(): boolean {
  if (cameFromBFCache) return true;
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    return nav?.type === 'back_forward';
  } catch {
    return false;
  }
}

function readState(): PostsState | null {
  try {
    const raw = sessionStorage.getItem(stateKey());
    return raw ? (JSON.parse(raw) as PostsState) : null;
  } catch {
    return null;
  }
}

function writeState(state: PostsState): void {
  try {
    sessionStorage.setItem(stateKey(), JSON.stringify(state));
  } catch {
    /* storage full / disabled — non-fatal */
  }
}

function initPostsSort(): void {
  const root = document.querySelector<HTMLElement>('[data-posts-sort-root]');
  // `data-sort-ready` is per-DOM-instance; Swup replaces the DOM on nav so a
  // fresh /posts render starts un-initialised again.
  if (!root || root.dataset.sortReady === '1') return;

  const grid = root.querySelector<HTMLElement>('.posts-cards-grid');
  const select = root.querySelector<HTMLSelectElement>('[data-sort-select]');
  if (!grid || !select) return;

  root.dataset.sortReady = '1';

  const loadMoreBtn = root.querySelector<HTMLButtonElement>('[data-load-more]');
  const batch = Math.max(1, parseInt(root.dataset.batch || '10', 10));
  const items = Array.from(grid.querySelectorAll<HTMLElement>('.post-item'));
  const savedKey = stateKey(); // capture the /posts key; location changes on nav away
  let visible = batch;

  const num = (el: HTMLElement, key: string) => Number(el.dataset[key] || 0);
  const str = (el: HTMLElement, key: string) => el.dataset[key] || '';

  function sortItems(mode: SortMode): HTMLElement[] {
    const copy = items.slice();
    switch (mode) {
      case 'updated':  copy.sort((a, b) => num(b, 'modified') - num(a, 'modified')); break;
      case 'longest':  copy.sort((a, b) => num(b, 'length') - num(a, 'length')); break;
      case 'shortest': copy.sort((a, b) => num(a, 'length') - num(b, 'length')); break;
      case 'az':       copy.sort((a, b) => str(a, 'title').localeCompare(str(b, 'title'))); break;
      case 'za':       copy.sort((a, b) => str(b, 'title').localeCompare(str(a, 'title'))); break;
      case 'newest':
      default:         copy.sort((a, b) => num(b, 'date') - num(a, 'date')); break;
    }
    return copy;
  }

  function apply(mode: SortMode, resetVisible: boolean): void {
    if (resetVisible) visible = batch;
    visible = Math.min(visible, items.length);
    const ordered = sortItems(mode);
    const frag = document.createDocumentFragment();
    ordered.forEach((el, i) => {
      el.classList.toggle('is-hidden', i >= visible);
      frag.appendChild(el);
    });
    grid!.appendChild(frag);
    if (loadMoreBtn) loadMoreBtn.style.display = visible >= ordered.length ? 'none' : '';
  }

  function persist(): void {
    writeState({ visible, sort: select!.value as SortMode, scrollY: window.scrollY });
  }

  // Persist scroll continuously (throttled via rAF) so the latest position is
  // saved before the user opens an article. Self-cleans once /posts leaves the
  // DOM (Swup swap) to avoid clobbering the saved position from other pages.
  let scrollQueued = false;
  function onScroll(): void {
    if (!root!.isConnected) {
      window.removeEventListener('scroll', onScroll);
      return;
    }
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      scrollQueued = false;
      if (root!.isConnected) persist();
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  select.addEventListener('change', () => {
    apply(select.value as SortMode, true);
    persist();
  });
  loadMoreBtn?.addEventListener('click', () => {
    visible += batch;
    apply(select.value as SortMode, false);
    persist();
  });

  // Restore prior reveal count + sort + scroll, but ONLY on back/forward so a
  // fresh visit to /posts starts clean at the top.
  const saved = isBackForward() ? readState() : null;
  if (saved && sessionStorage.getItem(savedKey)) {
    if (saved.sort) select.value = saved.sort;
    visible = Math.max(batch, saved.visible || batch);
    apply(select.value as SortMode, false);
    // Cards reserve space via fixed aspect-ratio, so no layout shift from lazy
    // images — restore scroll on the next frame, then re-assert once for safety.
    const targetY = saved.scrollY || 0;
    requestAnimationFrame(() => {
      window.scrollTo(0, targetY);
      setTimeout(() => window.scrollTo(0, targetY), 120);
    });
  } else {
    apply(select.value as SortMode, true);
  }
}

// Mark bfcache restores so we can distinguish them from fresh loads.
window.addEventListener('pageshow', (e) => {
  if (e.persisted) {
    cameFromBFCache = true;
    initPostsSort();
  }
});

document.addEventListener('page:view', initPostsSort);
document.addEventListener('astro:page-load', initPostsSort);
if (document.readyState !== 'loading') initPostsSort();
else document.addEventListener('DOMContentLoaded', initPostsSort);
