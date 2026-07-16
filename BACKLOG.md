# Backlog — deferred work

Parked features with enough detail to resume without re-deriving. Last updated 2026-07-07.

---

## 1. AI Assistant — activation + cost

**Status:** Code-complete (~95%). Currently **dormant** — the widget was removed from the
homepage in the redesign and is imported nowhere; `workerUrl` is still a placeholder.
Nothing is deployed, so it costs $0 today.

### What's already built (do not rebuild)
| Piece | File | State |
|---|---|---|
| RAG worker (embed → Vectorize → strict LLM) | `ai-worker/src/index.ts` | ✅ Complete. CORS lockdown, per-IP rate limit (20/60s), `/ingest` bearer-auth, strict-mode (answers ONLY from retrieved excerpts, never outside knowledge) |
| Indexer | `scripts/ai-index.mjs` (`pnpm ai:index` / `ai:index:dry`) | ✅ Complete. Chunks every post at `MAX_CHARS=1400`, idempotent (stable IDs) |
| Browser widget | `src/components/AiAssistant.astro` + `src/scripts/ai-assistant-client.ts` (293 lines) | ✅ Complete, but **orphaned** — not rendered on any page |
| Config | `aiAssistant` block in `src/config.ts` (~line 378) | ✅ Complete except `workerUrl` = `YOUR-SUBDOMAIN` placeholder |

Models: embeddings `@cf/baai/bge-base-en-v1.5` (768-dim) · chat `@cf/meta/llama-3.1-8b-instruct`.

### What's missing (all ops, ~20 min, no code, no ML training)
1. `cd ai-worker && npx wrangler login`
2. `npx wrangler vectorize create openislam-articles --dimensions=768 --metric=cosine`
3. `npx wrangler secret put INGEST_SECRET`
4. `npx wrangler deploy` → copy the printed Worker URL
5. Paste URL into `src/config.ts` → `aiAssistant.workerUrl`
6. `AI_WORKER_URL=… AI_INGEST_SECRET=… pnpm ai:index` (embeds all articles into Vectorize)
7. Re-add `<AiAssistant />` to a page (it's orphaned) + one validation pass against real content

### Cost (measured against the real corpus)
Index size is **exact**: `pnpm ai:index:dry` → **12,395 chunks** (768-dim) from 1,254 posts (48 skipped).
→ **9.52M stored dimensions** (12,395 × 768).

| Item | Cost |
|---|---|
| Per question | **~$0.0003** (Llama 8B, ~2k in + ~250 out tokens) |
| Free question budget | **~300/day, $0** (Workers AI = 10,000 free neurons/day, ~28/query, resets midnight UTC) |
| Build index (one-time) | **~$0.09**, ~4.3M tokens embedded — fits inside a single day's free neuron allotment |
| Store index | **~$0.005/mo** (9.52M dims × $0.05/100M) |
| Vectorize queries / Worker requests | **$0** (free: 30M query-dims/mo, 100k req/day) |

**The one gate:** free Vectorize tier caps at **5M stored dimensions**; the index needs **9.52M** (~2× over).
That forces the **Workers Paid plan ($5/mo flat)** — the AI usage itself is fractions of a cent on top
(10k questions/mo ≈ +$3).

**Realistic all-in: ~$5/month.**

**Free ($0) path — two levers:**
1. Shrink index under 5M stored dims (~6,500 chunks): bump `MAX_CHARS` in `scripts/ai-index.mjs`
   `1400 → ~2800` (halves chunks, coarser retrieval) or index fewer articles.
2. Stay under ~300 questions/day (free plan hard-stops above, doesn't bill).

Sources: [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) ·
[Vectorize pricing](https://developers.cloudflare.com/vectorize/platform/pricing/)

### Decision to make later
Keep + activate at $5/mo, run the free trimmed path, or delete the cluster
(`ai-worker/`, `AiAssistant.astro`, `ai-assistant-client.ts`, `scripts/ai-index.mjs`,
`ai:index*` scripts, `aiAssistant` config, `*.workers.dev` CSP allowance in `astro.config.mjs`).

---

## 2. Verse auto-linkify — graph edges from shared scripture references

**Status:** Idea, deferred. Graph enhancement "#1" (empty-state + wikilink-prefix fixes already shipped).

**Problem it solves:** Graph edges currently come only from author-made wikilinks/backlinks, so
~80% of posts are orphans. The wikilink-prefix bug fix lifted connected posts 155 → 237 (13% → 20%),
but that's the ceiling for manual links.

**Idea:** Auto-generate edges between posts that cite the **same scripture verse**
(e.g. two posts both citing "1 John 5:7" or "Quran 4:157"). No manual upkeep — verse refs are
already in the content. Would connect the ~40% of posts that cite a verse.

**Why verses (not categories):** categories rejected — organizational, not semantic (produces a
hairball with no meaning). Verse co-citation IS semantic: posts about the same verse genuinely relate.

**How to implement:** In `scripts/generate-graph-data.js`, during post processing, extract verse
references from body/citations (there's already `[@key]` citations via `remark-citations`, plus
scripture patterns like `Book Ch:Vs`). Bucket posts by normalized verse ref, emit edges (or a shared
"verse" node) between co-citing posts.

**Open question to resolve first:** edge density / threshold. A heavily-cited verse (e.g. Quran 4:157)
could link hundreds of posts into a hairball. Need a cap or min-specificity rule before building —
discuss threshold before committing.

---

_Related graph work already done: local-graph load fix (empty-state for orphans + wikilink `posts/`
prefix bug). See git history around `scripts/generate-graph-data.js` and `src/layouts/PostLayout.astro`._

## 3. Code-quality deepening — parked from the build-time plan (2026-07-16)

Descoped from `docs/superpowers/plans/2026-07-15-build-time-deepening.md` (owner call:
build time is the goal; these improve code quality, not build time). Full task text with
TDD steps lives in that plan — Tasks 4-5 and 7-12. Pick up any of them standalone.

- **url-resolver extraction** (plan Tasks 4-5) — characterize + decompose the
  cognitive-300 `remarkStandardLinks` behind a pure prefix-rule table in
  `src/utils/url-resolver.ts`. Byte-parity gate: href dump diff.
- **Shared frontmatter parser** (plan Tasks 7-8) — `scripts/lib/frontmatter.js` (js-yaml)
  replacing the two NON-identical hand-rolled parsers; surgical aliases-block writes in
  `process-aliases.js` (the current whole-frontmatter rewrite would corrupt `faq:` if it
  ever fired).
- **Image predicate dedup** (plan Task 9) — one `isRasterImage`/`webpPathFor` in
  `scripts/lib/images.js` for the ~14 inline regex copies in `sync-images.js`.
- **Deployment-config split** (plan Task 10) — 964-line `generate-deployment-config.js`
  into per-platform adapters. CSP constant must survive byte-identical.
- **Search consolidation** (plan Tasks 11-12) — port the orphaned `src/utils/search.test.ts`
  into vitest (`tests/unit/`), extract a Pagefind gateway consumed by both
  `search-client.ts` and `SearchPalette.astro`. Zero build-time impact — Pagefind indexes
  inside `astro build` regardless.
