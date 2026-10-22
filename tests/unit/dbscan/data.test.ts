import { describe, expect, it } from 'vitest';
import { dbscanData } from '../../../src/concepts/dbscan/data';
import { dbscan } from '../../../src/concepts/dbscan/dbscan';

const { points, examples, kdist, knee, epsSweep, meta } = dbscanData;
const { eps, minSamples } = meta;

describe('dbscan data', () => {
  it('points are 210 and 6-decimal', () => {
    expect(points).toHaveLength(210);
    expect(dbscanData.kmeansLabels).toHaveLength(210);
    for (const p of points) for (const v of p) expect(Math.abs(v - Number(v.toFixed(6)))).toBeLessThan(1e-12);
  });

  it('examples have the kinds their names say at 0.3 / 5', () => {
    expect([eps, minSamples]).toEqual([0.3, 5]);
    const r = dbscan(points, eps, minSamples);
    expect(r.kind[examples.core]).toBe('core');
    expect(r.kind[examples.border]).toBe('border');
    expect(r.kind[examples.noise]).toBe('noise');
  });

  it('kdist curves are sorted and match a direct computation for minSamples 5', () => {
    expect(kdist.map((k) => k.minSamples)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    for (const k of kdist) {
      expect(k.sorted).toHaveLength(210);
      for (let i = 1; i < k.sorted.length; i++) expect(k.sorted[i]).toBeGreaterThanOrEqual(k.sorted[i - 1]);
    }
    const direct = points
      .map((p) =>
        points
          .map((q) => Math.hypot(p[0] - q[0], p[1] - q[1]))
          .sort((a, b) => a - b)[4],
      )
      .sort((a, b) => a - b);
    const stored = kdist.find((k) => k.minSamples === 5)!.sorted;
    stored.forEach((v, i) => expect(Math.abs(v - direct[i])).toBeLessThan(2e-6));
  });

  it('knee is within 0.1 of 0.3', () => {
    expect(Math.abs(knee - 0.3)).toBeLessThanOrEqual(0.1);
  });

  it('epsSweep ends: noise >= 20 % at the small stop, one cluster at the large stop', () => {
    expect(epsSweep[1]).toBe(0.3);
    const small = dbscan(points, epsSweep[0], minSamples);
    const large = dbscan(points, epsSweep[2], minSamples);
    expect(small.label.filter((l) => l === -1).length).toBeGreaterThanOrEqual(0.2 * points.length);
    expect(large.clusters).toBe(1);
  });
});
