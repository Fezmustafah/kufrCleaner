---
name: verify
description: Build, launch, and drive this Astro site (esp. the graph view) to verify changes at runtime with headless Chromium.
---

# Verifying kufrCleaner at runtime

## Launch

```bash
pnpm dev            # port 5000, falls back to 5001 — check both with curl
```

First page load after a server start triggers Vite dep optimization: expect
`504 Outdated Optimize Dep` errors and a **mid-test full page reload**. Either
warm the page once and reload, or distrust the first run's screenshots.
If the 504s PERSIST across reloads (canvas never appears, dynamic import of
graph-component fails), the dep cache is stale — kill the server and
`rm -rf node_modules/.vite .astro/` before restarting.

## Drive with Playwright

Playwright is a transitive dep — require it by absolute pnpm path:

```js
const { chromium } = require('/Users/fxwalken/Documents/GitHub/kufrCleaner/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright');
```

Chromium is cached in `~/Library/Caches/ms-playwright`. WebGL works headless
(software raster — slow frames, which is *useful*: it surfaces frame-stall bugs
like completed-in-one-update animator tweens).

## Graph-specific handles

- Global graph: `/graph-view/` (hero mode). Sidebar graph: any `/posts/<id>/` page.
- The `<graph-component>` custom element IS the GraphComponent instance —
  its internals are directly readable from `page.evaluate`:
  `el.simulator.zoomTransform.k / .centerTransform.k / .transform.k`,
  `el.animator.getValue('zoom')`, `el.simulator.nodes` (with `.label.visible`,
  `.label.alpha`), `el.config`. Read state instead of guessing from pixels.
- Screen coords of a node: `el.simulator.transform.apply([n.x, n.y])` — use this
  to hover precisely; blind grid-scanning misses small nodes in the 220px sidebar.
- Zoom: `page.mouse.wheel(0, -240)` per notch after `mouse.move` onto the canvas.
  `zoomTransform.k` clamps at `config.maxZoom`; at the clamp d3 emits no zoom
  event (probes relying on the zoom handler silently no-op there).
- The hero graph's action buttons overlap the site header hamburger — click them
  via `page.evaluate(() => document.querySelectorAll('.slsg-graph-action-container button')[i].click())`,
  not by pointer coordinates.
- Wait ~5s after load for prewarm + settle + fit before measuring.
- To change graph config externally (e.g. depth → global), write
  `el.dataset.config = JSON.stringify({...el.config, depth: 5})` — assigning
  through `el.config.X` suppresses its own mutation observer by design.

## Regenerating graph data

`node scripts/generate-graph-data.js` rewrites `public/graph/sitemap.json` +
`graph-data.json` (needed after changing the generator or content).
