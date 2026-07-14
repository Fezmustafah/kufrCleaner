# Reading Deck Modularization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the approved Reading Deck experience while replacing the monolithic browser controller with a small lifecycle seam backed by independently testable Feed, State, View, History, Viewport, Session, and desktop/mobile transport modules.

**Architecture:** `reading-deck-client.ts` remains the Swup-compatible entry point and delegates to `attachReadingDeck()`. One session translates browser events into semantic intents, one pure state transition owns navigation policy, one deep Feed compiler owns article-to-Card interpretation, and two transport adapters own desktop transforms versus mobile scroll snap. History and visual viewport access are isolated behind small adapters; the homepage preview stays independent.

**Tech Stack:** Astro 6.1.2, TypeScript 5.9, Vitest, happy-dom, Playwright Chromium/WebKit, native `<dialog>`, CSS, Swup, `web-haptics`, pnpm.

---

## Required reading and guardrails

- Read `CLAUDE.md`, the repository `AGENTS.md`, `CONTEXT.md`, `docs/adr/0001-reading-deck-is-an-article-view.md`, and `docs/superpowers/specs/2026-07-14-reading-deck-modularization-design.md` before editing.
- Treat the six current working-tree files as approved baseline work. Do not discard or rewrite them before checkpointing them.
- Do not edit `src/content/**`; it is a git submodule.
- Preserve current Reading Deck selectors, data attributes, hash formats, local-storage keys, light/dark tokens, Swup initialization, and homepage preview behavior.
- Apply the correction policy from the approved spec: preserve specified behavior, fix direct specification contradictions, and record subjective questions instead of redesigning them.
- Use `apply_patch` for source edits. Do not use destructive Git commands.
- Keep production logging behind `import.meta.env.DEV`.
- Run the applicable test after every red/green step and commit after every task.
- Invoke `requesting-code-review` after Tasks 3, 6, 9, 11, and 12. Resolve Critical and Important findings before continuing.

## Target file map

### Production files

- Modify `src/scripts/reading-deck-client.ts` — compatibility-only Swup/Astro lifecycle entry.
- Create `src/scripts/reading-deck/index.ts` — public `attachReadingDeck()` seam and dependency defaults.
- Create `src/scripts/reading-deck/types.ts` — private shared domain types used by more than one deep module.
- Create `src/scripts/reading-deck/feed.ts` — rendered-article-to-Reading-Feed compilation.
- Create `src/scripts/reading-deck/state.ts` — pure navigation state and transition policy.
- Create `src/scripts/reading-deck/history.ts` — location codec and browser/test history adapters.
- Create `src/scripts/reading-deck/viewport.ts` — viewport/media-query production and test adapters.
- Create `src/scripts/reading-deck/view.ts` — required DOM contract, Card rendering, overlays, focus, and controls.
- Create `src/scripts/reading-deck/session.ts` — lifetime, event-to-intent orchestration, persistence, and effects.
- Create `src/scripts/reading-deck/transports/transport.ts` — internal transport contract.
- Create `src/scripts/reading-deck/transports/desktop-transform.ts` — desktop measurement, transforms, pointer, and trackpad.
- Create `src/scripts/reading-deck/transports/mobile-scroll-snap.ts` — mobile native scrolling, settlement, and swipe haptics.
- Modify `src/styles/reading-deck.css` — preserve appearance while consolidating the cascade after behavior is stable.
- Modify `package.json` and `pnpm-lock.yaml` — add explicit test scripts and dependencies.
- Create `vitest.config.ts` — happy-dom unit/attached-session configuration.
- Create `playwright.config.ts` — desktop Chromium and mobile WebKit projects.

### Test files

- Create `tests/helpers/reading-deck-fixture.ts` — production-selector DOM fixture and deterministic test doubles.
- Create `tests/unit/reading-deck/feed.test.ts` — Feed characterization and compilation tests.
- Create `tests/unit/reading-deck/state.test.ts` — pure transition tests.
- Create `tests/unit/reading-deck/history.test.ts` — location codec and history semantics.
- Create `tests/unit/reading-deck/viewport.test.ts` — media-query/visual-viewport behavior.
- Create `tests/unit/reading-deck/session.test.ts` — attachment, actions, overlays, persistence, haptics, and teardown.
- Create `tests/unit/reading-deck/desktop-transform.test.ts` — desktop adapter intent/presentation tests.
- Create `tests/unit/reading-deck/mobile-scroll-snap.test.ts` — deterministic settlement and programmatic-scroll tests.
- Create `tests/e2e/reading-deck.spec.ts` — Chromium/WebKit behavior coverage.
- Create `tests/e2e/reading-deck.visual.spec.ts` — representative visual regression snapshots.

## Task 1: Checkpoint the approved working-tree baseline

**Files:**
- Existing: `src/components/PlatformShowcase.astro`
- Existing: `src/pages/index.astro`
- Existing: `src/scripts/homepage-hero-client.ts`
- Existing: `src/components/ReadingDeck.astro`
- Existing: `src/scripts/reading-deck-client.ts`
- Existing: `src/styles/reading-deck.css`

- [ ] **Step 1: Confirm the expected dirty-file boundary**

Run:

```bash
git status --short
git diff --check
```

Expected: exactly the six files listed above are modified and `git diff --check` prints nothing. If another file is dirty, preserve it and exclude it from all task commits.

- [ ] **Step 2: Record the pre-refactor verification baseline**

Run:

```bash
pnpm build
pnpm exec astro check
```

Expected: the production build exits 0. Record the exact Astro-check error and warning counts in the execution notes; existing failures are allowed, but later runs must not add new failures.

- [ ] **Step 3: Commit the independent homepage preview**

```bash
git add src/components/PlatformShowcase.astro src/pages/index.astro src/scripts/homepage-hero-client.ts
git commit -m "feat: showcase reading decks on the homepage"
```

Expected: the commit contains no production Reading Deck runtime or stylesheet file.

- [ ] **Step 4: Commit the approved Reading Deck behavior baseline**

```bash
git add src/components/ReadingDeck.astro src/scripts/reading-deck-client.ts src/styles/reading-deck.css
git commit -m "fix: stabilize reading deck mobile interactions"
```

Expected: `git status --short` is empty except for unrelated user files discovered in Step 1.

## Task 2: Install the test harness

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `tests/helpers/reading-deck-fixture.ts`
- Create: `tests/unit/reading-deck/harness.test.ts`

- [ ] **Step 1: Add the test dependencies**

Run:

```bash
pnpm add -D vitest happy-dom @playwright/test
```

Expected: `package.json` and `pnpm-lock.yaml` change, and pnpm exits 0.

- [ ] **Step 2: Replace the placeholder scripts**

Update the `scripts` object in `package.json` with these entries, preserving every existing script:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

- [ ] **Step 3: Add the Vitest configuration**

Create `vitest.config.ts`:

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/unit/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
});
```

- [ ] **Step 4: Add the Playwright configuration**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4321';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'pnpm exec astro dev --host 127.0.0.1 --port 4321',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone 13'] },
    },
  ],
});
```

- [ ] **Step 5: Add one production-selector fixture**

Create `tests/helpers/reading-deck-fixture.ts` with `installReadingDeckFixture()` returning the dialog, article source, TLDR template, open buttons, mutable history test double, viewport test double, and haptic spy. Use the exact required selectors from `ReadingDeck.astro`; the fixture must include:

```ts
export const PILOT_POST_ID =
  'does-the-prophet-speak-only-by-revelation-refuting-the-alleged-contradiction-in-an-najm-53-34';

export function requiredDeckMarkup(): string {
  return `
    <button data-deck-open="tldr">Quick read</button>
    <button data-deck-open="slides">Deep read</button>
    <article data-deck-article-source>
      <p id="introduction">Introduction copy.</p>
      <h2 id="first-heading">First heading</h2>
      <p>First section body.</p>
      <h2 id="sources">Sources</h2>
      <ol><li id="source-1">A source.</li></ol>
    </article>
    <template data-deck-tldr-source>
      <h2 id="quick-heading">Quick heading</h2><p>Quick body.</p>
    </template>
    <dialog data-reading-deck data-post-id="${PILOT_POST_ID}" data-post-title="Pilot"
      data-has-slides="true" data-has-tldr="true">
      <div class="reading-deck-shell">
        <button data-deck-close>Article</button>
        <button data-deck-feed="tldr">Quick read</button>
        <button data-deck-feed="slides">Deep read</button>
        <button data-deck-search>Search</button>
        <button data-deck-menu>Menu</button>
        <div data-deck-progress></div>
        <span data-deck-status></span>
        <span data-deck-position></span>
        <span data-deck-card-title></span>
        <span data-deck-mode-label></span>
        <button data-deck-prev>Previous</button>
        <button data-deck-index-open>Contents</button>
        <button data-deck-next>Next</button>
        <div data-deck-stage><div data-deck-track></div></div>
        <div data-deck-index hidden><button data-deck-index-close>Close</button><ol data-deck-index-list></ol></div>
        <div data-deck-source-panel hidden><button data-deck-source-close>Close</button><div data-deck-source-content></div></div>
        <div data-deck-image-panel hidden><button data-deck-image-close>Close</button><img data-deck-image alt="" /></div>
        <div data-deck-scroll-shadow hidden></div>
        <div data-deck-swipe-hint hidden></div>
        <section data-deck-finish hidden>
          <h2 data-deck-finish-title></h2><p data-deck-finish-copy></p>
          <button data-deck-finish-primary><span data-deck-finish-primary-label></span></button>
        </section>
      </div>
    </dialog>`;
}
```

Implement `HTMLDialogElement.prototype.show`, `showModal`, and `close` in the fixture when happy-dom does not provide them, and reset `document.body` after each test.

- [ ] **Step 6: Write and run the harness smoke test**

Create `tests/unit/reading-deck/harness.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { requiredDeckMarkup } from '../../helpers/reading-deck-fixture';

describe('reading deck test harness', () => {
  afterEach(() => document.body.replaceChildren());

  it('renders the production DOM contract', () => {
    document.body.innerHTML = requiredDeckMarkup();
    expect(document.querySelector('dialog[data-reading-deck]')).toBeInstanceOf(HTMLDialogElement);
    expect(document.querySelector('[data-deck-track]')).toBeInstanceOf(HTMLElement);
    expect(document.querySelectorAll('[data-deck-open]')).toHaveLength(2);
  });
});
```

Run:

```bash
pnpm test -- tests/unit/reading-deck/harness.test.ts
```

Expected: one passing test.

- [ ] **Step 7: Install browser binaries and commit**

Run:

```bash
pnpm exec playwright install chromium webkit
git add package.json pnpm-lock.yaml vitest.config.ts playwright.config.ts tests/helpers/reading-deck-fixture.ts tests/unit/reading-deck/harness.test.ts
git commit -m "test: add reading deck test harness"
```

Expected: browser installation exits 0 and the commit contains only harness/dependency changes.

## Task 3: Add the lifecycle seam and characterize the existing session

**Files:**
- Create: `src/scripts/reading-deck/index.ts`
- Modify: `src/scripts/reading-deck-client.ts`
- Create: `tests/unit/reading-deck/session.test.ts`

- [ ] **Step 1: Write failing attachment tests**

Add tests that dynamically import the lifecycle module after installing the fixture:

```ts
it('returns null when the page has no Reading Deck', () => {
  expect(attachReadingDeck(document)).toBeNull();
});

it('attaches once and destroys idempotently', () => {
  document.body.innerHTML = requiredDeckMarkup();
  const first = attachReadingDeck(document);
  expect(first).not.toBeNull();
  first?.destroy();
  expect(() => first?.destroy()).not.toThrow();
  expect(document.body.classList.contains('reading-deck-open')).toBe(false);
});

it('rejects malformed deck markup without changing page state', () => {
  document.body.innerHTML = '<dialog data-reading-deck></dialog>';
  expect(attachReadingDeck(document)).toBeNull();
  expect(document.documentElement.classList.contains('reading-deck-ready')).toBe(false);
});
```

Run:

```bash
pnpm test -- tests/unit/reading-deck/session.test.ts
```

Expected: FAIL because `attachReadingDeck` does not exist.

- [ ] **Step 2: Introduce the compatibility interface without moving algorithms**

Create `src/scripts/reading-deck/index.ts`:

```ts
export interface ReadingDeckHandle {
  destroy(): void;
}

export type ReadingDeckFactory = (dialog: HTMLDialogElement) => ReadingDeckHandle;

export function attachReadingDeck(
  root: Document = document,
  create: ReadingDeckFactory,
): ReadingDeckHandle | null {
  const dialog = root.querySelector<HTMLDialogElement>('dialog[data-reading-deck]');
  if (!dialog) return null;
  try {
    return create(dialog);
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[reading-deck]', error);
    return null;
  }
}
```

Export the existing controller creation from `reading-deck-client.ts` temporarily and change initialization to:

```ts
import { attachReadingDeck, type ReadingDeckHandle } from './reading-deck';

let activeDeck: ReadingDeckHandle | null = null;

function initializeReadingDeck(): void {
  activeDeck?.destroy();
  activeDeck = attachReadingDeck(document, (dialog) => new ReadingDeckController(dialog));
  document.documentElement.classList.toggle('reading-deck-ready', activeDeck !== null);
  if (!activeDeck) document.body.classList.remove('reading-deck-open');
}
```

Do not change the controller body in this step.

- [ ] **Step 3: Characterize externally visible behavior through the lifecycle**

Extend `session.test.ts` with fixture-level tests for:

```ts
it.each([
  ['#slides', 'slides', 0],
  ['#slides-2', 'slides', 2],
  ['#tldr-1', 'tldr', 1],
  ['#deck-slides-2-first-heading', 'slides', 1],
])('restores %s as feed %s card %i', async (hash, feed, index) => {
  installReadingDeckFixture({ hash });
  const handle = attachForTest();
  await flushDeckFrames();
  const dialog = document.querySelector<HTMLDialogElement>('dialog[data-reading-deck]')!;
  expect(dialog.dataset.activeFeed).toBe(feed);
  expect(activeCardIndex(dialog)).toBe(index);
  handle?.destroy();
});
```

Add explicit tests for open button, close button, Previous/Next, Feed switching with independent positions, Contents selection, progress selection, Sources then explicit Completion, browser location synchronization, source/marginalia outside-click dismissal, image close, focus restoration, storage key compatibility, and repeated initialization leaving one handler. Use fake timers for settlement and stub `WebHaptics.trigger` to assert one best-effort selection request per committed navigation.

- [ ] **Step 4: Run the characterization suite and document contradictions**

Run:

```bash
pnpm test -- tests/unit/reading-deck/session.test.ts
```

Expected: all characterization tests pass. If current behavior contradicts an approved spec, change the expectation to the approved behavior and record the failing test name in the commit message body before fixing it. Do not change subjective behavior.

- [ ] **Step 5: Run verification, request review, and commit**

Run:

```bash
pnpm test
pnpm build
git add src/scripts/reading-deck/index.ts src/scripts/reading-deck-client.ts tests/unit/reading-deck/session.test.ts
git commit -m "refactor: add reading deck attachment seam"
```

Expected: tests and build exit 0. Request code review for the test harness and lifecycle seam using the approved spec and the Git range from Task 2's commit through this commit. Resolve all Critical and Important findings.

## Task 4: Extract the deep Feed compiler

**Files:**
- Create: `src/scripts/reading-deck/types.ts`
- Create: `src/scripts/reading-deck/feed.ts`
- Modify: `src/scripts/reading-deck-client.ts`
- Create: `tests/unit/reading-deck/feed.test.ts`

- [ ] **Step 1: Define the shared private domain types**

Create `src/scripts/reading-deck/types.ts`:

```ts
export type FeedKind = 'slides' | 'tldr';

export interface DeckCard {
  element: HTMLElement;
  title: string;
  isCover?: boolean;
  isTerminal?: boolean;
}

export interface CompiledReadingFeed {
  cards: DeckCard[];
  sources: Map<string, HTMLElement>;
  minutes: number;
}

export interface FeedAvailability {
  slides: boolean;
  tldr: boolean;
}
```

- [ ] **Step 2: Write failing Feed compilation tests**

Create `tests/unit/reading-deck/feed.test.ts` with DOM-driven cases for cover-first ordering, introduction grouping, H2 grouping, H3/safe-block chunking, generated TOC omission, Sources-last ordering, empty-source fallback, word-rate minutes, repeated compilation, ID namespacing, local fragment rewriting, heading share links, footnote/citation registration, marginalia registration, and zoomable-image decoration.

The first test must assert the public shape:

```ts
it('compiles a Deep Read with cover, body cards, and final Sources card', () => {
  const source = document.createElement('article');
  source.innerHTML = `
    <p>Introduction.</p>
    <h2 id="claim">Claim</h2><p>Body.</p>
    <h2>Sources</h2><ol><li id="fn-1">Reference.</li></ol>`;

  const feed = compileReadingFeed(source, {
    kind: 'slides',
    title: 'Pilot article',
    description: 'Pilot description',
    banner: '/pilot.webp',
    citationTemplate: null,
  });

  expect(feed.cards[0]).toMatchObject({ title: 'Cover', isCover: true });
  expect(feed.cards.at(-1)?.title).toBe('Sources');
  expect(feed.cards.at(-1)?.isTerminal).not.toBe(true);
  expect(source.querySelector('#claim')).not.toBeNull();
});
```

Run:

```bash
pnpm test -- tests/unit/reading-deck/feed.test.ts
```

Expected: FAIL because `compileReadingFeed` does not exist.

- [ ] **Step 3: Implement the Feed interface and move the existing interpretation rules**

Create `src/scripts/reading-deck/feed.ts` with this interface:

```ts
import type { CompiledReadingFeed, DeckCard, FeedKind } from './types';

export interface CompileReadingFeedOptions {
  kind: FeedKind;
  title: string;
  description: string;
  banner: string | null;
  citationTemplate: HTMLTemplateElement | null;
}

export function compileReadingFeed(
  renderedSource: HTMLElement,
  options: CompileReadingFeedOptions,
): CompiledReadingFeed {
  const source = renderedSource.cloneNode(true) as HTMLElement;
  const sources = new Map<string, HTMLElement>();
  const minutes = Math.max(
    1,
    Math.ceil(textWords(source.textContent ?? '') / (options.kind === 'tldr' ? 240 : 210)),
  );
  cleanSource(source);
  const sourceSections = detachSourceSections(source, options.citationTemplate, sources);
  const groups = groupSourceNodes(source);
  const cards: DeckCard[] = [createCoverCard(options, minutes)];
  appendContentCards(cards, groups, options.kind);
  appendSourcesCard(cards, sourceSections);
  namespaceCards(cards, options.kind, sources);
  return { cards, sources, minutes };
}
```

Move `textWords`, `cleanHeading`, `meaningfulNode`, `createCoverCard`, `groupSourceNodes`, `chunkGroup`, and `namespaceCard` from the controller into private functions in this module. Preserve their bodies and constants exactly first. Move only source selection out of the compiler: the session supplies the canonical rendered article clone or TLDR template clone. Confirm that compilation never mutates `renderedSource`.

- [ ] **Step 4: Route the controller through `compileReadingFeed`**

Replace `buildFeed()` with a call shaped as:

```ts
private buildFeed(feed: FeedKind): CompiledReadingFeed {
  return compileReadingFeed(this.sourceFor(feed), {
    kind: feed,
    title: this.dialog.dataset.postTitle || document.title,
    description: this.dialog.dataset.postDescription || '',
    banner: this.dialog.dataset.postBanner || null,
    citationTemplate: document.querySelector('template[data-deck-citation-template]'),
  });
}
```

Delete only the Feed algorithms that now live in `feed.ts`; keep controller behavior otherwise unchanged.

- [ ] **Step 5: Run focused and integration tests**

Run:

```bash
pnpm test -- tests/unit/reading-deck/feed.test.ts tests/unit/reading-deck/session.test.ts
pnpm build
```

Expected: all tests and build pass, with the same Card counts, titles, IDs, hashes, sources, and minutes as the characterization baseline.

- [ ] **Step 6: Commit**

```bash
git add src/scripts/reading-deck/types.ts src/scripts/reading-deck/feed.ts src/scripts/reading-deck-client.ts tests/unit/reading-deck/feed.test.ts
git commit -m "refactor: extract reading feed compiler"
```

## Task 5: Introduce pure Reading Deck state

**Files:**
- Create: `src/scripts/reading-deck/state.ts`
- Modify: `src/scripts/reading-deck-client.ts`
- Create: `tests/unit/reading-deck/state.test.ts`

- [ ] **Step 1: Write the pure state contract and failing tests**

Create `tests/unit/reading-deck/state.test.ts` around these exported private-module types:

```ts
import { createDeckState, transition } from '@/scripts/reading-deck/state';

const feeds = { slides: 7, tldr: 5 } as const;

it('keeps independent positions while switching Feeds', () => {
  let state = createDeckState('slides');
  state = transition(state, { type: 'OPEN', feed: 'slides', index: 3 }, feeds).state;
  state = transition(state, { type: 'SWITCH_FEED', feed: 'tldr' }, feeds).state;
  state = transition(state, { type: 'SELECT_CARD', index: 2 }, feeds).state;
  state = transition(state, { type: 'SWITCH_FEED', feed: 'slides' }, feeds).state;
  expect(state.current).toBe(3);
  expect(state.positions).toEqual({ slides: 3, tldr: 2 });
});

it('enters Completion only by moving forward beyond Sources', () => {
  const atSources = createDeckState('slides', { slides: 6 });
  const result = transition(atSources, { type: 'MOVE', delta: 1 }, feeds);
  expect(result.state.finished).toBe(true);
  expect(result.state.current).toBe(6);
});
```

Add tests for opening, closing, clamping, unsupported Feed requests, selection, direct-location restoration, restart, resume, moving backward from Completion, Feed switches, and preserving Sources as the final counted Card.

Run:

```bash
pnpm test -- tests/unit/reading-deck/state.test.ts
```

Expected: FAIL because the State module does not exist.

- [ ] **Step 2: Implement deterministic transitions**

Create `src/scripts/reading-deck/state.ts`:

```ts
import type { FeedKind } from './types';

export interface DeckState {
  open: boolean;
  feed: FeedKind;
  current: number;
  positions: Partial<Record<FeedKind, number>>;
  finished: boolean;
}

export type DeckIntent =
  | { type: 'OPEN'; feed: FeedKind; index?: number | null }
  | { type: 'CLOSE' }
  | { type: 'MOVE'; delta: -1 | 1 }
  | { type: 'SELECT_CARD'; index: number }
  | { type: 'SWITCH_FEED'; feed: FeedKind }
  | { type: 'RESTART' }
  | { type: 'RESUME' }
  | { type: 'DISMISS_COMPLETION' };

export interface DeckEffects {
  feedChanged: boolean;
  cardChanged: boolean;
  completionChanged: boolean;
}

export interface DeckTransition {
  state: DeckState;
  effects: DeckEffects;
}

export type FeedLengths = Partial<Record<FeedKind, number>>;

export function createDeckState(
  feed: FeedKind = 'slides',
  positions: Partial<Record<FeedKind, number>> = {},
): DeckState {
  const current = positions[feed] ?? 0;
  return { open: false, feed, current, positions: { ...positions, [feed]: current }, finished: false };
}

export function transition(state: DeckState, intent: DeckIntent, feeds: FeedLengths): DeckTransition {
  const previous = state;
  const next = reduceIntent(state, intent, feeds);
  return {
    state: next,
    effects: {
      feedChanged: next.feed !== previous.feed,
      cardChanged: next.feed !== previous.feed || next.current !== previous.current,
      completionChanged: next.finished !== previous.finished,
    },
  };
}
```

Implement `reduceIntent()` with immutable state, `Math.trunc()` plus clamping, Feed availability from positive lengths, independent position writes, and explicit Sources-to-Completion behavior. Invalid/unsupported intents return the same semantic state.

- [ ] **Step 3: Route every controller input through one dispatch method**

Add a controller method:

```ts
private dispatch(intent: DeckIntent, options: DispatchOptions = {}): void {
  const lengths = Object.fromEntries(
    Array.from(this.feedCache, ([kind, model]) => [kind, model.cards.length]),
  ) as FeedLengths;
  const result = transition(this.state, intent, lengths);
  this.state = result.state;
  this.commitTransition(result, options);
}
```

Replace independent mutations from buttons, keyboard, Contents, progress, neighboring Card clicks, pointer gestures, trackpad, mobile settlement, restart, Feed switching, and location sync with semantic intents. `commitTransition()` must render once and ask the current transport/presentation path to present once.

- [ ] **Step 4: Run state, session, and Feed tests**

Run:

```bash
pnpm test -- tests/unit/reading-deck/state.test.ts tests/unit/reading-deck/session.test.ts tests/unit/reading-deck/feed.test.ts
pnpm build
```

Expected: all pass. Haptic assertions must still show one request per committed transition, not one per raw browser event.

- [ ] **Step 5: Commit**

```bash
git add src/scripts/reading-deck/state.ts src/scripts/reading-deck-client.ts tests/unit/reading-deck/state.test.ts
git commit -m "refactor: centralize reading deck state transitions"
```

## Task 6: Extract history and viewport adapters

**Files:**
- Create: `src/scripts/reading-deck/history.ts`
- Create: `src/scripts/reading-deck/viewport.ts`
- Modify: `src/scripts/reading-deck-client.ts`
- Create: `tests/unit/reading-deck/history.test.ts`
- Create: `tests/unit/reading-deck/viewport.test.ts`

- [ ] **Step 1: Write location codec tests**

Create `history.test.ts` with this compatibility table:

```ts
it.each([
  ['#slides', { feed: 'slides', index: null, targetId: null }],
  ['#tldr', { feed: 'tldr', index: null, targetId: null }],
  ['#slides-0', { feed: 'slides', index: 0, targetId: null }],
  ['#tldr-3', { feed: 'tldr', index: 3, targetId: null }],
  ['#deck-slides-5-first-type', { feed: 'slides', index: 4, targetId: 'deck-slides-5-first-type' }],
])('parses %s', (hash, expected) => {
  expect(parseDeckLocation(hash)).toEqual(expected);
});

it('formats a zero-based Card hash without changing pathname or query', () => {
  expect(formatDeckHash('slides', 2)).toBe('#slides-2');
});
```

Add browser-adapter tests for push, replace, close-via-back when the `readingDeck` marker is present, replace-to-article when it is absent, absolute share URLs, and popstate/hashchange subscription disposal.

- [ ] **Step 2: Implement history ownership**

Create `src/scripts/reading-deck/history.ts`:

```ts
import type { FeedKind } from './types';

export interface DeckLocation {
  feed: FeedKind;
  index: number | null;
  targetId: string | null;
}

export interface DeckHistory {
  read(): DeckLocation | null;
  push(feed: FeedKind, index: number): void;
  replace(feed: FeedKind, index: number, targetId?: string | null): void;
  close(): 'back' | 'replace';
  shareUrl(feed: FeedKind, index: number): string;
  subscribe(listener: () => void): () => void;
}

export function parseDeckLocation(hash: string): DeckLocation | null;
export function formatDeckHash(feed: FeedKind, index: number): string;
export function createBrowserDeckHistory(win: Window = window): DeckHistory;
```

Move both deck regexes, fragment decoding, `hashFor`, location reads, `pushState`, `replaceState`, `history.back()`, subscriptions, and share URL creation into this file. No other Reading Deck module may directly read or write `location.hash` or call History API methods after integration.

- [ ] **Step 3: Write viewport tests**

Create `viewport.test.ts`:

```ts
it('reports mobile and reduced-motion state from media queries', () => {
  const viewport = createTestDeckViewport({ mobile: true, reducedMotion: true });
  expect(viewport.snapshot()).toMatchObject({ mobile: true, reducedMotion: true });
});

it('applies visual viewport geometry to the dialog', () => {
  const dialog = document.createElement('dialog');
  applyViewportCss(dialog, { top: 12, left: 4, width: 390, height: 700 });
  expect(dialog.style.getPropertyValue('--deck-viewport-height')).toBe('700px');
});
```

- [ ] **Step 4: Implement the viewport adapter**

Create `src/scripts/reading-deck/viewport.ts`:

```ts
export interface DeckViewportSnapshot {
  mobile: boolean;
  reducedMotion: boolean;
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface DeckViewport {
  snapshot(): DeckViewportSnapshot;
  subscribe(listener: (snapshot: DeckViewportSnapshot) => void): () => void;
}

export function applyViewportCss(dialog: HTMLElement, snapshot: DeckViewportSnapshot): void {
  dialog.style.setProperty('--deck-viewport-top', `${snapshot.top}px`);
  dialog.style.setProperty('--deck-viewport-left', `${snapshot.left}px`);
  dialog.style.setProperty('--deck-viewport-width', `${snapshot.width}px`);
  dialog.style.setProperty('--deck-viewport-height', `${snapshot.height}px`);
}

export function createBrowserDeckViewport(win: Window = window): DeckViewport;
```

The browser adapter owns `(max-width: 720px)`, reduced motion, `window.resize`, and `visualViewport` resize/scroll subscriptions. Its cleanup removes every listener.

- [ ] **Step 5: Integrate both adapters and run verification**

Inject `DeckHistory` and `DeckViewport` into controller construction. Replace direct browser calls with adapter calls. Run:

```bash
pnpm test -- tests/unit/reading-deck/history.test.ts tests/unit/reading-deck/viewport.test.ts tests/unit/reading-deck/session.test.ts
pnpm build
```

Expected: all pass; a repository search inside `src/scripts/reading-deck*` finds History API and visual viewport access only in the new adapters.

- [ ] **Step 6: Commit and request review**

```bash
git add src/scripts/reading-deck/history.ts src/scripts/reading-deck/viewport.ts src/scripts/reading-deck-client.ts tests/unit/reading-deck/history.test.ts tests/unit/reading-deck/viewport.test.ts
git commit -m "refactor: isolate deck history and viewport behavior"
```

Request code review for Tasks 4–6 against the approved Feed/State/history/viewport requirements. Resolve Critical and Important findings.

## Task 7: Deepen the View module

**Files:**
- Create: `src/scripts/reading-deck/view.ts`
- Modify: `src/scripts/reading-deck-client.ts`
- Modify: `tests/unit/reading-deck/session.test.ts`

- [ ] **Step 1: Add failing DOM-contract and rendering tests**

Add tests that assert:

```ts
it('fails validation before mutating malformed markup', () => {
  const dialog = document.createElement('dialog');
  dialog.dataset.readingDeck = '';
  expect(() => ReadingDeckView.from(dialog)).toThrow('Reading deck is missing required elements');
  expect(document.body.classList.contains('reading-deck-open')).toBe(false);
});

it('exposes only the selected Card to interaction and accessibility', () => {
  const view = createFixtureView();
  view.renderCards(compiledFeed.cards);
  view.selectCard(1);
  expect(compiledFeed.cards[1].element.inert).toBe(false);
  expect(compiledFeed.cards[1].element.getAttribute('aria-hidden')).toBe('false');
  expect(compiledFeed.cards[0].element.inert).toBe(true);
  expect(compiledFeed.cards[0].element.getAttribute('aria-hidden')).toBe('true');
});
```

Add cases for control labels/disabled states, progress, Contents, Feed labels, focus entry/trapping/restoration, source/marginalia persistent popover and outside-click dismissal, image surface, overflow arrow ownership, Completion rendering, and closing all overlays during teardown.

- [ ] **Step 2: Implement one validated DOM holder**

Create `src/scripts/reading-deck/view.ts` with one class and no browser-history or navigation policy:

```ts
export class ReadingDeckView {
  static from(dialog: HTMLDialogElement): ReadingDeckView;
  readonly dialog: HTMLDialogElement;
  readonly shell: HTMLElement;
  readonly stage: HTMLElement;
  readonly track: HTMLElement;
  readonly finish: HTMLElement;

  open(): void;
  close(): void;
  renderFeed(feed: CompiledReadingFeed, kind: FeedKind): void;
  selectCard(index: number): void;
  renderCompletion(visible: boolean): void;
  renderNavigation(state: DeckState, feed: CompiledReadingFeed): void;
  openContents(trigger: HTMLElement): void;
  openSource(content: HTMLElement, trigger: HTMLElement): void;
  openMarginalia(content: HTMLElement, trigger: HTMLElement): void;
  openImage(source: HTMLImageElement): void;
  closeTopSurface(restoreFocus?: boolean): boolean;
  restoreHeading(targetId: string): void;
  bindCurrentCardOverflow(): void;
  destroy(): void;
}
```

Move required-element discovery, progress/Contents construction, ARIA/inert state, control rendering, focus logic, source/marginalia/image surfaces, heading restoration, per-Card scroll restoration, and the arrow-only overflow affordance into this class. Preserve existing selectors and class names.

- [ ] **Step 3: Replace controller element fields with `view` calls**

Construct the view before attaching any event listener:

```ts
this.view = ReadingDeckView.from(dialog);
```

Remove duplicated required-element fields from the controller. Keep event sequencing in the controller/session; keep DOM mutations in `ReadingDeckView`.

- [ ] **Step 4: Run attached-session and build verification**

Run:

```bash
pnpm test -- tests/unit/reading-deck/session.test.ts
pnpm build
```

Expected: all pass and selector markup in `ReadingDeck.astro` remains unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/scripts/reading-deck/view.ts src/scripts/reading-deck-client.ts tests/unit/reading-deck/session.test.ts
git commit -m "refactor: deepen reading deck view ownership"
```

## Task 8: Extract the desktop transport

**Files:**
- Create: `src/scripts/reading-deck/transports/transport.ts`
- Create: `src/scripts/reading-deck/transports/desktop-transform.ts`
- Modify: `src/scripts/reading-deck-client.ts`
- Create: `tests/unit/reading-deck/desktop-transform.test.ts`

- [ ] **Step 1: Define the private transport contract**

Create `transport.ts`:

```ts
export type DeckMotion = 'none' | 'animate';

export interface DeckTransportContext {
  stage: HTMLElement;
  track: HTMLElement;
  cards: HTMLElement[];
  selectedIndex(): number;
  reducedMotion(): boolean;
  requestMove(delta: -1 | 1): void;
  reportSettled(index: number): void;
  dismissHint(): void;
}

export interface DeckTransport {
  connect(context: DeckTransportContext): void;
  present(index: number, motion: DeckMotion): void;
  reflow(): void;
  destroy(): void;
}
```

- [ ] **Step 2: Write failing desktop adapter tests**

Test centering offsets, non-animated placement, reduced motion, reflow, pointer axis locking, 44px/0.35 velocity thresholds, edge resistance, selection cancellation, neighboring intent emission, horizontal trackpad accumulation, wheel lockout, and idempotent destroy.

Use assertions against the transport seam:

```ts
it('reports one forward intent after a committed horizontal drag', () => {
  const requestMove = vi.fn();
  const transport = createDesktopTransformTransport();
  transport.connect(createTransportContext({ requestMove }));
  dispatchPointerDrag(stage, { from: [300, 200], to: [230, 203], duration: 120 });
  expect(requestMove).toHaveBeenCalledTimes(1);
  expect(requestMove).toHaveBeenCalledWith(1);
});
```

- [ ] **Step 3: Implement the desktop adapter by moving the proven algorithms**

Create `desktop-transform.ts` exporting:

```ts
export function createDesktopTransformTransport(): DeckTransport {
  return new DesktopTransformTransport();
}
```

Move `measure`, desktop `place`, resize scheduling, pointer gesture arbitration, and trackpad accumulation from the controller. The adapter owns its own `AbortController`, offsets, animation frame, and wheel lock. It never reads Feed hashes, updates state, emits haptics, or renders overlays.

- [ ] **Step 4: Integrate, run, and commit**

Run:

```bash
pnpm test -- tests/unit/reading-deck/desktop-transform.test.ts tests/unit/reading-deck/session.test.ts
pnpm build
git add src/scripts/reading-deck/transports/transport.ts src/scripts/reading-deck/transports/desktop-transform.ts src/scripts/reading-deck-client.ts tests/unit/reading-deck/desktop-transform.test.ts
git commit -m "refactor: extract desktop deck transport"
```

Expected: all pass and the session receives semantic move requests rather than pointer/wheel events.

## Task 9: Extract the mobile scroll-snap transport

**Files:**
- Create: `src/scripts/reading-deck/transports/mobile-scroll-snap.ts`
- Modify: `src/scripts/reading-deck-client.ts`
- Create: `tests/unit/reading-deck/mobile-scroll-snap.test.ts`

- [ ] **Step 1: Write failing deterministic mobile tests**

Test touch-active lifecycle, no snap-back while touching, 120ms settlement, nearest-Card calculation, ignoring Completion as a Card, programmatic-scroll deduplication, partial swipe cancellation, rapid reversal, nested vertical scroll not becoming a horizontal transition, settle reporting, and teardown timer cleanup.

The regression test for the approved mobile fix must be explicit:

```ts
it('does not present the old Card while a native swipe is active', () => {
  transport.connect(context);
  track.dispatchEvent(new TouchEvent('touchstart'));
  track.scrollLeft = 420;
  track.dispatchEvent(new Event('scroll'));
  transport.reflow();
  expect(track.scrollLeft).toBe(420);
  expect(context.reportSettled).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Implement the mobile adapter**

Create `mobile-scroll-snap.ts`:

```ts
export interface MobileScrollSnapOptions {
  settleDelay?: number;
  onSettledHaptic?: () => void;
}

export function createMobileScrollSnapTransport(
  options: MobileScrollSnapOptions = {},
): DeckTransport {
  return new MobileScrollSnapTransport(options.settleDelay ?? 120, options.onSettledHaptic);
}
```

Move native scroll positioning, touch state, settlement timer, nearest-Card computation, and pending programmatic settlement from the controller. Preserve the invariant that programmatic presentation produces no second state transition when scrolling settles. Request the post-settle haptic only after a user-driven Card change.

- [ ] **Step 3: Make transport switching ordered and exclusive**

In the orchestration layer, use:

```ts
private replaceTransport(mobile: boolean): void {
  this.transport?.destroy();
  this.transport = mobile
    ? createMobileScrollSnapTransport({ onSettledHaptic: () => this.tick() })
    : createDesktopTransformTransport();
  this.transport.connect(this.transportContext());
  this.transport.present(this.state.current, 'none');
}
```

On viewport changes, destroy before connect. Never leave both adapters listening.

- [ ] **Step 4: Run, review, and commit**

Run:

```bash
pnpm test -- tests/unit/reading-deck/mobile-scroll-snap.test.ts tests/unit/reading-deck/desktop-transform.test.ts tests/unit/reading-deck/session.test.ts
pnpm build
git add src/scripts/reading-deck/transports/mobile-scroll-snap.ts src/scripts/reading-deck-client.ts tests/unit/reading-deck/mobile-scroll-snap.test.ts
git commit -m "refactor: extract mobile deck transport"
```

Request code review for View and both transports. Resolve all Critical and Important findings before Session extraction.

## Task 10: Replace the controller with Session orchestration

**Files:**
- Create: `src/scripts/reading-deck/session.ts`
- Modify: `src/scripts/reading-deck/index.ts`
- Modify: `src/scripts/reading-deck-client.ts`
- Modify: `tests/unit/reading-deck/session.test.ts`

- [ ] **Step 1: Define injectable session dependencies**

Create `session.ts` with this boundary:

```ts
import type { DeckHistory } from './history';
import type { DeckViewport } from './viewport';

export interface ReadingDeckEffects {
  haptic(): void;
  initializeArticleEnhancements(): void;
  openSearch(): void;
  openMenu(): void;
  share(data: ShareData): Promise<'shared' | 'copied' | 'failed'>;
}

export interface ReadingDeckSessionDependencies {
  history: DeckHistory;
  viewport: DeckViewport;
  effects: ReadingDeckEffects;
}

export class ReadingDeckSession {
  static attach(dialog: HTMLDialogElement, dependencies: ReadingDeckSessionDependencies): ReadingDeckSession;
  destroy(): void;
}
```

- [ ] **Step 2: Add failing orchestration tests**

Extend `session.test.ts` to inject memory history, test viewport, and effect spies. Assert lazy Feed compilation once per Feed, event-to-intent routing, one render/present per transition, persistence after selection/switch, search/menu delegation, sharing status, overlay actions, haptics for Contents and heading selection, pending timer cleanup, and idempotent teardown.

Use a repeated-attachment regression:

```ts
it('leaves exactly one live session after reinitialization', () => {
  const first = attachReadingDeck(document, dependencies);
  first?.destroy();
  const second = attachReadingDeck(document, dependencies);
  click('[data-deck-next]');
  expect(dependencies.effects.haptic).toHaveBeenCalledTimes(1);
  second?.destroy();
});
```

- [ ] **Step 3: Move sequencing into `ReadingDeckSession`**

Move only orchestration from the controller: Feed caching/source selection, event binding, semantic dispatch, transition commits, storage reads/writes, adapter selection, enhancement initialization, best-effort haptics, search/menu/share effects, and teardown. Do not move Feed algorithms, DOM algorithms, history strings, viewport reads, or transport gesture algorithms back into Session.

Use one lifetime signal:

```ts
private readonly abort = new AbortController();

destroy(): void {
  if (this.destroyed) return;
  this.destroyed = true;
  this.abort.abort();
  this.transport?.destroy();
  this.unsubscribeHistory?.();
  this.unsubscribeViewport?.();
  this.view.destroy();
  this.effects.destroy?.();
}
```

If the effects object does not expose `destroy`, remove that final optional call and make the haptics wrapper own teardown inside the default dependency factory.

- [ ] **Step 4: Make `attachReadingDeck()` the only construction path**

Change `index.ts` to:

```ts
export interface ReadingDeckHandle {
  destroy(): void;
}

export function attachReadingDeck(
  root: Document = document,
  overrides: Partial<ReadingDeckSessionDependencies> = {},
): ReadingDeckHandle | null {
  const dialog = root.querySelector<HTMLDialogElement>('dialog[data-reading-deck]');
  if (!dialog) return null;
  try {
    return ReadingDeckSession.attach(dialog, createDependencies(overrides));
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[reading-deck]', error);
    return null;
  }
}
```

Delete `ReadingDeckController`. Reduce `reading-deck-client.ts` to imports, one `activeDeck`, `initializeReadingDeck()`, global typing, and the existing DOMContentLoaded/Astro/pageshow registration.

- [ ] **Step 5: Verify source boundaries**

Run:

```bash
pnpm test
pnpm build
pnpm exec astro check
```

Expected: tests/build pass and Astro check has no errors beyond the Task 1 baseline. Confirm `reading-deck-client.ts` contains no Feed, state, history, viewport, rendering, or gesture algorithm.

- [ ] **Step 6: Commit**

```bash
git add src/scripts/reading-deck/session.ts src/scripts/reading-deck/index.ts src/scripts/reading-deck-client.ts tests/unit/reading-deck/session.test.ts
git commit -m "refactor: orchestrate reading deck through session"
```

## Task 11: Add Chromium and WebKit behavior coverage

**Files:**
- Create: `tests/e2e/reading-deck.spec.ts`
- Modify: `playwright.config.ts` if the local Astro server needs an environment override.

- [ ] **Step 1: Add a stable pilot route helper**

Start `reading-deck.spec.ts` with:

```ts
import { expect, test } from '@playwright/test';

const pilot =
  '/posts/does-the-prophet-speak-only-by-revelation-refuting-the-alleged-contradiction-in-an-najm-53-34/';

async function openDeck(page, feed: 'slides' | 'tldr' = 'slides') {
  await page.goto(pilot);
  await page.locator(`[data-deck-open="${feed}"]`).click();
  await expect(page.locator('dialog[data-reading-deck]')).toBeVisible();
}
```

- [ ] **Step 2: Add desktop Chromium behavior tests**

Cover Deep/Quick Feed switching, Previous/Next, Contents selection, progress, neighboring Card clicks, pointer drag, horizontal trackpad-equivalent wheel event, nested Card vertical scroll, direct Card and heading hashes, browser Back/Forward, persistent footnote/marginalia popover plus outside-click dismissal, Sources then explicit Completion, Completion dismissal, article return, reduced motion, and Swup navigation away/back with one session.

Each test must assert URL and selected Card, not only visibility. Example:

```ts
test('neighboring Cards navigate on click', async ({ page }) => {
  await openDeck(page);
  await page.locator('[data-deck-next]').click();
  const before = await page.locator('.reading-deck-card[aria-hidden="false"]').getAttribute('aria-label');
  await page.locator('.reading-deck-card').filter({ hasNot: page.locator('[aria-hidden="false"]') }).last().click();
  await expect(page.locator('.reading-deck-card[aria-hidden="false"]')).not.toHaveAttribute('aria-label', before ?? '');
});
```

- [ ] **Step 3: Add mobile WebKit regressions**

Cover native swipe without snap-back, partial swipe cancellation, rapid reversals, nested vertical scrolling, one post-settle selection, controls without double-tap page zoom, visual viewport containment, no content exposed below bottom controls when page-scale changes, arrow-only vertical overflow affordance, Contents haptic path, and source/marginalia popovers remaining until dismissed.

- [ ] **Step 4: Run browser projects separately**

Run:

```bash
pnpm test:e2e -- --project=chromium-desktop tests/e2e/reading-deck.spec.ts
pnpm test:e2e -- --project=webkit-mobile tests/e2e/reading-deck.spec.ts
```

Expected: both projects pass. A failure caused by a direct approved-spec contradiction is fixed in production with a regression assertion; a subjective difference is recorded in the execution notes.

- [ ] **Step 5: Commit and request review**

```bash
git add tests/e2e/reading-deck.spec.ts playwright.config.ts
git commit -m "test: cover reading deck in Chromium and WebKit"
```

Request code review for Session/lifecycle and browser coverage. Resolve all Critical and Important findings.

## Task 12: Consolidate the Reading Deck stylesheet

**Files:**
- Modify: `src/styles/reading-deck.css`
- Create: `tests/e2e/reading-deck.visual.spec.ts`
- Create: `tests/e2e/reading-deck.visual.spec.ts-snapshots/*` through Playwright snapshot generation.

- [ ] **Step 1: Capture the pre-consolidation visual baseline**

Create `reading-deck.visual.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

const pilot =
  '/posts/does-the-prophet-speak-only-by-revelation-refuting-the-alleged-contradiction-in-an-najm-53-34/#slides-2';

test('reading deck visual baseline', async ({ page }) => {
  await page.goto(pilot);
  await expect(page.locator('dialog[data-reading-deck]')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot('reading-deck-card.png', {
    animations: 'disabled',
    fullPage: true,
    mask: [page.locator('[data-time-sensitive]')],
  });
});
```

Run before changing CSS:

```bash
pnpm test:e2e -- tests/e2e/reading-deck.visual.spec.ts --update-snapshots
```

Expected: one desktop Chromium and one mobile WebKit snapshot baseline are written.

- [ ] **Step 2: Inventory duplicate and late-repair rules**

Read the complete stylesheet and make a scratch inventory mapping every selector to one of these exact sections:

```css
/* 1. Article entry surface */
/* 2. Shell and viewport */
/* 3. Top chrome, progress, and controls */
/* 4. Cards and rich article content */
/* 5. Cover, Sources, and Completion */
/* 6. Contents, popovers, and image surface */
/* 7. Desktop transport presentation */
/* 8. Mobile transport presentation */
/* 9. Reduced motion and accessibility */
```

Expected: every existing selector is accounted for before deletion; theme variables and data selectors remain unchanged.

- [ ] **Step 3: Reorder and merge without visual redesign**

Use the nine headings above in `reading-deck.css`. Merge identical selector blocks and responsive rules, delete declarations superseded by the late repair layer, and then delete the repair-layer comment/block itself. Preserve specificity where lowering it would change behavior. Do not split the stylesheet.

- [ ] **Step 4: Run visual and behavior regression tests**

Run:

```bash
pnpm test:e2e -- tests/e2e/reading-deck.visual.spec.ts
pnpm test:e2e -- tests/e2e/reading-deck.spec.ts
pnpm test
pnpm build
```

Expected: snapshots and all behavior tests pass without updating the snapshots after consolidation.

- [ ] **Step 5: Commit and request review**

```bash
git add src/styles/reading-deck.css tests/e2e/reading-deck.visual.spec.ts tests/e2e/reading-deck.visual.spec.ts-snapshots
git commit -m "refactor: consolidate reading deck styles"
```

Request code review focused on cascade equivalence, responsive behavior, accessibility, and the absence of repair overrides. Resolve Critical and Important findings.

## Task 13: Final verification and architectural acceptance

**Files:**
- Modify only files required by verified review findings.

- [ ] **Step 1: Run the complete verification matrix**

Run:

```bash
pnpm test
pnpm test:e2e -- --project=chromium-desktop
pnpm test:e2e -- --project=webkit-mobile
pnpm build
pnpm exec astro check
git diff --check
```

Expected: all tests and build pass, `git diff --check` prints nothing, and Astro check contains no errors beyond the Task 1 baseline.

- [ ] **Step 2: Verify architecture mechanically**

Confirm:

```bash
wc -l src/scripts/reading-deck-client.ts
rg "pushState|replaceState|history\.back|location\.hash" src/scripts/reading-deck src/scripts/reading-deck-client.ts
rg "visualViewport|matchMedia" src/scripts/reading-deck src/scripts/reading-deck-client.ts
rg "pointerdown|touchstart|wheel" src/scripts/reading-deck src/scripts/reading-deck-client.ts
rg "late|repair|override" src/styles/reading-deck.css
```

Expected:

- `reading-deck-client.ts` is lifecycle-only.
- History/location calls appear only in `history.ts`.
- Viewport/media-query access appears only in `viewport.ts` and transport-safe injected callbacks.
- Pointer/wheel code appears only in `desktop-transform.ts`; touch/scroll settlement appears only in `mobile-scroll-snap.ts`.
- No known late repair layer remains in the stylesheet.

- [ ] **Step 3: Request final code review**

Use the requesting-code-review workflow with the approved design spec, this plan, the baseline SHA from Task 1, and current HEAD. Require explicit review of behavior preservation, teardown, state invariants, history compatibility, WebKit gesture behavior, test quality, and CSS equivalence. Fix every Critical and Important finding, rerun the complete matrix, and commit fixes with scoped messages.

- [ ] **Step 4: Report completion**

The handoff must list:

- final module boundaries;
- tests and browser projects run;
- build and Astro-check status, including unchanged baseline errors;
- approved-spec contradictions fixed during refactor;
- subjective behaviors deliberately preserved;
- final review result;
- changed files and commits.

## Task 14: Secondary read-only architecture scan

**Files:**
- Create: `docs/architecture/2026-07-14-secondary-deepening-opportunities.md`

- [ ] **Step 1: Scan outside the Reading Deck scope**

After Task 13 is complete, use codebase-memory graph tools first. If the graph transport remains unavailable, document that failure and use read-only repository inspection. Exclude `src/scripts/reading-deck/**`, `src/scripts/reading-deck-client.ts`, the homepage preview, and `src/styles/reading-deck.css` from candidate scoring.

- [ ] **Step 2: Record evidence, not implementations**

Create the report with a compact table:

```md
| Candidate | Evidence | Leverage | Locality problem | Recommended next step |
|---|---|---:|---|---|
```

Rank candidates using the codebase-design vocabulary. For each recommendation, name concrete files, describe the hidden complexity that could move behind a smaller interface, and state whether a separate brainstorming/design cycle is warranted. Do not modify production code.

- [ ] **Step 3: Commit the report**

```bash
git add docs/architecture/2026-07-14-secondary-deepening-opportunities.md
git commit -m "docs: identify secondary architecture opportunities"
```

## Plan self-review

- Spec coverage: every approved module, behavioral invariant, compatibility audit area, test layer, review checkpoint, CSS phase, and secondary scan has a task.
- Scope: the homepage preview is checkpointed independently and intentionally excluded from modularization.
- TDD: new Feed, State, History, Viewport, View, transport, Session, and browser behavior begins with failing tests.
- Interfaces: `FeedKind`, `CompiledReadingFeed`, `DeckState`, `DeckHistory`, `DeckViewport`, `DeckTransport`, `ReadingDeckView`, `ReadingDeckSessionDependencies`, and `ReadingDeckHandle` keep consistent names across tasks.
- Teardown: Session, History, Viewport, View, both transports, haptics, timers, animation frames, dialogs, inert state, and body classes are covered.
- Compatibility: selectors, hash forms, zero/one-based rules, storage, Sources, Completion, direct heading links, overlays, haptics, mobile settlement, and Swup are exercised.
- Verification: unit tests, attached-session tests, Chromium, WebKit, visual snapshots, build, Astro check, diff check, and final review are all explicit.
- Placeholder scan: the plan contains no deferred implementation markers; optional behavior is resolved with a concrete branch in the relevant step.

