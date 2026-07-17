# Sliding-Panes Deep Read + TLDR View — Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. No unit-test framework is wired for the reading-deck UI; the verification gate for every task is `pnpm exec astro check` (0 errors) plus, at the end, a full `pnpm exec astro build`, matching this repo's existing practice. Non-trivial transport math carries an inline `ponytail:` self-check comment.

**Goal:** Split the reading deck into two intents — a calmed card-deck "TLDR view" (tldr feed) and a new Matuschak sliding-panes "Deep read" (slides feed, across headings) — and fix the dancing scroll arrow and the note popover.

**Architecture:** Movement is already abstracted behind `DeckTransport` (`connect/present/reflow/destroy`) over a dialog-agnostic `DeckTransportContext`. Deep read adds one new transport (`desktop-panes`) selected by `(feed, viewport)`; mobile reuses `mobile-scroll-snap` for both modes (CSS-only difference). Everything else (shell, session, feed compilation, note/image/history) is shared. The dialog-agnostic context lets the same real transport drive an inline homepage demo.

**Tech Stack:** Astro 6, TypeScript, plain CSS (`src/styles/reading-deck.css`), no framework runtime for the deck.

## Global Constraints

- Never edit `src/content/**` (git submodule); never `git add src/content/...`. Homepage demo content is hand-written inline in a component.
- `entry.id`, never `entry.slug`.
- No `console.log` outside `import.meta.env.DEV`.
- `[CONFIG:KEY]` markers in `src/config.ts` are sacred.
- Git commits use identity **fayzabdul** (`user.name=fayzabdul`, `user.email=mail.zubayrali@gmail.com`), never zubayrali.
- Internal feed keys stay `tldr` / `slides`. Only UI labels change.
- `postOptions.readingDeck` config gate still governs Deep read availability (already shipped).

---

### Task 1: Rename mode labels (TLDR view / Deep read)

**Files:**
- Modify: `src/components/ReadingDeck.astro` (switcher buttons ~121-122)
- Modify: `src/scripts/reading-deck/view.ts` (`renderFeed` mode label ~192)

- [ ] **Step 1:** In `ReadingDeck.astro`, change the tldr switcher button copy from `Quick read`/`Quick` to `TLDR view`/`TLDR`:

```astro
<button type="button" data-deck-feed="tldr"><span class="deck-mode-wide">TLDR view</span><span class="deck-mode-short">TLDR</span></button>
<button type="button" data-deck-feed="slides"><span class="deck-mode-wide">Deep read</span><span class="deck-mode-short">Deep</span></button>
```

- [ ] **Step 2:** In `view.ts renderFeed`, update the mode label text:

```ts
this.modeLabel.textContent = kind === 'tldr' ? 'TLDR view' : 'Deep read';
```

- [ ] **Step 3:** Also update the two `renderNavigation`/`renderCompletion` status/cover strings in `view.ts` that say `Quick read` → `TLDR view` (search `'Quick read'`).

- [ ] **Step 4:** `pnpm exec astro check` → 0 errors.

---

### Task 2: Calm the TLDR deck (approach B)

**Files:**
- Modify: `src/styles/reading-deck.css` (neighbor distance ~957-965; mobile card ~1474-1480)

- [ ] **Step 1:** Soften neighbor prominence — raise the opacity floor and shrink the scale delta:

```css
.reading-deck-card[data-deck-distance="1"] {
  opacity: 0.85;
  transform: scale(0.99) translateY(0.12rem);
}

.reading-deck-card[data-deck-distance="2"] {
  opacity: 0.6;
  transform: scale(0.985) translateY(0.24rem);
}
```

- [ ] **Step 2:** Kill the neighbor scale/fade on mobile (the pronounced/jumpy part) — add inside the `@media (max-width: 720px)` block:

```css
  .reading-deck-card[data-deck-distance="1"],
  .reading-deck-card[data-deck-distance="2"] {
    opacity: 1;
    transform: none;
  }
```

- [ ] **Step 3:** `pnpm exec astro check` → 0 errors.

---

### Task 3: Replace the dancing arrow with a bottom fade

**Files:**
- Modify: `src/styles/reading-deck.css` (`.reading-deck-scroll-shadow` ~967-1013; mobile ~1494-1497; reduced-motion ~1550)

- [ ] **Step 1:** Replace the scroll-shadow block (the sticky bobbing chevron) with a subtle bottom gradient pinned to the true bottom edge:

```css
.reading-deck-scroll-shadow {
  position: sticky;
  z-index: 8;
  top: calc(100% - 3rem);
  left: 0;
  width: 100%;
  height: 3rem;
  margin: 0;
  pointer-events: none;
  background: linear-gradient(to bottom, transparent, rgb(var(--color-primary-50) / 0.9) 82%);
}

.reading-deck-scroll-shadow::after { content: none; }
.reading-deck-scroll-shadow[hidden] { display: none; }

.dark .reading-deck-scroll-shadow {
  background: linear-gradient(to bottom, transparent, rgb(var(--color-primary-900) / 0.92) 82%);
}
```

- [ ] **Step 2:** Delete the `@keyframes reading-deck-scroll-breathe` block (no longer referenced).

- [ ] **Step 3:** In the mobile block, keep the fade but thinner:

```css
  .reading-deck-scroll-shadow { top: calc(100% - 2.4rem); height: 2.4rem; width: 100%; }
```

- [ ] **Step 4:** In `@media (prefers-reduced-motion: reduce)`, remove the now-dead `.reading-deck-scroll-shadow::after { animation: none; }` line.

- [ ] **Step 5:** `pnpm exec astro check` → 0 errors. Grep confirms no remaining `reading-deck-scroll-breathe` reference: `grep -rn reading-deck-scroll-breathe src/`.

---

### Task 4: Note popover — parity + close on scroll

**Files:**
- Modify: `src/scripts/reading-deck/view.ts` (`bindCurrentCardOverflow` ~437-444; the scroll handler ~108)
- Modify: `src/scripts/reading-deck/session.ts` (add source dismissal to scroll path)
- Modify: `src/styles/reading-deck.css` (`.reading-deck-note-popover` ~696-712)
- Investigate + modify: source of the circular glyph on the note trigger

**Interfaces:**
- Produces: `view.closeSource()` already exists (public). Session will call it from the scroll handler.

- [ ] **Step 1 (root-cause fix — close on scroll):** In `view.ts`, the current-card scroll handler `onCardScroll` only calls `updateOverflow`. Add source dismissal so the fixed-position popover doesn't float over scrolled-away text. Change the handler:

```ts
private readonly onCardScroll = () => {
  if (!this.sourceOverlay.hidden) this.closeSource();
  this.updateOverflow();
};
```

- [ ] **Step 2 (restyle for reading parity):** In `reading-deck.css`, make the popover read like the article note — solid border (not dashed), matched surface:

```css
.reading-deck-note-popover {
  position: fixed;
  z-index: 30;
  width: min(20rem, calc(100vw - 1rem));
  max-height: min(60dvh, 28rem);
  overflow: auto;
  padding: 0.85rem 1rem;
  border: 1px solid rgb(var(--color-primary-300));
  border-radius: var(--radius-md);
  color: rgb(var(--color-primary-700));
  background: rgb(var(--color-primary-50));
  box-shadow: 0 0.5rem 1.5rem rgb(var(--color-primary-900) / 0.18);
  font-size: 0.86rem;
  line-height: 1.55;
  overscroll-behavior: contain;
  touch-action: manipulation;
}
```
Update the `.dark` variant border to `rgb(var(--color-primary-700))`.

- [ ] **Step 3 (drop circular glyph):** Locate the glyph shown on the note trigger inside a deck card (run the app or inspect built HTML for `.footnote-number`/`a[data-deck-source-id]` inside `.reading-deck-card`; the marker comes from global marginalia/citation styling, not the deck). Add a deck-scoped override in `reading-deck.css` to suppress the decorative glyph while keeping the clickable target, e.g.:

```css
/* Deck note triggers: keep the tap target, drop the decorative marker glyph. */
.reading-deck-card .footnote-number::after { content: none; }
```
Adjust the exact selector to whatever the investigation shows renders the circle (if it is an SVG/pseudo on `a[data-deck-source-id]`, target that instead).

- [ ] **Step 4:** `pnpm exec astro check` → 0 errors.

---

### Task 5: desktop-panes transport + selection wiring

**Files:**
- Modify: `src/scripts/reading-deck/transports/transport.ts` (add `requestSelect`)
- Create: `src/scripts/reading-deck/transports/desktop-panes.ts`
- Modify: `src/scripts/reading-deck/session.ts` (`replaceTransport` ~412-421; `transportContext` ~423-443)

**Interfaces:**
- Consumes: `DeckTransportContext` (`stage, track, cards, selectedIndex(), reducedMotion(), interactionEnabled(), requestMove(delta), reportSettled(index), dismissHint()`).
- Produces: `createDesktopPanesTransport(): DeckTransport`; adds `requestSelect(index: number): void` to `DeckTransportContext`.

- [ ] **Step 1:** Add optional `requestSelect` to the context interface (optional so existing transports need no change):

```ts
export interface DeckTransportContext {
  stage: HTMLElement;
  track: HTMLElement;
  cards: HTMLElement[];
  selectedIndex(): number;
  reducedMotion(): boolean;
  interactionEnabled(): boolean;
  requestMove(delta: -1 | 1): void;
  requestSelect?(index: number): void;
  reportSettled(index: number): void;
  dismissHint(): void;
}
```

- [ ] **Step 2:** Provide `requestSelect` in `session.transportContext` (spine clicks jump directly):

```ts
      requestMove: (delta) => this.go(delta),
      requestSelect: (index) => this.show(index, true, true),
```

- [ ] **Step 3:** Create `desktop-panes.ts`. Horizontal-scroll pane layout with collapse-to-spine. `present(index)` collapses panes before `index` (spine breadcrumb), expands the rest, scrolls pane `index` to the left edge after the stacked spines, and pins each collapsed spine with `sticky left` at its cumulative offset. Injects one spine button per card on `connect`; spine click → `requestSelect`.

```ts
import type { DeckMotion, DeckTransport, DeckTransportContext } from './transport';

const SPINE_WIDTH = 40; // px — matches the reference --note-title-width

class DesktopPanesTransport implements DeckTransport {
  private context: DeckTransportContext | null = null;
  private browser: Window | null = null;
  private abort: AbortController | null = null;
  private spines: HTMLButtonElement[] = [];
  private resizeFrame = 0;

  connect(context: DeckTransportContext): void {
    this.destroy();
    this.context = context;
    this.browser = context.track.ownerDocument.defaultView;
    this.abort = new AbortController();
    context.track.dataset.deckLayout = 'panes';
    this.buildSpines(context);
    // Free horizontal scroll drives selection back to the session.
    context.track.addEventListener('scroll', () => this.syncFromScroll(), { passive: true, signal: this.abort.signal });
  }

  present(index: number, motion: DeckMotion): void {
    const context = this.context;
    if (!context) return;
    const selected = Math.max(0, Math.min(context.cards.length - 1, index));
    // ponytail: collapse offset = count of collapsed panes to the left * SPINE_WIDTH
    let collapsedLeft = 0;
    context.cards.forEach((pane, i) => {
      const collapsed = i < selected;
      pane.classList.toggle('collapsed', collapsed);
      if (collapsed) {
        pane.style.left = `${collapsedLeft}px`;
        collapsedLeft += SPINE_WIDTH;
      } else {
        pane.style.removeProperty('left');
      }
    });
    const pane = context.cards[selected];
    if (!pane) return;
    context.track.scrollTo({
      left: Math.max(0, pane.offsetLeft - collapsedLeft),
      behavior: motion === 'animate' && !context.reducedMotion() ? 'smooth' : 'auto',
    });
  }

  reflow(): void {
    if (this.resizeFrame || !this.context) return;
    this.resizeFrame = (this.browser || window).requestAnimationFrame(() => {
      this.resizeFrame = 0;
      if (this.context) this.present(this.context.selectedIndex(), 'none');
    });
  }

  destroy(): void {
    this.abort?.abort();
    this.abort = null;
    if (this.resizeFrame) (this.browser || window).cancelAnimationFrame(this.resizeFrame);
    this.resizeFrame = 0;
    this.spines.forEach((spine) => spine.remove());
    this.spines = [];
    this.context?.cards.forEach((pane) => { pane.classList.remove('collapsed'); pane.style.removeProperty('left'); });
    if (this.context) delete this.context.track.dataset.deckLayout;
    this.context = null;
    this.browser = null;
  }

  private buildSpines(context: DeckTransportContext): void {
    const doc = context.track.ownerDocument;
    context.cards.forEach((pane, index) => {
      if (pane.querySelector('.reading-deck-spine')) return;
      const heading = pane.querySelector('h2, h3');
      const spine = doc.createElement('button');
      spine.type = 'button';
      spine.className = 'reading-deck-spine';
      spine.textContent = heading?.textContent?.trim() || `Section ${index + 1}`;
      spine.setAttribute('aria-label', `Jump to ${spine.textContent}`);
      spine.addEventListener('click', () => context.requestSelect?.(index), { signal: this.abort!.signal });
      pane.prepend(spine);
      this.spines.push(spine);
    });
  }

  private syncFromScroll(): void {
    const context = this.context;
    if (!context) return;
    // Nearest expanded pane to the left edge becomes selected.
    const edge = context.track.scrollLeft + SPINE_WIDTH * this.spines.length;
    let nearest = context.selectedIndex();
    let distance = Number.POSITIVE_INFINITY;
    context.cards.forEach((pane, index) => {
      const d = Math.abs(pane.offsetLeft - edge);
      if (d < distance) { distance = d; nearest = index; }
    });
    if (nearest !== context.selectedIndex()) context.reportSettled(nearest);
  }
}

export function createDesktopPanesTransport(): DeckTransport {
  return new DesktopPanesTransport();
}
```

- [ ] **Step 4:** Wire selection in `session.replaceTransport` — Deep read on desktop uses panes; everything else unchanged:

```ts
  private replaceTransport(mobile: boolean): void {
    const model = this.feedCache.get(this.feed);
    if (!model) return;
    this.transport?.destroy();
    this.transport = mobile
      ? createMobileScrollSnapTransport({ onSettledHaptic: () => this.tick() })
      : this.feed === 'slides'
        ? createDesktopPanesTransport()
        : createDesktopTransformTransport();
    this.transport.connect(this.transportContext(model, mobile));
    this.place(false);
  }
```
Add the import at the top of `session.ts`:

```ts
import { createDesktopPanesTransport } from './transports/desktop-panes';
```

- [ ] **Step 5:** `pnpm exec astro check` → 0 errors.

---

### Task 6: Panes CSS (layout, spine, collapsed, mobile)

**Files:**
- Modify: `src/styles/reading-deck.css` (add a panes-layout section; scope by `[data-deck-layout="panes"]`)

- [ ] **Step 1:** Add the panes layout. Scoped to `.reading-deck-track[data-deck-layout="panes"]` so the deck (tldr) is untouched. Overrides the transform-centering with native horizontal scroll, full-opacity panes, and collapse-to-spine:

```css
/* Deep read — sliding panes (across headings). Scoped so TLDR deck is unaffected. */
.reading-deck-track[data-deck-layout="panes"] {
  display: flex;
  flex-direction: row;
  gap: 0;
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  transform: none !important;
  transition: none;
  scrollbar-width: none;
}
.reading-deck-track[data-deck-layout="panes"]::-webkit-scrollbar { display: none; }

.reading-deck-track[data-deck-layout="panes"] > .reading-deck-card {
  position: sticky;
  flex: 0 0 auto;
  width: min(40rem, 92vw);
  max-width: min(40rem, 92vw);
  height: 100%;
  opacity: 1 !important;
  transform: none !important;
  border-left: 1px solid rgb(var(--color-primary-200));
  transition: width 320ms cubic-bezier(0.19, 1, 0.22, 1);
}
.reading-deck-track[data-deck-layout="panes"] > .reading-deck-card:first-of-type { border-left: 0; }

.reading-deck-track[data-deck-layout="panes"] > .reading-deck-card.collapsed {
  width: 2.5rem;
  min-width: 2.5rem;
  overflow: hidden;
  z-index: 6;
}
.reading-deck-track[data-deck-layout="panes"] > .reading-deck-card.collapsed > :not(.reading-deck-spine) {
  opacity: 0;
  pointer-events: none;
}

.reading-deck-spine {
  display: none;
  position: absolute;
  inset: 0;
  writing-mode: vertical-rl;
  width: 2.5rem;
  padding: 0.75rem 0;
  border: 0;
  background: rgb(var(--color-primary-100));
  color: rgb(var(--color-primary-700));
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}
.reading-deck-card.collapsed .reading-deck-spine { display: block; }
.reading-deck-spine:hover { background: rgb(var(--color-highlight-500) / 0.14); }

.dark .reading-deck-track[data-deck-layout="panes"] > .reading-deck-card { border-left-color: rgb(var(--color-primary-800)); }
.dark .reading-deck-spine { background: rgb(var(--color-primary-800)); color: rgb(var(--color-primary-200)); }
```

- [ ] **Step 2:** Mobile — one full-width pane, no spine, native scroll-snap (reuses the mobile transport). Inside the existing `@media (max-width: 720px)` block:

```css
  .reading-deck-track[data-deck-layout="panes"] {
    scroll-snap-type: x mandatory;
    transform: none !important;
  }
  .reading-deck-track[data-deck-layout="panes"] > .reading-deck-card {
    position: static;
    width: calc(100% - 1rem);
    max-width: calc(100% - 1rem);
    scroll-snap-align: center;
  }
  .reading-deck-track[data-deck-layout="panes"] > .reading-deck-card.collapsed {
    width: calc(100% - 1rem);
    min-width: 0;
  }
  .reading-deck-spine { display: none !important; }
```

- [ ] **Step 3:** Reduced motion — zero the pane width transition. Add to the `prefers-reduced-motion` block:

```css
  .reading-deck-track[data-deck-layout="panes"] > .reading-deck-card { transition: none; }
```

- [ ] **Step 4:** `pnpm exec astro check` → 0 errors, then `pnpm exec astro build` → succeeds. Manual sanity via built HTML: a post's Deep read track carries `data-deck-layout="panes"` when opened (verified at runtime, not build — note in report).

---

### Task 7: Homepage embedded live demo

**Files:**
- Modify: `src/components/DeckDemo.astro` → repurpose as the embedded live panes demo (real CSS + real transport + dummy cards), or replace with `src/components/PanesDemo.astro`
- Modify: `src/pages/index.astro` (copy tweak; mount unchanged position)

**Interfaces:**
- Consumes: `createDesktopPanesTransport` and the panes CSS from Tasks 5–6; the `DeckTransportContext` shape.

- [ ] **Step 1:** Replace the CTA-only body of `DeckDemo.astro` with a bounded, inline `.reading-deck-stage` + `.reading-deck-track[data-deck-layout="panes"]` containing 3–4 dummy `.reading-deck-card` sections of teaching copy (hand-written; NOT from `src/content`). Keep the `{enabled && ...}` config gate and `data-pagefind-ignore`.

- [ ] **Step 2:** Add a small client script (in the component, gated so it only runs where the demo exists) that constructs a real `DesktopPanesTransport`, feeds it a minimal context (`stage`, `track`, the dummy cards, a local `selectedIndex` closure, `requestMove`/`requestSelect` updating that index and calling `present`), and calls `present(0, 'none')`. Re-init on Swup `page:view` (per CLAUDE.md rule 3). Bound height (e.g. `height: 26rem`) so it sits inline in the showcase.

```ts
// src/components/DeckDemo.astro <script>
import { createDesktopPanesTransport } from '@/scripts/reading-deck/transports/desktop-panes';

function initDeckDemo() {
  const stage = document.querySelector<HTMLElement>('[data-deck-demo-stage]');
  const track = stage?.querySelector<HTMLElement>('[data-deck-demo-track]');
  if (!stage || !track || track.dataset.demoReady) return;
  track.dataset.demoReady = 'true';
  const cards = Array.from(track.querySelectorAll<HTMLElement>('.reading-deck-card'));
  let current = 0;
  const transport = createDesktopPanesTransport();
  const ctx = {
    stage, track, cards,
    selectedIndex: () => current,
    reducedMotion: () => matchMedia('(prefers-reduced-motion: reduce)').matches,
    interactionEnabled: () => true,
    requestMove: (delta: -1 | 1) => { current = Math.max(0, Math.min(cards.length - 1, current + delta)); transport.present(current, 'animate'); },
    requestSelect: (index: number) => { current = index; transport.present(current, 'animate'); },
    reportSettled: (index: number) => { current = index; },
    dismissHint: () => {},
  };
  transport.connect(ctx);
  transport.present(0, 'none');
}
document.addEventListener('DOMContentLoaded', initDeckDemo);
document.addEventListener('swup:page:view', initDeckDemo);
```

- [ ] **Step 3:** In `index.astro`, adjust the demo copy away from "as a deck" toward "across headings / sliding panes." (The mount position — below "Built for close reading" — stays.)

- [ ] **Step 4:** `pnpm exec astro check` → 0 errors; `pnpm exec astro build` → succeeds; grep built `dist/index.html` for `data-deck-layout="panes"` and a demo card heading.

---

### Task 8: Full verification + commit

- [ ] **Step 1:** `pnpm exec astro check` → 0 errors.
- [ ] **Step 2:** `pnpm exec astro build` → succeeds (≈1532 pages).
- [ ] **Step 3:** Grep sanity: `grep -rn "reading-deck-scroll-breathe\|Quick read" src/` returns nothing; `desktop-panes` imported in `session.ts` and the demo.
- [ ] **Step 4:** Commit as fayzabdul:

```bash
git add -A -- ':!src/content'
git -c user.name=fayzabdul -c user.email=mail.zubayrali@gmail.com commit -m "feat: sliding-panes Deep read + calmed TLDR view; fix scroll cue and note popover"
```

## Fallbacks / notes

- If the sticky-spine stacking reads poorly without a browser to tune, degrade collapsed panes to non-sticky inline 40px spines (drop `position: sticky` + `style.left`); the clickable breadcrumb still works.
- Homepage demo: if the real transport proves too coupled in practice, keep the real panes CSS with a thinner inline script — still "looks real" per the design decision.
- Pane width `min(40rem, 92vw)` is the agreed starting value (spec O3); switch to fixed 620px only if measure reads poorly.

## Self-review

- **Spec coverage:** mode split (T1,T5,T6) ✓; calm deck B (T2) ✓; sliding panes + collapse-to-spine + responsive + mobile (T5,T6) ✓; scroll cue (T3) ✓; note popover parity + close-on-scroll + glyph (T4) ✓; homepage live demo (T7) ✓; naming (T1) ✓; O1 requestSelect (T5) ✓; O2 panes-demo-first (T7) ✓; O3 width (T6) ✓.
- **Placeholders:** none except the Task-4 Step-3 glyph selector, which is a genuine live-DOM investigation with the fix pattern given.
- **Type consistency:** `createDesktopPanesTransport`, `requestSelect`, `data-deck-layout="panes"`, `.reading-deck-spine`, `.collapsed` used consistently across T5–T7.
