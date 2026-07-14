# TLDR and Slide-Deck Reading Mode Design

**Status:** Approved design baseline  
**Date:** 2026-07-13  
**Project:** OpenIslam Wiki

## Summary

OpenIslam Wiki will gain one mobile-first reading-deck engine with two content feeds:

1. **Slides** transform the full article into cards, primarily split at H2 headings. This is a navigation and engagement mode, not a summary.
2. **TLDR** renders a separately authored short version as cards. The TLDR is intentionally free to use a different voice and structure from the article.

Both feeds live on the article's canonical URL. The full article remains the default view. `#slides` opens the long-form feed and `#tldr` opens the authored TLDR feed, allowing browser Back to return naturally to the article without creating duplicate indexable pages.

The first release is a pilot. One or two articles will adopt the folder convention and exercise the complete interface before any corpus-wide migration or automatic rollout.

## Goals

- Make long articles approachable for short-attention, mobile-first readers.
- Preserve the full article as the canonical, searchable, SEO-authoritative document.
- Provide a true separately authored TLDR, rather than presenting extracted prose as a summary.
- Make card navigation responsive, reliable, accessible, and comfortable on touch devices.
- Preserve rich Markdown features, especially citations, footnotes, bibliography entries, images, callouts, and internal links.
- Integrate safely with Astro content collections, Swup navigation, Pagefind, existing themes, and the site's image pipeline.

## Non-goals

- Migrating the existing flat-file corpus.
- Generating an AI summary.
- Creating separate public TLDR or slide URLs.
- Replacing the normal article reading experience.
- Adding structured-data types for individual cards during the pilot.
- Reproducing the reference site's content, branding, or visual identity.

## Pilot content convention

Only participating articles move to a folder:

```text
src/content/posts/<slug>/
├── index.md   # canonical full article
└── tldr.md    # separately authored TLDR
```

Flat posts remain supported and unchanged.

The normal `posts` collection must exclude `**/tldr.md` so a TLDR never becomes its own routed article. A dedicated `tldrs` collection loads `posts/**/tldr.md`. Its entry ID is mapped to its parent folder slug and joined to the matching post during the build. An unmatched TLDR is a build-time validation error with the offending path in the message.

The TLDR schema is intentionally small. It supports an optional title and description plus the ordinary Markdown body. The article remains the source of canonical metadata such as author, dates, banner, tags, category, and SEO settings.

During the pilot, slide mode is explicitly enabled with `deck: true` in the selected article's frontmatter rather than automatically inferred from word count. The presence of `tldr.md` enables the TLDR feed and its announcement action. Automatic thresholds can be considered after real usage is evaluated.

## Rendering and feed model

The deck engine receives a normalized feed rather than knowing where the content came from:

```ts
interface DeckFeed {
  kind: "slides" | "tldr";
  title: string;
  cards: DeckCard[];
}

interface DeckCard {
  id: string;
  title: string;
  content: DocumentFragment;
  sourceIds: string[];
}
```

Both the full article and TLDR pass through the existing ordered remark and rehype pipeline. The implementation must not reorder the pipeline. This keeps wikilinks, citations, GFM footnotes, images, callouts, math, annotations, and other established syntax consistent with normal articles.

The feed builder works from already-rendered DOM rather than adding a second Markdown parser. The canonical article body is the Slides source. The TLDR content is rendered once into an inert, Pagefind-ignored `<template>`. On first deck opening, the builder clones the selected source into document fragments, groups top-level blocks into cards, namespaces cloned IDs, and rewrites matching fragment links. This avoids permanent duplicate article markup while keeping the canonical article untouched and immediately restorable.

### Full-article slide feed

- The article introduction before its first H2 becomes an optional opening card when it contains meaningful body content.
- Each H2 begins a new primary card.
- An oversized H2 section is divided at H3 headings when available.
- If an oversized section has no useful H3 boundaries, it is divided only between safe top-level blocks toward a target of roughly 250–400 words per card.
- Lists, tables, figures, code blocks, callouts, quotations, and other structured blocks are never split internally.
- A card may vertically scroll when its content still exceeds the viewport. Correct structure takes priority over forcing every card to fit one screen.
- Generated article-only navigation such as the ordinary table of contents is omitted from the feed.

### TLDR feed

- The TLDR's introduction and H2 sections follow the same card-boundary rules.
- The TLDR is always rendered through the deck; it does not receive an independent long-form page.
- Authors control the TLDR's voice, ordering, headings, examples, and degree of compression.
- An empty TLDR suppresses the TLDR action and produces a clear build warning; the canonical article continues to render. A schema-invalid TLDR is a content error and fails the build with its path.

## Sources, citations, and footnotes

Citation and footnote semantics must survive card extraction.

- Inline citation markers stay in their originating cards.
- Activating a footnote or citation opens a card-local source panel instead of navigating the reader out of the deck.
- The panel is populated from the rendered feed's source registry and is keyboard accessible.
- Referenced footnotes remain addressable by stable IDs even when the same note is opened from more than one card.
- Deck IDs are namespaced by feed and card so cloned headings, footnotes, and bibliography entries never collide with IDs in the canonical article.
- The generated bibliography is presented as a final **Sources** card.
- Backlinks from a source return focus to the marker that opened it.
- External source links behave normally and retain the site's existing link normalization.

This design reuses the current citation and GFM-footnote output. It does not introduce a second citation parser.

## Interface

The deck is a server-rendered component embedded in the post page and opened as a full-viewport reading surface. It remains inside the Swup container so navigation replaces it with the rest of the page.

### Article entry point

An announcement bar near the article header offers the available modes:

- **Read as slides** when slide mode is enabled.
- **Read the TLDR** when a valid `tldr.md` exists.

If both exist, the TLDR is the visually primary action because it offers genuine brevity. The bar remains compact and uses the existing theme tokens.

### Deck chrome

- A safe-area-aware top bar contains Close/Back, the article title, and a feed switcher when both feeds exist.
- A thin progress indicator communicates the current position.
- The central stage displays one card at a time.
- A thumb-reachable bottom rail provides Previous, card index, and Next controls.
- The index opens as an accessible modal list of card titles and marks the current card.
- Typography uses the existing heading and prose font tokens, fluid `clamp()` sizing, balanced headings, pretty-wrapped body copy, and a restrained readable measure.
- Colours use existing CSS custom properties and Tailwind theme mappings; the design contains no hardcoded colour values.
- Images preserve known dimensions and use the existing image-processing output to prevent layout shift.

On desktop, the same engine remains centered with a bounded reading width and keyboard-first controls. It is not redesigned as a separate desktop application.

## Navigation engine

The pilot uses a controlled transform pager.

- Cards are laid out in a flex track within a clipped stage.
- All inputs call the same `goToCard()` state transition.
- A horizontal touch gesture decides previous or next on release; the track does not continuously follow the finger.
- Vertical gestures remain native scrolling inside the active card.
- Axis locking, travel threshold, and velocity threshold prevent diagonal movement from triggering accidental navigation.
- Active text selection cancels swipe recognition.
- Exactly one card changes per gesture.
- Off-screen cards are `inert` and `aria-hidden`.
- Only the active card and nearby cards are kept render-hot when performance warrants it.

This approach was selected over native scroll-snap because it cannot settle between cards or drift out of sync with history. It was selected over a full follow-the-finger drag because the latter adds substantial gesture, selection, and nested-scroll complexity without being necessary for the pilot.

## Haptics and motion

`lochie/web-haptics` provides a restrained tick only after a card change commits. It does not fire continuously during movement or at a clamped deck boundary.

Unsupported platforms degrade silently. Haptics and animated card transitions are disabled when `prefers-reduced-motion: reduce` is active. Desktop receives no synthetic substitute.

## URL and history behavior

- The article's clean canonical URL shows the full article.
- Opening Slides pushes `#slides`.
- Opening TLDR pushes `#tldr`.
- Switching feeds replaces the current deck hash so it does not create redundant Back steps.
- Browser Back from a deck returns to the article state.
- Direct visits to either hash open the appropriate feed after initialization.
- Closing a direct-hash visit removes the hash with `replaceState`; closing a deck opened from the article uses Back.
- Card changes do not create history entries during the pilot. The current card is restored within the active deck session, but the URL identifies the feed rather than every card.

The canonical tag, Open Graph metadata, JSON-LD, and Pagefind body remain based on the full article.

## Swup lifecycle

The interactive controller lives in a global client module loaded through the established BaseLayout pattern. Component-inline scripts are not relied upon.

Initialization must be idempotent and run on initial load and Swup `page:view`. Each initialization owns its listeners through an abortable lifecycle so navigation cannot accumulate handlers. Cleanup restores document scrolling, active focus, inert state, and any deck-owned body classes before the old page is discarded.

Hash and popstate handlers must distinguish deck state changes from Swup page navigation.

## Accessibility and progressive behavior

- Opening the deck moves focus into it and makes the article inert.
- Closing restores focus to the button that opened it when possible.
- Escape closes the deck. Left/Right navigate cards. Up/Down scroll the active card. Home/End jump to the first/last card.
- Buttons have explicit accessible names and disabled boundary states.
- The current card and progress are announced without making every swipe excessively verbose.
- The index and source panel trap focus while open and restore it on close.
- Logical document order is preserved in the server-rendered markup.
- With JavaScript unavailable, the canonical article remains completely readable. Deck actions are hidden or inert rather than presenting broken controls.

## Search and SEO

Deck markup is marked `data-pagefind-ignore` so the full article is indexed once. The TLDR does not create a separate route, canonical, sitemap entry, or competing search result. All deck state is represented by hashes on the canonical article URL.

The pilot does not add card-level ItemList or FAQ structured data. Existing article FAQ structured data remains unchanged.

## Error handling

- A missing TLDR yields a normal article with Slides only when enabled.
- An empty TLDR produces a build warning and suppresses its entry action; a schema-invalid TLDR fails the build with its path.
- If client initialization cannot find required deck elements, it exits without changing article state and logs only behind `import.meta.env.DEV`.
- If Web Haptics fails, navigation continues without feedback.
- If History API calls fail, the deck still opens and closes locally.
- If card extraction finds no usable boundaries, the body becomes one scrollable card rather than failing the page.

## Pilot verification

The first one or two converted articles must cover both feeds and include at least one long H2 section, H3 content, a citation, a GFM footnote, a bibliography, an image, a callout, and an internal link.

Verification includes:

- Astro type/content checks and a production Astro build.
- Chromium and WebKit at mobile viewports with real pointer/touch sequences.
- Light and dark modes using the site's persisted theme setting.
- Horizontal swipe recognition alongside vertical card scrolling and text selection.
- Previous/Next, keyboard navigation, card index, source panel, and focus restoration.
- Opening, closing, direct hashes, browser Back/Forward, and feed switching.
- Swup navigation into and away from a deck-enabled article without duplicate handlers or body-lock leakage.
- Reduced motion, haptics fallback, safe-area insets, and device rotation.
- Pagefind exclusion and preservation of the full article's canonical/SEO metadata.

## Rollout boundary

The pilot ends with a reusable deck engine and one or two representative folder-based articles. Corpus migration, automatic long-post thresholds, analytics-driven tuning, structured-data expansion, and broader authoring automation require separate decisions informed by the pilot.
