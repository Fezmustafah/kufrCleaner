#!/usr/bin/env node

/**
 * Build-time callout linter.
 *
 * Reports the structural breakage the remark-callouts parser cannot heal:
 *   - missing-gt:     a `[!type]` marker with no leading `>` at all — renders
 *                      as plain text instead of a callout.
 *   - orphaned-body:  a title-only callout (`> [!type] Title` with nothing
 *                      after the title) whose next line lost its `>` prefix,
 *                      so the body detaches from the callout block.
 *
 * Non-fatal: this is a warning surfaced in `pnpm dev` / `pnpm build` output,
 * never a build failure. Always exits 0.
 *
 * `--fix` is intentionally a no-op for now — genuine content correction is a
 * reviewed codemod (Task 8); this script only reports until that transform
 * is defined.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const MARKER = /^(\s*)(>*)(\s*)\[!([\w-]+)\]([+\-]?)(.*)$/;

export function lintText(content) {
  const lines = content.split('\n');
  const issues = [];
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    const m = L.match(MARKER);
    // marker present but no leading '>' -> not a callout at all
    if (/\[!([\w-]+)\]/.test(L) && !/^\s*>/.test(L) && /^\s*\[!/.test(L)) {
      issues.push({ line: i + 1, kind: 'missing-gt', text: L.trim().slice(0, 80) });
      continue;
    }
    if (!m || !m[2]) continue; // not a > callout start
    const hadInline = m[6].trim().length > 0;
    const next = lines[i + 1] ?? '';
    // title-only callout whose next line is not blank and not a '>' continuation
    if (!hadInline && next.trim() !== '' && !/^\s*>/.test(next)) {
      issues.push({ line: i + 1, kind: 'orphaned-body', text: `[!${m[4]}] -> ${next.trim().slice(0, 60)}` });
    }
  }
  return issues;
}

function walk(dir) {
  let out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch (err) {
    console.warn(`callout-lint: could not read directory ${dir}: ${err.message}`);
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e);
    let isDir;
    try {
      isDir = statSync(p).isDirectory();
    } catch (err) {
      console.warn(`callout-lint: could not stat ${p}: ${err.message}`);
      continue;
    }
    if (isDir) out = out.concat(walk(p));
    else if (e.endsWith('.md')) out.push(p);
  }
  return out;
}

/**
 * Walks `root` for markdown files and collects structural callout issues.
 * Resilient by design: any filesystem error (missing directory, unreadable
 * file, permission issue) is warned and skipped rather than thrown, so this
 * function never breaks the caller. Returns `[]` if nothing could be read.
 */
export function collectIssues(root) {
  const results = [];
  let files;
  try {
    files = walk(root);
  } catch (err) {
    console.warn(`callout-lint: failed to walk ${root}: ${err.message}`);
    return results;
  }
  for (const f of files) {
    let content;
    try {
      content = readFileSync(f, 'utf8');
    } catch (err) {
      console.warn(`callout-lint: could not read ${f}: ${err.message}`);
      continue;
    }
    for (const issue of lintText(content)) {
      results.push({ file: f, ...issue });
    }
  }
  return results;
}

function main() {
  const root = join(process.cwd(), 'src/content/posts');
  const issues = collectIssues(root);
  for (const it of issues) console.warn(`${it.file}:${it.line}  [${it.kind}] ${it.text}`);
  if (issues.length) {
    console.warn(`\ncallout-lint: ${issues.length} issue(s). Run with --fix for mechanical cases, or correct in the content submodule.`);
  } else {
    console.log('callout-lint: no structural callout issues found.');
  }
}

// Only run the CLI walk when this file is executed directly (e.g. `node
// scripts/lint-callouts.js`), not when imported (e.g. by tests importing
// `lintText`) — importing must be side-effect-free.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (err) {
    console.warn(`callout-lint: unexpected error, skipping: ${err.message}`);
  }
  // Non-fatal: never break the build.
  process.exit(0);
}
