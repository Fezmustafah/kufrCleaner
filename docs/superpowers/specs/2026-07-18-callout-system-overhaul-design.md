# Callout System Overhaul — Design

**Date:** 2026-07-18
**Status:** Approved (shape) — pending per-type visual finalization via mockup
**Scope:** kufrCleaner / OpenIslam Wiki callout subsystem

---

## Problem

Callouts are the site's core content primitive: **15,282 callout blocks across 1,305 posts (~65% of them source/evidence quotations)**. The current system produces visually inconsistent output and is fragile:

1. **Inconsistent form.** Only 7 types are "de-carded" (left-rule quotation): `quote, bible, quran, hadith, scholar, admission, cite`. Every other source-like type (`research, manuscript, science, consensus, source, objection, response, definition`) renders as a boxed card — so semantically identical content (a cited work) appears as a left rule in one place and a pink box in another.
2. **Blue-text bug.** Title/content color is `var(--callout-color, #448aff)`. Any type with no defined color falls back to that hardcoded blue. Only `quran/bible/hadith` (generated CSS) and `objection/response` (global.css) have colors, so `scholar, research, cite, admission, consensus, manuscript, science` all render blue.
3. **Generic `i` icon.** Same cause — only 3 custom + 17 built-in types have icons; the rest fall back to the info circle.
4. **10 places hardcode callout type names** and must stay in sync (remark mappings, icon paths, generated JSON/CSS, 5× duplicated CSS selector lists, PostLayout counter, dead PostInfobox, search regex, skill doc, Obsidian data.json).
5. **Structural breakage in content.** ~90 of 15,282 callouts (0.6%) are malformed: 33 missing the leading `>` (render as plain text), 27 with orphaned bodies (title renders, body drops), plus ~70 typo/synonym types (`fail`, `check`, `done`, `critical`, …).

Goal: a **self-healing, "build and forget"** callout system where `data-callout` is a hook for arbitrary per-type design, accent colors flow from Obsidian, and bad input heals itself or is surfaced — never silently rots.

---

## Ownership seam (single source of truth per concern)

| Concern | Owner | Mechanism |
|---|---|---|
| **Accent color** (source family) | Obsidian Callout Manager | `data.json` → `generate-callout-css.js` → `--callout-color/-border/-bg`. Site inherits faithfully. |
| **Icon + title** | Obsidian JSON (its types) + `calloutMappings` (the rest) | remark merges generated JSON over hand map; every real type gets a proper icon/title. |
| **Form / ornament** | hand-authored `src/styles/callouts.css` | one co-located block per type, consuming the color vars. |
| **Base `.callout`** | neutral substrate | no color fallback bleed; undefined types degrade to a quiet plain block. |

Rule: color is **never** hardcoded in the hand CSS for source types — it consumes `--callout-color` etc., which the generator writes from Obsidian.

---

## Workstream 1 — The system

### 1.1 Self-healing (four layers)

1. **Alias map** (in `remark-callouts.ts`) — synonyms/typos resolve at render, zero content edits:
   `fail→failure`, `done→success`, `check→success`, `critical→danger`, `reference→cite` (others added as the lint surfaces them). Starter map; user-tunable.
2. **Graceful fallback** — unknown type → neutral quiet block, capitalized title, **no blue**. New types render fine forever.
3. **Tolerant parser** — no-space markers (`>[!x]`) and nested (`> > [!quote]`) callouts render correctly.
4. **Build-time lint** — `scripts/lint-callouts.js` in the dev/build pipeline reports the ~60 structurally-broken callouts (missing `>`, orphaned body) as `file:line`. Optional `--fix` for the mechanical `>`-insertion cases. Non-fatal (warns, does not break the build).

Layers 1–3 = build and forget. Layer 4 = the honest un-healable minority made visible.

### 1.2 Obsidian seed + generator fix

- **Seed `data.json`** (content submodule) with the full source family — existing `hadith/bible/quran` plus `scholar, quote, cite, admission, research, consensus, manuscript, science, source` — each: Lucide icon + light/dark accent. User re-tunes in the Obsidian UI afterward.
- **Fix `generate-callout-css.js`:**
  - Write `customStyles` to **dark** rule blocks too (currently light-only).
  - Stop silently dropping `theme`-condition and compound (`and`/`or`) color conditions — either honor or explicitly warn.

### 1.3 remark-callouts.ts

- Fill `calloutMappings` for every real type (`scholar, research, cite, admission, consensus, manuscript, science, source, objection, response, definition`) with the already-present-but-unused Lucide icons (`graduation-cap`, `scale`, etc.).
- Add alias resolution (§1.1.1) before mapping lookup.
- Remove the dead `type` field from `CalloutMapping` (never used in emitted HTML).
- Ensure nested-blockquote callouts parse.

### 1.4 Per-type form (`src/styles/callouts.css`)

Extract callout CSS out of `global.css` into a dedicated file, one block per type. Bespoke treatments (exact visual details finalized in mockup session):

- **`quote`** → classical quotation with wrapping `"…"` marks (hanging punctuation via `::before/::after`), no card.
- **Scripture (`quran/bible/hadith`)** → de-carded left-rule, source-colored rule, small-caps attribution; hadith keeps its grade line.
- **Dialectic (`objection`/`response`)** → paired cards; objection neutral-grey, response gold. Theme-token driven, stays in hand layer (not Obsidian).
- **Academic (`scholar/cite/research/consensus/manuscript/science/admission/source`)** → uniform de-carded quotation, differentiated by icon + Obsidian accent, **body text in normal color**.
- **Notices (`note/warning/tip/success/important/info/danger/question/example/abstract/summary/failure/definition`)** → current tinted card.
- Collapse the 5×-duplicated de-carded selector lists into a single grouped rule.

### 1.5 Cleanups

- Delete dead `src/components/PostInfobox.astro` (unimported).
- Fix `.claude/skills/scripture-callouts/SKILL.md` — it points readers at `PostInfobox.astro` as the source counter; the live counter is inlined in `PostLayout.astro:108–116`.
- Base `.callout` neutralized (no `#448aff` bleed).

---

## Workstream 2 — Content healing (separate, reviewed batch)

The ~90 structural fixes touch **`src/content/` — a git submodule with its own git identity** (commits as `fayzabdul`, remote `Fezmustafah/content`). Never silently rewritten.

- Deliverable: the lint report (from §1.1.4) + a reviewable codemod for the mechanical cases (insert missing `>`, re-prefix orphaned body lines).
- User reviews and approves the codemod diff before it runs; commit goes through the submodule.
- Typo types are handled by the alias map (Workstream 1) and need **no** content edit — the codemod only addresses genuine structural breakage.

---

## Non-goals (YAGNI)

- No JS "callout registry" abstraction. `data-callout` + CSS + a small declarative remark map is enough; a registry would centralize color (already owned by Obsidian) for no gain.
- No auto-fixing of ambiguous breakage in the parser (orphaned bodies) — surfaced by lint, fixed by reviewed codemod.
- No change to the PostLayout "Sources cited" counter logic beyond what deleting PostInfobox requires.
- Not touching the search-strip regex unless a type-name change forces it.

---

## Risks / sequencing

- **Obsidian round-trip:** re-opening the vault in Obsidian may rewrite `data.json`. Seed values must match Callout Manager's serialization so the user's later edits merge cleanly.
- **Order:** generator fix + seed → generated CSS/JSON regenerate → remark mappings → hand CSS → lint → (approved) content codemod. Visual forms (§1.4) finalized against real posts via mockup before the CSS lands.
- **Regression surface:** 647 posts render callouts; the de-carded consolidation and blue-fallback removal are the highest-blast-radius changes. Verify against a sample of scripture/dialectic/academic/notice posts.
