# Search Page Improvements — Design Spec

**Date:** 2026-05-12  
**Status:** Approved  
**Scope:** `/search` page only (command palette addressed separately)

---

## Goal

Improve the `/search` page across six dimensions: code quality, API payload size, search accuracy, filtering/sorting, result card richness, and mobile experience.

---

## Files Changed

| Action | File |
|---|---|
| New | `src/utils/search.ts` |
| Modified | `src/pages/api/posts.json.ts` |
| Modified | `src/pages/search.astro` |
| Deleted | `src/components/SearchResults.astro` (dead code) |

---

## Section 1 — Shared Utility (`src/utils/search.ts`)

Three exported functions used by `posts.json.ts` (server-side) and `search.astro` (client-side via inline script copy or bundled import).

### `cleanContent(raw: string): string`
Strips Markdown and Obsidian syntax to produce plain text:
- Obsidian image embeds: `![[file.png]]`, `![[file.png|caption|500]]`
- Obsidian wikilinks: `[[Page|display]]` → display, `[[Page]]` → Page
- Standard markdown images: `![alt](url)` → removed
- Markdown links: `[text](url)` → text
- Bold/italic markers: `**`, `__`, `*`, `_`
- Blockquote markers: `> `
- List markers: `-`, `*`, `+`, `1.`
- Code fences and inline code
- Heading markers: `#`, `##`, etc.
- Obsidian callouts: `> [!NOTE]` etc.
- Collapses excess whitespace, trims

### `highlight(text: string, query: string): string`
- Strips `#` prefix from tag searches
- Splits query into individual tokens (space-separated)
- HTML-escapes the text first (XSS safe)
- Wraps each token match in: `<mark class="bg-highlight-200 dark:bg-highlight-800/50 text-inherit rounded px-0.5">`
- Case-insensitive, regex-escaped tokens
- Returns escaped HTML string safe for `innerHTML`

### `excerptAround(content: string, query: string, radius?: number): { text: string, truncated: boolean }`
- Default radius: 160 chars each side
- Strips query `#` prefix, splits into tokens
- Scores overlapping windows across full content — counts how many tokens appear in each window
- Returns the highest-density window (most token hits), not just first occurrence
- Falls back to `content.slice(0, radius * 2)` if no tokens match
- Adds `…` ellipsis at truncation points

---

## Section 2 — API Changes (`posts.json.ts`)

**Problem:** `content: post.body` sends raw Markdown — potentially 50KB+ per post.

**Fix:**
- Import `cleanContent` from `src/utils/search.ts`
- Replace `content: post.body` with `excerpt: cleanContent(post.body || '').slice(0, 500)`
- Add `readingTime: Math.ceil(wordCount / 200)` computed from cleaned content word count
- No MDX-specific handling — Markdown + Obsidian syntax only

Field change: `content` → `excerpt` in API response shape.

---

## Section 3 — Fuse.js Config (search page)

Minor tuning only — current config is already well-structured:

```js
{
  keys: [
    { name: '_title',       weight: 0.45 },
    { name: '_tags',        weight: 0.30 },
    { name: '_description', weight: 0.15 },
    { name: '_excerpt',     weight: 0.07 },  // renamed from _content
    { name: '_category',    weight: 0.03 },
  ],
  threshold: 0.35,
  includeScore: true,
  minMatchCharLength: 2,   // raised from 1
  shouldSort: true,
  findAllMatches: true,
  ignoreLocation: true,
}
```

Tag search (`#prefix`) continues to bypass Fuse — exact substring match against `item.tags`. Correct and intentional.

---

## Section 4 — Filter/Sort Bar

**Visibility:** Appears below search input only after results are rendered. Hidden when input is cleared.

**Controls (left to right):**

1. **Tag chips** — multi-select, pulled from current result set only
2. **Category chips** — single-select, pulled from current result set only  
3. **Sort toggle** — `Relevance` (default, Fuse score order) | `Newest` (date descending)
4. **Date range** — two `<select>` dropdowns: From year / To year, populated from result set years

**Behavior:**
- All filters applied client-side over the full Fuse result set (no re-running search)
- Active filter count shown as a badge
- "Clear filters" link resets all four controls
- Filters persist while user refines query (cleared on new search)

---

## Section 5 — Result Cards

Each card in the left list shows:
- **Title** — with multi-word highlights
- **Category badge** — colored pill, shown if present
- **Tag chips** — up to 3, `#tag` style in highlight color
- **Date** — formatted `MMM YYYY`
- **Reading time** — `N min read`
- Selected state: left border accent (`border-l-highlight-500`) + subtle background

---

## Section 6 — Preview Pane (Desktop)

Right panel on `md+` screens:
- Post title (large, highlighted)
- Category + tags row
- Description in italic with left border accent
- Best-match excerpt with highlights and `…` indicators
- Reading time + approximate word count
- "Read post" CTA button

**Loading state:** 3 animated skeleton cards while Fuse.js initializes on first keystroke.

**No-results state:**
- Zero Fuse results: show query back, suggest fewer words or `#tag` search
- Filters reduce to zero: "No results match the active filters" + "Clear filters" link

---

## Section 7 — Mobile Bottom Sheet

On screens below `md` breakpoint:

- Tapping a result opens a bottom sheet (does not navigate immediately)
- Slides up from bottom, `80vh` height, rounded top corners (`rounded-t-2xl`)
- Semi-transparent backdrop (`bg-black/50 backdrop-blur-sm`)
- Contains identical content to desktop preview pane
- Scrollable internally
- Closed by: tapping backdrop | swipe-down gesture | `Escape` key
- "Read post" button navigates to the post
- Implemented as a `<div>` within `search.astro`, toggled via CSS class — no new component file

---

## Deleted

`src/components/SearchResults.astro` — dead code. Never imported by search page or command palette. Has leaked `command-palette-item` CSS class. Remove entirely.

---

## Out of Scope

- Command palette improvements (separate task)
- Projects search (no projects collection in use)
- MDX-specific handling (project moving away from MDX)
