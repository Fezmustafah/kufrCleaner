// Generates the browser/social icon set from the approved source assets:
//   public/favicon-source.png — icon/mark only, transparent (made by
//                               scripts/build-logo-assets.mjs from logo-original.png)
//   public/logo.png           — full lockup, used for the OG card
//
// Re-run with `node scripts/generate-favicons.mjs` after changing those.
//
// Outputs (public/):
//   favicon.png / favicon-light.png / favicon-dark.png  512, transparent mark
//   apple-touch-icon.png  180  mark on brand-brown tile (iOS needs an opaque bg)
//   open-graph.png  1200x630  lockup centred on brand brown, for link shares

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');
const MARK = join(PUBLIC, 'favicon-source.png');
const LOGO = join(PUBLIC, 'logo.png');

const BROWN = '#4D3514'; // header / brand background

// Transparent favicon at `size` — no card/badge, per spec.
async function favicon(outName, size = 512) {
  await sharp(MARK)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(PUBLIC, outName));
  console.log(`  ✓ ${outName} (${size}, transparent)`);
}

async function appleTouchIcon() {
  const size = 180;
  const mark = await sharp(MARK).resize(Math.round(size * 0.8), Math.round(size * 0.8),
    { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BROWN } })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toFile(join(PUBLIC, 'apple-touch-icon.png'));
  console.log('  ✓ apple-touch-icon.png (180, brown tile)');
}

async function openGraph() {
  const W = 1200, H = 630;
  const lockup = await sharp(LOGO).resize({ width: Math.round(W * 0.72) }).png().toBuffer();
  await sharp({ create: { width: W, height: H, channels: 4, background: BROWN } })
    .composite([{ input: lockup, gravity: 'center' }])
    .png()
    .toFile(join(PUBLIC, 'open-graph.png'));
  console.log(`  ✓ open-graph.png (${W}x${H})`);
}

console.log('Generating icons from public/favicon-source.png …');
await favicon('favicon.png');
await favicon('favicon-light.png');
await favicon('favicon-dark.png');
await appleTouchIcon();
await openGraph();
console.log('Done.');
