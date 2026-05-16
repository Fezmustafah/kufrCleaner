# SLSG Graph Engine Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the starlight-site-graph (SLSG) PixiJS/D3 graph engine into kufrCleaner, replacing the existing SVG-based `LocalGraph.astro` + `GraphModal.astro` with a single `SiteGraph.astro` component supporting sidebar, modal, and full-page hero modes.

**Architecture:** The SLSG graph engine is a framework-agnostic web component (`<graph-component>`) backed by PixiJS (WebGL renderer) + D3 force simulation. Copy engine files into `src/graph/`, strip the single Starlight CSS import, adapt the data pipeline to emit SLSG's sitemap format from the existing generator script, then wire through a new `SiteGraph.astro` wrapper. A `data-sitemap-url` fetch mechanism avoids embedding full sitemap JSON in every page's HTML.

**Tech Stack:** PixiJS (bundled locally as `pixi.js` — no npm dep), D3 force simulation (full `d3` npm package), Astro custom elements, `picomatch` for glob filtering, Tailwind CSS + CSS custom properties, TypeScript, `astro:prefetch`.

---

## File Map

### New files (create)
```
src/graph/
├── components/
│   ├── animator/
│   │   ├── animation-curves.ts   copy from SLSG
│   │   ├── animator.ts           copy
│   │   ├── interpolators.ts      copy
│   │   ├── types.d.ts            copy
│   │   └── index.ts              copy
│   ├── graph/
│   │   ├── Graph.astro           adapted (strip CSS import, add sitemapUrl prop)
│   │   ├── graph-component.ts    adapted (add data-sitemap-url async fetch path)
│   │   ├── renderer.ts           copy
│   │   ├── simulator.ts          copy
│   │   ├── preprocess-sitemap.ts copy
│   │   ├── animatables.ts        copy
│   │   ├── constants.ts          copy
│   │   ├── action-element.ts     copy
│   │   ├── types.d.ts            copy
│   │   └── pixi/
│   │       ├── pixi.js           copy (bundled PixiJS, no npm dep needed)
│   │       └── pixi.d.ts         copy
│   ├── elements/
│   │   ├── context-menu.ts       copy
│   │   ├── popup-menu.ts         copy
│   │   └── icons.ts              copy
│   └── util.ts                   copy
├── config/
│   ├── graph.ts                  copy
│   ├── node.ts                   copy
│   ├── sitemap.ts                copy
│   ├── base.ts                   copy
│   └── index.ts                  copy
├── sitemap/
│   └── browser-utils.ts          copy
├── global.d.ts                   copy
├── color.ts                      adapted (replace chroma with canvas-based parser)
└── graph.css                     new (CSS vars mapped to kufrCleaner color system)

src/components/SiteGraph.astro    new wrapper (sidebar | modal | hero modes)
src/pages/graph-view.astro        new hero graph page (homepage socket)
```

### Modified files
```
package.json                      add d3, picomatch, @types/d3, @types/picomatch
astro.config.mjs                  add prefetch: true; add @/graph vite alias
scripts/gen-graph-data.js         add SLSG sitemap format output
src/layouts/PostLayout.astro      replace <LocalGraph> with <SiteGraph mode="sidebar">
src/layouts/BaseLayout.astro      remove local-graph-client.ts global import
src/components/Header.astro       embed modal shell + SiteGraph, add open/close script
```

### Deleted files
```
src/components/LocalGraph.astro
src/components/GraphModal.astro
src/scripts/local-graph-client.ts
src/utils/graph-theme-colors.ts
```

---

## Task 1: Add dependencies and enable prefetch

**Files:**
- Modify: `package.json`
- Modify: `astro.config.mjs`

- [ ] **Step 1: Install d3 and picomatch**

Run from the kufrCleaner directory:

```bash
pnpm add d3 picomatch
pnpm add -D @types/d3 @types/picomatch
```

Expected: packages added to `pnpm-lock.yaml` and `package.json` dependencies.

- [ ] **Step 2: Enable Astro prefetch in astro.config.mjs**

Open `astro.config.mjs`. Find `export default defineConfig({` and add `prefetch: true` as a top-level option:

```js
export default defineConfig({
  site: siteConfig.site,
  prefetch: true,          // ← add this line
  // ... rest of config unchanged
```

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml astro.config.mjs
git commit -m "feat: add d3, picomatch deps; enable astro prefetch for graph port"
```

---

## Task 2: Create src/graph/ directory and copy engine files

**Files:** All files in the File Map marked "copy"

- [ ] **Step 1: Create directory structure**

```bash
DEST="src/graph"
mkdir -p "$DEST/components/animator"
mkdir -p "$DEST/components/graph/pixi"
mkdir -p "$DEST/components/elements"
mkdir -p "$DEST/config"
mkdir -p "$DEST/sitemap"
```

- [ ] **Step 2: Copy animator files**

```bash
SLSG="/c/Users/user1/Documents/GitHub/starlight-site-graph/packages/starlight-site-graph"
DEST="src/graph"

cp "$SLSG/components/animator/animation-curves.ts" "$DEST/components/animator/"
cp "$SLSG/components/animator/animator.ts"         "$DEST/components/animator/"
cp "$SLSG/components/animator/interpolators.ts"    "$DEST/components/animator/"
cp "$SLSG/components/animator/types.d.ts"          "$DEST/components/animator/"
cp "$SLSG/components/animator/index.ts"            "$DEST/components/animator/"
```

- [ ] **Step 3: Copy graph engine files (all except graph-component.ts and Graph.astro — those get adapted in Tasks 3 and 6)**

```bash
SLSG="/c/Users/user1/Documents/GitHub/starlight-site-graph/packages/starlight-site-graph"
DEST="src/graph"

cp "$SLSG/components/graph/renderer.ts"           "$DEST/components/graph/"
cp "$SLSG/components/graph/simulator.ts"          "$DEST/components/graph/"
cp "$SLSG/components/graph/preprocess-sitemap.ts" "$DEST/components/graph/"
cp "$SLSG/components/graph/animatables.ts"        "$DEST/components/graph/"
cp "$SLSG/components/graph/constants.ts"          "$DEST/components/graph/"
cp "$SLSG/components/graph/action-element.ts"     "$DEST/components/graph/"
cp "$SLSG/components/graph/types.d.ts"            "$DEST/components/graph/"
cp "$SLSG/components/graph/pixi/pixi.js"          "$DEST/components/graph/pixi/"
cp "$SLSG/components/graph/pixi/pixi.d.ts"        "$DEST/components/graph/pixi/"
```

- [ ] **Step 4: Copy elements, util, config, sitemap, and root files**

```bash
SLSG="/c/Users/user1/Documents/GitHub/starlight-site-graph/packages/starlight-site-graph"
DEST="src/graph"

cp "$SLSG/components/elements/context-menu.ts" "$DEST/components/elements/"
cp "$SLSG/components/elements/popup-menu.ts"   "$DEST/components/elements/"
cp "$SLSG/components/elements/icons.ts"        "$DEST/components/elements/"
cp "$SLSG/components/util.ts"                  "$DEST/components/"

cp "$SLSG/config/graph.ts"   "$DEST/config/"
cp "$SLSG/config/node.ts"    "$DEST/config/"
cp "$SLSG/config/sitemap.ts" "$DEST/config/"
cp "$SLSG/config/base.ts"    "$DEST/config/"
cp "$SLSG/config/index.ts"   "$DEST/config/"

cp "$SLSG/sitemap/browser-utils.ts" "$DEST/sitemap/"
cp "$SLSG/global.d.ts"              "$DEST/"
```

- [ ] **Step 5: Verify all files are in place**

```bash
find src/graph -type f | sort
```

Expected: ~24 files across the directory tree, excluding `graph-component.ts`, `Graph.astro`, `color.ts`, `graph.css` (those are created in later tasks).

---

## Task 3: Create adapted graph-component.ts (add sitemap-url fetch)

**Files:**
- Create: `src/graph/components/graph/graph-component.ts`

The original reads `this.dataset['sitemap']` synchronously. We add a `data-sitemap-url` path that fetches lazily, keeping full sitemap JSON out of every page's HTML.

- [ ] **Step 1: Copy graph-component.ts from SLSG**

```bash
SLSG="/c/Users/user1/Documents/GitHub/starlight-site-graph/packages/starlight-site-graph"
cp "$SLSG/components/graph/graph-component.ts" "src/graph/components/graph/"
```

- [ ] **Step 2: Make connectedCallback async**

Open `src/graph/components/graph/graph-component.ts`. Find the `connectedCallback()` method signature and add `async`:

```ts
// BEFORE
connectedCallback() {

// AFTER
async connectedCallback() {
```

- [ ] **Step 3: Replace the sitemap parsing line**

Inside `connectedCallback`, find this line:

```ts
this.sitemap = JSON.parse(this.dataset['sitemap'] || '{}');
```

Replace it with:

```ts
const sitemapUrl = this.dataset['sitemapUrl'];
if (sitemapUrl) {
    this.sitemap = await fetch(sitemapUrl).then(r => r.json()).catch(() => ({}));
} else {
    this.sitemap = JSON.parse(this.dataset['sitemap'] || '{}');
}
```

- [ ] **Step 4: Verify the change**

```bash
grep -n "sitemapUrl\|dataset\['sitemap'\]" src/graph/components/graph/graph-component.ts
```

Expected: shows the new `sitemapUrl` branch and the fallback line.

---

## Task 4: Adapt color.ts (replace chroma with canvas parser)

**Files:**
- Create: `src/graph/color.ts`

- [ ] **Step 1: Copy color.ts from SLSG**

```bash
SLSG="/c/Users/user1/Documents/GitHub/starlight-site-graph/packages/starlight-site-graph"
cp "$SLSG/color.ts" "src/graph/"
```

- [ ] **Step 2: Find the chroma import line**

```bash
grep -n "chroma" src/graph/color.ts | head -5
```

Note the exact import line (e.g., `import chroma from 'chroma-js'`).

- [ ] **Step 3: Delete the chroma import line**

Open `src/graph/color.ts` and delete whatever line imports `chroma`.

- [ ] **Step 4: Replace the getHexColor function body**

Find this function (body may differ slightly — the key is the `chroma(...)` call):

```ts
function getHexColor(color: string): string {
    let hex_color: string;
    try {
        hex_color = chroma(color.trim()).hex();
    } catch (e) {
        hex_color = '#000000';
    }
    return hex_color;
}
```

Replace the entire function with:

```ts
function getHexColor(color: string): string {
    const trimmed = color.trim();
    if (!trimmed) return '#000000';
    if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed;
    if (/^#[0-9A-Fa-f]{3}$/.test(trimmed)) {
        return '#' + trimmed[1].repeat(2) + trimmed[2].repeat(2) + trimmed[3].repeat(2);
    }
    try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = trimmed;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return '#' + r.toString(16).padStart(2, '0')
                   + g.toString(16).padStart(2, '0')
                   + b.toString(16).padStart(2, '0');
    } catch {
        return '#888888';
    }
}
```

- [ ] **Step 5: Verify no chroma reference remains**

```bash
grep "chroma" src/graph/color.ts
```

Expected: no output.

---

## Task 5: Create graph.css

**Files:**
- Create: `src/graph/graph.css`

SLSG's renderer reads `--slsg-*` CSS variables via `getComputedStyle` and converts them to hex for PixiJS. Define these mapped to kufrCleaner's `--color-*` vars. All values are hex so the canvas parser in color.ts works correctly.

- [ ] **Step 1: Create src/graph/graph.css**

```css
/* ── SLSG CSS custom properties — light mode ─────────────────────────────── */
:root {
    --slsg-graph-bg-color: transparent;

    --slsg-node-color:          #94a3b8;
    --slsg-node-color-hover:    #60a5fa;
    --slsg-node-color-adjacent: #cbd5e1;
    --slsg-node-color-muted:    #e2e8f0;

    --slsg-node-color-current:    #f59e0b;
    --slsg-node-color-visited:    #64748b;
    --slsg-node-color-unresolved: #cbd5e1;
    --slsg-node-color-external:   #94a3b8;
    --slsg-node-color-tag:        #93c5fd;

    /* Category color slots nodeColor1–9 */
    --slsg-node-color-1: #f87171;
    --slsg-node-color-2: #fb923c;
    --slsg-node-color-3: #facc15;
    --slsg-node-color-4: #4ade80;
    --slsg-node-color-5: #34d399;
    --slsg-node-color-6: #60a5fa;
    --slsg-node-color-7: #818cf8;
    --slsg-node-color-8: #c084fc;
    --slsg-node-color-9: #f472b6;

    --slsg-link-color:       #cbd5e1;
    --slsg-link-color-hover: #60a5fa;
    --slsg-link-color-muted: #e2e8f0;

    --slsg-label-color:       #334155;
    --slsg-label-color-hover: #0f172a;
    --slsg-label-color-muted: #94a3b8;
}

/* ── Dark mode ───────────────────────────────────────────────────────────── */
.dark,
[data-theme='dark'] {
    --slsg-node-color:          #94a3b8;
    --slsg-node-color-hover:    #93c5fd;
    --slsg-node-color-adjacent: #475569;
    --slsg-node-color-muted:    #1e293b;

    --slsg-node-color-current:    #fcd34d;
    --slsg-node-color-visited:    #64748b;
    --slsg-node-color-unresolved: #334155;
    --slsg-node-color-external:   #475569;
    --slsg-node-color-tag:        #60a5fa;

    --slsg-link-color:       #334155;
    --slsg-link-color-hover: #60a5fa;
    --slsg-link-color-muted: #1e293b;

    --slsg-label-color:       #e2e8f0;
    --slsg-label-color-hover: #f8fafc;
    --slsg-label-color-muted: #475569;
}

/* ── Graph container ─────────────────────────────────────────────────────── */
.slsg-graph-component {
    display: block;
    position: relative;
    width: 100%;
    height: 100%;
}

.slsg-graph-container {
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: 0.25rem;
    cursor: default;
    outline: none;
}

.slsg-graph-container:focus-visible {
    outline: 2px solid #60a5fa;
}

/* Loading skeleton */
.slsg-graph-skeleton {
    background: #f1f5f9;
    border-radius: 0.25rem;
    animation: slsg-pulse 2s ease-in-out infinite;
}
.dark .slsg-graph-skeleton,
[data-theme='dark'] .slsg-graph-skeleton {
    background: #1e293b;
}
@keyframes slsg-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.5; }
}

/* ── Action toolbar ──────────────────────────────────────────────────────── */
.slsg-graph-action-container {
    position: absolute;
    top: 0.375rem;
    right: 0.375rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    z-index: 10;
}

.slsg-graph-action-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    border: 1px solid #e2e8f0;
    border-radius: 0.25rem;
    background: rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(4px);
    color: #475569;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.dark .slsg-graph-action-button,
[data-theme='dark'] .slsg-graph-action-button {
    background: rgba(15, 23, 42, 0.88);
    border-color: #334155;
    color: #cbd5e1;
}
.slsg-graph-action-button:hover {
    border-color: #60a5fa;
    color: #2563eb;
    background: rgba(255, 255, 255, 0.97);
}
.dark .slsg-graph-action-button:hover,
[data-theme='dark'] .slsg-graph-action-button:hover {
    border-color: #60a5fa;
    color: #93c5fd;
    background: rgba(15, 23, 42, 0.97);
}
.slsg-graph-action-button svg {
    width: 0.875rem;
    height: 0.875rem;
    pointer-events: none;
}

/* ── Context / right-click menu ─────────────────────────────────────────── */
.slsg-context-menu {
    position: fixed;
    z-index: 9999;
    min-width: 10rem;
    padding: 0.25rem;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
    font-size: 0.8125rem;
}
.dark .slsg-context-menu,
[data-theme='dark'] .slsg-context-menu {
    background: #0f172a;
    border-color: #334155;
}
.slsg-context-menu-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.625rem;
    border-radius: 0.25rem;
    cursor: pointer;
    color: #334155;
    transition: background 0.1s;
}
.dark .slsg-context-menu-item,
[data-theme='dark'] .slsg-context-menu-item {
    color: #e2e8f0;
}
.slsg-context-menu-item:hover { background: #f1f5f9; }
.dark .slsg-context-menu-item:hover,
[data-theme='dark'] .slsg-context-menu-item:hover { background: #1e293b; }

/* ── Settings popup ──────────────────────────────────────────────────────── */
.slsg-popup-menu {
    position: absolute;
    z-index: 100;
    padding: 0.75rem;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
    min-width: 14rem;
    font-size: 0.8125rem;
    color: #334155;
}
.dark .slsg-popup-menu,
[data-theme='dark'] .slsg-popup-menu {
    background: #0f172a;
    border-color: #334155;
    color: #e2e8f0;
}
.slsg-popup-menu label {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    margin-bottom: 0.25rem;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.slsg-slider {
    width: 100%;
    accent-color: #60a5fa;
}

/* ── Fullscreen mode ─────────────────────────────────────────────────────── */
.slsg-graph-component.slsg-fullscreen {
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 9998;
    border-radius: 0;
}

.slsg-background-blur {
    position: fixed;
    inset: 0;
    z-index: 9997;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
}
```

- [ ] **Step 2: Verify file line count**

```bash
wc -l src/graph/graph.css
```

Expected: 150+ lines.

---

## Task 6: Create adapted Graph.astro

**Files:**
- Create: `src/graph/components/graph/Graph.astro`

- [ ] **Step 1: Write src/graph/components/graph/Graph.astro**

```astro
---
import type { GraphConfig, Sitemap } from '../../config';

interface Props {
    slug: string;
    config: GraphConfig;
    sitemapUrl?: string;
    sitemap?: Sitemap;
    debug?: boolean;
    trailingSlashes?: boolean;
}

const {
    config,
    sitemap,
    sitemapUrl,
    slug,
    debug = false,
    trailingSlashes = false,
} = Astro.props;
---

<div class="slsg-graph-component slsg-graph-skeleton">
    <div class="slsg-graph-container" />
</div>
<graph-component
    data-config={JSON.stringify(config)}
    data-sitemap={sitemap ? JSON.stringify(sitemap) : undefined}
    data-sitemap-url={sitemapUrl}
    data-slug={slug}
    data-debug={String(debug)}
    data-trailing-slashes={String(trailingSlashes)}
></graph-component>

<script>
    import { GraphComponent } from './graph-component';
    if (!customElements.get('graph-component')) {
        customElements.define('graph-component', GraphComponent);
    }
</script>
```

- [ ] **Step 2: Verify file created**

```bash
test -f src/graph/components/graph/Graph.astro && echo "OK"
```

Expected: `OK`

---

## Task 7: Upgrade gen-graph-data.js to SLSG sitemap format

**Files:**
- Modify: `scripts/gen-graph-data.js`

Adds a second output file `public/graph/sitemap.json` in SLSG format. The existing `graph-data.json` output is preserved temporarily for rollback safety and removed in Task 13.

- [ ] **Step 1: Add SITEMAP_FILE constant after OUTPUT_FILE**

Open `scripts/gen-graph-data.js`. Find:

```js
const OUTPUT_FILE = join(OUTPUT_DIR, "graph-data.json");
```

Add the new constant below it:

```js
const SITEMAP_FILE = join(OUTPUT_DIR, "sitemap.json");
```

- [ ] **Step 2: Add category color mapper after the constants block**

After the `OUTPUT_FILE`/`SITEMAP_FILE` lines, add:

```js
// Deterministic category → nodeColor1-9 slot assignment
const CATEGORY_COLORS = [
  "nodeColor1","nodeColor2","nodeColor3","nodeColor4","nodeColor5",
  "nodeColor6","nodeColor7","nodeColor8","nodeColor9",
];
const _categoryColorMap = new Map();
function getColorForCategory(category) {
  if (!category) return undefined;
  if (!_categoryColorMap.has(category)) {
    _categoryColorMap.set(category, CATEGORY_COLORS[_categoryColorMap.size % CATEGORY_COLORS.length]);
  }
  return _categoryColorMap.get(category);
}
```

- [ ] **Step 3: Add SLSG sitemap generation inside generateGraphData()**

Inside `generateGraphData()`, find the section where `filteredPosts` is available and `writeFileSync` writes `graph-data.json`. Add the following block **before** that `writeFileSync` call:

```js
  // ── Build SLSG sitemap format ───────────────────────────────────────────
  const sitemap = {};

  // Collect all valid post slugs for link validation
  const validPostSlugs = new Set(filteredPosts.map(p => `posts/${p.id}`));

  // First pass: each post → sitemap entry with outgoing links + tags
  for (const post of filteredPosts) {
    const slug = `posts/${post.id}`;
    const category = post.data?.category ?? null;
    const tags = (post.data?.tags ?? []).filter(Boolean);

    // Collect outgoing wikilinks to other posts
    const rawWikilinks = extractWikilinks(post.body ?? "");
    const outgoingLinks = [...new Set(
      rawWikilinks
        .map(w => `posts/${w.slug}`)
        .filter(s => validPostSlugs.has(s) && s !== slug)
    )];

    sitemap[slug] = {
      exists: true,
      external: false,
      title: post.data?.title ?? post.id,
      links: outgoingLinks,
      backlinks: [],        // filled in second pass
      tags,
      ...(category ? { nodeStyle: { shapeColor: getColorForCategory(category) } } : {}),
    };
  }

  // Add synthetic tag nodes
  const allTags = new Set();
  for (const post of filteredPosts) {
    for (const tag of post.data?.tags ?? []) {
      if (tag) allTags.add(tag);
    }
  }
  for (const tag of allTags) {
    sitemap[`tag:${tag}`] = {
      exists: true,
      external: false,
      title: tag,
      links: [],
      backlinks: [],
      tags: [],
    };
  }

  // Second pass: invert links → backlinks
  for (const [slug, entry] of Object.entries(sitemap)) {
    for (const target of entry.links ?? []) {
      if (sitemap[target]) {
        sitemap[target].backlinks.push(slug);
      }
    }
  }

  writeFileSync(SITEMAP_FILE, JSON.stringify(sitemap, null, 2));
  log.info(`✅ SLSG sitemap: ${Object.keys(sitemap).length} entries → ${SITEMAP_FILE}`);
  // ─────────────────────────────────────────────────────────────────────────
```

Note: The function name `extractWikilinks` must match what is already defined in the script. Run `grep "function extract" scripts/gen-graph-data.js` to confirm the exact name and adjust if it differs.

- [ ] **Step 4: Run the generator and verify output**

```bash
node scripts/gen-graph-data.js
```

Expected: prints `✅ SLSG sitemap: NNN entries → public/graph/sitemap.json`

- [ ] **Step 5: Spot-check the sitemap structure**

```bash
node -e "
const s = JSON.parse(require('fs').readFileSync('public/graph/sitemap.json','utf-8'));
const keys = Object.keys(s);
console.log('Total entries:', keys.length);
const sample = keys.find(k => k.startsWith('posts/'));
console.log('Sample entry:', JSON.stringify(s[sample], null, 2));
"
```

Expected: shows `exists`, `external`, `title`, `links[]`, `backlinks[]`, `tags[]` fields.

- [ ] **Step 6: Commit**

```bash
git add scripts/gen-graph-data.js public/graph/sitemap.json
git commit -m "feat: upgrade graph generator to SLSG sitemap format (backlinks + category colors)"
```

---

## Task 8: Add @/graph alias to astro.config.mjs

**Files:**
- Modify: `astro.config.mjs`

- [ ] **Step 1: Add the alias**

In `astro.config.mjs`, inside the `vite.resolve.alias` object, add:

```js
'@/graph': fileURLToPath(new URL('./src/graph', import.meta.url)),
```

The alias block should now look like:

```js
alias: {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
  '@/components': fileURLToPath(new URL('./src/components', import.meta.url)),
  '@/layouts':    fileURLToPath(new URL('./src/layouts', import.meta.url)),
  '@/utils':      fileURLToPath(new URL('./src/utils', import.meta.url)),
  '@/types':      fileURLToPath(new URL('./src/types.ts', import.meta.url)),
  '@/config':     fileURLToPath(new URL('./src/config.ts', import.meta.url)),
  '@/graph':      fileURLToPath(new URL('./src/graph', import.meta.url)),  // ← new
}
```

- [ ] **Step 2: Commit**

```bash
git add astro.config.mjs
git commit -m "chore: add @/graph vite alias for SLSG engine"
```

---

## Task 9: Create SiteGraph.astro wrapper

**Files:**
- Create: `src/components/SiteGraph.astro`

- [ ] **Step 1: Write src/components/SiteGraph.astro**

```astro
---
import type { GraphConfig } from '@/graph/config';
import Graph from '@/graph/components/graph/Graph.astro';
import '@/graph/graph.css';

export type GraphMode = 'sidebar' | 'modal' | 'hero';

interface Props {
    mode: GraphMode;
    currentSlug?: string;
    config?: Partial<GraphConfig>;
    class?: string;
}

const {
    mode,
    currentSlug = '',
    config: configOverride = {},
    class: className,
} = Astro.props;

const base = import.meta.env.BASE_URL;
const sitemapUrl = `${base}graph/sitemap.json`;

const BASE_CONFIG: Partial<GraphConfig> = {
    depth: mode === 'sidebar' ? 1 : -1,
    scale: mode === 'sidebar' ? 1.0 : 1.1,
    enableDrag: true,
    enableZoom: true,
    enablePan: true,
    enableHover: true,
    enableClick: 'auto',
    renderLabels: true,
    renderArrows: false,
    renderUnresolved: false,
    renderExternal: false,
    actions: mode === 'sidebar'
        ? ['fullscreen', 'depth', 'reset-zoom']
        : ['fullscreen', 'depth', 'reset-zoom', 'render-arrows', 'settings'],
    prefetchPages: true,
};

const graphConfig = { ...BASE_CONFIG, ...configOverride } as GraphConfig;
---

<div class:list={['slsg-wrapper', `slsg-mode-${mode}`, className]}>
    <Graph
        slug={currentSlug}
        config={graphConfig}
        sitemapUrl={sitemapUrl}
        trailingSlashes={false}
    />
</div>

<style is:global>
.slsg-wrapper { display: block; width: 100%; height: 100%; }

.slsg-mode-sidebar { height: 220px; }
.slsg-mode-modal   { height: 100%; min-height: 60vh; }
.slsg-mode-hero    { width: 100vw; height: 100vh; }
</style>
```

- [ ] **Step 2: Verify file created**

```bash
test -f src/components/SiteGraph.astro && echo "OK"
```

Expected: `OK`

---

## Task 10: Create hero graph page

**Files:**
- Create: `src/pages/graph-view.astro`

This is the homepage socket — a full-viewport graph page accessible at `/graph-view`. When the babilim-style homepage redesign happens, this becomes the new `index.astro`.

- [ ] **Step 1: Write src/pages/graph-view.astro**

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
import SiteGraph from '@/components/SiteGraph.astro';
import { siteConfig } from '@/config';

const title = `${siteConfig.title} — Knowledge Graph`;
const description = 'Interactive knowledge graph of all posts and their connections.';
---

<BaseLayout title={title} description={description}>
    <div class="graph-hero-wrapper">
        <SiteGraph mode="hero" currentSlug="" />
    </div>
</BaseLayout>

<style>
.graph-hero-wrapper {
    position: fixed;
    inset: 0;
    z-index: 0;
}
</style>
```

---

## Task 11: Replace LocalGraph in PostLayout.astro

**Files:**
- Modify: `src/layouts/PostLayout.astro`

- [ ] **Step 1: Replace the LocalGraph import**

Open `src/layouts/PostLayout.astro`. Find:

```ts
import LocalGraph from '@/components/LocalGraph.astro';
```

Replace with:

```ts
import SiteGraph from '@/components/SiteGraph.astro';
```

- [ ] **Step 2: Replace the hasLocalGraphConnections check**

Find the entire `hasLocalGraphConnections` block that reads `graph-data.json` (it uses `readFileSync` and checks if the current post has connections). Replace the entire block with:

```ts
let hasLocalGraphConnections = false;
if (siteConfig.postOptions.graphView.enabled && siteConfig.postOptions.graphView.showInSidebar) {
  try {
    const sitemapPath = join(process.cwd(), 'public', 'graph', 'sitemap.json');
    const sitemap = JSON.parse(readFileSync(sitemapPath, 'utf-8'));
    const entry = sitemap[`posts/${post.id}`];
    hasLocalGraphConnections = !!(
      (entry?.links?.length ?? 0) > 0 || (entry?.backlinks?.length ?? 0) > 0
    );
  } catch {
    hasLocalGraphConnections = false;
  }
}
```

- [ ] **Step 3: Replace the JSX usage**

Find:

```astro
<LocalGraph currentSlug={post.id} />
```

Replace with:

```astro
<SiteGraph mode="sidebar" currentSlug={post.id} />
```

- [ ] **Step 4: Verify no LocalGraph reference remains**

```bash
grep "LocalGraph" src/layouts/PostLayout.astro
```

Expected: no output.

---

## Task 12: Remove local-graph-client from BaseLayout.astro

**Files:**
- Modify: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: Find the import**

```bash
grep -n "local-graph" src/layouts/BaseLayout.astro
```

Note the line number(s).

- [ ] **Step 2: Delete the import line or script tag**

Open `src/layouts/BaseLayout.astro` and delete whatever line/block imports `local-graph-client`. If it's a standalone `<script>import '@/scripts/local-graph-client'</script>`, delete the whole tag.

- [ ] **Step 3: Verify removal**

```bash
grep "local-graph" src/layouts/BaseLayout.astro
```

Expected: no output.

---

## Task 13: Embed modal graph in Header.astro

**Files:**
- Modify: `src/components/Header.astro`

The header has `#header-graph-button` (shown when `siteConfig.featureButton === 'graph'`). We embed a pre-rendered `SiteGraph` in a hidden modal overlay and wire the button to show/hide it.

- [ ] **Step 1: Add SiteGraph import to Header.astro frontmatter**

Open `src/components/Header.astro`. In the frontmatter (`---` block), add:

```ts
import SiteGraph from '@/components/SiteGraph.astro';
```

- [ ] **Step 2: Add modal shell at the bottom of Header.astro's template**

Before the final closing tag of the component, add:

```astro
{siteConfig.postOptions.graphView.enabled && (
    <div
        id="graph-modal-overlay"
        class="graph-modal-overlay hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Knowledge graph"
    >
        <button id="graph-modal-close" class="graph-modal-close" aria-label="Close graph">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
        </button>
        <div class="graph-modal-body">
            <SiteGraph mode="modal" currentSlug="" />
        </div>
    </div>
)}
```

- [ ] **Step 3: Add open/close script to Header.astro**

Add a `<script>` tag (Astro hoists these — no Swup issue):

```astro
<script>
function initGraphModal() {
    const btn     = document.getElementById('header-graph-button');
    const overlay = document.getElementById('graph-modal-overlay');
    const close   = document.getElementById('graph-modal-close');
    if (!btn || !overlay) return;

    const open  = () => { overlay.classList.remove('hidden'); document.body.style.overflow = 'hidden'; };
    const shut  = () => { overlay.classList.add('hidden');    document.body.style.overflow = ''; };

    btn.addEventListener('click', open);
    close?.addEventListener('click', shut);
    overlay.addEventListener('click', e => { if (e.target === overlay) shut(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !overlay.classList.contains('hidden')) shut(); });
}
document.addEventListener('astro:page-load', initGraphModal);
</script>
```

- [ ] **Step 4: Add modal styles to Header.astro**

```astro
<style>
.graph-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 9990;
    background: rgba(0, 0, 0, 0.72);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: stretch;
}
.graph-modal-overlay.hidden { display: none; }

.graph-modal-body {
    flex: 1;
    position: relative;
}

.graph-modal-close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 9991;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.25);
    background: rgba(0,0,0,0.5);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
}
.graph-modal-close:hover { background: rgba(0,0,0,0.75); }
</style>
```

- [ ] **Step 5: Verify no GraphModal reference remains**

```bash
grep "GraphModal" src/components/Header.astro
```

Expected: no output.

---

## Task 14: Delete old graph files

**Files:**
- Delete: `src/components/LocalGraph.astro`
- Delete: `src/components/GraphModal.astro`
- Delete: `src/scripts/local-graph-client.ts`
- Delete: `src/utils/graph-theme-colors.ts`

- [ ] **Step 1: Confirm no remaining imports of these files**

```bash
grep -r "LocalGraph\|GraphModal\|local-graph-client\|graph-theme-colors" src/ --include="*.astro" --include="*.ts" --include="*.tsx"
```

Expected: no matches. If any matches remain, fix them before deleting.

- [ ] **Step 2: Delete the files**

```bash
rm src/components/LocalGraph.astro
rm src/components/GraphModal.astro
rm src/scripts/local-graph-client.ts
rm src/utils/graph-theme-colors.ts
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: complete SLSG graph port — remove old LocalGraph/GraphModal/client"
```

---

## Task 15: Verify TypeScript and dev server

**Files:** None — verification only.

- [ ] **Step 1: Run TypeScript check**

```bash
pnpm exec tsc --noEmit --skipLibCheck 2>&1
```

Fix any errors. Most common issues and fixes:
- **`picomatch` import error**: ensure `@types/picomatch` was installed (Task 1)
- **`d3` import error in simulator.ts**: ensure `@types/d3` was installed (Task 1)
- **`astro:prefetch` module not found**: ensure `prefetch: true` in astro.config.mjs (Task 1 Step 2)
- **Import path mismatch in copied files**: all SLSG internal imports use relative paths (e.g., `../../config`) which resolve correctly because we mirrored the directory structure

- [ ] **Step 2: Run graph generator**

```bash
node scripts/gen-graph-data.js
```

Expected: both `public/graph/graph-data.json` and `public/graph/sitemap.json` written.

- [ ] **Step 3: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 4: Verify sidebar graph (mode="sidebar")**

Navigate to any post that has wikilinks to/from other posts. The left sidebar should show the SLSG graph with a depth/fullscreen/zoom-reset toolbar instead of the old SVG graph.

- [ ] **Step 5: Verify modal graph (mode="modal")**

Click the graph icon button in the header (`siteConfig.featureButton === 'graph'` must be set in `src/config.ts`). The modal overlay should open with the full WebGL graph.

- [ ] **Step 6: Verify hero graph page**

Navigate to `/graph-view` (or with BASE_URL prefix). The full-viewport graph should render.

- [ ] **Step 7: Verify Swup navigation**

Click a graph node to navigate to another post. Navigate back. The sidebar graph on the new post should render correctly (the custom element re-initializes via `connectedCallback`).

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat: SLSG WebGL graph port complete — sidebar, modal, hero modes"
```

---

## Self-Review

**Spec coverage:**
- ✅ PixiJS WebGL renderer replaces SVG
- ✅ D3 force simulation (full `d3` package)
- ✅ Sidebar mode with SLSG built-in toolbar (depth/fullscreen/reset-zoom) — matches user request
- ✅ Modal mode replaces GraphModal.astro
- ✅ Hero mode at `/graph-view` as homepage socket for future babilim-style redesign
- ✅ Category → `nodeColor1-9` color slots from frontmatter `category` field
- ✅ `tags[]` from frontmatter passed through to SLSG sitemap
- ✅ Backlinks computed in second pass of generator
- ✅ `exists: false` wikilinks: generator only adds `exists: true` entries; unresolved links simply have no sitemap entry (SLSG handles this gracefully)
- ✅ `data-sitemap-url` fetch — sitemap JSON not embedded in page HTML
- ✅ Dark mode CSS vars
- ✅ Swup compatibility — custom element `connectedCallback` fires on Swup DOM swap
- ✅ Old files deleted after verifying no remaining imports

**Placeholder scan:** No TBDs. All steps contain commands or code.

**Type consistency:** `GraphConfig` imported from `@/graph/config` in both `SiteGraph.astro` and `Graph.astro`. `GraphMode` exported from `SiteGraph.astro`. `sitemapUrl` flows `SiteGraph.astro` → `Graph.astro` as prop → `data-sitemap-url` attribute → `graph-component.ts` `connectedCallback`.
