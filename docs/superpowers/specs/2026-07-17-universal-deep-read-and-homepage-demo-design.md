# Universal Deep Read + Real Homepage Demo — Design

**Date:** 2026-07-17
**Status:** Approved (pending spec review)

## Summary

Two related changes to the Reading Deck ("Deep Read") feature:

1. **Feature B — Universal availability.** Make the slide/deck reading mode available on *every* post, decoupled from the `deck: true` frontmatter and from whether a `tldr.md` sibling exists. Gated only by a single global config kill-switch.
2. **Feature A — Real homepage demo.** Replace the existing hand-rolled *fake* deck carousel with a genuine, working `ReadingDeck` instance on the homepage, placed **below the "Built for close reading" section**, wrapped in teaching copy. It pages through a short, purpose-written demo article using the real deck component, client, and CSS.

## Background / current state

- The **slides feed** is built at runtime by scraping the live `#post-content` DOM (`session.ts` `sourceFor('slides')` → `document.querySelector('#post-content')`, then `compileReadingFeed` in `feed.ts`). Every post has `#post-content`, so the machinery already works for any article.
- The **tldr feed** is built from a build-time `<template data-deck-source-template="tldr">` embedded by `ReadingDeck.astro`, sourced from a sibling `src/content/posts/<slug>/tldr.md` (the `tldrs` collection).
- **Current gating** (`ReadingDeck.astro`):
  - `hasSlides = post.data.deck === true`
  - `hasTldr = Boolean(tldr?.body?.trim())`
  - Component self-suppresses entirely unless `hasSlides || hasTldr`.
- **Runtime gate:** `session.ts supports(feed)` reads `dialog.dataset.hasSlides` / `hasTldr` (the `data-has-slides` / `data-has-tldr` attributes emitted by the component).
- **Trigger:** any `[data-deck-open="slides"|"tldr"]` button fires `events.open(...)` (`view.ts`). The client (`reading-deck-client.ts`) auto-attaches to `dialog[data-reading-deck]` on `DOMContentLoaded` / `astro:page-load` / `pageshow`, and is lazy-imported unconditionally for **every** page in `BaseLayout.astro:1285` (no page-type gate). So a deck dialog mounted on the homepage attaches with **no client changes**.
- Exactly **one** post currently sets `deck: true` *and* has a `tldr.md` (`does-the-prophet-speak-only-by-revelation-...-an-najm-53-34`), which is why the deck appears "tied to tldr."
- The homepage already has a **bespoke fake** deck carousel: `[data-deck-showcase]` card in `PlatformShowcase.astro` (~245–325) with `deckPreviewCards` frontmatter (~99–118) and its own JS in `homepage-hero-client.ts` (~148–203). It does **not** use the real deck.
- The **"Built for close reading"** heading lives in `PlatformShowcase.astro:345` (the `rd-band` section, ~341–395), which is the **last** section that component renders. `index.astro` renders `<PlatformShowcase>` at ~402, then a closing pull-quote at ~405.

## Decisions (locked with user)

- **B:** Option A — *always available*. Every post shows a "Deep read" entry automatically; one global config kill-switch; no author action, no reader-remembered toggle.
- **A source:** Option B — a short, purpose-written demo article run through the real `ReadingDeck` (not the existing showcase post, not the latest post).
- **Fake widget:** Remove it.
- **Config flag name:** `postOptions.readingDeck` (boolean).
- **Demo location:** a new `DeckDemo.astro` component rendered from `index.astro` immediately after `<PlatformShowcase>`.

## Design

### Feature B — universal Deep Read

A gate swap, not new machinery.

1. **Config kill-switch.** Add `postOptions.readingDeck: boolean` (default `true`) to `src/config.ts`, with a sacred marker comment `// [CONFIG:READING_DECK]` (Obsidian settings-plugin convention — do not remove markers).
2. **Gate change in `ReadingDeck.astro`:**
   - `hasSlides = readingDeckEnabled` (read from config) — **replaces** `post.data.deck === true`.
   - `hasTldr` unchanged.
   - Component still self-suppresses only when both are false (i.e. when the config flag is off *and* there's no tldr).
3. **`post.data.deck` becomes legacy.** Keep the schema field so nothing breaks and no content edits are needed; it simply no longer gates anything.

Result: every article renders the "Deep read" entry + dialog, reading its own `#post-content`. Turning `postOptions.readingDeck` off disables the feature site-wide.

### Feature A — real homepage demo

Reuse the genuine component/client/CSS. Two surgical seams remove the "must be a real post at `#post-content`" coupling:

1. **Slide-source override (~3 lines).** `sourceFor('slides')` reads an optional `data-deck-slides-source="#selector"` off the dialog, falling back to `#post-content`. Posts emit no attribute → unchanged behavior. The demo dialog sets `data-deck-slides-source="#deck-demo-source"`.
2. **Standalone metadata (small prop refactor in `ReadingDeck.astro`).** Make `post` optional. When `post` is absent, derive `title` / `description` / `coverImage` / `id` / slide source from explicit props (`title`, `description`, `coverImage`, `id`, `slidesSource`). Posts keep passing `post` and behave identically. The demo passes explicit values. Same dialog markup, same `data-*`, same client, same styling.

**Demo article.** A short hand-written piece (3–5 sections) authored as **inline markup** inside the new `DeckDemo.astro` — **not** a content-collection file (content is a git submodule we must not touch). Rendered into a hidden `<div id="deck-demo-source" hidden>`. Its prose teaches what Deep Read is while demonstrating close-reading affordances (a highlight, a margin note, a citation), so the slides themselves are the lesson.

**Teaching wrapper + placement.** `DeckDemo.astro` renders below "Built for close reading" — i.e. in `index.astro` immediately after `<PlatformShowcase>`, before the closing pull-quote. It contains:
- An eyebrow + heading + one explanatory paragraph describing Deep Read.
- A **"Try Deep Read"** button: `<button data-deck-open="slides">`.
- The hidden `#deck-demo-source` article.
- The real `<ReadingDeck ... slidesSource="#deck-demo-source" title=... description=... />` dialog.

Clicking "Try Deep Read" opens the actual deck and pages through the demo article exactly as on a real post.

### Removal (fake widget)

- `PlatformShowcase.astro`: delete the `[data-deck-showcase]` card (~245–325) and `deckPreviewCards` frontmatter (~99–118); drop the now-unused `deckShowcase` prop plumbing.
- `index.astro`: remove `deckShowcase` / `deckShowcasePost` derivation feeding the mock (retain only if still referenced elsewhere — verify at implementation time).
- `homepage-hero-client.ts`: remove the deck-preview carousel JS (~148–203) and its `deckPreviewBound` binding.

## Files touched

| File | Change |
|---|---|
| `src/config.ts` | Add `postOptions.readingDeck` flag + `// [CONFIG:READING_DECK]` marker |
| `src/components/ReadingDeck.astro` | Gate `hasSlides` on config; make `post` optional + explicit metadata props; pass through `data-deck-slides-source` |
| `src/scripts/reading-deck/session.ts` | `sourceFor('slides')` honors `data-deck-slides-source`, default `#post-content` |
| `src/components/DeckDemo.astro` | **New** — teaching wrapper + hidden demo article + real `<ReadingDeck>` |
| `src/pages/index.astro` | Render `<DeckDemo>` after `<PlatformShowcase>`; remove mock `deckShowcase` plumbing |
| `src/components/PlatformShowcase.astro` | Remove `[data-deck-showcase]` card + `deckPreviewCards` |
| `src/scripts/homepage-hero-client.ts` | Remove deck-preview carousel JS |

## Risks / notes

- **One `dialog[data-reading-deck]` per page.** The client uses `querySelector` (single). The homepage has exactly one (the demo), post pages have one — no conflict.
- **Hidden source id isolation.** `#deck-demo-source` is a unique id (not `#post-content`), so TOC/marginalia/citation scripts that key off `#post-content` won't pick it up on the homepage.
- **Homepage weight.** Demo prose kept short (3–5 short sections) so the hidden source adds little HTML.
- **No content submodule edits.** The demo article is inline in `DeckDemo.astro`, not a `posts/` file.
- **Swup re-attach.** The deck client already re-inits on `astro:page-load`, so navigating to the homepage via Swup wires the demo deck.

## Out of scope

- Reader-remembered toggle / preference persistence (explicitly not chosen).
- Per-post author opt-in UI.
- Changes to the tldr feed or the deck's internal card-chunking.
- Any edits under `src/content/**`.

## Verification

- `pnpm exec astro check` → 0 errors after each change.
- Manual: every post shows "Deep read" and pages through its sections; a post *without* a tldr still gets slides. Homepage shows the demo below "Built for close reading"; "Try Deep Read" opens the real deck over the demo article; the old fake carousel is gone. Toggling `postOptions.readingDeck = false` removes the entry site-wide.
