# Pagefind Search Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace FuseJS with Pagefind across the `/search` page and CommandPalette, enabling full post-body keyword search while preserving all existing UI (filter bar, preview pane, keyboard nav, quick-actions).

**Architecture:** Pagefind indexes full HTML at `astro build` time, producing `/pagefind/` static files. Layouts expose metadata via `data-pagefind-meta` / `data-pagefind-filter` attributes. Both `search.astro` and `CommandPalette.astro` dynamically import `/pagefind/pagefind.js` at runtime and call `pagefind.search()` instead of FuseJS. Tag/category filtering uses Pagefind's native filter API; year range stays client-side.

**Tech Stack:** Astro 6, `astro-pagefind` npm package, Pagefind JS API, TypeScript, Tailwind CSS 3

**Spec:** `docs/superpowers/specs/2026-05-16-pagefind-search-migration-design.md`

---

## File Map

| File | Action | What changes |
|---|---|---|
| `package.json` | Modify | Add `astro-pagefind`, remove `fuse.js`, strip `npx pagefind` from build |
| `astro.config.mjs` | Modify | Add `pagefind()` integration, remove Vite `external` entry |
| `src/layouts/PostLayout.astro` | Modify | `data-pagefind-body` on `<article>`, `data-pagefind-ignore` on linked-mentions nav, hidden meta/filter spans |
| `src/layouts/PageLayout.astro` | Modify | `data-pagefind-body` on `<article>`, hidden title meta span |
| `src/pages/search.astro` | Modify | Remove FuseJS state + `ensureFuse()`; add `initPagefind`, `hydrateResults`, `applyTagCategoryFiltersAndRender`, `applyYearFilter`; update `doSearch()` and filter click handlers |
| `src/components/CommandPalette.astro` | Modify | Remove `loadPosts`, `preloadData`, `initializeFuseSearch`, `this.fuse`, `this.items`; add module-level `initPagefind`; replace `searchItems()` |

**Files that do NOT change:** `src/pages/api/posts.json.ts`, `src/pages/api/pages.json.ts` (kept for embed system), `src/utils/search.ts`, `src/utils/search.test.ts`.

---

## Task 1: Install astro-pagefind, remove fuse.js, update build script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install astro-pagefind as a dev dependency**

```bash
cd "C:/Users/user1/Documents/GitHub/kufrCleaner"
pnpm add -D astro-pagefind
```

Expected: `astro-pagefind` appears under `devDependencies` in `package.json`.

- [ ] **Step 2: Uninstall fuse.js**

```bash
pnpm remove fuse.js
```

Expected: `fuse.js` removed from `package.json` dependencies.

- [ ] **Step 3: Remove `npx pagefind --site dist` from the build script in `package.json`**

Find the `"build"` script. It currently ends with `&& astro build && npx pagefind --site dist`.
Change it to end at `&& astro build` — the `astro-pagefind` integration will run pagefind automatically via its `astro:build:done` hook.

Before:
```json
"build": "... && astro build && npx pagefind --site dist"
```

After:
```json
"build": "... && astro build"
```

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: swap fuse.js for astro-pagefind"
```

---

## Task 2: Add astro-pagefind integration to astro.config.mjs

**Files:**
- Modify: `astro.config.mjs`

- [ ] **Step 1: Add the pagefind import at the top of `astro.config.mjs`**

The file starts with a block of imports (lines 1–30). Add after the last import line (line 30, which imports `swup`):

```js
import pagefind from 'astro-pagefind';
```

- [ ] **Step 2: Add `pagefind()` to the integrations array**

Find the `integrations:` array in `defineConfig`. It currently contains integrations like `tailwind()`, `sitemap()`, `swup()`. Add `pagefind()` as the **first** entry:

```js
integrations: [
  pagefind(),
  tailwind({ /* existing options */ }),
  // ... rest of integrations unchanged
],
```

- [ ] **Step 3: Remove the manual Vite external entry for pagefind**

Locate line 473 (approximately) in the Vite config section which reads:
```js
external: ['/pagefind/pagefind.js'],
```
`astro-pagefind` configures this itself. Remove this line. If `external` is an array with other entries, remove only the `'/pagefind/pagefind.js'` entry. If it was the only entry, remove the `external` key entirely.

- [ ] **Step 4: Verify the config file is valid**

```bash
cd "C:/Users/user1/Documents/GitHub/kufrCleaner"
node --input-type=module --eval "import('./astro.config.mjs').then(() => console.log('OK')).catch(e => { console.error(e); process.exit(1); })"
```

Expected output: `OK`

- [ ] **Step 5: Commit**

```bash
git add astro.config.mjs
git commit -m "feat: add astro-pagefind integration"
```

---

## Task 3: Add pagefind attributes to PostLayout.astro

**Files:**
- Modify: `src/layouts/PostLayout.astro` (lines ~129, ~204, ~238, ~252)

Pagefind indexes content inside `data-pagefind-body`. Hidden spans expose metadata for the JS API to read back.

- [ ] **Step 1: Add `data-pagefind-body` to the article element (line 129)**

Find:
```astro
<article class="post-layout-article">
```

Change to:
```astro
<article class="post-layout-article" data-pagefind-body>
```

- [ ] **Step 2: Add `data-pagefind-ignore` to the linked-mentions nav (line 204)**

Find the nav element beginning around line 204:
```astro
<nav class={`mt-8 pt-8 ${siteConfig.postOptions.linkedMentions.enabled ? '' : 'border-t border-primary-200 dark:border-primary-700'}`}>
```

Change to:
```astro
<nav data-pagefind-ignore class={`mt-8 pt-8 ${siteConfig.postOptions.linkedMentions.enabled ? '' : 'border-t border-primary-200 dark:border-primary-700'}`}>
```

- [ ] **Step 3: Add hidden metadata and filter spans inside the article, just before its closing `</article>` tag (line ~252)**

Find the closing `</article>` tag (line ~252). Insert the following block immediately before it:

```astro
{/* Pagefind metadata and filters — hidden, indexed at build time */}
<span data-pagefind-meta="title" hidden>{post.data.title}</span>
<span data-pagefind-meta="date" hidden>{post.data.date.toISOString()}</span>
<span data-pagefind-meta="category" hidden>{(post.data as any).category || ''}</span>
<span data-pagefind-meta="image" hidden>{seoData.ogImage?.url || ''}</span>
{post.data.tags?.map((tag: string) => (
  <span data-pagefind-filter={`tag[${tag}]`} hidden></span>
))}
{(post.data as any).category && (
  <span data-pagefind-filter={`category[${(post.data as any).category}]`} hidden></span>
)}
<span data-pagefind-filter={`year[${post.data.date.getFullYear()}]`} hidden></span>
```

Note: `seoData` is the SEO data object already defined in the frontmatter of `PostLayout.astro` — its `ogImage.url` contains the resolved post image URL.

- [ ] **Step 4: Commit**

```bash
git add src/layouts/PostLayout.astro
git commit -m "feat: add pagefind indexing attributes to PostLayout"
```

---

## Task 4: Add pagefind attributes to PageLayout.astro, exclude search.astro

**Files:**
- Modify: `src/layouts/PageLayout.astro` (line ~69)
- Modify: `src/pages/search.astro` (outermost wrapper div)

- [ ] **Step 1: Add `data-pagefind-body` to PageLayout's article element (line 69)**

Find:
```astro
<article class={`bg-primary-50 dark:bg-primary-900 rounded-lg border ...`}>
```

Change to:
```astro
<article data-pagefind-body class={`bg-primary-50 dark:bg-primary-900 rounded-lg border ...`}>
```

- [ ] **Step 2: Add a hidden title metadata span inside the PageLayout article, before its closing `</article>`**

Find the closing `</article>` in `PageLayout.astro` and insert just before it:

```astro
{/* Pagefind metadata */}
<span data-pagefind-meta="title" hidden>{page.data.title}</span>
```

- [ ] **Step 3: Exclude the search page from pagefind indexing**

Open `src/pages/search.astro`. Find the outermost div inside `<BaseLayout>`:

```astro
<BaseLayout seoData={seoData}>
  <div class="max-w-5xl mx-auto">
```

Change to:
```astro
<BaseLayout seoData={seoData}>
  <div data-pagefind-ignore class="max-w-5xl mx-auto">
```

This prevents pagefind from indexing the search page itself.

- [ ] **Step 4: Commit**

```bash
git add src/layouts/PageLayout.astro src/pages/search.astro
git commit -m "feat: pagefind body on PageLayout, exclude search page from index"
```

---

## Task 5: search.astro — replace FuseJS state and add Pagefind helpers

**Files:**
- Modify: `src/pages/search.astro` (lines ~182–183 and ~270)

- [ ] **Step 1: Replace the FuseJS state variables (lines 182–183)**

Find these two lines inside the `<script>` block:
```ts
let fuse: any = null;
let fuseItems: any[] = [];
```

Replace them with:
```ts
let pagefind: any = null;
let pagefindReady = false;
let currentItems: any[] = [];
```

Keep `let allResults: any[] = [];` at line 186 — it stays and now holds unfiltered pagefind results for the filter bar.

- [ ] **Step 2: Replace `ensureFuse()` (starting line 270) with `initPagefind()` and `hydrateResults()`**

Find the entire `async function ensureFuse()` block (it fetches fuse.js and posts.json, builds a Fuse instance). Delete it entirely and replace with:

```ts
async function initPagefind(): Promise<boolean> {
  if (pagefindReady) return true;
  try {
    pagefind = await import('/pagefind/pagefind.js');
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
    tags:        d.filters.tag  ?? [],
    category:    d.meta.category || '',
    date:        d.meta.date    || '',
    image:       d.meta.image   || '',
  }));
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/search.astro
git commit -m "feat(search): add pagefind init and hydration helpers"
```

---

## Task 6: search.astro — replace doSearch() data layer and filter handlers

**Files:**
- Modify: `src/pages/search.astro`

The `doSearch()` function has a section after state setup that calls `ensureFuse()` and `fuse.search()`. Replace that section and the `applyFilters()` function.

- [ ] **Step 1: Check whether `renderResults()` calls `excerptAround()` and patch if needed**

Open `src/pages/search.astro` and search for `excerptAround` inside `renderResults()`. If it's called on `item.excerpt` or `item.description`:

```ts
// OLD — do NOT do this with pagefind excerpts (they already have <mark> tags)
const snippet = excerptAround(item.excerpt, query, 160);

// NEW — use item.description directly; it already contains pagefind's <mark>-tagged excerpt
const snippet = item.description;
```

If `highlight()` is applied to the excerpt snippet, remove that call too — applying `highlight()` on top of pagefind's pre-marked excerpt would nest marks. `highlight()` can still be applied to `item.title` for title highlighting.

- [ ] **Step 2: Replace the FuseJS search block inside `doSearch()`**

Inside `doSearch(rawQuery)`, find the block that starts with:
```ts
const ok = await ensureFuse();
if (!ok) {
```
and ends with:
```ts
buildFilterBar(allResults);
applyFilters();
```

Replace that entire block with:

```ts
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

  const filters: Record<string, any> = {};
  if (activeTagFilters.size > 0) filters.tag = [...activeTagFilters];
  if (activeCategoryFilter) filters.category = activeCategoryFilter;

  if (Object.keys(filters).length > 0) {
    const filtered = await pagefind.search(rawQuery, { filters });
    currentItems = await hydrateResults((filtered.results as any[]).slice(0, 100));
  } else {
    currentItems = allResults;
  }
}

buildFilterBar(allResults);
applyYearFilter();
```

Note: `norm()` is no longer needed on the query before passing to `pagefind.search()` — pagefind normalises internally.

- [ ] **Step 2: Replace `applyFilters()` (line ~309) with two focused functions**

Find the entire `function applyFilters()` block (lines ~309–338). Replace it with:

```ts
async function applyTagCategoryFiltersAndRender(): Promise<void> {
  if (!pagefindReady) return;
  const filters: Record<string, any> = {};
  if (activeTagFilters.size > 0) filters.tag = [...activeTagFilters];
  if (activeCategoryFilter) filters.category = activeCategoryFilter;

  if (Object.keys(filters).length > 0) {
    const s = await pagefind.search(currentQuery, { filters });
    currentItems = await hydrateResults((s.results as any[]).slice(0, 100));
  } else {
    currentItems = allResults;
  }
  buildFilterBar(allResults);
  applyYearFilter();
}

function applyYearFilter(): void {
  let filtered = [...currentItems];
  if (filterFromYear !== null) {
    filtered = filtered.filter((item: any) =>
      item.date && new Date(item.date).getFullYear() >= filterFromYear!
    );
  }
  if (filterToYear !== null) {
    filtered = filtered.filter((item: any) =>
      item.date && new Date(item.date).getFullYear() <= filterToYear!
    );
  }
  if (sortMode === 'newest') {
    filtered.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
  renderResults(filtered, currentQuery);
}
```

- [ ] **Step 3: Update filter button click handlers**

There are three sets of `applyFilters()` calls to update in the filter bar event delegation logic (around lines 440–471):

**Tag button click** (lines ~440–442) — change:
```ts
activeTagFilters.has(tag) ? activeTagFilters.delete(tag) : activeTagFilters.add(tag);
buildFilterBar(allResults);
applyFilters();
```
To:
```ts
activeTagFilters.has(tag) ? activeTagFilters.delete(tag) : activeTagFilters.add(tag);
await applyTagCategoryFiltersAndRender();
```

**Category button click** (lines ~449–451) — change:
```ts
activeCategoryFilter = activeCategoryFilter === cat ? null : cat;
buildFilterBar(allResults);
applyFilters();
```
To:
```ts
activeCategoryFilter = activeCategoryFilter === cat ? null : cat;
await applyTagCategoryFiltersAndRender();
```

**Reset active filters button click** (lines ~458–459) — change:
```ts
buildFilterBar(allResults);
applyFilters();
```
To:
```ts
await applyTagCategoryFiltersAndRender();
```

**Year range `<select>` change handlers** (lines ~466–471) — change:
```ts
filterFromYear = fromSel.value ? parseInt(fromSel.value) : null;
applyFilters();
```
and:
```ts
filterToYear = toSel.value ? parseInt(toSel.value) : null;
applyFilters();
```
To:
```ts
filterFromYear = fromSel.value ? parseInt(fromSel.value) : null;
applyYearFilter();
```
and:
```ts
filterToYear = toSel.value ? parseInt(toSel.value) : null;
applyYearFilter();
```

- [ ] **Step 5: Verify no remaining references to `fuse`, `fuseItems`, or `ensureFuse` in search.astro**

```bash
grep -n 'fuse\|fuseItems\|ensureFuse' "C:/Users/user1/Documents/GitHub/kufrCleaner/src/pages/search.astro"
```

Expected: no output (all removed).

- [ ] **Step 6: Commit**

```bash
git add src/pages/search.astro
git commit -m "feat(search): migrate search.astro from FuseJS to Pagefind JS API"
```

---

## Task 7: CommandPalette.astro — remove FuseJS, add Pagefind

**Files:**
- Modify: `src/components/CommandPalette.astro`

- [ ] **Step 1: Add a module-level `initPagefind` singleton inside the `<script>` block**

Find the `<script>` tag in `CommandPalette.astro`. At the very top of the script body (before the `CommandPaletteManager` class), add:

```ts
let _pagefind: any = null;
let _pagefindReady = false;

async function initPagefind(): Promise<any> {
  if (_pagefindReady) return _pagefind;
  _pagefind = await import('/pagefind/pagefind.js');
  await _pagefind.init();
  _pagefindReady = true;
  return _pagefind;
}
```

- [ ] **Step 2: Remove instance variables `this.fuse` and `this.items` from the class**

Inside the `CommandPaletteManager` class, find and remove these instance variable declarations:
```ts
private fuse: any = null;
private items: CommandPaletteItem[] = [];
```
(They appear around lines 264–265 alongside `this.filteredItems`.)

- [ ] **Step 3: Remove `preloadData()`, `loadPosts()`, and `initializeFuseSearch()` methods**

Find and delete the entire bodies of:
- `private async preloadData()` — it calls `this.loadPosts()`
- `private async loadPosts()` — it fetches `/api/posts.json` and `/api/pages.json`, normalises items, and stores in `this.items`
- `private async initializeFuseSearch()` — it imports `fuse.js` and creates `this.fuse`

Also remove the call to `this.preloadData()` in the constructor (it's called from `init()` or the constructor body).

- [ ] **Step 4: Replace `searchItems()` with a Pagefind implementation**

Find the entire `private async searchItems(query: string)` method. Replace its body with:

```ts
private async searchItems(query: string): Promise<CommandPaletteItem[]> {
  const normalizedQuery = this.normalizeText(query);
  if (!normalizedQuery) return [];

  try {
    const pf = await initPagefind();
    const search = await pf.search(normalizedQuery);
    const hydrated = await Promise.all(
      (search.results as any[]).slice(0, 20).map((r: any) => r.data())
    );
    return hydrated.map((data: any): CommandPaletteItem => ({
      type: data.url.includes('/pages/') ? 'page' : 'post',
      title: data.meta.title || data.url,
      url: data.url,
      description: data.excerpt,
      image: data.meta.image || '',
      tags: data.filters.tag ?? [],
      date: data.meta.date || '',
      category: data.meta.category || '',
    }));
  } catch {
    return [];
  }
}
```

Note: The `CommandPaletteItem` interface (line ~239) has `type`, `title`, `url`, and other fields. If `image`, `tags`, `date`, or `category` are not currently in the interface, add them:
```ts
interface CommandPaletteItem {
  type: 'post' | 'page' | 'action';
  title: string;
  url: string;
  description?: string;
  image?: string;
  tags?: string[];
  date?: string;
  category?: string;
}
```

- [ ] **Step 5: Remove the `await this.loadPosts()` call inside `performSearch()`**

Find inside `performSearch()` (line ~741):
```ts
await this.loadPosts();
```
Delete this line — Pagefind doesn't need pre-loading.

- [ ] **Step 6: Verify no remaining fuse/fuseJS/loadPosts references**

```bash
grep -n 'fuse\|fuseItems\|loadPosts\|preloadData\|initializeFuse\|api/posts.json\|api/pages.json' "C:/Users/user1/Documents/GitHub/kufrCleaner/src/components/CommandPalette.astro"
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add src/components/CommandPalette.astro
git commit -m "feat(palette): migrate CommandPalette from FuseJS to Pagefind JS API"
```

---

## Task 8: Build verification

**Files:** None — verification only.

- [ ] **Step 1: Run the full production build**

```bash
cd "C:/Users/user1/Documents/GitHub/kufrCleaner"
pnpm build
```

Expected:
- Build completes without errors
- Near the end of output, you see pagefind running (e.g., `Indexed N pages` or similar)
- The `dist/pagefind/` directory exists after the build

Verify:
```bash
ls dist/pagefind/
```
Expected: `pagefind.js`, `pagefind-highlight.js`, `wasm.unknown.pagefind`, and `index/` directory present.

- [ ] **Step 2: Preview the built site**

```bash
pnpm preview
```

Open `http://localhost:4321/search/` (or whichever port the preview server starts on).

- [ ] **Step 3: Verify search.astro — basic search**

In the search bar, type a keyword that appears in the body of a post (not just the title — e.g., a word only found mid-article). Confirm results appear with highlighted excerpts (`<mark>` tags visible as highlighted text in the snippet).

- [ ] **Step 4: Verify search.astro — tag filter**

With results showing, click a tag filter button. Confirm results update and only show posts with that tag. Click the tag button again to deactivate — confirm full results return.

- [ ] **Step 5: Verify search.astro — `#tag` prefix**

Type `#` followed by an exact tag name (e.g., `#hadith`). Confirm results show only posts with that exact tag, with no query text required.

- [ ] **Step 6: Verify search.astro — year filter**

With results showing, change the year range dropdowns. Confirm results are filtered by year range (client-side).

- [ ] **Step 7: Verify CommandPalette — search results**

Open the command palette (keyboard shortcut or trigger). Type a keyword. Confirm search results appear with titles, excerpts, and any available metadata.

- [ ] **Step 8: Verify CommandPalette — default panel unchanged**

Open the command palette without typing. Confirm quick-actions, pages, and social links still show (these are config-driven and must be unaffected).

- [ ] **Step 9: Dev mode note**

Run `pnpm dev`. Open the search page. If you haven't run `pnpm build` after adding `astro-pagefind`, search shows "Search unavailable — run pnpm build first." This is expected. After one build, restart `pnpm dev` — search should work.

- [ ] **Step 10: Final commit**

```bash
git add -A
git commit -m "chore: pagefind migration complete — verify build and search"
```

---

## Known Behavioural Changes

| Old behaviour | New behaviour |
|---|---|
| `#fiq` (substring) matched tag `fiqh` | `#fiqh` exact tag name required — no substring match |
| FuseJS fuzzy matching (typo-tolerant) | Pagefind keyword matching (exact/stemmed words) |
| Dev search works immediately | Dev search requires a prior `pnpm build` |
| Search indexed title/tags/description/excerpt only | Search indexes full post body content |
| Results capped at 50 | Results capped at 100 per pagefind query |
