import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createBrowserDeckHistory,
  formatDeckHash,
  parseDeckLocation,
} from '@/scripts/reading-deck/history';

describe('Reading Deck history', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
    vi.restoreAllMocks();
  });

  it.each([
    ['#slides', { feed: 'slides', index: null, targetId: null }],
    ['#tldr', { feed: 'tldr', index: null, targetId: null }],
    ['#slides-0', { feed: 'slides', index: 0, targetId: null }],
    ['#tldr-3', { feed: 'tldr', index: 3, targetId: null }],
    ['#deck-slides-5-first-type', { feed: 'slides', index: 4, targetId: 'deck-slides-5-first-type' }],
  ])('parses %s', (hash, expected) => {
    expect(parseDeckLocation(hash)).toEqual(expected);
  });

  it.each(['', '#article-heading', '#slides-x', '#deck-slides-0-heading'])('rejects %s', (hash) => {
    expect(parseDeckLocation(hash)).toBeNull();
  });

  it('formats zero-based Card hashes', () => {
    expect(formatDeckHash('slides', 2)).toBe('#slides-2');
    expect(formatDeckHash('tldr', -20)).toBe('#tldr-0');
  });

  it('pushes and replaces while preserving pathname and query', () => {
    window.history.replaceState(null, '', '/posts/pilot/?view=compact');
    const deckHistory = createBrowserDeckHistory(window);

    deckHistory.push('slides', 2);
    expect(window.location.href).toContain('/posts/pilot/?view=compact#slides-2');
    expect(window.history.state).toMatchObject({ readingDeck: true, readingDeckKind: 'slides' });

    deckHistory.replace('tldr', 1, 'deck-tldr-2-heading');
    expect(window.location.hash).toBe('#deck-tldr-2-heading');
    expect(window.history.state).toMatchObject({ readingDeckKind: 'tldr' });
  });

  it('uses browser Back only for a marked deck entry', () => {
    window.history.replaceState({ readingDeck: true }, '', '/posts/pilot/#slides-1');
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    const deckHistory = createBrowserDeckHistory(window);

    expect(deckHistory.close()).toBe('back');
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('replaces an unmarked deck URL with the canonical article URL', () => {
    window.history.replaceState(null, '', '/posts/pilot/?view=compact#slides-1');
    const deckHistory = createBrowserDeckHistory(window);

    expect(deckHistory.close()).toBe('replace');
    expect(window.location.pathname).toBe('/posts/pilot/');
    expect(window.location.search).toBe('?view=compact');
    expect(window.location.hash).toBe('');
  });

  it('builds absolute share URLs', () => {
    window.history.replaceState(null, '', '/posts/pilot/?view=compact');
    expect(createBrowserDeckHistory(window).shareUrl('slides', 4)).toBe(
      `${window.location.origin}/posts/pilot/?view=compact#slides-4`,
    );
  });

  it('subscribes to and disposes browser location events', () => {
    const listener = vi.fn();
    const dispose = createBrowserDeckHistory(window).subscribe(listener);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(listener).toHaveBeenCalledTimes(2);
    dispose();
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
