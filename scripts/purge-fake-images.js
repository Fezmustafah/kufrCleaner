#!/usr/bin/env node

/**
 * Deletes files from public/posts/attachments/ that have image extensions
 * but aren't actually valid images (e.g. JSON error stubs left by old builds).
 *
 * Run (dry-run): node scripts/purge-fake-images.js
 * Run (apply):   node scripts/purge-fake-images.js --apply
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const APPLY = process.argv.includes('--apply');

const IMAGE_EXTS = /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|tif|ico|avif)$/i;

// Magic byte signatures for valid image formats
function isRealImage(filePath) {
  const stat = fs.statSync(filePath);
  // Anything under 100 bytes cannot be a real image
  if (stat.size < 100) return false;

  const buf = Buffer.alloc(12);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buf, 0, 12, 0);
  fs.closeSync(fd);

  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true;
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true;
  // GIF: GIF8
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;
  // WebP: RIFF....WEBP
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true;
  // BMP: BM
  if (buf[0] === 0x42 && buf[1] === 0x4D) return true;
  // TIFF: II or MM
  if ((buf[0] === 0x49 && buf[1] === 0x49) || (buf[0] === 0x4D && buf[1] === 0x4D)) return true;
  // AVIF/HEIF: ftyp box (bytes 4-7 are 'ftyp')
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return true;
  // SVG: starts with < (XML/SVG text)
  const head = buf.toString('utf8', 0, 5).trimStart();
  if (head.startsWith('<') || head.startsWith('<?')) return true;

  return false;
}

function main() {
  const dir = path.join(projectRoot, 'public', 'posts', 'attachments');
  if (!fs.existsSync(dir)) {
    console.log('No public/posts/attachments dir found.');
    return;
  }

  const files = fs.readdirSync(dir);
  let fakes = 0;

  for (const file of files) {
    if (!IMAGE_EXTS.test(file)) continue;
    const fullPath = path.join(dir, file);
    if (!isRealImage(fullPath)) {
      fakes++;
      console.log(`  ${APPLY ? '🗑️ ' : '📋'} ${file}`);
      if (APPLY) fs.unlinkSync(fullPath);
    }
  }

  console.log(`\n${fakes} fake image file${fakes !== 1 ? 's' : ''} found.`);
  if (!APPLY && fakes > 0) console.log('⚠️  Dry-run. Pass --apply to delete.');
  else if (APPLY && fakes > 0) console.log('✅ Deleted.');
  else console.log('✅ All clean.');
}

main();
