#!/usr/bin/env node
/**
 * Build the AI assistant's search index.
 *
 * Reads every published post, strips it to plain text, splits it into chunks,
 * and POSTs them to the Worker's /ingest route. The Worker embeds each chunk
 * (Workers AI) and upserts it into Vectorize. Re-run after content changes —
 * chunk ids are stable, so re-ingesting overwrites rather than duplicating.
 *
 * Usage:
 *   AI_WORKER_URL=https://openislam-ai.<sub>.workers.dev \
 *   AI_INGEST_SECRET=... \
 *   pnpm ai:index            (add --dry-run to preview without sending)
 *
 * Env (also read from a local .env via dotenv if present):
 *   AI_WORKER_URL     required — deployed Worker base URL
 *   AI_INGEST_SECRET  required — must match the Worker's INGEST_SECRET
 *   AI_SITE_URL       optional — site origin for source links
 *                     (default https://www.openislam.wiki)
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, relative, extname, basename, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

try {
  const { config } = await import('dotenv');
  config();
} catch {
  /* dotenv optional */
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = join(__dirname, '..', 'src', 'content', 'posts');

const WORKER_URL = (process.env.AI_WORKER_URL || '').replace(/\/$/, '');
const INGEST_SECRET = process.env.AI_INGEST_SECRET || '';
const SITE_URL = (process.env.AI_SITE_URL || 'https://www.openislam.wiki').replace(/\/$/, '');
const DRY_RUN = process.argv.includes('--dry-run');

const MAX_CHARS = 1400; // ~ a few paragraphs per chunk
const BATCH = 50; // chunks per /ingest request (Worker caps at 100)

/** Tiny stable hash so Vectorize ids stay short and deterministic. */
function shortHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Strip Markdown / Obsidian syntax down to readable plain text. */
function stripMarkdown(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ') // fenced code
    .replace(/`[^`]*`/g, ' ') // inline code
    .replace(/%%[\s\S]*?%%/g, ' ') // Obsidian comments
    .replace(/!\[\[[^\]]*\]\]/g, ' ') // embeds
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g, (_, a, b) => b || a) // wikilinks -> text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> text
    .replace(/^>\s?\[![^\]]*\][^\n]*$/gim, ' ') // callout headers
    .replace(/<[^>]+>/g, ' ') // html tags
    .replace(/\[\^[^\]]+\]/g, ' ') // footnote refs
    .replace(/\[@[^\]]+\]/g, ' ') // citations
    .replace(/[#>*_~=^]+/g, ' ') // md punctuation / annotations
    .replace(/\|/g, ' ') // table pipes
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Split text into <= MAX_CHARS chunks on paragraph boundaries, 1-para overlap. */
function chunkText(text) {
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let buf = '';
  let prevPara = '';
  for (const p of paras) {
    if (buf && buf.length + p.length + 2 > MAX_CHARS) {
      chunks.push(buf.trim());
      buf = prevPara ? prevPara + '\n\n' : ''; // small overlap for context
    }
    buf += (buf ? '\n\n' : '') + p;
    prevPara = p;
    while (buf.length > MAX_CHARS * 1.5) {
      // very long single paragraph: hard split
      chunks.push(buf.slice(0, MAX_CHARS).trim());
      buf = buf.slice(MAX_CHARS);
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  let data = {};
  try {
    data = yaml.load(m[1]) || {};
  } catch {
    data = {};
  }
  return { data, body: m[2] };
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'attachments') continue; // not real posts
      out.push(...(await walk(full)));
    } else if (/\.mdx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function postIdFromPath(file) {
  let rel = relative(POSTS_DIR, file).split(sep).join('/');
  rel = rel.replace(extname(rel), '');
  if (basename(rel) === 'index') rel = dirname(rel); // folder-based post
  return rel;
}

async function main() {
  if (!DRY_RUN && (!WORKER_URL || !INGEST_SECRET)) {
    console.error('✖ AI_WORKER_URL and AI_INGEST_SECRET are required (or pass --dry-run).');
    process.exit(1);
  }

  const files = await walk(POSTS_DIR);
  const allChunks = [];
  let skipped = 0;

  for (const file of files) {
    const raw = await readFile(file, 'utf8');
    const { data, body } = parseFrontmatter(raw);
    if (data.draft === true || data.noIndex === true) {
      skipped++;
      continue;
    }
    const id = postIdFromPath(file);
    const title = (data.title || id).toString();
    const url = encodeURI(`${SITE_URL}/posts/${id}/`);
    const text = stripMarkdown(body);
    if (!text) continue;

    const chunks = chunkText(text);
    const hash = shortHash(id);
    chunks.forEach((chunk, i) => {
      allChunks.push({
        id: `${hash}-${i}`,
        text: `${title}\n\n${chunk}`,
        title,
        url,
      });
    });
  }

  console.log(
    `Indexed ${files.length - skipped} posts (${skipped} skipped) -> ${allChunks.length} chunks.`,
  );

  if (DRY_RUN) {
    console.log('Dry run — nothing sent. Sample chunk:\n');
    console.log(JSON.stringify(allChunks[0], null, 2));
    return;
  }

  let sent = 0;
  for (let i = 0; i < allChunks.length; i += BATCH) {
    const batch = allChunks.slice(i, i + BATCH);
    const res = await fetch(`${WORKER_URL}/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${INGEST_SECRET}`,
      },
      body: JSON.stringify({ chunks: batch }),
    });
    if (!res.ok) {
      console.error(`✖ Batch ${i / BATCH + 1} failed: ${res.status} ${await res.text()}`);
      process.exit(1);
    }
    sent += batch.length;
    console.log(`  ↑ ${sent}/${allChunks.length} chunks`);
  }

  console.log('✅ Index complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
