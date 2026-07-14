import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReadingDeckView } from '@/scripts/reading-deck/view';
import type { CompiledReadingFeed } from '@/scripts/reading-deck/types';
import { createDeckState } from '@/scripts/reading-deck/state';
import {
  installReadingDeckFixture,
  resetReadingDeckFixture,
} from '../../helpers/reading-deck-fixture';

function feed(): CompiledReadingFeed {
  return {
    cards: ['Cover', 'Argument', 'Sources'].map((title, index) => {
      const element = document.createElement('article');
      element.className = 'reading-deck-card';
      element.textContent = title;
      return { element, title, isCover: index === 0 };
    }),
    sources: new Map(),
    minutes: 3,
  };
}

describe('ReadingDeckView', () => {
  afterEach(resetReadingDeckFixture);

  it('fails validation before mutating malformed markup', () => {
    const dialog = document.createElement('dialog');
    dialog.dataset.readingDeck = '';
    expect(() => ReadingDeckView.from(dialog)).toThrow('Reading deck is missing required elements');
    expect(document.body.classList.contains('reading-deck-open')).toBe(false);
  });

  it('renders a Feed and exposes only the selected Card', () => {
    const dialog = installReadingDeckFixture();
    const view = ReadingDeckView.from(dialog);
    const model = feed();

    view.renderFeed(model, 'slides');
    view.selectCard(1);

    expect(view.track.children).toHaveLength(4);
    expect(model.cards[1].element.inert).toBe(false);
    expect(model.cards[1].element.getAttribute('aria-hidden')).toBe('false');
    expect(model.cards[0].element.inert).toBe(true);
    expect(model.cards[0].element.getAttribute('aria-hidden')).toBe('true');
    expect(dialog.dataset.activeFeed).toBe('slides');
    expect(dialog.querySelectorAll('[data-deck-index-list] [data-card-index]')).toHaveLength(2);
  });

  it('renders controls and Completion from state', () => {
    const dialog = installReadingDeckFixture();
    const view = ReadingDeckView.from(dialog);
    const model = feed();
    view.renderFeed(model, 'tldr');

    const state = { ...createDeckState('tldr'), open: true, current: 2, finished: false };
    view.renderNavigation(state, model);
    expect(dialog.querySelector('[data-deck-position]')?.textContent).toBe('2 / 2');
    expect(dialog.querySelector('[data-deck-next]')?.textContent).toContain('Finish');

    view.renderCompletion(true, model, 'tldr');
    expect(view.finish.dataset.deckFinishActive).toBe('true');
    expect(dialog.querySelector('[data-deck-position]')?.textContent).toBe('Done');
    expect(dialog.querySelector<HTMLButtonElement>('[data-deck-next]')?.disabled).toBe(true);
  });

  it('closes every surface during teardown', () => {
    const dialog = installReadingDeckFixture();
    const view = ReadingDeckView.from(dialog);
    const indexOverlay = dialog.querySelector<HTMLElement>('[data-deck-index]')!;
    const sourceOverlay = dialog.querySelector<HTMLElement>('[data-deck-source-panel]')!;
    const imageOverlay = dialog.querySelector<HTMLElement>('[data-deck-image-panel]')!;
    indexOverlay.hidden = false;
    sourceOverlay.hidden = false;
    imageOverlay.hidden = false;
    view.open();

    view.destroy();

    expect(dialog.open).toBe(false);
    expect(indexOverlay.hidden).toBe(true);
    expect(sourceOverlay.hidden).toBe(true);
    expect(imageOverlay.hidden).toBe(true);
    expect(document.body.classList.contains('reading-deck-open')).toBe(false);
  });

  it('focuses the first Contents item from the cover and restores the trigger', () => {
    const dialog = installReadingDeckFixture();
    const view = ReadingDeckView.from(dialog);
    const model = feed();
    view.renderFeed(model, 'slides');
    view.selectCard(0);
    const trigger = dialog.querySelector<HTMLButtonElement>('[data-deck-index-open]')!;
    trigger.focus();

    view.openContents(trigger);
    expect(document.activeElement).toBe(
      dialog.querySelector('[data-deck-index-list] [data-card-index]'),
    );
    view.closeTopSurface();
    expect(document.activeElement).toBe(trigger);
  });

  it('cancels pending View frames during teardown', async () => {
    const dialog = installReadingDeckFixture();
    const view = ReadingDeckView.from(dialog);
    const model = feed();
    model.cards[1].element.innerHTML = '<h2 id="pending-heading">Pending</h2>';
    model.cards[1].element.scrollTo = vi.fn();
    view.renderFeed(model, 'slides');
    view.restoreHeading('pending-heading');
    view.destroy();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(model.cards[1].element.scrollTo).not.toHaveBeenCalled();
  });
});
