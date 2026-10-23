import { describe, it, expect } from 'vitest';
import { curvePath, curvePathV, areaPath } from '../../../src/core/plot/density';

const id = (x: number) => x;

describe('density paths', () => {
  it('samples endpoints and rounds coordinates', () => {
    expect(curvePath(id, 0, 1, 3, id, id)).toBe('M0,0L0.5,0.5L1,1');
  });

  it('closes the area and sorts reversed bounds', () => {
    const a = areaPath(id, 0, 1, 3, id, id, 2);
    expect(a).toBe('M0,2L0,0L0.5,0.5L1,1L1,2Z');
    expect(areaPath(id, 1, 0, 3, id, id, 2)).toBe(a);
  });

  it('keeps every sample within interval bounds', () => {
    const path = areaPath((x) => x * x, 2, 4, 7, id, id, 0);
    const xs = [...path.matchAll(/[ML]([0-9.]+),/g)].map((m) => Number(m[1]));
    expect(xs.every((x) => x >= 2 && x <= 4)).toBe(true);
    expect(curvePath(id, 0, 1, 7, id, id).match(/[ML]/g)).toHaveLength(7);
  });

  it('returns no area for equal bounds', () => {
    expect(areaPath(id, 1, 1, 3, id, id, 2)).toBe('');
  });

  it('turns the curve on its side: argument along y, value along x', () => {
    const f = (y: number) => 2 * y;
    expect(curvePathV(f, 0, 1, 3, (v) => 10 + v, (y) => 100 - y)).toBe('M10,100L11,99.5L12,99');
  });

  it('rejects fewer than two samples', () => {
    expect(() => curvePath(id, 0, 1, 1, id, id)).toThrow(RangeError);
    expect(() => curvePathV(id, 0, 1, 1.5, id, id)).toThrow(RangeError);
  });
});
