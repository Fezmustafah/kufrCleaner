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

function createDefaultEffects(browser: Window): ReadingDeckEffects {
  const haptics = new WebHaptics({ debug: false, showSwitch: true });
  return {
    haptic() {
      void haptics.trigger('selection').catch(() => {});
    },
    initializeArticleEnhancements() {
      browser.initializeWikilinks?.();
      browser.initializeAnnotations?.({ animate: false });
      browser.initializeMermaid?.();
    },
    openSearch() {
      browser.searchPalette?.open();
    },
    openMenu() {
      browser.__setNavDrawer?.(true);
    },
    async share(data) {
      try {
        if (browser.navigator.share) {
          await browser.navigator.share(data);
          return 'shared';
        }
        await browser.navigator.clipboard.writeText(data.url || '');
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
  browser: Window = window,
): ReadingDeckSessionDependencies {
  return {
    history: overrides.history || createBrowserDeckHistory(browser),
    viewport: overrides.viewport || createBrowserDeckViewport(browser),
    effects: overrides.effects || createDefaultEffects(browser),
  };
}

export function attachReadingDeck(
  root: Document = document,
  overrides: Partial<ReadingDeckSessionDependencies> = {},
): ReadingDeckHandle | null {
  const dialog = root.querySelector<HTMLDialogElement>('dialog[data-reading-deck]');
  if (!dialog) return null;
  try {
    const browser = root.defaultView || window;
    return ReadingDeckSession.attach(dialog, createReadingDeckDependencies(overrides, browser));
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[reading-deck]', error);
    return null;
  }
}
