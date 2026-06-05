// Generates the site's icon + logo set from a single source mark
// (public/favicon-source.svg). Swap that file for the original artwork and
// re-run `node scripts/generate-favicons.mjs` to regenerate everything.
//
// Outputs (all in public/):
//   favicon.png        512  — fallback, mark on a dark rounded tile
//   favicon-light.png  512  — light browser chrome (theme-adaptive)
//   favicon-dark.png   512  — dark browser chrome (theme-adaptive)
//   apple-touch-icon.png 180 — dark tile, iOS masks the corners
//   logo.png           512  — flat transparent mark (header / hero)
//   open-graph.png   1200x630 — glow logo on parchment, link-share card

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');
const SOURCE = join(PUBLIC, 'favicon-source.svg');

const PARCHMENT = '#FAF6EF'; // al-andalus primary-50
const DARK_TILE = '#161310'; // warm near-black

// Render the source mark to a transparent square PNG of the given size.
const renderMark = (size) =>
  sharp(SOURCE, { density: 512 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

// A rounded-rect tile as a PNG canvas of `size`.
const tileBg = (size, color) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" ry="${Math.round(size * 0.22)}" fill="${color}"/>` +
      `</svg>`
  );

async function tileIcon(outName, size, bg) {
  const mark = await renderMark(Math.round(size * 0.64));
  await sharp(tileBg(size, bg))
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toFile(join(PUBLIC, outName));
  console.log(`  ✓ ${outName} (${size}x${size})`);
}

async function appleTouchIcon() {
  const size = 180;
  const mark = await renderMark(Math.round(size * 0.64));
  await sharp({ create: { width: size, height: size, channels: 4, background: DARK_TILE } })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toFile(join(PUBLIC, 'apple-touch-icon.png'));
  console.log(`  ✓ apple-touch-icon.png (${size}x${size})`);
}

async function flatLogo() {
  await renderMark(512).then((buf) => sharp(buf).toFile(join(PUBLIC, 'logo.png')));
  console.log('  ✓ logo.png (512x512, transparent)');
}

async function openGraph() {
  const W = 1200, H = 630, M = 380;
  const mark = await renderMark(M);
  // Soft luminous halo: a blurred copy of the coloured mark behind the sharp one.
  const glow = await sharp(mark).blur(22).toBuffer();
  await sharp({ create: { width: W, height: H, channels: 4, background: PARCHMENT } })
    .composite([
      { input: glow, gravity: 'center' },
      { input: glow, gravity: 'center' },
      { input: mark, gravity: 'center' },
    ])
    .png()
    .toFile(join(PUBLIC, 'open-graph.png'));
  console.log(`  ✓ open-graph.png (${W}x${H})`);
}

console.log('Generating icons from public/favicon-source.svg …');
await tileIcon('favicon.png', 512, DARK_TILE);
await tileIcon('favicon-light.png', 512, DARK_TILE);   // dark tile pops on light chrome
await tileIcon('favicon-dark.png', 512, PARCHMENT);    // parchment tile pops on dark chrome
await appleTouchIcon();
await flatLogo();
await openGraph();
console.log('Done.');
