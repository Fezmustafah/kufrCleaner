import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReadingDeckEffects } from '@/scripts/reading-deck/session';
import { createTestDeckViewport } from '@/scripts/reading-deck/viewport';
import {
  installReadingDeckFixture,
  requiredDeckMarkup,
  resetReadingDeckFixture,
} from '../../helpers/reading-deck-fixture';

const trigger = vi.fn(() => Promise.resolve());
const destroyHaptics = vi.fn();

vi.mock('web-haptics', () => ({
  WebHaptics: class WebHaptics {
    trigger = trigger;
    destroy = destroyHaptics;
  },
}));

function installBrowserDoubles(): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    })),
  });
  HTMLElement.prototype.scrollTo ??= vi.fn();
  HTMLElement.prototype.scrollBy ??= vi.fn();
}

async function loadDeckModules() {
  return import('@/scripts/reading-deck');
}

type DeckModules = Awaited<ReturnType<typeof loadDeckModules>>;
let deckModules: DeckModules;

async function flushDeckFrames(): Promise<void> {
  await Promise.resolve();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await Promise.resolve();
}

function createEffects() {
  return {
    haptic: vi.fn<() => void>(),
    initializeArticleEnhancements: vi.fn<() => void>(),
    openSearch: vi.fn<() => void>(),
    openMenu: vi.fn<() => void>(),
    share: vi.fn(async () => 'copied' as const),
  } satisfies ReadingDeckEffects;
}

describe('reading deck attachment', () => {
  beforeAll(async () => {
    deckModules = await loadDeckModules();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    installBrowserDoubles();
  });

  afterEach(resetReadingDeckFixture);

  it('returns null when the page has no Reading Deck', async () => {
    const { attachReadingDeck } = deckModules;
    expect(attachReadingDeck(document)).toBeNull();
  });

  it('attaches and destroys idempotently', async () => {
    installReadingDeckFixture();
    const { attachReadingDeck } = deckModules;
    const handle = attachReadingDeck(document);

    expect(handle).not.toBeNull();
    handle?.destroy();
    expect(() => handle?.destroy()).not.toThrow();
    expect(document.body.classList.contains('reading-deck-open')).toBe(false);
  });

  it('rejects malformed markup without changing page state', async () => {
    document.body.innerHTML = '<dialog data-reading-deck></dialog>';
    const { attachReadingDeck } = deckModules;

    expect(attachReadingDeck(document)).toBeNull();
    expect(document.body.classList.contains('reading-deck-open')).toBe(false);
  });

  it('opens Deep Read and advances with Next', async () => {
    const dialog = installReadingDeckFixture();
    const { attachReadingDeck } = deckModules;
    const handle = attachReadingDeck(document);

    document.querySelector<HTMLButtonElement>('[data-deck-open="slides"]')?.click();
    await flushDeckFrames();
    expect(dialog.open).toBe(true);
    expect(dialog.dataset.activeFeed).toBe('slides');
    expect(dialog.querySelector('.reading-deck-card[aria-hidden="false"]')).not.toBeNull();

    dialog.querySelector<HTMLButtonElement>('[data-deck-next]')?.click();
    await flushDeckFrames();
    expect(window.location.hash).toBe('#slides-1');
    expect(trigger).toHaveBeenCalled();

    handle?.destroy();
  });

  it('restores direct heading locations', async () => {
    const dialog = installReadingDeckFixture();
    window.history.replaceState(null, '', '/pilot/#deck-slides-2-first-heading');
    const { attachReadingDeck } = deckModules;
    const handle = attachReadingDeck(document);

    await flushDeckFrames();
    expect(dialog.open).toBe(true);
    expect(dialog.dataset.activeFeed).toBe('slides');
    expect(dialog.querySelectorAll('.reading-deck-card')[1]?.getAttribute('aria-hidden')).toBe('false');

    handle?.destroy();
  });

  it('restores independent Feed positions', async () => {
    const dialog = installReadingDeckFixture();
    const { attachReadingDeck } = deckModules;
    const handle = attachReadingDeck(document);

    document.querySelector<HTMLButtonElement>('[data-deck-open="slides"]')?.click();
    await flushDeckFrames();
    dialog.querySelector<HTMLButtonElement>('[data-deck-next]')?.click();
    dialog.querySelector<HTMLButtonElement>('[data-deck-feed="tldr"]')?.click();
    dialog.querySelector<HTMLButtonElement>('[data-deck-next]')?.click();
    dialog.querySelector<HTMLButtonElement>('[data-deck-feed="slides"]')?.click();

    expect(window.location.hash).toBe('#slides-1');
    expect(dialog.querySelectorAll('.reading-deck-card')[1]?.getAttribute('aria-hidden')).toBe('false');

    handle?.destroy();
  });

  it('opens Contents and selects a Card with one haptic request', async () => {
    const dialog = installReadingDeckFixture();
    const { attachReadingDeck } = deckModules;
    const handle = attachReadingDeck(document);

    document.querySelector<HTMLButtonElement>('[data-deck-open="slides"]')?.click();
    await flushDeckFrames();
    trigger.mockClear();
    dialog.querySelector<HTMLButtonElement>('[data-deck-index-open]')?.click();
    const overlay = dialog.querySelector<HTMLElement>('[data-deck-index]')!;
    expect(overlay.hidden).toBe(false);
    overlay.querySelector<HTMLButtonElement>('[data-card-index]')?.click();

    expect(overlay.hidden).toBe(true);
    expect(trigger).toHaveBeenCalledTimes(2);

    handle?.destroy();
  });

  it('enters Completion only after advancing beyond Sources', async () => {
    const dialog = installReadingDeckFixture();
    const { attachReadingDeck } = deckModules;
    const handle = attachReadingDeck(document);

    document.querySelector<HTMLButtonElement>('[data-deck-open="slides"]')?.click();
    await flushDeckFrames();
    const progress = Array.from(dialog.querySelectorAll<HTMLButtonElement>('[data-deck-progress-index]'));
    progress.at(-1)?.click();
    expect(dialog.querySelector<HTMLElement>('[data-deck-finish]')?.dataset.deckFinishActive).toBe('false');
    dialog.querySelector<HTMLButtonElement>('[data-deck-next]')?.click();

    expect(dialog.querySelector<HTMLElement>('[data-deck-finish]')?.dataset.deckFinishActive).toBe('true');
    expect(dialog.querySelector('[data-deck-position]')?.textContent).toBe('Done');

    handle?.destroy();
  });

  it('delegates site actions through injected effects', () => {
    const dialog = installReadingDeckFixture();
    const effects = createEffects();
    const { attachReadingDeck } = deckModules;
    const handle = attachReadingDeck(document, {
      effects,
      viewport: createTestDeckViewport(),
    });

    dialog.querySelector<HTMLButtonElement>('[data-deck-search]')?.click();
    dialog.querySelector<HTMLButtonElement>('[data-deck-menu]')?.click();
    expect(effects.openSearch).toHaveBeenCalledOnce();
    expect(effects.openMenu).toHaveBeenCalledOnce();
    handle?.destroy();
  });

  it('reuses each compiled Feed during one session', async () => {
    const dialog = installReadingDeckFixture();
    const { attachReadingDeck } = deckModules;
    const handle = attachReadingDeck(document);
    document.querySelector<HTMLButtonElement>('[data-deck-open="slides"]')?.click();
    await flushDeckFrames();
    const firstSlidesCard = dialog.querySelector('.reading-deck-card');
    dialog.querySelector<HTMLButtonElement>('[data-deck-feed="tldr"]')?.click();
    dialog.querySelector<HTMLButtonElement>('[data-deck-feed="slides"]')?.click();
    expect(dialog.querySelector('.reading-deck-card')).toBe(firstSlidesCard);
    handle?.destroy();
  });

  it('leaves exactly one live session after reinitialization', async () => {
    const dialog = installReadingDeckFixture();
    const effects = createEffects();
    const viewport = createTestDeckViewport();
    const { attachReadingDeck } = deckModules;
    const first = attachReadingDeck(document, { effects, viewport });
    first?.destroy();
    window.history.replaceState(null, '', '/');
    const second = attachReadingDeck(document, { effects, viewport });
    document.querySelector<HTMLButtonElement>('[data-deck-open="slides"]')?.click();
    await flushDeckFrames();
    effects.haptic.mockClear();
    dialog.querySelector<HTMLButtonElement>('[data-deck-next]')?.click();
    expect(effects.haptic).toHaveBeenCalledTimes(1);
    second?.destroy();
  });

  it('does not reopen after synchronous teardown of a direct hash attachment', async () => {
    const dialog = installReadingDeckFixture();
    const effects = createEffects();
    window.history.replaceState(null, '', '/pilot/#slides-1');
    const handle = deckModules.attachReadingDeck(document, {
      effects,
      viewport: createTestDeckViewport(),
    });
    handle?.destroy();
    await Promise.resolve();
    expect(dialog.open).toBe(false);
    expect(dialog.querySelector('.reading-deck-card')).toBeNull();
    expect(effects.initializeArticleEnhancements).not.toHaveBeenCalled();
  });

  it('destroys injected effects when malformed markup fails validation', () => {
    document.body.innerHTML = '<dialog data-reading-deck></dialog>';
    const effects = { ...createEffects(), destroy: vi.fn<() => void>() };
    expect(deckModules.attachReadingDeck(document, { effects })).toBeNull();
    expect(effects.destroy).toHaveBeenCalledOnce();
  });

  it('preserves pathname storage keys when post id is absent', async () => {
    const dialog = installReadingDeckFixture();
    delete dialog.dataset.postId;
    window.history.replaceState(null, '', '/fallback-article/');
    const values = new Map<string, string>();
    const storage = {
      get length() { return values.size; },
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    } satisfies Storage;
    const originalStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
    storage.setItem('reading-deck:/fallback-article/', JSON.stringify({
      feed: 'slides',
      positions: { slides: 1 },
    }));
    try {
      const handle = deckModules.attachReadingDeck(document);
      document.querySelector<HTMLButtonElement>('[data-deck-open="slides"]')?.click();
      await flushDeckFrames();
      expect(dialog.querySelectorAll('.reading-deck-card')[1]?.getAttribute('aria-hidden')).toBe('false');
      handle?.destroy();
    } finally {
      if (originalStorage) Object.defineProperty(window, 'localStorage', originalStorage);
      else Reflect.deleteProperty(window, 'localStorage');
    }
  });

  it('compiles and renders within the supplied Document', async () => {
    installReadingDeckFixture();
    const isolated = document.implementation.createHTMLDocument('Isolated');
    isolated.body.innerHTML = requiredDeckMarkup();
    const effects = createEffects();
    const handle = deckModules.attachReadingDeck(isolated, {
      effects,
      viewport: createTestDeckViewport(),
    });
    isolated.querySelector<HTMLButtonElement>('[data-deck-open="slides"]')?.click();
    await flushDeckFrames();
    expect(isolated.querySelector('dialog')?.querySelector('.reading-deck-card')).not.toBeNull();
    expect(document.querySelector('dialog')?.querySelector('.reading-deck-card')).toBeNull();
    expect(isolated.body.classList.contains('reading-deck-open')).toBe(true);
    handle?.destroy();
  });
});
