import { attachReadingDeck, type ReadingDeckHandle } from './reading-deck';

declare global {
  interface Window {
    initializeReadingDeck?: () => void;
  }
}

let activeDeck: ReadingDeckHandle | null = null;

export function initializeReadingDeck(): void {
  activeDeck?.destroy();
  activeDeck = attachReadingDeck();
  document.documentElement.classList.toggle('reading-deck-ready', activeDeck !== null);
  if (!activeDeck) document.body.classList.remove('reading-deck-open');
}

window.initializeReadingDeck = initializeReadingDeck;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeReadingDeck, { once: true });
} else {
  initializeReadingDeck();
}

document.addEventListener('astro:page-load', initializeReadingDeck);
window.addEventListener('pageshow', (event) => {
  if (event.persisted) initializeReadingDeck();
});
