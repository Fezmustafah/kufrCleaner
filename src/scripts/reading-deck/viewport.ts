export interface DeckViewportSnapshot {
  mobile: boolean;
  reducedMotion: boolean;
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface DeckViewport {
  snapshot(): DeckViewportSnapshot;
  subscribe(listener: (snapshot: DeckViewportSnapshot) => void): () => void;
}

export interface TestDeckViewport extends DeckViewport {
  set(update: Partial<DeckViewportSnapshot>): void;
}

const DEFAULT_VIEWPORT: DeckViewportSnapshot = {
  mobile: false,
  reducedMotion: false,
  top: 0,
  left: 0,
  width: 1024,
  height: 768,
};

export function applyViewportCss(
  element: HTMLElement,
  viewport: DeckViewportSnapshot,
): void {
  element.style.setProperty('--deck-viewport-top', `${viewport.top}px`);
  element.style.setProperty('--deck-viewport-left', `${viewport.left}px`);
  element.style.setProperty('--deck-viewport-width', `${viewport.width}px`);
  element.style.setProperty('--deck-viewport-height', `${viewport.height}px`);
}

export function createBrowserDeckViewport(browser: Window = window): DeckViewport {
  const mobile = browser.matchMedia('(max-width: 720px)');
  const reducedMotion = browser.matchMedia('(prefers-reduced-motion: reduce)');

  const snapshot = (): DeckViewportSnapshot => {
    const visual = browser.visualViewport;
    return {
      mobile: mobile.matches,
      reducedMotion: reducedMotion.matches,
      top: visual?.offsetTop || 0,
      left: visual?.offsetLeft || 0,
      width: visual?.width || browser.innerWidth,
      height: visual?.height || browser.innerHeight,
    };
  };

  return {
    snapshot,
    subscribe(listener) {
      const notify = () => listener(snapshot());
      browser.addEventListener('resize', notify);
      mobile.addEventListener('change', notify);
      reducedMotion.addEventListener('change', notify);
      browser.visualViewport?.addEventListener('resize', notify);
      browser.visualViewport?.addEventListener('scroll', notify);

      return () => {
        browser.removeEventListener('resize', notify);
        mobile.removeEventListener('change', notify);
        reducedMotion.removeEventListener('change', notify);
        browser.visualViewport?.removeEventListener('resize', notify);
        browser.visualViewport?.removeEventListener('scroll', notify);
      };
    },
  };
}

export function createTestDeckViewport(
  initial: Partial<DeckViewportSnapshot> = {},
): TestDeckViewport {
  let current = { ...DEFAULT_VIEWPORT, ...initial };
  const listeners = new Set<(snapshot: DeckViewportSnapshot) => void>();

  return {
    snapshot: () => ({ ...current }),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(update) {
      current = { ...current, ...update };
      const next = { ...current };
      listeners.forEach((listener) => listener(next));
    },
  };
}
