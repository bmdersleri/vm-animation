import { describe, it, expect } from 'vitest';
import { segmentsFrom, stepPath } from '../../../src/core/plot/step-line';

const id = (v: number): number => v;

describe('step line', () => {
  it('one path with a jump at each threshold', () => {
    const segs = [
      { x0: 0, x1: 2, y: 1 },
      { x0: 2, x1: 5, y: 3 },
      { x0: 5, x1: 10, y: 2 },
    ];
    const d = stepPath(segs, id, id);
    expect(d.match(/M/g)).toHaveLength(1);
    expect(d).toBe('M0,1L2,1L2,3L5,3L5,2L10,2');
    // a vertical jump is two consecutive points with the same x
    const pts = d.slice(1).split('L').map((p) => p.split(',').map(Number));
    const jumps = pts.filter((p, i) => i > 0 && p[0] === pts[i - 1][0]);
    expect(jumps).toHaveLength(segs.length - 1);
  });

  it('segments from thresholds cover the range', () => {
    const segs = segmentsFrom([6, 2, 2, 20, -1], (x) => x * 10, 0, 10);
    expect(segs.map((s) => [s.x0, s.x1])).toEqual([
      [0, 2],
      [2, 6],
      [6, 10],
    ]);
    expect(segs.map((s) => s.y)).toEqual([10, 40, 80]);
    expect(segmentsFrom([], () => 7, 0, 10)).toEqual([{ x0: 0, x1: 10, y: 7 }]);
  });
});
