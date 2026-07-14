# Reading deck terminal-state refinement

## Goal

Make deck navigation feel spatial and predictable: visible neighboring cards are navigation targets, Sources remains readable, completion occupies the terminal space after Sources, and the footer emphasizes navigation through the deck index.

## Interaction design

- Clicking the visible card to the left moves to the previous card.
- Clicking the visible card to the right moves to the next card.
- Clicks inside the active card retain their existing behavior; card scrolling, links, citations, and image expansion must not trigger navigation.
- Sources remains the final counted card and final Contents item.
- Desktop completion is a terminal rail panel positioned after Sources. It is not counted as a slide and does not appear in Contents or progress.
- Mobile completion remains an overlay opened only after advancing past Sources. Clicking its blurred backdrop dismisses it and returns to Sources.
- The completion primary action always closes the deck and returns to the article. Quick read must not route into Deep read from completion.

## Footer design

- Previous and Next become narrower secondary controls.
- The middle index control receives the largest share of footer width.
- Remove the visible `Contents` label.
- Show the list icon plus the compact position/title line, for example `7 / 7 · Sources`.
- Keep the accessible name `Open deck contents`.

## Responsive behavior

- Desktop and tablet use the inline terminal completion panel.
- Mobile uses the dismissible completion overlay to avoid compressing the terminal panel.
- Existing swipe, keyboard, progress, hash, and TOC navigation remain unchanged.

## Verification

- Confirm left/right neighboring-card clicks navigate exactly one card.
- Confirm active-card interactions do not navigate.
- Confirm Sources remains visible until the user explicitly advances.
- Confirm completion is excluded from Contents, progress, and slide totals.
- Confirm mobile backdrop dismissal returns to Sources.
- Confirm completion primary action returns to the article in both reading modes.
- Confirm footer hierarchy and responsive layout visually at desktop and mobile widths.
