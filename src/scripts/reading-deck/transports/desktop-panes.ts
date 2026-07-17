import type { DeckMotion, DeckTransport, DeckTransportContext } from './transport';

// Deep read — Matuschak-style sliding panes across headings. Each card is a
// full-width pane; panes before the selected one collapse to a 40px vertical
// spine (a clickable heading breadcrumb) that pins on the left via CSS sticky.
// Collapse state is derived from the selected index (deterministic), so the
// sticky pinning — not fragile scroll math — does the visual stacking.

const SPINE_WIDTH = 40; // px — matches the reference --note-title-width (2.5rem)

class DesktopPanesTransport implements DeckTransport {
  private context: DeckTransportContext | null = null;
  private browser: Window | null = null;
  private abort: AbortController | null = null;
  private spines: HTMLButtonElement[] = [];
  private resizeFrame = 0;
  private settleTimer = 0;
  private programmatic = false;

  connect(context: DeckTransportContext): void {
    this.destroy();
    this.context = context;
    this.browser = context.track.ownerDocument.defaultView;
    this.abort = new AbortController();
    const { signal } = this.abort;
    context.track.dataset.deckLayout = 'panes';
    this.buildSpines(context);
    context.track.addEventListener('scroll', () => {
      if (this.programmatic) return;
      context.dismissHint();
      this.scheduleSettle();
    }, { passive: true, signal });
  }

  present(index: number, motion: DeckMotion): void {
    const context = this.context;
    if (!context?.cards.length) return;
    const selected = Math.max(0, Math.min(context.cards.length - 1, index));

    // ponytail: collapse everything left of the selected pane; cumulative
    // left = (collapsed-so-far) * SPINE_WIDTH so spines stack, not overlap.
    let collapsedLeft = 0;
    context.cards.forEach((pane, i) => {
      const collapsed = i < selected;
      pane.classList.toggle('collapsed', collapsed);
      if (collapsed) {
        pane.style.left = `${collapsedLeft}px`;
        collapsedLeft += SPINE_WIDTH;
      } else {
        pane.style.removeProperty('left');
      }
    });

    const pane = context.cards[selected];
    if (!pane) return;
    this.programmatic = true;
    context.track.scrollTo({
      left: Math.max(0, pane.offsetLeft - collapsedLeft),
      behavior: motion === 'animate' && !context.reducedMotion() ? 'smooth' : 'auto',
    });
    // Release the programmatic guard after the scroll settles.
    (this.browser || window).clearTimeout(this.settleTimer);
    this.settleTimer = (this.browser || window).setTimeout(() => {
      this.programmatic = false;
      this.settleTimer = 0;
    }, motion === 'animate' ? 360 : 60);
  }

  reflow(): void {
    if (this.resizeFrame || !this.context) return;
    this.resizeFrame = (this.browser || window).requestAnimationFrame(() => {
      this.resizeFrame = 0;
      if (this.context) this.present(this.context.selectedIndex(), 'none');
    });
  }

  destroy(): void {
    this.abort?.abort();
    this.abort = null;
    const browser = this.browser || window;
    if (this.resizeFrame) browser.cancelAnimationFrame(this.resizeFrame);
    if (this.settleTimer) browser.clearTimeout(this.settleTimer);
    this.resizeFrame = 0;
    this.settleTimer = 0;
    this.programmatic = false;
    this.spines.forEach((spine) => spine.remove());
    this.spines = [];
    this.context?.cards.forEach((pane) => {
      pane.classList.remove('collapsed');
      pane.style.removeProperty('left');
    });
    if (this.context) delete this.context.track.dataset.deckLayout;
    this.context = null;
    this.browser = null;
  }

  private buildSpines(context: DeckTransportContext): void {
    const doc = context.track.ownerDocument;
    context.cards.forEach((pane, index) => {
      // The finish/completion card is not a heading section — no spine.
      if (pane.hasAttribute('data-deck-finish')) return;
      if (pane.querySelector(':scope > .reading-deck-spine')) return;
      const heading = pane.querySelector('h2, h3');
      const label = heading?.textContent?.trim() || `Section ${index + 1}`;
      const spine = doc.createElement('button');
      spine.type = 'button';
      spine.className = 'reading-deck-spine';
      spine.textContent = label;
      spine.setAttribute('aria-label', `Jump to ${label}`);
      spine.addEventListener('click', () => context.requestSelect?.(index), { signal: this.abort!.signal });
      pane.prepend(spine);
      this.spines.push(spine);
    });
  }

  private scheduleSettle(): void {
    if (!this.context) return;
    (this.browser || window).clearTimeout(this.settleTimer);
    this.settleTimer = (this.browser || window).setTimeout(() => this.settle(), 140);
  }

  private settle(): void {
    const context = this.context;
    this.settleTimer = 0;
    if (!context || this.programmatic) return;
    // Nearest expanded pane to the left edge (after the pinned spine stack).
    const collapsedCount = context.cards.filter((_, i) => i < context.selectedIndex()).length;
    const edge = context.track.scrollLeft + collapsedCount * SPINE_WIDTH;
    let nearest = context.selectedIndex();
    let distance = Number.POSITIVE_INFINITY;
    context.cards.forEach((pane, index) => {
      if (pane.classList.contains('collapsed')) return;
      const candidate = Math.abs(pane.offsetLeft - edge);
      if (candidate < distance) {
        distance = candidate;
        nearest = index;
      }
    });
    if (nearest !== context.selectedIndex()) context.reportSettled(nearest);
  }
}

export function createDesktopPanesTransport(): DeckTransport {
  return new DesktopPanesTransport();
}
