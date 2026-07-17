// Deep read pane layout — a pure function of horizontal scroll position.
// Panes are canonically fixed-width at i*paneWidth. As the reader scrolls
// right, the passed prefix collapses; only the last `maxSpines` passed
// sections stay on screen as stacked spines, so a many-section article can
// never flood the viewport with spines.

export interface PanesGeometryOptions {
  paneWidth: number;   // px — canonical (expanded) pane width
  spineWidth: number;  // px — visible width of one collapsed spine (40)
  maxSpines?: number;  // default 2
}

export type PaneRole = 'spine' | 'active' | 'ahead' | 'hidden';

export interface PaneLayout {
  index: number;
  role: PaneRole;
  left: number | null; // px for sticky panes; null = not pinned (ahead)
}

export function computePaneLayout(
  scrollLeft: number,
  count: number,
  opts: PanesGeometryOptions,
): PaneLayout[] {
  const { paneWidth, spineWidth } = opts;
  const maxSpines = opts.maxSpines ?? 2;
  const spineZone = spineWidth * maxSpines;

  // Passed panes form a contiguous prefix (the condition is monotonic in i).
  let passedCount = 0;
  for (let i = 0; i < count; i++) {
    if ((i + 1) * paneWidth - scrollLeft <= spineZone) passedCount++;
    else break;
  }

  const active = Math.min(passedCount, Math.max(0, count - 1));
  const visibleSpines = Math.min(passedCount, maxSpines);
  const firstSpine = active - visibleSpines; // index of the oldest visible spine

  return Array.from({ length: count }, (_, i): PaneLayout => {
    if (i < firstSpine) return { index: i, role: 'hidden', left: null };
    if (i < active) return { index: i, role: 'spine', left: (i - firstSpine) * spineWidth };
    if (i === active) return { index: i, role: 'active', left: visibleSpines * spineWidth };
    return { index: i, role: 'ahead', left: null };
  });
}
