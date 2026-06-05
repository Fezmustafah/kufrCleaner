// One-time prep: from the approved lockup artwork (public/logo-original.png),
// produce the two source assets the spec requires — WITHOUT redrawing anything.
//
//   favicon-source.png  1024x1024  icon/mark ONLY, transparent, original colours
//   logo.png            lockup      icon (original) + wordmark recoloured for the
//                                   dark header: "OpenIslam" -> #F8F3EA, ".wiki"
//                                   kept gold. Transparent background.
//
// The icon is extracted by splitting the lockup at the transparent gap between
// the mark and the wordmark — geometry/colour of the mark is never touched.

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');
const SRC = join(PUBLIC, 'logo-original.png');

const CREAM = [248, 243, 234]; // #F8F3EA — "OpenIslam" on the dark header

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
const A = (x, y) => data[(y * W + x) * C + 3];

// Per-column content (≥3 reasonably opaque pixels) → locate mark vs wordmark.
const colHas = new Array(W).fill(false);
for (let x = 0; x < W; x++) {
  let n = 0;
  for (let y = 0; y < H; y++) if (A(x, y) > 40) { if (++n >= 3) break; }
  colHas[x] = n >= 3;
}

const firstCol = colHas.indexOf(true);
const GAP = Math.round(W * 0.018); // transparent run that separates mark from text
let markRight = firstCol, run = 0;
for (let x = firstCol; x < W; x++) {
  if (colHas[x]) { run = 0; markRight = x; }
  else if (++run >= GAP) break; // big gap → end of the mark
}
let textLeft = markRight + 1;
while (textLeft < W && !colHas[textLeft]) textLeft++;

// Row bounds for the mark only (within [firstCol, markRight]).
let mTop = H, mBot = 0;
for (let y = 0; y < H; y++)
  for (let x = firstCol; x <= markRight; x++)
    if (A(x, y) > 40) { if (y < mTop) mTop = y; if (y > mBot) mBot = y; break; }

console.log(JSON.stringify({ W, H, firstCol, markRight, textLeft, mTop, mBot }));

// ── favicon-source.png : mark only, centred on a 1024² transparent canvas ──
const mW = markRight - firstCol + 1, mH = mBot - mTop + 1;
const markBuf = await sharp(SRC)
  .extract({ left: firstCol, top: mTop, width: mW, height: mH })
  .png().toBuffer();
const inner = 920; // ~90% → small breathing room, proportions preserved
await sharp(markBuf)
  .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .extend({
    top: (1024 - inner) / 2, bottom: (1024 - inner) / 2,
    left: (1024 - inner) / 2, right: (1024 - inner) / 2,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png().toFile(join(PUBLIC, 'favicon-source.png'));
console.log('  ✓ favicon-source.png (1024x1024, mark only, transparent)');

// ── logo.png : full lockup, recolour ONLY the wordmark's green → cream ──
const out = Buffer.from(data); // copy raw RGBA
for (let y = 0; y < H; y++) {
  for (let x = textLeft; x < W; x++) {
    const i = (y * W + x) * C;
    if (out[i + 3] === 0) continue;
    const r = out[i], g = out[i + 1];
    if (g > r + 8) { out[i] = CREAM[0]; out[i + 1] = CREAM[1]; out[i + 2] = CREAM[2]; } // green text → cream
    // gold ".wiki" (r > g) left untouched
  }
}
await sharp(out, { raw: { width: W, height: H, channels: C } })
  .png().trim() // drop transparent margins
  .toBuffer()
  .then((b) => sharp(b).resize({ width: 1024 }).png().toFile(join(PUBLIC, 'logo.png')));
console.log('  ✓ logo.png (lockup, cream/gold wordmark, transparent)');

// Flattened previews for visual QA (deleted after review).
await sharp(join(PUBLIC, 'favicon-source.png')).flatten({ background: '#4D3514' }).resize(300).jpeg().toFile(join(PUBLIC, '_fav_preview.jpg'));
await sharp(join(PUBLIC, 'logo.png')).flatten({ background: '#4D3514' }).resize(760).jpeg().toFile(join(PUBLIC, '_logo_preview.jpg'));
console.log('Done.');
