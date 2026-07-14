import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDesktopTransformTransport } from '@/scripts/reading-deck/transports/desktop-transform';
import type { DeckTransportContext } from '@/scripts/reading-deck/transports/transport';

function geometry(element: HTMLElement, values: Record<string, number>): void {
  Object.entries(values).forEach(([key, value]) => {
    Object.defineProperty(element, key, { configurable: true, value });
  });
}

function fixture(overrides: Partial<DeckTransportContext> = {}) {
  const stage = document.createElement('div');
  const track = document.createElement('div');
  stage.appendChild(track);
  const cards = [0, 1, 2].map((index) => {
    const card = document.createElement('article');
    track.appendChild(card);
    geometry(card, { offsetLeft: index * 220, offsetWidth: 200 });
    return card;
  });
  geometry(stage, { clientWidth: 1000 });
  const requestMove = vi.fn();
  const context: DeckTransportContext = {
    stage,
    track,
    cards,
    selectedIndex: () => 1,
    reducedMotion: () => false,
    requestMove,
    reportSettled: vi.fn(),
    dismissHint: vi.fn(),
    ...overrides,
  };
  return { stage, track, cards, requestMove, context };
}

describe('desktop transform transport', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('centers the selected Card without animation', () => {
    const { context, track } = fixture();
    const transport = createDesktopTransformTransport();
    transport.connect(context);
    transport.present(1, 'none');
    expect(track.style.transform).toBe('translate3d(180px, 0, 0)');
    transport.destroy();
  });

  it('reports one forward intent after a committed horizontal drag', () => {
    const { context, stage, requestMove } = fixture();
    const transport = createDesktopTransformTransport();
    transport.connect(context);
    stage.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, pointerType: 'touch', button: 0, clientX: 300, clientY: 200 }));
    stage.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 230, clientY: 203 }));
    stage.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, pointerType: 'touch', clientX: 230, clientY: 203 }));
    expect(requestMove).toHaveBeenCalledTimes(1);
    expect(requestMove).toHaveBeenCalledWith(1);
    transport.destroy();
  });

  it('does not turn a vertical gesture into navigation', () => {
    const { context, stage, requestMove } = fixture();
    const transport = createDesktopTransformTransport();
    transport.connect(context);
    stage.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, pointerType: 'touch', button: 0, clientX: 300, clientY: 100 }));
    stage.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 294, clientY: 180 }));
    stage.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, pointerType: 'touch', clientX: 294, clientY: 180 }));
    expect(requestMove).not.toHaveBeenCalled();
    transport.destroy();
  });

  it('accumulates horizontal wheel input into one move', () => {
    const { context, stage, requestMove } = fixture();
    const transport = createDesktopTransformTransport();
    transport.connect(context);
    stage.dispatchEvent(new WheelEvent('wheel', { deltaX: 12, deltaY: 1, cancelable: true }));
    stage.dispatchEvent(new WheelEvent('wheel', { deltaX: 14, deltaY: 1, cancelable: true }));
    expect(requestMove).toHaveBeenCalledOnce();
    expect(requestMove).toHaveBeenCalledWith(1);
    transport.destroy();
  });

  it('destroys idempotently and removes listeners', () => {
    const { context, stage, requestMove } = fixture();
    const transport = createDesktopTransformTransport();
    transport.connect(context);
    transport.destroy();
    transport.destroy();
    stage.dispatchEvent(new WheelEvent('wheel', { deltaX: 30, deltaY: 0 }));
    expect(requestMove).not.toHaveBeenCalled();
  });
});
