/**
 * parse-bib.mjs
 *
 * Parses src/content/manuscripts/_refs.bib (Better BibTeX / Zotero export format)
 * and writes the normalized reference array to src/data/global-refs.json.
 *
 * Run automatically before astro dev/build via package.json scripts.
 * Also supports an optional --bib <path> flag for custom input.
 *
 * obsidian-zotlit workflow:
 *   Zotero → Better BibTeX (auto-export) → _refs.bib → this script → global-refs.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Allow --bib <path> override
const bibArgIdx = process.argv.indexOf('--bib');
const BIB_PATH = bibArgIdx !== -1
  ? process.argv[bibArgIdx + 1]
  : join(ROOT, 'src/content/manuscripts/_refs.bib');
const OUT_PATH = join(ROOT, 'src/data/global-refs.json');

if (!existsSync(BIB_PATH)) {
  console.log('[parse-bib] No _refs.bib found — writing empty global-refs.json');
  if (!existsSync(OUT_PATH)) writeFileSync(OUT_PATH, '[]\n', 'utf-8');
  process.exit(0);
}

const bibText = readFileSync(BIB_PATH, 'utf-8');
const raw = parseBibtex(bibText);
const normalized = raw.map(normalizeEntry).filter(Boolean);

writeFileSync(OUT_PATH, JSON.stringify(normalized, null, 2) + '\n', 'utf-8');
console.log(`[parse-bib] ${normalized.length} entries → src/data/global-refs.json`);

// ─── BibTeX parser ────────────────────────────────────────────────────────────

function parseBibtex(text) {
  const entries = [];
  let i = 0;
  const len = text.length;

  const skip = () => { while (i < len && /\s/.test(text[i])) i++; };

  while (i < len) {
    // Advance to next @
    while (i < len && text[i] !== '@') i++;
    if (i >= len) break;
    i++; // skip @
    skip();

    // Read entry type
    let type = '';
    while (i < len && /\w/.test(text[i])) type += text[i++];
    type = type.toLowerCase();
    skip();

    if (i >= len || text[i] !== '{') continue;
    i++; // skip {
    skip();

    // Skip non-data entries
    if (['comment', 'preamble', 'string'].includes(type)) {
      let depth = 1;
      while (i < len && depth > 0) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') depth--;
        i++;
      }
      continue;
    }

    // Citation key — everything up to first comma
    let key = '';
    while (i < len && text[i] !== ',' && text[i] !== '}') key += text[i++];
    key = key.trim();
    if (!key || i >= len) continue;
    i++; // skip comma

    // Fields
    const fields = {};
    while (i < len) {
      skip();
      if (i >= len || text[i] === '}') { i++; break; }

      // Field name
      let fname = '';
      while (i < len && /\w/.test(text[i])) fname += text[i++];
      fname = fname.toLowerCase();
      skip();

      if (i >= len || text[i] !== '=') { i++; continue; }
      i++; // skip =
      skip();

      // Field value
      let value = '';
      if (i < len && text[i] === '{') {
        i++;
        let depth = 1;
        while (i < len) {
          if (text[i] === '{') { depth++; value += text[i++]; }
          else if (text[i] === '}') {
            depth--;
            if (depth === 0) { i++; break; }
            value += text[i++];
          } else {
            value += text[i++];
          }
        }
      } else if (i < len && text[i] === '"') {
        i++;
        while (i < len && text[i] !== '"') value += text[i++];
        if (i < len) i++;
      } else {
        while (i < len && !/[,}\s]/.test(text[i])) value += text[i++];
      }

      if (fname) fields[fname] = value.trim();

      skip();
      if (i < len && text[i] === ',') i++;
    }

    entries.push({ key, type, fields });
  }

  return entries;
}

// ─── Normalization ────────────────────────────────────────────────────────────

function normalizeEntry({ key, type, fields }) {
  if (!key) return null;

  const out = { id: key, type };

  // Authors: "Last, First and Last2, First2" → string | string[]
  if (fields.author) {
    const parts = fields.author
      .split(/\s+and\s+/i)
      .map(a => {
        const halves = a.split(',').map(s => s.trim());
        return halves.length >= 2 ? `${halves[1]} ${halves[0]}` : halves[0];
      })
      .filter(Boolean);
    out.author = parts.length === 1 ? parts[0] : parts;
  }

  // Editors (same format as author)
  if (fields.editor) {
    const parts = fields.editor
      .split(/\s+and\s+/i)
      .map(a => {
        const halves = a.split(',').map(s => s.trim());
        return halves.length >= 2 ? `${halves[1]} ${halves[0]}` : halves[0];
      })
      .filter(Boolean);
    out.editor = parts.length === 1 ? parts[0] : parts;
  }

  // Year as integer
  if (fields.year) {
    const y = parseInt(fields.year, 10);
    if (!isNaN(y)) out.year = y;
  }

  // String fields — strip LaTeX markup
  for (const f of ['title', 'journal', 'booktitle', 'publisher', 'doi', 'url', 'volume', 'pages', 'address', 'edition', 'note', 'series', 'isbn', 'issn']) {
    if (fields[f]) out[f] = stripLatex(fields[f]);
  }

  // BibTeX 'number' → our 'issue'
  if (fields.number) out.issue = fields.number;

  // 'accessed' date for online sources
  if (fields.urldate || fields.accessed) out.accessed = fields.urldate ?? fields.accessed;

  return out;
}

/** Strip common LaTeX markup from a string. */
function stripLatex(str) {
  return str
    .replace(/\\['"^`~=.u]\{?(\w)\}?/g, '$1')   // accented: \'e → e
    .replace(/\\emph\{([^}]*)\}/g, '$1')           // \emph{x} → x
    .replace(/\\textit\{([^}]*)\}/g, '$1')
    .replace(/\\textbf\{([^}]*)\}/g, '$1')
    .replace(/\{([^{}]*)\}/g, '$1')                // remaining {x} → x
    .replace(/\\-/g, '-')                          // \- (hyphenation hint)
    .replace(/\\[a-zA-Z]+\s*/g, '')                // remaining commands
    .replace(/\s+/g, ' ')
    .trim();
}
