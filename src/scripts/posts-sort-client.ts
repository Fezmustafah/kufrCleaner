// Posts sort + client-side "load more" for the all-posts page.
//
// Loaded globally from BaseLayout (like toc-client / annotations-client) so it
// survives Swup navigation. It no-ops on every page that has no sort root.
//
// The /posts page renders ALL visible posts wrapped in `.post-item` divs that
// carry data-date / data-modified / data-length / data-title. We reorder those
// wrappers and reveal them in batches of `data-batch` — keeping the initial
// paint light (images on hidden cards lazy-load only when shown).

type SortMode = 'newest' | 'updated' | 'longest' | 'shortest' | 'az' | 'za';

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
    const ordered = sortItems(mode);
    const frag = document.createDocumentFragment();
    ordered.forEach((el, i) => {
      el.classList.toggle('is-hidden', i >= visible);
      frag.appendChild(el);
    });
    grid!.appendChild(frag);
    if (loadMoreBtn) loadMoreBtn.style.display = visible >= ordered.length ? 'none' : '';
  }

  select.addEventListener('change', () => apply(select.value as SortMode, true));
  loadMoreBtn?.addEventListener('click', () => {
    visible += batch;
    apply(select.value as SortMode, false);
  });

  apply(select.value as SortMode, true);
}

document.addEventListener('page:view', initPostsSort);
document.addEventListener('astro:page-load', initPostsSort);
if (document.readyState !== 'loading') initPostsSort();
else document.addEventListener('DOMContentLoaded', initPostsSort);
