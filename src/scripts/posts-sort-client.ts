// Posts browser for the /posts page: category filter + title search + sort +
// list/grid view + client-side "load more", over all rendered `.pb-item` nodes.
//
// Loaded globally from BaseLayout (like toc-client) so it survives Swup
// navigation; no-ops on any page without the browser root.
//
// All posts render up-front; we filter/sort/reveal in the DOM (no network).
// Back/forward restores { visible, sort, category, search, scrollY } from
// sessionStorage; the list/grid view preference persists in localStorage across
// fresh visits.

type SortMode = 'newest' | 'updated' | 'longest' | 'shortest' | 'az' | 'za';
type ViewMode = 'list' | 'grid';

interface PostsState {
  visible: number;
  sort: SortMode;
  category: string;
  search: string;
  scrollY: number;
}

const STATE_PREFIX = 'postsState:';
const VIEW_KEY = 'postsView';
const stateKey = () => STATE_PREFIX + location.pathname + location.search;

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
  try { sessionStorage.setItem(stateKey(), JSON.stringify(state)); } catch { /* non-fatal */ }
}

function initPostsBrowser(): void {
  const root = document.querySelector<HTMLElement>('[data-posts-browser]');
  // `data-pb-ready` is per-DOM-instance; Swup replaces the DOM on nav so a fresh
  // /posts render starts un-initialised again.
  if (!root || root.dataset.pbReady === '1') return;

  const results = root.querySelector<HTMLElement>('[data-pb-results]');
  const sortSel = root.querySelector<HTMLSelectElement>('[data-pb-sort]');
  if (!results || !sortSel) return;
  root.dataset.pbReady = '1';

  const searchInput = root.querySelector<HTMLInputElement>('[data-pb-search]');
  const countEl = root.querySelector<HTMLElement>('[data-pb-count]');
  const clearBtn = root.querySelector<HTMLButtonElement>('[data-pb-clear]');
  const moreBtn = root.querySelector<HTMLButtonElement>('[data-pb-more]');
  const chips = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-pb-chip]'));
  const viewBtns = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-pb-view]'));
  const batch = Math.max(1, parseInt(root.dataset.batch || '12', 10));
  const items = Array.from(results.querySelectorAll<HTMLElement>('.pb-item'));
  const savedKey = stateKey();

  let category = '';
  let search = '';
  let visible = batch;

  const num = (el: HTMLElement, k: string) => Number(el.dataset[k] || 0);
  const str = (el: HTMLElement, k: string) => el.dataset[k] || '';
  const comparators: Record<SortMode, (a: HTMLElement, b: HTMLElement) => number> = {
    newest:   (a, b) => num(b, 'date') - num(a, 'date'),
    updated:  (a, b) => num(b, 'modified') - num(a, 'modified'),
    longest:  (a, b) => num(b, 'length') - num(a, 'length'),
    shortest: (a, b) => num(a, 'length') - num(b, 'length'),
    az:       (a, b) => str(a, 'title').localeCompare(str(b, 'title')),
    za:       (a, b) => str(b, 'title').localeCompare(str(a, 'title')),
  };

  function setView(v: ViewMode, persistPref = true): void {
    results!.classList.toggle('view-grid', v === 'grid');
    results!.classList.toggle('view-list', v === 'list');
    viewBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
    if (persistPref) { try { localStorage.setItem(VIEW_KEY, v); } catch { /* non-fatal */ } }
  }

  function render(): void {
    const q = search.trim().toLowerCase();
    const matched = items.filter(el =>
      (category === '' || str(el, 'category') === category) &&
      (q === '' || str(el, 'title').includes(q))
    );
    matched.sort(comparators[(sortSel!.value as SortMode)] || comparators.newest);
    visible = Math.min(Math.max(visible, batch), Math.max(matched.length, 1));

    // Hide everything, then move the matched set (in sorted order) to the front
    // and reveal the first `visible`. Unmatched nodes stay hidden in place.
    // Preserve keyboard focus across the reorder — moving a focused row through a
    // detached fragment would otherwise blur it to <body>.
    const active = document.activeElement as HTMLElement | null;
    items.forEach(el => el.classList.add('is-hidden'));
    const frag = document.createDocumentFragment();
    matched.forEach((el, i) => {
      if (i < visible) el.classList.remove('is-hidden');
      frag.appendChild(el);
    });
    results!.appendChild(frag);
    if (active && results!.contains(active) && document.activeElement !== active) {
      active.focus({ preventScroll: true });
    }

    if (countEl) countEl.textContent = String(matched.length);
    if (moreBtn) moreBtn.hidden = visible >= matched.length;
    if (clearBtn) clearBtn.hidden = category === '' && q === '';
    chips.forEach(c => c.setAttribute('aria-pressed', String((c.dataset.cat || '') === category)));
  }

  function resetAndRender(): void { visible = batch; render(); }

  function persist(): void {
    writeState({ visible, sort: sortSel!.value as SortMode, category, search, scrollY: window.scrollY });
  }

  // Events
  sortSel.addEventListener('change', () => { resetAndRender(); persist(); });

  let searchTimer: number | undefined;
  searchInput?.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      search = searchInput.value;
      resetAndRender();
      persist();
    }, 130);
  });

  chips.forEach(c => c.addEventListener('click', () => {
    const val = c.dataset.cat || '';
    category = category === val ? '' : val; // click active chip again → clear
    resetAndRender();
    persist();
  }));

  clearBtn?.addEventListener('click', () => {
    category = '';
    search = '';
    if (searchInput) searchInput.value = '';
    resetAndRender();
    persist();
    searchInput?.focus(); // the Clear button hides itself — keep focus in the toolbar
  });

  viewBtns.forEach(b => b.addEventListener('click', () => setView((b.dataset.view as ViewMode) || 'list')));

  moreBtn?.addEventListener('click', () => {
    const prev = visible;
    visible += batch;
    render();
    persist();
    // If the button hid itself (results exhausted), move focus to the first
    // newly-revealed row so keyboard users don't get dropped to <body>.
    if (moreBtn.hidden) {
      const shown = results!.querySelectorAll<HTMLElement>('.pb-item:not(.is-hidden)');
      (shown[prev] || shown[shown.length - 1])?.focus();
    }
  });

  // Persist scroll continuously (rAF-throttled) for back/forward restore.
  // Self-cleans once /posts leaves the DOM (Swup swap).
  let scrollQueued = false;
  function onScroll(): void {
    if (!root!.isConnected) { window.removeEventListener('scroll', onScroll); return; }
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => { scrollQueued = false; if (root!.isConnected) persist(); });
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // Initial view from saved preference
  let initView: ViewMode = 'list';
  try { const v = localStorage.getItem(VIEW_KEY); if (v === 'grid' || v === 'list') initView = v; } catch { /* ignore */ }
  setView(initView, false);

  // Restore filters + reveal count + scroll, but ONLY on back/forward so a fresh
  // visit starts clean at the top.
  const saved = isBackForward() ? readState() : null;
  if (saved && sessionStorage.getItem(savedKey)) {
    if (saved.sort) sortSel.value = saved.sort;
    category = saved.category || '';
    search = saved.search || '';
    if (searchInput) searchInput.value = search;
    visible = Math.max(batch, saved.visible || batch);
    render();
    const targetY = saved.scrollY || 0;
    requestAnimationFrame(() => {
      window.scrollTo(0, targetY);
      setTimeout(() => window.scrollTo(0, targetY), 120);
    });
  } else {
    resetAndRender();
  }
}

// Mark bfcache restores so we can distinguish them from fresh loads.
window.addEventListener('pageshow', (e) => {
  if ((e as PageTransitionEvent).persisted) {
    cameFromBFCache = true;
    initPostsBrowser();
  }
});

document.addEventListener('astro:page-load', initPostsBrowser);
if (document.readyState !== 'loading') initPostsBrowser();
else document.addEventListener('DOMContentLoaded', initPostsBrowser);

export {};
