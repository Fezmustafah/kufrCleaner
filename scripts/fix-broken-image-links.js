#!/usr/bin/env node

/**
 * Fix broken/unsupported image wikilinks in markdown posts.
 * Replaces ![[attachments/bad.jpg|...]] with attachments/bad.jpg #broken-img
 *
 * Run (dry-run): node scripts/fix-broken-image-links.js
 * Run (apply):   node scripts/fix-broken-image-links.js --apply
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const APPLY = process.argv.includes('--apply');
const IMAGE_EXTS = /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|tif|ico|avif)$/i;

// --- Step 1: collect bad filenames (basename only) ---

async function collectBadFilenames() {
  const bad = new Set();
  const dirs = [
    path.join(projectRoot, 'src', 'content', 'posts', 'attachments'),
    path.join(projectRoot, 'public', 'posts', 'attachments'),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!IMAGE_EXTS.test(file)) continue;
      if (bad.has(file)) continue; // already flagged
      const fullPath = path.join(dir, file);
      try {
        await sharp(fullPath).resize(1, 1).toBuffer();
      } catch {
        bad.add(file);
      }
    }
  }

  return bad;
}

// --- Step 2: collect missing filenames (basename only) ---

function collectMissingFilenames() {
  const missing = new Set();
  const attachmentsDir = path.join(projectRoot, 'src', 'content', 'posts', 'attachments');
  const postsDir = path.join(projectRoot, 'src', 'content', 'posts');

  const markdownFiles = getAllMarkdownFiles(postsDir);
  for (const filePath of markdownFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const wikiMatches = [...content.matchAll(/!\[\[([^\]]+)\]\]/g)];
    for (const m of wikiMatches) {
      const src = m[1].split('|')[0].trim();
      if (!IMAGE_EXTS.test(src)) continue;
      const basename = path.basename(src);
      const candidate = path.join(attachmentsDir, basename);
      if (!fs.existsSync(candidate)) {
        missing.add(basename);
      }
    }
  }

  return missing;
}

function getAllMarkdownFiles(dir) {
  const files = [];
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      files.push(...getAllMarkdownFiles(full));
    } else if (item.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

// --- Step 3: patch markdown files ---

function patchFile(filePath, badFilenames) {
  const original = fs.readFileSync(filePath, 'utf-8');
  let patched = original;
  let count = 0;

  patched = patched.replace(/!\[\[([^\]]+)\]\]/g, (match, inner) => {
    const src = inner.split('|')[0].trim();
    if (!IMAGE_EXTS.test(src)) return match; // not an image wikilink
    const basename = path.basename(src);
    if (!badFilenames.has(basename)) return match; // image is fine
    count++;
    return `${src} #broken-img`;
  });

  return { patched, count, changed: count > 0 };
}

// --- Main ---

async function main() {
  console.log('🔍 Collecting unsupported images (sharp test)...');
  const unsupported = await collectBadFilenames();
  console.log(`   Unsupported: ${unsupported.size}`);

  console.log('🔍 Collecting missing image filenames...');
  const missing = collectMissingFilenames();
  console.log(`   Missing: ${missing.size}`);

  const allBad = new Set([...unsupported, ...missing]);
  console.log(`   Total bad: ${allBad.size}\n`);

  if (allBad.size === 0) {
    console.log('✅ No broken images found.');
    return;
  }

  const postsDir = path.join(projectRoot, 'src', 'content', 'posts');
  const markdownFiles = getAllMarkdownFiles(postsDir);

  let totalFiles = 0;
  let totalReplacements = 0;

  for (const filePath of markdownFiles) {
    const { patched, count, changed } = patchFile(filePath, allBad);
    if (!changed) continue;
    totalFiles++;
    totalReplacements += count;
    const rel = path.relative(projectRoot, filePath);
    console.log(`  ${APPLY ? '✏️ ' : '📋'} ${rel} (${count} replacement${count > 1 ? 's' : ''})`);
    if (APPLY) {
      fs.writeFileSync(filePath, patched, 'utf-8');
    }
  }

  console.log(`\n📊 ${totalReplacements} wikilinks in ${totalFiles} files`);
  if (!APPLY) {
    console.log('\n⚠️  Dry-run. Pass --apply to write changes.');
  } else {
    console.log('✅ Done.');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
