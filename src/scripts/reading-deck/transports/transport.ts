export type DeckMotion = 'none' | 'animate';

export interface DeckTransportContext {
  stage: HTMLElement;
  track: HTMLElement;
  cards: HTMLElement[];
  selectedIndex(): number;
  reducedMotion(): boolean;
  interactionEnabled(): boolean;
  requestMove(delta: -1 | 1): void;
  requestSelect?(index: number): void;
  reportSettled(index: number): void;
  dismissHint(): void;
}

export interface DeckTransport {
  connect(context: DeckTransportContext): void;
  present(index: number, motion: DeckMotion): void;
  reflow(): void;
  destroy(): void;
}
