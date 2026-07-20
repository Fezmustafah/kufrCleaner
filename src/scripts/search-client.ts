// Search page (/search) behaviour. Loaded globally from BaseLayout (see the
// always-loaded init modules block there): the search page can be reached via
// Swup nav from any entry page — e.g. the search palette's "Advanced search"
// link — and Swup never executes scripts shipped only with the fetched page.
// No-ops when #search-query is absent.
import { highlight, escapeHtml } from '@/utils/search';

// SVG path strings (hardcoded — define:vars breaks dynamic import)
const svgPaths = {
  arrowRight:    `<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>`,
  externalLink:  `<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>`,
  folder:        `<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>`,
  tag:           `<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>`,
  fileText:      `<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>`,
  triangleAlert: `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="m12 17 .01 0"/>`,
  calendar:      `<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>`,
  clock:         `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
  sortLines:     `<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="9" y2="18"/>`,
  xMark:         `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`,
};

const norm = (s: string) =>
  s ? s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase() : '';

function svg(path: string, size = 14, extraClass = '') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-block shrink-0 ${extraClass}" aria-hidden="true">${path}</svg>`;
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function safeUrl(url: string) {
  return /^https?:\/\/|^\//.test(url) ? url : '#';
}

// Per-page-view state
let pagefind: any = null;
let pagefindReady = false;
let currentItems: any[] = [];

// Filter state (reset on new search query)
let allResults: any[] = [];
let activeTagFilters = new Set<string>();
let activeCategoryFilter: string | null = null;
let sortMode: 'relevance' | 'newest' = 'relevance';
let filterYear: number | null = null;
let filterBarOpen = false;

function initSearch() {
  // Always release scroll lock left over from a mobile sheet that was open during navigation
  document.body.style.overflow = '';
  // Re-init pagefind on each Swup navigation — its WASM worker may have been killed
  pagefindReady = false;

  const queryInput     = document.getElementById('search-query') as HTMLInputElement | null;
  const resultsEl      = document.getElementById('search-results');
  const statusEl       = document.getElementById('search-status');
  const paneEl         = document.getElementById('search-pane');
  const emptyEl        = document.getElementById('search-empty');
  const previewEl      = document.getElementById('preview-content');
  const clearBtn       = document.getElementById('search-clear');
  const form           = document.getElementById('search-form');
  const filterBar      = document.getElementById('filter-bar');
  const searchHeader   = document.getElementById('search-header');
  const searchShell    = document.getElementById('search-shell');
  const searchIntro    = document.getElementById('search-intro');
  const filterToggle      = document.getElementById('filter-toggle');
  const filterBadge       = document.getElementById('filter-badge');
  const filterClearOuter  = document.getElementById('filter-clear-outer') as HTMLButtonElement | null;
  const filterClearCount  = document.getElementById('filter-clear-count');
  if (filterClearOuter) {
    filterClearOuter.onclick = () => {
      activeTagFilters.clear();
      activeCategoryFilter = null;
      sortMode = 'relevance';
      filterYear = null;
      applyTagCategoryFiltersAndRender();
    };
  }
  const mobileSheet    = document.getElementById('mobile-sheet');
  const mobileBackdrop = document.getElementById('mobile-sheet-backdrop');
  const mobileClose    = document.getElementById('mobile-sheet-close');
  const mobileContent  = document.getElementById('mobile-sheet-content');

  if (!queryInput || !resultsEl || !statusEl || !paneEl || !emptyEl) return;

  function enterResultsMode() {
    if (searchShell) searchShell.style.minHeight = '';
    if (searchIntro) searchIntro.style.display = 'none';
    if (searchHeader) {
      searchHeader.style.position = 'sticky';
      // Sit flush under the fixed navbar: h-14 (3.5rem) desktop, h-12 (3rem) below md
      searchHeader.style.top = window.matchMedia('(min-width: 768px)').matches ? '3.5rem' : '3rem';
      searchHeader.style.zIndex = '20';
      searchHeader.style.paddingTop = '0.75rem';
    }
  }

  function enterEmptyMode() {
    if (searchShell) searchShell.style.minHeight = 'calc(100vh - 5rem)';
    if (searchIntro) searchIntro.style.display = '';
    if (searchHeader) {
      searchHeader.style.position = '';
      searchHeader.style.top = '';
      searchHeader.style.zIndex = '';
      searchHeader.style.paddingTop = '';
    }
    searchHeader?.classList.remove('shadow-sm', 'border-b', 'border-primary-100');
  }

  // Close mobile sheet instantly if page was re-initialised mid-navigation
  if (mobileSheet && !mobileSheet.classList.contains('translate-y-full')) {
    mobileSheet.classList.add('translate-y-full');
    mobileBackdrop?.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // If page loaded with ?q= already set, go straight to results mode
  if (new URLSearchParams(window.location.search).get('q')) {
    enterResultsMode();
  }

  filterToggle?.addEventListener('click', () => {
    filterBarOpen = !filterBarOpen;
    filterBar?.classList.toggle('hidden', !filterBarOpen);
    filterToggle.setAttribute('aria-expanded', String(filterBarOpen));
    filterToggle.classList.toggle('bg-primary-100', filterBarOpen);
    filterToggle.classList.toggle('dark:bg-primary-800', filterBarOpen);
    filterToggle.classList.toggle('border-primary-400', filterBarOpen);
    filterToggle.classList.toggle('dark:border-primary-500', filterBarOpen);
  });

  let debounceTimer: number;
  let selectedIndex = 0;
  let currentQuery = '';

  // ── Pagefind init ─────────────────────────────────────────────────────
  async function initPagefind(): Promise<boolean> {
    if (pagefindReady) return true;
    try {
      const _pf = '/pagefind/pagefind.js';
      pagefind = await import(/* @vite-ignore */ _pf);
      await pagefind.init();
      pagefindReady = true;
      return true;
    } catch {
      return false;
    }
  }

  async function hydrateResults(results: any[]): Promise<any[]> {
    const data = await Promise.all(results.map((r: any) => r.data()));
    return data.map((d: any) => ({
      title:       d.meta.title    || d.url,
      url:         d.url,
      description: d.excerpt,
      excerpt:     d.excerpt,
      subResults:  d.sub_results  || [],
      tags:        d.filters?.tag  ?? [],
      category:    d.meta.category || '',
      date:        d.meta.date    || '',
      image:       d.meta.image   || '',
    }));
  }

  // ── Filter & sort ──────────────────────────────────────────────────────
  function applyTagCategoryFiltersAndRender(): void {
    let filtered = [...allResults];

    if (activeTagFilters.size > 0) {
      filtered = filtered.filter((item: any) =>
        (item.tags || []).some((t: string) =>
          [...activeTagFilters].some(active => norm(t) === norm(active))
        )
      );
    }

    if (activeCategoryFilter) {
      filtered = filtered.filter((item: any) =>
        norm(item.category || '') === norm(activeCategoryFilter!)
      );
    }

    currentItems = filtered;
    buildFilterBar(allResults);
    applyYearFilter();
  }

  function applyYearFilter(): void {
    let filtered = [...currentItems];
    if (filterYear !== null) {
      filtered = filtered.filter((item: any) =>
        item.date && new Date(item.date).getFullYear() === filterYear!
      );
    }
    if (sortMode === 'newest') {
      filtered.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    renderResults(filtered, currentQuery);
  }

  function buildFilterBar(results: any[]) {
    if (!filterBar) return;
    const tags       = [...new Set<string>(results.flatMap(r => r.tags || []))].sort();
    const categories = [...new Set<string>(results.map(r => r.category).filter(Boolean))].sort();
    const years      = [...new Set<number>(
      results.map(r => r.date && new Date(r.date).getFullYear()).filter(Boolean)
    )].sort((a, b) => a - b);

    if (tags.length === 0 && categories.length === 0 && years.length <= 1) {
      filterBar.classList.add('hidden');
      filterBar.innerHTML = '';
      if (filterToggle) filterToggle.style.display = 'none';
      const outerClearEl2 = document.getElementById('filter-clear-outer') as HTMLButtonElement | null;
      if (outerClearEl2) outerClearEl2.style.display = 'none';
      return;
    }

    const activeCount =
      activeTagFilters.size +
      (activeCategoryFilter ? 1 : 0) +
      (filterYear !== null ? 1 : 0) +
      (sortMode !== 'relevance' ? 1 : 0);

    // Update the outer clear button (next to Filters toggle)
    const outerClearEl = document.getElementById('filter-clear-outer') as HTMLButtonElement | null;
    const outerCountEl = document.getElementById('filter-clear-count');
    if (outerClearEl) {
      if (activeCount > 0) {
        outerClearEl.style.display = 'inline-flex';
        if (outerCountEl) outerCountEl.textContent = activeCount > 1 ? ` ${activeCount}` : '';
      } else {
        outerClearEl.style.display = 'none';
      }
    }

    const chipBase  = 'text-xs px-2 py-0.5 rounded border transition-colors cursor-pointer';
    const chipOff   = 'border-primary-300 dark:border-primary-600 text-primary-600 dark:text-primary-300 hover:border-highlight-400 hover:text-highlight-600 dark:hover:text-highlight-400 bg-white dark:bg-primary-900';
    const chipOnTag = 'bg-highlight-500 border-highlight-500 text-white';
    const chipOnCat = 'bg-primary-700 dark:bg-primary-200 border-primary-700 dark:border-primary-200 text-white dark:text-primary-900';
    const iconCls   = 'text-primary-400 dark:text-primary-500 flex-shrink-0';

    const tagsHtml = tags.length > 0 ? `
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="${iconCls}">${svg(svgPaths.tag, 12)}</span>
        ${tags.map(tag => {
          const on = activeTagFilters.has(tag);
          return `<button data-filter-tag="${escapeHtml(tag)}" class="${chipBase} rounded-full ${on ? chipOnTag : chipOff}">#${escapeHtml(tag)}</button>`;
        }).join('')}
      </div>` : '';

    const catsHtml = categories.length > 0 ? `
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="${iconCls}">${svg(svgPaths.folder, 12)}</span>
        ${categories.map(cat => {
          const on = activeCategoryFilter === cat;
          return `<button data-filter-category="${escapeHtml(cat)}" class="${chipBase} rounded-md ${on ? chipOnCat : chipOff}">${escapeHtml(cat)}</button>`;
        }).join('')}
      </div>` : '';

    const sortHtml = `
      <div class="flex items-center gap-1.5">
        <span class="${iconCls}">${svg(svgPaths.sortLines, 12)}</span>
        ${(['relevance', 'newest'] as const).map(mode => {
          const on = sortMode === mode;
          const label = mode === 'relevance' ? 'Relevance' : 'Newest';
          return `<button data-sort="${mode}" class="${chipBase} ${on ? chipOnCat : chipOff}">${label}</button>`;
        }).join('')}
      </div>`;

    const selectCls = 'text-xs px-2 py-0.5 rounded border border-primary-300 dark:border-primary-600 bg-white dark:bg-primary-800 text-primary-700 dark:text-primary-300 focus:outline-none focus:border-highlight-400';
    const dateHtml = years.length > 1 ? `
      <div class="flex items-center gap-1.5">
        <span class="${iconCls}">${svg(svgPaths.calendar, 12)}</span>
        <select id="filter-year" class="${selectCls}">
          <option value="">All years</option>
          ${[...years].reverse().map(y => `<option value="${y}" ${filterYear === y ? 'selected' : ''}>${y}</option>`).join('')}
        </select>
      </div>` : '';

    const divider = (tags.length > 0 || categories.length > 0)
      ? `<span class="h-4 w-px bg-primary-200 dark:bg-primary-700 flex-shrink-0 self-center"></span>` : '';

    filterBar.innerHTML = `
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 rounded-xl bg-primary-50 dark:bg-primary-800/50 border border-primary-200 dark:border-primary-700">
        ${tagsHtml}${catsHtml}${divider}${sortHtml}${dateHtml}
      </div>`;
    filterBar.classList.toggle('hidden', !filterBarOpen);

    if (filterToggle) {
      filterToggle.style.display = 'inline-flex';
      filterToggle.setAttribute('aria-expanded', String(filterBarOpen));
      filterToggle.classList.toggle('bg-primary-100', filterBarOpen);
      filterToggle.classList.toggle('dark:bg-primary-800', filterBarOpen);
      filterToggle.classList.toggle('border-primary-400', filterBarOpen);
      filterToggle.classList.toggle('dark:border-primary-500', filterBarOpen);
    }
    if (filterBadge) {
      if (activeCount > 0) {
        filterBadge.textContent = String(activeCount);
        filterBadge.style.display = 'inline';
      } else {
        filterBadge.style.display = 'none';
      }
    }

    filterBar.querySelectorAll<HTMLButtonElement>('[data-filter-tag]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tag = btn.getAttribute('data-filter-tag')!;
        activeTagFilters.has(tag) ? activeTagFilters.delete(tag) : activeTagFilters.add(tag);
        applyTagCategoryFiltersAndRender();
      });
    });

    filterBar.querySelectorAll<HTMLButtonElement>('[data-filter-category]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const cat = btn.getAttribute('data-filter-category')!;
        activeCategoryFilter = activeCategoryFilter === cat ? null : cat;
        applyTagCategoryFiltersAndRender();
      });
    });

    filterBar.querySelectorAll<HTMLButtonElement>('[data-sort]').forEach(btn => {
      btn.addEventListener('click', () => {
        sortMode = btn.getAttribute('data-sort') as 'relevance' | 'newest';
        applyTagCategoryFiltersAndRender();
      });
    });

    const yearSel = filterBar.querySelector<HTMLSelectElement>('#filter-year');
    yearSel?.addEventListener('change', () => {
      filterYear = yearSel.value ? parseInt(yearSel.value) : null;
      applyTagCategoryFiltersAndRender();
    });

  }

  // ── Skeleton loading ───────────────────────────────────────────────────
  function renderSkeletons() {
    paneEl!.classList.remove('hidden');
    emptyEl!.classList.add('hidden');
    resultsEl!.innerHTML = Array.from({ length: 3 }, () => `
      <div class="px-4 py-3 border-b border-primary-100 dark:border-primary-800 animate-pulse">
        <div class="flex items-start gap-2">
          <div class="w-3 h-3 mt-1 rounded bg-primary-200 dark:bg-primary-700 shrink-0"></div>
          <div class="flex-1 min-w-0 space-y-2">
            <div class="h-3.5 bg-primary-200 dark:bg-primary-700 rounded w-4/5"></div>
            <div class="h-3 bg-primary-100 dark:bg-primary-800 rounded w-2/5"></div>
            <div class="flex gap-1">
              <div class="h-4 bg-primary-100 dark:bg-primary-800 rounded-full w-12"></div>
              <div class="h-4 bg-primary-100 dark:bg-primary-800 rounded-full w-16"></div>
            </div>
          </div>
        </div>
      </div>`
    ).join('');
  }

  // ── Result card ────────────────────────────────────────────────────────
  function renderResultItem(item: any, i: number, rawQuery: string) {
    const isSelected = i === selectedIndex;

    const categoryHtml = item.category
      ? `<span class="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-800 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-700">
          ${svg(svgPaths.folder, 10, 'opacity-70')}${escapeHtml(item.category)}
        </span>`
      : '';

    const tagsHtml = (item.tags || []).slice(0, 3).map((t: string) =>
      `<span class="text-xs text-highlight-600 dark:text-highlight-400">#${escapeHtml(t)}</span>`
    ).join('');

    const datePart = item.date
      ? `<span class="flex items-center gap-0.5 text-xs text-primary-400 dark:text-primary-500">
          ${svg(svgPaths.calendar, 10, 'opacity-70')}${formatDate(item.date)}
        </span>`
      : '';

    const timePart = item.readingTime
      ? `<span class="flex items-center gap-0.5 text-xs text-primary-400 dark:text-primary-500">
          ${svg(svgPaths.clock, 10, 'opacity-70')}${escapeHtml(String(item.readingTime))} min read
        </span>`
      : '';

    return `
      <a href="${escapeHtml(safeUrl(item.url))}"
         data-index="${i}"
         class="result-item block px-4 py-3 border-b border-primary-100 dark:border-primary-800 last:border-b-0 transition-colors border-l-2
                ${isSelected
                  ? 'bg-primary-50 dark:bg-primary-800/60 border-l-highlight-500'
                  : 'hover:bg-primary-50 dark:hover:bg-primary-800/30 border-l-transparent'}">
        <div class="flex items-start gap-2">
          <span class="mt-0.5 text-primary-400 dark:text-primary-500 shrink-0">${svg(svgPaths.fileText, 13)}</span>
          <div class="min-w-0 w-full">
            <div class="font-medium text-sm text-primary-900 dark:text-primary-50 leading-snug">${highlight(item.title, rawQuery)}</div>
            ${categoryHtml || tagsHtml
              ? `<div class="mt-1 flex flex-wrap items-center gap-1">${categoryHtml}${tagsHtml}</div>`
              : ''}
            ${datePart || timePart
              ? `<div class="mt-1 flex items-center gap-2">${datePart}${timePart}${
                  (item.subResults || []).length > 1
                    ? `<span class="text-xs text-primary-300 dark:text-primary-600 tabular-nums">${(item.subResults || []).length} sections</span>`
                    : ''
                }</div>`
              : ''}
          </div>
        </div>
      </a>`;
  }

  // ── Preview pane / sheet content ───────────────────────────────────────
  function buildPreviewHtml(item: any, rawQuery: string) {
    const subResults: any[] = item.subResults || [];

    const tagsHtml = (item.tags || []).map((t: string) =>
      `<a href="${import.meta.env.BASE_URL}tags/${escapeHtml(t)}"
          class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-highlight-50 dark:bg-highlight-900/30 text-highlight-700 dark:text-highlight-400 border border-highlight-200 dark:border-highlight-700 hover:bg-highlight-100 dark:hover:bg-highlight-800/40 transition-colors">
        ${svg(svgPaths.tag, 11, 'opacity-70')}${escapeHtml(t)}
      </a>`
    ).join('');

    const categoryHtml = item.category
      ? `<span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-primary-100 dark:bg-primary-800 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-700">
          ${svg(svgPaths.folder, 11, 'opacity-70')}${escapeHtml(item.category)}
        </span>`
      : '';

    const metaHtml = item.date || item.readingTime
      ? `<div class="flex items-center gap-3 mb-4 text-xs text-primary-500 dark:text-primary-400">
          ${item.date        ? `<span class="flex items-center gap-1">${svg(svgPaths.calendar, 11)}${formatDate(item.date)}</span>` : ''}
          ${item.readingTime ? `<span class="flex items-center gap-1">${svg(svgPaths.clock, 11)}${escapeHtml(String(item.readingTime))} min read</span>` : ''}
        </div>`
      : '';

    return `
      <div class="flex items-start justify-between gap-3 mb-2">
        <h2 class="text-lg font-semibold text-primary-900 dark:text-primary-50 leading-snug">${highlight(item.title, rawQuery)}</h2>
        <a href="${escapeHtml(safeUrl(item.url))}" title="Open post"
           class="shrink-0 p-1.5 rounded-lg text-primary-400 hover:text-highlight-600 dark:hover:text-highlight-400 hover:bg-primary-100 dark:hover:bg-primary-800 transition-colors"
           aria-label="Open post">${svg(svgPaths.externalLink, 15)}</a>
      </div>
      ${metaHtml}
      ${categoryHtml || tagsHtml
        ? `<div class="flex flex-wrap items-center gap-2 mb-4">${categoryHtml}${tagsHtml}</div>`
        : ''}
      ${subResults.length > 0 ? `
        <div>
          ${subResults.length > 1
            ? `<p class="text-xs font-medium text-primary-400 dark:text-primary-500 mb-2.5">${subResults.length} matching sections</p>`
            : ''}
          <div class="space-y-2">
            ${subResults.map((sr: any) => {
              const heading = sr.anchor?.text || null;
              const sectionUrl = escapeHtml(safeUrl(sr.url || item.url));
              return `
                <div class="rounded-lg border border-primary-100 dark:border-primary-700/50 overflow-hidden">
                  ${heading ? `
                    <a href="${sectionUrl}" class="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 dark:bg-primary-800/50 text-xs font-medium text-highlight-600 dark:text-highlight-400 hover:text-highlight-700 dark:hover:text-highlight-300 border-b border-primary-100 dark:border-primary-700/50 transition-colors">
                      ${svg(svgPaths.arrowRight, 10, 'opacity-60 -rotate-45')}${escapeHtml(heading)}
                    </a>` : ''}
                  <p class="px-3 py-2.5 text-sm leading-relaxed text-primary-700 dark:text-primary-300">…${sr.excerpt}…</p>
                </div>`;
            }).join('')}
          </div>
        </div>` : ''}
      <a href="${escapeHtml(safeUrl(item.url))}"
         class="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-lg bg-highlight-500 hover:bg-highlight-600 text-white text-sm font-medium transition-colors">
        Read post ${svg(svgPaths.arrowRight, 14, 'text-white')}
      </a>`;
  }

  function renderPreview(item: any, rawQuery: string) {
    if (!previewEl) return;
    previewEl.innerHTML = buildPreviewHtml(item, rawQuery);
  }

  // ── Results list ───────────────────────────────────────────────────────
  function renderResults(items: any[], rawQuery: string) {
    currentItems = items;
    currentQuery = rawQuery;
    selectedIndex = 0;

    if (items.length === 0) {
      const isFiltered =
        activeTagFilters.size > 0 || activeCategoryFilter !== null || filterYear !== null;
      enterResultsMode();
      searchHeader?.classList.remove('shadow-sm', 'border-b', 'border-primary-100');

      if (isFiltered) {
        // Show no-results message inside the pane (below the filter bar)
        paneEl!.classList.remove('hidden');
        emptyEl!.classList.add('hidden');
        searchHeader?.classList.add('shadow-sm');
        statusEl!.textContent = '';
        statusEl!.classList.remove('hidden');
        resultsEl!.innerHTML = `
          <div class="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-primary-300 dark:text-primary-600 mb-3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            <p class="text-sm font-medium text-primary-700 dark:text-primary-300 mb-1">No results match the current filters</p>
            <p class="text-xs text-primary-400 dark:text-primary-500 mb-4">Try removing a filter to broaden results</p>
            <button id="pane-clear-filters" class="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-primary-300 dark:border-primary-600 text-primary-600 dark:text-primary-300 hover:border-highlight-500 hover:text-highlight-600 dark:hover:text-highlight-400 transition-colors">
              <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/></svg>
              Clear all filters
            </button>
          </div>`;
        if (previewEl) previewEl.innerHTML = '';
        document.getElementById('pane-clear-filters')?.addEventListener('click', () => {
          activeTagFilters.clear();
          activeCategoryFilter = null;
          sortMode = 'relevance';
          filterYear = null;
          applyTagCategoryFiltersAndRender();
        });
      } else {
        paneEl!.classList.add('hidden');
        emptyEl!.classList.remove('hidden');
        statusEl!.textContent = `No results for "${rawQuery}". Try fewer words or a #tag search.`;
        statusEl!.classList.remove('hidden');
      }
      return;
    }

    enterResultsMode();
    statusEl!.textContent = `${items.length} result${items.length === 1 ? '' : 's'}`;
    statusEl!.classList.remove('hidden');
    paneEl!.classList.remove('hidden');
    emptyEl!.classList.add('hidden');
    searchHeader?.classList.add('shadow-sm');

    resultsEl!.innerHTML = items.map((item, i) => renderResultItem(item, i, rawQuery)).join('');

    resultsEl!.querySelectorAll<HTMLAnchorElement>('.result-item').forEach((el, i) => {
      el.addEventListener('mouseenter', () => {
        if (!window.matchMedia('(max-width: 767px)').matches) setSelected(i);
      });
      el.addEventListener('click', (e) => {
        if (window.matchMedia('(max-width: 767px)').matches) {
          e.preventDefault();
          e.stopPropagation();
          openMobileSheet(currentItems[i], currentQuery);
        }
      });
    });

    renderPreview(items[0], rawQuery);
  }

  function setSelected(idx: number) {
    if (idx < 0 || idx >= currentItems.length) return;
    selectedIndex = idx;
    resultsEl!.querySelectorAll('.result-item').forEach((el, i) => {
      const active = i === idx;
      el.classList.toggle('bg-primary-50', active);
      el.classList.toggle('dark:bg-primary-800/60', active);
      el.classList.toggle('border-l-highlight-500', active);
      el.classList.toggle('border-l-transparent', !active);
    });
    renderPreview(currentItems[idx], currentQuery);
  }

  // ── Mobile bottom sheet ────────────────────────────────────────────────
  function openMobileSheet(item: any, rawQuery: string) {
    if (!mobileSheet || !mobileBackdrop || !mobileContent) return;
    mobileContent.innerHTML = buildPreviewHtml(item, rawQuery);
    mobileBackdrop.classList.remove('hidden');
    mobileSheet.classList.remove('translate-y-full');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileSheet() {
    if (!mobileSheet || !mobileBackdrop) return;
    // Release scroll lock immediately — not in a timeout — so any subsequent
    // navigation (e.g. "Read post" link) finds the body scrollable right away.
    document.body.style.overflow = '';
    mobileSheet.classList.add('translate-y-full');
    setTimeout(() => {
      mobileBackdrop.classList.add('hidden');
    }, 300);
  }

  // When any link inside the sheet content is clicked (e.g. "Read post"),
  // clean up the sheet immediately before Swup takes over navigation.
  mobileContent?.addEventListener('click', (e) => {
    if ((e.target as Element).closest('a[href]')) {
      document.body.style.overflow = '';
      mobileSheet?.classList.add('translate-y-full');
      mobileBackdrop?.classList.add('hidden');
    }
  });

  mobileClose?.addEventListener('click', closeMobileSheet);
  mobileBackdrop?.addEventListener('click', closeMobileSheet);

  if (mobileSheet) {
    let touchStartY = 0;
    let touchStartedOnHandle = false;

    mobileSheet.addEventListener('touchstart', e => {
      touchStartY = e.touches[0].clientY;
      // True when touch starts on the drag-handle / header, not inside the scrollable content area.
      // Allows normal scrolling inside content without accidentally triggering dismiss.
      touchStartedOnHandle = !mobileContent?.contains(e.target as Node);
    }, { passive: true });

    mobileSheet.addEventListener('touchend', e => {
      const deltaY = e.changedTouches[0].clientY - touchStartY;
      const contentAtTop = !mobileContent || mobileContent.scrollTop <= 2;
      // Dismiss only when swiped down far enough AND either:
      //   (a) gesture started on the handle (safe to always dismiss), or
      //   (b) content is scrolled to the very top (no scroll to lose).
      if (deltaY > 80 && (touchStartedOnHandle || contentAtTop)) {
        closeMobileSheet();
      }
    }, { passive: true });
  }

  // ── Main search ────────────────────────────────────────────────────────
  async function doSearch(rawQuery: string) {
    clearBtn?.classList.toggle('hidden', !rawQuery);

    if (!rawQuery.trim()) {
      paneEl!.classList.add('hidden');
      emptyEl!.classList.remove('hidden');
      statusEl!.classList.add('hidden');
      if (filterBar) { filterBar.classList.add('hidden'); filterBar.innerHTML = ''; }
      if (filterToggle) filterToggle.style.display = 'none';
      if (filterBadge) filterBadge.style.display = 'none';
      filterBarOpen = false;
      enterEmptyMode();
      activeTagFilters.clear();
      activeCategoryFilter = null;
      sortMode = 'relevance';
      filterYear = null;
      return;
    }

    renderSkeletons();

    const ok = await initPagefind();
    if (!ok) {
      statusEl!.textContent = 'Search unavailable — run pnpm build first.';
      statusEl!.classList.remove('hidden');
      paneEl!.classList.add('hidden');
      return;
    }

    if (rawQuery.startsWith('#')) {
      const tagQ = rawQuery.slice(1).trim();
      const s = tagQ
        ? await pagefind.search('', { filters: { tag: tagQ } })
        : { results: [] };
      allResults = await hydrateResults((s.results as any[]).slice(0, 100));
      currentItems = allResults;
    } else {
      const unfiltered = await pagefind.search(rawQuery);
      allResults = await hydrateResults((unfiltered.results as any[]).slice(0, 100));
      currentItems = allResults;
    }

    buildFilterBar(allResults);
    applyYearFilter();
  }

  // ── Keyboard navigation ────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileSheet && !mobileSheet.classList.contains('translate-y-full')) {
      closeMobileSheet();
      return;
    }
    if (paneEl!.classList.contains('hidden')) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(selectedIndex + 1, currentItems.length - 1);
      setSelected(next);
      resultsEl!.querySelectorAll('.result-item')[next]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(selectedIndex - 1, 0);
      setSelected(prev);
      resultsEl!.querySelectorAll('.result-item')[prev]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && document.activeElement === queryInput) {
      const active = resultsEl!.querySelectorAll<HTMLAnchorElement>('.result-item')[selectedIndex];
      if (active?.href) window.location.href = active.href;
    }
  });

  queryInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => doSearch(queryInput.value), 250);
  });

  clearBtn?.addEventListener('click', () => {
    queryInput.value = '';
    doSearch('');
    queryInput.focus();
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(debounceTimer);
    doSearch(queryInput.value);
  });

  const initialQuery = new URLSearchParams(window.location.search).get('q');
  if (initialQuery) {
    queryInput.value = initialQuery;
    // Wait for pagefind WASM worker to finish re-init before searching.
    // initPagefind() was reset to false at top of initSearch() so this
    // always re-runs pagefind.init() on each Swup navigation.
    initPagefind().then(ok => { if (ok) doSearch(initialQuery); });
  }
}

initSearch();
document.addEventListener('swup:page:view', initSearch);
