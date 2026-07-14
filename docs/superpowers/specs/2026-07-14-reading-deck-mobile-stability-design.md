# Reading Deck Mobile Stability Design

**Date:** 2026-07-14  
**Status:** Approved  
**Scope:** Mobile deck navigation, overflow affordance, viewport containment, note popovers, haptics, and deck heading links

## Objective

Make the reading deck reliable and natural on Mobile Safari without changing the desktop interaction that already works. The repair must eliminate swipe snapback, prevent the article beneath the deck from becoming visible, replace modal notes with persistent anchored popovers, improve haptic feedback, and make heading links reopen the exact deck location.

Quran popovers remain deferred and are outside this repair.

## Interaction Architecture

### Mobile-native carousel

At viewports up to 720px, the deck uses native horizontal scrolling with scroll snapping. Safari owns touch momentum and axis negotiation instead of the deck translating the track during pointer events. Each card is a snap target.

The controller observes the settled card and then updates:

- the current card index;
- progress and contents state;
- Previous and Next availability;
- the deck URL and saved position;
- accessibility status text;
- one light selection haptic when the settled card actually changes.

Previous, Next, progress segments, neighboring-card controls, cover start, and contents selection all use the same navigation method. Desktop retains the transform-based carousel and trackpad behavior.

The mobile carousel must not programmatically snap back during an active user gesture. Measurement or resize work may restore the current card only after the gesture has settled.

### Minimal vertical-overflow cue

Remove the stage-level blur and gradient. Keep only the existing animated downward arrow.

The arrow belongs to the active card rather than the stage. It appears only when that card has more vertical content below the current scroll position and disappears when the user reaches the bottom. Because it moves with the card, it cannot remain visible over the previous or next card during a horizontal swipe.

There is no text label and no blur.

## Viewport and Zoom Safety

Open the reading deck in the browser's modal top layer and size it against the dynamic and visual viewport. The underlying article remains covered even when the user pinches to zoom out.

Pinch zoom remains available for accessibility. Double-tap zoom is disabled on deck chrome, the stage, and navigation controls with scoped touch-action rules so rapid taps around Previous and Next do not enlarge the page.

Body scrolling and overscroll chaining remain locked while the deck is open. Safe-area insets continue to protect the top and bottom controls.

## Footnote and Marginalia Popovers

Replace the deck source-note modal with one deck-local anchored popover that follows the established marginalia visual language.

The popover supports:

- GFM footnote references;
- inline marginalia markers;
- cloned note markup with back-reference links removed;
- viewport-aware placement above or below the activating marker;
- persistent visibility until an outside tap, Escape, or another note activation;
- keyboard focus without making the entire deck inert.

Opening a note produces a light selection haptic. The image lightbox remains a separate modal interaction.

## Haptic Feedback

Use one consistent selection feedback path for:

- a mobile card settling on a different index;
- Previous, Next, progress, or neighboring-card navigation once the destination settles;
- selecting a heading from Contents;
- switching Quick read and Deep read;
- opening a footnote or marginalia popover.

The existing Web Haptics integration must expose its iOS switch-based fallback as a visually clipped but operable control instead of setting it to `display: none`. Browsers with the Vibration API continue using that API. Haptics remain best-effort and must never block navigation.

Reduced-motion preference disables decorative motion but does not disable explicitly requested haptic feedback.

## Stable Deck Heading Links

Heading permalink controls inside the deck keep the deck open. They use a stable, router-recognized fragment:

```text
#deck-<feed>-<card-ordinal>-<heading-slug>
```

Examples:

```text
#deck-slides-5-first-type-whatever-is-conveyed-from-god-almighty-is-revelation
#deck-tldr-2-the-objection
```

The card ordinal matches the existing namespaced deck IDs and is one-based. On initial load or hash navigation, the controller:

1. detects the feed, card ordinal, and heading slug;
2. opens the requested reading mode;
3. restores the matching card;
4. scrolls the heading into view within that card;
5. leaves the deck open.

Existing card links such as `#slides-5` and `#tldr-2` remain supported. Previously generated `#deck-slides-*` and `#deck-tldr-*` heading URLs become functional. Canonical article heading links outside deck mode are unchanged.

## Accessibility

- Native mobile scrolling respects touch momentum and vertical card scrolling.
- Active-card changes update the existing polite live region.
- Only the active card is interactive and exposed to assistive technology after settling.
- The persistent note popover closes with Escape and returns focus to its trigger.
- The contents sheet retains its focus trap and fixed header.
- Pinch zoom remains enabled.
- Reduced-motion rules remove nonessential transitions and arrow animation.

## Verification

### Mobile interaction checks

- Repeated horizontal swipes in both directions settle once without snapback.
- Slow drags, quick flicks, interrupted gestures, and vertical scrolling do not fight each other.
- The arrow never appears over a neighboring card during a swipe.
- Pinch zoom cannot reveal the underlying article around or below the deck.
- Double taps near the bottom controls do not zoom the page.
- Footnotes and marginalia remain visible until dismissed outside.
- Contents selection and settled card changes produce best-effort haptic feedback.

### Link checks

- Both example heading URLs reopen the correct feed, card, and heading.
- Tapping a deck heading permalink updates the URL without closing the deck.
- Existing `#slides-N` and `#tldr-N` card URLs continue working.
- Canonical article heading links still scroll the ordinary article when deck mode is not requested.

### Regression checks

- Desktop transform navigation, trackpad gestures, neighboring-card clicks, completion state, search, and sidebar menu remain operational.
- Swup navigation still tears down and reinitializes the controller without duplicate listeners.
- Production build and focused type checks pass without new diagnostics.

