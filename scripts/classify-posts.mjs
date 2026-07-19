#!/usr/bin/env node
// Classifies content-submodule posts against src/content/taxonomy.md using
// headless `claude -p` (haiku). Dry-run by default: writes results to
// .taxonomy-work/classification.jsonl + report. --apply writes frontmatter.
//
// Usage: node scripts/classify-posts.mjs [--limit N] [--apply] [--batch N]

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const POSTS = path.join(ROOT, 'src/content/posts');
const TAXONOMY = path.join(ROOT, 'src/content/taxonomy.md');
const WORKDIR = path.join(ROOT, '.taxonomy-work');
const OUT = path.join(WORKDIR, 'classification.jsonl');
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const LIMIT = Number(opt('--limit', Infinity));
const BATCH = Number(opt('--batch', 15));
const MODEL = opt('--model', 'claude-haiku-4-5');

// --- taxonomy ---
const tax = fs.readFileSync(TAXONOMY, 'utf8');
const portals = [...tax.matchAll(/^\| ([^|]+?) \|/gm)].map(m => m[1].trim())
  .filter(p => p !== 'Category value' && !/^-+$/.test(p));
const tags = [...tax.matchAll(/^- `([a-z0-9-]+)` — /gm)].map(m => m[1]);
if (portals.length < 10 || tags.length < 50) throw new Error(`taxonomy parse failed: ${portals.length} portals, ${tags.length} tags`);

// --- posts ---
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (e.name.startsWith('.') || e.name.startsWith('_')) return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : e.name.endsWith('.md') ? [p] : [];
  });
}
function postId(file) {
  const rel = path.relative(POSTS, file).replace(/\\/g, '/');
  return rel.endsWith('/index.md') ? rel.slice(0, -'/index.md'.length) : rel.slice(0, -3);
}
function parse(file) {
  let src = fs.readFileSync(file, 'utf8');
  const bom = src.charCodeAt(0) === 0xFEFF;
  if (bom) src = src.slice(1);
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const fm = m ? m[1] : '';
  const body = m ? src.slice(m[0].length) : src;
  const title = (fm.match(/^title:\s*["']?(.+?)["']?\s*$/m) || [, path.basename(file, '.md')])[1];
  const desc = (fm.match(/^description:\s*["']?(.+?)["']?\s*$/m) || [, ''])[1];
  return { file, id: postId(file), title, desc, excerpt: body.slice(0, 1500), fmRaw: m ? m[0] : null, bom };
}

fs.mkdirSync(WORKDIR, { recursive: true });
const done = new Set(fs.existsSync(OUT)
  ? fs.readFileSync(OUT, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l).id)
  : []);
const all = walk(POSTS).map(parse);
const todo = all.filter(p => !done.has(p.id)).slice(0, LIMIT);
console.log(`${all.length} posts, ${done.size} already classified, ${todo.length} to do (batch ${BATCH}, model ${MODEL})`);

// --- classify ---
const SYSTEM = `You classify articles for an Islamic knowledge wiki. Follow the taxonomy EXACTLY.

PORTALS (pick exactly one per article):
${portals.map(p => `- ${p}`).join('\n')}

TAGS (closed vocabulary — never invent):
${tags.join(', ')}

Rules:
- 2-5 concept tags per article; most-specific wins.
- At most one vs-* tag: the opponent actually being answered.
- Add "refutation" OR "exposition" (not both) when clearly one or the other.
- confidence: "high" | "low". Use "low" when unsure of the portal or when no tag fits well.
- If no concept fits, set "proposal" to a short suggested new tag slug, else omit it.

Respond with ONLY a JSON array, one object per article, same order, using the
article's numeric ID exactly as given:
[{"id":1,"category":"<portal>","tags":["..."],"confidence":"high","proposal":"..."}]
The array MUST contain one object for every article, no more, no fewer.`;

for (let i = 0; i < todo.length; i += BATCH) {
  const batch = todo.slice(i, i + BATCH);
  const prompt = batch.map((p, j) =>
    `ID: ${j + 1}\nTITLE: ${p.title}\n${p.desc ? `DESCRIPTION: ${p.desc}\n` : ''}EXCERPT:\n${p.excerpt}\n---`
  ).join('\n');
  let raw;
  try {
    raw = execFileSync('claude',
      ['-p', '--model', MODEL, '--append-system-prompt', SYSTEM, '--output-format', 'text'],
      { input: prompt, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 300000 });
  } catch (e) {
    console.error(`batch at ${i} failed: ${e.message}`); continue;
  }
  const jm = raw.match(/\[[\s\S]*\]/);
  if (!jm) {
    fs.writeFileSync(path.join(WORKDIR, `raw-fail-${i}.txt`), raw);
    console.error(`batch at ${i}: no JSON in response (raw saved)`); continue;
  }
  let results;
  try { results = JSON.parse(jm[0]); } catch { console.error(`batch at ${i}: bad JSON`); continue; }
  let matched = 0;
  for (const r of results) {
    const p = batch[Number(r.id) - 1];
    if (!p) continue;
    r.id = p.id;
    r.category = portals.includes(r.category) ? r.category : null;
    r.tags = (r.tags || []).filter(t => tags.includes(t));
    fs.appendFileSync(OUT, JSON.stringify(r) + '\n');
    matched++;
  }
  if (matched < batch.length) console.error(`  batch at ${i}: only ${matched}/${batch.length} results`);
  console.log(`  ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
}

// --- report / apply ---
const rows = fs.existsSync(OUT)
  ? fs.readFileSync(OUT, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  : [];
if (!rows.length) { console.log('nothing classified yet — no report.'); process.exit(0); }
const byId = new Map(all.map(p => [p.id, p]));
const low = rows.filter(r => r.confidence === 'low' || !r.category || r.tags.length < 2);
const proposals = rows.filter(r => r.proposal);
const catCount = {};
rows.forEach(r => { if (r.category) catCount[r.category] = (catCount[r.category] || 0) + 1; });
const tagCount = {};
rows.forEach(r => r.tags.forEach(t => tagCount[t] = (tagCount[t] || 0) + 1));

let report = `# Classification report — ${new Date().toISOString().slice(0, 10)}\n\n`;
report += `${rows.length} classified · ${low.length} need review · ${proposals.length} tag proposals\n\n## Portals\n`;
Object.entries(catCount).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => report += `- ${k}: ${v}\n`);
report += `\n## Tag usage\n`;
Object.entries(tagCount).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => report += `- ${k}: ${v}\n`);
report += `\n## Needs review (low confidence / no portal / <2 tags)\n`;
low.forEach(r => report += `- ${r.id} → ${r.category || '??'} [${r.tags.join(', ')}]\n`);
report += `\n## Proposed new tags\n`;
proposals.forEach(r => report += `- ${r.proposal} (${r.id})\n`);
fs.writeFileSync(path.join(WORKDIR, 'report.md'), report);
console.log(`report: .taxonomy-work/report.md — ${rows.length} classified, ${low.length} need review`);

if (flag('--apply')) {
  let applied = 0;
  for (const r of rows) {
    const p = byId.get(r.id);
    if (!p || !r.category || !r.tags.length) continue;
    let src = fs.readFileSync(p.file, 'utf8');
    const bom = src.charCodeAt(0) === 0xFEFF ? '﻿' : '';
    if (bom) src = src.slice(1);
    const m = src.match(/^---\r?\n([\s\S]*?)(\r?\n---\r?\n?)/);
    if (!m) continue;
    // strip ALL existing tags/category keys (bare, inline, or block form)
    const lines = m[1].split('\n');
    const kept = [];
    for (let j = 0; j < lines.length; j++) {
      if (/^category:/.test(lines[j])) continue;
      if (/^tags:/.test(lines[j])) {
        while (j + 1 < lines.length && /^[ \t]+-/.test(lines[j + 1])) j++;
        continue;
      }
      kept.push(lines[j]);
    }
    let fm = kept.join('\n').replace(/\n{2,}/g, '\n').replace(/\n+$/, '');
    fm += `\ncategory: "${r.category}"\ntags:\n${r.tags.map(t => `  - ${t}`).join('\n')}`;
    fs.writeFileSync(p.file, bom + '---\n' + fm + m[2] + src.slice(m[0].length));
    applied++;
  }
  console.log(`applied frontmatter to ${applied} posts`);
} else {
  console.log('dry-run (no files modified). Re-run with --apply to write frontmatter.');
}
