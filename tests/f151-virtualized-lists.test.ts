import { describe, expect, it } from 'vitest';
import { virtualScrollTarget, virtualWindow } from '../apps/desktop/src/renderer/virtualized-list.js';

describe('F151 virtualized lists', () => {
  it('only renders the visible window plus a bounded overscan', () => {
    expect(virtualWindow(10_000, 5_000, 400, 40)).toEqual({ start: 120, end: 140, totalHeight: 400_000 });
  });

  it('clamps the window at both ends of the collection', () => {
    expect(virtualWindow(3, 0, 400, 40)).toEqual({ start: 0, end: 3, totalHeight: 120 });
    expect(virtualWindow(10, 10_000, 400, 40)).toEqual({ start: 10, end: 10, totalHeight: 400 });
  });

  it('maps keyboard navigation to bounded scroll targets', () => {
    expect(virtualScrollTarget('ArrowDown', 40, 4_000, 400, 40)).toBe(80);
    expect(virtualScrollTarget('PageDown', 0, 4_000, 400, 40)).toBe(360);
    expect(virtualScrollTarget('End', 0, 4_000, 400, 40)).toBe(3_600);
    expect(virtualScrollTarget('Escape', 0, 4_000, 400, 40)).toBeUndefined();
  });
});
