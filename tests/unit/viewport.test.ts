import { describe, it, expect } from 'vitest';
import { fitEqualAspect, fitViewport } from '../../src/concepts/knn/viewport';

const domain = { x: [0, 10] as [number, number], y: [0, 100] as [number, number] };
const rect = { left: 20, top: 10, width: 500, height: 300 };

describe('fitEqualAspect', () => {
  it('equal px per unit on both axes', () => {
    const { x, y } = fitEqualAspect(domain, { left: 0, top: 0, width: 500, height: 300 });
    expect(x(1) - x(0)).toBeCloseTo(y(0) - y(1), 9);
    expect(x(1) - x(0)).toBeGreaterThan(0);
  });

  it('content fits inside rect, centred, y inverted', () => {
    const { x, y } = fitEqualAspect(domain, rect);
    const eps = 1e-9;
    expect(x(0)).toBeGreaterThanOrEqual(rect.left - eps);
    expect(x(10)).toBeLessThanOrEqual(rect.left + rect.width + eps);
    expect(y(100)).toBeGreaterThanOrEqual(rect.top - eps);
    expect(y(0)).toBeLessThanOrEqual(rect.top + rect.height + eps);
    expect((x(0) + x(10)) / 2).toBeCloseTo(rect.left + rect.width / 2, 9);
    expect((y(0) + y(100)) / 2).toBeCloseTo(rect.top + rect.height / 2, 9);
    expect(y(0)).toBeGreaterThan(y(100));
    // the limiting axis (y: 100 units in 300 px) fills the rect exactly
    expect(y(0) - y(100)).toBeCloseTo(rect.height, 9);
  });
});

describe('fitViewport', () => {
  it('equalAspect=false: independent scales fill the rect exactly', () => {
    const { x, y } = fitViewport(domain, rect, false);
    expect(x.domain()).toEqual([0, 10]);
    expect(y.domain()).toEqual([0, 100]);
    expect(x(0)).toBe(rect.left);
    expect(x(10)).toBe(rect.left + rect.width);
    expect(y(0)).toBe(rect.top + rect.height);
    expect(y(100)).toBe(rect.top);
  });

  it('equalAspect=true: same mapping as fitEqualAspect, scale extent covers the rect', () => {
    const a = fitEqualAspect(domain, rect);
    const b = fitViewport(domain, rect, true);
    for (const v of [0, 3.5, 10]) expect(b.x(v)).toBeCloseTo(a.x(v), 9);
    for (const v of [0, 42, 100]) expect(b.y(v)).toBeCloseTo(a.y(v), 9);
    expect(b.x.range()[0]).toBeCloseTo(rect.left, 9);
    expect(b.x.range()[1]).toBeCloseTo(rect.left + rect.width, 9);
    expect(b.y.range()[0]).toBeCloseTo(rect.top + rect.height, 9);
    expect(b.y.range()[1]).toBeCloseTo(rect.top, 9);
    // domain grows outward only: the data domain is still fully inside
    expect(b.x.domain()[0]).toBeLessThanOrEqual(0);
    expect(b.x.domain()[1]).toBeGreaterThanOrEqual(10);
  });
});
