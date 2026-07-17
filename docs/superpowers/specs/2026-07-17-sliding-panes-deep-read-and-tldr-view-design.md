# Sliding-Panes Deep Read + TLDR View — Design

**Date:** 2026-07-17
**Status:** Approved design, pending spec review
**Supersedes:** the homepage-demo portion of `2026-07-17-universal-deep-read-and-homepage-demo-design.md` (the CTA-only `DeckDemo` is replaced by embedded live demos; universal-deep-read config gating from that spec stays).

## Problem

The reading deck conflates two jobs into one presentation. The animated 3-up card deck — peeking neighbors that fade/scale, a bobbing "more below" arrow, a mobile swipe that scales every card as it passes — fights the "deep reading" it advertises. The neighbors distract, the mobile animation is jumpy, the scroll cue dances, and footnote/marginalia notes render through a bespoke popover (with an unneeded circular glyph) that does not dismiss on scroll.

The card deck is, however, genuinely good for **glanceable summaries**. The right move is to split by intent:

- **TLDR view** — the card deck, calmed, for quick summaries (the `tldr` feed).
- **Deep read** — a new Matuschak-style **sliding-panes** renderer for reading continuously *across headings* (the `slides` feed, available on every post).

## Reference

Adapted from `aarnphm/aarnphm.github.io` @ `1a947a7` (`quartz/components/styles/matuschak.scss`, `quartz/styles/main.scss`), the reference Andy Matuschak / sliding-panes implementation:

- Panes are fixed-width (`--note-content-width: 620px`), `flex-shrink: 0`, in a horizontal `overflow-x: auto` row. Each pane is `position: sticky; top: 0` and scrolls vertically on its own.
- **Collapse-to-spine:** as you scroll right, earlier panes gain `.collapsed` — content fades to `opacity: 0`, a vertical rotated title (`.stacked-title`, `writing-mode: vertical-rl`, `40px`, `cursor: pointer`) fades in. Passed sections stack on the left as a clickable spine breadcrumb.
- Entrance: `[data-entering] { opacity: 0; transform: translateX(16px) }`, easing `cubic-bezier(0.19, 1, 0.22, 1)`. Front pane carries `box-shadow: var(--shadow-modal)`.
- Mobile: panes become `width: 100vw`, only the active pane is `display: block`, spine hidden — one pane at a time, no scale/fade.
- Reduced motion zeroes all transitions.

We adapt "across notes" → "across headings": each top-level `<h2>` section of the article is one pane.

## Approach

Reuse everything shared; branch only the **stage** (layout + movement) on feed kind.

### Architecture — the transport seam

`DeckTransport` (`connect / present / reflow / destroy`) over a dialog-agnostic `DeckTransportContext` (`stage, track, cards, selectedIndex(), reducedMotion(), interactionEnabled(), requestMove(delta), reportSettled(index), dismissHint()`) is already the movement abstraction. Transport is currently chosen by viewport (`desktop-transform` vs `mobile-scroll-snap`), swapped in `session.replaceTransport(mobile)`.

Change transport selection to a function of **(feed, viewport)**:

| Feed | Desktop | Mobile |
|---|---|---|
| `tldr` (TLDR view) | `desktop-transform` (existing) | `mobile-scroll-snap` (existing) |
| `slides` (Deep read) | **`desktop-panes` (new)** | `mobile-scroll-snap` (reused) |

Mobile for *both* modes is "one full item at a time, scroll-snap" — identical transport, different CSS. So the only new transport is **`desktop-panes`**.

`desktop-panes` responsibilities (implements `DeckTransport`):
- `present(index, motion)`: scroll pane `index` into view; set `.collapsed` on panes before `index`; toggle `[data-entering]` for the incoming pane; front pane gets the shadow class.
- Input: horizontal drag + trackpad wheel → `requestMove(±1)` (mirror `desktop-transform`'s pointer/wheel logic, retuned for pane scrolling); spine click → jump to that pane (via `requestMove` loop or a new `context.requestSelect(index)` — see Open item O1).
- `reflow()`: recompute pane offsets on resize.
- Injects one spine `<button class="reading-deck-spine">` per card on `connect`, removes on `destroy` — keeps `feed.ts` feed-agnostic. Spine label = the card's `<h2>` text.

Shared and untouched by the split: the dialog shell (topbar, footer controls, progress, overlays), `session.ts` orchestration, `feed.ts` compilation (cards already grouped by `<h2>`), note-popover logic, image expansion, history/URL sync, `view.ts` navigation/progress rendering.

### Naming

- Switcher labels: `Quick read / Deep read` → **`TLDR view` / `Deep read`** (short: `TLDR / Deep`).
- `view.ts renderFeed` mode label: `Quick read` → `TLDR view`; `Deep read` unchanged.
- Internal feed keys stay `tldr` / `slides` (no churn to history URLs, dataset attributes, or config).

### TLDR view — calm the deck (approach B)

CSS-only, `dialog[data-active-feed="tldr"]` scope (or default deck scope, since panes override under `slides`):
- Reduce neighbor prominence: raise `data-deck-distance="1"/"2"` opacity floor and shrink the scale delta (less contrast between focus and neighbors).
- **Mobile:** remove the neighbor scale/fade entirely (the pronounced/jumpy part) — neighbors at full opacity, no transform.

### Deep read — sliding panes

- Pane width: responsive `min(40rem, 92vw)` (revisit to fixed 620px only if the responsive measure reads poorly — decided fallback, not default).
- Full opacity, no scale/fade. Horizontal scroll across; per-pane vertical scroll.
- Collapse-to-spine breadcrumb (clickable) on the left, per the reference.
- Prev/Next footer buttons move pane-to-pane; free horizontal scroll also allowed.
- Mobile: one full-width pane, scroll-snap, no spine.

### Fixes (both modes)

**Scroll cue.** Replace `.reading-deck-scroll-shadow::after` (rotated bobbing chevron + `reading-deck-scroll-breathe`) with a subtle bottom fade / inner-shadow gradient pinned to the true bottom edge of the scrolling element. Remove the `breathe` keyframe and the `none`-reset cruft; keep the JS overflow detection (`view.updateOverflow`) that toggles it.

**Note popover.** Prioritize *reading across panes* over pixel-parity (decision 3):
- Drop the circular glyph on the trigger.
- Restyle `.reading-deck-note-popover` to read like the article's footnote/marginalia note (solid, not dashed; typographic match) — as close as the dialog context allows.
- **Close the popover on stage/pane scroll** (root-cause fix): the popover is `position: fixed` at open-time coordinates and the scroll handler only updates the shadow, so it floats over scrolled-away text. Add a source-popover dismissal to the card/pane scroll path (`view.bindCurrentCardOverflow` scroll handler, or a shared scroll listener), matching the existing pointer-outside dismissal.

### Homepage — embedded live demos (decision 4)

Replace the CTA-only `DeckDemo` with **real, inline, bounded demos** in the homepage showcase, using the real panes CSS classes and a real transport instance (the `DeckTransportContext` is dialog-agnostic), fed by dummy `<section>` cards. No fake mock.

- A small demo harness mounts a bounded `.reading-deck-stage`-like container + track + dummy cards, constructs the real `desktop-panes` transport, and manages `selectedIndex` / `requestMove` locally (≈40 lines, no dialog, no session, no history).
- Primary demo: **Deep read (sliding panes)** with 3–4 dummy heading-sections of teaching copy.
- Optional secondary: a **TLDR view (deck)** preview using the deck transport, same harness. (Spec ships panes demo; deck demo is a stretch — Open item O2.)
- Dummy content is hand-written in the component (respects the `src/content/**` submodule constraint — nothing added there).
- Homepage copy drops "as a deck" phrasing in favor of "across headings" / "sliding panes."

## Components / files

- `src/scripts/reading-deck/transports/desktop-panes.ts` — **new** transport.
- `src/scripts/reading-deck/session.ts` — transport selection by (feed, viewport); spine-click wiring if `requestSelect` is added.
- `src/scripts/reading-deck/transports/transport.ts` — possibly add `requestSelect(index)` to the context (O1).
- `src/scripts/reading-deck/view.ts` — mode label rename; note-popover close-on-scroll; spine element rendering hook if not done in the transport.
- `src/styles/reading-deck.css` — panes layout + spine + collapsed states + responsive/mobile; calm deck (B); scroll-cue gradient; note-popover restyle.
- `src/components/ReadingDeck.astro` — switcher label text.
- `src/components/DeckDemo.astro` → reworked (or replaced by `PanesDemo.astro`) — embedded live demo harness.
- `src/pages/index.astro` — mount the reworked demo; copy tweak.
- `src/config.ts` — no change (existing `postOptions.readingDeck` gate still governs).

## Data flow

`session.buildFeed` (unchanged) → compiled cards grouped by `<h2>` → `view.renderFeed` puts cards in the track → `session` picks transport by (activeFeed, viewport) → `transport.connect(context)` → `transport.present(index, motion)` on every navigation. Panes transport additionally injects spines and toggles `.collapsed`. Note/image/history paths unchanged.

## Error handling / edge cases

- Feed with a single `<h2>` (or none): one pane, no spine breadcrumb, no horizontal scroll — degrade to a single centered pane.
- Feed switch (`tldr ↔ slides`) mid-session: destroy old transport, connect new one, re-present current index (mirror existing `replaceTransport`).
- Reduced motion: panes transitions zeroed (reference parity); present with `motion: 'none'`.
- Cover card: the auto-prepended cover stays a full pane (no spine), index 0.
- Homepage demo must no-op safely if JS fails (static markup still shows the first pane).

## Risks

- **Regressing the working TLDR deck.** Mitigation: the deck transports and deck CSS stay; panes are additive under `slides` scope. Verify TLDR view unchanged on a post with a `tldr.md`.
- **Spine sticky/collapse math** is the fiddliest part (sticky in a horizontal scroller + `.collapsed` toggling). Mitigation: port the reference's sticky + collapse structure closely; test with 2, 5, 10 headings.
- **Homepage demo coupling.** If the real transport proves too tied to the shell in practice, fall back to a thin dummy that reuses only the CSS (still "looks real"). Accept per decision 4.
- **Scope.** Larger than a fix; sequenced so each piece ships and verifies independently (rename → calm deck → scroll cue → note popover → panes transport → homepage demo).

## Open items for spec review

- **O1 — spine click:** add `requestSelect(index)` to `DeckTransportContext` (clean jump to any pane), or loop `requestMove`? Recommendation: add `requestSelect` — spine clicks and the existing progress/contents jumps both want direct selection.
- **O2 — homepage:** ship only the Deep-read panes demo, or both panes + deck previews? Recommendation: panes only first; add deck preview if it reads well.
- **O3 — pane width:** confirm `min(40rem, 92vw)` as the starting value.

## Verification

- `pnpm exec astro check` → 0 errors.
- `pnpm exec astro build` succeeds.
- Manual: on a post **with** a tldr — switcher shows `TLDR view / Deep read`; TLDR view is the calmed deck; Deep read is sliding panes with a working spine breadcrumb. On a post **without** a tldr — only Deep read (panes). Mobile: one pane at a time, no jump. Scroll cue is a subtle bottom fade. Footnote/marginalia note has no circular glyph and dismisses on scroll. Homepage shows a live, real-looking sliding-panes demo.
