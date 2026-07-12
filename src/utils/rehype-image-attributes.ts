import type { Root, Element } from 'hast';
import { visit } from 'unist-util-visit';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

/**
 * Rehype plugin to add loading attributes and optimize image paths in markdown content
 * Adds lazy loading attributes and converts image paths to WebP versions when available.
 * Also stamps intrinsic width/height so the browser reserves layout space — without
 * them every lazy image load shifts the page (CLS), which breaks hash anchoring,
 * scroll targets, and forces constant reflows on image-heavy posts.
 */

type Dims = { width: number; height: number };

// One probe per unique src per process — pages share the cache. Successful
// remote probes persist to a COMMITTED file (like the generated
// global-refs.json) so CI builds start warm and never re-fetch; failures stay
// in-memory only and retry next run. NOT under .astro/ — Astro clears that
// directory. Saves merge with the file's current contents first: the plugin
// can be instantiated more than once per build (content render vs page
// render), and last-writer-wins snapshots were losing entries.
const CACHE_FILE = path.join(process.cwd(), 'src', 'data', 'remote-image-dims.json');
const dimsCache = new Map<string, Dims | null>();
let diskCacheLoaded = false;
let diskDirty = false;

function readCacheFile(): Record<string, Dims> {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function loadDiskCache() {
  if (diskCacheLoaded) return;
  diskCacheLoaded = true;
  for (const [k, v] of Object.entries(readCacheFile())) dimsCache.set(k, v);
}

function saveDiskCache() {
  if (!diskDirty) return;
  diskDirty = false;
  try {
    const out = readCacheFile(); // merge: other instances' entries survive
    for (const [k, v] of dimsCache.entries()) if (v) out[k] = v;
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(out));
  } catch {
    /* cache is best-effort */
  }
}

// Remote probing: dimensions live in the first bytes of every raster format,
// so a 64 KB ranged fetch is enough for sharp to read them. A small
// concurrency gate keeps a 100-image post from firing 100 sockets. The
// circuit breaker is self-healing: 5 CONSECUTIVE network failures open it
// for 30 s (offline builds fail fast), any success closes it — a full-site
// build probes thousands of URLs and must survive sporadic timeouts.
const MAX_CONCURRENT = 8;
let inFlight = 0;
const slotQueue: Array<() => void> = [];
let consecutiveFailures = 0;
let breakerOpenUntil = 0;
const SKIPPED = Symbol('breaker-open');

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_CONCURRENT) await new Promise<void>((r) => slotQueue.push(r));
  inFlight++;
  try {
    return await fn();
  } finally {
    inFlight--;
    slotQueue.shift()?.();
  }
}

async function probeRemote(src: string): Promise<Dims | null | typeof SKIPPED> {
  if (Date.now() < breakerOpenUntil) return SKIPPED;
  return withSlot(async () => {
    if (Date.now() < breakerOpenUntil) return SKIPPED;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    try {
      const res = await fetch(src, {
        headers: { Range: 'bytes=0-65535' },
        signal: ctl.signal,
      });
      const buf = Buffer.from(await res.arrayBuffer());
      const meta = await sharp(buf).metadata();
      consecutiveFailures = 0;
      if (meta.width && meta.height) return { width: meta.width, height: meta.height };
      return null;
    } catch (e) {
      // Network/timeout errors count toward the breaker; decode errors (e.g.
      // a rare JPEG whose size marker sits past 64 KB) are per-image and don't.
      if (e instanceof TypeError || (e as Error).name === 'AbortError') {
        if (++consecutiveFailures >= 5) {
          breakerOpenUntil = Date.now() + 30_000;
          consecutiveFailures = 0;
        }
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  });
}

async function probeDims(src: string): Promise<Dims | null> {
  loadDiskCache();
  const cached = dimsCache.get(src);
  if (cached !== undefined) return cached;
  let dims: Dims | null = null;
  if (/^https?:\/\//.test(src)) {
    const result = await probeRemote(src);
    // Breaker-open skips are NOT cached — a later page retries once it closes.
    if (result === SKIPPED) return null;
    dims = result;
  } else {
    try {
      const rel = decodeURIComponent(src.split(/[?#]/)[0].replace(/^\//, ''));
      const meta = await sharp(path.join(process.cwd(), 'public', rel)).metadata();
      if (meta.width && meta.height) dims = { width: meta.width, height: meta.height };
    } catch {
      /* missing/unreadable file — leave the image undimensioned */
    }
  }
  dimsCache.set(src, dims);
  if (dims) diskDirty = true;
  return dims;
}

export function rehypeImageAttributes() {
  return async (tree: Root) => {
    // First pass: collect img nodes so we can identify the first one
    // (the LCP candidate on posts that hide the cover image).
    const imgNodes: Element[] = [];
    visit(tree, 'element', (node: Element) => {
      if (node.tagName === 'img') imgNodes.push(node);
    });

    imgNodes.forEach((node, index) => {
      const properties = node.properties || {};
      const src = (properties.src as string) || '';

      // Convert image paths to WebP if available
      // The sync script generates WebP versions of JPG/PNG files
      // Only convert if path doesn't already end with .webp (remarkFolderImages may have already converted it)
      if (src && typeof src === 'string' && !src.startsWith('http') && !src.toLowerCase().endsWith('.webp') && !src.toLowerCase().endsWith('.svg')) {
        // Check if this is an image format that would have been converted to WebP
        if (/\.(jpg|jpeg|png|gif|bmp|tiff|tif)$/i.test(src)) {
          // Replace extension with .webp
          // Note: remarkFolderImages should have already set the correct path with collection prefix
          // This is a fallback for any images that weren't processed by remarkFolderImages
          properties.src = src.replace(/\.(jpg|jpeg|png|gif|bmp|tiff|tif)$/i, '.webp');
        }
      }

      // The first body image is the LCP candidate when the post hides the
      // cover image (hideCoverImage: true). Mark it eager + high priority
      // so it isn't deferred by default lazy loading. Posts with a cover
      // image already have fetchpriority="high" on the cover, which still
      // wins the bandwidth race.
      if (index === 0) {
        if (!properties.loading) properties.loading = 'eager';
        if (!properties.fetchpriority) properties.fetchpriority = 'high';
      } else {
        if (!properties.loading) properties.loading = 'lazy';
      }

      // Add decoding="async" if not already set
      if (!properties.decoding) {
        properties.decoding = 'async';
      }

      // Ensure alt text is present
      if (!properties.alt) {
        properties.alt = '';
      }
    });

    // Second pass (async): intrinsic width/height (local files and remote,
    // e.g. R2-hosted attachments) so layout space is reserved before the file
    // loads. Obsidian size syntax sets a `style` width — the attrs below
    // still supply the aspect ratio, so the browser reserves the right
    // height either way.
    await Promise.all(
      imgNodes.map(async (node) => {
        const properties = node.properties || {};
        const src = String(properties.src || '');
        if (!src || src.startsWith('data:')) return;
        if (properties.width && properties.height) return;
        const dims = await probeDims(src);
        if (!dims) return;
        if (properties.width && !properties.height) {
          const w = Number(properties.width);
          if (w > 0) properties.height = Math.round((w * dims.height) / dims.width);
          return;
        }
        properties.width = dims.width;
        properties.height = dims.height;
      }),
    );
    saveDiskCache();
  };
}

export default rehypeImageAttributes;