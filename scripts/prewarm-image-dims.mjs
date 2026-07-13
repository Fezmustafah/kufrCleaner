// Prewarm src/data/remote-image-dims.json — intrinsic dimensions for every
// remote image referenced in content, probed OUTSIDE the astro build.
// rehype-image-attributes stamps these as width/height attrs so the browser
// reserves layout space (CLS → 0 on image-heavy posts). Probing during the
// build itself starves under render CPU load and times out; here it's pure
// async I/O. The cache is committed (like global-refs.json): warm CI builds,
// each run only probes URLs it hasn't seen.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const CACHE_FILE = path.join(ROOT, 'src', 'data', 'remote-image-dims.json');
const CONTENT_DIR = path.join(ROOT, 'src', 'content');
// r2.dev public URLs are burst rate-limited: a fast sweep gets ~1k requests
// through, then everything 429s until the window resets. Gentle pacing plus
// a global pause on 429 gets full coverage in one run.
const CONCURRENCY = 4;
const TIMEOUT_MS = 10_000;
const SPACING_MS = 100;
const THROTTLE_PAUSE_MS = 10_000;
const MAX_ATTEMPTS = 6;
const FAILURE_KEY = '__failures';
const FAILURE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ── collect absolute image URLs from all markdown ──
const URL_RE = /https?:\/\/[^\s)"'\]<>]+\.(?:png|jpe?g|webp|gif|avif)/gi;
const urls = new Set();
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.mdx?$/.test(entry.name)) {
      for (const m of fs.readFileSync(p, 'utf8').matchAll(URL_RE)) urls.add(m[0]);
    }
  }
}
walk(CONTENT_DIR);

let cache = {};
try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { /* first run */ }
cache[FAILURE_KEY] ??= {};

const now = Date.now();
const isKnown = (u) => {
  if (cache[u]?.width && cache[u]?.height) return true;
  const failedAt = cache[FAILURE_KEY]?.[u];
  return typeof failedAt === 'number' && now - failedAt < FAILURE_TTL_MS;
};

const todo = [...urls].filter((u) => !isKnown(u));
const recentFailures = Object.values(cache[FAILURE_KEY]).filter(
  (failedAt) => typeof failedAt === 'number' && now - failedAt < FAILURE_TTL_MS,
).length;
console.log(`[image-dims] ${urls.size} remote images referenced, ${todo.length} to probe (${recentFailures} recent failures skipped)`);
if (todo.length === 0) process.exit(0);

// ── probe: dimensions live in the first bytes — 64 KB ranged fetch ──
// Returns dims, null (permanent: 404, undecodable), or 'retry' (throttled /
// transient network — requeue).
async function probe(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { Range: 'bytes=0-65535' }, signal: ctl.signal });
    if (res.status === 429 || res.status >= 500) return 'retry';
    if (!res.ok && res.status !== 206) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    return meta.width && meta.height ? { width: meta.width, height: meta.height } : null;
  } catch {
    return 'retry';
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let done = 0, ok = 0, gaveUp = 0;
let pausedUntil = 0;
const queue = todo.map((url) => ({ url, attempt: 1 }));

async function worker() {
  for (let item = queue.shift(); item; item = queue.shift()) {
    const wait = pausedUntil - Date.now();
    if (wait > 0) await sleep(wait);
    const dims = await probe(item.url);
    if (dims === 'retry') {
      if (item.attempt < MAX_ATTEMPTS) {
        pausedUntil = Math.max(pausedUntil, Date.now() + THROTTLE_PAUSE_MS);
        queue.push({ url: item.url, attempt: item.attempt + 1 });
      } else {
        cache[FAILURE_KEY][item.url] = Date.now();
        done++; gaveUp++;
      }
    } else {
      done++;
      if (dims) {
        cache[item.url] = dims;
        delete cache[FAILURE_KEY][item.url];
        ok++;
      } else {
        cache[FAILURE_KEY][item.url] = Date.now();
      }
    }
    if (done > 0 && done % 500 === 0) {
      console.log(`[image-dims] ${done}/${todo.length} resolved (${ok} ok, ${gaveUp} gave up, ${queue.length} queued)`);
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache)); // checkpoint
    }
    await sleep(SPACING_MS);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
console.log(`[image-dims] done: ${ok}/${todo.length} new (${gaveUp} gave up), cache now ${Object.keys(cache).filter((k) => k !== FAILURE_KEY).length} entries`);
