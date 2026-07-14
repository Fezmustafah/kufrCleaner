# Reading Deck Modularization Design

**Date:** 2026-07-14
**Status:** Approved design
**Scope:** Behavior-preserving decomposition of the Reading Deck runtime and stylesheet

## Summary

The Reading Deck will remain an article-derived reading experience rather than becoming a generic presentation framework. The existing working-tree behavior, Astro markup, selectors, hashes, storage keys, responsive interaction models, accessibility behavior, and homepage handoff are the compatibility baseline.

The current `ReadingDeckController` concentrates feed compilation, deck state, history, DOM rendering, overlays, desktop transforms, mobile scroll snapping, haptics, focus, viewport containment, sharing, persistence, and Swup lifecycle in one implementation. The stylesheet likewise contains late corrective blocks that reduce locality. The refactor will deepen the Reading Deck into one small external interface backed by focused internal modules and two real transport adapters.

Characterization tests come first. Behavior that matches the approved specifications is preserved. Behavior that directly contradicts an approved specification is fixed during the refactor. Undocumented or subjective behavior is recorded for later evaluation rather than silently redesigned.

## Goals

- Preserve the current Reading Deck experience while making its architecture testable and AI-navigable.
- Give production callers one small lifecycle interface.
- Concentrate article-to-Card interpretation in one deep Feed module.
- Concentrate navigation invariants in one in-process State module.
- Give desktop transforms and mobile scroll snap separate adapters at one real transport seam.
- Isolate hash/history and visual-viewport behavior behind deterministic test adapters.
- Establish Vitest and Playwright coverage for the Reading Deck.
- Consolidate the Reading Deck stylesheet after runtime behavior is stable.
- Identify contradictory or suspicious behavior without broadening the project into an interface redesign.

## Non-goals

- Adopting Reveal.js or another presentation engine.
- Introducing a second Markdown parser.
- Moving Feed compilation to build time in this refactor.
- Redesigning the current Reading Deck interface or interaction model.
- Rewriting the homepage's lightweight Reading Deck preview to use the production runtime.
- Migrating additional articles or changing the folder-based post convention.
- Creating a generic carousel, slideshow, or presentation framework.
- Refactoring unrelated code while the Reading Deck work is in progress.

## Domain language

The canonical terms are recorded in the repository's `CONTEXT.md`:

- **Reading Deck** is the alternate full-screen reading surface.
- **Reading Feed** is an ordered sequence of Cards.
- **Quick Read** is sourced from the separately authored TLDR.
- **Deep Read** is derived from the canonical article.
- **Card** is one navigable portion of a Reading Feed.
- **Sources Card** is the final counted Card containing references.
- **Completion State** is reached after Sources and is not a Card.

The architecture uses the terms module, interface, implementation, depth, seam, adapter, leverage, and locality as defined by the codebase-design workflow.

## Approaches considered

### One large session module

Expose only `mountReadingDeck(dialog)` and `destroy()`, leaving nearly all behavior in one implementation.

This gives the smallest possible interface but insufficient locality. Feed rules, navigation policy, browser timing, and DOM rendering would remain difficult to reason about independently.

### Flexible Reading Deck framework

Expose public feed recipes, open requests, transitions, effects, and configurable transports.

This offers theoretical extensibility but creates shallow, speculative seams. The application has one production caller, two known Feeds, and two known transports. Callers should not learn internal concepts that they do not need.

### Lifecycle seam with deep internal modules

Expose one lifecycle operation and deterministic teardown. Keep feed compilation, state transitions, DOM rendering, history, viewport behavior, and transport selection private to the implementation.

This is the selected approach. It maximizes leverage for the only production caller while improving locality within the implementation. The desktop and mobile behaviors justify one real transport seam because two adapters already exist.

## External interface

The production interface is intentionally small:

```ts
interface ReadingDeckHandle {
  destroy(): void;
}

function attachReadingDeck(
  root?: Document,
): ReadingDeckHandle | null;
```

`attachReadingDeck()` returns `null` when the page has no Reading Deck. When a deck exists, it validates the required markup, attaches one session, restores supported location state, and returns an idempotent teardown handle.

`src/scripts/reading-deck-client.ts` remains the compatibility entry used by the current Astro and Swup lifecycle:

```ts
let activeDeck: ReadingDeckHandle | null = null;

function initializeReadingDeck(): void {
  activeDeck?.destroy();
  activeDeck = attachReadingDeck(document);
}
```

The external interface does not expose Reading Feeds, Cards, deck intents, transitions, overlays, adapters, or hashes.

## Module structure

```text
src/scripts/
├── reading-deck-client.ts
└── reading-deck/
    ├── index.ts
    ├── session.ts
    ├── feed.ts
    ├── state.ts
    ├── view.ts
    ├── history.ts
    ├── viewport.ts
    └── transports/
        ├── transport.ts
        ├── desktop-transform.ts
        └── mobile-scroll-snap.ts
```

The layout is a target, not a file-count mandate. A module is extracted only when it passes the deletion test: removing it would spread meaningful complexity back across callers. Trivial helpers remain local to the deep module that owns their behavior.

## Feed module

`feed.ts` owns the transformation from rendered source DOM to a compiled Reading Feed. It absorbs:

- source cloning and cleanup;
- Quick Read and Deep Read source selection;
- reading-time calculation;
- introduction and H2 grouping;
- H3 and safe-block chunking;
- cover creation;
- Sources extraction and creation;
- empty-feed fallback behavior;
- Card accessibility metadata;
- ID namespacing;
- fragment and source-link rewriting;
- image expansion decoration;
- citation, footnote, and marginalia source registration.

Its internal interface is one operation conceptually shaped as:

```ts
compileReadingFeed(source, options): CompiledReadingFeed
```

Compilation operates only on cloned DOM that has already passed through Astro's ordered Markdown pipeline. It never mutates the canonical article. A Feed is compiled at most once per attached session and cached until teardown.

This module has depth: deleting it would spread content interpretation into contents rendering, progress, sharing, deep links, overlays, and transport setup.

## State module

`state.ts` owns deterministic deck invariants:

- the active Reading Feed;
- the selected Card index;
- independent Quick Read and Deep Read positions;
- supported Feed checks;
- index clamping;
- Sources and Completion semantics;
- open, close, restart, resume, and finish transitions;
- feed switching;
- location restoration.

Every input becomes an internal semantic intent. A single transition function returns the next state and the observable effects required by the session:

```ts
transition(currentState, intent, feeds): DeckTransition
```

Buttons, keyboard commands, contents selection, progress controls, neighboring-card clicks, pointer gestures, trackpad gestures, mobile settlement, and browser location changes cannot mutate state independently.

The intent and transition types remain internal. Exposing them would enlarge the external interface without leverage.

## Session and view modules

`session.ts` owns sequencing rather than feature algorithms:

```text
DOM or browser event
  → semantic intent
  → state transition
  → view rendering
  → transport presentation
  → explicit browser effects
```

The session owns one abortable lifetime. It creates and caches Feeds, binds event sources, executes transitions, coordinates adapters, persists state, invokes best-effort haptics, and delegates rendering. It must not duplicate Feed, history, transport, or overlay algorithms.

`view.ts` validates and holds the existing DOM contract. It owns:

- required-element discovery;
- Card insertion and active/inert/ARIA state;
- progress and Contents rendering;
- control labels and disabled state;
- focus entry, trapping, and restoration;
- Contents, source-note, marginalia, and image surfaces;
- the minimal per-Card vertical-overflow arrow;
- Completion rendering.

Overlay behavior remains together during this refactor. Splitting each surface into its own shallow module would reduce locality without creating leverage.

## Transport seam

Desktop and mobile already implement materially different horizontal movement, so they are two adapters at one real internal seam:

```ts
interface DeckTransport {
  connect(context): void;
  present(index, motion): void;
  reflow(): void;
  destroy(): void;
}
```

The interface includes ordering invariants:

- exactly one adapter is connected at a time;
- an adapter never mutates deck state directly;
- an adapter reports a navigation intent or settled Card to the session;
- a media-query change destroys the current adapter before connecting the other;
- an adapter never compiles Feeds, parses hashes, renders overlays, persists state, or emits completion policy.

### Desktop transform adapter

`desktop-transform.ts` owns:

- Card measurement and center offsets;
- `translate3d` positioning;
- pointer axis locking and drag resistance;
- selection-aware gesture cancellation;
- velocity and distance thresholds;
- horizontal trackpad accumulation and locking;
- neighboring-card navigation presentation.

### Mobile scroll-snap adapter

`mobile-scroll-snap.ts` owns:

- native horizontal scrolling;
- touch-active lifecycle;
- scroll settlement timing;
- nearest-Card calculation;
- programmatic movement;
- prevention of active-gesture snap-back;
- settled Card reporting;
- post-settle haptic requests.

Actual WebKit momentum, snap, and gesture arbitration remain end-to-end concerns rather than being simulated as pure computation.

## History and viewport adapters

History and visual viewport each have a production adapter and a deterministic test adapter, so both seams are justified.

### History adapter

The history adapter alone owns:

- parsing and formatting deck locations;
- legacy and current hash compatibility;
- `pushState`, `replaceState`, and `history.back()`;
- the `readingDeck` history marker;
- `popstate` and `hashchange` subscriptions;
- pathname and query preservation;
- article-return behavior;
- absolute share URLs.

Supported location formats remain:

```text
#slides
#tldr
#slides-N
#tldr-N
#deck-slides-N-heading
#deck-tldr-N-heading
```

No other module reads or writes deck hash strings.

### Viewport adapter

The viewport adapter alone owns:

- desktop/mobile media-query state;
- reduced-motion state;
- `VisualViewport` sizing and offsets;
- resize and viewport-scroll subscriptions;
- the existing `--deck-viewport-*` properties;
- transport selection changes.

The DOM remains locally substitutable through a DOM test environment. The implementation will not introduce a shallow adapter that mirrors every selector or DOM method.

## Behavioral invariants

- Existing Astro markup, selectors, classes, and data attributes remain compatible.
- Existing hash formats and share URLs remain compatible unless a format contradicts an approved specification.
- Existing local-storage keys and independent Feed positions remain compatible.
- Compilation never mutates the canonical article DOM.
- Cover is first in each Reading Feed.
- Sources is the final counted Card and final Contents entry.
- Completion is reached only after explicit forward navigation beyond Sources.
- Completion is excluded from Contents, progress, and Card totals.
- Only the selected Card is interactive and exposed to accessibility tools.
- A committed state transition renders once and presents once.
- Gesture-driven state changes occur only after the relevant adapter reports intent or settlement.
- Programmatic mobile movement cannot produce a second transition when scrolling settles.
- Haptics are best-effort and never block navigation.
- Overlay opening records focus and closing restores it when appropriate.
- Destruction is idempotent and releases every listener, timer, animation frame, adapter subscription, haptic resource, body class, inert state, and open dialog.
- Repeated Astro or Swup initialization leaves exactly one attached session.

## Compatibility audit

The current working tree is the behavioral baseline. Before moving algorithms, characterization tests will record:

- zero-based and one-based Card location behavior;
- heading-link ordinal mapping;
- direct-hash opening and browser Back/Forward;
- repeated Feed compilation and ID rewriting;
- Quick Read and Deep Read position restoration;
- cover, Sources, and Completion indexing;
- per-Card vertical scroll restoration;
- overflow-arrow ownership and visibility;
- mobile native settlement versus programmatic movement;
- partial swipes, rapid reversals, and nested vertical scrolling;
- duplicate-navigation prevention across input methods;
- haptic emission count and timing;
- note and marginalia ownership and dismissal;
- focus trapping and restoration;
- pending work during Swup teardown.

The correction policy is:

1. Preserve behavior required by an approved specification.
2. Fix behavior that directly contradicts an approved specification.
3. Preserve and document behavior that is merely undocumented.
4. Record subjective or product-level questions for a later design cycle.

## Error handling

- A page without a Reading Deck returns `null` and performs no work.
- A present but malformed deck fails attachment before changing body or dialog state and logs only in development.
- Missing or unusable source content retains the existing fallback Card behavior.
- Unsupported Feed requests are ignored without corrupting the active state.
- History, storage, sharing, haptic, and optional site-tool failures do not block reading navigation.
- Image, note, and marginalia actions no-op when their referenced content is unavailable.
- An invalid transition is clamped or ignored by the State module before rendering.
- Teardown remains safe after partial attachment or optional-adapter failure.

## Test strategy

### Test infrastructure

Add Vitest with a DOM environment and Playwright with Chromium and WebKit. The existing `test` placeholder will be replaced with explicit unit and end-to-end scripts.

Tests cross the same meaningful seams as production. Old behavior is not tested through extracted trivial helpers.

### Feed and state tests

DOM fixtures exercise:

- no-introduction and introduction Feeds;
- H2 grouping;
- oversized H3 sections;
- safe-block chunking;
- lists, figures, tables, callouts, quotations, and structured blocks;
- generated TOC omission;
- Sources extraction;
- empty-source fallback;
- reading-time calculation;
- ID namespacing and link rewriting;
- footnote, citation, and marginalia registration;
- repeated compilation.

State tests exercise:

- open and close;
- movement and clamping;
- Feed switching;
- independent Feed positions;
- direct-location restoration;
- Sources and Completion transitions;
- restart and resume;
- unsupported Feed requests.

### Attached-session tests

Vitest DOM tests attach the same markup contract used by production and exercise:

- absent and malformed dialog handling;
- lazy Feed compilation;
- buttons, keyboard, progress, Contents, and site tools;
- history and storage adapters;
- focus and inert behavior;
- source notes, marginalia, and image surfaces;
- haptic requests;
- idempotent teardown;
- repeated initialization.

### Browser tests

Playwright Chromium and WebKit tests cover:

- desktop transforms and neighboring-card clicks;
- mobile native swipe without snap-back;
- nested vertical Card scrolling;
- partial swipe cancellation and rapid reversals;
- Previous, Next, progress, and Contents navigation;
- double taps around controls;
- visual-viewport containment and zoom behavior;
- direct Card and heading locations;
- browser Back and Forward;
- Quick Read and Deep Read switching;
- persistent popovers and outside-click dismissal;
- Sources and Completion behavior;
- Swup reinitialization;
- reduced motion;
- light and dark themes.

### Existing verification

- The production build must pass.
- Existing Astro-check failures are recorded before implementation; no new failures are introduced.
- Browser screenshots are captured before and after CSS consolidation at representative desktop and mobile sizes.

## Stylesheet consolidation

Styles are consolidated only after TypeScript behavior and browser tests are stable. `src/styles/reading-deck.css` remains one file to preserve locality, but its cascade is reorganized into:

1. article entry surface;
2. shell and viewport;
3. top chrome, progress, and controls;
4. Cards and rich article content;
5. cover, Sources, and Completion;
6. Contents, popovers, and image surface;
7. desktop transport presentation;
8. mobile transport presentation;
9. reduced-motion and accessibility rules.

Late repair blocks, superseded declarations, and duplicate responsive rules are removed. Existing selectors, theme tokens, and rendered appearance remain compatible. CSS splitting is not a goal because understanding one visual rule should not require bouncing through several files.

## Implementation sequence

1. Establish the current build and Astro-check baseline.
2. Add Vitest and Playwright infrastructure.
3. Write characterization tests against the current runtime.
4. Resolve specification contradictions found by characterization.
5. Add the external attachment seam and idempotent lifecycle.
6. Extract the Feed module and move its tests to that interface.
7. Introduce the pure State module and route all input paths through it.
8. Deepen Session and View responsibilities without changing selectors.
9. Extract the desktop and mobile transport adapters.
10. Extract the history and viewport adapters.
11. Reduce `reading-deck-client.ts` to lifecycle compatibility.
12. Run the full unit, browser, build, and Astro-check verification.
13. Consolidate the stylesheet and run visual regression verification.
14. Request final code review and resolve all Critical and Important findings.
15. Perform a read-only secondary architecture scan and report unrelated opportunities separately.

## Review checkpoints

The requesting-code-review workflow is mandatory at natural checkpoints:

- after test infrastructure and characterization;
- after Feed and State deepening;
- after Session, View, and transport extraction;
- after history, viewport, and lifecycle extraction;
- after CSS consolidation;
- before merge.

Each review receives the applicable requirements and git range. Critical findings are fixed immediately. Important findings are fixed before continuing. Minor findings are recorded and addressed when they improve the current scope without widening it.

## Secondary architecture work

Unrelated improvement opportunities remain second priority. After the Reading Deck passes its full verification and final review, a read-only architecture scan may identify deepening candidates elsewhere in the repository. Those candidates are reported with evidence and recommendation strength; they are not implemented without a separate approved design cycle.

## Success criteria

- The production caller learns only attach and destroy.
- Feed interpretation is concentrated in one deep module.
- Navigation policy is deterministic and independent of browser event handlers.
- Desktop and mobile horizontal movement are isolated behind one real seam.
- Only the history adapter manipulates deck locations.
- Only the viewport adapter owns visual-viewport state.
- The homepage preview remains unchanged and independent.
- All approved behavior is preserved or corrected according to the compatibility policy.
- Unit, attached-session, Chromium, and WebKit tests pass.
- The production build passes and no new Astro-check failures appear.
- The stylesheet contains no known late repair block superseding earlier deck rules.
- The final code review has no unresolved Critical or Important findings.
