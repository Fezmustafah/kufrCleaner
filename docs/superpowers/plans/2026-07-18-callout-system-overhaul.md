# Callout System Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the callout subsystem consistent, per-type designable, and self-healing so malformed input renders sensibly or is surfaced by lint — "build and forget."

**Architecture:** A single in-repo registry owns icon/title + typo aliases + a no-blue fallback; Obsidian Callout Manager owns accent color (via the generator); a dedicated `callouts.css` owns per-type form. A build-time linter reports the structural breakage the parser can't heal. Content fixes are a separate, reviewed submodule batch.

**Tech Stack:** Astro 6 · TypeScript · remark (mdast/unist-util-visit) · Node build scripts · vitest (happy-dom) · Tailwind/CSS.

## Global Constraints

- `entry.id` not `entry.slug` (Astro v6). — not touched here, but never regress.
- **`src/content/**` is a git submodule.** Never `git add src/content/...` from the parent repo. Submodule commits use git identity `fayzabdul` (see repo memory), remote `Fezmustafah/content`.
- No `console.log()` in production code — gate behind `import.meta.env.DEV`. (Build scripts may log; they are not shipped.)
- Remark/rehype **plugin order is load-bearing** — do not reorder. `remarkCallouts` stays at its current position (#13).
- Theme options are only `"minimal" | "custom" | "al-andalus"`.
- Colors are CSS custom properties mapped via Tailwind — never hardcode hex in shipped component CSS for source types; consume `--callout-color/-border/-bg`.
- `[CONFIG:KEY]` markers in `src/config.ts` are sacred — not touched here.
- Tests live in `tests/unit/**/*.test.ts`; run with `pnpm test` (vitest). Path alias `@` → `src/`.

---

### Task 1: Callout registry (aliases + meta + no-blue fallback + Obsidian override)

Extract the icon/title map out of `remark-callouts.ts` into a pure, testable module. Add the typo/synonym alias map and a fallback that never yields blue. Flip merge precedence so Obsidian-generated metadata **overrides** in-repo defaults (lets the plugin drive brand-new types).

**Files:**
- Create: `src/utils/callout-registry.ts`
- Create: `tests/unit/callouts/registry.test.ts`

**Interfaces:**
- Produces:
  - `interface CalloutMeta { icon: string; iconType?: 'lucide' | 'emoji'; title: string }`
  - `resolveCalloutType(raw: string): string` — lowercases, applies alias map, returns canonical type used as `data-callout`.
  - `getCalloutMeta(resolvedKey: string): CalloutMeta` — registry ∪ Obsidian JSON (JSON wins), else `{ icon: 'info', title: <Capitalized> }`.
  - `calloutMappings: Record<string, CalloutMeta>` and `aliases: Record<string, string>` (exported for tests).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/callouts/registry.test.ts
import { describe, it, expect } from 'vitest';
import { resolveCalloutType, getCalloutMeta, aliases } from '@/utils/callout-registry';

describe('resolveCalloutType', () => {
  it('lowercases and passes known types through', () => {
    expect(resolveCalloutType('Quran')).toBe('quran');
    expect(resolveCalloutType('scholar')).toBe('scholar');
  });
  it('heals typo/synonym types via the alias map', () => {
    expect(resolveCalloutType('FAIL')).toBe('failure');
    expect(resolveCalloutType('done')).toBe('success');
    expect(resolveCalloutType('check')).toBe('success');
    expect(resolveCalloutType('critical')).toBe('danger');
    expect(resolveCalloutType('reference')).toBe('cite');
  });
});

describe('getCalloutMeta', () => {
  it('gives real icons to academic/dialectic types (no info fallback)', () => {
    expect(getCalloutMeta('scholar').icon).toBe('graduation-cap');
    expect(getCalloutMeta('objection').icon).toBe('swords');
    expect(getCalloutMeta('response').icon).toBe('shield');
  });
  it('falls back to info icon + capitalized title for unknown types (never blue name)', () => {
    expect(getCalloutMeta('totallyunknown')).toEqual({ icon: 'info', title: 'Totallyunknown' });
  });
  it('lets Obsidian-generated JSON override in-repo defaults', () => {
    // src/generated/callouts-custom.json ships hadith -> scroll-text
    expect(getCalloutMeta('hadith').icon).toBe('scroll-text');
  });
  it('exposes the alias map for the linter', () => {
    expect(aliases.fail).toBe('failure');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- registry`
Expected: FAIL — `Cannot find module '@/utils/callout-registry'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/utils/callout-registry.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- registry`
Expected: PASS (all cases). If `hadith` override test fails, confirm `src/generated/callouts-custom.json` exists (run `node scripts/generate-callout-css.js` once).

- [ ] **Step 5: Commit**

```bash
git add src/utils/callout-registry.ts tests/unit/callouts/registry.test.ts
git commit -m "feat(callouts): add registry with aliases, no-blue fallback, Obsidian override

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Wire the registry into the remark plugin (emit resolved type, keep icons local)

Replace the inline `calloutMappings`, custom-JSON merge, and fallback in `remark-callouts.ts` with the registry. Emit the **alias-resolved** type as `data-callout` so healed typos pick up the canonical styling. Keep `iconPaths` + `getIconSVG` where they are (rendering concern).

**Files:**
- Modify: `src/utils/remark-callouts.ts` (remove lines ~103–137: the local `calloutMappings` const, `CalloutMapping` interface's `type` field usage, and the try/catch JSON merge; add import)
- Create: `tests/unit/callouts/remark-render.test.ts`

**Interfaces:**
- Consumes: `resolveCalloutType`, `getCalloutMeta` from `@/utils/callout-registry`.
- Produces: HTML `<div class="callout" data-callout="<resolved>">` with icon from `getCalloutMeta`.

- [ ] **Step 1: Write the failing test** (integration: run the plugin through unified)

```ts
// tests/unit/callouts/remark-render.test.ts
import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import remarkCallouts from '@/utils/remark-callouts';

async function render(md: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkCallouts)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(md);
  return String(file);
}

describe('remark callout rendering', () => {
  it('emits the alias-resolved type as data-callout', async () => {
    const html = await render('> [!fail] Bad\n> body');
    expect(html).toContain('data-callout="failure"');
  });
  it('gives scholar its graduation-cap icon, not the info fallback', async () => {
    const html = await render('> [!scholar] Ibn Taymiyya\n> text');
    // graduation-cap path is distinct from the info circle; assert the title + a callout div
    expect(html).toContain('data-callout="scholar"');
    expect(html).toContain('Ibn Taymiyya');
  });
  it('renders an unknown type without crashing, capitalized title', async () => {
    const html = await render('> [!bismillah]\n> text');
    expect(html).toContain('data-callout="bismillah"');
    expect(html).toContain('Bismillah');
  });
  it('renders a nested > > callout', async () => {
    const html = await render('> outer\n> > [!quote] Inner\n> > quoted');
    expect(html).toContain('data-callout="quote"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- remark-render`
Expected: FAIL — `data-callout="failure"` not found (plugin still emits raw `fail`). If `unist`/`unified` deps missing, install nothing new — they are transitive deps of Astro's markdown pipeline; if the import errors, add the exact missing package the error names as a devDependency and note it.

- [ ] **Step 3: Edit the plugin to use the registry**

In `src/utils/remark-callouts.ts`:
1. Add at top (after existing imports): `import { resolveCalloutType, getCalloutMeta } from './callout-registry';`
2. Delete the local `const calloutMappings = { ... }` block and the `try { ... } catch {}` custom-merge block (~lines 103–137).
3. At the match site (~line 155), replace:

```ts
const calloutKey = calloutType.toLowerCase();
const mapping = calloutMappings[calloutKey] || {
  type: 'note',
  icon: 'info',
  title: calloutType.charAt(0).toUpperCase() + calloutType.slice(1)
};
```

with:

```ts
const calloutKey = resolveCalloutType(calloutType);
const mapping = getCalloutMeta(calloutKey);
```

4. In the emitted HTML (~line 246) `data-callout="${calloutKey}"` is already correct (now the resolved key). Confirm `getIconSVG(mapping.icon, mapping.iconType ?? 'lucide')` still compiles (drop any reference to the removed `mapping.type`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- remark-render`
Expected: PASS.

- [ ] **Step 5: Full test + typecheck**

Run: `pnpm test && npx astro check`
Expected: All tests pass; no new TS errors in `remark-callouts.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/utils/remark-callouts.ts tests/unit/callouts/remark-render.test.ts
git commit -m "refactor(callouts): render via registry, emit alias-resolved data-callout

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Fix the color generator (dark custom styles + condition handling)

`scripts/generate-callout-css.js` writes `customStyles` only to the light block and silently drops `theme`/compound color conditions. Fix both and export the pure helpers for testing.

**Files:**
- Modify: `scripts/generate-callout-css.js`
- Create: `tests/unit/callouts/generate-callout-css.test.ts`

**Interfaces:**
- Produces (named exports added to the script): `classifyCondition(cond): 'light' | 'dark' | 'both' | null` and `toColor(raw): string`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/callouts/generate-callout-css.test.ts
import { describe, it, expect } from 'vitest';
import { classifyCondition, toColor } from '../../../scripts/generate-callout-css.js';

describe('toColor', () => {
  it('wraps bare r,g,b triples', () => {
    expect(toColor('15, 118, 110')).toBe('rgb(15, 118, 110)');
  });
  it('passes hex/rgb/hsl through', () => {
    expect(toColor('#abc')).toBe('#abc');
    expect(toColor('rgb(1,2,3)')).toBe('rgb(1,2,3)');
  });
});

describe('classifyCondition', () => {
  it('maps colorScheme conditions', () => {
    expect(classifyCondition({ colorScheme: 'light' })).toBe('light');
    expect(classifyCondition({ colorScheme: 'dark' })).toBe('dark');
  });
  it('treats an unconditional change as both schemes', () => {
    expect(classifyCondition(undefined)).toBe('both');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- generate-callout-css`
Expected: FAIL — helpers not exported (or file not importable). If the script is CommonJS, add `export { classifyCondition, toColor };` compatible with its module system (match the file's existing `import`/`require` style).

- [ ] **Step 3: Implement the fixes**

In `scripts/generate-callout-css.js`:
1. Export the two helpers (named exports) alongside their existing definitions.
2. Make `classifyCondition` return `'both'` for an absent/`undefined` condition (unconditional `changes`), and keep `theme`/compound conditions from being dropped — apply their color to **both** schemes (`return 'both'`) with a `console.warn` noting the condition was flattened, rather than silently skipping.
3. In the block that builds the light rule vs dark rule (~lines 149–157), apply `customStyles` to the **dark** rule too. Concretely, wherever `customStyles` is concatenated into the light `--callout-*` block, add the identical concatenation to the dark block.

- [ ] **Step 4: Run helper test + regenerate**

Run: `pnpm test -- generate-callout-css && node scripts/generate-callout-css.js`
Expected: PASS; script regenerates `src/styles/callouts-custom.css` + `src/generated/callouts-custom.json` without error.

- [ ] **Step 5: Commit** (do NOT stage regenerated artifacts if unchanged; if changed, include them)

```bash
git add scripts/generate-callout-css.js tests/unit/callouts/generate-callout-css.test.ts
git add -u src/styles/callouts-custom.css src/generated/callouts-custom.json 2>/dev/null || true
git commit -m "fix(callouts): generator applies custom styles to dark, flattens theme conditions

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Seed the source family in Obsidian Callout Manager (submodule)

Add the full source family to `data.json` so the generator emits their accent colors. **This edits the content submodule** — commit inside the submodule as `fayzabdul`.

**Files:**
- Modify (submodule): `src/content/.obsidian/plugins/callout-manager/data.json`

- [ ] **Step 1: Confirm submodule identity**

Run: `git -C src/content config user.name`
Expected: `fayzabdul` (if empty, set it: `git -C src/content config user.name fayzabdul && git -C src/content config user.email <fayzabdul email>`).

- [ ] **Step 2: Add the source-family entries**

Merge these into `callouts.custom` (append the ids) and `callouts.settings` (add each block). Colors are muted starting points distinct from scripture green/indigo/teal; the user re-tunes in Obsidian. Each block: unconditional icon + light + dark color, matching the existing `hadith` serialization shape.

```jsonc
// ids to add to "custom": scholar, cite, research, consensus, manuscript, science, admission, source, quote
"scholar":    [ {"changes":{"icon":"lucide-graduation-cap"}}, {"condition":{"colorScheme":"light"},"changes":{"color":"146, 64, 14"}},  {"condition":{"colorScheme":"dark"},"changes":{"color":"251, 191, 36"}} ],
"cite":       [ {"changes":{"icon":"lucide-book"}},           {"condition":{"colorScheme":"light"},"changes":{"color":"71, 85, 105"}},   {"condition":{"colorScheme":"dark"},"changes":{"color":"148, 163, 184"}} ],
"research":   [ {"changes":{"icon":"lucide-search"}},         {"condition":{"colorScheme":"light"},"changes":{"color":"14, 116, 144"}},  {"condition":{"colorScheme":"dark"},"changes":{"color":"34, 211, 238"}} ],
"consensus":  [ {"changes":{"icon":"lucide-landmark"}},       {"condition":{"colorScheme":"light"},"changes":{"color":"109, 40, 217"}},  {"condition":{"colorScheme":"dark"},"changes":{"color":"167, 139, 250"}} ],
"manuscript": [ {"changes":{"icon":"lucide-scroll"}},         {"condition":{"colorScheme":"light"},"changes":{"color":"120, 113, 108"}}, {"condition":{"colorScheme":"dark"},"changes":{"color":"214, 211, 209"}} ],
"science":    [ {"changes":{"icon":"lucide-zap"}},            {"condition":{"colorScheme":"light"},"changes":{"color":"3, 105, 161"}},   {"condition":{"colorScheme":"dark"},"changes":{"color":"56, 189, 248"}} ],
"admission":  [ {"changes":{"icon":"lucide-key"}},            {"condition":{"colorScheme":"light"},"changes":{"color":"159, 18, 57"}},   {"condition":{"colorScheme":"dark"},"changes":{"color":"251, 113, 133"}} ],
"source":     [ {"changes":{"icon":"lucide-link"}},           {"condition":{"colorScheme":"light"},"changes":{"color":"82, 82, 91"}},    {"condition":{"colorScheme":"dark"},"changes":{"color":"161, 161, 170"}} ]
```

(Leave `quote`, `objection`, `response` OUT of Obsidian — `quote` uses the theme highlight; `objection`/`response` are theme-token colored in `callouts.css`.)

- [ ] **Step 3: Regenerate + verify**

Run: `node scripts/generate-callout-css.js`
Then verify: `grep -c "data-callout='scholar'" src/styles/callouts-custom.css` → expect ≥ 2 (light + dark), and `node -e "const j=require('./src/generated/callouts-custom.json'); console.log(j.scholar, j.research)"` → shows icon+title.

- [ ] **Step 4: Commit the submodule, then the pointer**

```bash
git -C src/content add .obsidian/plugins/callout-manager/data.json
git -C src/content commit -m "content: seed source-family callout colors/icons"
# parent repo: stage regenerated artifacts + submodule pointer bump
git add src/styles/callouts-custom.css src/generated/callouts-custom.json src/content
git commit -m "feat(callouts): generate source-family accents from Callout Manager

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Build-time callout linter (`scripts/lint-callouts.js`)

Report the structural breakage the parser cannot heal (missing `>`, orphaned body) as `file:line`. Non-fatal warning in the pipeline. `--fix` mechanically re-prefixes the safe cases.

**Files:**
- Create: `scripts/lint-callouts.js`
- Create: `tests/unit/callouts/lint-callouts.test.ts`
- Modify: `package.json` (add `"lint-callouts": "node scripts/lint-callouts.js"`; insert `node scripts/lint-callouts.js` into the `dev` and `build` pipelines right after `generate-callout-css.js`)

**Interfaces:**
- Produces (named export for tests): `lintText(content: string): { line: number; kind: 'missing-gt' | 'orphaned-body'; text: string }[]`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/callouts/lint-callouts.test.ts
import { describe, it, expect } from 'vitest';
import { lintText } from '../../../scripts/lint-callouts.js';

describe('lintText', () => {
  it('flags a marker with no leading > (renders as plain text)', () => {
    const issues = lintText('some para\n[!objection] hey\nmore');
    expect(issues.some(i => i.kind === 'missing-gt' && i.line === 2)).toBe(true);
  });
  it('flags a title-only callout whose body lost its > prefix', () => {
    const issues = lintText('> [!quote]\n((Nuaim said this))\n');
    expect(issues.some(i => i.kind === 'orphaned-body' && i.line === 1)).toBe(true);
  });
  it('passes a well-formed callout', () => {
    expect(lintText('> [!quran] 2:255\n> Ayat al-Kursi')).toEqual([]);
  });
  it('does not flag a normal blockquote-wrapped callout continuation', () => {
    expect(lintText('> [!hadith] Bukhari\n> chain\n> matn')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- lint-callouts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the linter**

```js
// scripts/lint-callouts.js
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

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

// CLI: report (default) or --fix (only the mechanical missing-gt insertion)
if (import.meta.url === `file://${process.argv[1]}`) {
  const fix = process.argv.includes('--fix');
  const root = 'src/content/posts';
  let total = 0;
  for (const f of walk(root)) {
    const issues = lintText(readFileSync(f, 'utf8'));
    if (!issues.length) continue;
    total += issues.length;
    for (const it of issues) console.warn(`${f}:${it.line}  [${it.kind}] ${it.text}`);
  }
  if (total) console.warn(`\ncallout-lint: ${total} issue(s). Run with --fix for mechanical cases, or correct in the content submodule.`);
  // Non-fatal: never break the build.
  process.exit(0);
}
```

(`--fix` is intentionally minimal/no-op for now; genuine content correction is Task 8's reviewed codemod. Leave the flag wired but only reporting until Task 8 defines the safe transform.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- lint-callouts`
Expected: PASS.

- [ ] **Step 5: Wire into pipeline + run once**

Edit `package.json` `dev` and `build` scripts to add `&& node scripts/lint-callouts.js` immediately after `node scripts/generate-callout-css.js`. Then:

Run: `pnpm lint-callouts`
Expected: prints ~60 `file:line` issues (missing-gt / orphaned-body), exits 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/lint-callouts.js tests/unit/callouts/lint-callouts.test.ts package.json
git commit -m "feat(callouts): build-time linter surfaces unhealable structural breakage

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Bespoke per-type forms — `src/styles/callouts.css` (mockup-driven)

Extract all callout CSS out of `global.css` into a dedicated file, neutralize the base (kill `#448aff`), consolidate the 5×-duplicated de-carded lists into one, and build the per-type forms. **The exact declarations are finalized against real posts in a browser mockup before landing.**

**Files:**
- Create: `src/styles/callouts.css`
- Modify: `src/styles/global.css` (remove the callout blocks now living in `callouts.css`; add `@import './callouts.css';` next to the existing `@import` of `callouts-custom.css` at line ~12; keep math-in-callout and mermaid-in-callout rules where they are or move them into `callouts.css` — keep them together with callouts)

- [ ] **Step 1: Mockup the forms**

Build a single static HTML file previewing every archetype against copied real post excerpts (quote, quran/bible/hadith, scholar/cite/research/consensus, objection/response, note/warning). Use the visual companion / a scratch `.html`. Get user sign-off on: quote wrapping-marks style, scripture rule + attribution, academic uniform treatment, dialectic card pair. **Do not proceed to Step 2 until the user approves the look.**

- [ ] **Step 2: Neutralize the base**

In the base `.callout-title` and `.callout-title-inner > span` rules, replace `var(--callout-color, #448aff)` with `var(--callout-color, rgb(var(--color-primary-600)))` (theme-neutral, no blue). Ensure `.callout-content` text does **not** inherit `--callout-color` — body stays default prose color.

- [ ] **Step 3: Consolidate + build forms**

Move the callout CSS into `callouts.css`. Replace the five separate de-carded selector lists (`quote,bible,quran,hadith,scholar,admission,cite` repeated for border/title/title-inner/icon/content) with the **full academic+scripture+quote source set** in a single grouped selector per property, driven off `[data-callout]`. Add the approved per-type bespoke rules from Step 1 (e.g. `quote`'s `::before/::after` quotation marks, hadith grade line). Colors consume `--callout-color/-border/-bg` only.

- [ ] **Step 4: Build + visual verify**

Run: `pnpm build`
Expected: build succeeds. Then spot-check rendered HTML for a scripture post, a `scholar` post, an `objection/response` post, and a `note` post — confirm: no blue text, consistent source form, quote marks present, notices still carded. (Use the `run`/`verify` skill to drive the dev server and eyeball a sample.)

- [ ] **Step 5: Commit**

```bash
git add src/styles/callouts.css src/styles/global.css
git commit -m "feat(callouts): per-type bespoke forms, neutral base, consolidated selectors

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Remove dead code and fix the stale skill doc

**Files:**
- Delete: `src/components/PostInfobox.astro`
- Modify: `.claude/skills/scripture-callouts/SKILL.md` (the line claiming `PostInfobox.astro` regexes the body — point it at `src/layouts/PostLayout.astro:108–116` instead)

- [ ] **Step 1: Confirm it's truly unimported**

Run: `grep -rn "PostInfobox" src/ .claude/ | grep -v "PostInfobox.astro:"`
Expected: only the skill-doc reference (no `import`).

- [ ] **Step 2: Delete + fix doc**

```bash
rm src/components/PostInfobox.astro
```
Edit `SKILL.md`: replace the `PostInfobox.astro` counter reference with: the "Sources cited" infobox is counted inline in `src/layouts/PostLayout.astro` (`sourceCounts`, ~lines 108–116) and rendered ~lines 263–271.

- [ ] **Step 3: Build verify**

Run: `pnpm build`
Expected: build succeeds (nothing referenced the deleted file).

- [ ] **Step 4: Commit**

```bash
git add -A src/components .claude/skills/scripture-callouts/SKILL.md
git commit -m "chore(callouts): delete dead PostInfobox, fix scripture-callouts skill pointer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Content healing codemod (submodule, reviewed)

Fix the ~60 structural breakages the linter reports. **Content submodule — the user reviews the diff before it runs.** Typo types need no edit (healed by aliases).

**Files:**
- Create: `scripts/fix-callouts.mjs` (codemod, run manually, not in pipeline)
- Modify (submodule, after review): the flagged `src/content/posts/*.md`

- [ ] **Step 1: Generate the report**

Run: `pnpm lint-callouts > /tmp/callout-issues.txt; wc -l /tmp/callout-issues.txt`
Review the two kinds: `missing-gt` (add `>`) and `orphaned-body` (re-prefix continuation lines with `> ` until the blank line).

- [ ] **Step 2: Write the codemod**

`scripts/fix-callouts.mjs`: for each flagged file, `missing-gt` → prepend `> ` to the marker line and following non-blank lines until a blank line; `orphaned-body` → prepend `> ` to the orphaned continuation lines. Reuse `lintText` from `lint-callouts.js` to locate. Write in **dry-run by default**, `--write` to apply. Print a unified diff to stdout.

- [ ] **Step 3: Dry-run + user review**

Run: `node scripts/fix-callouts.mjs`   (prints diffs, writes nothing)
**Present the diff to the user. Wait for explicit approval before `--write`.**

- [ ] **Step 4: Apply + verify + commit submodule**

```bash
node scripts/fix-callouts.mjs --write
pnpm lint-callouts        # expect 0 issues (or only ambiguous ones left for manual)
git -C src/content add -A
git -C src/content commit -m "content: heal structurally-broken callouts (missing >, orphaned bodies)"
git add scripts/fix-callouts.mjs src/content
git commit -m "chore(callouts): codemod + healed content submodule pointer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Self-healing L1 aliases → Task 1. L2 no-blue fallback → Task 1 (+ base CSS Task 6). L3 tolerant parser (nested/no-space) → Task 2 tests. L4 lint → Task 5. ✓
- Ownership seam: color=Obsidian → Task 3+4; icon/title=registry∪JSON → Task 1+2; form=callouts.css → Task 6; neutral base → Task 6. ✓
- Generator fixes (dark customStyles, theme/compound) → Task 3. ✓
- Obsidian seed of full source family → Task 4. ✓
- Fill mappings for all real types → Task 1. ✓
- Per-type forms (quote marks, scripture, dialectic, academic uniform, notices) → Task 6. ✓
- Cleanups (PostInfobox delete, skill doc, 5×-dup consolidation) → Task 6 (consolidation) + Task 7 (delete/doc). ✓
- Content healing as reviewed submodule batch → Task 8. ✓

**Placeholder scan:** No TBD/TODO in shipped logic. Task 6 declarations are deliberately mockup-finalized (a user-gated design step), not a vague placeholder — its structural changes (neutralize base, consolidate, import) are concrete. `--fix` in Task 5 is intentionally report-only until Task 8; noted inline.

**Type consistency:** `resolveCalloutType`/`getCalloutMeta`/`CalloutMeta`/`aliases` consistent across Tasks 1–2. `lintText` signature consistent across Tasks 5 & 8. `classifyCondition`/`toColor` consistent in Task 3.
