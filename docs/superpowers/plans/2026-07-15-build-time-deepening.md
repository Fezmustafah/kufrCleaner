# Build-Time Reduction & Deepening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut `pnpm build` wall-clock by replacing the O(N²) linked-mentions rescan with a build-once backlink index, gating off the unused Bases feature, deduplicating build-script logic, and consolidating the search runtime — with byte-level behavior-preservation gates at every step.

**Architecture:** Four workstreams behind small seams. (1) `src/utils/backlink-index.ts` inverts every post's outgoing links once per build; `LinkedMentions.astro` does a map lookup. The `internallinks.ts` URL logic moves behind a pure `src/utils/url-resolver.ts` with a prefix-rule table, pinned by a characterization suite run through the real remark transformer. (2) A `bases.enabled: false` config flag conditionally registers `remarkBases` and empties the base routes. (3) `scripts/lib/` gains a js-yaml frontmatter parser and an image-extension predicate; `generate-deployment-config.js` splits into per-platform adapter modules. (4) A `PagefindGateway` owns Pagefind loading/hydration for both search views; the orphaned pure-function test is ported into the vitest suite.

**Tech Stack:** Astro 6.1.2, TypeScript 5.9, Vitest 4 + happy-dom, js-yaml ^4.1.1, sharp, Pagefind, Swup, pnpm.

## ⚠️ DESCOPED — 2026-07-16 (owner decision)

Build time is the goal; code-quality refactors of working code are not. Active tasks:

- **Task 1** — baseline measurement (evidence gate: read the numbers with the owner before proceeding)
- **Task 2** — backlink index (the O(N²) → O(N) fix; standard Astro-ecosystem pattern)
- **Task 3** — wire LinkedMentions + delete the dead code the fix orphans
- **Task 6** — Bases gate + ADR-0002
- **Task 6b (new)** — CI caching in `.github/workflows/pages.yml` (pnpm store + `.astro/`); CI builds are cold-cache on a 2-vCPU runner — likely the largest CI win per line
- **Task 13** — final measurement + parity gates (trimmed to active workstreams)

Tasks 4–5 and 7–12 are **parked**, not deleted — see `BACKLOG.md` §3. Their task text below stays for future pickup. Spec deviations 4–5 move with them; deviations 1–3 and 6 remain live.

## Global Constraints

- **`entry.id`, never `entry.slug`** — slug is removed in Astro v6.
- **Never edit `src/content/**`** — it is a git submodule. (`process-aliases.js` writing there is pre-existing script behavior; this plan must not add new writes and must verify the submodule stays byte-identical.)
- **Do not reorder the remark/rehype pipeline.** `remarkCitations` first, `rehypeNormalizeAnchors` last. `[remarkInternalLinks, { base: '/' }]` stays at its current position (`astro.config.mjs:496`).
- **No `console.log()` in production** — client/src code gates behind `import.meta.env.DEV`; build scripts gate behind `process.env.NODE_ENV !== 'production'` (the existing `log` helpers already do this — reuse them).
- **`[CONFIG:KEY]` markers in `src/config.ts` are sacred** — the new flag carries `// [CONFIG:BASES_ENABLED]` on its own line above the key (repo style).
- **The production CSP lives in `scripts/generate-deployment-config.js` (`CSP` constant, line 30)** — it must survive byte-identical through the script split.
- **`devToolbar.enabled: true` stays.** Never edit vendored `src/graph/**/pixi.js` / `pixi.d.ts`.
- **Do NOT delete `.astro/` or other build caches** — the image-dims prewarm cache protects against r2.dev rate limits. All measurements are warm-cache.
- Tests live in `tests/unit/**/*.test.ts` (vitest glob), import via the `@/` → `src/` alias, `describe`/`it`/`expect` idiom.
- One commit per task. Run `pnpm test` before every commit.
- Never start implementation on `main` — Task 1 creates the working branch.

## Spec deviations decided during plan-writing

The design spec was written before full code exploration. These facts changed five decisions — each is a *smaller* intervention than specified, and each needs the human partner's awareness:

1. **Backlink excerpts are dead output.** `findLinkedMentions` computes an `excerpt` per mention, but `LinkedMentions.astro` (its only caller) renders only `title` and `slug`. The spec's behavior gate is "same mentions, same order, same titles" — excerpt is deliberately not in it. Therefore: no excerpt-compiler module; `buildBacklinkIndex` stores `{ slug, title }` edges; `createExcerptAroundWikilink` (line 1153) and `extractExcerptAtPosition` (line 1237) are deleted (≈170 lines, cognitive-96).
2. **`buildBacklinkIndex(posts)` takes no `pages` param.** The spec interface included `pages` only because the excerpt path consumed it. Mentions are only ever mined from `posts` bodies. `LinkedMentions.astro` also drops its `getCollection('pages')` call.
3. **The posts-cache globals are dead code** (`set/get/populateGlobalPostsCache`, `internallinks.ts:11-21` — zero importers anywhere). Deleted, not wrapped in a typed accessor.
4. **The two `parseFrontmatter` copies are NOT byte-identical** (spec said they were). `process-aliases.js` preserves Obsidian `"[[...]]"` quotes for its round-trip write path; `generate-deployment-config.js` strips all quotes. The shared js-yaml parser needs a corpus-parity gate, and `process-aliases`' whole-frontmatter rewrite becomes a surgical aliases-block replacement (the old rewrite would corrupt nested frontmatter like `faq:` if it ever fired — recorded as a correction).
5. **`sync-images.js` already has an mtime skip** (source-newer-than-webp check in both sync paths). The spec's "conditional second lever" already exists; Task 1 just records the phase timing, no skip work.
6. **`remarkBases` is conditionally *not registered*** (the spec's preferred option), via array spread at the existing pipeline position — zero per-post cost when disabled, order untouched.

## Target file map

### Created
- `src/utils/backlink-index.ts` — build-once backlink inversion + memoized accessor
- `src/utils/url-resolver.ts` — pure internal-link URL resolution (prefix-rule table)
- `src/scripts/search/pagefind-gateway.ts` — Pagefind loading + result normalization seam
- `scripts/lib/frontmatter.js` — js-yaml frontmatter parser + alias helpers
- `scripts/lib/images.js` — raster-image predicate + WebP path mapper
- `scripts/lib/platforms/{vercel,github-pages,netlify,cloudflare-workers}.js` — per-platform deployment adapters
- `docs/adr/0002-bases-feature-gated-off.md`
- `tests/unit/internal-links/backlink-index.test.ts`
- `tests/unit/internal-links/link-characterization.test.ts`
- `tests/unit/internal-links/url-resolver.test.ts`
- `tests/unit/scripts/frontmatter.test.ts`
- `tests/unit/scripts/images.test.ts`
- `tests/unit/search/search.test.ts` (ported from `src/utils/search.test.ts`)
- `tests/unit/search/pagefind-gateway.test.ts`

### Modified
- `src/components/LinkedMentions.astro` — index lookup instead of corpus rescan
- `src/utils/internallinks.ts` — dead code deleted; URL logic delegated to url-resolver
- `src/layouts/PostLayout.astro` — remove no-op `processWikilinksInHTML` import/call
- `src/config.ts` — `bases.enabled` flag + `SiteConfig` field
- `astro.config.mjs` — conditional `remarkBases` registration
- `src/pages/base/[...base].astro`, `src/pages/base/index.astro` — gated
- `scripts/process-aliases.js` — shared parser, surgical aliases write
- `scripts/generate-deployment-config.js` — shared parser, then split into dispatcher + adapters
- `scripts/sync-images.js` — shared image predicate
- `src/scripts/search-client.ts` — consumes the gateway
- `src/components/SearchPalette.astro` — consumes the gateway
- `.gitignore` — `.build-baseline/`

### Deleted
- `src/utils/search.test.ts` (after porting)

## Execution notes (fill in during Tasks 1 and 13)

| Phase | Baseline (s) | After (s) | Δ |
|---|---|---|---|
| sync-images | 0.086 | | |
| process-aliases | 0.232 | | |
| generate-deployment-config | 0.130 | | |
| generate-graph-data --production | 0.123 | | |
| parse-bib | 0.020 | | |
| generate-callout-css | 0.021 | | |
| prewarm-image-dims | 0.095 | | |
| cf-assets pre | 0.022 | | |
| astro build | 343.91 | | |
| cf-assets post | 0.023 | | |
| **Total** | **344.66** | | |

Baseline captured 2026-07-16 (warm cache; 1,534 pages built; Pagefind indexed 1,533 pages). `sync-images`: 0 synced, 1 skipped-unchanged — mtime skip confirmed active. Parity artifacts: `hrefs.txt` = 93,886 lines; `mentions.txt` = 142 posts with backlinks. Note: dist paths contain spaces (category pages), so the href/mentions dump commands use `find ... | sort | tr '\n' '\0' | xargs -0` (and `grep -H`) — Task 13 must use the identical space-safe form. `--dry-run` is NOT fully write-gated (`updateAstroConfig` at line 907 and `cleanupOtherPlatformFiles` at line 921 run unconditionally in `generateRedirects`), so only the current platform (`netlify`) was captured — no foreign-platform dry-runs.

`astro check` baseline: 6 errors, 0 warnings, 207 hints.

---

## Task 1: Branch, baseline measurement, and parity artifacts

**Files:**
- Modify: `.gitignore`
- Modify: `docs/superpowers/plans/2026-07-15-build-time-deepening.md` (this file — record numbers)

**Interfaces:**
- Produces: `.build-baseline/` artifacts every later parity gate diffs against: `hrefs.txt`, `mentions.txt`, `astro-check.txt`, `gdc-*.txt`, per-phase `NN-*.log` timings.

- [ ] **Step 1: Create the working branch**

```bash
cd /Users/fxwalken/Documents/GitHub/kufrCleaner
git checkout -b build-time-deepening
```

- [ ] **Step 2: Ignore the baseline directory**

Append to `.gitignore`:

```
# Build-time baseline artifacts (plan 2026-07-15-build-time-deepening)
.build-baseline/
```

- [ ] **Step 3: Verify the content submodule is clean (pre-condition for parity gates)**

```bash
git -C src/content status --porcelain | wc -l
```
Expected: `0`. If not 0, STOP and ask — parity gates assume a clean submodule.

- [ ] **Step 4: Run the timed build pipeline (warm cache — do NOT delete `.astro/`)**

```bash
mkdir -p .build-baseline
( time node scripts/sync-images.js )               2>&1 | tee .build-baseline/01-sync-images.log | tail -3
( time node scripts/process-aliases.js )           2>&1 | tee .build-baseline/02-process-aliases.log | tail -3
( time node scripts/generate-deployment-config.js ) 2>&1 | tee .build-baseline/03-gdc.log | tail -3
( time node scripts/generate-graph-data.js --production ) 2>&1 | tee .build-baseline/04-graph.log | tail -3
( time node scripts/parse-bib.mjs )                2>&1 | tee .build-baseline/05-bib.log | tail -3
( time node scripts/generate-callout-css.js )      2>&1 | tee .build-baseline/06-callouts.log | tail -3
( time node scripts/prewarm-image-dims.mjs )       2>&1 | tee .build-baseline/07-prewarm.log | tail -3
( time node scripts/cf-assets.js pre )             2>&1 | tee .build-baseline/08-cf-pre.log | tail -3
( time pnpm exec astro build )                     2>&1 | tee .build-baseline/09-astro-build.log | tail -5
( time node scripts/cf-assets.js post )            2>&1 | tee .build-baseline/10-cf-post.log | tail -3
```

Record every `real` time in the Execution notes table above. Also note the `sync-images` synced/skipped counts from its log (they confirm the existing mtime skip is active).

- [ ] **Step 5: Capture the internal-link href dump (byte-parity artifact)**

```bash
find dist -name '*.html' | sort | xargs grep -oE 'href="[^"]*"' > .build-baseline/hrefs.txt
wc -l .build-baseline/hrefs.txt
```
Expected: a large line count (hundreds of thousands is fine). This is the before-image for the internal-link byte-parity gate.

- [ ] **Step 6: Capture the linked-mentions dump (mentions/order/titles parity artifact)**

```bash
find dist -name '*.html' | sort | xargs node -e '
const fs = require("fs");
for (const f of process.argv.slice(1)) {
  const html = fs.readFileSync(f, "utf8");
  const m = html.match(/<div id="linked-mentions-content"[\s\S]*?<\/section>/);
  if (m) console.log("=== " + f + "\n" + m[0]);
}' > .build-baseline/mentions.txt
grep -c '^=== ' .build-baseline/mentions.txt
```
Expected: a count equal to the number of posts that have at least one backlink. Record the count.

- [ ] **Step 7: Capture deployment-config outputs**

First check whether `--dry-run` fully suppresses writes: open `scripts/generate-deployment-config.js` and confirm `updateAstroConfig` and `cleanupOtherPlatformFiles` are gated on `DRY_RUN` inside `generateRedirects` (line ~831). **If they are NOT gated, only capture the current platform** (skip the foreign-platform loop) — running foreign platforms would mutate the repo.

```bash
node scripts/generate-deployment-config.js --validate 2>&1 | tee .build-baseline/gdc-validate.txt
# Only if dry-run is fully write-free:
for p in vercel github-pages netlify cloudflare-workers; do
  DEPLOYMENT_PLATFORM=$p node scripts/generate-deployment-config.js --dry-run \
    > .build-baseline/gdc-dry-$p.txt 2>&1
done
git status --porcelain   # must be empty (plus the .gitignore edit) — dry runs wrote nothing
cp public/_redirects .build-baseline/_redirects 2>/dev/null || true
cp public/_headers   .build-baseline/_headers   2>/dev/null || true
cp wrangler.toml     .build-baseline/wrangler.toml
```

- [ ] **Step 8: Capture the `astro check` baseline**

```bash
pnpm exec astro check 2>&1 | tail -5 | tee .build-baseline/astro-check.txt
```
Record the error/warning/hint counts in Execution notes.

- [ ] **Step 9: Verify the submodule is still clean, then commit**

```bash
git -C src/content status --porcelain | wc -l   # expected: 0
git add .gitignore docs/superpowers/plans/2026-07-15-build-time-deepening.md
git commit -m "chore: capture build-time baseline for deepening plan"
```

---

## Task 2: Backlink index module (TDD)

**Files:**
- Create: `src/utils/backlink-index.ts`
- Test: `tests/unit/internal-links/backlink-index.test.ts`

**Interfaces:**
- Consumes: `extractWikilinks(content: string): WikilinkMatch[]`, `extractStandardLinks(content: string): WikilinkMatch[]` from `@/utils/internallinks` (both stay exported), `Post` from `@/types`.
- Produces: `buildBacklinkIndex(posts: Post[]): BacklinkIndex`, `getBacklinkIndex(posts: Post[]): BacklinkIndex`, `interface LinkedMention { slug: string; title: string; excerpt?: string }`, `interface BacklinkIndex { mentionsOf(slug: string): LinkedMention[] }` — Task 3 wires `LinkedMentions.astro` to `getBacklinkIndex`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/internal-links/backlink-index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildBacklinkIndex, getBacklinkIndex } from '@/utils/backlink-index';
import { findLinkedMentions } from '@/utils/internallinks';
import type { Post } from '@/types';

function post(id: string, title: string, body: string): Post {
  return { id, body, data: { title } } as unknown as Post;
}

// Fixture corpus exercising: wikilinks, standard links, folder-based /index
// links, multiple links to one target (one mention), self-links (excluded),
// and a post with no links.
const corpus = [
  post('alpha', 'Alpha Post', 'See [[beta]] and also [beta again](posts/beta.md).'),
  post('beta', 'Beta Post', 'Backlink to [[Alpha Post]] and [[alpha]].'),
  post('gamma', 'Gamma Post', 'No internal links here.'),
  post('delta', 'Delta Post', 'Folder link [b](posts/beta/index.md), self [[delta]].'),
];

describe('buildBacklinkIndex', () => {
  it('inverts outgoing links into per-target mentions in corpus order', () => {
    const index = buildBacklinkIndex(corpus);
    expect(index.mentionsOf('beta')).toEqual([
      { slug: 'alpha', title: 'Alpha Post' },
      { slug: 'delta', title: 'Delta Post' },
    ]);
  });

  it('emits one mention per source post regardless of link count', () => {
    const index = buildBacklinkIndex(corpus);
    expect(index.mentionsOf('alpha')).toEqual([{ slug: 'beta', title: 'Beta Post' }]);
  });

  it('excludes self-links and returns [] for unlinked or unknown slugs', () => {
    const index = buildBacklinkIndex(corpus);
    expect(index.mentionsOf('delta')).toEqual([]);
    expect(index.mentionsOf('gamma')).toEqual([]);
    expect(index.mentionsOf('does-not-exist')).toEqual([]);
  });

  it('skips posts without a body', () => {
    const index = buildBacklinkIndex([
      post('a', 'A', undefined as unknown as string),
      post('b', 'B', 'links [[a]]'),
    ]);
    expect(index.mentionsOf('a')).toEqual([{ slug: 'b', title: 'B' }]);
  });
});

describe('getBacklinkIndex memoization', () => {
  it('returns the same index instance for an unchanged corpus (builds once per build)', () => {
    const a = getBacklinkIndex(corpus);
    const b = getBacklinkIndex(corpus);
    expect(b).toBe(a);
  });

  it('rebuilds when the corpus changes (dev reload)', () => {
    const a = getBacklinkIndex(corpus);
    const changed = [...corpus, post('epsilon', 'Epsilon', 'links [[alpha]]')];
    const b = getBacklinkIndex(changed);
    expect(b).not.toBe(a);
    expect(b.mentionsOf('alpha')).toContainEqual({ slug: 'epsilon', title: 'Epsilon' });
  });
});

// Deleted in Task 3 along with findLinkedMentions itself — the explicit
// expectations above are the durable golden; this block proves index/legacy
// parity while both exist.
describe('parity with findLinkedMentions (temporary)', () => {
  it('matches legacy mentions, order, and titles for every slug in the corpus', () => {
    const index = buildBacklinkIndex(corpus);
    for (const { id } of corpus) {
      const legacy = (findLinkedMentions(corpus, id) as Array<{ slug: string; title: string }>)
        .map((m) => ({ slug: m.slug, title: m.title }));
      expect(index.mentionsOf(id)).toEqual(legacy);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm exec vitest run tests/unit/internal-links/backlink-index.test.ts
```
Expected: FAIL — cannot resolve `@/utils/backlink-index`.

- [ ] **Step 3: Write the implementation**

Create `src/utils/backlink-index.ts`:

```ts
import type { Post } from '@/types';
import { extractStandardLinks, extractWikilinks } from '@/utils/internallinks';

export interface LinkedMention {
  slug: string;
  title: string;
  excerpt?: string; // reserved — excerpts are not rendered anywhere today
}

export interface BacklinkIndex {
  mentionsOf(slug: string): LinkedMention[];
}

// Built ONCE per build: inverts every post's outgoing wikilinks + standard
// links into a target-slug -> [mentions] map. O(N) over the corpus, replacing
// the per-page full-corpus rescan in findLinkedMentions (O(N²)).
export function buildBacklinkIndex(posts: Post[]): BacklinkIndex {
  const map = new Map<string, LinkedMention[]>();
  for (const post of posts) {
    if (!post.body) continue;
    const links = [...extractWikilinks(post.body), ...extractStandardLinks(post.body)];
    const targets = new Set(links.map((link) => link.slug));
    for (const target of targets) {
      if (target === post.id) continue; // legacy behavior: self-links never count
      let mentions = map.get(target);
      if (!mentions) map.set(target, (mentions = []));
      mentions.push({ slug: post.id, title: post.data.title });
    }
  }
  return {
    mentionsOf(slug) {
      return map.get(slug) ?? [];
    },
  };
}

let cached: { key: string; index: BacklinkIndex } | null = null;

// Memoized accessor: Astro renders every page in one process, so the first
// page render builds the index and the rest reuse it. Keyed on a cheap corpus
// fingerprint so a dev-mode content change rebuilds it.
// ponytail: length fingerprint — a same-length body edit in dev serves stale
// backlinks until any other edit; hash the bodies if that ever matters.
export function getBacklinkIndex(posts: Post[]): BacklinkIndex {
  let bodyChars = 0;
  for (const post of posts) bodyChars += post.body?.length ?? 0;
  const key = `${posts.length}:${bodyChars}`;
  if (cached?.key !== key) {
    cached = { key, index: buildBacklinkIndex(posts) };
  }
  return cached.index;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm exec vitest run tests/unit/internal-links/backlink-index.test.ts
```
Expected: PASS (all describes, including legacy parity). If the parity block fails, the fixture exposed a semantic you missed — fix `buildBacklinkIndex`, never the legacy function.

- [ ] **Step 5: Run the full suite and commit**

```bash
pnpm test
git add src/utils/backlink-index.ts tests/unit/internal-links/backlink-index.test.ts
git commit -m "feat: add build-once backlink index behind BacklinkIndex interface"
```

---

## Task 3: Wire LinkedMentions to the index; delete dead internal-link code

**Files:**
- Modify: `src/components/LinkedMentions.astro:1-15`
- Modify: `src/layouts/PostLayout.astro` (remove `processWikilinksInHTML` import + call site)
- Modify: `src/utils/internallinks.ts` (deletions only)
- Modify: `src/types.ts` (delete `LinkedMention` interface if unreferenced)
- Test: `tests/unit/internal-links/backlink-index.test.ts` (remove temporary parity block)

**Interfaces:**
- Consumes: `getBacklinkIndex(posts: Post[]): BacklinkIndex` from Task 2.
- Produces: `internallinks.ts` public surface shrinks to exactly: `remarkInternalLinks`, `remarkFolderImages`, `remarkImageCaptions`, `remarkWikilinks`, `remarkStandardLinks`, `extractWikilinks`, `extractStandardLinks` (the two remark sub-plugins lose their `export` in Task 5).

- [ ] **Step 1: Rewire `LinkedMentions.astro`**

Replace the frontmatter (lines 1–15) with:

```astro
---
import { getBacklinkIndex } from '@/utils/backlink-index';
import { getCollection } from 'astro:content';
import Icon from './Icon.astro';

export interface Props {
  currentSlug: string;
}

const { currentSlug } = Astro.props;

// Backlinks come from a corpus-wide index built once per build (O(N)),
// not a per-page rescan of every post body (O(N²)).
const posts = await getCollection('posts');
const linkedMentions = getBacklinkIndex(posts).mentionsOf(currentSlug);
---
```

Leave the template below the frontmatter untouched (the `.filter(mention => mention !== null)` is now a harmless no-op — do not restyle).

- [ ] **Step 2: Remove the no-op from PostLayout**

In `src/layouts/PostLayout.astro`: delete `processWikilinksInHTML` from the import on line 5 (delete the whole import line if it imports nothing else) and delete its call site (search the file for `processWikilinksInHTML` — it returns its input unchanged, so replace `processWikilinksInHTML(x, …)` with `x`, or delete the wrapping entirely if the result feeds nothing).

- [ ] **Step 3: Delete dead code from `src/utils/internallinks.ts`**

Delete these (line numbers are pre-edit; work bottom-up so they stay valid):

1. `findLinkedMentions` (lines 1111–1150) — replaced by the index.
2. `createExcerptAroundWikilink` (1153–1235) and `extractExcerptAtPosition` (1237–~1665) — only the deleted `findLinkedMentions` called them; their output was never rendered.
3. `processWikilinksInHTML` (1667–1676) and `processContentAwareWikilinks` (1678–1705) — no-ops.
4. `extractAllInternalLinks` (1085–1109), `validateWikilinks` (683–722), `resolveWikilink` (668–681) — zero importers repo-wide.
5. `setGlobalPostsCache` / `getGlobalPostsCache` / `populateGlobalPostsCache` + the `globalPostsCache` variable (lines 7–23) — zero importers.

Before each deletion, verify zero remaining references:

```bash
grep -rn 'findLinkedMentions\|ExcerptAroundWikilink\|ExcerptAtPosition\|processWikilinksInHTML\|processContentAwareWikilinks\|extractAllInternalLinks\|validateWikilinks\|resolveWikilink\|GlobalPostsCache' src/ astro.config.mjs
```
Expected after all edits: no matches.

- [ ] **Step 4: Delete the dead `LinkedMention` interface in `src/types.ts` if unreferenced**

```bash
grep -rn "LinkedMention" src/ --include='*.ts' --include='*.astro' | grep -v backlink-index
```
If the only hits are the `src/types.ts:93` definition itself, delete it (the live one now lives in `backlink-index.ts`). If anything else imports it, leave it and note where.

- [ ] **Step 5: Remove the temporary parity block from the backlink test**

In `tests/unit/internal-links/backlink-index.test.ts`: delete the `describe('parity with findLinkedMentions (temporary)')` block and the `findLinkedMentions` import.

- [ ] **Step 6: Unit tests + type check**

```bash
pnpm test
pnpm exec astro check 2>&1 | tail -5
```
Expected: tests PASS; astro check counts no worse than `.build-baseline/astro-check.txt`.

- [ ] **Step 7: Build and run the mentions + href parity gates**

```bash
pnpm build
find dist -name '*.html' | sort | xargs node -e '
const fs = require("fs");
for (const f of process.argv.slice(1)) {
  const html = fs.readFileSync(f, "utf8");
  const m = html.match(/<div id="linked-mentions-content"[\s\S]*?<\/section>/);
  if (m) console.log("=== " + f + "\n" + m[0]);
}' > .build-baseline/mentions-task3.txt
diff .build-baseline/mentions.txt .build-baseline/mentions-task3.txt && echo MENTIONS-IDENTICAL
find dist -name '*.html' | sort | xargs grep -oE 'href="[^"]*"' > .build-baseline/hrefs-task3.txt
diff .build-baseline/hrefs.txt .build-baseline/hrefs-task3.txt && echo HREFS-IDENTICAL
```
Expected: `MENTIONS-IDENTICAL` and `HREFS-IDENTICAL`. Any diff is a behavior regression — STOP and investigate before committing.

- [ ] **Step 8: Commit**

```bash
git add -A ':!/.build-baseline'
git commit -m "feat: serve linked mentions from the backlink index; delete dead internal-link code"
```

---

## Task 4: Characterization suite for internal-link URL resolution

**Files:**
- Test: `tests/unit/internal-links/link-characterization.test.ts`

**Interfaces:**
- Consumes: `remarkInternalLinks(options?: { base?: string })` from `@/utils/internallinks` — the suite drives the REAL transformer on hand-built mdast nodes, so it stays valid across the Task 5 refactor.
- Produces: the pinned behavior contract Task 5's refactor must keep green.

- [ ] **Step 1: Write the characterization suite (it must PASS against current code)**

Create `tests/unit/internal-links/link-characterization.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { remarkInternalLinks } from '@/utils/internallinks';

const transform = remarkInternalLinks({ base: '/' });

function runLink(url: string): { url: string; classes: string[] } {
  const node: any = { type: 'link', url, children: [{ type: 'text', value: 'link text' }] };
  const tree = { type: 'root', children: [{ type: 'paragraph', children: [node] }] };
  transform(tree, {});
  return { url: node.url, classes: node.data?.hProperties?.className ?? [] };
}

function runWikilink(value: string): any {
  const paragraph: any = { type: 'paragraph', children: [{ type: 'text', value }] };
  const tree = { type: 'root', children: [paragraph] };
  transform(tree, {});
  return paragraph.children.find((c: any) => c.type === 'link' || c.type === 'image');
}

// Every expectation below pins CURRENT production behavior — including the
// quirks. If a case fails on first run, the derivation was wrong: update the
// EXPECTED value to the actual output and add a comment. Never "fix" the
// implementation in this task.
const STANDARD_LINK_CASES: Array<[input: string, href: string, wikilinkClass: boolean]> = [
  // same-page anchors: decoded then slugified
  ['#Choose%20Your%20Workflow', '#choose-your-workflow', true],
  ['#Already Slugged', '#already-slugged', true],
  // collection index
  ['posts/', '/posts/', false],
  ['/posts/', '/posts/', false],
  // posts, .md forms
  ['posts/my-post.md', '/posts/my-post', true],
  ['posts/my-post/index.md', '/posts/my-post', true],
  ['posts/deep/nested/index.md', '/posts/deep/nested', true], // final /index pass strips even non-folder depth
  ['posts/my-post.md#My Heading', '/posts/my-post#my-heading', true],
  ['/posts/my-post.md', '/posts/my-post', true],
  // posts, non-.md forms
  ['posts/my-post', '/posts/my-post', true],
  ['posts/my-post/index', '/posts/my-post', true],
  ['posts/my-post#My Heading', '/posts/my-post#my-heading', true],
  // pages
  ['pages/about.md', '/about', false],
  ['pages/about/index.md', '/about', false],
  ['/pages/about', '/about', false],
  ['/pages/about#My Heading', '/about#My Heading', false], // quirk: raw anchor passthrough on non-.md pages
  ['/pages/about/index', '/about/index', false],           // quirk: /index survives outside /posts/ on non-.md
  ['/pages/about.md', '/about.md', false],                 // quirk: .md survives on the /pages/ .md branch
  ['/pages/index.md', '/', false],                         // homepage marker
  // special
  ['special/home.md', '/', false],
  ['special/404.md', '/404', false],
  ['special/contact.md', '/contact', false],
  ['/special/home.md', '/home.md', false],                 // quirk: /special/ .md branch never strips .md
  // bare .md → posts fallback
  ['my-post.md', '/posts/my-post', true],
  ['my-post/index.md', '/posts/my-post', true],
  // untouched
  ['bare-slug', 'bare-slug', false],
  ['https://example.com/page', 'https://example.com/page', false],
  ['mailto:someone@example.com', 'mailto:someone@example.com', false],
];

describe('standard internal link resolution (characterization)', () => {
  it.each(STANDARD_LINK_CASES)('%s → %s', (input, href, wikilinkClass) => {
    const result = runLink(input);
    expect(result.url).toBe(href);
    expect(result.classes.includes('wikilink')).toBe(wikilinkClass);
  });
});

describe('wikilink resolution (characterization)', () => {
  it('[[My Post]] → slugified post URL with trailing slash', () => {
    const link = runWikilink('See [[My Post]] here.');
    expect(link.url).toBe('/posts/my-post/');
    expect(link.data.hProperties.className).toEqual(['wikilink']);
    expect(link.data.hProperties['data-wikilink']).toBe('My Post');
    expect(link.children[0].value).toBe('My Post');
  });

  it('[[My Post|Custom]] keeps the display override', () => {
    const link = runWikilink('See [[My Post|Custom]] here.');
    expect(link.url).toBe('/posts/my-post/');
    expect(link.children[0].value).toBe('Custom');
  });

  it('[[posts/my-post]] resolves without trailing slash', () => {
    expect(runWikilink('x [[posts/my-post]] y').url).toBe('/posts/my-post');
  });

  it('[[my-post/index]] strips the folder index', () => {
    expect(runWikilink('x [[my-post/index]] y').url).toBe('/posts/my-post');
  });

  it('[[#My Heading]] resolves to a same-page anchor', () => {
    expect(runWikilink('x [[#My Heading]] y').url).toBe('#my-heading');
  });

  it('[[My Post#Section]] appends a slugified cross-page anchor', () => {
    expect(runWikilink('x [[My Post#Section]] y').url).toBe('/posts/my-post/#section');
  });

  it('![[image.png]] becomes an image node', () => {
    const img = runWikilink('x ![[image.png]] y');
    expect(img.type).toBe('image');
    expect(img.url).toBe('image.png');
  });

  it('wikilinks inside inline code are left alone', () => {
    const paragraph: any = {
      type: 'paragraph',
      children: [{ type: 'inlineCode', value: '[[not-a-link]]' }],
    };
    const tree = { type: 'root', children: [paragraph] };
    transform(tree, {});
    expect(paragraph.children[0]).toEqual({ type: 'inlineCode', value: '[[not-a-link]]' });
  });
});
```

- [ ] **Step 2: Run it — correct any wrong expectations to ACTUAL output**

```bash
pnpm exec vitest run tests/unit/internal-links/link-characterization.test.ts
```
Expected: PASS. For each failure, the error shows the actual value — update the expectation to match it and add a `// quirk:` comment. Re-run until green. Do not touch `internallinks.ts`.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/internal-links/link-characterization.test.ts
git commit -m "test: characterize internal-link URL resolution ahead of url-resolver extraction"
```

---

## Task 5: Extract the url-resolver; decompose remarkStandardLinks

**Files:**
- Create: `src/utils/url-resolver.ts`
- Modify: `src/utils/internallinks.ts`
- Test: `tests/unit/internal-links/url-resolver.test.ts`

**Interfaces:**
- Consumes: the Task 4 characterization suite (must stay green throughout).
- Produces: `resolveSamePageAnchor(url: string): string`, `resolveInternalHref(url: string, base: string): string`, `stripFolderIndex(path: string): string`, `stripIndexSuffix(url: string): string`, `isInternalLink(url: string): boolean`, `parseLinkWithAnchor`, `createAnchorSlug`, `createSlugFromTitle` — all pure, all from `@/utils/url-resolver`.

- [ ] **Step 1: Verify the dead branches are really dead in the corpus**

```bash
grep -rln '](projects/\|](/projects/\|](docs/\|](/docs/\|special/projects\|special/docs' src/content/posts src/content/bin || echo NO-DEAD-BRANCH-LINKS
```
Expected: `NO-DEAD-BRANCH-LINKS`. If any file matches, STOP — the `projects/`/`docs/` branches are live for that content and must be kept (report to the human partner).

- [ ] **Step 2: Write the failing url-resolver unit test**

Create `tests/unit/internal-links/url-resolver.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  isInternalLink,
  resolveInternalHref,
  resolveSamePageAnchor,
  stripFolderIndex,
  stripIndexSuffix,
} from '@/utils/url-resolver';

describe('stripFolderIndex', () => {
  it('strips /index only for single-segment folder paths', () => {
    expect(stripFolderIndex('my-post/index')).toBe('my-post');
    expect(stripFolderIndex('deep/nested/index')).toBe('deep/nested/index');
    expect(stripFolderIndex('my-post')).toBe('my-post');
  });
});

describe('stripIndexSuffix', () => {
  it('strips a trailing /index, including before an anchor', () => {
    expect(stripIndexSuffix('/posts/foo/index')).toBe('/posts/foo');
    expect(stripIndexSuffix('/posts/foo/index#bar')).toBe('/posts/foo#bar');
    expect(stripIndexSuffix('/posts/index-of-things')).toBe('/posts/index-of-things');
  });
});

describe('isInternalLink', () => {
  it('accepts collection prefixes, .md files, and bare slugs', () => {
    expect(isInternalLink('posts/foo')).toBe(true);
    expect(isInternalLink('foo.md')).toBe(true);
    expect(isInternalLink('bare-slug')).toBe(true);
  });
  it('rejects external, mailto, and pure-anchor URLs', () => {
    expect(isInternalLink('https://example.com')).toBe(false);
    expect(isInternalLink('mailto:a@b.c')).toBe(false);
    expect(isInternalLink('#anchor')).toBe(false);
  });
});

describe('resolveSamePageAnchor', () => {
  it('decodes then slugifies', () => {
    expect(resolveSamePageAnchor('#Choose%20Your%20Workflow')).toBe('#choose-your-workflow');
  });
});

// The full input→output matrix lives in link-characterization.test.ts and runs
// through the real remark transformer; these direct cases pin the pure seam.
describe('resolveInternalHref', () => {
  it.each([
    ['posts/my-post.md', '/posts/my-post'],
    ['posts/my-post/index.md', '/posts/my-post'],
    ['pages/about.md', '/about'],
    ['special/home.md', '/'],
    ['special/404.md', '/404'],
    ['my-post.md', '/posts/my-post'],
    ['posts/my-post#My Heading', '/posts/my-post#my-heading'],
  ])('%s → %s', (input, expected) => {
    expect(resolveInternalHref(input, '/')).toBe(expected);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

```bash
pnpm exec vitest run tests/unit/internal-links/url-resolver.test.ts
```
Expected: FAIL — cannot resolve `@/utils/url-resolver`.

- [ ] **Step 4: Implement `src/utils/url-resolver.ts`**

Move these pure helpers out of `internallinks.ts` verbatim (delete there, recreate here): `createSlugFromTitle` (56), `decodeAnchorText` (67), `createAnchorSlug` (80), `parseLinkWithAnchor` (91), `isInternalLink` (167) **minus its `projects/`/`docs/` prefixes**, and `mapRelativeUrlToSiteUrl` (212) **minus its `projects`/`docs` sub-branches**. Then add the resolution seam. Reference implementation — the Task 4 characterization suite is the arbiter; where this sketch and the suite disagree, follow the suite:

```ts
// src/utils/url-resolver.ts
// Pure URL resolution for internal links, extracted from remarkStandardLinks
// (formerly cognitive-complexity 300). The remark plugins own AST mechanics;
// every URL decision lives here. The three redundant "ABSOLUTE FINAL" /index
// patches collapse into stripIndexSuffix — the ONE place trailing /index dies.

export function stripFolderIndex(path: string): string {
  return path.endsWith('/index') && path.split('/').length === 2
    ? path.slice(0, -'/index'.length)
    : path;
}

export function stripIndexSuffix(url: string): string {
  return url.replace(/\/index(?=#|$)/g, '');
}

export function resolveSamePageAnchor(url: string): string {
  return `#${createAnchorSlug(decodeAnchorText(url.slice(1)))}`;
}

function specialHref(specialPath: string): string {
  if (specialPath === 'home') return '/';
  if (specialPath === '404') return '/404';
  return `/${specialPath}`;
}

// Collection-prefix rules for `.md` links — a data table, not an if/else
// chain. Order is load-bearing: it mirrors the original branch order.
// The dead `projects/` / `docs/` branches are deliberately gone (no such
// collections in this fork; corpus verified link-free in Task 5 Step 1).
type MdRule = { prefix: string; href: (rest: string, base: string, rawUrl: string) => string };

const MD_RULES: MdRule[] = [
  { prefix: 'special/', href: (rest) => specialHref(rest) },
  { prefix: 'posts/', href: (rest, base) => `${base}posts/${stripFolderIndex(rest)}` },
  { prefix: 'pages/', href: (rest) => mapRelativeUrlToSiteUrl(`pages/${rest}`) },
  // quirk-preserving: the /pages/ and /special/ .md branches mapped the RAW
  // url (with .md still attached) — keep that byte-for-byte.
  { prefix: '/pages/', href: (_rest, _base, rawUrl) => mapRelativeUrlToSiteUrl(rawUrl) },
  { prefix: '/special/', href: (_rest, _base, rawUrl) => mapRelativeUrlToSiteUrl(rawUrl) },
];

export function resolveInternalHref(url: string, base: string): string {
  const normalized = url.replace(/\/?$/, '/');
  if (normalized === '/posts/' || normalized === 'posts/') return `${base}posts/`;

  const { link, anchor } = parseLinkWithAnchor(url);
  const anchorSuffix = anchor ? `#${createAnchorSlug(anchor)}` : '';

  if (link.endsWith('.md') ) {
    const path = link.replace(/\.md$/, '');
    // homepage / 404 markers (from the legacy linkText protocol)
    if (path === '/pages/index' || path === 'pages/index') return '/';
    for (const rule of MD_RULES) {
      if (link.startsWith(rule.prefix)) {
        const rest = path.slice(rule.prefix.length);
        const href = rule.href(rest, base, link);
        const withAnchor = href.includes('#') ? href : href + anchorSuffix;
        return stripIndexSuffix(withAnchor);
      }
    }
    // bare .md → posts (backward compatibility)
    return stripIndexSuffix(`${base}posts/${path}` + anchorSuffix);
  }

  // non-.md
  if (link.startsWith('posts/')) {
    const rest = link.slice('posts/'.length).replace(/\/index$/, '');
    return `${base}posts/${rest}` + anchorSuffix;
  }
  // quirk-preserving: other non-.md URLs map with the anchor still attached
  // (raw, un-slugified), and only /posts/ URLs get the final /index strip.
  let mapped = mapRelativeUrlToSiteUrl(url);
  if (anchor && !mapped.includes('#')) mapped += `#${createAnchorSlug(anchor)}`;
  return mapped.startsWith('/posts/') ? stripIndexSuffix(mapped) : mapped;
}
```

(Plus the four moved helpers and `mapRelativeUrlToSiteUrl`, exported.)

- [ ] **Step 5: Iterate until both suites pass**

```bash
pnpm exec vitest run tests/unit/internal-links/url-resolver.test.ts
```
Expected: PASS. (The characterization suite still passes untouched — it drives the old code until Step 6.)

- [ ] **Step 6: Rewire `internallinks.ts` onto the resolver**

In `src/utils/internallinks.ts`:

1. Import the moved helpers + `resolveInternalHref` + `resolveSamePageAnchor` + `isInternalLink` from `./url-resolver`; delete the local copies (`createSlugFromTitle`, `decodeAnchorText`, `createAnchorSlug`, `parseLinkWithAnchor`, `isInternalLink`, `mapRelativeUrlToSiteUrl`, `extractLinkTextFromUrlWithAnchor`, `isFolderBasedContent`, `shouldRemoveIndexFromUrl`).
2. Rewrite the body of `remarkStandardLinks`'s `visit(tree, 'link', …)` callback to:

```ts
visit(tree, "link", (node: any) => {
  if (!node.url) return;

  if (node.url.startsWith("#") && node.url.length > 1) {
    node.url = resolveSamePageAnchor(node.url);
    addWikilinkClass(node, node.url);
    setHrefProperty(node, node.url);
    return;
  }

  if (!isInternalLink(node.url)) return;

  node.url = resolveInternalHref(node.url, BASE);

  if (
    node.url.startsWith("/posts/") ||
    (node.url.startsWith("posts/") && !node.url.startsWith("posts/posts/"))
  ) {
    addWikilinkClass(node, node.url);
  }
});
```

with two tiny local helpers preserving the exact current node-mutation semantics (anchor branch sets `hProperties.href` and pushes `wikilink` if absent; the posts branch spreads existing classes and appends — copy those blocks from lines 750–769 and 961–973 as-is):

```ts
function setHrefProperty(node: any, href: string) { /* lines 751-759 verbatim */ }
function addWikilinkClass(node: any, _href: string) { /* class-merge semantics from 762-768 / 969-972 */ }
```

Note the two existing class-merge behaviors differ slightly (anchor branch de-dupes, posts branch appends unconditionally) — preserve each at its call site; if that needs two helpers, use two.

3. In `remarkWikilinks`, replace the two inline `/index`-strip blocks (lines 506–511 and 518–520) with `stripFolderIndex(...)` from the resolver; replace `createSlugFromTitle`/`createAnchorSlug`/`parseLinkWithAnchor`/`decodeAnchorText` uses with the imports. Do not change its URL shapes (trailing-slash simple-slug form stays).
4. In `extractWikilinks` (632–634, 641–643) and `extractStandardLinks` (1017–1022, 1029–1031), replace the inline conservative `/index` strips with `stripFolderIndex(...)`.
5. Remove `export` from `remarkWikilinks` and `remarkStandardLinks` (internal to `remarkInternalLinks` only).

- [ ] **Step 7: Full verification — both suites, then build parity**

```bash
pnpm test
pnpm exec astro check 2>&1 | tail -5
pnpm build
find dist -name '*.html' | sort | xargs grep -oE 'href="[^"]*"' > .build-baseline/hrefs-task5.txt
diff .build-baseline/hrefs.txt .build-baseline/hrefs-task5.txt && echo HREFS-IDENTICAL
```
Expected: all tests PASS; `HREFS-IDENTICAL`. **This is the workstream's byte-parity gate — any diff means the resolver diverged; fix the resolver, never regenerate the baseline.**

- [ ] **Step 8: Commit**

```bash
git add -A ':!/.build-baseline'
git commit -m "refactor: extract pure url-resolver; decompose remarkStandardLinks behind it"
```

**Invoke `requesting-code-review` after this task** (end of Workstream 1).

---

## Task 6: Gate off the Bases feature + ADR 0002

**Files:**
- Modify: `src/config.ts` (interface line ~183, object line ~401)
- Modify: `astro.config.mjs:503-504`
- Modify: `src/pages/base/[...base].astro:16-78`, `src/pages/base/index.astro:16-53`
- Create: `docs/adr/0002-bases-feature-gated-off.md`

**Interfaces:**
- Produces: `siteConfig.bases.enabled: boolean` (false). All Bases source (`src/utils/bases/**`, `src/components/base/**`, `src/utils/remark-bases.ts`, route files) and all `.base` files are preserved untouched.

- [ ] **Step 1: Re-verify no post uses inline ```` ```base ```` fences**

```bash
grep -rl '```base' src/content/posts || echo NO-BASE-FENCES
```
Expected: `NO-BASE-FENCES` (verified 2026-07-15 and re-verified during plan exploration). If any file matches, STOP — gating would silently downgrade those fences to plain code blocks; ask the human partner.

- [ ] **Step 2: Add the config flag**

In `src/config.ts`, interface (after the `optionalContentTypes` member, lines ~183–184):

```ts
  optionalContentTypes: {
  };
  bases: {
    enabled: boolean;
  };
```

In the object literal (after `optionalContentTypes: {},`, lines ~401–402):

```ts
  // Bases (JEXL query) feature — intentionally disabled; see
  // docs/adr/0002-bases-feature-gated-off.md. Flip to re-enable, fully reversible.
  bases: {
    // [CONFIG:BASES_ENABLED]
    enabled: false,
  },
```

- [ ] **Step 3: Conditionally register `remarkBases`**

In `astro.config.mjs`, replace lines 503–504:

```js
      // Bases directive (table-only v1)
      remarkBases,
```

with:

```js
      // Bases directive (table-only v1) — registered only when enabled (ADR-0002),
      // so disabled Bases costs zero per-post pipeline work. Position preserved.
      ...(siteConfig.bases.enabled ? [remarkBases] : []),
```

- [ ] **Step 4: Gate the base routes**

`src/pages/base/[...base].astro` — add `import { siteConfig } from '@/config';` to the frontmatter imports, then as the FIRST line inside `getStaticPaths`:

```ts
  if (!siteConfig.bases.enabled) return []; // ADR-0002: skips the .base scan and all /base/* routes
```

`src/pages/base/index.astro` — add the same import; guard the module-top-level scan so no filesystem work happens when disabled (an `index.astro` cannot opt out of route generation, so it builds as an empty state):

```ts
const bases = siteConfig.bases.enabled ? await scanForBaseFiles() : [];
```

(Adapt to the file's actual variable/flow at lines 16–53 — the requirement: `readdir` is never called when disabled, and the page renders its natural empty list.)

- [ ] **Step 5: Write the ADR**

Create `docs/adr/0002-bases-feature-gated-off.md`:

```markdown
# ADR-0002: Bases feature gated off

**Status:** Accepted · 2026-07-16
**Context:** Plan `docs/superpowers/plans/2026-07-15-build-time-deepening.md`, Workstream 2.

## Decision

The Bases (JEXL query) feature is intentionally disabled via
`siteConfig.bases.enabled = false` (`// [CONFIG:BASES_ENABLED]` in `src/config.ts`).
When disabled: `remarkBases` is not registered in the remark pipeline (zero
per-post cost), `base/[...base].astro` returns an empty `getStaticPaths()`
(no `.base` directory scan, no routes), and `base/index.astro` skips its scan
and renders an empty state.

## What is preserved

All Bases source is kept: `src/utils/bases/**`, `src/components/base/**`,
`src/utils/remark-bases.ts`, and both route files. All `.base` files live in
the `src/content/` submodule and are untouched. Re-enabling is a one-line
config flip.

## Known defects parked behind the gate (deliberately NOT fixed)

1. **JEXL case-sensitivity mismatch** — `contains`/`startsWith`/`endsWith`
   are case-insensitive as JEXL globals but case-sensitive as `StringWrapper`
   methods (`src/utils/bases/`).
2. **Duplicate `slugifyPath`** — two implementations exist.

Both have zero blast radius while the flag is off. Fix them only if Bases is
re-enabled. Future architecture scans should not re-flag them while
`bases.enabled` is false — this ADR is the record.

## Consequences

- Removes one remark plugin from every post's pipeline and a recursive
  content-directory scan from every build.
- Verified before gating: zero published posts contain inline ```` ```base ````
  fences (checked 2026-07-15 and again at implementation time), so the change
  is user-invisible.
```

- [ ] **Step 6: Build and verify**

```bash
pnpm exec astro check 2>&1 | tail -5
pnpm build 2>&1 | tail -20
ls dist/base/ 2>/dev/null
find dist -name '*.html' | sort | xargs grep -oE 'href="[^"]*"' > .build-baseline/hrefs-task6.txt
diff .build-baseline/hrefs.txt .build-baseline/hrefs-task6.txt | grep -v '/base/' ; echo "---"
diff <(grep -v 'dist/base/' .build-baseline/hrefs.txt) <(grep -v 'dist/base/' .build-baseline/hrefs-task6.txt) && echo NON-BASE-HREFS-IDENTICAL
```
Expected: build exits 0; `dist/base/` contains only `index.html` (empty state, no view routes); `NON-BASE-HREFS-IDENTICAL` (only `/base/*` pages may differ). Record the astro-build phase time from the build log — this task should already show a measurable drop.

- [ ] **Step 7: Run tests and commit**

```bash
pnpm test
git add -A ':!/.build-baseline'
git commit -m "feat: gate off Bases behind [CONFIG:BASES_ENABLED]; record ADR-0002"
```

---

## Task 7: Shared frontmatter parser (js-yaml) + generate-deployment-config adoption

**Files:**
- Create: `scripts/lib/frontmatter.js`
- Modify: `scripts/generate-deployment-config.js:44-130` (+ its `frontmatter.aliases` consumption in `processMarkdownFile`, lines 178–233)
- Test: `tests/unit/scripts/frontmatter.test.ts`

**Interfaces:**
- Produces: `parseFrontmatter(content: string): { frontmatter: object|null, content: string }`, `aliasList(frontmatter): string[]`, `replaceAliasesBlock(source: string, aliases: string[]): string` from `scripts/lib/frontmatter.js`. Tasks 8 and 10 consume these.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/scripts/frontmatter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  aliasList,
  parseFrontmatter,
  replaceAliasesBlock,
} from '../../../scripts/lib/frontmatter.js';

const doc = (fm: string, body = 'Body text.\n') => `---\n${fm}\n---\n${body}`;

describe('parseFrontmatter', () => {
  it('returns null frontmatter when there is no block', () => {
    expect(parseFrontmatter('just text')).toEqual({ frontmatter: null, content: 'just text' });
  });

  it('parses scalars without date coercion', () => {
    const { frontmatter } = parseFrontmatter(doc('title: "Hello"\ndate: 2025-05-12'));
    expect(frontmatter).toMatchObject({ title: 'Hello', date: '2025-05-12' });
  });

  it('parses block and inline alias lists', () => {
    expect(parseFrontmatter(doc('aliases:\n  - old-slug\n  - other')).frontmatter)
      .toMatchObject({ aliases: ['old-slug', 'other'] });
    expect(parseFrontmatter(doc('aliases: [old-slug, other]')).frontmatter)
      .toMatchObject({ aliases: ['old-slug', 'other'] });
  });

  it('keeps Obsidian bracket aliases intact as strings', () => {
    expect(parseFrontmatter(doc('aliases:\n  - "[[Old Title]]"')).frontmatter)
      .toMatchObject({ aliases: ['[[Old Title]]'] });
  });

  it('returns the body unchanged', () => {
    expect(parseFrontmatter(doc('title: x', '# Heading\n\ncontent\n')).content)
      .toBe('# Heading\n\ncontent\n');
  });

  it('degrades to null frontmatter on invalid YAML instead of throwing', () => {
    const { frontmatter } = parseFrontmatter(doc('title: [unclosed'));
    expect(frontmatter).toBeNull();
  });
});

describe('aliasList', () => {
  it('normalizes array, scalar, and missing aliases', () => {
    expect(aliasList({ aliases: ['a', 'b'] })).toEqual(['a', 'b']);
    expect(aliasList({ aliases: 'solo' })).toEqual(['solo']); // legacy single-item collapse shape
    expect(aliasList({})).toEqual([]);
    expect(aliasList(null)).toEqual([]);
  });
});

describe('replaceAliasesBlock', () => {
  const source = doc('title: "Post"\naliases:\n  - keep-me\n  - drop-me\ntags:\n  - one');

  it('rewrites only the aliases block, byte-preserving everything else', () => {
    expect(replaceAliasesBlock(source, ['keep-me']))
      .toBe(doc('title: "Post"\naliases:\n  - keep-me\ntags:\n  - one'));
  });

  it('removes the key entirely when the list empties', () => {
    expect(replaceAliasesBlock(source, []))
      .toBe(doc('title: "Post"\ntags:\n  - one'));
  });

  it('handles the inline-array form', () => {
    expect(replaceAliasesBlock(doc('aliases: [a, b]\ntitle: x'), ['a']))
      .toBe(doc('aliases:\n  - a\ntitle: x'));
  });

  it('quotes aliases that need it (Obsidian brackets)', () => {
    expect(replaceAliasesBlock(doc('aliases:\n  - "[[Old]]"\n  - drop'), ['[[Old]]']))
      .toBe(doc('aliases:\n  - "[[Old]]"'));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
pnpm exec vitest run tests/unit/scripts/frontmatter.test.ts
```
Expected: FAIL — cannot resolve `scripts/lib/frontmatter.js`.

- [ ] **Step 3: Implement `scripts/lib/frontmatter.js`**

```js
// Shared frontmatter parsing for build scripts. Replaces the two hand-rolled
// "simple YAML-like" parsers that used to live in process-aliases.js and
// generate-deployment-config.js (which were NOT identical — the aliases one
// preserved Obsidian "[[...]]" quotes for its write path; see plan deviation 4).
import yaml from 'js-yaml';

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;

export function parseFrontmatter(content) {
  const match = content.match(FRONTMATTER_RE);
  if (!match) {
    return { frontmatter: null, content };
  }
  let frontmatter = null;
  try {
    // JSON_SCHEMA: no Date coercion — scalars like `date: 2025-05-12` stay
    // strings, matching the string-only behavior of the old parsers.
    const parsed = yaml.load(match[1], { schema: yaml.JSON_SCHEMA });
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      frontmatter = parsed;
    }
  } catch {
    // Invalid YAML degrades to "no frontmatter", same as the old parsers'
    // no-match path; callers treat it as a file without aliases.
  }
  return { frontmatter, content: match[2] };
}

// The old hand-rolled parsers collapsed single-item lists to a bare string;
// js-yaml does not. Callers must never care which shape they get.
export function aliasList(frontmatter) {
  const aliases = frontmatter?.aliases;
  if (Array.isArray(aliases)) return aliases.map(String);
  if (aliases === undefined || aliases === null || aliases === '') return [];
  return [String(aliases)];
}

function serializeAlias(alias) {
  return /[\[\]{}:#,&*!|>'"%@`]/.test(alias) ? JSON.stringify(alias) : alias;
}

// Surgically replaces the aliases block inside a raw markdown file, leaving
// every other byte untouched. Replaces process-aliases' whole-frontmatter
// re-serialization, which would have mangled nested values (e.g. faq:) had it
// ever fired on them.
export function replaceAliasesBlock(source, aliases) {
  const blockRe = /^aliases:[^\n]*(?:\n(?:[ \t]+-[^\n]*|[ \t]+[^\n]+))*\n?/m;
  if (!blockRe.test(source)) return source;
  const replacement = aliases.length
    ? ['aliases:', ...aliases.map((a) => `  - ${serializeAlias(a)}`)].join('\n') + '\n'
    : '';
  return source.replace(blockRe, replacement);
}
```

- [ ] **Step 4: Run the test until it passes**

```bash
pnpm exec vitest run tests/unit/scripts/frontmatter.test.ts
```
Expected: PASS. (The `replaceAliasesBlock` regex is the risky part — iterate on it against the test, not in production.)

- [ ] **Step 5: Corpus parity check (old gdc parser vs new, on every real content file)**

Write a THROWAWAY script `/tmp/fm-parity.mjs` that: imports `parseFrontmatter as newParse` + `aliasList` from `scripts/lib/frontmatter.js`; contains a verbatim copy of the OLD gdc `parseFrontmatter` (lines 44–130); walks `src/content/posts`, `src/content/bin/pages`, `src/content/bin/special` for `.md` files; and for each compares `aliasList({ aliases: old.frontmatter?.aliases })` against `aliasList(new.frontmatter)`:

```bash
node /tmp/fm-parity.mjs
```
Expected output: `N files checked, 0 alias diffs`. **If any file diffs, STOP** — print the file and both values, and report to the human partner before proceeding (that file's aliases would change redirect output).

- [ ] **Step 6: Adopt in `generate-deployment-config.js`**

1. Add `import { parseFrontmatter, aliasList } from './lib/frontmatter.js';` and delete the local `parseFrontmatter` (lines 44–130).
2. In `processMarkdownFile` (lines 178–233), route every `frontmatter.aliases` access through `aliasList(frontmatter)` so the string-vs-array shape difference cannot matter. Preserve all other logic (self-redirect skip, URL computation) byte-for-byte.

- [ ] **Step 7: Output parity gate**

```bash
node scripts/generate-deployment-config.js
git status --porcelain        # expected: only files this task edited — no config-output churn
diff public/_redirects .build-baseline/_redirects && echo REDIRECTS-IDENTICAL
diff public/_headers   .build-baseline/_headers   && echo HEADERS-IDENTICAL
diff wrangler.toml     .build-baseline/wrangler.toml && echo WRANGLER-IDENTICAL
node scripts/generate-deployment-config.js --validate 2>&1 | tail -5
```
Expected: `REDIRECTS-IDENTICAL`, `HEADERS-IDENTICAL`, `WRANGLER-IDENTICAL`; validate passes as in `.build-baseline/gdc-validate.txt`.

- [ ] **Step 8: Test suite + commit**

```bash
pnpm test
git add scripts/lib/frontmatter.js scripts/generate-deployment-config.js tests/unit/scripts/frontmatter.test.ts
git commit -m "refactor: shared js-yaml frontmatter parser; adopt in generate-deployment-config"
```

---

## Task 8: process-aliases adopts the shared parser with a surgical write path

**Files:**
- Modify: `scripts/process-aliases.js` (delete `parseFrontmatter` lines 27–134 and `frontmatterToString` lines 137–163; rework `processMarkdownFile` line 204+)

**Interfaces:**
- Consumes: `parseFrontmatter`, `aliasList`, `replaceAliasesBlock` from `scripts/lib/frontmatter.js` (Task 7).

- [ ] **Step 1: Confirm the write path is currently dormant (parity precondition)**

```bash
git -C src/content status --porcelain | wc -l    # expected: 0
node scripts/process-aliases.js
git -C src/content status --porcelain | wc -l    # expected: 0 — current corpus needs zero rewrites
```
If the second count is nonzero, STOP — the corpus has live self-aliases and the parity gate needs the human partner's input.

- [ ] **Step 2: Rework the script**

1. Add `import { parseFrontmatter, aliasList, replaceAliasesBlock } from './lib/frontmatter.js';`.
2. Delete the local `parseFrontmatter` (27–134) and `frontmatterToString` (137–163).
3. In `processMarkdownFile`: read the file, `parseFrontmatter(content)`, get `const aliases = aliasList(frontmatter)`; return early when empty (same as today). Compute `cleanAliases` with the existing filtering logic (self-slug/duplicate removal — keep it verbatim). When `cleanAliases` differs from `aliases`, write back `replaceAliasesBlock(originalFileText, cleanAliases)` instead of rebuilding the whole file from `frontmatterToString` — every byte outside the aliases block now survives writes. Keep the same `{ processed, aliases: … }` return shape and logging.

- [ ] **Step 3: Behavior gates**

```bash
node scripts/process-aliases.js
git -C src/content status --porcelain | wc -l    # expected: 0 (still zero writes)
pnpm test                                        # frontmatter suite still green
```

- [ ] **Step 4: Commit**

```bash
git add scripts/process-aliases.js
git commit -m "refactor: process-aliases on shared parser with surgical aliases writes"
```

---

## Task 9: Shared image-extension predicate

**Files:**
- Create: `scripts/lib/images.js`
- Modify: `scripts/sync-images.js` (raster-regex sites at lines 63, 64, 146, 147, 171, 174, 246, 247, 271, 274, 312, 313 and nearby variants)
- Test: `tests/unit/scripts/images.test.ts`

**Interfaces:**
- Produces: `RASTER_IMAGE_RE`, `isRasterImage(filePath): boolean`, `webpPathFor(filePath): string` from `scripts/lib/images.js`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/scripts/images.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isRasterImage, webpPathFor } from '../../../scripts/lib/images.js';

describe('isRasterImage', () => {
  it('accepts every WebP-convertible raster extension, case-insensitively', () => {
    for (const ext of ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'PNG', 'JPG']) {
      expect(isRasterImage(`photo.${ext}`)).toBe(true);
    }
  });
  it('rejects non-raster and already-converted files', () => {
    for (const f of ['clip.mp4', 'vector.svg', 'photo.webp', 'doc.pdf', 'photo.png.txt']) {
      expect(isRasterImage(f)).toBe(false);
    }
  });
});

describe('webpPathFor', () => {
  it('maps a raster path to its .webp twin', () => {
    expect(webpPathFor('posts/foo/attachments/pic.JPG')).toBe('posts/foo/attachments/pic.webp');
  });
  it('leaves non-raster paths alone', () => {
    expect(webpPathFor('audio/clip.mp3')).toBe('audio/clip.mp3');
  });
});
```

- [ ] **Step 2: Run to verify failure, then implement**

```bash
pnpm exec vitest run tests/unit/scripts/images.test.ts   # FAIL: module missing
```

Create `scripts/lib/images.js`:

```js
// Raster formats sync-images converts to WebP — the single copy of a regex
// that used to appear a dozen+ times inline. (No /g flag: shared regexes with
// /g carry lastIndex state.)
export const RASTER_IMAGE_RE = /\.(jpg|jpeg|png|gif|bmp|tiff|tif)$/i;

export function isRasterImage(filePath) {
  return RASTER_IMAGE_RE.test(filePath);
}

export function webpPathFor(filePath) {
  return filePath.replace(RASTER_IMAGE_RE, '.webp');
}
```

```bash
pnpm exec vitest run tests/unit/scripts/images.test.ts   # PASS
```

- [ ] **Step 3: Replace the inline regexes in `sync-images.js`**

Import the helpers, then replace ONLY the exact-raster-regex sites (`/\.(jpg|jpeg|png|gif|bmp|tiff|tif)$/i`): `.test(x)` → `isRasterImage(x)`, `.replace(RE, '.webp')` → `webpPathFor(x)`. **Do NOT touch the broad media-accept regex at line ~77** (it covers audio/video/pdf and is a different concern). Verify none remain:

```bash
grep -n 'jpg|jpeg|png|gif|bmp|tiff|tif' scripts/sync-images.js
```
Expected: only the broad media regex line(s) remain (those include `webp|svg|…|pdf` in the alternation).

- [ ] **Step 4: Behavior gate — identical sync run**

```bash
node scripts/sync-images.js 2>&1 | tail -3
```
Expected: identical synced/skipped totals to `.build-baseline/01-sync-images.log` (all files skip — nothing changed), and `git status --porcelain` shows only this task's edits.

- [ ] **Step 5: Commit**

```bash
pnpm test
git add scripts/lib/images.js scripts/sync-images.js tests/unit/scripts/images.test.ts
git commit -m "refactor: single raster-image predicate for sync-images"
```

---

## Task 10: Split generate-deployment-config into platform adapters

**Files:**
- Create: `scripts/lib/platforms/vercel.js`, `scripts/lib/platforms/github-pages.js`, `scripts/lib/platforms/netlify.js`, `scripts/lib/platforms/cloudflare-workers.js`
- Modify: `scripts/generate-deployment-config.js`

**Interfaces:**
- Consumes: `parseFrontmatter`/`aliasList` (already adopted, Task 7).
- Produces: each platform module exports its generate/write/validate functions taking explicit args — no module-level flag reads. E.g. `github-pages.js`: `generateGitHubPagesConfig(redirects)`, `writeGitHubPagesConfig(redirects, { csp, dryRun, log })`, `validateGitHubPagesConfig(...)`. The dispatcher keeps ownership of `CSP`, `DRY_RUN`, `VALIDATE_ONLY`, redirect collection, `updateAstroConfig`, `cleanupOtherPlatformFiles`, and the platform `switch`.

- [ ] **Step 1: Move code, byte-preserving**

Function moves (source line ranges pre-edit; move bodies verbatim, adapting only imports/params):

| Move to | Functions (lines) |
|---|---|
| `lib/platforms/vercel.js` | `generateVercelConfig` (331–386), `writeVercelConfig` (473–508), `validateVercelConfig` (791–~804) |
| `lib/platforms/github-pages.js` | `generateGitHubPagesConfig` (388–398), `writeGitHubPagesConfig` (510–632), `validateGitHubPagesConfig` (~805–819) |
| `lib/platforms/netlify.js` | `generateNetlifyConfig` (400–422), `writeNetlifyConfig` (634–664), `validateNetlifyConfig` (820–830) |
| `lib/platforms/cloudflare-workers.js` | `generateCloudflareWorkersConfig` (424–442), `writeCloudflareWorkersConfig` (707–789), `copyAssetsIgnoreFile` (666–705) |

Rules:
1. **The `CSP` constant stays in `generate-deployment-config.js`, byte-identical** (it is documented there as the single source of truth). `writeGitHubPagesConfig` receives it via its options param.
2. Any `DRY_RUN` / `log` references inside moved functions become explicit params supplied by the dispatcher (no `process.argv` reads inside `lib/`).
3. The dispatcher's `switch (DEPLOYMENT_PLATFORM)` (line ~927) keeps its exact call sequence — cloudflare-workers still calls the github-pages writer THEN the cloudflare writer, `updateAstroConfig` and `cleanupOtherPlatformFiles` still run first.
4. Keep file/path constants used by a writer next to that writer.

- [ ] **Step 2: Output parity gate (the CSP gate)**

```bash
node scripts/generate-deployment-config.js
diff public/_redirects .build-baseline/_redirects && echo REDIRECTS-IDENTICAL
diff public/_headers   .build-baseline/_headers   && echo HEADERS-IDENTICAL
diff wrangler.toml     .build-baseline/wrangler.toml && echo WRANGLER-IDENTICAL
grep -c "default-src 'self'" public/_headers      # expected: same count as baseline
node scripts/generate-deployment-config.js --validate 2>&1 | tail -5
# Only if Task 1 confirmed dry-run is write-free:
for p in vercel github-pages netlify cloudflare-workers; do
  DEPLOYMENT_PLATFORM=$p node scripts/generate-deployment-config.js --dry-run > /tmp/gdc-dry-$p.txt 2>&1
  diff /tmp/gdc-dry-$p.txt .build-baseline/gdc-dry-$p.txt && echo "$p-DRY-IDENTICAL"
done
```
Expected: every diff clean. **`_headers` carries the production CSP — a byte diff there is a release blocker.**

- [ ] **Step 3: Commit**

```bash
pnpm test
git add scripts/lib/platforms/ scripts/generate-deployment-config.js
git commit -m "refactor: split deployment config into per-platform adapters; CSP byte-identical"
```

**Invoke `requesting-code-review` after this task** (end of Workstream 3).

---

## Task 11: Port the orphaned search test into the vitest suite

**Files:**
- Create: `tests/unit/search/search.test.ts`
- Delete: `src/utils/search.test.ts`

**Interfaces:**
- Consumes: `cleanContent`, `escapeHtml`, `highlight`, `excerptAround` from `@/utils/search` (unchanged).

- [ ] **Step 1: Port the test**

Read `src/utils/search.test.ts` (111 lines, 15 tests using `node:test`/`node:assert`). Create `tests/unit/search/search.test.ts` with this header and a mechanical conversion of every test:

```ts
import { describe, expect, it } from 'vitest';
import { cleanContent, escapeHtml, excerptAround, highlight } from '@/utils/search';
```

Conversion rules — apply to all 15 tests, preserving each test name and assertion semantics exactly:
- `test('name', () => {…})` → `it('name', () => {…})`, grouped into `describe('cleanContent' | 'escapeHtml' | 'highlight' | 'excerptAround')` blocks matching the source file's section banners.
- `assert.strictEqual(a, b)` → `expect(a).toBe(b)`
- `assert.ok(cond, msg)` → `expect(cond, msg).toBeTruthy()`

Do not "improve" any expected value — this is pure signal recovery of already-passing tests.

- [ ] **Step 2: Run and verify all 15 pass**

```bash
pnpm exec vitest run tests/unit/search/search.test.ts
```
Expected: 15 passing. A failure means a porting mistake (the pure functions are untouched) — fix the port.

- [ ] **Step 3: Delete the orphan and commit**

```bash
git rm src/utils/search.test.ts
pnpm test
git add tests/unit/search/search.test.ts
git commit -m "test: port orphaned search tests into the vitest suite"
```

---

## Task 12: Pagefind gateway; both search views consume it

**Files:**
- Create: `src/scripts/search/pagefind-gateway.ts`
- Modify: `src/scripts/search-client.ts` (lines 38–49 state, 139–165 init/hydrate, 619–663 doSearch)
- Modify: `src/components/SearchPalette.astro` (lines 76–93 loader state, 265–283 run)
- Test: `tests/unit/search/pagefind-gateway.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `interface SearchResult { title; url; description; excerpt; subResults; tags; category; date; image }`, `interface PagefindGateway { search(query, opts?): Promise<SearchResult[] | null> }`, `createPagefindGateway(load?)`, singleton `pagefindGateway` — all from `@/scripts/search/pagefind-gateway`.

**Guardrail:** the mobile sheet-gesture code in `search-client.ts` (lines 563–616: handle-swipe dismiss, content-at-top rule) is load-bearing UX — do not touch it. This task only replaces Pagefind loading/search/hydration.

- [ ] **Step 1: Write the failing gateway test**

Create `tests/unit/search/pagefind-gateway.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createPagefindGateway } from '@/scripts/search/pagefind-gateway';

function stubPagefind(records: Array<Record<string, any>>) {
  return {
    init: vi.fn(async () => {}),
    search: vi.fn(async () => ({
      results: records.map((rec) => ({ data: async () => rec })),
    })),
  };
}

const record = {
  url: '/posts/example/',
  excerpt: 'An <mark>example</mark> excerpt',
  meta: { title: 'Example', category: 'refutations', date: '2026-01-01', image: '/img.webp' },
  sub_results: [{ url: '/posts/example/#h', excerpt: 'sub' }],
  filters: { tag: ['aqidah'] },
};

describe('pagefind gateway', () => {
  it('normalizes hydrated results with fallbacks', async () => {
    const gateway = createPagefindGateway(async () => stubPagefind([record, { url: '/bare/' }]));
    const results = await gateway.search('example');
    expect(results).toEqual([
      {
        title: 'Example', url: '/posts/example/',
        description: 'An <mark>example</mark> excerpt', excerpt: 'An <mark>example</mark> excerpt',
        subResults: [{ url: '/posts/example/#h', excerpt: 'sub' }],
        tags: ['aqidah'], category: 'refutations', date: '2026-01-01', image: '/img.webp',
      },
      {
        title: '/bare/', url: '/bare/', description: undefined, excerpt: undefined,
        subResults: [], tags: [], category: '', date: '', image: '',
      },
    ]);
  });

  it('applies the result limit', async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ url: `/p${i}/` }));
    const gateway = createPagefindGateway(async () => stubPagefind(many));
    expect(await gateway.search('q', { limit: 5 })).toHaveLength(5);
  });

  it('passes tag filters through to pagefind.search', async () => {
    const pf = stubPagefind([]);
    const gateway = createPagefindGateway(async () => pf);
    await gateway.search('', { filters: { tag: 'aqidah' } });
    expect(pf.search).toHaveBeenCalledWith('', { filters: { tag: 'aqidah' } });
  });

  it('returns null when the index is unavailable', async () => {
    const gateway = createPagefindGateway(async () => { throw new Error('no index'); });
    expect(await gateway.search('q')).toBeNull();
  });

  it('loads pagefind once across searches, and reloads after swup:page:view', async () => {
    const pf = stubPagefind([]);
    const load = vi.fn(async () => pf);
    const gateway = createPagefindGateway(load);
    await gateway.search('a');
    await gateway.search('b');
    expect(load).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new Event('swup:page:view'));
    await gateway.search('c');
    expect(load).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run to verify failure, then implement the gateway**

```bash
pnpm exec vitest run tests/unit/search/pagefind-gateway.test.ts   # FAIL: module missing
```

Create `src/scripts/search/pagefind-gateway.ts`:

```ts
// One Pagefind seam for both search views (/search page + command palette),
// replacing two independently-implemented load/init/hydrate copies.
export interface SearchFilters {
  tag?: string;
}

export interface SearchResult {
  title: string;
  url: string;
  description: string;
  excerpt: string;
  subResults: any[];
  tags: string[];
  category: string;
  date: string;
  image: string;
}

export interface PagefindGateway {
  /** Normalized results, or null when the Pagefind index is unavailable (e.g. dev server). */
  search(
    query: string,
    opts?: { filters?: SearchFilters; limit?: number },
  ): Promise<SearchResult[] | null>;
}

type PagefindModule = {
  init(): Promise<void>;
  search(query: string, opts?: { filters?: SearchFilters }): Promise<{ results: any[] }>;
};

async function loadPagefind(): Promise<PagefindModule> {
  const path = '/pagefind/pagefind.js';
  const mod = await import(/* @vite-ignore */ path);
  await mod.init();
  return mod;
}

export function createPagefindGateway(
  load: () => Promise<PagefindModule> = loadPagefind,
): PagefindGateway {
  let pagefind: PagefindModule | null = null;

  // Both previous implementations re-ran Pagefind init after every Swup
  // navigation; keep that behavior, registered once, in one place.
  if (typeof document !== 'undefined') {
    document.addEventListener('swup:page:view', () => {
      pagefind = null;
    });
  }

  return {
    async search(query, opts = {}) {
      if (!pagefind) {
        try {
          pagefind = await load();
        } catch {
          return null; // index not built — callers degrade gracefully
        }
      }
      const res = opts.filters
        ? await pagefind.search(query, { filters: opts.filters })
        : await pagefind.search(query);
      const limit = opts.limit ?? 100;
      const data = await Promise.all(res.results.slice(0, limit).map((r: any) => r.data()));
      return data.map((d: any) => ({
        title: d.meta?.title || d.url,
        url: d.url,
        description: d.excerpt,
        excerpt: d.excerpt,
        subResults: d.sub_results || [],
        tags: d.filters?.tag ?? [],
        category: d.meta?.category || '',
        date: d.meta?.date || '',
        image: d.meta?.image || '',
      }));
    },
  };
}

export const pagefindGateway = createPagefindGateway();
```

```bash
pnpm exec vitest run tests/unit/search/pagefind-gateway.test.ts   # PASS
```

- [ ] **Step 3: Wire `search-client.ts`**

1. Add `import { pagefindGateway } from '@/scripts/search/pagefind-gateway';`.
2. Delete the module state `pagefind` (L39) and `pagefindReady` (L40), the `pagefindReady = false` reset inside `initSearch()` (L55), and the whole `initPagefind` (139–150) + `hydrateResults` (152–165) functions.
3. In `doSearch` (619–663), replace the init + search + hydrate block with:

```ts
      if (rawQuery.startsWith('#')) {
        const tagQ = rawQuery.slice(1).trim();
        const searched = tagQ
          ? await pagefindGateway.search('', { filters: { tag: tagQ }, limit: 100 })
          : [];
        if (searched === null) {
          statusEl!.textContent = 'Search unavailable — run pnpm build first.';
          // …keep the exact remaining unavailable-path statements from the old `!ok` branch…
          return;
        }
        allResults = searched;
        currentItems = allResults;
      } else {
        const searched = await pagefindGateway.search(rawQuery, { limit: 100 });
        if (searched === null) {
          statusEl!.textContent = 'Search unavailable — run pnpm build first.';
          // …same unavailable-path statements…
          return;
        }
        allResults = searched;
        currentItems = allResults;
      }
      buildFilterBar(allResults);
      applyYearFilter();
```

Copy the old `!ok` branch's full body (whatever follows the `statusEl` message at ~L641) into both `null` branches so the unavailable UX is byte-identical. Everything downstream (`buildFilterBar`, filters, rendering, mobile sheet) is untouched — the normalized result shape is identical to the old `hydrateResults` output.

- [ ] **Step 4: Wire `SearchPalette.astro`**

1. In the palette's `<script>` block, add `import { pagefindGateway } from '@/scripts/search/pagefind-gateway';` and delete its local `pf`/`pfReady` state, `initPagefind` (78–89), and its own `swup:page:view` reset listener (L90) — the gateway owns that now.
2. Compare the palette's local `esc(…)` against `escapeHtml` in `src/utils/search.ts`: if they escape the same characters, delete `esc` and `import { escapeHtml } from '@/utils/search';` (renaming call sites); if they differ, keep `esc` and note the difference in the commit message. Keep the palette's `mark(…)` either way — it intentionally renders a bare `<mark>` (different visual from `highlight`'s classed mark).
3. Replace the body of `run` (265–283):

```ts
    const run = async (q: string) => {
      if (q.length < 2) { showIdle(); return; }
      spinner!.hidden = false;
      const results = await pagefindGateway.search(q, { limit: 10 });
      spinner!.hidden = true;
      if (results === null) { showEmpty(q); return; }   // no index — degrade to /search
      if (input.value.trim() !== q) return;             // stale query
      if (allLink) allLink.href = searchUrl(q);
      if (!results.length) { showEmpty(q); return; }
      render(results.map((r) => ({
        title: r.title,
        url: r.url,
        category: r.category,
        excerpt: cleanExcerpt(r.excerpt || ''),
      })), q);
    };
```

(The old code had a second staleness check between init and hydration; the gateway hydrates internally, so one post-search check covers the same window.)

- [ ] **Step 5: Full verification**

```bash
pnpm test
pnpm exec astro check 2>&1 | tail -5
pnpm build
```
Expected: suite green (including reading-deck), astro check no worse than baseline, build exits 0.

- [ ] **Step 6: Manual behavior gate (spec: sample queries unchanged)**

```bash
pnpm preview
```
In the browser, verify against the pre-change site behavior: (1) `/search?q=allah` renders results with filter bar, tag pills, desktop preview pane; (2) a `#tag` query (e.g. `#aqidah`) triggers tag-filtered results; (3) `Ctrl/Cmd+K` palette returns ≤10 results with categories and excerpts, `Esc` closes, "See all results" links to `/search?q=…`; (4) on a narrow viewport, tapping a result opens the mobile sheet and it dismisses ONLY via handle-swipe / content-at-top swipe. Record pass/fail per item in the commit message.

- [ ] **Step 7: Commit**

```bash
git add -A ':!/.build-baseline'
git commit -m "refactor: one Pagefind gateway behind both search views"
```

**Invoke `requesting-code-review` after this task** (end of Workstream 4).

---

## Task 13: Final measurement, acceptance gates, and delta report

**Files:**
- Modify: `docs/superpowers/plans/2026-07-15-build-time-deepening.md` (Execution notes)

- [ ] **Step 1: Re-run the timed pipeline (same warm-cache conditions as Task 1)**

Repeat Task 1 Step 4 verbatim, teeing into `.build-baseline/after-NN-*.log` names. Fill the "After" and "Δ" columns in the Execution notes table.

- [ ] **Step 2: Re-run every parity gate**

```bash
# hrefs (allowing only the /base/* delta from Task 6)
find dist -name '*.html' | sort | xargs grep -oE 'href="[^"]*"' > .build-baseline/hrefs-final.txt
diff <(grep -v 'dist/base/' .build-baseline/hrefs.txt) <(grep -v 'dist/base/' .build-baseline/hrefs-final.txt) && echo HREFS-FINAL-IDENTICAL
# mentions
find dist -name '*.html' | sort | xargs node -e '
const fs = require("fs");
for (const f of process.argv.slice(1)) {
  const html = fs.readFileSync(f, "utf8");
  const m = html.match(/<div id="linked-mentions-content"[\s\S]*?<\/section>/);
  if (m) console.log("=== " + f + "\n" + m[0]);
}' > .build-baseline/mentions-final.txt
diff .build-baseline/mentions.txt .build-baseline/mentions-final.txt && echo MENTIONS-FINAL-IDENTICAL
# deployment outputs
diff public/_redirects .build-baseline/_redirects && diff public/_headers .build-baseline/_headers \
  && diff wrangler.toml .build-baseline/wrangler.toml && echo DEPLOY-FINAL-IDENTICAL
# submodule untouched
git -C src/content status --porcelain | wc -l   # expected: 0
# astro check
pnpm exec astro check 2>&1 | tail -5            # counts ≤ baseline
```
Expected: `HREFS-FINAL-IDENTICAL`, `MENTIONS-FINAL-IDENTICAL`, `DEPLOY-FINAL-IDENTICAL`, `0`, counts no worse.

- [ ] **Step 3: Unit + e2e suites**

```bash
pnpm test
pnpm test:e2e
```
Expected: all green (Reading Deck e2e must stay green per spec).

- [ ] **Step 4: Record the outcome and commit**

Fill in the Execution notes table (baseline vs after, per phase and total, plus the export-count reduction in `internallinks.ts`: 16 → 5). State the headline number plainly — if a phase did NOT improve, record that too.

```bash
git add docs/superpowers/plans/2026-07-15-build-time-deepening.md
git commit -m "docs: record build-time deltas for the deepening plan"
```

- [ ] **Step 5: Wrap up the branch**

Invoke `superpowers:requesting-code-review` for a final whole-branch review, then `superpowers:finishing-a-development-branch` to present merge/PR options to the human partner.

---

## Plan self-review

- **Spec coverage:** Workstream 0 → Tasks 1, 13. Workstream 1 → Tasks 2–5 (index, wiring, characterization, resolver; memoization test = same-instance identity; excerpt path removed per deviation 1). Workstream 2 → Task 6 (+ADR deliverable 3). Workstream 3 → Tasks 7–10 (frontmatter lib, process-aliases, images predicate, platform split; mtime-skip lever already exists — deviation 5). Workstream 4 → Tasks 11–12 (test port, gateway, both views; gesture guardrail carried into Task 12). All five behavior-preservation gates appear as executable diff commands.
- **Placeholder scan:** every code step carries real code or an exact verbatim-move instruction with source line ranges; the two "copy the old branch body" instructions in Task 12 reference exact locations in files the implementer has open.
- **Type consistency:** `LinkedMention`/`BacklinkIndex`/`getBacklinkIndex(posts)` consistent across Tasks 2–3; `resolveInternalHref(url, base)` consistent across Task 5 test/impl/rewire; `parseFrontmatter`/`aliasList`/`replaceAliasesBlock` consistent across Tasks 7–8; `SearchResult`/`pagefindGateway.search(query, { filters?, limit? })` consistent across Task 12 test/impl/both wirings.
