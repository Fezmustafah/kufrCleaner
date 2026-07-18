import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface CalloutMeta {
  icon: string;
  iconType?: 'lucide' | 'emoji';
  title: string;
}

// Icon/title for every in-repo type. COLOR is owned by Obsidian (generated CSS),
// independent of this map. Icons must exist in iconPaths in remark-callouts.ts.
export const calloutMappings: Record<string, CalloutMeta> = {
  // notices
  note:      { icon: 'info',           title: 'Note' },
  tip:       { icon: 'lightbulb',      title: 'Tip' },
  important: { icon: 'star',           title: 'Important' },
  warning:   { icon: 'triangle-alert', title: 'Warning' },
  caution:   { icon: 'circle-alert',   title: 'Caution' },
  danger:    { icon: 'circle-x',       title: 'Danger' },
  info:      { icon: 'info',           title: 'Info' },
  question:  { icon: 'circle-help',    title: 'Question' },
  success:   { icon: 'circle-check',   title: 'Success' },
  failure:   { icon: 'circle-x',       title: 'Failure' },
  bug:       { icon: 'bug',            title: 'Bug' },
  example:   { icon: 'code',           title: 'Example' },
  quote:     { icon: 'quote',          title: 'Quote' },
  abstract:  { icon: 'clipboard-list', title: 'Abstract' },
  summary:   { icon: 'clipboard-list', title: 'Summary' },
  tldr:      { icon: 'clipboard-list', title: 'TL;DR' },
  todo:      { icon: 'check-circle-2', title: 'Todo' },
  // academic / source family (color comes from Obsidian generated CSS)
  scholar:    { icon: 'graduation-cap', title: 'Scholar' },
  cite:       { icon: 'book',           title: 'Citation' },
  research:   { icon: 'search',         title: 'Research' },
  consensus:  { icon: 'landmark',       title: 'Consensus' },
  manuscript: { icon: 'scroll',         title: 'Manuscript' },
  science:    { icon: 'zap',            title: 'Science' },
  admission:  { icon: 'key',            title: 'Admission' },
  source:     { icon: 'link',           title: 'Source' },
  definition: { icon: 'book-open',      title: 'Definition' },
  // dialectic (theme-token colored in callouts.css, not Obsidian)
  objection:  { icon: 'swords',         title: 'Objection' },
  response:   { icon: 'shield',         title: 'Response' },
};

// Typo / synonym -> canonical. Resolved BEFORE lookup and emitted as data-callout,
// so `fail` picks up the `failure` styling. Extend as lint surfaces new ones.
export const aliases: Record<string, string> = {
  fail: 'failure',
  done: 'success',
  check: 'success',
  critical: 'danger',
  reference: 'cite',
};

export function resolveCalloutType(raw: string): string {
  const key = raw.toLowerCase();
  return aliases[key] ?? key;
}

let merged: Record<string, CalloutMeta> | null = null;
function getMerged(): Record<string, CalloutMeta> {
  if (merged) return merged;
  merged = { ...calloutMappings };
  try {
    const p = join(process.cwd(), 'src/generated/callouts-custom.json');
    if (existsSync(p)) {
      const custom = JSON.parse(readFileSync(p, 'utf-8')) as Record<string, CalloutMeta>;
      for (const [id, m] of Object.entries(custom)) merged[id] = m; // Obsidian wins
    }
  } catch {
    // generated metadata missing -> registry defaults + fallback still work
  }
  return merged;
}

export function getCalloutMeta(resolvedKey: string): CalloutMeta {
  const m = getMerged()[resolvedKey];
  if (m) return m;
  return { icon: 'info', title: resolvedKey.charAt(0).toUpperCase() + resolvedKey.slice(1) };
}

// Visual group for CSS: source-family types render de-carded (quotation form),
// objection/response stay a dialectic card pair, everything else is a notice
// card. Kept separate from SPLIT_TYPES in remark-callouts.ts (same members,
// different purpose) — not coupled for now, a one-line duplication is fine.
const SOURCE = new Set(['scholar', 'cite', 'research', 'consensus', 'manuscript', 'science', 'admission', 'source', 'quran', 'bible', 'hadith', 'quote']);
const DIALECTIC = new Set(['objection', 'response']);

export function getCalloutGroup(resolvedKey: string): 'source' | 'dialectic' | 'notice' {
  if (SOURCE.has(resolvedKey)) return 'source';
  if (DIALECTIC.has(resolvedKey)) return 'dialectic';
  return 'notice';
}
