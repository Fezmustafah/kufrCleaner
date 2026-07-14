import { describe, expect, it } from 'vitest';
import {
  createDeckState,
  transition,
  type DeckState,
  type FeedLengths,
} from '@/scripts/reading-deck/state';

const feeds: FeedLengths = { slides: 7, tldr: 5 };

function apply(state: DeckState, intent: Parameters<typeof transition>[1]): DeckState {
  return transition(state, intent, feeds).state;
}

describe('Reading Deck state', () => {
  it('opens a supported Feed at a clamped Card', () => {
    const result = transition(
      createDeckState(),
      { type: 'OPEN', feed: 'slides', index: 99 },
      feeds,
    );

    expect(result.state).toMatchObject({ open: true, feed: 'slides', current: 6, finished: false });
    expect(result.effects).toMatchObject({ openChanged: true, cardChanged: true });
  });

  it('ignores unsupported Feed requests', () => {
    const state = createDeckState('slides', { slides: 2 });
    expect(transition(state, { type: 'OPEN', feed: 'tldr' }, { slides: 7 }).state).toBe(state);
  });

  it('keeps independent positions while switching Feeds', () => {
    let state = createDeckState('slides');
    state = apply(state, { type: 'OPEN', feed: 'slides', index: 3 });
    state = apply(state, { type: 'SWITCH_FEED', feed: 'tldr' });
    state = apply(state, { type: 'SELECT_CARD', index: 2 });
    state = apply(state, { type: 'SWITCH_FEED', feed: 'slides' });

    expect(state.current).toBe(3);
    expect(state.positions).toEqual({ slides: 3, tldr: 2 });
  });

  it('enters Completion only by moving forward beyond Sources', () => {
    let state = createDeckState('slides', { slides: 6 });
    state = apply(state, { type: 'OPEN', feed: 'slides' });
    const result = transition(state, { type: 'MOVE', delta: 1 }, feeds);

    expect(result.state.finished).toBe(true);
    expect(result.state.current).toBe(6);
    expect(result.state.positions.slides).toBe(6);
  });

  it('moves backward from Completion to Sources', () => {
    let state = createDeckState('slides', { slides: 6 });
    state = apply(state, { type: 'OPEN', feed: 'slides' });
    state = apply(state, { type: 'MOVE', delta: 1 });
    state = apply(state, { type: 'MOVE', delta: -1 });

    expect(state).toMatchObject({ current: 6, finished: false });
  });

  it('clamps selection before writing positions', () => {
    let state = createDeckState('slides');
    state = apply(state, { type: 'OPEN', feed: 'slides' });
    state = apply(state, { type: 'SELECT_CARD', index: -40 });
    expect(state.current).toBe(0);
    expect(state.positions.slides).toBe(0);
  });

  it('restarts at Cover and resumes from Completion', () => {
    let state = createDeckState('slides', { slides: 6 });
    state = apply(state, { type: 'OPEN', feed: 'slides' });
    state = apply(state, { type: 'MOVE', delta: 1 });
    state = apply(state, { type: 'RESUME' });
    expect(state).toMatchObject({ current: 6, finished: false });
    state = apply(state, { type: 'RESTART' });
    expect(state).toMatchObject({ current: 0, finished: false });
  });

  it('closes without losing per-Feed positions', () => {
    let state = createDeckState('tldr', { tldr: 2, slides: 4 });
    state = apply(state, { type: 'OPEN', feed: 'tldr' });
    state = apply(state, { type: 'CLOSE' });
    expect(state.open).toBe(false);
    expect(state.finished).toBe(false);
    expect(state.positions).toEqual({ tldr: 2, slides: 4 });
  });

  it('reports no observable effects for a no-op transition', () => {
    const state = createDeckState('slides');
    const result = transition(state, { type: 'MOVE', delta: -1 }, feeds);
    expect(result.state).toBe(state);
    expect(result.effects).toEqual({
      openChanged: false,
      feedChanged: false,
      cardChanged: false,
      completionChanged: false,
    });
  });
});
