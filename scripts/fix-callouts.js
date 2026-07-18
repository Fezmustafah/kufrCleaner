#!/usr/bin/env node

/**
 * Content-healing codemod for the structural callout breakage reported by
 * `lint-callouts.js` (`missing-gt`, `orphaned-body`).
 *
 * The fix is conservative: for the callout block starting at each reported
 * line, ensure every non-blank line from that line up to the next blank line
 * begins with `> `; prepend `> ` to any that doesn't.
 *
 * DRY-RUN BY DEFAULT. Prints a per-file, line-level diff and a summary
 * total, writing nothing. Pass `--write` to apply the changes in place.
 *
 * `src/content/` is a git submodule — this script never assumes it may be
 * committed from here; that is a separate, user-approved step.
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { lintText } from './lint-callouts.js';

export function fixText(content) {
  const lines = content.split('\n');
  const issues = lintText(content); // [{line, kind, ...}] 1-based
  const toPrefix = new Set(); // 0-based line indices to prefix with "> "
  for (const it of issues) {
    for (let i = it.line - 1; i < lines.length; i++) {
      if (lines[i].trim() === '') break; // block ends at blank line
      if (!/^\s*>/.test(lines[i])) toPrefix.add(i);
    }
  }
  for (const i of toPrefix) lines[i] = '> ' + lines[i];
  return lines.join('\n');
}

function walk(dir) {
  let out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch (err) {
    console.warn(`fix-callouts: could not read directory ${dir}: ${err.message}`);
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e);
    let isDir;
    try {
      isDir = statSync(p).isDirectory();
    } catch (err) {
      console.warn(`fix-callouts: could not stat ${p}: ${err.message}`);
      continue;
    }
    if (isDir) out = out.concat(walk(p));
    else if (e.endsWith('.md')) out.push(p);
  }
  return out;
}

function diffLines(original, out) {
  const origLines = original.split('\n');
  const outLines = out.split('\n');
  const changed = [];
  const len = Math.max(origLines.length, outLines.length);
  for (let i = 0; i < len; i++) {
    if (origLines[i] !== outLines[i]) {
      changed.push({ lineNo: i + 1, before: origLines[i] ?? '', after: outLines[i] ?? '' });
    }
  }
  return changed;
}

function main() {
  const write = process.argv.includes('--write');
  const root = join(process.cwd(), 'src/content/posts');
  let files;
  try {
    files = walk(root);
  } catch (err) {
    console.warn(`fix-callouts: failed to walk ${root}: ${err.message}`);
    files = [];
  }

  let filesChanged = 0;
  let linesChanged = 0;

  for (const f of files) {
    let original;
    try {
      original = readFileSync(f, 'utf8');
    } catch (err) {
      console.warn(`fix-callouts: could not read ${f}: ${err.message}`);
      continue;
    }

    const out = fixText(original);
    if (out === original) continue;

    const changed = diffLines(original, out);
    filesChanged += 1;
    linesChanged += changed.length;

    if (write) {
      try {
        writeFileSync(f, out, 'utf8');
      } catch (err) {
        console.warn(`fix-callouts: could not write ${f}: ${err.message}`);
        continue;
      }
    } else {
      for (const c of changed) {
        console.log(`  ${f}:${c.lineNo}`);
        console.log(`    - ${c.before}`);
        console.log(`    + ${c.after}`);
      }
    }
  }

  if (write) {
    console.log(`wrote ${filesChanged} file(s).`);
  } else {
    console.log(`\n${filesChanged} file(s), ${linesChanged} line(s) would change.`);
  }
}

// Only run the CLI walk when this file is executed directly (e.g. `node
// scripts/fix-callouts.js`), not when imported (e.g. by tests importing
// `fixText`) — importing must be side-effect-free.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (err) {
    console.warn(`fix-callouts: unexpected error, skipping: ${err.message}`);
  }
  // Non-fatal: never break the build.
  process.exit(0);
}
