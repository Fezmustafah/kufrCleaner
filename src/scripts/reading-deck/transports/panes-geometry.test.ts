import { describe, it, expect } from 'vitest';
import { computePaneLayout } from './panes-geometry';

const OPTS = { paneWidth: 600, spineWidth: 40, maxSpines: 2 };

describe('computePaneLayout', () => {
  it('at scrollLeft 0, pane 0 is active and the rest are ahead', () => {
    const layout = computePaneLayout(0, 5, OPTS);
    expect(layout.map((p) => p.role)).toEqual(['active', 'ahead', 'ahead', 'ahead', 'ahead']);
    expect(layout[0].left).toBe(0);
    expect(layout[1].left).toBeNull();
  });

  it('with two panes passed, shows two stacked spines then the active pane', () => {
    // pane0 right=600, pane1 right=1200; spineZone=80. scrollLeft=1250 passes 0 and 1.
    const layout = computePaneLayout(1250, 5, OPTS);
    expect(layout.map((p) => p.role)).toEqual(['spine', 'spine', 'active', 'ahead', 'ahead']);
    expect(layout[0].left).toBe(0);   // older spine
    expect(layout[1].left).toBe(40);  // newer spine, offset by one spine width
    expect(layout[2].left).toBe(80);  // active clears the 2-spine zone
  });

  it('caps visible spines at two — older passed panes become hidden', () => {
    // scrollLeft=1900 passes 0,1,2. Window keeps the two most-recent (1,2); 0 is hidden.
    const layout = computePaneLayout(1900, 5, OPTS);
    expect(layout.map((p) => p.role)).toEqual(['hidden', 'spine', 'spine', 'active', 'ahead']);
    expect(layout[1].left).toBe(0);
    expect(layout[2].left).toBe(40);
    expect(layout[3].left).toBe(80);
  });

  it('with one pane passed, shows one spine and a 40px active offset', () => {
    const layout = computePaneLayout(650, 5, OPTS); // pane0 right=600 passed, pane1 not
    expect(layout.map((p) => p.role)).toEqual(['spine', 'active', 'ahead', 'ahead', 'ahead']);
    expect(layout[0].left).toBe(0);
    expect(layout[1].left).toBe(40);
  });

  it('degrades to a single active pane when count is 1', () => {
    const layout = computePaneLayout(0, 1, OPTS);
    expect(layout).toEqual([{ index: 0, role: 'active', left: 0 }]);
  });
});
