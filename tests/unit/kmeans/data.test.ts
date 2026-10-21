import { describe, expect, it } from 'vitest';
import fixture from '../../fixtures/kmeans_sklearn.json';
import { kmeansData, kResult, type KResult, type Pt } from '../../../src/concepts/kmeans/data';
import { inertiaOf, nearest, sqDist } from '../../../src/concepts/kmeans/geometry';

const { points, runs, ks, nInit } = kmeansData;
const r2 = (v: number) => Number(v.toFixed(2));
const partitionKey = (labels: readonly number[]) => {
  const groups = new Map<number, number[]>();
  labels.forEach((l, i) => groups.set(l, [...(groups.get(l) ?? []), i]));
  return [...groups.values()].map((g) => g.join(',')).sort().join('|');
};

/** Greedy overlap relabelling (same rule as the generator). */
function greedyMap(newLabels: readonly number[], ref: readonly number[], kNew: number, kRef: number): number[] {
  const overlap = Array.from({ length: kNew }, () => new Array<number>(kRef).fill(0));
  newLabels.forEach((a, i) => { overlap[a][ref[i]]++; });
  const pairs: [number, number, number][] = [];
  for (let j = 0; j < kNew; j++) for (let i = 0; i < kRef; i++) if (overlap[j][i] > 0) pairs.push([-overlap[j][i], j, i]);
  pairs.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);
  const mapping = new Array<number>(kNew).fill(-1);
  const used = new Set<number>();
  for (const [, j, i] of pairs) if (mapping[j] < 0 && !used.has(i)) { mapping[j] = i; used.add(i); }
  let free = 0;
  for (let j = 0; j < kNew; j++) {
    if (mapping[j] >= 0) continue;
    while (used.has(free)) free++;
    mapping[j] = free; used.add(free);
  }
  return mapping;
}

describe('kmeans data', () => {
  it('reference table matches the spec', () => {
    expect(ks.map((r) => r2(r.inertia))).toEqual([300.0, 84.72, 43.03, 28.49, 22.4, 16.85, 13.9, 11.72, 9.83, 8.46]);
    expect(ks[0].silhouette).toBeNull();
    expect(ks.slice(1).map((r) => Number((r.silhouette as number).toFixed(4))))
      .toEqual([0.6324, 0.5445, 0.5468, 0.5038, 0.4355, 0.4444, 0.4638, 0.4656, 0.465]);
    expect([...kResult(2).sizes].sort((a, b) => a - b)).toEqual([56, 94]);
    expect([...kResult(3).sizes].sort((a, b) => a - b)).toEqual([43, 53, 54]);
    expect([...kResult(4).sizes].sort((a, b) => a - b)).toEqual([12, 41, 44, 53]);
    const negatives: Record<number, number> = { 2: 0, 3: 0, 4: 1, 5: 0, 6: 0, 7: 1, 8: 1, 9: 0, 10: 2 };
    for (const [k, count] of Object.entries(negatives)) {
      expect((kResult(Number(k)).s as number[]).filter((v) => v < 0).length, `k=${k}`).toBe(count);
    }
    ks.forEach((r, i) => expect(r.k).toBe(i + 1));
    expect(() => kResult(0)).toThrow();
    expect(() => kResult(11)).toThrow();
  });

  it('data agrees with the sklearn fixture', () => {
    expect(fixture.ks).toHaveLength(10);
    for (const f of fixture.ks) {
      const r = kResult(f.k);
      expect(r.inertia).toBeCloseTo(f.inertia, 6);
      if (f.silhouette === null) expect(r.silhouette).toBeNull();
      else expect(r.silhouette as number).toBeCloseTo(f.silhouette, 6);
      expect(partitionKey(r.labels)).toBe(partitionKey(f.labels));
      expect([...r.sizes].sort((a, b) => a - b)).toEqual(f.sizes);
    }
  });

  it('turns are lloyd steps', () => {
    expect(runs).toHaveLength(12);
    for (const run of runs) {
      let prevCenters: readonly Pt[] = run.start;
      let prevInertia = Infinity;
      run.turns.forEach((turn, t) => {
        points.forEach((p, i) => { expect(turn.labels[i]).toBe(nearest(p, prevCenters)); });
        turn.centers.forEach((c, j) => {
          const members = points.filter((_, i) => turn.labels[i] === j);
          expect(members.length).toBeGreaterThan(0);
          const mx = members.reduce((s, p) => s + p[0], 0) / members.length;
          const my = members.reduce((s, p) => s + p[1], 0) / members.length;
          expect(Math.abs(c[0] - mx)).toBeLessThan(1e-5);
          expect(Math.abs(c[1] - my)).toBeLessThan(1e-5);
        });
        expect(turn.inertia).toBeLessThanOrEqual(prevInertia + 1e-6);
        expect(Math.abs(turn.inertia - inertiaOf(points, turn.labels, turn.centers))).toBeLessThan(1e-4);
        if (t === 0) expect(turn.changed).toBeNull();
        else {
          const before = run.turns[t - 1].labels;
          expect(turn.changed).toBe(turn.labels.filter((l, i) => l !== before[i]).length);
        }
        prevCenters = turn.centers;
        prevInertia = turn.inertia;
      });
      expect(run.turns[run.turns.length - 1].changed).toBe(0);
      expect(run.inertia).toBe(run.turns[run.turns.length - 1].inertia);
    }
    const [good, bad] = runs;
    const range = kmeansData.meta;
    expect(good.turns.length).toBeGreaterThanOrEqual(range.turnRange[0]);
    expect(good.turns.length).toBeLessThanOrEqual(range.turnRange[1]);
    expect(r2(good.inertia)).toBe(43.03);
    expect(good.init).toBe('k-means++');
    expect(bad.init).toBe('random');
    expect(bad.inertia).toBeGreaterThan(1.5 * 43.03);
    expect(runs.some((r) => Number(r.inertia.toFixed(1)) === 44.2)).toBe(true);
  });

  it('assignments keep a safe margin from ties', () => {
    let min = Infinity;
    for (const run of runs) {
      let prev: readonly Pt[] = run.start;
      for (const turn of run.turns) {
        for (const p of points) {
          const d = prev.map((c) => sqDist(p, c)).sort((a, b) => a - b);
          min = Math.min(min, d[1] - d[0]);
        }
        prev = turn.centers;
      }
    }
    expect(min).toBeGreaterThanOrEqual(1e-5);
  });

  it('n_init best equals the book call', () => {
    expect(nInit).toHaveLength(10);
    const min = Math.min(...nInit.map((e) => e.inertia));
    expect(r2(min)).toBe(r2(fixture.bookInertia));
    expect(nInit[kmeansData.nInitBest].inertia).toBe(min);
    expect(nInit.map((e) => e.inertia)).toEqual(fixture.nInitInertias);
  });

  it('relabel keeps metrics and matches k=3 numbering', () => {
    const k3 = kResult(3).labels;
    expect(runs[0].turns[runs[0].turns.length - 1].labels).toEqual(k3);
    expect(nInit[kmeansData.nInitBest].labels).toEqual(k3);
    for (let k = 2; k <= 10; k++) {
      const raw = fixture.ks[k - 1].labels;
      const map = greedyMap(raw, kResult(k - 1).labels, k, k - 1);
      expect(kResult(k).labels).toEqual(raw.map((l) => map[l]));
      const r = kResult(k);
      expect(inertiaOf(points, r.labels, r.centers)).toBeCloseTo(fixture.ks[k - 1].inertia, 4);
    }
  });

  it('silhouette parts are consistent', () => {
    for (let k = 2; k <= 10; k++) {
      const r = kResult(k) as KResult & { s: number[]; a: number[]; b: number[] };
      let sum = 0;
      r.s.forEach((s, i) => {
        expect(Math.abs(s - (r.b[i] - r.a[i]) / Math.max(r.a[i], r.b[i]))).toBeLessThan(1e-5);
        sum += s;
      });
      expect(sum / r.s.length).toBeCloseTo(r.silhouette as number, 5);
    }
    const k1 = kResult(1);
    expect([k1.s, k1.a, k1.b]).toEqual([null, null, null]);
  });

  it('a and b of the step-6 point match a direct recomputation', () => {
    const { labels, a, b } = kResult(3);
    const i = kmeansData.silhouettePoint;
    const mean = (idx: number[]) => idx.reduce((s, j) => s + Math.sqrt(sqDist(points[i], points[j])), 0) / idx.length;
    const members = (c: number) => points.map((_, j) => j).filter((j) => labels[j] === c && j !== i);
    const own = labels[i];
    const others = [0, 1, 2].filter((c) => c !== own).map((c) => mean(members(c)));
    expect(i).toBe(119);
    // The generated data stores a and b rounded to 6 decimals, so the tolerance is the rounding step.
    expect(Math.abs(a![i] - mean(members(own)))).toBeLessThan(5e-7);
    expect(Math.abs(b![i] - Math.min(...others))).toBeLessThan(5e-7);
  });

  it('chosen points follow the rules', () => {
    const t1 = runs[0].turns[0];
    const expected = [0, 1, 2].map((c) => {
      const members = points.map((_, i) => i).filter((i) => t1.labels[i] === c);
      const sorted = members
        .map((i) => ({ i, d: Math.sqrt(sqDist(points[i], t1.centers[c])) }))
        .sort((x, y) => x.d - y.d || x.i - y.i);
      return sorted[Math.floor((sorted.length - 1) / 2)].i;
    });
    expect(kmeansData.distancePoints).toEqual(expected);
    const k3 = kResult(3) as KResult & { s: number[] };
    let best = 0;
    k3.s.forEach((v, i) => {
      if (Math.abs(v - (k3.silhouette as number)) < Math.abs(k3.s[best] - (k3.silhouette as number)) - 1e-12) best = i;
    });
    expect(kmeansData.silhouettePoint).toBe(best);
  });
});
