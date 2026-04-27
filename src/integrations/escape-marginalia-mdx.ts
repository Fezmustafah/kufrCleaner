import type { AstroIntegration } from 'astro';

/**
 * Escape {{...}} in .mdx files before @astrojs/mdx's acorn parser sees them.
 *
 * MDX treats {expr} as JS expressions, so {{text}} fails to parse.
 * We replace {{...}} with ⟪...⟫ (U+27EA/U+27EB) here; remarkMarginalia
 * normalises ⟪/⟫ back to {{/}} in text nodes before its buffer loop runs.
 *
 * The algorithm operates on the full source string (not line-by-line) so that
 * {{...}} spanning multiple lines is handled gracefully instead of crashing:
 *   - Skips fenced code blocks (``` / ~~~) detected at line starts
 *   - Inline backtick spans on the same line skip {{ detection
 *   - {{...}} content may span newlines — scans until matching }}
 *   - JSX attribute objects (style={{ ... }}) are detected by preceding '=' and skipped
 */

function escapeMarginaliaInMdx(code: string): string {
  let result = '';
  let i = 0;
  const len = code.length;
  let inFence = false;
  let fenceChar = '';
  let fenceLen = 0;

  while (i < len) {
    // ── Fenced code block detection at line start ───────────────────────
    const atLineStart = i === 0 || code[i - 1] === '\n';
    if (atLineStart) {
      const fenceMatch = code.slice(i).match(/^( {0,3})(`{3,}|~{3,})/);
      if (fenceMatch) {
        const fc = fenceMatch[2][0];
        const fl = fenceMatch[2].length;
        if (!inFence) {
          inFence = true; fenceChar = fc; fenceLen = fl;
        } else if (fc === fenceChar && fl >= fenceLen) {
          inFence = false;
        }
      }
    }

    if (inFence) {
      result += code[i++];
      continue;
    }

    // ── Inline backtick span (single-line only) ─────────────────────────
    if (code[i] === '`') {
      result += '`';
      i++;
      while (i < len && code[i] !== '`' && code[i] !== '\n') result += code[i++];
      if (i < len && code[i] === '`') { result += '`'; i++; }
      continue;
    }

    // ── {{ marginalia }} — may span lines ───────────────────────────────
    if (code[i] === '{' && code[i + 1] === '{') {
      // Skip JSX attribute objects: style={{ ... }} — preceded by '='
      if (result.trimEnd().endsWith('=')) {
        result += code[i++]; // output first '{' literally
        continue;
      }
      const start = i;
      i += 2; // skip opening {{
      let inner = '';
      let found = false;
      while (i < len) {
        if (code[i] === '}' && code[i + 1] === '}') { found = true; i += 2; break; }
        inner += code[i++];
      }
      result += found
        ? '\u27ea' + inner + '\u27eb' // ⟪inner⟫
        : code.slice(start, i);       // unclosed {{ — output literally
      continue;
    }

    result += code[i++];
  }
  return result;
}

export function escapeMarginaliaForMdx(): AstroIntegration {
  return {
    name: 'escape-marginalia-mdx',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'mdx-escape-marginalia',
                enforce: 'pre' as const,
                transform(code: string, id: string) {
                  if (!id.endsWith('.mdx')) return;
                  return { code: escapeMarginaliaInMdx(code), map: null };
                },
              },
            ],
          },
        });
      },
    },
  };
}
