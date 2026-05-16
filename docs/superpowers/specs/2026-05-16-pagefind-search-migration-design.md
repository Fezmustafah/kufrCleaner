# Pagefind Search Migration Design

**Date:** 2026-05-16  
**Status:** Approved

## Goal

Replace FuseJS with Pagefind across both the `/search` page and the CommandPalette. Pagefind indexes full post body content at build time, enabling real keyword search rather than fuzzy matching against titles/tags/excerpts only. FuseJS is removed entirely.

---

## Architecture Overview

| Concern | Before | After |
|---|---|---|
| Search engine | FuseJS (client-side, fetches JSON) | Pagefind (binary index built at `astro build`) |
| Index location | Runtime JSON API + in-memory Fuse index | `/pagefind/` static files in `dist` |
| Full-text search | Title / tags / description / excerpt only | Full post body content |
| Filter (tags / category / year) | Client-side post-processing on Fuse hits | Pagefind native filter API (`data-pagefind-filter`) |
| Dev mode | Search works immediately | Requires one prior `pnpm build`; astro-pagefind serves the built index |
| API routes | Used by search + embeds | Kept — `base-embeds-client.ts` still needs them; search no longer does |

**What stays the same:** All UI — filter bar, preview pane, sticky header, keyboard nav, `#tag` prefix in search.astro. All quick-actions / pages / socials sections in CommandPalette. The `src/utils/search.ts` file.

---

## Section 1: Package & Build Changes

### `package.json`
- **Add:** `astro-pagefind` (dev dependency)
- **Remove:** `fuse.js`
- **Build script:** remove `&& npx pagefind --site dist` — the astro-pagefind integration fires pagefind automatically via its `astro:build:done` hook

### `astro.config.mjs`
- **Add** `import pagefind from 'astro-pagefind'` and `pagefind()` to the integrations array
- **Remove** `external: ['/pagefind/pagefind.js']` from the Vite config — astro-pagefind configures this itself

---

## Section 2: Layout Attribute Changes

Pagefind crawls built HTML using `data-pagefind-*` attributes to scope indexing and expose metadata.

### `src/layouts/PostLayout.astro`

Add `data-pagefind-body` to the `<article class="post-layout-article">` element (line ~129).

Add `data-pagefind-ignore` to the linked-mentions `<nav>` at the bottom of the article so it is not indexed.

Inject hidden metadata and filter spans inside the article, before its closing tag:

```html
<!-- Pagefind metadata -->
<span data-pagefind-meta="title" hidden>{post.data.title}</span>
<span data-pagefind-meta="date" hidden>{post.data.date.toISOString()}</span>
<span data-pagefind-meta="category" hidden>{(post.data as any).category || ""}</span>
<span data-pagefind-meta="image" hidden>{resolvedImageSrc || ""}</span>

<!-- Pagefind filters — one element per tag -->
{post.data.tags?.map(tag => (
  <span data-pagefind-filter={`tag[${tag}]`} hidden></span>
))}
{(post.data as any).category && (
  <span data-pagefind-filter={`category[${(post.data as any).category}]`} hidden></span>
)}
<span data-pagefind-filter={`year[${post.data.date.getFullYear()}]`} hidden></span>
```

### `src/layouts/PageLayout.astro`

Same `data-pagefind-body` pattern on the main content element. No tag/category/year filters needed (pages don't carry those).

Add minimal metadata:
```html
<span data-pagefind-meta="title" hidden>{page.data.title}</span>
```

### `src/layouts/BaseLayout.astro`

Add `data-pagefind-ignore` to the top-level `<header>` and `<footer>` elements so they are excluded from indexing across all pages that do not have a tighter `data-pagefind-body` scope.

---

## Section 3: `src/pages/search.astro`

The entire UI is preserved. Only the data layer changes.

### Remove
- `ensureFuse()` function
- `fuseItems` array variable
- `import('fuse.js')` dynamic import call
- `excerptAround()` usage (pagefind provides excerpts with `<mark>` tags natively)

### Add

**`initPagefind()`** — idempotent singleton:
```js
let pagefind: any = null;

async function initPagefind(): Promise<boolean> {
  if (pagefind) return true;
  try {
    pagefind = await import('/pagefind/pagefind.js');
    await pagefind.init();
    return true;
  } catch {
    return false; // dev mode without a prior build
  }
}
```

### `doSearch(query)`

- `#tag` prefix → `pagefind.search("", { filters: { tag: tagValue } })`
- Plain query → `pagefind.search(query, { filters: { tag?, category?, year? } })`
- Hydrate each result: `const data = await result.data()`
- `data` shape: `{ url, meta: { title, date, image, category }, filters: { tag: string[] }, excerpt }`
- Use `data.excerpt` directly for result snippets (already contains `<mark>` tags)
- `highlight()` from `search.ts` is no longer needed for excerpts

### `buildFilterBar()`

The pagefind search response includes available filter values with counts for the current result set. Use these instead of building the filter bar by iterating result metadata:

```js
const search = await pagefind.search(query);
// search.filters === { tag: { hadith: 12, fiqh: 3 }, category: { aqeedah: 5 }, year: { '2024': 8 } }
```

Render filter buttons from this object. Re-searching with a filter applied re-queries pagefind with `{ filters: { tag: selectedTag } }` — no client-side post-processing.

### Swup / `page:view`

`initPagefind()` is already called in both `initSearch()` paths (initial load and `document.addEventListener('page:view', initSearch)`). The dynamic import is browser-cached after the first call so re-entry is safe.

---

## Section 4: `src/components/CommandPalette.astro`

### Remove
- `loadPosts()` method
- `preloadData()` method  
- `initializeFuseSearch()` method
- `this.fuse` instance variable
- `this.items` instance variable
- All `fetch(...)` calls to `/api/posts.json` and `/api/pages.json`

### Add

**`initPagefind()`** — same singleton pattern as search.astro (module-level, not per-instance):

```js
let _pagefind: any = null;

async function initPagefind() {
  if (_pagefind) return _pagefind;
  _pagefind = await import('/pagefind/pagefind.js');
  await _pagefind.init();
  return _pagefind;
}
```

### `searchItems(query)` — new implementation

```js
private async searchItems(query: string): Promise<CommandPaletteItem[]> {
  try {
    const pf = await initPagefind();
    const search = await pf.search(query);
    const hydrated = await Promise.all(
      search.results.slice(0, 20).map((r: any) => r.data())
    );
    return hydrated.map((data: any) => ({
      type: 'post',
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

### Default items panel

Unchanged. It renders quick-actions, config-driven pages, and social links from `siteConfig` — none of this came from the JSON API. The `preloadData()` preloading was only to warm the Fuse index for faster first search; with Pagefind this is unnecessary.

---

## Section 5: Files — What Stays, What Goes

| File | Action | Reason |
|---|---|---|
| `src/pages/api/posts.json.ts` | Keep | Used by `base-embeds-client.ts` for Obsidian embed resolution |
| `src/pages/api/pages.json.ts` | Keep | Same — embed system |
| `src/pages/api/files.json.ts` | Keep | Graph view |
| `src/utils/search.ts` | Keep as-is | `cleanContent()` used by API routes + embeds; `highlight()` kept for `#tag` label rendering |
| `src/utils/search.test.ts` | Keep | Tests for the utilities above |
| `fuse.js` (npm) | Remove | No longer imported anywhere |
| `npx pagefind --site dist` in build script | Remove | astro-pagefind integration replaces this |

---

## Constraints & Risks

- **Dev mode:** Search only works after running `pnpm build` at least once. The astro-pagefind integration serves the pagefind index from `dist` during dev. First-time contributors need to build before search is available.
- **Filter exact-match:** Pagefind filter values are exact strings. The previous `#tag` search was a substring match (e.g., `#fiq` matched `fiqh`). Post-migration, `#fiq` will return no results — only exact tag names match. This is correct behavior and removes false positives, but users should be aware.
- **`data-pagefind-ignore` on nav:** The linked-mentions nav at the bottom of posts must get `data-pagefind-ignore` to prevent cross-post link text from polluting the index.
- **Swup compatibility:** CLAUDE.md rule 3 — all interactive re-init must happen on `page:view`. Both `initPagefind()` singleton and the existing Swup hooks in search.astro / CommandPalette already satisfy this.
- **`astro.config.mjs` devToolbar:** Rule 4 — never disable `devToolbar.enabled: true`. The astro-pagefind integration does not touch this.
