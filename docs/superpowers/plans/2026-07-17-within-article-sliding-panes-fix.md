# Within-Article Sliding Panes — Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the self-fighting `desktop-panes` collapse mechanism with a stable, scroll-geometry-driven one that stacks at most 2 section spines, and strip the redundant chrome — fixing B1, B2, B3, B5, B6, B7.

**Architecture:** Panes stay fixed-width and `position: sticky`; a single pure function `computePaneLayout(scrollLeft, count, opts)` decides each pane's role (`spine` / `active` / `ahead` / `hidden`) and sticky `left`. The transport measures pane width once, calls that function on every scroll, and applies roles as classes + inline `left`. No width animation, no `inView` guard, no `settle()` edge heuristic. Collapse is owned by scroll geometry; `present()` only scrolls a target section into view on explicit jumps.

**Tech Stack:** TypeScript, vitest (`pnpm exec vitest run`), Astro, Tailwind, plain CSS in `src/styles/reading-deck.css`.

## Global Constraints

- Astro v6 — use `entry.id`, never `entry.slug`. (Not touched here, but repo-wide.)
- Never edit `src/content/**` (git submodule).
- No `console.log` outside `import.meta.env.DEV`.
- All changes scoped to Deep read: `[data-active-feed="slides"]` and `[data-deck-layout="panes"]`. The TLDR deck (`desktop-transform`), mobile (`mobile-scroll-snap`), and reduced-motion paths must stay behaviourally unchanged.
- `DeckTransport` interface (`connect/present/reflow/destroy`) and `DeckTransportContext` are unchanged.
- Spine visible width is `2.5rem` = `40px` at the default root font-size; single-source it (Task 3, B6).
- Git identity: commit as `fayzabdul` (never `zubayrali`).

---

### Task 1: Pure pane-layout geometry + tests

**Files:**
- Create: `src/scripts/reading-deck/transports/panes-geometry.ts`
- Test: `src/scripts/reading-deck/transports/panes-geometry.test.ts`

**Interfaces:**
- Produces: `computePaneLayout(scrollLeft: number, count: number, opts: PanesGeometryOptions): PaneLayout[]`, `PanesGeometryOptions { paneWidth: number; spineWidth: number; maxSpines?: number }`, `PaneRole = 'spine' | 'active' | 'ahead' | 'hidden'`, `PaneLayout { index: number; role: PaneRole; left: number | null }`.
- Semantics: panes are canonically at `i * paneWidth`. A prefix `0..passedCount-1` is "passed" once each trailing edge reaches the spine zone (`spineWidth * maxSpines`). The first non-passed pane is `active`; the last `maxSpines` passed panes are `spine`s stacked at `left = rank * spineWidth`; earlier passed panes are `hidden`; panes after `active` are `ahead` (`left: null` = not pinned). `left` is `null` for `ahead`, a px number otherwise.

- [ ] **Step 1: Write the failing tests**

```ts
// src/scripts/reading-deck/transports/panes-geometry.test.ts
import { describe, it, expect } from 'vitest';
import { computePaneLayout } from './panes-geometry';

const OPTS = { paneWidth: 600, spineWidth: 40, maxSpines: 2 };

describe('computePaneLayout', () => {
  it('at scrollLeft 0, pane 0 is active and the rest are ahead', () => {
    const layout = computePaneLayout(0, 5, OPTS);
    expect(layout.map((p) => p.role)).toEqual(['active', 'ahead', 'ahead', 'ahead', 'ahead']);
    expect(layout[0].left).toBe(0);
    expect(layout[1].left).toBeNull();
  });

  it('with two panes passed, shows two stacked spines then the active pane', () => {
    // pane0 right=600, pane1 right=1200; spineZone=80. scrollLeft=1250 passes 0 and 1.
    const layout = computePaneLayout(1250, 5, OPTS);
    expect(layout.map((p) => p.role)).toEqual(['spine', 'spine', 'active', 'ahead', 'ahead']);
    expect(layout[0].left).toBe(0);   // older spine
    expect(layout[1].left).toBe(40);  // newer spine, offset by one spine width
    expect(layout[2].left).toBe(80);  // active clears the 2-spine zone
  });

  it('caps visible spines at two — older passed panes become hidden', () => {
    // scrollLeft=1900 passes 0,1,2. Window keeps the two most-recent (1,2); 0 is hidden.
    const layout = computePaneLayout(1900, 5, OPTS);
    expect(layout.map((p) => p.role)).toEqual(['hidden', 'spine', 'spine', 'active', 'ahead']);
    expect(layout[1].left).toBe(0);
    expect(layout[2].left).toBe(40);
    expect(layout[3].left).toBe(80);
  });

  it('with one pane passed, shows one spine and a 40px active offset', () => {
    const layout = computePaneLayout(650, 5, OPTS); // pane0 right=600 passed, pane1 not
    expect(layout.map((p) => p.role)).toEqual(['spine', 'active', 'ahead', 'ahead', 'ahead']);
    expect(layout[0].left).toBe(0);
    expect(layout[1].left).toBe(40);
  });

  it('degrades to a single active pane when count is 1', () => {
    const layout = computePaneLayout(0, 1, OPTS);
    expect(layout).toEqual([{ index: 0, role: 'active', left: 0 }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/scripts/reading-deck/transports/panes-geometry.test.ts`
Expected: FAIL — "Cannot find module './panes-geometry'".

- [ ] **Step 3: Write the implementation**

```ts
// src/scripts/reading-deck/transports/panes-geometry.ts
// Deep read pane layout — a pure function of horizontal scroll position.
// Panes are canonically fixed-width at i*paneWidth. As the reader scrolls
// right, the passed prefix collapses; only the last `maxSpines` passed
// sections stay on screen as stacked spines, so a many-section article can
// never flood the viewport with spines.

export interface PanesGeometryOptions {
  paneWidth: number;   // px — canonical (expanded) pane width
  spineWidth: number;  // px — visible width of one collapsed spine (40)
  maxSpines?: number;  // default 2
}

export type PaneRole = 'spine' | 'active' | 'ahead' | 'hidden';

export interface PaneLayout {
  index: number;
  role: PaneRole;
  left: number | null; // px for sticky panes; null = not pinned (ahead)
}

export function computePaneLayout(
  scrollLeft: number,
  count: number,
  opts: PanesGeometryOptions,
): PaneLayout[] {
  const { paneWidth, spineWidth } = opts;
  const maxSpines = opts.maxSpines ?? 2;
  const spineZone = spineWidth * maxSpines;

  // Passed panes form a contiguous prefix (the condition is monotonic in i).
  let passedCount = 0;
  for (let i = 0; i < count; i++) {
    if ((i + 1) * paneWidth - scrollLeft <= spineZone) passedCount++;
    else break;
  }

  const active = Math.min(passedCount, Math.max(0, count - 1));
  const visibleSpines = Math.min(passedCount, maxSpines);
  const firstSpine = active - visibleSpines; // index of the oldest visible spine

  return Array.from({ length: count }, (_, i): PaneLayout => {
    if (i < firstSpine) return { index: i, role: 'hidden', left: null };
    if (i < active) return { index: i, role: 'spine', left: (i - firstSpine) * spineWidth };
    if (i === active) return { index: i, role: 'active', left: visibleSpines * spineWidth };
    return { index: i, role: 'ahead', left: null };
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/scripts/reading-deck/transports/panes-geometry.test.ts`
Expected: PASS — 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/scripts/reading-deck/transports/panes-geometry.ts src/scripts/reading-deck/transports/panes-geometry.test.ts
git commit -m "feat(deck): pure pane-layout geometry for capped sliding panes"
```

---

### Task 2: Panes CSS — sticky fixed-width, stacked spines, full-bleed, chrome removals

**Files:**
- Modify: `src/styles/reading-deck.css` (panes block ~1058–1130; stage/track ~357–390; add slides-scoped overrides)

**Interfaces:**
- Consumes: nothing (CSS only).
- Produces: CSS contract the transport relies on — panes are `position: sticky`; `.reading-deck-card.collapsed` shows the spine and fades content **without changing width**; `.reading-deck-card[data-pane-hidden]` is not visible; the transport sets inline `left` on each pane. Full-bleed layout under `[data-active-feed="slides"]`.

- [ ] **Step 1: Make panes sticky and stop animating/shrinking width**

In `src/styles/reading-deck.css`, in the rule `.reading-deck-track[data-deck-layout="panes"] > .reading-deck-card` (currently ~line 1058), change `position: relative;` to `position: sticky;`, add `top: 0;`, and **remove** the line `transition: width 320ms cubic-bezier(0.19, 1, 0.22, 1);`. The block's width/height/overflow stay as-is. Result:

```css
.reading-deck-track[data-deck-layout="panes"] > .reading-deck-card {
  position: sticky;
  top: 0;
  flex: 0 0 auto;
  width: min(40rem, 92vw);
  max-width: min(40rem, 92vw);
  height: 100%;
  opacity: 1 !important;
  transform: none !important;
  border: 0;
  border-left: 1px solid rgb(var(--color-primary-200));
  border-radius: 0;
  box-shadow: none;
  content-visibility: visible;
  scrollbar-width: thin;
  scrollbar-color: rgb(var(--color-primary-300)) transparent;
}
```

- [ ] **Step 2: Collapse = spine + faded content, but keep full width**

Replace the `.collapsed` width-shrink rule (currently ~line 1096) so it no longer changes width (the spine's 40px look comes from the next pane overlapping it, not from shrinking). Keep the content-fade rule. Add a hidden-pane rule.

```css
/* Collapsed pane keeps its width; the next pane (sticky, offset right) covers
   all but its leading 40px, which is where the vertical spine title shows. */
.reading-deck-track[data-deck-layout="panes"] > .reading-deck-card.collapsed {
  overflow: hidden;
}
.reading-deck-track[data-deck-layout="panes"] > .reading-deck-card.collapsed > :not(.reading-deck-spine) {
  opacity: 0;
  pointer-events: none;
}
/* Passed sections older than the two-spine window: fully out of view. */
.reading-deck-track[data-deck-layout="panes"] > .reading-deck-card[data-pane-hidden] {
  visibility: hidden;
}
```

- [ ] **Step 3: Give the two spines a stacked-card look**

The spine button already exists (`.reading-deck-spine`, ~line 1107, `writing-mode: vertical-rl`, `width: 2.5rem`). Add a right border + shadow so a stacked pair reads as overlapping cards:

```css
.reading-deck-spine {
  border-right: 1px solid rgb(var(--color-primary-200));
  box-shadow: 2px 0 6px -3px rgb(0 0 0 / 0.18);
}
.dark .reading-deck-spine {
  border-right-color: rgb(var(--color-primary-700));
}
```

- [ ] **Step 4: Full-bleed layout in slides (remove the "frame")**

The frame is the padding on `.reading-deck-stage` (~lines 361–362) and `.reading-deck-track` (~line 386). Add slides-scoped overrides near the panes block:

```css
/* Deep read is full-bleed: no inset frame around the panes or the scrollbar. */
.reading-deck[data-active-feed="slides"] .reading-deck-stage {
  padding: 0;
}
.reading-deck[data-active-feed="slides"] .reading-deck-track[data-deck-layout="panes"] {
  padding: 0;
}
```

- [ ] **Step 5: Hide the mode label and the top progress tracker in slides**

Add near the existing `[data-active-feed="slides"]` chrome rules (~line 1147):

```css
.reading-deck[data-active-feed="slides"] [data-deck-mode-label] { display: none; }
.reading-deck[data-active-feed="slides"] .reading-deck-progress { display: none; }
```

- [ ] **Step 6: Verify the stylesheet compiles**

Run: `pnpm exec astro check`
Expected: 0 errors (CSS is not type-checked, but this confirms nothing else broke). Visual verification happens in Task 5.

- [ ] **Step 7: Commit**

```bash
git add src/styles/reading-deck.css
git commit -m "style(deck): sticky full-width panes, stacked spines, full-bleed, hide label+tracker"
```

---

### Task 3: Rewrite the panes transport to drive layout from scroll geometry

**Files:**
- Modify (full rewrite): `src/scripts/reading-deck/transports/desktop-panes.ts`

**Interfaces:**
- Consumes: `computePaneLayout` from Task 1; `.collapsed` / `[data-pane-hidden]` / inline `left` CSS contract from Task 2; `DeckTransportContext` (`track`, `cards`, `selectedIndex()`, `reducedMotion()`, `requestSelect?`, `reportSettled`, `dismissHint`).
- Produces: `createDesktopPanesTransport(): DeckTransport`.
- Behaviour: on every scroll, measure pane width, call `computePaneLayout`, apply roles; report the active index to the session when it changes (replaces the old `settle()` edge math). `present(index, motion)` scrolls so pane `index` becomes active (`scrollLeft = index*paneWidth - spineZone`); no width animation, no `inView` guard.

- [ ] **Step 1: Replace the file contents**

```ts
// src/scripts/reading-deck/transports/desktop-panes.ts
import type { DeckMotion, DeckTransport, DeckTransportContext } from './transport';
import { computePaneLayout } from './panes-geometry';

// Deep read — within-article sliding panes. Each card is a full-width, sticky
// pane. As the reader scrolls right, the passed prefix collapses; only the two
// most-recently-passed sections stay on screen as stacked, clickable spines
// (older ones scroll away, reachable via the contents index). Collapse is a
// pure function of scroll position — never of animated width — so free scroll,
// spine clicks, and contents jumps all agree and nothing drifts.

const MAX_SPINES = 2;

class DesktopPanesTransport implements DeckTransport {
  private context: DeckTransportContext | null = null;
  private browser: Window | null = null;
  private abort: AbortController | null = null;
  private spines: HTMLButtonElement[] = [];
  private resizeFrame = 0;
  private scrollFrame = 0;
  private spineWidth = 40;

  connect(context: DeckTransportContext): void {
    this.destroy();
    this.context = context;
    this.browser = context.track.ownerDocument.defaultView;
    this.abort = new AbortController();
    const { signal } = this.abort;
    context.track.dataset.deckLayout = 'panes';
    this.readSpineWidth(context);
    this.buildSpines(context);
    // Native scroll in both axes: vertical wheel reads a pane, horizontal
    // (scrollbar / shift-wheel / trackpad swipe) moves across panes. We only
    // react to it — recompute the layout and report the active pane.
    context.track.addEventListener('scroll', () => {
      context.dismissHint();
      this.scheduleLayout();
    }, { passive: true, signal });
    this.applyLayout();
  }

  present(index: number, motion: DeckMotion): void {
    const context = this.context;
    if (!context?.cards.length) return;
    const selected = Math.max(0, Math.min(context.cards.length - 1, index));
    const paneWidth = this.paneWidth();
    const spineZone = this.spineWidth * MAX_SPINES;
    const left = Math.max(0, selected * paneWidth - spineZone);
    context.track.scrollTo({
      left,
      behavior: motion === 'animate' && !context.reducedMotion() ? 'smooth' : 'auto',
    });
    // The scrollTo fires a scroll event; applyLayout runs from there. Run it
    // once synchronously too so a no-op scroll (already at target) still lays out.
    this.applyLayout();
  }

  reflow(): void {
    if (this.resizeFrame || !this.context) return;
    this.resizeFrame = (this.browser || window).requestAnimationFrame(() => {
      this.resizeFrame = 0;
      this.readSpineWidth(this.context!);
      this.applyLayout();
    });
  }

  destroy(): void {
    this.abort?.abort();
    this.abort = null;
    const browser = this.browser || window;
    if (this.resizeFrame) browser.cancelAnimationFrame(this.resizeFrame);
    if (this.scrollFrame) browser.cancelAnimationFrame(this.scrollFrame);
    this.resizeFrame = 0;
    this.scrollFrame = 0;
    this.spines.forEach((spine) => spine.remove());
    this.spines = [];
    this.context?.cards.forEach((pane) => {
      pane.classList.remove('collapsed');
      pane.removeAttribute('data-pane-hidden');
      pane.style.removeProperty('left');
    });
    if (this.context) delete this.context.track.dataset.deckLayout;
    this.context = null;
    this.browser = null;
  }

  private scheduleLayout(): void {
    if (this.scrollFrame || !this.context) return;
    this.scrollFrame = (this.browser || window).requestAnimationFrame(() => {
      this.scrollFrame = 0;
      this.applyLayout();
    });
  }

  private applyLayout(): void {
    const context = this.context;
    if (!context?.cards.length) return;
    const paneWidth = this.paneWidth();
    const layout = computePaneLayout(context.track.scrollLeft, context.cards.length, {
      paneWidth,
      spineWidth: this.spineWidth,
      maxSpines: MAX_SPINES,
    });
    let active = 0;
    layout.forEach((pane) => {
      const el = context.cards[pane.index];
      el.classList.toggle('collapsed', pane.role === 'spine');
      el.toggleAttribute('data-pane-hidden', pane.role === 'hidden');
      if (pane.left == null) el.style.removeProperty('left');
      else el.style.left = `${pane.left}px`;
      if (pane.role === 'active') active = pane.index;
    });
    if (active !== context.selectedIndex()) context.reportSettled(active);
  }

  private paneWidth(): number {
    const first = this.context?.cards[0];
    return first ? first.getBoundingClientRect().width || first.offsetWidth : 640;
  }

  private readSpineWidth(context: DeckTransportContext): void {
    const doc = context.track.ownerDocument;
    const probe = doc.defaultView?.getComputedStyle(context.track).getPropertyValue('--deck-spine-width');
    const parsed = probe ? parseFloat(probe) : NaN;
    this.spineWidth = Number.isFinite(parsed) && parsed > 0 ? parsed : 40;
  }

  private buildSpines(context: DeckTransportContext): void {
    const doc = context.track.ownerDocument;
    context.cards.forEach((pane, index) => {
      if (pane.hasAttribute('data-deck-finish')) return;
      if (pane.querySelector(':scope > .reading-deck-spine')) return;
      const heading = pane.querySelector('h2, h3');
      const label = heading?.textContent?.trim() || `Section ${index + 1}`;
      const spine = doc.createElement('button');
      spine.type = 'button';
      spine.className = 'reading-deck-spine';
      spine.textContent = label;
      spine.setAttribute('aria-label', `Jump to ${label}`);
      spine.addEventListener('click', () => context.requestSelect?.(index), { signal: this.abort!.signal });
      pane.prepend(spine);
      this.spines.push(spine);
    });
  }
}

export function createDesktopPanesTransport(): DeckTransport {
  return new DesktopPanesTransport();
}
```

- [ ] **Step 2: Single-source the spine width in CSS (B6)**

In `src/styles/reading-deck.css`, add a `--deck-spine-width` custom property on the panes track and use it for the spine width so JS (`readSpineWidth`) and CSS agree. In the `.reading-deck-track[data-deck-layout="panes"]` rule (~line 1035) add:

```css
  --deck-spine-width: 40px;
```

and change the `.reading-deck-spine` `width: 2.5rem;` (~line 1112) to `width: var(--deck-spine-width);`.

- [ ] **Step 3: Fix the contradictory comments**

Remove the stale "pins on the left via CSS sticky" wording. In `src/styles/reading-deck.css` the panes-block comment (~line 1031-1034) should describe: "Full-width sticky columns; the two most-recently-passed sections stay as stacked spines, older ones scroll away." (The transport's own header comment is already correct in Step 1.)

- [ ] **Step 4: Type-check and run the existing geometry tests**

Run: `pnpm exec astro check && pnpm exec vitest run src/scripts/reading-deck/transports/panes-geometry.test.ts`
Expected: astro check → 0 errors; vitest → 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/scripts/reading-deck/transports/desktop-panes.ts src/styles/reading-deck.css
git commit -m "feat(deck): scroll-geometry-driven panes with a capped 2-spine stack"
```

---

### Task 4: Fix the homepage demo's Swup re-init seam (B7)

**Files:**
- Modify: `src/components/DeckDemo.astro` (the init block, ~lines 189–221)

**Interfaces:**
- Consumes: the same `createDesktopPanesTransport` + `astro:page-load` re-init contract the deck client uses.
- Produces: an idempotent `initDeckDemo` bound to `astro:page-load` with a bind-once guard, so navigations can't stack duplicate transports on the demo.

- [ ] **Step 1: Read the current init block**

Run: `sed -n '180,225p' src/components/DeckDemo.astro` — confirm it constructs a transport in `initDeckDemo` and binds `DOMContentLoaded` + `swup:page:view`.

- [ ] **Step 2: Make init idempotent and bind to astro:page-load**

Replace the demo's construction so a re-run destroys/replaces any prior instance, and swap the listeners. Concretely: hold the constructed transport (and its abort) in a module-scoped variable; at the top of `initDeckDemo`, if one already exists for the current demo element, return; otherwise destroy the old one before building the new. Replace the tail:

```ts
    document.addEventListener('DOMContentLoaded', initDeckDemo);
    document.addEventListener('swup:page:view', initDeckDemo);
```

with:

```ts
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initDeckDemo, { once: true });
    } else {
      initDeckDemo();
    }
    document.addEventListener('astro:page-load', initDeckDemo);
```

and add, at the top of `initDeckDemo`, a guard that no-ops if the demo transport is already connected to the current `.reading-deck-stage` demo node (mirror `reading-deck-client.ts`'s `activeDeck && nextDialog === activeDialog` guard).

- [ ] **Step 3: Type-check**

Run: `pnpm exec astro check`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/DeckDemo.astro
git commit -m "fix(deck): homepage demo re-inits idempotently on astro:page-load"
```

---

### Task 5: End-to-end verification

**Files:** none (verification only; use `superpowers:verification-before-completion`).

- [ ] **Step 1: Type check + build**

Run: `pnpm exec astro check && pnpm exec astro build`
Expected: astro check → 0 errors; build → succeeds.

- [ ] **Step 2: Run the full test suite**

Run: `pnpm exec vitest run`
Expected: all pass (existing `search.test.ts` + new `panes-geometry.test.ts`).

- [ ] **Step 3: Manual browser verification (`pnpm dev`, port 5000)**

On a post with several large `<h2>` sections, open Deep read and confirm:
- Free horizontal scroll (scrollbar drag / shift-wheel / trackpad) collapses passed sections into **at most 2 stacked spines**; older ones scroll away. *(B1)*
- Clicking a spine and picking a section from contents lands exactly on that section with **no drift/jump**. *(B2, B5)*
- The 2 spines stay pinned at the left as a stacked-card breadcrumb; each is clickable. *(B3)*
- Panes are **full-bleed** — no inset frame, scrollbar flush at the bottom. No "DEEP READ" label, no top segmented tracker.
- Per-pane vertical scroll works; the bottom "more below" fade still appears.
- TLDR view (on a post with a `tldr`) is **unchanged**; mobile shows one pane at a time, no spine.
- Homepage sliding-panes demo still works after a client-side navigation to the homepage and back. *(B7)*

- [ ] **Step 4: Final commit if any verification tweaks were needed**

```bash
git add -A
git commit -m "test(deck): verify within-article sliding panes end to end"
```

---

## Self-Review

**Spec coverage:** §1 stable mechanism → Task 1 + Task 3. §2 bounded 2-spine stack → Task 1 (`computePaneLayout` window) + Task 2 (spine CSS) + Task 3 (spine build/click). §3 chrome removals (mode label, tracker, full-bleed frame) → Task 2 Steps 4–5. §4 B6 single-source width → Task 3 Step 2; B7 DeckDemo → Task 4. Testing (pure fn unit tests + manual matrix) → Task 1 + Task 5. All spec sections map to a task.

**Placeholder scan:** No TBD/TODO. Task 4 Step 2 references the existing `reading-deck-client.ts` guard pattern rather than repeating unseen code — acceptable because it also states the concrete listener swap verbatim; the implementer reads the current `DeckDemo.astro` init in Step 1 first.

**Type consistency:** `computePaneLayout(scrollLeft, count, opts)` signature and `PaneRole` values (`spine`/`active`/`ahead`/`hidden`) are identical across Task 1 (definition), the tests, and Task 3 (consumer). CSS contract names (`.collapsed`, `[data-pane-hidden]`, `--deck-spine-width`, inline `left`) match between Task 2 and Task 3.
