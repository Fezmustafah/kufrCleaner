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
  openChanged: boolean;
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
  const current = normalizeIndex(positions[feed] ?? 0);
  return {
    open: false,
    feed,
    current,
    positions: { ...positions, [feed]: current },
    finished: false,
  };
}

export function transition(
  state: DeckState,
  intent: DeckIntent,
  feeds: FeedLengths,
): DeckTransition {
  const next = reduceIntent(state, intent, feeds);
  return {
    state: next,
    effects: {
      openChanged: next.open !== state.open,
      feedChanged: next.feed !== state.feed,
      cardChanged: next.feed !== state.feed || next.current !== state.current,
      completionChanged: next.finished !== state.finished,
    },
  };
}

function reduceIntent(state: DeckState, intent: DeckIntent, feeds: FeedLengths): DeckState {
  switch (intent.type) {
    case 'OPEN': {
      if (!supports(feeds, intent.feed)) return state;
      const requested = intent.index == null ? state.positions[intent.feed] ?? 0 : intent.index;
      return select(state, intent.feed, requested, feeds, { open: true, finished: false });
    }
    case 'CLOSE':
      if (!state.open && !state.finished) return state;
      return { ...state, open: false, finished: false };
    case 'MOVE': {
      if (!state.open || !supports(feeds, state.feed)) return state;
      if (state.finished) {
        return intent.delta < 0 ? { ...state, finished: false } : state;
      }
      const last = lastIndex(feeds, state.feed);
      if (intent.delta > 0 && state.current >= last) return { ...state, finished: true };
      const next = clamp(state.current + intent.delta, feeds, state.feed);
      return next === state.current ? state : select(state, state.feed, next, feeds);
    }
    case 'SELECT_CARD':
      if (!state.open || !supports(feeds, state.feed)) return state;
      return select(state, state.feed, intent.index, feeds, { finished: false });
    case 'SWITCH_FEED':
      if (!state.open || !supports(feeds, intent.feed) || intent.feed === state.feed) return state;
      return select(state, intent.feed, state.positions[intent.feed] ?? 0, feeds, { finished: false });
    case 'RESTART':
      if (!state.open || (!state.finished && state.current === 0)) return state;
      return select(state, state.feed, 0, feeds, { finished: false });
    case 'RESUME':
    case 'DISMISS_COMPLETION':
      return state.finished ? { ...state, finished: false } : state;
  }
}

function select(
  state: DeckState,
  feed: FeedKind,
  index: number,
  feeds: FeedLengths,
  overrides: Partial<Pick<DeckState, 'open' | 'finished'>> = {},
): DeckState {
  const current = clamp(index, feeds, feed);
  const open = overrides.open ?? state.open;
  const finished = overrides.finished ?? state.finished;
  if (
    feed === state.feed
    && current === state.current
    && open === state.open
    && finished === state.finished
    && state.positions[feed] === current
  ) return state;

  return {
    ...state,
    ...overrides,
    feed,
    current,
    positions: { ...state.positions, [feed]: current },
  };
}

function supports(feeds: FeedLengths, feed: FeedKind): boolean {
  return (feeds[feed] ?? 0) > 0;
}

function lastIndex(feeds: FeedLengths, feed: FeedKind): number {
  return Math.max(0, (feeds[feed] ?? 1) - 1);
}

function clamp(index: number, feeds: FeedLengths, feed: FeedKind): number {
  return Math.min(lastIndex(feeds, feed), normalizeIndex(index));
}

function normalizeIndex(index: number): number {
  return Math.max(0, Number.isFinite(index) ? Math.trunc(index) : 0);
}
