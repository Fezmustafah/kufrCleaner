# CLAUDE.md — kufrCleaner (OpenIslam Wiki)

> **Primary reference**: [`AGENTS.md`](AGENTS.md) contains exhaustive technical docs for every subsystem. Read its relevant sections before touching unfamiliar code.

## Project

**OpenIslam Wiki** — Islamic knowledge blog. Fork of `davidvkimball/astro-modular`. Version **0.8.6**. MIT license.  
Live site: `https://www.openislam.wiki`

**Stack**: Astro 6.1.2 · TypeScript · Tailwind CSS 3 · MDX · Swup · Pagefind · Satori/Sharp · D3 + PixiJS · rough-notation · KaTeX · Mermaid · JEXL · Giscus

**Package manager**: pnpm  
**Deployment**: Cloudflare Workers (`wrangler.toml`)

---

## 🚨 Critical Rules

1. **`entry.id` not `entry.slug`** — `slug` is removed in Astro v6. Always use `entry.id`.
2. **Never edit `src/content/**`** without explicit user permission. It is a **git submodule** — never `git add src/content/...` directly.
3. **Swup breaks JS** — every interactive component must re-initialize on Swup's `page:view` event. See AGENTS.md §Swup.
4. **Never disable `devToolbar.enabled: true`** in `astro.config.mjs` — causes module loading errors.
5. **No `console.log()` in production** — gate behind `import.meta.env.DEV`.
6. **Plugin order is load-bearing** — remark/rehype plugins run sequentially. Do not reorder without reading AGENTS.md §Plugin Pipeline.
7. **`[CONFIG:KEY]` markers are sacred** — comments like `// [CONFIG:SITE_TITLE]` in `src/config.ts` are used by the Astro Modular Settings Obsidian plugin. Never remove them.
8. **Pagefind, not fuse.js** — search is build-time indexed via `astro-pagefind`. There is no runtime fuse filter function. Do not import or reference fuse.js.
9. **`src/graph/` contains vendored PixiJS** (`pixi.js` + `pixi.d.ts`). Never edit those vendored files.
10. **Math CSS** — `.math-inline .katex-html` and `.math-display .katex-html` must stay hidden to prevent duplicate rendering.
11. **Theme options** — only `"minimal"`, `"custom"`, `"al-andalus"` are valid. The upstream 17-theme list does not apply to this fork.
12. **Collections use `bin/` subfolder** — `pages` and `special` load from `src/content/bin/`, not `src/content/` root. See §Content Collections below.

---

## Key Files

| File | Purpose |
|---|---|
| `src/config.ts` | All site configuration — the single source of truth |
| `src/content.config.ts` | Content collection schemas and glob loaders |
| `astro.config.mjs` | Integrations, CSP, remark/rehype pipeline, Swup, Vite |
| `tailwind.config.mjs` | CSS custom properties → Tailwind classes, typography |
| `src/types.ts` | Shared TS types (Post, Page, SEOData, NavigationItem, etc.) |
| `src/utils/internallinks.ts` | Wikilink + standard link resolution, URL mapping |
| `src/utils/remark-marginalia.ts` | `{{margin note}}` side-note system |
| `src/utils/remark-annotations.ts` | `==highlight==` / `!!underline!!` / etc. (rough-notation) |
| `src/utils/remark-citations.ts` | `[@key]` inline citations, reads `global-refs.json` |
| `src/utils/remark-callouts.ts` | `> [!note]` callout blocks |
| `src/utils/rehype-figure-captions.ts` | `img[alt]` → `<figure><figcaption>` |
| `src/utils/rehype-heading-highlight.ts` | Wraps heading text in `<span class="highlight-span">` |
| `src/utils/rehype-rebase-links.ts` | Prepends base path to absolute links (GitHub Pages) |
| `src/utils/seo.ts` | SEO/OG metadata generation |
| `src/utils/images.ts` | Image path resolution, Obsidian bracket stripping |
| `src/utils/markdown.ts` | `shouldShowPost`, `sortPostsByDate`, `extractTags`, etc. |
| `src/utils/search.ts` | `cleanContent`, `escapeHtml` for search previews |
| `src/utils/navigation.ts` | `isOptionalContentTypeEnabled` |
| `src/utils/theme.ts` | `getSystemTheme`, `getStoredTheme`, `setTheme` |
| `src/utils/bases/` | JEXL-powered content query system (6 files) |
| `src/graph/` | Full graph system — 25+ files, do not touch without reading AGENTS.md §Graph |
| `src/scripts/` | Client-side TS scripts loaded per-page (5 files) |
| `src/integrations/refresh-content-on-change.ts` | Dev-mode content layer hot reload |
| `src/integrations/escape-marginalia-mdx.ts` | Vite pre-transform: `{{}}` → `⟪⟫` in .mdx |
| `src/config/dev.ts` | Dev-mode image fallback configuration |
| `src/data/global-refs.json` | Generated BibTeX reference data (from `parse-bib.mjs`) |
| `src/generated/callouts-custom.json` | Generated callout metadata (from `generate-callout-css.js`) |
| `src/styles/global.css` | Global styles, annotation CSS vars, Tailwind entry |
| `src/styles/marginalia.css` | Marginalia layout styles |
| `src/styles/transition.css` | Swup page transition animations |
| `src/styles/callouts-custom.css` | Auto-generated custom callout styles |
| `scripts/generate-graph-data.js` | Generates `public/graph/graph-data.json` + `sitemap.json` |
| `scripts/parse-bib.mjs` | Parses `_refs.bib` → `src/data/global-refs.json` |
| `scripts/generate-callout-css.js` | Reads Obsidian callout-manager → CSS + JSON |
| `scripts/sync-images.js` | Copies + WebP-converts images from content to `public/` |
| `scripts/process-aliases.js` | Frontmatter `aliases:` → redirect rules |
| `scripts/generate-deployment-config.js` | Platform-specific config generation |

---

## Path Aliases

```
@/            → src/
@/components  → src/components/
@/layouts     → src/layouts/
@/utils       → src/utils/
@/types       → src/types.ts
@/config      → src/config.ts
@/graph       → src/graph/
```

---

## Content Collections

`src/content/` is a **git submodule**. All edits must go through the submodule repo.

| Collection | Glob base | Notes |
|---|---|---|
| `posts` | `src/content/posts/` | Blog articles. Supports folder-based (`post-name/index.md`). |
| `pages` | `src/content/bin/pages/` | Static pages (about, contact, etc.) |
| `special` | `src/content/bin/special/` | 404, homepage blurb, posts-index meta |
| `tags` | `src/content/tags/` | Optional tag description pages |
| `categories` | `src/content/categories/` | Optional category description pages |

**No `projects` or `docs` collections** — `optionalContentTypes` is empty in this fork.

Folder-based post at `posts/my-post/index.md` → `id = "my-post"` (not `"my-post/index"`).

### Posts frontmatter fields
`title` · `description` · `date` · `tags` · `draft` · `image` · `imageOG` · `imageAlt` · `hideCoverImage` · `hideTOC` · `showTOC` · `targetKeyword` · `author` · `banner` · `modified` · `noIndex` · `category` · `faq`

> `banner` — dedicated OG image (overrides `image` for social cards).  
> `category` — singular string (not array). Drives category pages + graph node color.  
> `faq` — array of `{ question, answer }` → emitted as FAQPage JSON-LD in PostLayout (featured-snippet eligible).

---

## Dev Workflow

```bash
# Dev server (port 5000, fallback 5001)
pnpm dev
# Pipeline: setup-dev → sync-images → process-aliases → generate-deployment-config
#           → generate-graph-data → parse-bib → generate-callout-css → dev server

# Production build
pnpm build
# Pipeline: sync-images → process-aliases → generate-deployment-config
#           → generate-graph-data --production → parse-bib → generate-callout-css → astro build

# Utilities
pnpm check-images          # Find missing image references
pnpm parse-bib             # Re-parse _refs.bib → global-refs.json
pnpm generate-graph-data   # Re-generate graph data only
pnpm sync-images           # Sync images only
pnpm process-aliases       # Re-generate redirect rules
```

---

## Markdown Processing Pipeline

### Remark plugins (exact order)
1. `remarkCitations` — `[@key]` inline citations ← runs FIRST to avoid conflicts
2. `remarkObsidianImageSize` — `![[img|500]]` size syntax
3. `remarkInternalLinks` — wikilinks + standard link resolution
4. `remarkInlineTags` — `#tag` inline tags
5. `remarkObsidianComments` — removes `%%...%%` comments
6. `remarkMarginalia` — `{{note}}` margin notes (handles `⟪⟫` from MDX escape internally)
7. `remarkAnnotations` — `==text==` / `!!text!!` / `^^text^^` / `((text))` / `||text||`
8. `remarkFolderImages` — folder-relative image path resolution
9. `remarkObsidianEmbeds` — `![[post-name]]` post embeds
10. `remarkBases` — ` ```base ` query blocks
11. `remarkImageCaptions` — image caption extraction
12. `remarkMath` — `$...$` / `$$...$$` math
13. `remarkCallouts` — `> [!type]` callout blocks
14. `remarkBreaks` — soft line breaks
15. `remarkImageGrids` — consecutive images → responsive grid
16. `remarkMermaid` — mermaid diagram fences
17. `remarkReadingTime` — injects reading time into frontmatter
18. `remarkToc` — auto-generates TOC (heading: "contents" / "table of contents" / "toc")

### Rehype plugins (exact order)
1. `rehypeKatex` — renders KaTeX math
2. `rehypeMark` — `==text==` → `<mark>`
3. `rehypeImageAttributes` — applies width/class from Obsidian image syntax
4. `rehypeFigureCaptions` — wraps `<img alt="...">` in `<figure><figcaption>`
5. `rehypeSlug` — adds `id` to headings (skips h1)
6. `rehypeHeadingHighlight` — wraps heading text in `<span class="highlight-span">`
7. `rehypeAutolinkHeadings` — appends permalink icon to headings (skips h1)
8. `rehypeNormalizeAnchors` — **LAST** — fixes className/href on all anchors

Shiki syntax theme: `github-dark`

---

## Theming

Three themes: `"minimal"` · `"custom"` · `"al-andalus"`. Currently active: `"al-andalus"`.

Custom themes: `src/themes/custom/`. Set `theme: "custom"` and `customThemeFile: "filename"` in `src/config.ts`.

Colors are CSS custom properties (`--color-primary-*`, `--color-highlight-*`) mapped to Tailwind via `tailwind.config.mjs`. Always use Tailwind theme classes, never hardcoded hex values.

---

## Image System

Two independent systems — never confuse them:

1. **Post card images** — frontmatter `image` field. Visibility controlled by `postOptions.showPostCardCoverImages`. Synced to `public/posts/{id}/` by `sync-images.js`.
2. **Post content images** — inside markdown body. Visibility controlled by `hideCoverImage` frontmatter. Processed by `rehypeImageAttributes` + `rehypeFigureCaptions`.

`sync-images.js` converts images to WebP (quality 85) and copies to `public/`.

---

## New Systems Added in This Fork (vs upstream)

| System | Entry point | AGENTS.md section |
|---|---|---|
| Graph view (PixiJS + D3) | `src/components/SiteGraph.astro` | §Graph System |
| Full-text search (Pagefind) | `src/pages/search.astro` | §Search (Pagefind) |
| Margin notes | `src/utils/remark-marginalia.ts` | §Marginalia |
| rough-notation annotations | `src/utils/remark-annotations.ts` | §Annotations |
| Citations / BibTeX | `src/utils/remark-citations.ts` | §Citations |
| Dynamic OG images (satori) | `src/pages/og/[...id].png.ts` | §OG Image Generation |
| Bases (JEXL queries) | `src/utils/bases/`, `src/pages/base/` | §Bases System |
| `llms.txt` endpoint | `src/pages/llms.txt.ts` | — |
| Custom callout CSS gen | `scripts/generate-callout-css.js` | §Scripts |
| Content as git submodule | `src/content/` | §Content Submodule |
