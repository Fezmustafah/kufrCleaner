import { afterEach, describe, expect, it } from 'vitest';
import {
  requiredDeckMarkup,
  resetReadingDeckFixture,
} from '../../helpers/reading-deck-fixture';

describe('reading deck test harness', () => {
  afterEach(resetReadingDeckFixture);

  it('renders the production DOM contract', () => {
    document.body.innerHTML = requiredDeckMarkup();

    expect(document.querySelector('dialog[data-reading-deck]')).toBeInstanceOf(HTMLDialogElement);
    expect(document.querySelector('[data-deck-track]')).toBeInstanceOf(HTMLElement);
    expect(document.querySelectorAll('[data-deck-open]')).toHaveLength(2);
  });
});
