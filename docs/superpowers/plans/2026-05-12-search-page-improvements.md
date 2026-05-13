# Search Page Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve `/search` with shared utilities, trimmed API payload, multi-word highlighting, best-window excerpts, rich result cards, filter/sort bar, mobile bottom sheet, and skeleton loading states.

**Architecture:** Extract shared pure functions (`cleanContent`, `highlight`, `excerptAround`, `escapeHtml`) into `src/utils/search.ts` consumed by both the API route (server-side) and the search page script (client-side via Vite bundling). The API route replaces raw `post.body` with a pre-cleaned 500-char excerpt plus a `readingTime` field. The search page is rewritten as a single complete replacement.

**Tech Stack:** Astro 6 · TypeScript · Fuse.js · Tailwind CSS 3 · Node built-in `node:test` · tsx (dev)

**Spec:** `docs/superpowers/specs/2026-05-12-search-page-improvements-design.md`

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/utils/search.ts` | `cleanContent`, `highlight`, `excerptAround`, `escapeHtml` |
| Create | `src/utils/search.test.ts` | Unit tests for the above |
| Modify | `src/pages/api/posts.json.ts` | Use `cleanContent`; emit `excerpt` + `readingTime` |
| Delete | `src/components/SearchResults.astro` | Dead code removal |
| Rewrite | `src/pages/search.astro` | Full rewrite — all new features |

---

## Task 1: Create `src/utils/search.ts` (test-first)

**Files:**
- Create: `src/utils/search.ts`
- Create: `src/utils/search.test.ts`

- [ ] **Step 1.1 — Install test runner**

```bash
pnpm add -D tsx
```

Expected: tsx appears in `package.json` devDependencies.

- [ ] **Step 1.2 — Write failing tests**

Create `src/utils/search.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanContent, highlight, excerptAround, escapeHtml } from './search.js';

// ── cleanContent ──────────────────────────────────────────────────────────

test('cleanContent - removes Obsidian image embeds', () => {
  assert.strictEqual(
    cleanContent('Before ![[image.png|caption|500]] after').trim(),
    'Before  after'.trim()
  );
});

test('cleanContent - unwraps wikilinks with alias', () => {
  assert.strictEqual(cleanContent('See [[My Page|this page]] here'), 'See this page here');
});

test('cleanContent - unwraps plain wikilinks', () => {
  assert.strictEqual(cleanContent('See [[My Page]] here'), 'See My Page here');
});

test('cleanContent - removes heading markers', () => {
  assert.strictEqual(cleanContent('## Section Title'), 'Section Title');
});

test('cleanContent - strips bold markers', () => {
  assert.strictEqual(cleanContent('This is **bold** text'), 'This is bold text');
});

test('cleanContent - strips code fences', () => {
  assert.strictEqual(
    cleanContent('Intro\n```\ncode here\n```\nOutro').replace(/\n+/g, '\n').trim(),
    'Intro\nOutro'
  );
});

test('cleanContent - strips Obsidian callouts', () => {
  const result = cleanContent('> [!NOTE] This is a callout\nNormal text');
  assert.ok(!result.includes('[!NOTE]'), 'Should remove callout marker');
});

// ── escapeHtml ────────────────────────────────────────────────────────────

test('escapeHtml - escapes all four HTML entities', () => {
  assert.strictEqual(escapeHtml('<b class="x">&amp;</b>'), '&lt;b class=&quot;x&quot;&gt;&amp;amp;&lt;/b&gt;');
});

// ── highlight ─────────────────────────────────────────────────────────────

test('highlight - wraps single token in mark', () => {
  const result = highlight('Hello World', 'world');
  assert.ok(result.includes('<mark'), 'Expected <mark> tag');
  assert.ok(result.includes('World'), 'Expected original casing');
});

test('highlight - wraps multiple tokens separately', () => {
  const result = highlight('The quick brown fox', 'quick fox');
  const markCount = (result.match(/<mark/g) || []).length;
  assert.strictEqual(markCount, 2);
});

test('highlight - escapes HTML before marking (XSS safe)', () => {
  const result = highlight('<script>alert(1)</script>', 'script');
  assert.ok(!result.includes('<script>'), 'Must not contain raw <script>');
  assert.ok(result.includes('&lt;'), 'Must contain escaped <');
});

test('highlight - strips # prefix for tag searches', () => {
  const result = highlight('typescript tutorial', '#typescript');
  assert.ok(result.includes('<mark'), 'Should highlight token without #');
});

test('highlight - returns escaped text unchanged when no query', () => {
  assert.strictEqual(highlight('Hello & World', ''), 'Hello &amp; World');
});

// ── excerptAround ─────────────────────────────────────────────────────────

test('excerptAround - returns window containing query token', () => {
  const filler = 'word '.repeat(100);
  const content = filler + 'uniquetoken ' + filler;
  const { text } = excerptAround(content, 'uniquetoken', 80);
  assert.ok(text.includes('uniquetoken'));
});

test('excerptAround - falls back to start of content on no match', () => {
  const { text } = excerptAround('Hello world this is content', 'zzznomatch', 80);
  assert.ok(text.startsWith('Hello'));
});

test('excerptAround - truncated is true when content exceeds window', () => {
  const { truncated } = excerptAround('word '.repeat(500), 'word', 80);
  assert.strictEqual(truncated, true);
});

test('excerptAround - truncated is false for short content', () => {
  const { truncated } = excerptAround('Short text', 'text', 80);
  assert.strictEqual(truncated, false);
});

test('excerptAround - picks highest-density window for multi-token query', () => {
  const filler = 'irrelevant '.repeat(60);
  const dense = 'alpha beta gamma ';
  const content = filler + dense + filler;
  const { text } = excerptAround(content, 'alpha beta gamma', 80);
  assert.ok(text.includes('alpha') || text.includes('beta') || text.includes('gamma'));
});
```

- [ ] **Step 1.3 — Run tests and confirm they fail**

```bash
node --import tsx/esm --test src/utils/search.test.ts
```

Expected: all tests fail with `Cannot find module './search.js'` or similar.

- [ ] **Step 1.4 — Implement `src/utils/search.ts`**

Create `src/utils/search.ts`:

```typescript
/**
 * Strips Markdown and Obsidian syntax, returning plain text for search indexing.
 * Used server-side in posts.json.ts and client-side in search.astro (via Vite bundle).
 */
export function cleanContent(raw: string): string {
  return raw
    .replace(/^---[\s\S]*?---\n?/, '')
    .replace(/!\[\[[^\]]*\]\]/g, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/^>\s?\[!\w+\][^\n]*/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * HTML-escapes a string. Safe for use with innerHTML.
 */
export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * HTML-escapes text and wraps each query token in <mark> tags.
 * Handles multi-word queries and #tag prefix. Safe for innerHTML.
 */
export function highlight(text: string, query: string): string {
  if (!text) return '';
  const escaped = escapeHtml(text);
  if (!query) return escaped;
  const q = query.startsWith('#') ? query.slice(1) : query;
  if (!q.trim()) return escaped;
  const tokens = q.trim().split(/\s+/).filter(Boolean);
  return tokens.reduce((html, token) => {
    const safeToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return html.replace(
      new RegExp(`(${safeToken})`, 'gi'),
      '<mark class="bg-highlight-300/40 dark:bg-highlight-500/30 rounded px-0.5 not-italic font-semibold">$1</mark>'
    );
  }, escaped);
}

/**
 * Returns the highest query-token-density window from pre-cleaned content.
 * content must already be plain text (pass through cleanContent first if raw markdown).
 */
export function excerptAround(
  content: string,
  query: string,
  radius = 160
): { text: string; truncated: boolean } {
  if (!content) return { text: '', truncated: false };

  const windowSize = radius * 2;
  const q = query.startsWith('#') ? query.slice(1) : query;
  const tokens = q.trim().split(/\s+/).filter(t => t.length > 0).map(t => t.toLowerCase());

  if (tokens.length === 0 || content.length <= windowSize) {
    return { text: content.slice(0, windowSize), truncated: content.length > windowSize };
  }

  const lower = content.toLowerCase();
  let bestStart = 0;
  let bestScore = 0;
  const step = 20;

  for (let i = 0; i <= lower.length - windowSize; i += step) {
    const window = lower.slice(i, i + windowSize);
    const score = tokens.reduce((n, t) => n + (window.includes(t) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestStart = i;
    }
  }

  if (bestScore === 0) {
    return { text: content.slice(0, windowSize), truncated: true };
  }

  const end = Math.min(content.length, bestStart + windowSize);
  return {
    text: (bestStart > 0 ? '…' : '') + content.slice(bestStart, end) + (end < content.length ? '…' : ''),
    truncated: content.length > windowSize,
  };
}
```

- [ ] **Step 1.5 — Run tests and confirm they pass**

```bash
node --import tsx/esm --test src/utils/search.test.ts
```

Expected output: all tests show `✓` / `pass`. Zero failures.

- [ ] **Step 1.6 — Commit**

```bash
git add src/utils/search.ts src/utils/search.test.ts package.json pnpm-lock.yaml
git commit -m "feat: add shared search utilities (cleanContent, highlight, excerptAround)"
```

---

## Task 2: Update `src/pages/api/posts.json.ts`

**Files:**
- Modify: `src/pages/api/posts.json.ts`

- [ ] **Step 2.1 — Replace file contents**

Replace `src/pages/api/posts.json.ts` with:

```typescript
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { shouldShowPost } from "@/utils/markdown";
import { cleanContent } from "@/utils/search";

export const GET: APIRoute = async () => {
  try {
    const posts = await getCollection("posts");
    const isDev = import.meta.env.DEV;
    const visiblePosts = posts.filter((post: any) => shouldShowPost(post, isDev));

    const data = visiblePosts.map((post: any) => {
      const cleaned = cleanContent(post.body || '');
      const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
      return {
        id: post.id,
        title: post.data.title,
        description: post.data.description,
        url: `${import.meta.env.BASE_URL}posts/${post.id}`,
        type: "post" as const,
        date: post.data.date,
        tags: post.data.tags || [],
        category: post.data.category || null,
        excerpt: cleaned.slice(0, 500),
        readingTime: Math.max(1, Math.ceil(wordCount / 200)),
      };
    });

    data.sort(
      (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Failed to fetch posts" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
```

- [ ] **Step 2.2 — Verify API response**

```bash
pnpm dev
```

Open `http://localhost:5000/api/posts.json` in the browser.

Expected: each post object has `excerpt` (plain text, ≤500 chars), `readingTime` (positive integer), NO `content` field.

- [ ] **Step 2.3 — Commit**

```bash
git add src/pages/api/posts.json.ts
git commit -m "feat: trim API payload — serve excerpt+readingTime instead of raw body"
```

---

## Task 3: Delete dead component

**Files:**
- Delete: `src/components/SearchResults.astro`

- [ ] **Step 3.1 — Delete the file**

```bash
git rm src/components/SearchResults.astro
```

- [ ] **Step 3.2 — Verify no imports remain**

```bash
grep -r "SearchResults" src/
```

Expected: no output (zero matches).

- [ ] **Step 3.3 — Commit**

```bash
git commit -m "chore: remove unused SearchResults component"
```

---

## Task 4: Rewrite `src/pages/search.astro`

**Files:**
- Rewrite: `src/pages/search.astro`

This is a complete file replacement. Write it in sub-steps but commit once at the end.

- [ ] **Step 4.1 — Replace `src/pages/search.astro` with the full new version**

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
import Icon from '@/components/Icon.astro';
import { siteConfig } from '@/config';

const query = Astro.url.searchParams.get('q') || '';
const pageTitle = query ? `Search: "${query}"` : 'Search';

const seoData = {
  title: `${pageTitle} | ${siteConfig.title}`,
  description: 'Search all posts and content',
  canonical: Astro.url.href,
  ogType: 'website' as const,
};
---

<BaseLayout seoData={seoData}>
  <div class="max-w-5xl mx-auto">

    <!-- Search input -->
    <div class="mb-4">
      <form id="search-form" action={`${import.meta.env.BASE_URL}search`} method="get">
        <div class="flex items-center gap-3 px-4 py-3 rounded-xl border border-primary-300 dark:border-primary-600 bg-white dark:bg-primary-800 focus-within:border-highlight-400 dark:focus-within:border-highlight-500 focus-within:ring-2 focus-within:ring-highlight-500/20 transition-all duration-200 shadow-sm">
          <Icon name="search" class="w-4 h-4 shrink-0 text-primary-400 dark:text-primary-500" />
          <input
            type="text"
            name="q"
            id="search-query"
            value={query}
            placeholder="Search posts, tags… (prefix # to filter by tag)"
            autocomplete="off"
            autofocus
            class="flex-1 bg-transparent outline-none text-primary-900 dark:text-primary-50 placeholder-primary-400 dark:placeholder-primary-500 text-base"
          />
          <button
            id="search-clear"
            type="button"
            aria-label="Clear search"
            class="hidden p-1 rounded text-primary-400 hover:text-primary-600 dark:hover:text-primary-200 transition-colors"
          >
            <Icon name="x" class="w-4 h-4" />
          </button>
        </div>
      </form>
      <p id="search-status" class="text-sm text-primary-500 dark:text-primary-400 mt-2 hidden"></p>
    </div>

    <!-- Filter bar (populated by JS after first search) -->
    <div id="filter-bar" class="hidden mb-4"></div>

    <!-- Split pane -->
    <div id="search-pane" class="hidden rounded-xl border border-primary-200 dark:border-primary-700 overflow-hidden" style="height: 68vh; min-height: 400px;">
      <div class="flex h-full">
        <!-- Results list -->
        <div id="search-results" class="w-full md:w-72 md:min-w-[18rem] overflow-y-auto border-r border-primary-200 dark:border-primary-700 bg-white dark:bg-primary-900 flex-shrink-0"></div>
        <!-- Preview pane (desktop) -->
        <div class="hidden md:flex flex-1 flex-col overflow-hidden bg-white dark:bg-primary-900">
          <div id="preview-content" class="flex-1 overflow-y-auto p-6">
            <p class="text-primary-400 dark:text-primary-500 text-center mt-20 text-sm">Select a result to preview</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty / pre-search state -->
    <div id="search-empty" class="text-center py-20 text-primary-400 dark:text-primary-500">
      <Icon name="search" class="w-10 h-10 mx-auto mb-3 opacity-25" />
      <p class="text-sm font-medium mb-1">Search across all posts</p>
      <p class="text-xs opacity-75">
        Use
        <kbd class="mx-1 px-1.5 py-0.5 bg-primary-100 dark:bg-primary-800 rounded border border-primary-200 dark:border-primary-700 font-mono text-xs">#tag</kbd>
        to filter by tag
      </p>
    </div>

  </div>
</BaseLayout>

<!-- Mobile bottom sheet (full-width, outside max-w container) -->
<div id="mobile-sheet-backdrop"
     class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm hidden md:hidden"
     aria-hidden="true"></div>
<div id="mobile-sheet"
     class="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-white dark:bg-primary-900 shadow-2xl border-t border-primary-200 dark:border-primary-700 transition-transform duration-300 ease-out translate-y-full md:hidden"
     style="max-height: 80vh;"
     role="dialog"
     aria-modal="true"
     aria-label="Post preview">
  <div class="relative flex items-center justify-between px-5 pt-5 pb-3 border-b border-primary-200 dark:border-primary-700">
    <div class="absolute left-1/2 -translate-x-1/2 top-2 w-10 h-1 rounded-full bg-primary-300 dark:bg-primary-600"></div>
    <span class="text-sm font-medium text-primary-900 dark:text-primary-50">Preview</span>
    <button id="mobile-sheet-close"
            class="p-1 rounded text-primary-400 hover:text-primary-600 dark:hover:text-primary-200 transition-colors"
            aria-label="Close preview">
      <Icon name="x" class="w-4 h-4" />
    </button>
  </div>
  <div id="mobile-sheet-content" class="overflow-y-auto p-5" style="max-height: calc(80vh - 57px);"></div>
</div>

<script>
  import { highlight, excerptAround, escapeHtml } from '@/utils/search';

  // ── SVG path strings (hardcoded — define:vars breaks dynamic import) ──────
  const svgPaths = {
    arrowRight:    `<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>`,
    externalLink:  `<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>`,
    folder:        `<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>`,
    tag:           `<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>`,
    fileText:      `<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>`,
    triangleAlert: `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="m12 17 .01 0"/>`,
    calendar:      `<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>`,
    clock:         `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
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

  // ── Per-page-view state ───────────────────────────────────────────────────
  let fuse: any = null;
  let fuseItems: any[] = [];

  // ── Filter state (reset on new search) ───────────────────────────────────
  let allResults: any[] = [];
  let activeTagFilters = new Set<string>();
  let activeCategoryFilter: string | null = null;
  let sortMode: 'relevance' | 'newest' = 'relevance';
  let filterFromYear: number | null = null;
  let filterToYear: number | null = null;

  function initSearch() {
    const queryInput    = document.getElementById('search-query') as HTMLInputElement | null;
    const resultsEl     = document.getElementById('search-results');
    const statusEl      = document.getElementById('search-status');
    const paneEl        = document.getElementById('search-pane');
    const emptyEl       = document.getElementById('search-empty');
    const previewEl     = document.getElementById('preview-content');
    const clearBtn      = document.getElementById('search-clear');
    const form          = document.getElementById('search-form');
    const filterBar     = document.getElementById('filter-bar');
    const mobileSheet   = document.getElementById('mobile-sheet');
    const mobileBackdrop = document.getElementById('mobile-sheet-backdrop');
    const mobileClose   = document.getElementById('mobile-sheet-close');
    const mobileContent = document.getElementById('mobile-sheet-content');

    if (!queryInput || !resultsEl || !statusEl || !paneEl || !emptyEl) return;

    let debounceTimer: number;
    let selectedIndex = 0;
    let currentItems: any[] = [];
    let currentQuery = '';

    // ── Fuse init ───────────────────────────────────────────────────────────
    async function ensureFuse() {
      if (fuse) return true;
      try {
        const [fuseModule, postsRes] = await Promise.all([
          import('fuse.js'),
          fetch(`${import.meta.env.BASE_URL}api/posts.json`).then(r => r.ok ? r.json() : []),
        ]);
        const Fuse = fuseModule.default || fuseModule;
        fuseItems = postsRes;
        const normalized = fuseItems.map((item: any, idx: number) => ({
          _idx: idx,
          _title:       norm(item.title),
          _description: norm(item.description || ''),
          _excerpt:     norm(item.excerpt || ''),
          _tags:        (item.tags || []).map(norm),
          _category:    norm(item.category || ''),
        }));
        fuse = new Fuse(normalized, {
          keys: [
            { name: '_title',       weight: 0.45 },
            { name: '_tags',        weight: 0.30 },
            { name: '_description', weight: 0.15 },
            { name: '_excerpt',     weight: 0.07 },
            { name: '_category',    weight: 0.03 },
          ],
          threshold: 0.35,
          includeScore: true,
          minMatchCharLength: 2,
          shouldSort: true,
          findAllMatches: true,
          ignoreLocation: true,
        });
        return true;
      } catch {
        return false;
      }
    }

    // ── Filter & sort ───────────────────────────────────────────────────────
    function applyFilters() {
      let filtered = [...allResults];

      if (activeTagFilters.size > 0) {
        filtered = filtered.filter(item =>
          [...activeTagFilters].every(tag =>
            (item.tags || []).some((t: string) => norm(t) === norm(tag))
          )
        );
      }
      if (activeCategoryFilter) {
        filtered = filtered.filter(item =>
          norm(item.category || '') === norm(activeCategoryFilter!)
        );
      }
      if (filterFromYear !== null) {
        filtered = filtered.filter(item =>
          item.date && new Date(item.date).getFullYear() >= filterFromYear!
        );
      }
      if (filterToYear !== null) {
        filtered = filtered.filter(item =>
          item.date && new Date(item.date).getFullYear() <= filterToYear!
        );
      }
      if (sortMode === 'newest') {
        filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
        return;
      }

      const activeCount =
        activeTagFilters.size +
        (activeCategoryFilter ? 1 : 0) +
        (filterFromYear !== null || filterToYear !== null ? 1 : 0) +
        (sortMode !== 'relevance' ? 1 : 0);

      const chipBase   = 'text-xs px-2 py-0.5 rounded border transition-colors cursor-pointer';
      const chipOff    = 'border-primary-300 dark:border-primary-600 text-primary-600 dark:text-primary-300 hover:border-highlight-400 hover:text-highlight-600 dark:hover:text-highlight-400 bg-white dark:bg-primary-900';
      const chipOnTag  = 'bg-highlight-500 border-highlight-500 text-white';
      const chipOnCat  = 'bg-primary-700 dark:bg-primary-200 border-primary-700 dark:border-primary-200 text-white dark:text-primary-900';
      const chipOnSort = 'bg-primary-700 dark:bg-primary-200 border-primary-700 dark:border-primary-200 text-white dark:text-primary-900';

      const tagsHtml = tags.length > 0 ? `
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-xs text-primary-500 dark:text-primary-400 font-medium whitespace-nowrap">Tags:</span>
          ${tags.map(tag => {
            const on = activeTagFilters.has(tag);
            return `<button data-filter-tag="${escapeHtml(tag)}" class="${chipBase} rounded-full ${on ? chipOnTag : chipOff}">#${escapeHtml(tag)}</button>`;
          }).join('')}
        </div>` : '';

      const catsHtml = categories.length > 0 ? `
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-xs text-primary-500 dark:text-primary-400 font-medium whitespace-nowrap">Category:</span>
          ${categories.map(cat => {
            const on = activeCategoryFilter === cat;
            return `<button data-filter-category="${escapeHtml(cat)}" class="${chipBase} rounded-md ${on ? chipOnCat : chipOff}">${escapeHtml(cat)}</button>`;
          }).join('')}
        </div>` : '';

      const sortHtml = `
        <div class="flex items-center gap-1.5">
          <span class="text-xs text-primary-500 dark:text-primary-400 font-medium whitespace-nowrap">Sort:</span>
          ${(['relevance', 'newest'] as const).map(mode => {
            const on = sortMode === mode;
            const label = mode === 'relevance' ? 'Relevance' : 'Newest';
            return `<button data-sort="${mode}" class="${chipBase} ${on ? chipOnSort : chipOff}">${label}</button>`;
          }).join('')}
        </div>`;

      const selectCls = 'text-xs px-2 py-0.5 rounded border border-primary-300 dark:border-primary-600 bg-white dark:bg-primary-800 text-primary-700 dark:text-primary-300 focus:outline-none focus:border-highlight-400';
      const dateHtml = years.length > 1 ? `
        <div class="flex items-center gap-1.5">
          <span class="text-xs text-primary-500 dark:text-primary-400 font-medium whitespace-nowrap">Year:</span>
          <select id="filter-from-year" class="${selectCls}">
            <option value="">From</option>
            ${years.map(y => `<option value="${y}" ${filterFromYear === y ? 'selected' : ''}>${y}</option>`).join('')}
          </select>
          <span class="text-xs text-primary-400">–</span>
          <select id="filter-to-year" class="${selectCls}">
            <option value="">To</option>
            ${years.map(y => `<option value="${y}" ${filterToYear === y ? 'selected' : ''}>${y}</option>`).join('')}
          </select>
        </div>` : '';

      const clearHtml = activeCount > 0
        ? `<button id="filter-clear-btn" class="text-xs text-primary-500 hover:text-primary-700 dark:hover:text-primary-300 underline transition-colors whitespace-nowrap ml-auto">Clear ${activeCount} filter${activeCount !== 1 ? 's' : ''}</button>`
        : '';

      filterBar.innerHTML = `
        <div class="flex flex-wrap items-start gap-3 p-3 rounded-xl bg-primary-50 dark:bg-primary-800/50 border border-primary-200 dark:border-primary-700">
          ${tagsHtml}${catsHtml}${sortHtml}${dateHtml}${clearHtml}
        </div>`;
      filterBar.classList.remove('hidden');

      filterBar.querySelectorAll<HTMLButtonElement>('[data-filter-tag]').forEach(btn => {
        btn.addEventListener('click', () => {
          const tag = btn.getAttribute('data-filter-tag')!;
          activeTagFilters.has(tag) ? activeTagFilters.delete(tag) : activeTagFilters.add(tag);
          buildFilterBar(allResults);
          applyFilters();
        });
      });

      filterBar.querySelectorAll<HTMLButtonElement>('[data-filter-category]').forEach(btn => {
        btn.addEventListener('click', () => {
          const cat = btn.getAttribute('data-filter-category')!;
          activeCategoryFilter = activeCategoryFilter === cat ? null : cat;
          buildFilterBar(allResults);
          applyFilters();
        });
      });

      filterBar.querySelectorAll<HTMLButtonElement>('[data-sort]').forEach(btn => {
        btn.addEventListener('click', () => {
          sortMode = btn.getAttribute('data-sort') as 'relevance' | 'newest';
          buildFilterBar(allResults);
          applyFilters();
        });
      });

      const fromSel = filterBar.querySelector<HTMLSelectElement>('#filter-from-year');
      const toSel   = filterBar.querySelector<HTMLSelectElement>('#filter-to-year');
      fromSel?.addEventListener('change', () => {
        filterFromYear = fromSel.value ? parseInt(fromSel.value) : null;
        applyFilters();
      });
      toSel?.addEventListener('change', () => {
        filterToYear = toSel.value ? parseInt(toSel.value) : null;
        applyFilters();
      });

      filterBar.querySelector<HTMLButtonElement>('#filter-clear-btn')?.addEventListener('click', () => {
        activeTagFilters.clear();
        activeCategoryFilter = null;
        sortMode = 'relevance';
        filterFromYear = null;
        filterToYear = null;
        buildFilterBar(allResults);
        applyFilters();
      });
    }

    // ── Skeleton loading ────────────────────────────────────────────────────
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

    // ── Result card ─────────────────────────────────────────────────────────
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
            ${svg(svgPaths.clock, 10, 'opacity-70')}${item.readingTime} min read
          </span>`
        : '';

      return `
        <a href="${escapeHtml(item.url)}"
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
                ? `<div class="mt-1 flex items-center gap-2">${datePart}${timePart}</div>`
                : ''}
            </div>
          </div>
        </a>`;
    }

    // ── Preview pane content ────────────────────────────────────────────────
    function buildPreviewHtml(item: any, rawQuery: string) {
      const { text: excerpt, truncated } = excerptAround(
        item.excerpt || item.description || '', rawQuery
      );

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
            ${item.date    ? `<span class="flex items-center gap-1">${svg(svgPaths.calendar, 11)}${formatDate(item.date)}</span>` : ''}
            ${item.readingTime ? `<span class="flex items-center gap-1">${svg(svgPaths.clock, 11)}${item.readingTime} min read</span>` : ''}
          </div>`
        : '';

      const truncationWarning = truncated
        ? `<div class="flex items-start gap-2 mt-4 px-3 py-2 rounded-lg bg-primary-50 dark:bg-primary-800/50 border border-primary-200 dark:border-primary-700 text-xs text-primary-500 dark:text-primary-400">
            ${svg(svgPaths.triangleAlert, 13, 'mt-0.5 text-primary-400 shrink-0')}
            <span>Preview truncated — open the post to read full content.</span>
          </div>`
        : '';

      return `
        <div class="flex items-start justify-between gap-3 mb-2">
          <h2 class="text-lg font-semibold text-primary-900 dark:text-primary-50 leading-snug">${highlight(item.title, rawQuery)}</h2>
          <a href="${escapeHtml(item.url)}" title="Open post"
             class="shrink-0 p-1.5 rounded-lg text-primary-400 hover:text-highlight-600 dark:hover:text-highlight-400 hover:bg-primary-100 dark:hover:bg-primary-800 transition-colors"
             aria-label="Open post">${svg(svgPaths.externalLink, 15)}</a>
        </div>
        ${metaHtml}
        ${categoryHtml || tagsHtml
          ? `<div class="flex flex-wrap items-center gap-2 mb-4">${categoryHtml}${tagsHtml}</div>`
          : ''}
        ${item.description
          ? `<p class="text-sm text-primary-500 dark:text-primary-400 mb-4 leading-relaxed border-l-2 border-primary-200 dark:border-primary-700 pl-3 italic">${highlight(item.description, rawQuery)}</p>`
          : ''}
        ${excerpt
          ? `<p class="text-sm leading-relaxed text-primary-700 dark:text-primary-300">${highlight(excerpt, rawQuery)}</p>`
          : ''}
        ${truncationWarning}
        <a href="${escapeHtml(item.url)}"
           class="inline-flex items-center gap-2 mt-6 px-4 py-2 rounded-lg bg-highlight-500 hover:bg-highlight-600 text-white text-sm font-medium transition-colors">
          Read post ${svg(svgPaths.arrowRight, 14, 'text-white')}
        </a>`;
    }

    function renderPreview(item: any, rawQuery: string) {
      if (!previewEl) return;
      previewEl.innerHTML = buildPreviewHtml(item, rawQuery);
    }

    // ── Results list ────────────────────────────────────────────────────────
    function renderResults(items: any[], rawQuery: string) {
      currentItems = items;
      currentQuery = rawQuery;
      selectedIndex = 0;

      if (items.length === 0) {
        const isFiltered =
          activeTagFilters.size > 0 || activeCategoryFilter ||
          filterFromYear !== null || filterToYear !== null;
        paneEl!.classList.add('hidden');
        emptyEl!.classList.remove('hidden');
        statusEl!.textContent = isFiltered
          ? 'No results match the active filters.'
          : `No results for "${rawQuery}". Try fewer words or a #tag search.`;
        statusEl!.classList.remove('hidden');
        return;
      }

      statusEl!.textContent = `${items.length} result${items.length === 1 ? '' : 's'}`;
      statusEl!.classList.remove('hidden');
      paneEl!.classList.remove('hidden');
      emptyEl!.classList.add('hidden');

      resultsEl!.innerHTML = items.map((item, i) => renderResultItem(item, i, rawQuery)).join('');

      resultsEl!.querySelectorAll<HTMLAnchorElement>('.result-item').forEach((el, i) => {
        el.addEventListener('mouseenter', () => {
          if (!window.matchMedia('(max-width: 767px)').matches) setSelected(i);
        });
        el.addEventListener('click', (e) => {
          if (window.matchMedia('(max-width: 767px)').matches) {
            e.preventDefault();
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

    // ── Mobile bottom sheet ─────────────────────────────────────────────────
    function openMobileSheet(item: any, rawQuery: string) {
      if (!mobileSheet || !mobileBackdrop || !mobileContent) return;
      mobileContent.innerHTML = buildPreviewHtml(item, rawQuery);
      mobileBackdrop.classList.remove('hidden');
      mobileSheet.classList.remove('translate-y-full');
      document.body.style.overflow = 'hidden';
    }

    function closeMobileSheet() {
      if (!mobileSheet || !mobileBackdrop) return;
      mobileSheet.classList.add('translate-y-full');
      setTimeout(() => {
        mobileBackdrop.classList.add('hidden');
        document.body.style.overflow = '';
      }, 300);
    }

    mobileClose?.addEventListener('click', closeMobileSheet);
    mobileBackdrop?.addEventListener('click', closeMobileSheet);

    if (mobileSheet) {
      let touchStartY = 0;
      mobileSheet.addEventListener('touchstart', e => {
        touchStartY = e.touches[0].clientY;
      }, { passive: true });
      mobileSheet.addEventListener('touchend', e => {
        if (e.changedTouches[0].clientY - touchStartY > 80) closeMobileSheet();
      }, { passive: true });
    }

    // ── Main search ─────────────────────────────────────────────────────────
    async function doSearch(rawQuery: string) {
      clearBtn?.classList.toggle('hidden', !rawQuery);

      if (!rawQuery.trim()) {
        paneEl!.classList.add('hidden');
        emptyEl!.classList.remove('hidden');
        statusEl!.classList.add('hidden');
        if (filterBar) { filterBar.classList.add('hidden'); filterBar.innerHTML = ''; }
        activeTagFilters.clear();
        activeCategoryFilter = null;
        sortMode = 'relevance';
        filterFromYear = null;
        filterToYear = null;
        return;
      }

      renderSkeletons();

      const ok = await ensureFuse();
      if (!ok) {
        statusEl!.textContent = 'Search unavailable — please reload.';
        statusEl!.classList.remove('hidden');
        paneEl!.classList.add('hidden');
        return;
      }

      if (rawQuery.startsWith('#')) {
        const tagQ = norm(rawQuery.slice(1));
        allResults = tagQ
          ? fuseItems.filter((item: any) => (item.tags || []).some((t: string) => norm(t).includes(tagQ)))
          : [];
      } else {
        allResults = fuse.search(norm(rawQuery)).slice(0, 50).map((r: any) => fuseItems[r.item._idx]);
      }

      buildFilterBar(allResults);
      applyFilters();
    }

    // ── Keyboard navigation ─────────────────────────────────────────────────
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
      doSearch(initialQuery);
    }
  }

  initSearch();
  document.addEventListener('page:view', initSearch);
</script>

<style>
  mark { background-color: transparent; }
</style>
```

- [ ] **Step 4.2 — Start dev server and verify**

```bash
pnpm dev
```

Open `http://localhost:5000/search` and check:

1. Typing a query shows skeleton cards briefly, then results with title/category/tags/date/reading time
2. Multi-word query (e.g., `astro blog`) highlights each word separately in results and preview
3. `#tag` search filters by tag correctly
4. Filter bar appears after results render; tag chips, category chips, sort toggle, date selects all work
5. Clicking "Clear N filters" resets all filters
6. Desktop preview pane updates on hover/arrow-key selection; shows meta, excerpt, CTA
7. On mobile viewport (DevTools → toggle mobile): tapping a result opens bottom sheet; backdrop/swipe-down/✕ close it
8. Clearing the input hides filter bar and returns to empty state
9. `?q=someterm` in URL auto-searches on page load

- [ ] **Step 4.3 — Commit**

```bash
git add src/pages/search.astro
git commit -m "feat: rewrite search page — filters, rich cards, mobile sheet, skeletons"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] `src/utils/search.ts` with `cleanContent`, `highlight`, `excerptAround`, `escapeHtml` → Task 1
- [x] `posts.json.ts` sends `excerpt` (≤500 chars cleaned) + `readingTime` → Task 2
- [x] `SearchResults.astro` deleted → Task 3
- [x] Fuse config: `minMatchCharLength: 2`, `_excerpt` key, `ignoreLocation`, `findAllMatches` → Task 4 Step 4.1
- [x] Multi-word `highlight` (token split) → `src/utils/search.ts`
- [x] Best-window `excerptAround` (density scoring) → `src/utils/search.ts`
- [x] Filter bar with tags (multi), category (single), sort toggle, date range → Task 4
- [x] Rich result cards (date, readingTime, category badge, tag chips) → Task 4
- [x] Preview pane (meta row, category, tags, excerpt with highlights, CTA) → Task 4
- [x] Skeleton loading (3 animated cards while Fuse inits) → Task 4
- [x] No-results state: query feedback + filter-aware message → Task 4
- [x] Mobile bottom sheet (slide-up, backdrop, swipe-down, Escape) → Task 4
- [x] Swup re-init on `page:view` → Task 4

**No placeholders:** none found.

**Type consistency:** `highlight`, `excerptAround`, `escapeHtml` defined in Task 1 used exactly by that name in Task 4.
