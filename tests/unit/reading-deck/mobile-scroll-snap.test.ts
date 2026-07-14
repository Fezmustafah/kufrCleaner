import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMobileScrollSnapTransport } from '@/scripts/reading-deck/transports/mobile-scroll-snap';
import type { DeckTransportContext } from '@/scripts/reading-deck/transports/transport';

function geometry(element: HTMLElement, values: Record<string, number>): void {
  Object.entries(values).forEach(([key, value]) => {
    Object.defineProperty(element, key, { configurable: true, value });
  });
}

function fixture() {
  const stage = document.createElement('div');
  const track = document.createElement('div');
  stage.appendChild(track);
  const cards = [0, 1, 2].map((index) => {
    const card = document.createElement('article');
    track.appendChild(card);
    geometry(card, { offsetLeft: index * 420, offsetWidth: 390 });
    return card;
  });
  geometry(track, { clientWidth: 390 });
  track.scrollTo = vi.fn((options?: ScrollToOptions | number, _y?: number) => {
    if (typeof options === 'object' && typeof options.left === 'number') track.scrollLeft = options.left;
  });
  let selected = 0;
  const reportSettled = vi.fn((index: number) => { selected = index; });
  const context: DeckTransportContext = {
    stage,
    track,
    cards,
    selectedIndex: () => selected,
    reducedMotion: () => false,
    requestMove: vi.fn(),
    reportSettled,
    dismissHint: vi.fn(),
  };
  return { track, cards, context, reportSettled, setSelected: (index: number) => { selected = index; } };
}

describe('mobile scroll snap transport', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not present the old Card while a native swipe is active', () => {
    const { context, track } = fixture();
    const transport = createMobileScrollSnapTransport();
    transport.connect(context);
    track.dispatchEvent(new TouchEvent('touchstart'));
    track.scrollLeft = 420;
    track.dispatchEvent(new Event('scroll'));
    transport.reflow();
    expect(track.scrollLeft).toBe(420);
    expect(context.reportSettled).not.toHaveBeenCalled();
    transport.destroy();
  });

  it('reports the nearest Card after user settlement with one haptic', () => {
    vi.useFakeTimers();
    const onSettledHaptic = vi.fn();
    const { context, track, reportSettled } = fixture();
    const transport = createMobileScrollSnapTransport({ onSettledHaptic });
    transport.connect(context);
    track.dispatchEvent(new TouchEvent('touchstart'));
    track.scrollLeft = 420;
    track.dispatchEvent(new Event('scroll'));
    track.dispatchEvent(new TouchEvent('touchend'));
    vi.advanceTimersByTime(120);
    expect(reportSettled).toHaveBeenCalledWith(1);
    expect(onSettledHaptic).toHaveBeenCalledOnce();
    transport.destroy();
  });

  it('deduplicates programmatic scrolling settlement', () => {
    vi.useFakeTimers();
    const { context, track, reportSettled, setSelected } = fixture();
    const transport = createMobileScrollSnapTransport();
    transport.connect(context);
    setSelected(1);
    transport.present(1, 'animate');
    track.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(120);
    expect(reportSettled).not.toHaveBeenCalled();
    transport.destroy();
  });

  it('clears settlement timers on idempotent destroy', () => {
    vi.useFakeTimers();
    const { context, track, reportSettled } = fixture();
    const transport = createMobileScrollSnapTransport();
    transport.connect(context);
    track.dispatchEvent(new Event('scroll'));
    transport.destroy();
    transport.destroy();
    vi.runAllTimers();
    expect(reportSettled).not.toHaveBeenCalled();
  });
});
