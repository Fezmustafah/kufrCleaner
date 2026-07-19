#!/usr/bin/env node
// Generates src/content/tags/<slug>.md meta pages for every tag in
// src/content/taxonomy.md, using headless `claude -p`. Resumable: skips slugs
// whose file already exists (delete a file to regenerate it).
//
// Usage: node scripts/generate-tag-pages.mjs [--limit N] [--batch N] [--model M]

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const TAGS_DIR = path.join(ROOT, 'src/content/tags');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const LIMIT = Number(opt('--limit', Infinity));
const BATCH = Number(opt('--batch', 6));
const MODEL = opt('--model', 'claude-sonnet-5');
const TODAY = new Date().toISOString().slice(0, 10);

const tax = fs.readFileSync(path.join(ROOT, 'src/content/taxonomy.md'), 'utf8');
const tags = [...tax.matchAll(/^- `([a-z0-9-]+)` — (.+)$/gm)].map(m => ({ slug: m[1], def: m[2] }));

// sample post titles per tag from the classification run
const rows = fs.readFileSync(path.join(ROOT, '.taxonomy-work/classification.jsonl'), 'utf8')
  .split('\n').filter(Boolean).map(l => JSON.parse(l));
const titleById = new Map();
function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
    if (e.name.startsWith('.') || e.name.startsWith('_')) return [];
    const p = path.join(d, e.name);
    return e.isDirectory() ? walk(p) : e.name.endsWith('.md') ? [p] : [];
  });
}
for (const f of walk(path.join(ROOT, 'src/content/posts'))) {
  let src = fs.readFileSync(f, 'utf8');
  if (src.charCodeAt(0) === 0xFEFF) src = src.slice(1);
  const t = (src.match(/^title:\s*["']?(.+?)["']?\s*$/m) || [])[1];
  const rel = path.relative(path.join(ROOT, 'src/content/posts'), f).replace(/\\/g, '/');
  const id = rel.endsWith('/index.md') ? rel.slice(0, -9) : rel.slice(0, -3);
  if (t) titleById.set(id, t);
}
const samples = {};
for (const r of rows) for (const t of r.tags || []) {
  (samples[t] = samples[t] || []).length < 8 && titleById.has(r.id) && samples[t].push(titleById.get(r.id));
}
const counts = {};
for (const r of rows) for (const t of r.tags || []) counts[t] = (counts[t] || 0) + 1;

const STYLE = fs.existsSync(path.join(TAGS_DIR, 'aqidah.md'))
  ? fs.readFileSync(path.join(TAGS_DIR, 'aqidah.md'), 'utf8')
  : '';

const SYSTEM = `You write tag pages for OpenIslam Wiki, an Islamic knowledge project answering polemics against Islam and examining other traditions' claims. Tags are CONCEPTS — semantic anchors in a knowledge graph of ~1300 articles.

Each tag page must be an epistemological anchor, NOT a mere collector. It must:
1. Say what the concept is, precisely (1 short paragraph).
2. Say how THIS PROJECT addresses it — its method, its standard of evidence, what it refuses to concede (1-2 paragraphs). Write from inside the project's convictions.
3. Where natural, tie it to the wider web: how this concept connects to the project's larger argument. No lists of links, just prose.

Voice reference (an existing page — match this register: measured, confident, no marketing tone, no headers, no bullet lists):
---
${STYLE}
---

Rules:
- Body: 2-3 paragraphs, 90-180 words total. No headings, no lists, no links, no emoji.
- description: one sentence, 15-30 words, for SEO/hero display.
- title: short human display name for the tag (e.g. "Bible Textual Criticism"; for vs-* tags use the form "vs. Christianity").
- Respond with ONLY a JSON array, one object per tag, same order, numeric id as given:
[{"id":1,"title":"...","description":"...","body":"para\\n\\npara"}]`;

fs.mkdirSync(TAGS_DIR, { recursive: true });
const todo = tags.filter(t => !fs.existsSync(path.join(TAGS_DIR, `${t.slug}.md`))).slice(0, LIMIT);
console.log(`${tags.length} tags, ${tags.length - todo.length} pages exist, ${todo.length} to generate (model ${MODEL})`);

for (let i = 0; i < todo.length; i += BATCH) {
  const batch = todo.slice(i, i + BATCH);
  const prompt = batch.map((t, j) =>
    `ID: ${j + 1}\nSLUG: ${t.slug}\nDEFINITION: ${t.def}\nPOSTS TAGGED: ${counts[t.slug] || 0}\nSAMPLE ARTICLES:\n${(samples[t.slug] || []).map(s => `- ${s}`).join('\n') || '(none yet)'}\n---`
  ).join('\n');
  let raw;
  try {
    raw = execFileSync('claude',
      ['-p', '--model', MODEL, '--append-system-prompt', SYSTEM, '--output-format', 'text'],
      { input: prompt, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 300000 });
  } catch (e) { console.error(`batch at ${i} failed: ${e.message}`); continue; }
  const jm = raw.match(/\[[\s\S]*\]/);
  if (!jm) { console.error(`batch at ${i}: no JSON`); continue; }
  let results;
  try { results = JSON.parse(jm[0]); } catch { console.error(`batch at ${i}: bad JSON`); continue; }
  for (const r of results) {
    const t = batch[Number(r.id) - 1];
    if (!t || !r.title || !r.body) continue;
    const md = `---\ntitle: "${r.title.replace(/"/g, '\\"')}"\ndescription: "${(r.description || '').replace(/"/g, '\\"')}"\ndate: ${TODAY}\n---\n\n${r.body.trim()}\n`;
    fs.writeFileSync(path.join(TAGS_DIR, `${t.slug}.md`), md);
  }
  console.log(`  ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
}
console.log('done');
