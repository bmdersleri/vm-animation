import { describe, expect, it } from 'vitest';
import { dendrogramData as D, type Linkage } from '../../../src/concepts/dendrogram/data';
import {
  branches,
  clustersAfter,
  cutForK,
  kAtHeight,
  labelsAtHeight,
  largestGap,
  leafX,
} from '../../../src/concepts/dendrogram/tree';

const NAMES: readonly Linkage[] = ['ward', 'complete', 'average', 'single'];
const n = D.points.length;

function samePartition(a: readonly number[], b: readonly number[]): boolean {
  const ab = new Map<number, number>();
  const ba = new Map<number, number>();
  return a.every((v, i) => {
    if ((ab.get(v) ?? b[i]) !== b[i] || (ba.get(b[i]) ?? v) !== v) return false;
    ab.set(v, b[i]);
    ba.set(b[i], v);
    return true;
  });
}

describe('dendrogram tree', () => {
  it('labelsAtHeight matches the stored cuts for k=1..6 in every linkage', () => {
    for (const name of NAMES) {
      const ld = D.linkages[name];
      expect(ld.cuts.map((c) => c.k)).toEqual([1, 2, 3, 4, 5, 6]);
      for (const c of ld.cuts) {
        const got = labelsAtHeight(ld, n, (c.low + c.high) / 2);
        expect(samePartition(got, c.labels), `${name} k=${c.k}`).toBe(true);
        expect(got, `${name} k=${c.k} numbering`).toEqual(c.labels);
        expect(new Set(got).size).toBe(c.k);
      }
    }
  });

  it('a cut exactly at a merge height counts that merge', () => {
    for (const name of NAMES) {
      const ld = D.linkages[name];
      ld.merges.forEach((m, i) => {
        expect(kAtHeight(ld, m.height), `${name} merge ${i}`).toBe(n - 1 - i);
        expect(kAtHeight(ld, m.height - 1e-9)).toBe(n - i);
        expect(new Set(labelsAtHeight(ld, n, m.height)).size).toBe(n - 1 - i);
      });
    }
  });

  it('cutForK centres the cut inside the k range and kAtHeight(cutForK(k)) === k', () => {
    for (const name of NAMES) {
      const ld = D.linkages[name];
      for (const c of ld.cuts) {
        const t = cutForK(ld, c.k);
        expect(t).toBeCloseTo((c.low + c.high) / 2, 12);
        expect(t).toBeGreaterThan(c.low);
        expect(t).toBeLessThan(c.high);
        expect(kAtHeight(ld, t)).toBe(c.k);
      }
    }
    expect(() => cutForK(D.linkages.ward, 7)).toThrow();
  });

  it('largestGap of ward is k=3 and its groups are A, B, C', () => {
    const ld = D.linkages.ward;
    const g = largestGap(ld);
    expect(g.k).toBe(3);
    expect(g.k).toBe(D.naturalK);
    const lab = labelsAtHeight(ld, n, (g.low + g.high) / 2);
    const { A, B, C, zincir } = D.meta.groups;
    const cl = (idx: readonly number[]) => new Set(idx.map((i) => lab[i]));
    expect(cl(A).size).toBe(1);
    expect(cl(B).size).toBe(1);
    expect(cl(C).size).toBe(1);
    expect(new Set([...cl(A), ...cl(B), ...cl(C)]).size).toBe(3);
    // the chain is split between A and B
    const chain = cl(zincir);
    expect(chain.size).toBe(2);
    expect(chain).toEqual(new Set([...cl(A), ...cl(B)]));
  });

  it('single linkage at k=3 puts A, chain and B together', () => {
    const ld = D.linkages.single;
    const lab = labelsAtHeight(ld, n, cutForK(ld, 3));
    const { A, B, C, zincir } = D.meta.groups;
    const one = new Set([...A, ...B, ...zincir].map((i) => lab[i]));
    expect(one.size).toBe(1);
    // 14 points in one cluster leave 3 points for the other two clusters: C is split 2 + 1
    expect(C.some((i) => one.has(lab[i]))).toBe(false);
    expect(new Set(lab).size).toBe(3);
    expect(lab.filter((l) => one.has(l))).toHaveLength(14);
  });

  it('branches never cross: each branch x lies between its children', () => {
    for (const name of NAMES) {
      const ld = D.linkages[name];
      const bs = branches(ld, n);
      expect(bs).toHaveLength(n - 1);
      const lx = leafX(ld);
      expect([...lx].sort((p, q) => p - q)).toEqual(Array.from({ length: n }, (_, i) => i));
      bs.forEach((b, i) => {
        expect(b.id).toBe(n + i);
        expect(b.xl).toBeLessThanOrEqual(b.x);
        expect(b.x).toBeLessThanOrEqual(b.xr);
        expect(b.xl).toBeLessThan(b.xr);
        expect(b.height).toBe(ld.merges[i].height);
        expect(b.yl).toBeLessThan(b.height);
        expect(b.yr).toBeLessThan(b.height);
        expect(b.members).toHaveLength(ld.merges[i].size);
        const child = (id: number) => (id < n ? lx[id] : bs[id - n].x);
        expect(child(b.left)).toBe(b.xl);
        expect(child(b.right)).toBe(b.xr);
      });
      // members of any branch occupy a contiguous slot range (no crossings)
      for (const b of bs) {
        const xs = b.members.map((p) => lx[p]).sort((p, q) => p - q);
        expect(xs[xs.length - 1] - xs[0]).toBe(xs.length - 1);
      }
    }
  });

  it('clustersAfter(0) has n singletons and clustersAfter(n-1) one cluster', () => {
    for (const name of NAMES) {
      const ld = D.linkages[name];
      const first = clustersAfter(ld, n, 0);
      expect(first).toHaveLength(n);
      expect(first.every((c) => c.length === 1)).toBe(true);
      const last = clustersAfter(ld, n, n - 1);
      expect(last).toHaveLength(1);
      expect([...last[0]].sort((p, q) => p - q)).toEqual(Array.from({ length: n }, (_, i) => i));
      expect(clustersAfter(ld, n, 5)).toHaveLength(n - 5);
    }
  });
});
