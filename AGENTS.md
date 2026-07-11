# AI Agent Guide — kufrCleaner (OpenIslam Wiki)

Fork of `davidvkimball/astro-modular` · Version **0.8.6** · Astro **6.1.2**  
Live: `https://www.openislam.wiki` · License: MIT

Read [CLAUDE.md](CLAUDE.md) first for the quick-reference card. This document goes deep on every subsystem.

---

## Table of Contents

1. [Critical Mistakes](#-critical-mistakes)
2. [Project Architecture Overview](#project-architecture-overview)
3. [Content Submodule](#content-submodule)
4. [Content Collections & Schemas](#content-collections--schemas)
5. [Configuration Reference](#configuration-reference-srcconfigts)
6. [Plugin Pipeline](#plugin-pipeline-remark--rehype)
7. [Graph System](#graph-system)
8. [Search (Pagefind)](#search-pagefind)
9. [Marginalia System](#marginalia-system)
10. [Annotations (rough-notation)](#annotations-rough-notation)
11. [Citations & Bibliography](#citations--bibliography)
12. [OG Image Generation](#og-image-generation)
13. [Bases System](#bases-system)
14. [Swup Page Transitions & JS Re-initialization](#swup-page-transitions--js-re-initialization)
15. [Image Handling](#image-handling)
16. [Layouts & Pages](#layouts--pages)
17. [Components Reference](#components-reference)
18. [Scripts Reference](#scripts-reference)
19. [Custom Integrations](#custom-integrations)
20. [Theming System](#theming-system)
21. [Deployment](#deployment)
22. [Obsidian Integration](#obsidian-integration)

---

## 🚨 Critical Mistakes

These are the top errors AI agents make in this codebase. Read before touching anything.

### 1. Using `entry.slug` instead of `entry.id`
`slug` is removed in Astro v6 and returns `undefined`. **Always use `entry.id`.**
```ts
// ❌ WRONG
const url = `/posts/${post.slug}`;
// ✅ CORRECT
const url = `/posts/${post.id}`;
```

### 2. Wrong content collection paths
- `pages` loads from `src/content/bin/pages/` — NOT `src/content/pages/`
- `special` loads from `src/content/bin/special/` — NOT `src/content/special/`
- There are **no `projects` or `docs` collections** in this fork (`optionalContentTypes: {}`)

### 3. Committing `src/content/` files from the parent repo
`src/content/` is a **git submodule** with its own `.git`. Content changes must go through the submodule repo. Never `git add src/content/...` from the parent.

### 4. Assuming 17+ upstream themes exist
This fork has **three themes only**: `"minimal"`, `"custom"`, `"al-andalus"`.

### 5. Removing `[CONFIG:KEY]` markers from `src/config.ts`
Every config value has a comment like `// [CONFIG:SITE_TITLE]`. These are consumed by the **Astro Modular Settings Obsidian plugin** to auto-update config. Removing them breaks the plugin.

### 6. Reordering remark/rehype plugins
The sequence in `astro.config.mjs` is carefully ordered. `remarkCitations` runs first intentionally. `rehypeNormalizeAnchors` runs last intentionally. Reordering breaks citations, marginalia, callouts, or embeds.

### 7. Using the fuse.js API
fuse.js is removed. Search is **Pagefind** — build-time static index. No runtime `Fuse` constructor, no `posts.json` fetch for search. Index lives in `public/pagefind/` after build.

### 8. Forgetting Swup re-initialization
Swup replaces `#swup-container` without firing `DOMContentLoaded`. Any component with JS behaviour must register a re-init function and call it from BaseLayout's `page:view` hook. See §Swup.

### 9. Editing `src/graph/components/graph/pixi/pixi.js` or `pixi.d.ts`
These are vendored PixiJS files. **Do not edit. Do not update.** They are intentionally pinned.

### 10. Unguarded `console.log()` in production code
All logging must be gated behind `import.meta.env.DEV`. Build-time Node scripts use their own `log` utility that checks `process.env.NODE_ENV !== 'production'`.

### 11. Adding `# H1` to markdown content
Both posts and pages have their H1 rendered by the **layout** from `entry.data.title`. Content starts at H2. Never add `# Heading` at the top of any markdown file.

### 12. Hardcoded colour values
All colours must use Tailwind theme classes referencing CSS custom properties. Never use `#ffffff`, `rgb(...)`, or named colours. They break across themes.

---

## Project Architecture Overview

```
kufrCleaner/
├── src/
│   ├── components/             Astro UI components
│   ├── config.ts               Single source of truth for all configuration
│   ├── config/dev.ts           Dev-mode image fallback settings
│   ├── content.config.ts       Collection schemas + glob loaders
│   ├── data/global-refs.json   Generated BibTeX reference data
│   ├── generated/              Auto-generated files (callout CSS metadata)
│   ├── graph/                  Graph system (starlight-site-graph adaptation)
│   ├── integrations/           Custom Astro integrations (2 files)
│   ├── layouts/                BaseLayout, PostLayout, PageLayout
│   ├── pages/                  File-based routes
│   ├── scripts/                Client-side TS scripts (loaded per-page)
│   ├── styles/                 global.css, marginalia.css, transition.css, callouts-custom.css
│   ├── themes/                 Theme definitions + custom/
│   ├── types.ts                Shared TypeScript types
│   └── utils/                  Remark/rehype plugins + helper utilities
├── scripts/                    Build-time Node.js scripts
├── public/
│   ├── graph/                  Generated: graph-data.json, sitemap.json
│   └── posts/                  Synced post images (+ WebP conversions)
└── src/content/                ← git submodule
    ├── posts/                  Blog articles
    ├── bin/pages/              Static pages
    ├── bin/special/            Special pages (404, home blurb, posts-meta)
    ├── tags/                   Optional tag description pages
    ├── categories/             Optional category description pages
    ├── bases/                  .base query files
    ├── manuscripts/_refs.bib   BibTeX references (Zotero export)
    └── .obsidian/              Vault config (callout-manager, plugins)
```

### End-to-end data flow

```
Obsidian vault (src/content/)  ← user writes here
  ↓ git submodule commit/push
Build pipeline:
  sync-images          → public/posts/... (WebP conversion)
  process-aliases      → redirect rules
  generate-graph-data  → public/graph/graph-data.json + sitemap.json
  parse-bib            → src/data/global-refs.json
  generate-callout-css → src/styles/callouts-custom.css + src/generated/callouts-custom.json
  astro build          → Markdown → remark → rehype → HTML
  pagefind             → public/pagefind/ (search index)
  ↓
dist/ → Cloudflare Workers
```

---

## Content Submodule

`src/content/` is a separate Git repository linked as a submodule.

### Working with it
```bash
# Fresh clone setup
git submodule update --init --recursive

# Pull latest content
git submodule update --remote src/content

# Or use the helper script
bash scripts/checkout-content-submodule.sh
```

### Rules
- **Never** `git add src/content/...` from the parent repo
- Content changes go in the submodule repo; the parent repo only tracks the commit hash pointer
- `src/content/.git` is the submodule's own history — distinct from the parent `.git`

---

## Content Collections & Schemas

### Active collections

```ts
// src/content.config.ts
posts:      glob('**/*.{md,mdx}', './src/content/posts')
pages:      glob('**/*.{md,mdx}', './src/content/bin/pages')
special:    glob('**/*.{md,mdx}', './src/content/bin/special')
tags:       glob('**/*.md',       './src/content/tags')
categories: glob('**/*.md',       './src/content/categories')
```

No `projects` or `docs` collections in this fork.

### Posts schema (complete)

```ts
{
  title:          string          // default: 'Untitled Post'
  description:    string | null   // default: 'No description provided'
  date:           Date            // coerced; default: now
  tags:           string[] | null
  draft:          boolean
  image:          string | null   // post card image + content hero
                                  // accepts: plain path, [[Obsidian]], ![alt](url)
  imageOG:        boolean         // if true, use image as OG (instead of banner)
  imageAlt:       string | null
  hideCoverImage: boolean         // hides the image inside the post body
  hideTOC:        boolean
  showTOC:        boolean
  targetKeyword:  string | null   // SEO keyword hint
  author:         string | null   // per-post override of global siteConfig.author
  banner:         string | null   // dedicated OG banner image (top priority for social cards)
  modified:       Date            // last-modified date for SEO
  noIndex:        boolean
  category:       string | null   // singular — drives category pages + graph node colour
}
```

> The `image` schema transform normalises all three input formats to a plain string path.  
> `banner` takes priority over `image` when generating the OG image.

### Pages schema
`title`, `description`, `draft`, `lastModified`, `image`, `imageAlt`, `hideCoverImage`, `hideTOC`, `showTOC`, `noIndex`

### Special collection
Fixed filenames map to fixed roles:
| File | Role |
|---|---|
| `home.md` | Homepage blurb content (rendered when `homeOptions.blurb.placement !== "none"`) |
| `404.md` | 404 error page content |
| `posts.md` | Posts-index page title + description (frontmatter only, body ignored) |

Schema: `{ title, description, hideTOC }`

### Tags and categories collections
Both follow the same pattern: optional enrichment for listing pages.  
`src/content/tags/aqidah.md` → adds a description + optional banner to the `/posts/tag/aqidah` page.  
If the file doesn't exist, the listing page renders with default behaviour.

### Folder-based posts
```
src/content/posts/
├── single-post.md                 → id = "single-post"
└── my-folder-post/
    ├── index.md                   → id = "my-folder-post"
    ├── hero.jpg                   → public/posts/my-folder-post/hero.jpg
    └── attachments/diagram.svg   → public/posts/my-folder-post/diagram.svg
```

IDs never include `/index`. Assets are co-located and synced to `public/` by `sync-images.js`.

---

## Configuration Reference (`src/config.ts`)

`src/config.ts` is the **single configuration file** for the entire site. All feature flags, layout, navigation, and deployment settings live here.

> ⚠️ Every setting has a `// [CONFIG:KEY]` marker comment. **Never remove these** — the Astro Modular Settings Obsidian plugin uses them to locate and update values automatically.

### Top-level site fields
| Field | Type | Notes |
|---|---|---|
| `site` | `string` | Full URL, no trailing slash |
| `title` | `string` | Used in meta + header |
| `homepageTitle` | `string` | Homepage-specific meta title (falls back to `title` if empty) |
| `hero.image` | `string` | Path in `public/` e.g. `"/hero.webp"` |
| `hero.imageAlt` | `string` | |
| `hero.overlayOpacity` | `0–1` | Dark overlay over hero image (default 0.55) |
| `description` | `string` | Site meta description |
| `author` | `string` | Global author name |
| `language` | `string` | HTML `lang` attribute |
| `faviconThemeAdaptive` | `boolean` | Uses `favicon-dark.png`/`favicon-light.png` per system theme |
| `defaultOgImageAlt` | `string` | Alt for `public/open-graph.png` |
| `twitterHandle` | `string` | Without `@`; for `twitter:site` meta |

### Theme & appearance
| Field | Type | Notes |
|---|---|---|
| `theme` | `"minimal" \| "custom" \| "al-andalus"` | Active theme |
| `customThemeFile` | `string` | File in `src/themes/custom/` (no `.ts`) |
| `availableThemes` | `"default" \| string[]` | Restricts theme-switcher options |
| `fonts.source` | `"local" \| "cdn"` | `"local"` = `@fontsource`; `"cdn"` = Google Fonts CDN |
| `fonts.families.body/heading/mono` | `string` | Font family names |
| `layout.contentWidth` | `string` | CSS value e.g. `"45rem"` |
| `hideScrollBar` | `boolean` | Hides scrollbar globally |
| `featureButton` | `"mode" \| "graph" \| "theme" \| "none"` | Floating action button (bottom-right) |

### Navigation
```ts
navigation: {
  showNavigation: boolean
  style: "minimal" | "traditional"
  showMobileMenu: boolean
  pages: NavigationItem[]       // one level of nesting supported
  social: { title, url, icon }[]
}
```

### Banner (site-wide image strip)
```ts
banner: { enable: boolean, src: string, position: "top"|"center"|"bottom" }
```

### Profile picture
```ts
profilePicture: {
  enabled: boolean, image: string, alt: string,
  size: "sm"|"md"|"lg", url?: string,
  placement: "footer"|"header", style: "circle"|"square"|"none"
}
```

### Command palette
```ts
commandPalette: {
  enabled: boolean, shortcut: string, placeholder: string,
  search: { posts: boolean, pages: boolean },
  sections: { quickActions: boolean, pages: boolean, social: boolean },
  quickActions: { enabled, toggleMode, graphView, changeTheme: boolean }
}
```

### Home options
```ts
homeOptions: {
  featuredPost: { enabled: boolean, type: "latest"|"featured", slug?: string },
  recentPosts:  { enabled: boolean, count: number },
  blurb:        { placement: "above"|"below"|"none" }
}
```

### Post options
```ts
postOptions: {
  postsPerPage: number
  readingTime: boolean
  wordCount: boolean
  tags: boolean
  categories: boolean             // enables category feature across all posts
  linkedMentions: { enabled: boolean, linkedMentionsCompact: boolean }
  graphView: {
    enabled: boolean
    showInSidebar: boolean        // local graph in PostLayout left sidebar
    maxNodes: number              // passed to generate-graph-data.js
    showOrphanedPosts: boolean
  }
  postNavigation: boolean
  showPostCardCoverImages: "all"|"featured"|"home"|"posts"|"featured-and-posts"|"none"
  postCardAspectRatio: "16:9"|"4:3"|"3:2"|"og"|"square"|"golden"|"custom"
  customPostCardAspectRatio: string   // e.g. "2.5/1" — only when above is "custom"
  comments: { enabled, provider: "giscus", repo, repoId, category, categoryId, ... }
}
```

### Optional content types
```ts
optionalContentTypes: {
  // Currently empty — projects and docs are not enabled in this fork
  // To enable: projects?: { enabled: boolean }, docs?: { enabled: boolean }
}
```

### Deployment
```ts
deployment: { platform: "netlify"|"vercel"|"github-pages"|"cloudflare-workers" }
```
Set once. `generate-deployment-config.js` generates the correct platform files automatically on build.

---

## Plugin Pipeline (Remark + Rehype)

### Remark plugins — exact order from `astro.config.mjs`

```
1.  remarkCitations         [@key] citations  ← FIRST: avoids bracket conflicts with wikilinks
2.  remarkObsidianImageSize ![[img.png|500]] / ![[img.png|caption|500]] size syntax
3.  remarkInternalLinks     [[wikilinks]] + standard internal [text](url) links
4.  remarkInlineTags        #tag → tag link elements
5.  remarkObsidianComments  %%comments%% → removed entirely
6.  remarkMarginalia        {{margin note}} → sidebar notes (also normalises ⟪⟫ from MDX)
7.  remarkAnnotations       ==highlight== !!underline!! ^^box^^ ((circle)) ||bracket||
8.  remarkFolderImages      Resolves relative image paths for folder-based posts
9.  remarkObsidianEmbeds    ![[post-slug]] → post embed block
10. remarkBases             ```base blocks → rendered content queries (v1 placeholder)
11. remarkImageCaptions     Extracts captions from image alt text
12. remarkMath              $inline$ and $$block$$ → KaTeX AST nodes
13. remarkCallouts          > [!note] / > [!warning] / custom callout types
14. remarkBreaks            Soft line breaks → <br>
15. remarkImageGrids        Consecutive images → responsive grid layout
16. remarkMermaid           ```mermaid → Mermaid diagram component
17. remarkReadingTime       Injects readingTime into remarkPluginFrontmatter
18. remarkToc               Auto-generates TOC under "## Contents" / "## Table of Contents"
```

**Why citations run first**: `[@key]` contains `[` brackets. `remarkInternalLinks` also processes brackets for wikilinks. Running citations first ensures the `[@...]` pattern is consumed before any ambiguity arises.

**Why marginalia before annotations**: Both walk text nodes. Marginalia finalises its HTML markers (`<span data-marginalia-id="N">`) first, so annotations don't accidentally match inside marginalia delimiters.

**Tip for adding plugins**: Insert new plugins between step 10 and step 12 unless a specific earlier/later position is needed. Document the reason inline.

### Rehype plugins — exact order from `astro.config.mjs`

```
1. rehypeKatex              Renders KaTeX math nodes → HTML
2. rehypeMark               ==text== → <mark>
3. rehypeImageAttributes    Applies width/class from Obsidian image size markers
4. rehypeFigureCaptions     <img alt="..."> → <figure><img><figcaption>
                            Skips: already-wrapped figures, images inside <a>, class "obsidian-sized"
                            Parses inline markdown in alt text (bold, italic, links, code)
5. rehypeSlug               id= on headings (test: skips h1)
6. rehypeHeadingHighlight   Wraps all heading text in <span class="highlight-span">
                            Required so rough-notation targets text only, not the permalink icon
7. rehypeAutolinkHeadings   Appends permalink SVG icon (test: skips h1; data-no-swup on link)
8. rehypeNormalizeAnchors   LAST — fixes className + href on all anchors
```

**Why highlight before autolink**: Highlight wraps the text content. Autolink appends the icon after. Reversed order would put the icon inside the highlight span.

**`rehypeRebaseLinks`**: Imported but only active when `base !== '/'` (GitHub Pages deployment). Not in the current Cloudflare Workers pipeline.

---

## Graph System

The graph is adapted from [starlight-site-graph](https://github.com/HiDeoo/starlight-site-graph), de-coupled from Starlight and integrated directly into this Astro theme.

### Architecture

```
scripts/generate-graph-data.js
  reads  src/content/posts/**
  builds nodes (posts + tag nodes) + connections + SLSG sitemap
  writes public/graph/graph-data.json     (nodes, connections, metadata)
  writes public/graph/sitemap.json        (per-slug links/backlinks/tags/nodeStyle)

Browser runtime:
SiteGraph.astro (props: mode, currentSlug, config overrides)
  └── Graph.astro (serialises GraphConfig + sitemapUrl as data attributes)
      └── <graph-component> Custom Element
          ├── GraphRenderer   (PixiJS canvas — draws nodes, links, labels)
          └── GraphSimulator  (D3 force simulation — physics, zoom, quadtree hover)
```

### Key files
| File | Role |
|---|---|
| `src/graph/components/graph/Graph.astro` | HTML entry: renders `<graph-component>` custom element |
| `src/graph/components/graph/graph-component.ts` | Custom element class; orchestrates renderer + simulator |
| `src/graph/components/graph/renderer.ts` | PixiJS: draws nodes, links, arrow heads, labels on canvas |
| `src/graph/components/graph/simulator.ts` | D3 force: physics, zoom via d3-zoom, O(log N) quadtree hover |
| `src/graph/components/graph/animatables.ts` | Animated properties (size, opacity, colours) |
| `src/graph/components/graph/preprocess-sitemap.ts` | Converts sitemap JSON → internal `NodeData[]` / `LinkData[]` |
| `src/graph/components/graph/pixi/pixi.js` | **Vendored PixiJS — do not edit** |
| `src/graph/components/animator/` | Animation curves + interpolators |
| `src/graph/components/elements/` | Context menu, popup menu, icon sprites |
| `src/graph/config/graph.ts` | Full `GraphConfig` Zod schema with defaults |
| `src/graph/config/node.ts` | Node style schemas (`nodeDefaultStyle`, etc.) |
| `src/graph/color.ts` | Reads CSS custom properties at runtime → `GraphColorConfig` |
| `src/graph/graph.css` | `.slsg-*` component styles |
| `src/graph/sitemap/browser-utils.ts` | Slug utilities (`ensureLeadingSlash`, `setSlashes`) |

### Display modes via `SiteGraph.astro`
| Mode | Depth | Height | Where used |
|---|---|---|---|
| `sidebar` | 1 (direct neighbours) | 220px | PostLayout left sidebar |
| `modal` | −1 (full graph) | 60vh min | `/graph-embed` page, loaded in an iframe inside `Header.astro`'s modal overlay |
| `hero` | −1 (full graph) | 100vh | `/graph-view` page |

Depth −1 is clamped by `graph-component.ts` `validateConfig()` to `MAX_DEPTH - 1 = 5`; `preprocess-sitemap.ts` treats `depth >= 5` as −1, i.e. render the full graph.

Physics is tuned per mode. Sidebar uses defaults (5–20 nodes). Modal/hero reduces `repelForce` to 80, adds `linkDistance: 50`, increases `alphaDecay` to 0.06 for fast stable layout with 300+ nodes.

### Node colouring
Posts with a `category` get a colour slot from `nodeColor1`–`nodeColor9`. Assignment is deterministic — round-robin by order of first appearance in `generate-graph-data.js`. Colours resolve from CSS custom properties at runtime via `color.ts`.

### Config options (`postOptions.graphView` in `src/config.ts`)
```ts
graphView: {
  enabled: boolean          // gates the whole feature
  showInSidebar: boolean    // local graph in PostLayout sidebar
  maxNodes: number          // cap applied in generate-graph-data.js
  showOrphanedPosts: boolean
}
```

Full `GraphConfig` options (depth, forces, labels, actions, node styles) are configured in `SiteGraph.astro`'s `BASE_CONFIG` and can be overridden per-instance via the `config` prop.

### Swup handling
`<graph-component>` is a Custom Element. When Swup replaces `#swup-container`, the element is re-inserted into the DOM, which triggers the Custom Element lifecycle (`connectedCallback`). No explicit Swup hook needed for the graph itself.

### `GraphModal.astro`
A `<dialog>` containing `SiteGraph mode="modal"`. Opening/closing is managed by inline script in `BaseLayout.astro`. The dialog `backdrop` handles outside-click dismissal.

---

## Search (Pagefind)

### Model
Pagefind is **build-time static search**. After `astro build`, `astro-pagefind` runs pagefind over `dist/`, writing an index to `public/pagefind/`. At runtime, `search.astro` dynamically imports `/pagefind/pagefind.js`.

**No fuse.js. No `posts.json` fetch. No client-side fuzzy matching.** Everything is pre-indexed.

### Entry points
- `src/pages/search.astro` — dedicated `/search` page with full filter UI
- `src/components/CommandPalette.astro` — `Ctrl+K` overlay (uses its own API calls, not the search page)

### Data attributes (in PostLayout)
```html
<article data-pagefind-body>
  <span data-pagefind-meta="title">{title}</span>
  <span data-pagefind-meta="date">{isoDate}</span>
  <span data-pagefind-meta="image">{ogImageUrl}</span>
  <span data-pagefind-filter="tag">{tag}</span>       <!-- one per tag -->
  <span data-pagefind-filter="category">{category}</span>
  <!-- full post body is indexed -->
</article>
```

Elements with `data-pagefind-ignore` (sidebar, navigation, linked mentions) are excluded.

### Filter system
Filters are driven by `data-pagefind-filter` attributes. Client-side via pagefind's filter API:
- **tag** — from `post.data.tags`
- **category** — from `post.data.category`
- **year** — derived from `post.data.date`

### Sub-results
`search.astro` uses pagefind `sub_results` to show all matching sections within a post, giving section-level search precision.

### Gotchas
- Pagefind index only exists after `pnpm build`. Not available during `pnpm dev`. Test search with `pnpm preview`.
- Empty `data-pagefind-filter` elements cause stale filter state — always conditionally render them.
- Mobile search sheet: dismisses only on handle-swipe or content-at-top scroll. Not on arbitrary click — intentional UX.

---

## Marginalia System

Marginalia are side notes that appear in the page margin alongside the paragraph they annotate.

### Syntax

**`.md` files:**
```markdown
This is paragraph text. {{This note appears in the right margin.}}
More text continues after the closing braces.
```

**`.mdx` files:**
MDX treats `{{...}}` as a JS expression and fails to parse. The `escape-marginalia-mdx` Vite integration (registered in `src/integrations/escape-marginalia-mdx.ts`) rewrites `{{...}}` → `⟪...⟫` (U+27EA/U+27EB) before MDX's acorn parser sees the file. `remarkMarginalia` normalises `⟪⟫` → `{{}}` internally before processing.

### Processing flow
```
.md source:   paragraph text {{note}} more text
  ↓ remarkMarginalia
  Scans for {{...}} patterns, assigns IDs (marginalia-0, marginalia-1, ...)
  Replaces {{note}} with: <span data-marginalia-id="0" class="marginalia-inline-marker"></span>
  Stores in remarkPluginFrontmatter.marginaliaEntries: [{ id, content }]

.mdx source:  paragraph text {{note}} more text
  ↓ escape-marginalia-mdx (Vite pre-transform)
  →  paragraph text ⟪note⟫ more text
  ↓ remarkMarginalia (normalises ⟪⟫ → {{}} internally, then processes as above)
```

### Layout integration
`PostLayout.astro` reads `remarkPluginFrontmatter.marginaliaEntries` and renders:
- `Marginalia.astro` — inline (mobile: note appears below its paragraph)
- `MarginaliaDesktop.astro` — absolutely positioned in the right margin (desktop)

`src/scripts/marginalia-client.ts` handles runtime positioning via `requestAnimationFrame`, aligning each note vertically with its marker `<span>`.

### Styles
`src/styles/marginalia.css` — layout, positioning, responsive breakpoints.

### Swup re-init
`marginalia-client.ts` registers `window.initializeMarginalia`. BaseLayout's `page:view` hook calls it after every Swup navigation.

### `remark-restore-marginalia.ts`
An exported alternative plugin that converts `⟪⟫` → `{{}}` in text nodes. Currently not in the active pipeline because `remarkMarginalia` handles this internally. Exists for scenarios where restoration needs to happen in a separate plugin step.

---

## Annotations (rough-notation)

Visual hand-drawn style text annotations via the [rough-notation](https://roughnotation.com/) library.

### Syntax

**Inline:**
```markdown
==highlighted text==       → yellow highlight
!!underlined text!!        → red underline
^^boxed text^^             → orange box
((circled text))           → green circle
||bracketed text||         → purple bracket
```

**Block (whole sentence):**
````markdown
```highlight
This entire sentence gets a highlight annotation.
```
````
Valid block fence languages: `highlight`, `underline`, `box`, `circle`, `bracket`.

### Processing (`remark-annotations.ts`)
Transforms patterns into HTML spans:
```html
<!-- Inline -->
<span class="rough-ann" data-ann-type="highlight">text</span>
<!-- Block -->
<p class="rough-ann" data-ann-type="highlight">Sentence.</p>
```

### Client-side (`src/scripts/annotations-client.ts`)
Finds all `.rough-ann` elements and calls `annotate(el, { type, color })` from rough-notation. Colours come from CSS custom properties:
```css
--ann-highlight, --ann-underline, --ann-box, --ann-circle, --ann-bracket
```
These vars are theme-aware; BaseLayout's `updateThemeCSSVariables()` sets light/dark variants per theme.

### Heading flash on hash navigation
When navigating from a search result with a `#hash`, `toc-client.ts` calls `flashHeadingAnnotation(headingId)` to briefly animate a circle annotation on the target heading. This works because `rehypeHeadingHighlight` wraps heading text in `<span class="highlight-span">` — rough-notation targets the span, not the full heading element (which includes the permalink icon).

### Swup cleanup
rough-notation appends `<svg>` elements directly to `<body>`, outside `#swup-container`. Swup does not remove them on navigation. BaseLayout's `page:view` hook removes all `body > svg.rough-notation-svg` elements before re-running annotations.

### Swup re-init
`annotations-client.ts` registers `window.initializeAnnotations`. Called from BaseLayout's `page:view` hook.

---

## Citations & Bibliography

Academic-style inline citations linked to a generated bibliography section.

### Workflow
```
Zotero → Better BibTeX (auto-export on save)
  → src/content/manuscripts/_refs.bib
  ↓ scripts/parse-bib.mjs  (runs at dev + build time)
  → src/data/global-refs.json  (normalised reference array)
  ↓ remark-citations.ts  (reads global-refs.json once at module init)
  → inline citation HTML + bibliography section appended to post
```

### Markdown syntax
```markdown
This ruling is supported by the hadith [@bukhari-sahih-4321].
```
Renders as a superscript citation number linked to the bibliography at the bottom of the post.

### `scripts/parse-bib.mjs`
- Input: `src/content/manuscripts/_refs.bib` (BibTeX/Better BibTeX format)
- Output: `src/data/global-refs.json` (normalised reference objects)
- If `_refs.bib` doesn't exist: writes `[]` and exits cleanly (no error)
- Accepts `--bib <path>` for a custom input file
- Run standalone: `pnpm parse-bib`

### `src/utils/remark-citations.ts`
- Regex: `/\[@([a-zA-Z0-9_:.-]+)\]/g`
- `global-refs.json` is read once at module import (cached across all files in a build)
- Runs **first** in the remark pipeline to consume `[@...]` before `remarkInternalLinks` processes brackets

---

## OG Image Generation

Dynamic Open Graph images (1200×630 PNG) generated per-post at build time.

### Route
`src/pages/og/[...id].png.ts` — `getStaticPaths` generates one image per post in the `posts` collection.

### Stack
- **satori** — JSX-like element tree → SVG
- **sharp** — SVG → PNG (compression level 8)

### Font loading
Lora Regular 400 and Bold 700 are fetched from Google Fonts API at build time. The request uses an old Safari UA string so Google returns TTF format (satori supports TTF/OTF/WOFF). Fonts are cached at module scope — fetched once per build, reused for every image.

> ⚠️ Build requires network access to `fonts.googleapis.com` + `fonts.gstatic.com`. Offline builds will fail OG image generation with a font fetch error.

### Image priority
1. `banner` frontmatter field → loaded, resized to 1200×630, used as background
2. `image` frontmatter field → same treatment
3. Text-only card → title + description + site name + tags on a styled gradient background

### Homepage OG
The homepage uses the static `public/open-graph.png` file directly (set in `src/utils/seo.ts` `generateHomeSEO()`). This was updated in a recent commit to use the hero image.

### Response headers
`Cache-Control: public, max-age=31536000, immutable` — aggressively cached since content only changes on rebuild.

---

## Bases System

An Obsidian-like content query system. `.base` files define filtered, sorted views of the posts collection, rendered as card or table layout pages.

### What it is
`.base` files live in `src/content/posts/` (co-located with content) or `src/content/bases/`. Each file is YAML that defines one or more views. These become pages at `/base/{slug}/{view-name}`.

### File format
```yaml
name: Aqidah Articles
filter: "hastag('aqidah')"
sort: date
order: desc
limit: 20
view: cards   # or: table
```

### JEXL filter functions
| Function | Description |
|---|---|
| `hastag('tag')` | Post has this tag |
| `infolder('folder')` | Post ID starts with this folder name |
| `hasproperty('field')` | Frontmatter field exists and is truthy |
| `haslink('slug')` | Post contains a wikilink to this slug |
| `stringcontains(field, 'val')` | Field contains substring (case-insensitive by default) |
| `stringstartswith(field, 'val')` | Field starts with value |
| `stringendswith(field, 'val')` | Field ends with value |

### Key files
| File | Role |
|---|---|
| `src/utils/bases/types.ts` | `BaseConfig`, `BaseView`, `Filter`, `Note` interfaces |
| `src/utils/bases/parser.ts` | Parses `.base` YAML → validated `BaseConfig` |
| `src/utils/bases/filter.ts` | `filterNotes(notes, filter, limit)` — applies JEXL expression |
| `src/utils/bases/functions.ts` | JEXL built-in function implementations |
| `src/utils/bases/slugify.ts` | Path → URL slug |
| `src/utils/bases/propertyWrappers.ts` | Note property accessors used in filter context |
| `src/pages/base/[...base].astro` | Route — scans `src/content/posts/**` for `.base` files, `getStaticPaths` |
| `src/pages/base/index.astro` | Index of all base views |
| `src/components/base/CardView.astro` | Card grid layout |
| `src/components/base/TableView.astro` | Table layout with sortable columns |
| `src/components/base/ViewSelector.astro` | Cards / table switcher |
| `src/components/base/BaseToolbar.astro` | Search + filter toolbar |

### Vite asset config
`.base` files are in `vite.assetsInclude` so Vite doesn't try to parse them as modules. Do not attempt to `import` a `.base` file.

### Inline ` ```base ` blocks
`remark-bases.ts` handles fenced ` ```base ` blocks in markdown content. Currently a v1 placeholder — parses `source`, `select`, `limit`, `view` keys and renders a table shell. Full server-side resolution is planned.

---

## Swup Page Transitions & JS Re-initialization

### Configuration (in `astro.config.mjs`)
```js
swup({
  theme: false,
  animationClass: 'transition-swup-',
  containers: ['#swup-container'],
  smoothScrolling: false,
  cache: process.env.NODE_ENV === 'production',
  preload: true,
  accessibility: false,    // prevents invalid tabindex on body
  updateHead: true,
  updateBodyClass: false,
  globalInstance: true,
  reloadScripts: false,    // ← breaks ES module import syntax if enabled
  plugins: [],             // all plugins disabled, including scroll
  skipPopStateHandling: () => true,   // browser handles back/forward natively
  linkSelector: 'a[href]:not([data-no-swup]):not([href^="mailto:"]):not([href^="tel:"])'
})
```

### The core problem
Swup replaces the content of `#swup-container` on every navigation. `DOMContentLoaded` does not re-fire. Event listeners attached to elements inside `#swup-container` are now attached to detached (garbage-collected) DOM nodes.

### The solution pattern
```ts
// In your component <script>
function initializeMyFeature() {
  const el = document.querySelector('.my-element');
  if (!el) return;
  // Clone to strip all old listeners in one operation
  const fresh = el.cloneNode(true) as HTMLElement;
  el.parentNode?.replaceChild(fresh, el);
  // Attach to the fresh element
  fresh.addEventListener('click', myHandler);
}

// Expose globally so BaseLayout can call it
(window as any).initializeMyFeature = initializeMyFeature;

// Initial page load
document.addEventListener('DOMContentLoaded', initializeMyFeature);
```

```js
// In BaseLayout.astro Swup hook
swup.hooks.on('page:view', () => {
  window.initializeMyFeature?.();
  // ... other re-inits
});
```

### Components registered in BaseLayout's `page:view` hook
- `initializeCollapsibleCategories` — category sidebar collapse/expand
- `initializeLinkedMentions` — wikilink hover highlights in linked mentions
- `initializeMarginalia` — margin note positioning
- `initializeAnnotations` — rough-notation annotations
- rough-notation SVG cleanup (removes `body > svg.rough-notation-svg` before re-run)
- Giscus comments — re-created iframe
- Image lightbox — re-wired via `wireImgLightbox()`
- Graph modal — re-wired open/close buttons

### Back/forward navigation
`skipPopStateHandling: () => true` — Swup never intercepts back/forward. Browser handles scroll restoration naturally. This prevents the "jumps to top then scrolls down" bug that `handleInitialHashScroll()` caused when called inside Swup hooks.

### `data-no-swup`
Add to any `<a>` that must not use Swup: RSS/Atom feed links, pagefind search, graph-view links, external links opening same-tab.

### CSS transitions
`src/styles/transition.css` defines `.transition-swup-*` keyframe animations. The `animationClass: 'transition-swup-'` config tells Swup which classes to apply during transitions.

---

## Image Handling

### Two independent systems — never confuse them

#### System 1: Post card images (listing pages)
- **Source**: `post.data.image` frontmatter field
- **Visibility**: `siteConfig.postOptions.showPostCardCoverImages` — `"all"`, `"featured"`, `"home"`, `"posts"`, `"featured-and-posts"`, `"none"`
- **Aspect ratio**: `siteConfig.postOptions.postCardAspectRatio`
- **Rendered by**: `PostCard.astro` → `ImageWrapper.astro`
- **Path resolved by**: `optimizePostImagePath()` in `src/utils/images.ts`
- **Not controlled by**: `hideCoverImage` frontmatter (that's system 2)

#### System 2: Post content images (inside the post body)
- **Source**: markdown `![alt](path)`, Obsidian `![[image.png|caption|500]]`
- **Hero image visibility**: `hideCoverImage: true` frontmatter hides it
- **Processed by**: `remarkObsidianImageSize` → `rehypeImageAttributes` → `rehypeFigureCaptions`
- **Hero gets**: `loading="eager" fetchpriority="high"`

### Image sync (`scripts/sync-images.js`)
Runs at dev + build time. Converts PNG/JPG → WebP (quality 85, 15s timeout). Copies SVGs as-is.

Source → public/ mappings:
```
src/content/posts/attachments/     → public/posts/attachments/
src/content/posts/{folder}/        → public/posts/{folder}/
src/content/bin/pages/attachments/ → public/pages/attachments/
```

### Obsidian image syntax
| Syntax | Meaning |
|---|---|
| `![[image.png]]` | Basic embed |
| `![[image.png\|500]]` | With width (pixels) |
| `![[image.png\|caption\|500]]` | With caption and width |
| `![[image.png\|caption]]` | With caption only |

`remarkObsidianImageSize` parses these. `rehypeImageAttributes` applies width as CSS. `rehypeFigureCaptions` wraps alt-text images in `<figure><figcaption>`.

### Path resolution (`optimizePostImagePath`)
Priority order:
1. External URL → returned as-is
2. Absolute path (`/...`) → returned as-is
3. Relative path with `attachments/` prefix → `/posts/attachments/{name}`
4. Plain filename → `/posts/{postSlug}/{filename}` (co-located)
5. Fallback → `/posts/attachments/placeholder.jpg`

---

## Layouts & Pages

### Layout hierarchy

```
BaseLayout.astro          ← all pages
  ├── PostLayout.astro    ← individual posts
  └── PageLayout.astro    ← static pages + special pages
```

#### `BaseLayout.astro`
Root layout. Responsibilities:
- `<head>`: SEO meta, Open Graph, structured data, font loading, CSS
- Inline theme init script (runs before paint to prevent flash of wrong theme)
- `#swup-container` wrapper
- Header, Footer, Banner
- Swup hooks (`page:view` re-init chain)
- rough-notation SVG cleanup
- Twitter embed init
- Favicon theme-adaptive switching
- `data-*` config attributes for CommandPalette + ThemeSelector client JS
- Google Fonts CDN loader (when `fonts.source === "cdn"`)

#### `PostLayout.astro`
Extends BaseLayout. Adds:
- Three-column layout: **left** (collapsible TOC + local graph) · **centre** (article) · **right** (marginalia)
- Reads `remarkPluginFrontmatter` for reading time, TOC headings, marginalia entries
- `seoData` with OG image URL at `/og/{id}.png`
- `data-pagefind-body` + meta/filter attributes for search indexing
- Breadcrumbs (when `category` or nested post ID)
- LinkedMentions section
- GiscusComments (when enabled)
- Post navigation (prev/next)

#### `PageLayout.astro`
Extends BaseLayout. Simpler layout for static pages — no sidebar, no graph, no comments.

### Pages and routes

```
src/pages/
├── index.astro                          /
├── search.astro                         /search
├── graph-view.astro                     /graph-view
├── 404.astro                            /404
├── feed.xml.ts                          /feed.xml  (Atom)
├── rss.xml.ts                           /rss.xml
├── sitemap.xml.ts                       /sitemap.xml
├── llms.txt.ts                          /llms.txt
├── [..slug].astro                       /{page-id}, /{special-id}
├── posts/
│   ├── index.astro                      /posts
│   ├── [page].astro                     /posts/2, /posts/3, ...
│   ├── [...slug].astro                  /posts/{id}
│   ├── tags.astro                       /posts/tags (all tags index)
│   ├── tag/[...tag].astro               /posts/tag/{tag}
│   ├── tag/[...tag]/[page].astro        /posts/tag/{tag}/2, ...
│   ├── category/[...category].astro     /posts/category/{cat}
│   └── category/[...category]/[page]   /posts/category/{cat}/2, ...
├── base/
│   ├── index.astro                      /base
│   └── [...base].astro                  /base/{slug}/{view-name}
├── api/
│   ├── posts.json.ts                    /api/posts.json
│   ├── pages.json.ts                    /api/pages.json
│   └── files.json.ts                    /api/files.json
└── og/
    └── [...id].png.ts                   /og/{post-id}.png
```

### `[...slug].astro` catch-all
Handles `pages` collection → `PageLayout`, and `special` collection entries (excluding `home`, `404`, `posts` which have dedicated routes or are handled by other pages).

### `llms.txt.ts`
Returns structured plain text at `/llms.txt`:
- Site name, description, URL
- Content structure overview
- All published posts: title, description, URL

---

## Components Reference

### Layout / chrome
| Component | Role |
|---|---|
| `Header.astro` | Nav bar — logo, nav links, ThemeToggle, FeatureButton |
| `Footer.astro` | Social links, profile picture (if `placement: "footer"`) |
| `Banner.astro` | Full-width image strip (when `banner.enable: true`) |
| `HomepageHero.astro` | Homepage hero section with optional dev-notice popup |

### Post UI
| Component | Role |
|---|---|
| `PostCard.astro` | Listing card: image, title, date, tags, category |
| `PostContent.astro` | Article body wrapper |
| `TableOfContents.astro` | Collapsible TOC with heading-highlight on click |
| `LinkedMentions.astro` | "Posts that link here" section with excerpt |
| `Breadcrumbs.astro` | `Posts > [segments] > Title` for categorised/nested posts |
| `Pagination.astro` | Prev/next page navigation |
| `Tags.astro` | Tag pill list |
| `Categories.astro` | Category navigation sidebar |
| `CategoryBar.astro` | Horizontal category filter bar |
| `GiscusComments.astro` | Giscus comment section |
| `ScrollToTop.astro` | Scroll-to-top floating button |

### Media
| Component | Role |
|---|---|
| `ImageWrapper.astro` | Image loader with WebP, placeholder, lazy/eager |
| `ImageGallery.astro` | Responsive grid gallery from `remarkImageGrids` output |
| `ImageGalleryManager.astro` | Manages galleries + wires lightbox |
| `MasonryGallery.astro` | CSS-columns masonry (MDX import). Images rendered client-side from JSON data attr to avoid `ImageGalleryManager` interference |
| `Lightbox.astro` | `<dialog>`-based full-screen image viewer |

### Interactive
| Component | Role |
|---|---|
| `CommandPalette.astro` | `Ctrl+K` overlay — search + navigation + theme switching |
| `SiteGraph.astro` | Graph wrapper (sidebar / modal / hero modes) |
| `GraphModal.astro` | `<dialog>` containing full-graph SiteGraph |
| `ThemeToggle.astro` | Dark/light mode button |
| `ThemeSelector.astro` | Theme picker dropdown |
| `MermaidDiagram.astro` | Mermaid diagram renderer |
| `Icon.astro` | Lucide SVG icon by name |
| `Button.astro` | Styled button (works in prose markdown) |

### Content features
| Component | Role |
|---|---|
| `Marginalia.astro` | Inline margin notes (mobile) |
| `MarginaliaDesktop.astro` | Positioned margin notes (desktop right column) |
| `widget/NavMenuPanel.astro` | Mobile slide-out navigation panel |
| `BaseTable.astro` | Generic data table |
| `base/CardView.astro` | Card grid for base views |
| `base/TableView.astro` | Table layout for base views |
| `base/ViewSelector.astro` | Cards/table toggle |
| `base/BaseToolbar.astro` | Search + filter toolbar for base views |

---

## Scripts Reference

All in `scripts/`. Run by `package.json` in dev/build pipelines.

### Build pipeline order
```bash
# pnpm dev
setup-dev.mjs → sync-images.js → process-aliases.js → generate-deployment-config.js
→ generate-graph-data.js → parse-bib.mjs → generate-callout-css.js → dev-with-port.js

# pnpm build
sync-images.js → process-aliases.js → generate-deployment-config.js
→ generate-graph-data.js --production → parse-bib.mjs → generate-callout-css.js → astro build
```

### `sync-images.js`
Copies images from content to `public/`. Converts PNG/JPG to WebP (quality 85, 15s timeout per file). SVGs copied as-is. Runs for both dev and build.

### `process-aliases.js`
Reads `aliases:` frontmatter from content files. Generates redirect rules for the active deployment platform.

### `generate-graph-data.js`
Reads all posts in `src/content/posts/`. Extracts wikilinks + tags + categories. Writes:
- `public/graph/graph-data.json` — nodes, connections, metadata
- `public/graph/sitemap.json` — per-slug `{exists, title, links, backlinks, tags, nodeStyle}`

In production mode (`--production` flag), suppresses info logs. `maxNodes` is read directly from `src/config.ts`.

### `parse-bib.mjs`
Parses `src/content/manuscripts/_refs.bib` (BibTeX). Writes `src/data/global-refs.json`. Graceful no-op if `.bib` is absent.

### `generate-callout-css.js`
Reads `src/content/.obsidian/plugins/callout-manager/data.json`. Generates:
- `src/styles/callouts-custom.css` — CSS colour vars per custom callout type
- `src/generated/callouts-custom.json` — icon + title metadata for `remark-callouts.ts`

Icon normalisation: strips `lucide-` prefix; detects emoji via non-ASCII character test.

### `generate-deployment-config.js`
Reads `deployment.platform` from `src/config.ts`. Generates platform config files. Preserves existing custom settings (functions, bindings, env vars) when updating.

### `setup-dev.mjs`
Dev-only: checks out the content submodule if not initialised.

### `dev-with-port.js`
Starts dev server on port 5000 (fallback to 5001). Also used for `pnpm preview`.

### `checkout-content-submodule.sh`
Updates `src/content/` to latest submodule commit.

### `check-missing-images.js`
Scans markdown files for image references, reports missing files with location + line number. Run: `pnpm check-images`.

### `fix-broken-image-links.js`
Rewrites broken image link paths in post files. Useful after reorganising content directory structure.

### `get-version.js`
Prints version from `package.json`. Used by `pnpm version`.

### `update.mjs`
Utility for pulling upstream theme updates.

---

## Custom Integrations

Both live in `src/integrations/` and are registered in `astro.config.mjs`.

### `refresh-content-on-change.ts`
Hook: `astro:server:setup`. Adds a Vite file watcher on `src/content/`. On any file change/add/unlink inside the content directory, calls Astro's `refreshContent()` API then sends `full-reload` to the browser. Makes live Obsidian editing update the dev server immediately without manual restarts.

### `escape-marginalia-mdx.ts`
Hook: `astro:config:setup`. Registers a Vite plugin with `enforce: 'pre'`. Transforms `.mdx` source files before MDX's acorn parser: replaces `{{...}}` with `⟪...⟫` (U+27EA/U+27EB).

Edge cases handled:
- Skips fenced code blocks (``` ` `` ` / `~~~` at line start)
- Skips inline backtick spans
- Handles multi-line `{{...}}`
- Skips JSX attribute objects (`style={{ ... }}` — detected by preceding `=`)

This lets authors write `{{margin note}}` in `.mdx` files without MDX parse errors.

---

## Theming System

### Available themes
- `"minimal"` — clean minimal style
- `"custom"` — loads `src/themes/custom/{customThemeFile}.ts`
- `"al-andalus"` — warm parchment palette with Alhambra gold accents (currently active)

### How themes work
Theme files export a map of CSS custom property names → RGB value strings:
```ts
// src/themes/custom/my-theme.ts
export default {
  '--color-primary-50':   '250 247 240',   // RGB only — no rgb() wrapper
  '--color-highlight-500':'180 120 40',
  // ... full scale required
}
```

`BaseLayout.astro` reads the active theme at build time and injects these as inline CSS variables on `<html>`. Tailwind classes like `bg-primary-50` or `text-highlight-500` reference these vars via `tailwind.config.mjs`.

### Dark mode
Tailwind `dark:` variants + `.dark` class on `<html>`. Each theme defines light and dark colour scales. `BaseLayout.updateThemeCSSVariables()` also sets annotation colour vars (`--ann-highlight`, etc.) per theme and mode.

### Colour usage rules
```ts
// ✅ CORRECT — use Tailwind theme classes
@apply bg-primary-50 dark:bg-primary-900
@apply text-highlight-600 dark:text-highlight-400
@apply border-primary-200 dark:border-primary-600

// ❌ WRONG — hardcoded colours break themes
background: white;
color: #1f2937;
border-color: rgb(229, 231, 235);
```

### Adding a custom theme
1. Create `src/themes/custom/my-theme.ts` with the full colour map
2. Set `theme: "custom"` and `customThemeFile: "my-theme"` in `src/config.ts`
3. Run `pnpm dev`

---

## Deployment

**Current platform**: Cloudflare Workers  
**Config**: `wrangler.toml` (Workers format: `assets.directory = "./dist"`)

### Platform switching
Change `deployment.platform` in `src/config.ts`, run `pnpm build`. `generate-deployment-config.js` auto-generates the correct files.

| Platform | Generated |
|---|---|
| `netlify` | `netlify.toml` |
| `vercel` | `vercel.json` |
| `github-pages` | `public/_redirects`, `public/_headers` |
| `cloudflare-workers` | `wrangler.toml`, `public/_redirects`, `public/_headers` |

Custom bindings/functions in existing config files are preserved on update.

### CSP
Content Security Policy is configured natively in `astro.config.mjs` via Astro 6's `csp` key (no middleware needed). Covers scripts (giscus, CDNs), styles (Google Fonts), fonts, images, frames (YouTube).

### Google Sitemap ping
A post-deploy hook pings Google Search Console with the sitemap URL after a successful deploy.

---

## Obsidian Integration

### Vault setup
`src/content/` **is** the Obsidian vault. Open `src/content/` as the vault root in Obsidian.

### Wikilinks
`[[Post Title]]` → `/posts/{slugified-title}`. Processed by `remarkInternalLinks` in `src/utils/internallinks.ts`. **Posts only** — not pages or categories.

### Standard links
`[text](posts/my-post)` works for all content types. Preferred for cross-content-type linking.

### URL mapping
`mapRelativeUrlToSiteUrl()` in `internallinks.ts` handles Obsidian-relative paths:
- `/pages/about` → `/about`
- `/special/home` → `/`
- `pages/contact` → `/contact`

### Callout types
Standard Obsidian callouts (`> [!note]`, `> [!warning]`, etc.) plus custom types defined in the Callout Manager Obsidian plugin. Custom types are read from `.obsidian/plugins/callout-manager/data.json` by `generate-callout-css.js` at build time.

### Aliases (redirects)
The **Alias Filename History** Obsidian plugin stores old filenames in `aliases:` frontmatter when posts are renamed. `process-aliases.js` reads these and generates redirect rules so old URLs continue to work.

### Astro Modular Settings plugin
An Obsidian plugin that reads and writes `src/config.ts` using `// [CONFIG:KEY]` markers to locate each setting. **Never remove these markers** — it breaks the plugin's ability to update config.

### Content workflow
1. Write/edit in Obsidian (vault = `src/content/`)
2. `Ctrl+Shift+S` → git commit + push (Obsidian Git plugin)
3. Parent repo's CI/CD picks up submodule update → build + deploy

### `.base` files in Obsidian
`.base` files in `src/content/bases/` and co-located in posts folders are Obsidian "Bases" (the Obsidian Bases feature). They also render as query view pages in the site via the Bases System (§Bases System). Obsidian and the site both read the same files.
