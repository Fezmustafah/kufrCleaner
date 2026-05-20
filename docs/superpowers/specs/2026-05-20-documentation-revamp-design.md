# Design: AGENTS.md + CLAUDE.md Documentation Revamp

**Date:** 2026-05-20  
**Project:** kufrCleaner — fork of `davidvkimball/astro-modular`  
**Current version:** 0.8.6  
**Primary reader:** AI agents (Claude, Copilot)  
**Approach:** Option B — Restructure around fork reality

---

## Context

`AGENTS.md` and `CLAUDE.md` were written for the upstream `astro-modular` theme at v0.1.0. The fork has grown to v0.8.6 with ~40+ new files, systems, and features. The docs are stale in multiple ways:

- Astro version listed as "5.15.1" — actual version is **6.1.2**
- fuse.js listed as search library — replaced by **astro-pagefind**
- Missing entire systems: graph, marginalia, annotations, citations, OG images, bases, R2, llms.txt
- Plugin pipeline lists are incomplete (missing 6 remark and 3 rehype plugins)
- CLAUDE.md key files table missing ~20 files
- Dev workflow script outdated (missing `generate-graph-data`, `parse-bib`, `generate-callout-css`)
- `src/content/` is a git submodule — not documented anywhere

---

## File 1: CLAUDE.md (AI quick-reference card)

**Role:** First file harness loads. Complete, accurate, machine-readable rules + project map.  
**Target length:** ~150–200 lines (currently ~80 lines, but inaccurate)

### Sections

#### 1. Header block
```
# CLAUDE.md — kufrCleaner (Astro Modular fork)
Version: 0.8.6 | Fork of: davidvkimball/astro-modular | License: MIT
```

#### 2. Critical Rules (updated)
Preserve the 11 existing rules. Add 4 new rules:
- **Never modify `src/graph/` PixiJS files** without understanding the renderer/simulator split
- **`src/content/` is a git submodule** — never `git add` content files directly; use submodule workflow
- **Pagefind replaces fuse.js** — no runtime fuse filter API exists; indexing is build-time only
- **Marginalia/annotations/citations** — all three systems require Swup `page:view` re-initialization

Remove: stale "Astro v6 Compatibility Status" section (already on v6).

#### 3. Stack
Accurate list:
```
Astro 6.1.2 · TypeScript · Tailwind CSS 3 · MDX · Swup · Pagefind (astro-pagefind)
D3 + PixiJS (graph) · rough-notation (annotations) · Satori + Sharp (OG images)
KaTeX · Mermaid · JEXL (bases) · Giscus (comments) · @astrojs/rss
```

#### 4. Key Files table (fully updated)

| File | Purpose |
|---|---|
| `src/config.ts` | All site configuration |
| `src/content.config.ts` | Content collection schemas |
| `astro.config.mjs` | Integrations, CSP, remark/rehype pipeline |
| `tailwind.config.mjs` | Theme colors (CSS vars), typography |
| `src/types.ts` | Shared TypeScript types |
| `src/utils/internallinks.ts` | Wikilink/folder image resolution |
| `src/utils/remark-*.ts` | Remark plugins (11 total) |
| `src/utils/rehype-*.ts` | Rehype plugins (7 total) |
| `src/utils/seo.ts` | SEO/OG metadata helpers |
| `src/utils/images.ts` | Image processing utilities |
| `src/utils/markdown.ts` | Markdown utilities, shouldShowPost |
| `src/utils/search.ts` | Pagefind search helpers |
| `src/utils/status.ts` | Post status utilities |
| `src/utils/theme.ts` | Theme utilities |
| `src/utils/navigation.ts` | Navigation helpers |
| `src/utils/bases/` | JEXL-based content query system (6 files) |
| `src/graph/` | Full graph system (25+ files) |
| `src/scripts/` | Client-side scripts (5 files) |
| `src/config/dev.ts` | Dev-mode configuration |
| `src/data/global-refs.json` | Global reference data |
| `src/generated/callouts-custom.json` | Generated callout config |
| `src/integrations/` | Custom Astro integrations (2 files) |
| `scripts/generate-graph-data.js` | Build-time graph data generation |
| `scripts/parse-bib.mjs` | BibTeX bibliography parsing |
| `scripts/generate-callout-css.js` | Callout CSS generation |
| `scripts/sync-images.js` | Image sync from content to public |
| `scripts/process-aliases.js` | Alias → redirect processing |
| `scripts/purge-fake-images.js` | Remove placeholder images (build only) |
| `scripts/upload-r2.mjs` | Cloudflare R2 media upload |

#### 5. Path Aliases
Add `@/graph → src/graph/` to existing list.

#### 6. Content Collections
Unchanged (still accurate). Add note: `src/content/` is managed as a git submodule.

#### 7. Dev Workflow (corrected)
```bash
pnpm dev    # setup-dev → sync-images → process-aliases → generate-deployment-config
             # → generate-graph-data → parse-bib → generate-callout-css → dev server
pnpm build  # sync-images → purge-fake-images --apply → process-aliases
             # → generate-deployment-config → generate-graph-data --production
             # → parse-bib → generate-callout-css → astro build
```

#### 8. Markdown Processing Pipeline (corrected)

**Remark plugins (in order):**
1. internal links
2. folder images
3. callouts
4. image grids
5. mermaid
6. Obsidian embeds
7. bases
8. inline tags
9. comments
10. image size
11. marginalia *(new)*
12. restore-marginalia *(new)*
13. annotations *(new)*
14. citations *(new)*
15. math
16. reading time
17. TOC
18. line breaks

**Rehype plugins (in order):**
1. KaTeX
2. mark
3. image attributes
4. rebase links *(new)*
5. figure captions *(new)*
6. slug
7. autolink headings
8. anchor normalization
9. heading highlight *(new)*

#### 9. "New Since Fork" summary box
Callout listing every system added in this fork with AGENTS.md section pointers:
- Graph system → see AGENTS.md §Graph System
- Pagefind full-text search → see AGENTS.md §Search (Pagefind)
- Marginalia sidebar notes → see AGENTS.md §Marginalia System
- Rough-notation annotations → see AGENTS.md §Annotations
- Citations/BibTeX → see AGENTS.md §Citations & Bibliography
- Dynamic OG image generation (satori+sharp) → see AGENTS.md §OG Image Generation
- Bases system (JEXL queries) → see AGENTS.md §Bases System
- Cloudflare R2 media CDN → see AGENTS.md §R2 / Media CDN
- `llms.txt` endpoint → `src/pages/llms.txt.ts`
- Content as git submodule → see AGENTS.md §Content Submodule

---

## File 2: AGENTS.md (deep technical reference)

**Role:** Deep per-system documentation. AI agents read this for subsystem internals.  
**Target length:** ~2500–3000 lines (currently 4557 lines — significant trim of stale upstream boilerplate)

### Section Order (new)

#### Part 1 — Fork-specific systems (new, highest break risk)

**§ Critical Mistakes (updated)**
- Keep the top-11 list format
- Add: never modify graph PixiJS renderer directly; pagefind has no runtime filter API; marginalia requires Swup re-init; content is a submodule
- Remove: entire "Astro v6 Compatibility Status" section (was for a future migration that already happened)

**§ Graph System**
- Architecture: `src/graph/` directory map with role of each subdirectory
- Data flow: `generate-graph-data.js` → `public/graph-data.json` → loaded by `SiteGraph.astro` / `GraphModal.astro`
- Key files: `Graph.astro`, `graph-component.ts`, `renderer.ts` (PixiJS), `simulator.ts` (D3 force)
- Entry points: `SiteGraph.astro` (inline sidebar), `GraphModal.astro` (modal overlay), `src/pages/graph-view.astro` (full page)
- Config options: `postOptions.graphView` in `config.ts`
- Swup re-init: graph must re-mount on `page:view`
- CSS: `src/graph/graph.css`
- ⚠️ Never edit `pixi.js` / `pixi.d.ts` — vendored PixiJS

**§ Search (Pagefind)**
- Replaced fuse.js — fundamental model difference: build-time static index, no runtime filter function
- Integration: `astro-pagefind` runs after `astro build` in build hook
- Entry point: `src/pages/search.astro`
- Custom metadata via `data-pagefind-*` attributes on elements
- Sub-results for section-level matching
- Filter system: year, tag, category — all client-side from pagefind index
- Mobile sheet behavior: dismisses only on handle-swipe or content-at-top (recent fix)
- ⚠️ Never call `window.pagefind.filters()` as a single source of truth — stale on empty elements

**§ Marginalia System**
- What it is: sidebar margin notes that appear alongside the main content
- Remark flow: `remarkMarginalia` extracts margin notes → content is processed → `remarkRestoreMarginalia` reinserts them in correct DOM position
- Custom integration: `src/integrations/escape-marginalia-mdx.ts` prevents MDX from escaping marginalia syntax
- Client: `src/scripts/marginalia-client.ts` — handles positioning, responsive behavior
- Components: `Marginalia.astro` (mobile inline), `MarginaliaDesktop.astro` (sidebar)
- CSS: `src/styles/marginalia.css`
- Swup: must re-init on `page:view`

**§ Annotations (rough-notation)**
- Syntax: defined in markdown via `remark-annotations.ts` plugin
- `rehype-heading-highlight.ts` wraps heading text in `<span class="highlight-span">` so rough-notation can target headings
- Client: `src/scripts/annotations-client.ts` — applies `annotate()` calls
- Hash-navigation behavior: heading annotation flashes when navigating from search result via `#hash`
- SVG cleanup: rough-notation SVGs append to `<body>` outside `#swup-container` — must be cleaned on `page:view`
- Swup: must re-init on `page:view`

**§ Citations & Bibliography**
- Plugin: `src/utils/remark-citations.ts` — processes `[@citationKey]` syntax
- Build step: `scripts/parse-bib.mjs` parses `.bib` BibTeX file → generates citation JSON
- Rendered as footnotes/bibliography section at bottom of post
- Integration with build pipeline: `parse-bib` runs before `astro build`

**§ OG Image Generation**
- Route: `src/pages/og/[...id].png.ts` — static paths generated for all posts
- Stack: satori (HTML→SVG) + sharp (SVG→PNG)
- Font: Lora loaded from Google Fonts at build time (TTF format, old Safari UA trick)
- Priority: `banner` field → `image` field → text-only card
- Cache: `public, max-age=31536000, immutable`
- Homepage: uses `/public/open-graph.png` directly (hero image)
- ⚠️ Fonts are fetched from Google at build time — requires network access during build

**§ Bases System**
- What it is: Obsidian "Bases" — JEXL-powered queries over content collections
- Files: `src/utils/bases/` — filter.ts, functions.ts, parser.ts, propertyWrappers.ts, slugify.ts, types.ts
- Pages: `src/pages/base/[...base].astro`, `src/pages/base/index.astro`
- Format: `.base` files (custom format, treated as Astro assets)
- Global refs: `src/data/global-refs.json`
- ⚠️ `.base` files are in `assetsInclude` in vite config — don't try to import them as modules

**§ R2 / Media CDN**
- Scripts: `scripts/upload-r2.mjs` (images), `scripts/upload-r2-pdfs.mjs` (PDFs)
- Requires: `.env` with `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
- Dry-run: `pnpm r2:upload:dry` / `pnpm r2:upload-pdfs:dry`
- Uses `@aws-sdk/client-s3` (S3-compatible API)

**§ Content Submodule**
- `src/content/` is a git submodule pointing to a separate private repository
- Never `git add src/content/...` — changes to content must go through the submodule repo
- Update submodule: `git submodule update --remote src/content`
- Script: `scripts/checkout-content-submodule.sh`
- `.gitmodules` defines the submodule configuration

---

#### Part 2 — Upstream systems (condensed, corrected)

**§ Critical Rules** (trimmed — keep the essential ones, remove Astro v5 compatibility boilerplate)

**§ Plugin Pipeline** (updated, accurate)

**§ Swup Page Transitions** (unchanged — still accurate and important)

**§ Image Handling** (unchanged — two-system distinction still valid)

**§ Content Collections** (unchanged — still accurate)

**§ Obsidian Integration** (condensed — remove hotkey lists, keep wikilink/URL mapping docs)

**§ Deployment Platforms** (unchanged — still accurate)

**§ Configuration Reference** (updated with new keys: graphView, banner, featureButton, postCardAspectRatio, hideScrollBar, tableOfContents.depth)

**§ Theming System** (unchanged)

**§ Build Process** (updated — corrected script pipeline)

---

## Implementation Notes

### What gets deleted from AGENTS.md
- "Astro v6 Compatibility Status" section (~40 lines) — already on v6
- Detailed Obsidian hotkey lists — not relevant to AI agents
- Version management section — the system works, docs don't need to explain it to agents
- Repeated boilerplate ("AI AGENTS MUST READ THIS SECTION CAREFULLY") — condense

### What gets added
All fork-specific sections listed in Part 1 above.

### Estimated final sizes
- `CLAUDE.md`: ~200 lines (up from ~80 inaccurate lines)
- `AGENTS.md`: ~2800 lines (down from 4557 bloated lines)

---

## Spec Self-Review Checklist
- [ ] No placeholders or TBDs
- [ ] No internal contradictions
- [ ] Scope: focused enough for a single implementation plan
- [ ] Requirements unambiguous

**Status after review:** ✅ Ready for implementation plan
