import { WebHaptics } from 'web-haptics';
import { createBrowserDeckHistory } from './history';
import {
  ReadingDeckSession,
  type ReadingDeckEffects,
  type ReadingDeckSessionDependencies,
} from './session';
import { createBrowserDeckViewport } from './viewport';

declare global {
  interface Window {
    initializeAnnotations?: (opts?: { animate?: boolean }) => void;
    initializeWikilinks?: () => void;
    initializeMermaid?: () => void;
    searchPalette?: { open: (seed?: string) => void };
    __setNavDrawer?: (open: boolean) => void;
  }
}

export interface ReadingDeckHandle {
  destroy(): void;
}

function createDefaultEffects(): ReadingDeckEffects {
  const haptics = new WebHaptics({ debug: false, showSwitch: true });
  return {
    haptic() {
      void haptics.trigger('selection').catch(() => {});
    },
    initializeArticleEnhancements() {
      window.initializeWikilinks?.();
      window.initializeAnnotations?.({ animate: false });
      window.initializeMermaid?.();
    },
    openSearch() {
      window.searchPalette?.open();
    },
    openMenu() {
      window.__setNavDrawer?.(true);
    },
    async share(data) {
      try {
        if (navigator.share) {
          await navigator.share(data);
          return 'shared';
        }
        await navigator.clipboard.writeText(data.url || '');
        return 'copied';
      } catch (error) {
        return (error as DOMException)?.name === 'AbortError' ? 'shared' : 'failed';
      }
    },
    destroy() {
      haptics.destroy();
    },
  };
}

export function createReadingDeckDependencies(
  overrides: Partial<ReadingDeckSessionDependencies> = {},
): ReadingDeckSessionDependencies {
  return {
    history: overrides.history || createBrowserDeckHistory(window),
    viewport: overrides.viewport || createBrowserDeckViewport(window),
    effects: overrides.effects || createDefaultEffects(),
  };
}

export function attachReadingDeck(
  root: Document = document,
  overrides: Partial<ReadingDeckSessionDependencies> = {},
): ReadingDeckHandle | null {
  const dialog = root.querySelector<HTMLDialogElement>('dialog[data-reading-deck]');
  if (!dialog) return null;
  try {
    return ReadingDeckSession.attach(dialog, createReadingDeckDependencies(overrides));
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[reading-deck]', error);
    return null;
  }
}
