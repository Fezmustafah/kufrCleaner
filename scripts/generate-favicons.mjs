// Generates the site's favicon + social-share image set from a single source
// mark (public/favicon-source.svg). Swap that source file for the original
// artwork and re-run `node scripts/generate-favicons.mjs` to regenerate.
//
// Outputs (all in public/):
//   favicon.png        512  — fallback, mark on parchment circle
//   favicon-light.png  512  — light browser chrome (theme-adaptive)
//   favicon-dark.png   512  — dark browser chrome (theme-adaptive)
//   apple-touch-icon.png 180 — full-bleed parchment tile (iOS masks corners)
//   open-graph.png   1200x630 — link-share card, mark centered on parchment

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');
const SOURCE = join(PUBLIC, 'favicon-source.svg');

const PARCHMENT = '#FAF6EF'; // al-andalus primary-50

// Render the source mark to a transparent square PNG of the given size.
const renderMark = (size) =>
  sharp(SOURCE, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

// A solid parchment circle as a PNG canvas of `size`.
const circleBg = (size) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - Math.round(size * 0.012)}" fill="${PARCHMENT}"/>` +
      `</svg>`
  );

async function circleIcon(outName, size = 512) {
  const mark = await renderMark(Math.round(size * 0.86));
  await sharp(circleBg(size))
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toFile(join(PUBLIC, outName));
  console.log(`  ✓ ${outName} (${size}x${size})`);
}

async function appleTouchIcon() {
  const size = 180;
  const mark = await renderMark(Math.round(size * 0.82));
  await sharp({
    create: { width: size, height: size, channels: 4, background: PARCHMENT },
  })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toFile(join(PUBLIC, 'apple-touch-icon.png'));
  console.log(`  ✓ apple-touch-icon.png (${size}x${size})`);
}

async function openGraph() {
  const W = 1200, H = 630;
  const mark = await renderMark(360);
  await sharp({
    create: { width: W, height: H, channels: 4, background: PARCHMENT },
  })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toFile(join(PUBLIC, 'open-graph.png'));
  console.log(`  ✓ open-graph.png (${W}x${H})`);
}

console.log('Generating icons from public/favicon-source.svg …');
await circleIcon('favicon.png');
await circleIcon('favicon-light.png');
await circleIcon('favicon-dark.png');
await appleTouchIcon();
await openGraph();
console.log('Done.');
