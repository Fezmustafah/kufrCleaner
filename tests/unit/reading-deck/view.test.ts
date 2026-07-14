import { afterEach, describe, expect, it } from 'vitest';
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
    expect(view.indexList.querySelectorAll('[data-card-index]')).toHaveLength(2);
  });

  it('renders controls and Completion from state', () => {
    const dialog = installReadingDeckFixture();
    const view = ReadingDeckView.from(dialog);
    const model = feed();
    view.renderFeed(model, 'tldr');

    const state = { ...createDeckState('tldr'), open: true, current: 2, finished: false };
    view.renderNavigation(state, model);
    expect(view.position.textContent).toBe('2 / 2');
    expect(view.next.textContent).toContain('Finish');

    view.renderCompletion(true, model, 'tldr');
    expect(view.finish.dataset.deckFinishActive).toBe('true');
    expect(view.position.textContent).toBe('Done');
    expect(view.next.disabled).toBe(true);
  });

  it('closes every surface during teardown', () => {
    const dialog = installReadingDeckFixture();
    const view = ReadingDeckView.from(dialog);
    view.indexOverlay.hidden = false;
    view.sourceOverlay.hidden = false;
    view.imageOverlay.hidden = false;
    view.open();

    view.destroy();

    expect(dialog.open).toBe(false);
    expect(view.indexOverlay.hidden).toBe(true);
    expect(view.sourceOverlay.hidden).toBe(true);
    expect(view.imageOverlay.hidden).toBe(true);
    expect(document.body.classList.contains('reading-deck-open')).toBe(false);
  });
});
