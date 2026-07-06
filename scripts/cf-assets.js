#!/usr/bin/env node
// Cloudflare Workers static-assets need `_headers`/`_redirects` in the build
// output (dist/), but Astro's build chokes if they sit in public/ during the
// build: rollup tries to parse the extensionless `_headers` as a JS module and
// fails on its `#` comments. So we stash them out of public/ before `astro
// build` and drop them into dist/ afterward.
//
// Usage: node scripts/cf-assets.js pre|post
// ponytail: no-op on platforms that don't generate these files (e.g. github-pages).

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['_headers', '_redirects'];
const stash = path.join(root, '.cf-assets-tmp');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function pre() {
  await fs.mkdir(stash, { recursive: true });
  for (const f of FILES) {
    const src = path.join(root, 'public', f);
    if (await exists(src)) await fs.rename(src, path.join(stash, f));
  }
}

async function post() {
  if (!(await exists(stash))) return;
  await fs.mkdir(path.join(root, 'dist'), { recursive: true });
  for (const f of FILES) {
    const from = path.join(stash, f);
    if (await exists(from)) await fs.rename(from, path.join(root, 'dist', f));
  }
  await fs.rm(stash, { recursive: true, force: true });
}

const mode = process.argv[2];
if (mode === 'pre') await pre();
else if (mode === 'post') await post();
else { console.error('usage: cf-assets.js pre|post'); process.exit(1); }
