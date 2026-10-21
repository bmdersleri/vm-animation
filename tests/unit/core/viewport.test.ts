import { describe, it, expect } from 'vitest';
import { fitAspect, fitEqualAspect, fitViewport } from '../../../src/core/plot/viewport';

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

describe('fitAspect', () => {
  it('ratio 1 equals the equal-aspect viewport', () => {
    const a = fitAspect(domain, rect, 1);
    const b = fitViewport(domain, rect, true);
    for (const i of [0, 1]) {
      expect(a.x.domain()[i]).toBeCloseTo(b.x.domain()[i], 9);
      expect(a.y.domain()[i]).toBeCloseTo(b.y.domain()[i], 9);
    }
    expect(a.x.range()).toEqual(b.x.range());
    expect(a.y.range()).toEqual(b.y.range());
  });

  it('keeps the px ratio', () => {
    const { x, y } = fitAspect(domain, rect, 3);
    expect((x(1) - x(0)) / (y(0) - y(1))).toBeCloseTo(3, 9);
  });

  it('contains the domain', () => {
    for (const ratio of [0.2, 1, 3, 10]) {
      const { x, y } = fitAspect(domain, rect, ratio);
      expect(x.domain()[0]).toBeLessThanOrEqual(1e-9);
      expect(x.domain()[1]).toBeGreaterThanOrEqual(10 - 1e-9);
      expect(y.domain()[0]).toBeLessThanOrEqual(1e-9);
      expect(y.domain()[1]).toBeGreaterThanOrEqual(100 - 1e-9);
      expect(x.range()).toEqual([rect.left, rect.left + rect.width]);
    }
  });

  it('anchor defaults to the centre', () => {
    const a = fitAspect(domain, rect, 3);
    const b = fitAspect(domain, rect, 3, 'centre');
    expect(a.x.domain()).toEqual(b.x.domain());
    expect(a.y.domain()).toEqual(b.y.domain());
    // the slack axis (x at ratio 3) grows by the same amount on both sides
    expect(0 - a.x.domain()[0]).toBeGreaterThan(1);
    expect(0 - a.x.domain()[0]).toBeCloseTo(a.x.domain()[1] - 10, 9);
  });

  it("anchor 'min' widens only upward: the minimum stays on the left / bottom edge", () => {
    for (const ratio of [0.2, 1, 3, 10]) {
      const c = fitAspect(domain, rect, ratio, 'centre');
      const m = fitAspect(domain, rect, ratio, 'min');
      expect(m.x.domain()[0]).toBeCloseTo(0, 9);
      expect(m.y.domain()[0]).toBeCloseTo(0, 9);
      expect(m.x(0)).toBeCloseTo(rect.left, 9);
      expect(m.y(0)).toBeCloseTo(rect.top + rect.height, 9);
      // same px per unit and the same extent as the centred fit, only shifted
      expect(m.x.domain()[1] - m.x.domain()[0]).toBeCloseTo(c.x.domain()[1] - c.x.domain()[0], 9);
      expect(m.y.domain()[1] - m.y.domain()[0]).toBeCloseTo(c.y.domain()[1] - c.y.domain()[0], 9);
      expect(m.x.domain()[1]).toBeGreaterThanOrEqual(10 - 1e-9);
      expect(m.y.domain()[1]).toBeGreaterThanOrEqual(100 - 1e-9);
      expect(m.x.range()).toEqual([rect.left, rect.left + rect.width]);
      expect(m.y.range()).toEqual([rect.top + rect.height, rect.top]);
    }
  });

  it("anchor 'min' on the year and day boxes: 0…64 years, 20 TL at the bottom", () => {
    const r = { left: 10, top: 5, width: 640, height: 380 };
    const ratio = r.width / 64 / (r.height / 190);
    const yil = fitAspect({ x: [0, 64 / 12], y: [20, 210] }, r, ratio, 'min');
    expect(yil.x.domain()[0]).toBeCloseTo(0, 9);
    expect(yil.x.domain()[1]).toBeCloseTo(64, 9);
    expect(yil.y.domain()[0]).toBeCloseTo(20, 9);
    expect(yil.y.domain()[1]).toBeCloseTo(210, 9);
    const gun = fitAspect({ x: [0, 64 * 30], y: [20, 210] }, r, ratio, 'min');
    expect(gun.x.domain()[1]).toBeCloseTo(64 * 30, 9);
    expect(gun.y.domain()[0]).toBeCloseTo(20, 9);
    expect(gun.y.domain()[1]).toBeCloseTo(20 + 190 * 30, 6);
  });

  it('month ratio fills the rect', () => {
    const r = { left: 10, top: 5, width: 640, height: 380 };
    const d = { x: [0, 64] as [number, number], y: [20, 210] as [number, number] };
    const { x, y } = fitAspect(d, r, r.width / 64 / (r.height / 190));
    expect(x.domain()[0]).toBeCloseTo(0, 9);
    expect(x.domain()[1]).toBeCloseTo(64, 9);
    expect(y.domain()[0]).toBeCloseTo(20, 9);
    expect(y.domain()[1]).toBeCloseTo(210, 9);
  });
});
