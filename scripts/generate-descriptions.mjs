/**
 * generate-descriptions.mjs — FREE, no API needed
 *
 * Generates meta descriptions from post title + first meaningful sentences.
 *
 * Usage:
 *   node scripts/generate-descriptions.mjs
 *   node scripts/generate-descriptions.mjs --dry-run
 *   node scripts/generate-descriptions.mjs --limit 10
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = path.join(__dirname, '..', 'src', 'content', 'posts');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE   = args.includes('--force');
const LIMIT = (() => { const i = args.indexOf('--limit'); return i !== -1 ? parseInt(args[i + 1]) : Infinity; })();

// ── Helpers ────────────────────────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)/);
  if (!match) return null;
  return { fm: match[1], body: match[2] };
}

function getField(fm, field) {
  const m = fm.match(new RegExp(`^${field}:\\s*["']?(.*?)["']?\\s*$`, 'm'));
  return m ? m[1].trim() : '';
}

function hasDescription(fm) {
  if (!/^description:/m.test(fm)) return false;
  const m = fm.match(/^description:\s*(.*)\s*$/m);
  if (!m) return false;
  return m[1].replace(/^["']|["']$/g, '').trim().length > 5;
}

function cleanBody(body) {
  return body
    .replace(/```[\s\S]*?```/g, '')       // code blocks
    .replace(/!\[.*?\]\(.*?\)/g, '')       // images
    .replace(/\[!\w+\][+-]?\s*\w*/g, '')  // callout markers
    .replace(/^>+.*/gm, '')               // blockquotes
    .replace(/<[^>]+>/g, '')              // HTML tags
    .replace(/^\|.*\|$/gm, '')            // tables
    .replace(/^#{1,6}\s+.*$/gm, '')        // remove entire heading lines
    .replace(/\*\*([^*]+)\*\*/g, '$1')    // bold
    .replace(/\*([^*]+)\*/g, '$1')        // italic
    .replace(/==([^=]+)==/g, '$1')        // highlights
    .replace(/\[\[.*?\]\]/g, '')          // wikilinks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // markdown links
    .replace(/\{\{.*?\}\}/g, '')          // sidenotes
    .replace(/^\s*[-*+]\s+/gm, '')        // list bullets
    .replace(/^[-*_]{3,}\s*$/gm, '')      // horizontal rules (---, ***, ___)
    .replace(/https?:\/\/\S+/g, '')       // all URLs (bare lines and inline)
    .replace(/\{Embed\}/gi, '')           // embed placeholders
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractSentences(text, maxChars = 400) {
  const sentences = text
    .split(/(?<=[.!?؟])\s+/)
    .map(s => s.trim())
    .filter(s =>
      s.length > 30 &&
      !/^\d+\./.test(s) &&                              // numbered list items
      !/^https?:\/\//.test(s) &&                        // bare URLs
      !/table of contents/i.test(s) &&                  // TOC headings
      !/(?:link is|click here|page number|as follows|see below|see above|visit|subscribe)/i.test(s) // reference orphans
    );

  let result = '';
  for (const s of sentences) {
    if ((result + ' ' + s).length > maxChars) break;
    result += (result ? ' ' : '') + s;
  }
  return result;
}

function buildDescription(title, category, opening) {
  // Collapse newlines — multi-line descriptions break YAML frontmatter
  opening = opening.replace(/\s*\n+\s*/g, ' ').trim();

  // Try to build a 140–155 char description

  // Strategy 1: if opening sentences are good, use them directly
  if (opening.length >= 100 && opening.length <= 155) {
    return opening;
  }

  // Strategy 2: truncate opening to fit
  if (opening.length > 155) {
    // Cut at last sentence boundary before 155
    const truncated = opening.slice(0, 152);
    const lastPeriod = Math.max(
      truncated.lastIndexOf('. '),
      truncated.lastIndexOf('? '),
      truncated.lastIndexOf('! '),
    );
    if (lastPeriod > 80) {
      return truncated.slice(0, lastPeriod + 1).trim();
    }
    const hardCut = truncated.slice(0, 150);
    const lastSpace = hardCut.lastIndexOf(' ');
    return (lastSpace > 100 ? hardCut.slice(0, lastSpace) : hardCut).trim() + '…';
  }

  // Strategy 3: opening too short — pad with category context
  if (opening.length > 0) {
    const pad = category ? ` A ${category} analysis with full evidence.` : ' Full evidence and scholarly sources included.';
    const combined = opening + pad;
    return combined.slice(0, 155).trim();
  }

  // Strategy 4: fallback — build from title alone
  const base = title.replace(/\s*[|–—:]\s*.*$/, '').trim(); // strip subtitle
  const suffix = category
    ? ` — ${category} analysis with scholarly evidence and primary sources.`
    : ' — detailed Islamic analysis with primary sources.';
  return (base + suffix).slice(0, 155).trim();
}

function injectDescription(content, description) {
  const escaped = description.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  // Replace any existing description field (single or multi-line quoted value)
  if (/^description:/m.test(content)) {
    // Remove old description (handles multi-line quoted YAML strings too)
    const cleaned = content.replace(/^description:[ \t]*"[\s\S]*?(?<!\\)"\s*\n/m, '')
                           .replace(/^description:[ \t]*'[\s\S]*?(?<!\\)'\s*\n/m, '')
                           .replace(/^description:.*\n/m, '');
    return cleaned.replace(/^(title:.*$)/m, `$1\ndescription: "${escaped}"`);
  }
  // Inject after title line
  return content.replace(/^(title:.*$)/m, `$1\ndescription: "${escaped}"`);
}

// ── Main ───────────────────────────────────────────────────────────────────

const allFiles = fs.readdirSync(POSTS_DIR)
  .filter(f => f.endsWith('.md') && !f.includes('attachments'));

let toProcess = allFiles.filter(f => {
  if (FORCE) return true;
  const content = fs.readFileSync(path.join(POSTS_DIR, f), 'utf8');
  const parsed = parseFrontmatter(content);
  if (!parsed) return false;
  return !hasDescription(parsed.fm);
});

if (LIMIT < Infinity) toProcess = toProcess.slice(0, LIMIT);

console.log(`Posts to process: ${toProcess.length}`);
if (DRY_RUN) console.log('DRY RUN — no files will be written\n');

let processed = 0, skipped = 0;

for (const filename of toProcess) {
  const filepath = path.join(POSTS_DIR, filename);
  const content = fs.readFileSync(filepath, 'utf8');
  const parsed = parseFrontmatter(content);
  if (!parsed) { skipped++; continue; }

  const title    = getField(parsed.fm, 'title');
  const category = getField(parsed.fm, 'category');
  const cleaned  = cleanBody(parsed.body);
  const opening  = extractSentences(cleaned, 350);

  if (!title) { skipped++; continue; }

  const desc = buildDescription(title, category, opening);

  if (!desc || desc.length < 40) { skipped++; continue; }

  if (DRY_RUN) {
    console.log(`[${desc.length}c] ${title.slice(0, 55)}`);
    console.log(`  → ${desc}\n`);
  } else {
    const updated = injectDescription(content, desc);
    fs.writeFileSync(filepath, updated, 'utf8');
    processed++;
    if (processed % 50 === 0) console.log(`  ${processed}/${toProcess.length} done...`);
  }
}

if (!DRY_RUN) {
  console.log(`\nDone. Written: ${processed}, Skipped: ${skipped}`);
  console.log('Next: cd src/content && git add -A && git commit -m "feat: add meta descriptions to all posts"');
} else {
  console.log(`\nDry run complete. Run without --dry-run to write files.`);
}
