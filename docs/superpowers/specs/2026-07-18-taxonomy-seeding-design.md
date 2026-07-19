# Taxonomy Seeding — Design (2026-07-18)

## Goal
Seed a semantic taxonomy across the ~1305 posts in the content submodule:
concept **tags** (the semantic graph layer) + question-framed **portals**
(categories — the curated, guided-reading layer). Content was imported from
Discord; tags are 94% empty, current categories are an inconsistent mix.

## Decisions (user-approved)
- **Portals redesigned from scratch** (~10, question-framed, e.g. "Is the
  Qur'an preserved?"). Current 12 categories dissolved; `Refutations` dies as
  a category. Portals are a guided reading experience, NOT the semantic layer.
- **Tags = controlled concept vocabulary** (~100–150, kebab-case, one-line
  definitions each). Closed vocabulary — classifier cannot invent tags.
- **Opponent axis lives in tag-space**: `vs-christianity`, `vs-atheism`,
  `vs-ahmadiyya`, `vs-shia`, `vs-hinduism`, `vs-quranism`, `vs-orientalism`, …
- **Tag meta pages are epistemological anchors**: each `tags/<slug>.md` gets a
  write-up of how the project addresses that topic — not bare collectors.
- **Classifier = headless `claude -p --model haiku`** (subscription auth, no
  API key). Re-runnable pipeline for future imports.
- Tag budget: 2–5 concept tags per post + at most one `vs-*` tag.

## Phases
1. **Vocabulary** (in-session): mine all titles → draft `taxonomy.md` in the
   content repo (source of truth: portals + concepts + definitions). USER
   REVIEWS before anything touches a post.
2. **Classifier**: `scripts/classify-posts.mjs` in kufrCleaner. Batches ~15
   posts (title + description + first ~1500 chars) per headless haiku call,
   strict JSON out `{id, category, tags, confidence}`. Dry-run report first;
   low-confidence + no-fit posts land in a review file.
3. **Apply + meta pages**: BOM-aware frontmatter writes (same pattern as the
   callout-healing codemod); generate `tags/<slug>.md` (epistemology write-up
   + definition) and `categories/<portal>.md` (framing question intro); purge
   junk (`Untitled.md`, placeholder `tag` tags, `Test` category).

## Future imports
Re-run classifier on new posts; unknown-concept proposals accumulate in the
review file; user promotes them into `taxonomy.md`. Taxonomy grows
deliberately, never by accident. `category` drives graph node color, tags
drive graph edges.
