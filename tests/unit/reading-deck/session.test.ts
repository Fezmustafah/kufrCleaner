import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  installReadingDeckFixture,
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
  const [{ attachReadingDeck }, client] = await Promise.all([
    import('@/scripts/reading-deck'),
    import('@/scripts/reading-deck-client'),
  ]);
  return {
    attachReadingDeck,
    createReadingDeckController: client.createReadingDeckController,
  };
}

async function flushDeckFrames(): Promise<void> {
  await Promise.resolve();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await Promise.resolve();
}

describe('reading deck attachment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installBrowserDoubles();
  });

  afterEach(resetReadingDeckFixture);

  it('returns null when the page has no Reading Deck', async () => {
    const { attachReadingDeck, createReadingDeckController } = await loadDeckModules();
    expect(attachReadingDeck(document, createReadingDeckController)).toBeNull();
  });

  it('attaches and destroys idempotently', async () => {
    installReadingDeckFixture();
    const { attachReadingDeck, createReadingDeckController } = await loadDeckModules();
    const handle = attachReadingDeck(document, createReadingDeckController);

    expect(handle).not.toBeNull();
    handle?.destroy();
    expect(() => handle?.destroy()).not.toThrow();
    expect(document.body.classList.contains('reading-deck-open')).toBe(false);
  });

  it('rejects malformed markup without changing page state', async () => {
    document.body.innerHTML = '<dialog data-reading-deck></dialog>';
    const { attachReadingDeck, createReadingDeckController } = await loadDeckModules();

    expect(attachReadingDeck(document, createReadingDeckController)).toBeNull();
    expect(document.body.classList.contains('reading-deck-open')).toBe(false);
  });

  it('opens Deep Read and advances with Next', async () => {
    const dialog = installReadingDeckFixture();
    const { attachReadingDeck, createReadingDeckController } = await loadDeckModules();
    const handle = attachReadingDeck(document, createReadingDeckController);

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
    const { attachReadingDeck, createReadingDeckController } = await loadDeckModules();
    const handle = attachReadingDeck(document, createReadingDeckController);

    await flushDeckFrames();
    expect(dialog.open).toBe(true);
    expect(dialog.dataset.activeFeed).toBe('slides');
    expect(dialog.querySelectorAll('.reading-deck-card')[1]?.getAttribute('aria-hidden')).toBe('false');

    handle?.destroy();
  });

  it('restores independent Feed positions', async () => {
    const dialog = installReadingDeckFixture();
    const { attachReadingDeck, createReadingDeckController } = await loadDeckModules();
    const handle = attachReadingDeck(document, createReadingDeckController);

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
    const { attachReadingDeck, createReadingDeckController } = await loadDeckModules();
    const handle = attachReadingDeck(document, createReadingDeckController);

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
    const { attachReadingDeck, createReadingDeckController } = await loadDeckModules();
    const handle = attachReadingDeck(document, createReadingDeckController);

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
});
