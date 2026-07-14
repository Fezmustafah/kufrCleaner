# Homepage Reading-Deck Showcase Design

**Status:** Approved for implementation

**Date:** 2026-07-14

**Project:** OpenIslam Wiki

## Summary

The homepage will add a full-width interactive showcase for the reading deck inside the existing platform-discovery area. Its job is to make the section-by-section reading mode discoverable, let visitors understand the card interaction without leaving the homepage, and provide a direct path into the real Deep read deck.

The showcase is a lightweight preview, not a second reading-deck implementation. The canonical pilot article remains the authoritative experience, and the primary action opens its existing `#slides` state.

## Goals

- Make the reading deck visible to visitors who have not encountered a deck-enabled article.
- Demonstrate the stacked-card navigation model through a small interaction.
- Open the real pilot article directly in Deep read mode.
- Match the visual language and responsive behavior of the existing homepage showcases.
- Keep the preview inexpensive to render and isolated from the article deck controller.

## Non-goals

- Rendering the entire article or TLDR on the homepage.
- Embedding the real full-screen dialog inside the homepage.
- Adding another public route or changing canonical, search, or sitemap behavior.
- Generalizing the pilot article selection into a content-management interface.
- Replacing the article-level “Choose your pace” entry point.

## Placement and hierarchy

The preview will sit as a full-width feature in `PlatformShowcase.astro`, within the “Built for study” discovery section and before the separate “Built for close reading” band. This placement treats the deck as a platform feature while preserving the close-reading band for annotations, citations, scripture callouts, and marginalia.

The section will use the existing homepage width, spacing, borders, theme tokens, heading styles, and full-width discovery rhythm. It will not introduce a second design system.

## Content and interaction

The showcase will include:

- A short heading and explanation focused on reading long arguments one section at a time.
- A compact, theme-aware preview of the real deck chrome.
- Three representative preview cards, with one active card and visible neighboring-card edges.
- Previous and Next controls plus a compact position indicator.
- Clickable exposed neighboring cards where the layout provides enough room.
- A primary **Try Deep read** action that links to the canonical pilot article with `#slides`.

The preview interaction cycles only through its three local demonstration cards. It will not modify browser history, persist position, open overlays, reproduce sources, or share state with `reading-deck-client.ts`.

The demonstration copy will use the pilot article’s real title and three curated concepts so the preview feels like an authentic reading surface rather than a generic product mockup. The homepage will locate the existing pilot by its canonical slug and pass its title, description, and URL into the showcase. The preview does not parse or render the article body.

## Component boundaries

`PlatformShowcase.astro` owns the server-rendered showcase markup and scoped presentation styles because it already owns the homepage feature-discovery surfaces.

The existing homepage client module owns the small state transition:

1. Find the preview root.
2. Read its three card elements and controls.
3. Clamp the active index at the first and third cards, matching the real deck’s disabled boundary controls.
4. Update transforms, accessibility attributes, position text, and disabled states.
5. Reinitialize idempotently after Swup page views using the homepage’s existing lifecycle.

The article reading deck remains untouched unless a small shared constant is needed for its hash. The homepage preview will not instantiate `ReadingDeckController` or duplicate its extraction, history, gesture, source-panel, or completion logic.

## Responsive design

On desktop, the active card is centered within a wide stage with partial previous and next cards visible. The copy and primary action remain legible without competing with the preview.

On mobile, the stage loses asymmetric gutters and presents a centered card with subtle stacked-card offsets behind it. Controls remain thumb-sized, the title is truncated safely, and the primary action stays visible. Horizontal page overflow is prohibited.

The preview may use a restrained transform transition to communicate card movement. Under `prefers-reduced-motion: reduce`, card changes occur without motion.

## Accessibility

- The preview is identified as a demonstration rather than an article reader.
- Previous and Next are native buttons with explicit accessible names and boundary states.
- Only the active preview card is exposed as current; inactive cards are `aria-hidden` and inert when supported.
- Position changes are reflected in an `aria-live="polite"` status without verbose announcements.
- The Deep read action is a normal link, so it remains functional without JavaScript.
- Keyboard focus indicators use existing homepage accent tokens.
- Preview content is marked `data-pagefind-ignore` to avoid indexing duplicated article text.

## Data and failure behavior

The homepage will select `does-the-prophet-speak-only-by-revelation-refuting-the-alleged-contradiction-in-an-najm-53-34` from the already-loaded posts collection and pass the minimum display data to `PlatformShowcase`. Its action URL is `/posts/<pilot-id>/#slides`. If that article is unavailable or no longer has `deck: true`, the interactive preview is omitted rather than showing a broken or misleading action. The rest of the platform showcase continues to render normally.

JavaScript failure leaves the first preview card visible and the **Try Deep read** link usable. Missing optional preview controls do not affect the rest of the homepage client.

## Verification

Implementation verification will include:

- Astro type/content checks and a production build when practical.
- Desktop and mobile browser inspection in light and dark modes.
- Previous, Next, neighboring-card clicks, keyboard focus, and boundary states.
- Direct navigation from **Try Deep read** to the pilot article with the real deck opened at `#slides`.
- Swup navigation away from and back to the homepage without duplicate listeners.
- Reduced-motion behavior and absence of horizontal overflow.
- Pagefind exclusion for preview content.
