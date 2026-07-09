/**
 * Build-time word-cloud layout — a small reproduction of the spiral-placement
 * idea from jasondavies/d3-cloud, minus the canvas/sprite collision. We run it
 * in the page frontmatter (Node), so nothing ships to the browser: the cloud is
 * emitted as static positioned SVG. No `d3-cloud` dependency, no runtime cost.
 *
 * Font size scales with post count; words are packed along an elliptical
 * Archimedean spiral (biggest first, near the centre) using axis-aligned
 * bounding-box collision.
 */

export interface CloudItem {
  text: string;
  count: number;
  url: string;
}

export interface PlacedWord extends CloudItem {
  size: number; // px font-size
  x: number; // centre x (text-anchor="middle")
  y: number; // centre y (dominant-baseline="central")
  weight: number; // 0..1 normalised count → drives colour/opacity
}

export interface CloudLayout {
  words: PlacedWord[];
  viewBox: string;
}

// Deterministic PRNG so every build lays the cloud out identically.
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Box { x1: number; y1: number; x2: number; y2: number; }
const hits = (a: Box, b: Box) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;

export function layoutTagCloud(
  items: CloudItem[],
  opts: { minFont?: number; maxFont?: number; pad?: number; seed?: number; aspect?: number } = {}
): CloudLayout {
  const minFont = opts.minFont ?? 15;
  const maxFont = opts.maxFont ?? 66;
  const pad = opts.pad ?? 5;
  const advance = 0.55; // approx serif glyph advance in em (slight over-estimate → no overlap)
  const yScale = opts.aspect ?? 0.55; // <1 → wider-than-tall banner packing
  const rng = mulberry32(opts.seed ?? 0x5eed);

  if (items.length === 0) return { words: [], viewBox: '0 0 100 100' };

  const counts = items.map((i) => i.count);
  const minC = Math.min(...counts);
  const maxC = Math.max(...counts);
  const norm = (c: number) => (maxC === minC ? 1 : (c - minC) / (maxC - minC));

  // Biggest first so heavy tags anchor the centre and light ones fill the gaps.
  const sorted = [...items].sort((a, b) => b.count - a.count);

  const placed: Box[] = [];
  const words: PlacedWord[] = [];

  for (const it of sorted) {
    const weight = norm(it.count);
    const size = Math.round(minFont + Math.sqrt(weight) * (maxFont - minFont));
    const hw = (it.text.length * size * advance) / 2 + pad;
    const hh = (size * 1.02) / 2 + pad;

    const a0 = rng() * Math.PI * 2; // random spiral entry angle per word
    let x = 0;
    let y = 0;
    // ponytail: O(n·steps) bounding-box collision — fine for a few dozen tags.
    for (let s = 0; s < 8000; s++) {
      const r = s * 0.32;
      const a = a0 + s * 0.4;
      x = r * Math.cos(a);
      y = r * Math.sin(a) * yScale;
      const box = { x1: x - hw, y1: y - hh, x2: x + hw, y2: y + hh };
      if (!placed.some((p) => hits(p, box))) {
        placed.push(box);
        break;
      }
    }
    words.push({ ...it, size, x, y, weight });
  }

  // Tighten the viewBox to the placed content.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const w of words) {
    const hw = (w.text.length * w.size * advance) / 2 + pad;
    const hh = (w.size * 1.02) / 2 + pad;
    minX = Math.min(minX, w.x - hw);
    maxX = Math.max(maxX, w.x + hw);
    minY = Math.min(minY, w.y - hh);
    maxY = Math.max(maxY, w.y + hh);
  }
  const m = 12;
  const vb = `${(minX - m).toFixed(1)} ${(minY - m).toFixed(1)} ${(maxX - minX + 2 * m).toFixed(1)} ${(maxY - minY + 2 * m).toFixed(1)}`;
  return { words, viewBox: vb };
}
