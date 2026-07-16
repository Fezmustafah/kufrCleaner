# Build-Time Reduction & Deepening — Design Spec

**Date:** 2026-07-15
**Status:** Approved (design), pending implementation plan
**Author:** architecture review → brainstorming (Approach B, one coordinated pass)
**Executor:** intended for hand-off to the most capable model (Opus / Fable)

---

## Goal

Reduce OpenIslam Wiki's production build time and, in the same pass, deepen four
shallow areas behind small, testable interfaces. The headline win is algorithmic:
eliminate an O(N²) full-corpus rescan that runs during post-page rendering. The
supporting work removes duplicated build-script logic, gates off an unused feature,
and consolidates the search runtime — improving locality and testability without
changing any user-visible behavior.

**Primary success metric:** measured reduction in `pnpm build` wall-clock, proven
by a per-phase baseline captured before any change and re-measured after.

**Secondary metrics:** fewer exports across the internal-link module; the orphaned
search test running in CI; zero behavioral regressions in linked mentions, internal
link resolution, or search results.

---

## Context

- Astro **6.1.2**, TypeScript, pnpm, deployed to Cloudflare Workers. Corpus is
  ~1,300 posts (submodule `src/content/`).
- This spec deliberately **excludes** the Reading Deck (just modularized under
  `ADR-0001`) and `BaseLayout.astro`'s client lifecycle (a runtime concern with
  zero build-time impact — held for a later round).
- The Reading Deck modularization
  (`docs/superpowers/plans/2026-07-14-reading-deck-modularization.md`) is the
  precedent for module shape, TDD discipline, and commit cadence. Reuse that shape.

### Load-bearing constraints (from CLAUDE.md / AGENTS.md — do not violate)

1. **`entry.id`, never `entry.slug`** (slug removed in Astro v6).
2. **Never edit `src/content/**`** — it is a git submodule. `.base` files live there
   and must not be moved or deleted.
3. **Plugin order is load-bearing.** `remarkCitations` runs first,
   `rehypeNormalizeAnchors` runs last. This work must **not reorder** the pipeline.
   The internal-link seam is internal to the module; its registration position in
   `astro.config.mjs` (`[remarkInternalLinks, { base: '/' }]`, currently step 3)
   stays put.
4. **No `console.log()` in production** — gate behind `import.meta.env.DEV`; build
   scripts gate behind `process.env.NODE_ENV !== 'production'`.
5. **`[CONFIG:KEY]` markers in `src/config.ts` are sacred** — any new config value
   (the Bases flag) must carry its own `// [CONFIG:KEY]` marker comment.
6. **The production CSP is hardcoded in `scripts/generate-deployment-config.js`**
   (the `CSP` constant), NOT in `astro.config.mjs`. When that script is split, the
   CSP string must survive byte-identical.
7. **`devToolbar.enabled: true`** stays.
8. Never edit vendored `src/graph/components/graph/pixi/pixi.js` / `pixi.d.ts`
   (not touched by this work, noted for safety).

---

## Workstream 1 — Backlink index + internal-link compiler *(build-time headline)*

### Problem

`src/components/LinkedMentions.astro:15` runs on every post page:

```ts
const linkedMentions = findLinkedMentions(posts, currentSlug, posts, pages);
```

`findLinkedMentions` filters all posts, and for each candidate re-runs
`extractWikilinks(post.body)` + `extractStandardLinks(post.body)` (regex scans of
full markdown bodies) to decide whether it links back to `currentSlug`. With N
posts rendered and N bodies scanned per render, this is **O(N²)** body-regex scans
per build (~1.3k² ≈ 1.7M full-body scans). It is the dominant algorithmic cost in
page rendering.

`src/utils/internallinks.ts` is also the shallowest module in the repo: 1,850 lines,
31 exports, and `remarkStandardLinks` at **cognitive complexity 300** (highest in the
codebase by 3×), carrying three redundant in-place `/index`-stripping patches and
dead branches for `projects/` and `docs/` collections that do not exist in this fork.

### Solution — the build-time fix (a deep module, tiny interface)

New module `src/utils/backlink-index.ts`:

```ts
export interface LinkedMention {
  slug: string;
  title: string;
  excerpt?: string; // may be computed lazily; see below
}

export interface BacklinkIndex {
  mentionsOf(slug: string): LinkedMention[];
}

// Built ONCE per build. Inverts every post's outgoing links into a
// target-slug -> [mentions] map. O(N) over the corpus.
export function buildBacklinkIndex(
  posts: Post[],
  pages: Post[],
): BacklinkIndex;

// Memoized accessor: builds on first call, returns the same index for the
// rest of the build. Keyed on the posts collection identity/length so a
// content change between dev reloads rebuilds it.
export function getBacklinkIndex(posts: Post[], pages: Post[]): BacklinkIndex;
```

- `LinkedMentions.astro` calls `getBacklinkIndex(posts, pages).mentionsOf(currentSlug)`
  instead of `findLinkedMentions(...)`. The inversion runs once; each page does a
  map lookup.
- **Memoization is the crux.** Astro renders each page independently, so the index
  must be a module-level singleton built on first access and reused. Without
  memoization the inversion would run per page and re-introduce O(N²). The plan must
  assert (via a test with a spy/counter) that a full render pass builds the index
  exactly once.
- **Excerpts:** the per-edge excerpt (`extractExcerptAtPosition`, cognitive-96) is
  bounded by the number of actual backlinks, not N. Generate excerpts per edge (once),
  either eagerly during index build or lazily on first `mentionsOf`. Either is O(edges).
- **Behavior preservation:** `mentionsOf(slug)` must return the same mentions, in the
  same order, with the same titles, as the current `findLinkedMentions` for the same
  corpus. Characterize the current output first (golden test on a sample), then make
  the index match it. `findLinkedMentions` may remain as a thin adapter over the index
  or be removed once all call sites migrate (only `LinkedMentions.astro` calls it).

### Solution — the deepening (same pass)

Collapse `internallinks.ts` behind a thin `remarkInternalLinks()` seam over focused
internal modules. Suggested split (final boundaries decided during writing-plans):

| Module | Owns |
|---|---|
| `remarkInternalLinks()` (seam) | pipeline entry; delegates, holds no algorithm |
| url-resolver | collection-prefix → URL rules **as a data table**, not an if/else chain; delete dead `projects/`/`docs/` branches |
| excerpt-compiler | `extractExcerptAtPosition` + `createExcerptAroundWikilink` |
| backlink-index | (above) |
| posts-cache (typed) | replaces the three loose globals `get/set/populateGlobalPostsCache` with one typed accessor |

- `remarkStandardLinks` (cognitive-300) is decomposed as part of building the
  url-resolver; the redundant "ABSOLUTE FINAL" `/index` patches collapse into one rule.
- **Do not reorder the remark pipeline.** The module's public registration in
  `astro.config.mjs` stays `[remarkInternalLinks, { base: '/' }]`.
- Wikilink/standard-link resolution output (the `href` written onto every internal
  link) must be **byte-identical** before/after on a sample corpus — this is the
  behavior-preservation gate for the deepening.

### Wins

- **Build time:** O(N²) → O(N) for linked mentions (the headline).
- **Locality:** three redundant `/index` patches become one rule.
- **Leverage:** a URL-mapping change becomes a table edit, not a 255-line reread.
- **Testability:** url-resolver, excerpt-compiler, and backlink-index become pure,
  unit-testable without remark AST fixtures.

---

## Workstream 2 — Gate off the Bases feature

### Problem

The Bases (JEXL query) feature is unused by the site owner but still costs every
build: `remarkBases` runs on every post (`astro.config.mjs:504`) and
`base/[...base].astro` scans `src/content/posts/**` for `.base` files in
`getStaticPaths`. It also carries a latent correctness bug (JEXL `contains`/
`startsWith`/`endsWith` are case-insensitive as globals but case-sensitive as
`StringWrapper` methods) and a duplicate `slugifyPath`.

### Solution — reversible flag, preserve everything

- Add to `src/config.ts` (with a `// [CONFIG:KEY]` marker):

  ```ts
  bases: {
    enabled: false, // [CONFIG:BASES_ENABLED]
  },
  ```

- **Pipeline:** when `bases.enabled` is false, `remarkBases` is not registered in
  `astro.config.mjs` (or is a registered no-op). Prefer not registering it so it adds
  zero per-post cost. `astro.config.mjs` already imports `siteConfig` (line 27), so
  the plugin array can be built conditionally at config-eval time.
- **Inline `` ```base `` fences:** `remarkBases` also renders fenced `` ```base ``
  blocks inside post bodies. Verified 2026-07-15: **zero** published posts use them, so
  gating is user-invisible. The plan must re-verify this (`grep -rl '```base'
  src/content/posts`) before disabling; if any exist, they will render as plain code
  fences when gated — decide explicitly then.
- **Routes:** `base/[...base].astro` and `base/index.astro` return an empty
  `getStaticPaths()` when disabled, so the `.base` directory scan and route generation
  are skipped entirely.
- **Preserve all Bases source** (`src/utils/bases/**`, `src/components/base/**`,
  route files) and **all `.base` files** (they live in the submodule — do not touch).
  This is a flag flip, fully reversible.
- **Record an ADR** (`docs/adr/0002-bases-feature-gated-off.md`) stating the feature
  is intentionally disabled, that the case-sensitivity bug and duplicate slugify are
  parked (not fixed) behind the gate, and that future architecture scans should not
  re-flag them while the flag is off.

### Do NOT (deferred)

Do not fix the JEXL case-sensitivity bug or unify the two `slugifyPath`
implementations in this pass — gating the feature removes their blast radius, and the
ADR records why they're parked. Fixing them is only worthwhile if Bases is re-enabled.

### Wins

- Removes a per-post pipeline step and a per-build directory scan.
- Neutralizes a live correctness bug without deleting code.

---

## Workstream 3 — Build-script deduplication & split

### Problem

- `parseFrontmatter` (~40 lines, hand-rolled "simple YAML-like parser") is
  **byte-identical** in `scripts/process-aliases.js:27` and
  `scripts/generate-deployment-config.js:44`, while `js-yaml` (^4.1.1) is already a
  direct dependency and already used in `src/utils/bases/parser.ts`.
- `scripts/sync-images.js` repeats the image-extension regex
  `/\.(jpg|jpeg|png|gif|bmp|tiff|tif)$/i` eight times.
- `scripts/generate-deployment-config.js` is a 964-line God-file: it generates,
  writes, and validates redirect/header config for Vercel, GitHub Pages, Netlify, and
  Cloudflare Workers, plus its own frontmatter and content-URL logic, plus the
  hardcoded production `CSP` constant.

### Solution

- `scripts/lib/frontmatter.js` — one frontmatter parser wrapping `js-yaml`; both
  scripts import it. Behavior must match the current parser on the existing content
  (characterize on a sample of real frontmatter first — the hand-rolled parser has
  quirks around arrays and comments that js-yaml handles differently; the plan must
  verify the aliases and deployment outputs are unchanged).
- `scripts/lib/images.js` — one `isRasterImage(path)` / extension predicate, replacing
  the 8 inline regexes in `sync-images.js`.
- Split `generate-deployment-config.js` into four per-platform adapters behind one
  small interface (e.g. `{ generate(config): FileMap }` per platform) plus a thin
  dispatcher. **The `CSP` constant and all platform output must be byte-identical** —
  this script owns the live production CSP header.

### Profile target (measure before changing)

`sync-images.js` converts PNG/JPG → WebP with a 15s/file timeout. If it re-converts
unchanged images every build, an mtime/exists skip is a real second build-time lever.
The plan must **measure this phase in the Task 0 baseline** and only add a skip if the
measurement shows redundant reconversion. No assumed win.

### Wins

- Deletion: two hand-rolled parsers gone, zero new dependencies.
- Locality: one frontmatter bug fix instead of two; one image predicate.
- Possible second build-time win (conditional on measurement).

---

## Workstream 4 — Search runtime consolidation *(code-quality, NOT build-time)*

### Problem

`src/scripts/search-client.ts` (716 lines) is one `initSearch()` closure owning
Pagefind loading, result hydration, filtering, selection, desktop preview, and mobile
sheet gestures. `src/components/SearchPalette.astro` (605 lines) is a second,
independently-implemented search UI. The pure model already exists in
`src/utils/search.ts` (`cleanContent`, `highlight`, `excerptAround`, `escapeHtml`)
and is **already tested** in `src/utils/search.test.ts` — but that test uses
`node:test`/`node:assert`, while `package.json`'s `test` script is `vitest run` scoped
to `tests/unit/**`, so **the test never runs**.

### Solution

- **Wire the orphaned test in:** port `search.test.ts` to vitest idioms and move it to
  `tests/unit/search/search.test.ts` so `pnpm test` runs it. (The pure functions it
  covers are unchanged — this is pure signal recovery.)
- **Extract a Pagefind gateway** from the `initSearch()` closure:

  ```ts
  // src/scripts/search/pagefind-gateway.ts
  export interface PagefindGateway {
    search(query: string, filters?: SearchFilters): Promise<SearchResult[]>;
    // load() is internal/lazy
  }
  export function createPagefindGateway(): PagefindGateway;
  ```

  The gateway owns Pagefind loading and result normalization; the pure result/filter
  shaping stays in `search.ts`.
- **Two thin views over one seam:** the `/search` page controller and
  `SearchPalette.astro` both consume the gateway + model, ending the duplicate
  implementation. Desktop-preview and mobile-sheet gestures remain view concerns.
- **Honest framing:** this improves testability and locality. It does **not** reduce
  build time (Pagefind indexes inside `astro build` regardless). It is in scope
  because the owner asked to explore it.

### Guardrail

Mobile sheet-gesture UX is load-bearing (AGENTS.md notes it dismisses only on
handle-swipe / content-at-top). Preserve the exact gesture behavior; characterize
before refactoring.

### Wins

- Leverage: one filter model + gateway, two views, instead of two implementations.
- Testability: the existing pure tests actually run; the gateway is mockable.

---

## Workstream 0 — Baseline & verification (spans the whole plan)

- **Task 0 (first):** capture a per-phase `pnpm build` baseline — time each pipeline
  step (`sync-images`, `process-aliases`, `generate-deployment-config`,
  `generate-graph-data`, `parse-bib`, `generate-callout-css`, `prewarm-image-dims`,
  `astro build` including page-render + OG images). Record numbers in the plan's
  execution notes. Run on a warm and a cold cache if feasible.
- **Behavior-preservation gates** (must pass at every relevant task):
  - `LinkedMentions` output identical (same mentions, same order, same titles) for a
    fixed sample of posts before/after.
  - Internal-link `href` output byte-identical on a sample corpus.
  - `process-aliases` redirect output and `generate-deployment-config` file outputs
    (including CSP) byte-identical before/after.
  - Search pure-function tests pass; Pagefind search results unchanged for sample
    queries.
  - `pnpm build` exits 0; `pnpm exec astro check` no worse than the Task 0 baseline
    error/warning counts.
- **Final task:** re-run the per-phase build measurement, record before/after deltas
  in the plan, and confirm the net build-time reduction.

---

## Testing strategy

- Follow the Reading Deck precedent: new deep modules get failing tests first, through
  their interface, then the implementation moves behind that interface.
- New/expanded unit coverage (vitest, `tests/unit/**`):
  - `backlink-index` — inversion correctness, memoization builds exactly once,
    output parity with characterized `findLinkedMentions`.
  - url-resolver — collection-prefix rules table (posts / pages / special / home /
    404), `/index` stripping, anchor handling; a case per current branch, plus
    regression cases for the three redundant patches.
  - excerpt-compiler — characterization tests pinning current excerpt output.
  - `scripts/lib/frontmatter` — parity with the hand-rolled parser on real samples.
  - search — the ported `search.test.ts` plus a gateway test with a Pagefind stub.
- No new e2e is required for build-time work; existing Reading Deck e2e must stay green.

---

## Correction policy

Preserve specified/observed behavior. Where current behavior contradicts a load-bearing
constraint (e.g. dead `projects/`/`docs` branches, the triple `/index` patch), fix it
and record the fix. Do not redesign subjective behavior (excerpt wording, mention
ordering) — characterize and preserve it.

---

## Out of scope (explicit)

- Reading Deck (governed by ADR-0001).
- `BaseLayout.astro` client lifecycle seam (runtime, not build-time — later round).
- Fixing the Bases JEXL case-sensitivity bug / duplicate slugify (parked behind the
  gate; ADR records why).
- Graph render-data triangle, remark/rehype inline-span parser duplication, homepage
  assembly (candidates 4/7/8 from the architecture review — future rounds).
- OG image generation optimization (satori/sharp) beyond measuring it in the baseline.

---

## Deliverables

1. This spec (committed).
2. An implementation plan at
   `docs/superpowers/plans/2026-07-15-build-time-deepening.md`, task-by-task, TDD,
   one commit per task, in the same format as the Reading Deck plan — ready to hand to
   the most capable model for execution.
3. `docs/adr/0002-bases-feature-gated-off.md` (produced during implementation).
