---
name: post-frontmatter
description: Use when creating a post or editing its frontmatter — the answer-engine fields (description, faq, targetKeyword, category, banner) have non-obvious rendering and SEO consequences.
---

# Post frontmatter: the answer-engine fields

Full field list lives in CLAUDE.md §Posts frontmatter. This skill covers the fields whose *content* matters, not just their presence.

## description — it renders twice

The `description` is both the meta description (SERP snippet) AND the visible post lead (`.post-lead` under the title). Write it as one or two sentences of real prose that a human reads first on the page — never keyword soup. It should state the post's answer or thesis, not tease it ("Some polemicists claim X because Y…" ✓; "Everything you need to know about X!" ✗).

## faq — featured-snippet JSON-LD

```yaml
faq:
  - question: "Does the word makr mean Allah deceives?"
    answer: "No. In context makr refers to counter-planning against plotters…"
```

- Emitted as FAQPage JSON-LD → eligible for featured snippets / AI answer engines.
- Write answers as self-contained plain text (no markdown — it's JSON-LD, not rendered content), 1–3 sentences, directly answering the question.
- Questions should be phrased the way a searcher types them, not the way the post's headings read.
- Worth adding to every refutation post: the objection/response pairs in the body usually convert straight into FAQ entries.

## category — singular string, load-bearing

```yaml
category: Refutations
```

One string, not an array. Drives the category page, the eyebrow above the title, and the graph node color. Must match an existing category (see `src/content/categories/`); a typo silently creates an orphan.

## Images: image vs banner vs imageOG

- `image` — post card cover (listing pages), synced to `public/posts/{id}/`.
- `banner` — dedicated social/OG card image; overrides `image` for social sharing only.
- `imageOG` / dynamic OG: posts without a banner get a generated OG image (satori). Only set `banner` when the auto-generated card is inadequate.
- `imageAlt` — always set when `image` is set.

## targetKeyword

The single search phrase the post targets. Used for SEO checks, not rendered. Phrase it as the query ("does allah deceive"), and make sure the `title`, `description`, and at least one H2 actually contain or answer it.

## Dates

- `date` — publication. `modified` — set it on substantive revisions (renders as "Updated" in the infobox); don't bump it for typo fixes.

## Things NOT to do

- Don't set `hideTOC`/`showTOC` without a reason — the TOC rail auto-renders from headings.
- `draft: true` posts build in dev but not production — the correct state for test pages.
- Frontmatter edits are content-submodule edits: never `git add src/content/...` from the main repo.
