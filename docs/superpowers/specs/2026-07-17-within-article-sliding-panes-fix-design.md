# Within-Article Sliding Panes — Fix & Deepen — Design

**Date:** 2026-07-17
**Status:** Approved design, pending spec review
**Relates to:** `2026-07-17-sliding-panes-deep-read-and-tldr-view-design.md` (original Deep read spec). This document corrects the shipped `desktop-panes` transport, which reimplemented collapse with a shallower, self-fighting model.

## Framing

Our sliding panes are **not** Andy Matuschak's cross-article stack. They are an **alternative reading UI for a single long article** with many large `<h2>` sections — one section per pane — to reduce the fatigue and monotony of one long scroll. This reframing changes the spine design: the reference pins *every* passed pane, which floods the viewport once an article has many sections.

## Problem (validated against the shipped code)

The `desktop-panes` transport ported the reference's *behaviour* but not its *mechanism*. The reference makes collapse a pure function of scroll geometry over fixed-width `position: sticky` panes. The port instead:

- toggles `.collapsed` from the **selected index** (`i < selected`), only on **animated navigation**;
- **animates pane width** (`40rem → 2.5rem`, `transition: width 320ms`);
- keeps spines **in normal flow** (they scroll away — no persistent breadcrumb).

Consequences (all runtime; `astro check` is clean):

- **B1 — free scroll never collapses.** `reportSettled` calls `show(index, false, false, false)` with `shouldPlace=false`, so the scroll-driven path never calls `present()` / never toggles `.collapsed`. Dragging the scrollbar — the affordance the UI invites — yields a row of full-width columns, no stacking.
- **B2 — nav drift/jump.** `present()` toggles `.collapsed` (starting the 320ms width animation) then immediately reads `pane.offsetLeft` and scrolls there; the read reflects pre-shrink layout, so the scroll target is wrong and the width animation races the smooth-scroll.
- **B3 — no breadcrumb.** Spines are `position: absolute` inside in-flow panes; they scroll off-screen. Comments contradict themselves (`desktop-panes.ts:5` "pins via sticky" vs `:54` "NOT pinned").
- **B5 — settle mis-select.** `settle()`'s edge heuristic assumes contiguous, pinned, fresh 40px spines — none true during free scroll — so nearest-pane detection can jump selection unexpectedly.
- **B6 — hardcoded `SPINE_WIDTH = 40`** must equal CSS `2.5rem`; breaks silently if the root font-size changes.
- **B7 — DeckDemo double-init risk.** The homepage demo binds `swup:page:view` + `DOMContentLoaded` with no bind-once guard; the real deck binds `astro:page-load` idempotently.

## Approach

Adopt the reference's **stable mechanism**, replace its **unbounded spine layout** with a bounded 2-spine stack, and strip the chrome that the panes make redundant. Everything is scoped to `[data-active-feed="slides"]` / `[data-deck-layout="panes"]`; the TLDR deck, mobile transport, and reduced-motion paths are untouched.

### 1. Stable pane mechanism (fixes B1, B2, B5)

- Panes stay **fixed-width** (`min(40rem, 92vw)`), `position: sticky; top: 0`, `flex-shrink: 0`, inside the existing `overflow-x: auto` track. **Remove** `transition: width`.
- Collapse is a **pure function of scroll geometry**: on the existing (passive) `scroll` listener, compute which panes are overlapped/past the left edge and toggle `.collapsed` accordingly. This runs on *all* movement — free scroll and programmatic alike — so B1 disappears.
- Because pane widths never change, `scrollLeft` and pane offsets are stable: jump-to-section scroll targets are exact (B2 gone) and nearest-pane settle is reliable (B5 gone).
- **Delete:** the `width 320ms` transition, the `inView` early-return in `present()`, the `settle()` edge heuristic (replace with the geometry pass), and the ad-hoc `programmatic`-timer release (retain only a minimal guard so a programmatic `scrollTo` doesn't re-enter settle).
- `DeckTransport` interface is unchanged. `present(index, motion)` still scrolls the target section into view; it no longer owns collapse (scroll geometry does).

### 2. Bounded 2-spine stack (the new spine solution)

- Show **at most 2** spines: the **2 most-recently-passed** sections, as a sliding window. Older passed sections scroll fully away (no spine) and remain reachable via the contents index.
- Spines pin at the far-left with the **aarnphm stacked-title look**: vertical `writing-mode: vertical-rl` titles, a small offset + shadow so the two read as a *stack of cards*. Left real-estate is capped at ~2 spine widths regardless of section count.
- Each spine is a clickable `<button>` → `context.requestSelect(index)` (already wired to `session.show(index, true, true)`).
- Implementation note: the transport decides, from the selected index and scroll position, which ≤2 sections are the visible spines; panes outside that window that are past the viewport are hidden rather than pinned. The exact pin/offset math is a planning detail.

### 3. Chrome removals (per screenshots)

- **Mode label** — hide `[data-deck-mode-label]` ("Deep read") in the header for slides.
- **Top segmented tracker** — hide `.reading-deck-progress` (`[data-deck-progress]`) in slides; the panes + spines already convey position.
- **Inset frame** — remove the padding around the panes track and the horizontal scrollbar in slides so panes are **full-bleed** (edge-to-edge, full height) and the scrollbar sits flush at the bottom, matching the reference's full-bleed layout. Horizontal scroll is retained.
- **Kept:** the per-pane bottom "more below" fade (`.reading-deck-scroll-shadow`) — each pane scrolls vertically, so it stays useful; and the contents index (title-click) as the jump-to-any-section backstop.

### 4. Riding-along fixes

- **B6** — single-source the spine width (read the CSS custom property at runtime, or derive the JS constant and CSS value from one place).
- **B7** — route the DeckDemo re-init through `astro:page-load` with a bind-once/idempotent guard, mirroring `reading-deck-client.ts`.
- **B8 (entrance animation / overlap shadow)** — out of scope; the spine stack shadow already supplies the depth cue.

## Components / files

- `src/scripts/reading-deck/transports/desktop-panes.ts` — rewrite: geometry-driven collapse, 2-spine window, fixed-width sticky, delete width-animation/inView/edge-heuristic machinery.
- `src/styles/reading-deck.css` (panes block ~1030–1170) — fixed-width sticky panes (no width transition), stacked-spine styling, full-bleed layout, hide mode label + progress in slides.
- `src/scripts/reading-deck/view.ts` — only if the mode-label / progress removal needs a render-side change (prefer CSS-only).
- `src/components/DeckDemo.astro` — Swup re-init seam fix (B7).
- New: a small pure module for the collapse/spine decisions (e.g. `panes-geometry.ts`) so the logic is unit-testable — see Testing.

## Data flow

Unchanged orchestration: `session.buildFeed` → cards grouped by `<h2>` → `view.renderFeed` → `session.replaceTransport` picks `desktop-panes` for `(slides, desktop)` → `transport.connect(context)`. New: on every track `scroll`, the transport runs the geometry pass to set `.collapsed` and choose the ≤2 visible spines; `present(index, motion)` scrolls a target section into view on explicit jumps (spine click, contents select, keyboard arrows, deep-link).

## Error handling / edge cases

- **0–1 sections:** one pane, no spines, no horizontal scroll — single centered pane.
- **Exactly 2 passed sections:** both spines visible; a 3rd pass drops the oldest from the window.
- **Feed switch `tldr ↔ slides` mid-session:** `replaceTransport` destroys/reconnects as today; `destroy()` clears spines, `.collapsed`, inline styles, and `data-deck-layout`.
- **Reduced motion:** no width animation exists; programmatic scroll uses `behavior: 'auto'`.
- **Cover / finish cards:** no spine (already excluded via `data-deck-finish`; cover is index 0).
- **Mobile:** unchanged — one full-width pane, scroll-snap, no spine.

## Testing

- **Pure functions, unit-tested (TDD):**
  - `collapsedIndicesFor(scrollLeft, paneOffsets, paneWidths, clientWidth) → Set<number>` — which panes are collapsed at a given scroll position.
  - `visibleSpineWindow(selectedIndex, collapsedIndices) → number[]` (length ≤ 2) — which sections render as the 2 stacked spines.
  These take plain numbers/arrays — no DOM — and get a small `*.test.ts` (assert-based, no framework beyond what the repo uses).
- **Manual browser verification** (the DOM/scroll wiring): on a post with several large `<h2>` sections — free-scroll collapses passed panes into ≤2 stacked spines; jump-to-section (spine + contents) lands exactly with no drift; panes are full-bleed; no mode label, no top tracker; per-pane vertical scroll and bottom fade work; TLDR view unchanged; mobile one-pane unchanged.
- `pnpm exec astro check` → 0 errors; `pnpm exec astro build` succeeds.

## Risks

- **2-spine sticky/stack math** is the fiddliest part (bounded pinning in a horizontal scroller). Mitigation: keep the geometry pure and unit-tested; pin only the ≤2 window, hide the rest.
- **Full-bleed layout** may collide with the dialog's shared shell padding used by TLDR. Mitigation: scope all layout overrides to `[data-active-feed="slides"]`.
- **Removing `present()`-owned collapse** could regress keyboard/contents jumps if the geometry pass hasn't run post-scroll. Mitigation: run the geometry pass once at the end of a programmatic `scrollTo` (scroll event fires) and on `reflow()`.
