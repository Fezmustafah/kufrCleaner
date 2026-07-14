import type {
  DeckMotion,
  DeckTransport,
  DeckTransportContext,
} from './transport';

export interface MobileScrollSnapOptions {
  settleDelay?: number;
  onSettledHaptic?: () => void;
}

class MobileScrollSnapTransport implements DeckTransport {
  private context: DeckTransportContext | null = null;
  private browser: Window | null = null;
  private abort: AbortController | null = null;
  private settleTimer = 0;
  private touchActive = false;
  private userDriven = false;
  private pendingProgrammaticIndex: number | null = null;
  private pendingReflow = false;

  constructor(
    private readonly settleDelay: number,
    private readonly onSettledHaptic?: () => void,
  ) {}

  connect(context: DeckTransportContext): void {
    this.destroy();
    this.context = context;
    this.browser = context.track.ownerDocument.defaultView;
    this.abort = new AbortController();
    const { signal } = this.abort;
    context.track.addEventListener('touchstart', () => {
      this.touchActive = true;
      this.userDriven = true;
      this.pendingProgrammaticIndex = null;
      context.dismissHint();
      (this.browser || window).clearTimeout(this.settleTimer);
    }, { passive: true, signal });
    const finishTouch = () => {
      this.touchActive = false;
      this.scheduleSettle();
    };
    context.track.addEventListener('touchend', finishTouch, { passive: true, signal });
    context.track.addEventListener('touchcancel', finishTouch, { passive: true, signal });
    context.track.addEventListener('scroll', () => {
      if (this.pendingProgrammaticIndex == null) this.userDriven = true;
      this.scheduleSettle();
    }, { passive: true, signal });
  }

  present(index: number, motion: DeckMotion): void {
    const context = this.context;
    if (!context || this.touchActive) return;
    const selected = Math.max(0, Math.min(context.cards.length - 1, index));
    const card = context.cards[selected];
    if (!card || card.parentElement !== context.track) return;
    this.pendingProgrammaticIndex = selected;
    this.userDriven = false;
    const left = card.offsetLeft - Math.max(0, (context.track.clientWidth - card.offsetWidth) / 2);
    context.track.scrollTo({
      left: Math.max(0, left),
      behavior: motion === 'animate' && !context.reducedMotion() ? 'smooth' : 'auto',
    });
  }

  reflow(): void {
    if (!this.context) return;
    if (this.touchActive || this.userDriven || this.settleTimer) {
      this.pendingReflow = true;
      return;
    }
    this.present(this.context.selectedIndex(), 'none');
  }

  destroy(): void {
    this.abort?.abort();
    this.abort = null;
    (this.browser || window).clearTimeout(this.settleTimer);
    this.settleTimer = 0;
    this.touchActive = false;
    this.userDriven = false;
    this.pendingProgrammaticIndex = null;
    this.pendingReflow = false;
    this.context = null;
    this.browser = null;
  }

  private scheduleSettle(): void {
    if (this.touchActive || !this.context) return;
    (this.browser || window).clearTimeout(this.settleTimer);
    this.settleTimer = (this.browser || window).setTimeout(() => this.settle(), this.settleDelay);
  }

  private settle(): void {
    const context = this.context;
    if (!context || this.touchActive) return;
    this.settleTimer = 0;
    const center = context.track.scrollLeft + context.track.clientWidth / 2;
    let nearest = context.selectedIndex();
    let distance = Number.POSITIVE_INFINITY;
    context.cards.forEach((card, index) => {
      if (card.parentElement !== context.track) return;
      const candidate = Math.abs(card.offsetLeft + card.offsetWidth / 2 - center);
      if (candidate < distance) {
        distance = candidate;
        nearest = index;
      }
    });

    const programmatic = this.pendingProgrammaticIndex === nearest;
    const changed = nearest !== context.selectedIndex();
    this.pendingProgrammaticIndex = null;
    if (!programmatic && changed) {
      context.reportSettled(nearest);
      if (this.userDriven) this.onSettledHaptic?.();
    }
    this.userDriven = false;
    if (this.pendingReflow) {
      this.pendingReflow = false;
      this.present(context.selectedIndex(), 'none');
    }
  }
}

export function createMobileScrollSnapTransport(
  options: MobileScrollSnapOptions = {},
): DeckTransport {
  return new MobileScrollSnapTransport(options.settleDelay ?? 120, options.onSettledHaptic);
}
