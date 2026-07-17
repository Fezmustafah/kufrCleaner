import type { DeckMotion, DeckTransport, DeckTransportContext } from './transport';
import { computePaneLayout } from './panes-geometry';

// Deep read — within-article sliding panes. Each card is a full-width, sticky
// pane. As the reader scrolls right, the passed prefix collapses; only the two
// most-recently-passed sections stay on screen as stacked, clickable spines
// (older ones scroll away, reachable via the contents index). Collapse is a
// pure function of scroll position — never of animated width — so free scroll,
// spine clicks, and contents jumps all agree and nothing drifts.

const MAX_SPINES = 2;

class DesktopPanesTransport implements DeckTransport {
  private context: DeckTransportContext | null = null;
  private browser: Window | null = null;
  private abort: AbortController | null = null;
  private spines: HTMLButtonElement[] = [];
  private resizeFrame = 0;
  private scrollFrame = 0;
  private spineWidth = 40;
  private programmatic = false;
  private settleTimer = 0;

  connect(context: DeckTransportContext): void {
    this.destroy();
    this.context = context;
    this.browser = context.track.ownerDocument.defaultView;
    this.abort = new AbortController();
    const { signal } = this.abort;
    context.track.dataset.deckLayout = 'panes';
    this.readSpineWidth(context);
    this.buildSpines(context);
    // Native scroll in both axes: vertical wheel reads a pane, horizontal
    // (scrollbar / shift-wheel / trackpad swipe) moves across panes. We only
    // react to it — recompute the layout and report the active pane.
    context.track.addEventListener('scroll', () => {
      context.dismissHint();
      this.scheduleLayout();
    }, { passive: true, signal });
    // The session positions us via present() immediately after connect();
    // suppress settle-reporting until that scroll lands, so we don't clobber
    // the opening (resume / deep-link) index with a premature reportSettled(0).
    this.programmatic = true;
    this.applyLayout();
  }

  present(index: number, motion: DeckMotion): void {
    const context = this.context;
    if (!context?.cards.length) return;
    const selected = Math.max(0, Math.min(context.cards.length - 1, index));
    const paneWidth = this.paneWidth();
    const spineZone = this.spineWidth * MAX_SPINES;
    const left = Math.max(0, selected * paneWidth - spineZone);
    const smooth = motion === 'animate' && !context.reducedMotion();
    // Scripted scroll: guard settle-reporting until scrollLeft reaches the
    // target, so applyLayout() (which fires on the resulting scroll events)
    // never reports a stale active index back into session state.
    this.programmatic = true;
    context.track.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
    this.applyLayout();
    const browser = this.browser || window;
    browser.clearTimeout(this.settleTimer);
    this.settleTimer = browser.setTimeout(() => {
      this.settleTimer = 0;
      this.programmatic = false;
      this.applyLayout();
    }, smooth ? 420 : 60);
  }

  reflow(): void {
    if (this.resizeFrame || !this.context) return;
    this.resizeFrame = (this.browser || window).requestAnimationFrame(() => {
      this.resizeFrame = 0;
      this.readSpineWidth(this.context!);
      this.applyLayout();
    });
  }

  destroy(): void {
    this.abort?.abort();
    this.abort = null;
    const browser = this.browser || window;
    if (this.resizeFrame) browser.cancelAnimationFrame(this.resizeFrame);
    if (this.scrollFrame) browser.cancelAnimationFrame(this.scrollFrame);
    this.resizeFrame = 0;
    this.scrollFrame = 0;
    if (this.settleTimer) browser.clearTimeout(this.settleTimer);
    this.settleTimer = 0;
    this.programmatic = false;
    this.spines.forEach((spine) => spine.remove());
    this.spines = [];
    this.context?.cards.forEach((pane) => {
      pane.classList.remove('collapsed');
      pane.removeAttribute('data-pane-hidden');
      pane.style.removeProperty('left');
    });
    if (this.context) delete this.context.track.dataset.deckLayout;
    this.context = null;
    this.browser = null;
  }

  private scheduleLayout(): void {
    if (this.scrollFrame || !this.context) return;
    this.scrollFrame = (this.browser || window).requestAnimationFrame(() => {
      this.scrollFrame = 0;
      this.applyLayout();
    });
  }

  private applyLayout(): void {
    const context = this.context;
    if (!context?.cards.length) return;
    const paneWidth = this.paneWidth();
    const layout = computePaneLayout(context.track.scrollLeft, context.cards.length, {
      paneWidth,
      spineWidth: this.spineWidth,
      maxSpines: MAX_SPINES,
    });
    let active = 0;
    layout.forEach((pane) => {
      const el = context.cards[pane.index];
      el.classList.toggle('collapsed', pane.role === 'spine');
      el.toggleAttribute('data-pane-hidden', pane.role === 'hidden');
      if (pane.left == null) el.style.removeProperty('left');
      else el.style.left = `${pane.left}px`;
      if (pane.role === 'active') active = pane.index;
    });
    // Only sync session state from genuine user scrolls — never mid-scripted-scroll.
    if (!this.programmatic && active !== context.selectedIndex()) context.reportSettled(active);
  }

  private paneWidth(): number {
    const first = this.context?.cards[0];
    return first ? first.getBoundingClientRect().width || first.offsetWidth : 640;
  }

  private readSpineWidth(context: DeckTransportContext): void {
    const doc = context.track.ownerDocument;
    const probe = doc.defaultView?.getComputedStyle(context.track).getPropertyValue('--deck-spine-width');
    const parsed = probe ? parseFloat(probe) : NaN;
    this.spineWidth = Number.isFinite(parsed) && parsed > 0 ? parsed : 40;
  }

  private buildSpines(context: DeckTransportContext): void {
    const doc = context.track.ownerDocument;
    context.cards.forEach((pane, index) => {
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
}

export function createDesktopPanesTransport(): DeckTransport {
  return new DesktopPanesTransport();
}
