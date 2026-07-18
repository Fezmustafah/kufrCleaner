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
    // title-only callout whose next non-blank line is not a '>' continuation
    if (!hadInline && next.trim() !== '' && !/^\s*>/.test(next)) {
      issues.push({ line: i + 1, kind: 'orphaned-body', text: `[!${m[4]}] -> ${next.trim().slice(0, 60)}` });
    }
  }
  return issues;
}

function walk(dir) {
  let out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (e.endsWith('.md')) out.push(p);
  }
  return out;
}

function main() {
  const root = join(process.cwd(), 'src/content/posts');
  let total = 0;
  for (const f of walk(root)) {
    const issues = lintText(readFileSync(f, 'utf8'));
    if (!issues.length) continue;
    total += issues.length;
    for (const it of issues) console.warn(`${f}:${it.line}  [${it.kind}] ${it.text}`);
  }
  if (total) {
    console.warn(`\ncallout-lint: ${total} issue(s). Run with --fix for mechanical cases, or correct in the content submodule.`);
  } else {
    console.log('callout-lint: no structural callout issues found.');
  }
}

// Only run the CLI walk when this file is executed directly (e.g. `node
// scripts/lint-callouts.js`), not when imported (e.g. by tests importing
// `lintText`) — importing must be side-effect-free.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
  // Non-fatal: never break the build.
  process.exit(0);
}
