import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, Text } from 'mdast';

/**
 * Remark plugin — rough-notation annotations.
 *
 * INLINE (within a sentence):
 *   ==text==     highlight  (yellow)
 *   !!text!!     underline  (red)
 *   ^^text^^     box        (orange)
 *   ((text))     circle     (green)
 *   ||text||     bracket    (purple)
 *
 * BLOCK (code fence, whole phrase/sentence):
 *   ```highlight
 *   Full sentence here.
 *   ```
 */

const PATTERNS = [
  { type: 'highlight', open: '==', close: '==' },
  { type: 'underline', open: '!!', close: '!!' },
  { type: 'box',       open: '^^', close: '^^' },
  { type: 'circle',    open: '((', close: '))' },
  { type: 'bracket',   open: '||', close: '||' },
] as const;

type Pattern = (typeof PATTERNS)[number];

const BLOCK_TYPES = new Set(PATTERNS.map(p => p.type));

const DELIM = 2;

// Non-global regex literal for the quick-check — no dynamic RegExp creation.
const HAS_ANN = /==|!!|\^\^|\(\(|\|\|/;

const remarkAnnotations: Plugin<[], Root> = () => {
  return (tree) => {
    // ── Block: code fences with annotation language ───────────────────────
    visit(tree, 'code', (node: any, index, parent: any) => {
      if (!parent || typeof index !== 'number') return;
      if (!node.lang || !BLOCK_TYPES.has(node.lang)) return;

      parent.children[index] = {
        type: 'html',
        value: `<p class="rough-ann" data-ann-type="${node.lang}">${esc(node.value.replace(/\n+/g, ' ').trim())}</p>`,
      };
    });

    // ── Inline: ==text==, !!text!!, ^^text^^, ((text)), ||text|| ─────────
    // Mirrors the exact pattern used by remark-inline-tags.ts in this codebase.
    visit(tree, 'text', (node: Text, index, parent: any) => {
      if (!parent || typeof index !== 'number') return;
      if (!HAS_ANN.test(node.value)) return;

      const nodes = convert(node.value);
      parent.children.splice(index, 1, ...nodes);
    });
  };
};

/**
 * Split plain text into alternating text/html nodes using indexOf() —
 * no regex escaping needed, works reliably for all delimiter pairs.
 */
function convert(text: string): any[] {
  // Find the earliest opening delimiter.
  let bestIdx = Infinity;
  let best: Pattern | null = null;

  for (const p of PATTERNS) {
    const idx = text.indexOf(p.open);
    if (idx !== -1 && idx < bestIdx) {
      bestIdx = idx;
      best = p;
    }
  }

  if (!best) return [{ type: 'text', value: text }];

  // Find the matching close, starting after the opener.
  const closeIdx = text.indexOf(best.close, bestIdx + DELIM);

  if (closeIdx === -1) {
    // Unclosed — emit opener as literal text and recurse on the tail.
    return [
      { type: 'text', value: text.slice(0, bestIdx + DELIM) },
      ...convert(text.slice(bestIdx + DELIM)),
    ];
  }

  const content = text.slice(bestIdx + DELIM, closeIdx);
  const rest    = text.slice(closeIdx + DELIM);
  const result: any[] = [];

  if (bestIdx > 0) result.push({ type: 'text', value: text.slice(0, bestIdx) });
  result.push({
    type: 'html',
    value: `<span class="rough-ann" data-ann-type="${best.type}">${esc(content)}</span>`,
  });
  if (rest) result.push(...convert(rest));

  return result;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default remarkAnnotations;
