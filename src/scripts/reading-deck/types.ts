export type FeedKind = 'slides' | 'tldr';

export interface DeckCard {
  element: HTMLElement;
  title: string;
  isCover?: boolean;
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
