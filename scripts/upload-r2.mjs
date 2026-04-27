#!/usr/bin/env node
// Upload local images referenced by markdown to Cloudflare R2, rewrite links in place,
// and send the original local file to the OS trash on success.
//
// Safety order per image:
//   1. upload to R2 (or detect already present via HeadObject)
//   2. apply rewrite to in-memory markdown string
//   3. atomic write of new markdown (tmp file -> rename)
//   4. only after (3) succeeds, send local image to OS trash
// Any failure short-circuits trashing for that file.
//
// Usage:
//   pnpm r2:upload                       # full sweep, trash locals on success
//   pnpm r2:upload -- --dry-run          # preview, no upload, no rewrite, no trash
//   pnpm r2:upload -- --file path.md     # single file
//   pnpm r2:upload -- --keep-local       # skip trashing

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { S3Client, PutObjectCommand, HeadObjectCommand, HeadBucketCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import trash from 'trash';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const contentRoot = path.join(repoRoot, 'src', 'content');

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const argVal = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : null;
};
const DRY = flag('--dry-run');
const KEEP_LOCAL = flag('--keep-local');
const ONLY_FILE = argVal('--file');

const required = ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_ENDPOINT', 'R2_BUCKET', 'R2_PUBLIC_BASE'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing env: ${missing.join(', ')}`);
  process.exit(1);
}

const BUCKET = process.env.R2_BUCKET;
const PUBLIC_BASE = process.env.R2_PUBLIC_BASE.replace(/\/+$/, '');

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

const IMG_EXT = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];
const WIKI_RE = /!\[\[([^\]|]+?\.(?:png|jpg|jpeg|gif|svg|webp))(?:\|[^\]]*)?\]\]/gi;
const MD_RE = /!\[([^\]]*)\]\(([^)\s]+?\.(?:png|jpg|jpeg|gif|svg|webp))(?:\s+"[^"]*")?\)/gi;
// frontmatter image: line — accepts [[...]] or ![[...]] with optional quotes
const FM_IMAGE_RE = /^(image:\s*)(["']?)(!?\[\[([^\]|]+?\.(?:png|jpg|jpeg|gif|svg|webp))(?:\|[^\]]*)?\]\])(["']?)\s*$/gim;

const stats = {
  filesScanned: 0,
  filesRewritten: 0,
  linksRewritten: 0,
  imagesUploaded: 0,
  imagesAlreadyOnR2: 0,
  imagesTrashed: 0,
  imagesMissing: 0,
  uploadErrors: 0,
  writeErrors: 0,
  trashErrors: 0,
};

await preflight();

const knownKeys = await listAllKeys();
console.log(`R2 cache: ${knownKeys.size} known keys`);

const missingReport = []; // {file, ref}
const imageIndex = buildImageIndex(contentRoot);
const mdFiles = ONLY_FILE
  ? [path.resolve(repoRoot, ONLY_FILE)]
  : walkMarkdown(contentRoot);

for (const md of mdFiles) {
  try {
    await processMarkdown(md);
  } catch (e) {
    console.error(`FATAL on ${md}: ${e.message}`);
    stats.writeErrors++;
  }
}

if (missingReport.length) {
  const reportPath = path.join(repoRoot, 'r2-missing.json');
  fs.writeFileSync(reportPath, JSON.stringify(missingReport, null, 2));
  console.log(`\nMissing image report: ${reportPath} (${missingReport.length} entries)`);
}

console.log('\n--- summary ---');
console.log(stats);
if (stats.uploadErrors || stats.writeErrors || stats.trashErrors) process.exit(1);

// ---------- preflight ----------

async function preflight() {
  if (DRY) return;
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch (e) {
    console.error(`R2 preflight failed for bucket "${BUCKET}": ${e.message}`);
    console.error('Check R2_ENDPOINT / credentials / bucket name.');
    process.exit(1);
  }
}

async function listAllKeys() {
  const set = new Set();
  let token;
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: 'attachments/',
      ContinuationToken: token,
    }));
    for (const o of res.Contents || []) set.add(o.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return set;
}

// ---------- fs helpers ----------

function walkMarkdown(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'bin' || entry.name === 'attachments' || entry.name.startsWith('.')) continue;
      out.push(...walkMarkdown(full));
    } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) {
      out.push(full);
    }
  }
  return out;
}

function buildImageIndex(dir) {
  const byBasename = new Map();
  (function walk(d) {
    if (path.basename(d) === 'bin') return;
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.')) continue;
        walk(full);
      } else {
        const ext = entry.name.split('.').pop().toLowerCase();
        if (IMG_EXT.includes(ext) && !byBasename.has(entry.name)) {
          byBasename.set(entry.name, full);
        }
      }
    }
  })(dir);
  return byBasename;
}

function resolveImage(ref, mdFile) {
  const candidates = [
    path.resolve(path.dirname(mdFile), ref),
    path.resolve(contentRoot, ref),
    path.resolve(repoRoot, ref),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  const base = path.basename(ref);
  if (imageIndex.has(base)) return imageIndex.get(base);
  return null;
}

function altFromName(filename) {
  return filename.replace(/\.[^.]+$/, '').replaceAll('-', ' ').replaceAll('_', ' ');
}

function contentTypeFor(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' }[ext] || 'application/octet-stream';
}

function atomicWrite(target, content) {
  const tmp = `${target}.r2tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmp, content);
  try {
    fs.renameSync(tmp, target);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch {}
    throw e;
  }
}

// ---------- R2 ----------

async function r2Has(key) {
  if (knownKeys.has(key)) return true;
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    knownKeys.add(key);
    return true;
  } catch (e) {
    if (e.$metadata?.httpStatusCode === 404 || e.name === 'NotFound') return false;
    throw e;
  }
}

// returns: 'uploaded' | 'exists' (throws on failure)
async function uploadIfMissing(localPath, key) {
  if (await r2Has(key)) return 'exists';
  if (DRY) return 'uploaded';
  const body = fs.readFileSync(localPath);
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentTypeFor(path.basename(localPath)),
  }));
  knownKeys.add(key);
  return 'uploaded';
}

// ---------- main ----------

async function processMarkdown(mdFile) {
  if (!fs.existsSync(mdFile)) {
    console.warn(`skip missing md: ${mdFile}`);
    return;
  }
  stats.filesScanned++;
  const original = fs.readFileSync(mdFile, 'utf8');
  let updated = original;
  // each entry: { from, to, localPath }
  const pending = [];

  const collect = (matches, getRef) => {
    for (const m of matches) {
      const ref = getRef(m);
      if (!ref || /^https?:\/\//i.test(ref)) continue;
      const local = resolveImage(ref, mdFile);
      if (!local) {
        const rel = path.relative(repoRoot, mdFile).replaceAll('\\', '/');
        console.warn(`  missing local: ${ref} (${rel})`);
        stats.imagesMissing++;
        missingReport.push({ file: rel, ref, kind: 'body' });
        continue;
      }
      const filename = path.basename(local);
      const key = `attachments/${filename}`;
      pending.push({
        whole: m[0],
        replacement: `![${altFromName(filename)}](${PUBLIC_BASE}/${key})`,
        localPath: local,
        key,
        filename,
      });
    }
  };

  collect([...original.matchAll(WIKI_RE)], (m) => m[1]);
  collect([...original.matchAll(MD_RE)], (m) => m[2]);

  // frontmatter image: line — produces `image: "![alt](url)"` per user request
  for (const m of original.matchAll(FM_IMAGE_RE)) {
    const ref = m[4];
    if (/^https?:\/\//i.test(ref)) continue;
    const local = resolveImage(ref, mdFile);
    if (!local) {
      const rel = path.relative(repoRoot, mdFile).replaceAll('\\', '/');
      console.warn(`  missing frontmatter image: ${ref} (${rel})`);
      stats.imagesMissing++;
      missingReport.push({ file: rel, ref, kind: 'frontmatter' });
      continue;
    }
    const filename = path.basename(local);
    const key = `attachments/${filename}`;
    pending.push({
      whole: m[0],
      replacement: `${m[1]}"![${altFromName(filename)}](${PUBLIC_BASE}/${key})"`,
      localPath: local,
      key,
      filename,
    });
  }

  if (!pending.length) return;

  const successfullyReplaced = [];

  for (const p of pending) {
    let result;
    try {
      result = await uploadIfMissing(p.localPath, p.key);
    } catch (e) {
      console.error(`  upload failed ${p.filename}: ${e.message}`);
      stats.uploadErrors++;
      continue;
    }
    if (result === 'uploaded') {
      stats.imagesUploaded++;
      console.log(`  uploaded ${p.filename} -> ${p.key}`);
    } else {
      stats.imagesAlreadyOnR2++;
    }

    // Apply rewrite in-memory; only count and queue trash if substring actually present
    if (updated.includes(p.whole)) {
      updated = updated.split(p.whole).join(p.replacement);
      stats.linksRewritten++;
      successfullyReplaced.push(p);
    }
  }

  if (updated === original) return;

  if (DRY) {
    console.log(`[dry] would rewrite ${path.relative(repoRoot, mdFile)} (${successfullyReplaced.length} links)`);
    return;
  }

  // Atomic write — if this throws, NO file is trashed
  try {
    atomicWrite(mdFile, updated);
  } catch (e) {
    console.error(`  WRITE FAILED ${path.relative(repoRoot, mdFile)}: ${e.message} — no local files trashed`);
    stats.writeErrors++;
    return;
  }
  stats.filesRewritten++;
  console.log(`rewrote ${path.relative(repoRoot, mdFile)} (${successfullyReplaced.length} links)`);

  if (KEEP_LOCAL) return;

  // Trash only files whose link was successfully rewritten in the now-saved md
  const uniquePaths = [...new Set(successfullyReplaced.map((p) => p.localPath))];
  for (const lp of uniquePaths) {
    try {
      await trash(lp);
      stats.imagesTrashed++;
    } catch (e) {
      // ENOENT = already gone, fine
      if (e?.code === 'ENOENT') continue;
      console.error(`  trash failed ${path.basename(lp)}: ${e.message}`);
      stats.trashErrors++;
    }
  }
}
