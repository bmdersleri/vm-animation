import { describe, expect, it } from 'vitest';
import { dendrogramData as D, type Linkage } from '../../../src/concepts/dendrogram/data';

const NAMES: readonly Linkage[] = ['ward', 'complete', 'average', 'single'];

function members(name: Linkage, id: number): number[] {
  const n = D.points.length;
  if (id < n) return [id];
  const m = D.linkages[name].merges[id - n];
  return [...members(name, m.a), ...members(name, m.b)];
}

function sse(idx: readonly number[]): number {
  const p = idx.map((i) => D.points[i]);
  const cx = p.reduce((s, q) => s + q[0], 0) / p.length;
  const cy = p.reduce((s, q) => s + q[1], 0) / p.length;
  return p.reduce((s, q) => s + (q[0] - cx) ** 2 + (q[1] - cy) ** 2, 0);
}

describe('dendrogram data', () => {
  it('17 points', () => {
    expect(D.points).toHaveLength(17);
    const { A, B, C, zincir } = D.meta.groups;
    expect([...A, ...B, ...C, ...zincir].sort((a, b) => a - b)).toEqual(Array.from({ length: 17 }, (_, i) => i));
    expect([A.length, B.length, C.length, zincir.length]).toEqual([5, 5, 3, 4]);
    for (const [x, y] of D.points) {
      expect(Math.round(x * 100) / 100).toBe(x);
      expect(Math.round(y * 100) / 100).toBe(y);
    }
  });

  it('heights strictly increase by >= 0.05 in every linkage', () => {
    for (const name of NAMES) {
      const hs = D.linkages[name].merges.map((m) => m.height);
      expect(hs).toHaveLength(16);
      for (let i = 1; i < hs.length; i++) {
        expect(hs[i] - hs[i - 1], `${name} ${i}`).toBeGreaterThanOrEqual(0.05 - 1e-9);
      }
    }
  });

  it('merge sizes add up', () => {
    for (const name of NAMES) {
      const ld = D.linkages[name];
      const size = (id: number): number => (id < 17 ? 1 : ld.merges[id - 17].size);
      ld.merges.forEach((m, i) => {
        expect(m.size).toBe(size(m.a) + size(m.b));
        expect(m.a).toBeLessThan(17 + i);
        expect(m.b).toBeLessThan(17 + i);
      });
      expect(ld.merges[15].size).toBe(17);
      expect([...ld.leaves].sort((a, b) => a - b)).toEqual(Array.from({ length: 17 }, (_, i) => i));
    }
  });

  it('wardExample increase equals a direct SSE computation', () => {
    const m = D.linkages.ward.merges[D.wardExample.merge];
    const a = members('ward', m.a);
    const b = members('ward', m.b);
    const direct = sse([...a, ...b]) - sse(a) - sse(b);
    expect(D.wardExample.merge).toBe(3);
    expect(D.wardExample.increase).toBeCloseTo(direct, 5);
    expect(D.wardExample.increase).toBeCloseTo(m.height ** 2 / 2, 5);
  });
});
