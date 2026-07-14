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

const CARD_HASH = /^#(slides|tldr)(?:-(\d+))?$/;
const HEADING_HASH = /^#deck-(slides|tldr)-([1-9]\d*)-(.+)$/;

function decodeFragment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseDeckLocation(hash: string): DeckLocation | null {
  const heading = hash.match(HEADING_HASH);
  if (heading) {
    return {
      feed: heading[1] as FeedKind,
      index: Number(heading[2]) - 1,
      targetId: decodeFragment(hash.slice(1)),
    };
  }

  const card = hash.match(CARD_HASH);
  if (!card) return null;
  return {
    feed: card[1] as FeedKind,
    index: card[2] == null ? null : Number(card[2]),
    targetId: null,
  };
}

export function formatDeckHash(feed: FeedKind, index: number): string {
  return `#${feed}-${Math.max(0, Math.trunc(index))}`;
}

export function createBrowserDeckHistory(browser: Window = window): DeckHistory {
  const articlePath = () => `${browser.location.pathname}${browser.location.search}`;
  const stateFor = (feed: FeedKind) => ({
    ...(browser.history.state || {}),
    readingDeck: true,
    readingDeckKind: feed,
  });

  return {
    read: () => parseDeckLocation(browser.location.hash),

    push(feed, index) {
      browser.history.pushState(stateFor(feed), '', `${articlePath()}${formatDeckHash(feed, index)}`);
    },

    replace(feed, index, targetId = null) {
      const hash = targetId ? `#${targetId.replace(/^#/, '')}` : formatDeckHash(feed, index);
      browser.history.replaceState(stateFor(feed), '', `${articlePath()}${hash}`);
    },

    close() {
      const isMarkedEntry = Boolean(
        (browser.history.state as Record<string, unknown> | null)?.readingDeck,
      );
      if (isMarkedEntry && parseDeckLocation(browser.location.hash)) {
        browser.history.back();
        return 'back';
      }

      browser.history.replaceState(
        { ...(browser.history.state || {}), readingDeck: false },
        '',
        articlePath(),
      );
      return 'replace';
    },

    shareUrl(feed, index) {
      return `${browser.location.origin}${articlePath()}${formatDeckHash(feed, index)}`;
    },

    subscribe(listener) {
      browser.addEventListener('popstate', listener);
      browser.addEventListener('hashchange', listener);
      return () => {
        browser.removeEventListener('popstate', listener);
        browser.removeEventListener('hashchange', listener);
      };
    },
  };
}
