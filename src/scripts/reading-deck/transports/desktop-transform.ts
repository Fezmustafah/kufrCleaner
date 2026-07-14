import type {
  DeckMotion,
  DeckTransport,
  DeckTransportContext,
} from './transport';

class DesktopTransformTransport implements DeckTransport {
  private context: DeckTransportContext | null = null;
  private abort: AbortController | null = null;
  private offsets: number[] = [];
  private resizeFrame = 0;
  private wheelLockedUntil = 0;

  connect(context: DeckTransportContext): void {
    this.destroy();
    this.context = context;
    this.abort = new AbortController();
    const { signal } = this.abort;
    this.bindPointer(signal);
    this.bindTrackpad(signal);
    this.measure();
  }

  present(index: number, motion: DeckMotion): void {
    const context = this.context;
    if (!context?.cards.length) return;
    if (this.offsets.length !== context.cards.length) this.measure();
    const selected = Math.max(0, Math.min(context.cards.length - 1, index));
    const offset = this.offsets[selected] || 0;
    const animate = motion === 'animate' && !context.reducedMotion();
    if (!animate) {
      const transition = context.track.style.transition;
      context.track.style.transition = 'none';
      context.track.style.transform = `translate3d(${Math.round(offset)}px, 0, 0)`;
      void context.track.offsetWidth;
      context.track.style.transition = transition;
      return;
    }
    context.track.style.transform = `translate3d(${Math.round(offset)}px, 0, 0)`;
  }

  reflow(): void {
    this.offsets = [];
    if (this.resizeFrame || !this.context) return;
    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = 0;
      if (!this.context) return;
      this.measure();
      this.present(this.context.selectedIndex(), 'none');
    });
  }

  destroy(): void {
    this.abort?.abort();
    this.abort = null;
    if (this.resizeFrame) cancelAnimationFrame(this.resizeFrame);
    this.resizeFrame = 0;
    this.offsets = [];
    this.wheelLockedUntil = 0;
    this.context = null;
  }

  private measure(): void {
    const context = this.context;
    if (!context) return;
    const style = getComputedStyle(context.stage);
    const width = context.stage.clientWidth
      - Number.parseFloat(style.paddingLeft || '0')
      - Number.parseFloat(style.paddingRight || '0');
    const center = width / 2;
    this.offsets = context.cards.map((card) => center - (card.offsetLeft + card.offsetWidth / 2));
  }

  private bindPointer(signal: AbortSignal): void {
    const context = this.context;
    if (!context) return;
    let live = false;
    let axis: '' | 'x' | 'y' = '';
    let pointerId = -1;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastTime = 0;
    let velocity = 0;
    let baseOffset = 0;
    const hasSelection = () => Boolean(window.getSelection?.()?.toString());

    context.stage.addEventListener('pointerdown', (event) => {
      const target = event.target as Element;
      const mouseOnCard = event.pointerType === 'mouse' && Boolean(target.closest('.reading-deck-card'));
      if (event.button !== 0 || mouseOnCard || hasSelection()) return;
      live = true;
      axis = '';
      pointerId = event.pointerId;
      startX = lastX = event.clientX;
      startY = event.clientY;
      lastTime = event.timeStamp;
      velocity = 0;
      if (this.offsets.length !== context.cards.length) this.measure();
      baseOffset = this.offsets[context.selectedIndex()] || 0;
    }, { signal });

    context.stage.addEventListener('pointermove', (event) => {
      if (!live) return;
      if (hasSelection()) { live = false; axis = ''; return; }
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (!axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
      }
      if (axis !== 'x') return;
      event.preventDefault();
      if (!context.stage.hasPointerCapture(pointerId)) context.stage.setPointerCapture(pointerId);
      context.dismissHint();
      const elapsed = event.timeStamp - lastTime;
      if (elapsed > 0) velocity = (event.clientX - lastX) / elapsed;
      lastX = event.clientX;
      lastTime = event.timeStamp;
      const selected = context.selectedIndex();
      const atStart = selected === 0 && dx > 0;
      const atEnd = selected === context.cards.length - 1 && dx < 0;
      const drag = atStart || atEnd ? dx * 0.22 : dx;
      context.stage.classList.add('is-dragging');
      context.track.style.transition = 'none';
      context.track.style.transform = `translate3d(${Math.round(baseOffset + drag)}px, 0, 0)`;
    }, { signal });

    const end = (cancelled: boolean) => {
      if (!live) return;
      live = false;
      context.stage.classList.remove('is-dragging');
      context.track.style.transition = '';
      if (!cancelled && axis === 'x' && !hasSelection()) {
        const distance = startX - lastX;
        if (Math.abs(distance) >= 44 || Math.abs(velocity) >= 0.35) {
          context.requestMove(distance > 0 ? 1 : -1);
        } else {
          this.present(context.selectedIndex(), 'animate');
        }
      } else if (axis === 'x') {
        this.present(context.selectedIndex(), 'animate');
      }
      axis = '';
      pointerId = -1;
    };
    context.stage.addEventListener('pointerup', () => end(false), { signal });
    context.stage.addEventListener('pointercancel', () => end(true), { signal });
  }

  private bindTrackpad(signal: AbortSignal): void {
    const context = this.context;
    if (!context) return;
    let accumulated = 0;
    let lastWheelAt = 0;
    context.stage.addEventListener('wheel', (event) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      const now = performance.now();
      if (now - lastWheelAt > 180) accumulated = 0;
      lastWheelAt = now;
      if (now < this.wheelLockedUntil) return;
      accumulated += event.deltaX;
      if (Math.abs(accumulated) < 24) return;
      this.wheelLockedUntil = now + 420;
      context.requestMove(accumulated > 0 ? 1 : -1);
      accumulated = 0;
    }, { passive: false, signal });
  }
}

export function createDesktopTransformTransport(): DeckTransport {
  return new DesktopTransformTransport();
}
