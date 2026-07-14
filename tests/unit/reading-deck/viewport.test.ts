import { describe, expect, it, vi } from 'vitest';
import {
  applyViewportCss,
  createTestDeckViewport,
} from '@/scripts/reading-deck/viewport';

describe('Reading Deck viewport', () => {
  it('reports deterministic mobile and reduced-motion state', () => {
    const viewport = createTestDeckViewport({
      mobile: true,
      reducedMotion: true,
      top: 12,
      left: 4,
      width: 390,
      height: 700,
    });
    expect(viewport.snapshot()).toEqual({
      mobile: true,
      reducedMotion: true,
      top: 12,
      left: 4,
      width: 390,
      height: 700,
    });
  });

  it('applies visual viewport geometry to the dialog', () => {
    const dialog = document.createElement('dialog');
    applyViewportCss(dialog, {
      mobile: true,
      reducedMotion: false,
      top: 12,
      left: 4,
      width: 390,
      height: 700,
    });
    expect(dialog.style.getPropertyValue('--deck-viewport-top')).toBe('12px');
    expect(dialog.style.getPropertyValue('--deck-viewport-left')).toBe('4px');
    expect(dialog.style.getPropertyValue('--deck-viewport-width')).toBe('390px');
    expect(dialog.style.getPropertyValue('--deck-viewport-height')).toBe('700px');
  });

  it('notifies subscribers and stops after disposal', () => {
    const viewport = createTestDeckViewport();
    const listener = vi.fn();
    const dispose = viewport.subscribe(listener);
    viewport.set({ mobile: true, width: 390 });
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ mobile: true, width: 390 }));
    dispose();
    viewport.set({ mobile: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
