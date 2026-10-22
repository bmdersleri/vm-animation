import { describe, expect, it } from 'vitest';
import fixture from '../../fixtures/dbscan_sklearn.json';
import { dbscanData, type Pt } from '../../../src/concepts/dbscan/data';
import { dbscan } from '../../../src/concepts/dbscan/dbscan';

const { points } = dbscanData;

const partition = (labels: readonly number[], skip?: ReadonlySet<number>) => {
  const groups = new Map<number, number[]>();
  labels.forEach((l, i) => {
    if (l < 0 || skip?.has(i)) return;
    groups.set(l, [...(groups.get(l) ?? []), i]);
  });
  return [...groups.values()].map((g) => g.join(',')).sort();
};

describe('dbscan', () => {
  it('matches sklearn on every grid pair', () => {
    expect(fixture.grid).toHaveLength(19 * 6);
    for (const g of fixture.grid) {
      const tag = `eps ${g.eps} / min_samples ${g.minSamples}`;
      const r = dbscan(points, g.eps, g.minSamples);
      const core = r.kind.flatMap((k, i) => (k === 'core' ? [i] : []));
      expect(core, `${tag} core`).toEqual(g.core);
      const noise = (labels: readonly number[]) => labels.flatMap((l, i) => (l === -1 ? [i] : []));
      expect(noise(r.label), `${tag} noise`).toEqual(noise(g.labels));
      const amb = new Set(Object.keys(g.ambiguousBorder).map(Number));
      // Cluster partition (up to label permutation) over everything but the ambiguous borders.
      expect(partition(r.label, amb), `${tag} partition`).toEqual(partition(g.labels, amb));
      // Ambiguous borders: any listed cluster is fine; map our labels onto sklearn's through a core member.
      const toSk = new Map<number, number>();
      core.forEach((i) => toSk.set(r.label[i], g.labels[i]));
      for (const [idx, list] of Object.entries(g.ambiguousBorder)) {
        expect(list as number[], `${tag} border ${idx}`).toContain(toSk.get(r.label[Number(idx)]));
      }
    }
  });

  it('neighbours include the point itself and use d <= eps', () => {
    const pts: Pt[] = [[0, 0], [0.5, 0], [3, 0]];
    const r = dbscan(pts, 0.5, 2);
    expect(r.neighbours[0]).toEqual([0, 1]);
    expect(r.neighbours[1]).toEqual([0, 1]);
    expect(r.neighbours[2]).toEqual([2]);
    expect(r.kind).toEqual(['core', 'core', 'noise']);
  });

  it('no core points means every point is noise', () => {
    const r = dbscan(points, 0.01, 5);
    expect(r.kind.every((k) => k === 'noise')).toBe(true);
    expect(r.label.every((l) => l === -1)).toBe(true);
    expect(r.clusters).toBe(0);
    expect(r.order).toEqual([]);
  });

  it('minSamples 2 never yields a single-point cluster', () => {
    for (const eps of [0.05, 0.1, 0.3, 0.7]) {
      const r = dbscan(points, eps, 2);
      const sizes = new Map<number, number>();
      r.label.forEach((l) => l >= 0 && sizes.set(l, (sizes.get(l) ?? 0) + 1));
      for (const s of sizes.values()) expect(s).toBeGreaterThanOrEqual(2);
    }
  });

  it('order lists each clustered point once, cores of a cluster before the next cluster', () => {
    const r = dbscan(points, 0.3, 5);
    const clustered = r.label.flatMap((l, i) => (l >= 0 ? [i] : []));
    expect([...r.order].sort((a, b) => a - b)).toEqual(clustered);
    expect(new Set(r.order).size).toBe(r.order.length);
    // clusters appear contiguously in label order 0, 1, ... and each starts with a core
    const seq = r.order.map((i) => r.label[i]);
    expect(seq).toEqual([...seq].sort((a, b) => a - b));
    for (let c = 0; c < r.clusters; c++) {
      const first = r.order.find((i) => r.label[i] === c)!;
      expect(r.kind[first]).toBe('core');
    }
  });
});
