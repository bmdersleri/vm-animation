import { describe, it, expect } from 'vitest';
import {
  sweep, buildTree, accuracy, childSweeps, forcedSplit, toSamples, type Sample, type TreeNode,
} from '../../../src/concepts/karar-agaci/cart';
import { impurity, type Criterion } from '../../../src/concepts/karar-agaci/impurity';
import { train, test, DOMAIN } from '../../../src/concepts/karar-agaci/data';
import fixture from '../../fixtures/karar-agaci_sklearn.json';

interface FxNode {
  feature: number;
  threshold: number | null;
  counts: number[];
  left?: FxNode;
  right?: FxNode;
}
const S = toSamples(train);
const T = toSamples(test);
const crits: Criterion[] = ['gini', 'entropi'];
const depths = ['1', '2', '3', '4', '5', '6', 'null'];
const maxDepth = (d: string) => (d === 'null' ? Infinity : Number(d));

function compare(n: TreeNode, f: FxNode, path: string) {
  expect(Array.from(n.counts), `${path} counts`).toEqual(f.counts);
  if (f.feature === -1) {
    expect(n.split, `${path} leaf`).toBeNull();
    return;
  }
  expect(n.split, `${path} split`).not.toBeNull();
  expect(n.split!.feature, `${path} feature`).toBe(f.feature);
  expect(Math.abs(n.split!.threshold - f.threshold!), `${path} threshold`).toBeLessThan(1e-9);
  compare(n.left!, f.left!, `${path}L`);
  compare(n.right!, f.right!, `${path}R`);
}

describe('cart', () => {
  it('toSamples maps t, c, y and drops jy', () => {
    expect(toSamples([{ t: 3, c: 2, y: 1, jy: 0.1 }])).toEqual([{ x: [3, 2], y: 1 }]);
    expect(S).toHaveLength(train.length);
  });

  it('root sweep matches the fixture', () => {
    for (const f of [0, 1] as const) {
      const got = sweep(S, f, 'gini');
      const want = fixture.rootSweep[String(f) as '0' | '1'];
      expect(got).toHaveLength(want.length);
      got.forEach((g, i) => {
        expect(Math.abs(g.threshold - want[i].threshold)).toBeLessThan(1e-9);
        expect(Math.abs(g.impurity - want[i].impurity)).toBeLessThan(1e-9);
      });
    }
  });

  it('trees match sklearn', () => {
    for (const k of crits) {
      for (const d of depths) {
        const fx = (fixture.trees as unknown as Record<string, Record<string, FxNode>>)[k][d];
        compare(buildTree(S, maxDepth(d), k, DOMAIN), fx, `${k}/${d}`);
      }
    }
  });

  it('accuracies match sklearn', () => {
    for (const k of crits) {
      for (const d of depths) {
        const want = (fixture.accuracy as unknown as Record<string, Record<string, { train: number; test: number }>>)[k][d];
        const tree = buildTree(S, maxDepth(d), k, DOMAIN);
        expect(accuracy(tree, S)).toBeCloseTo(want.train, 9);
        expect(accuracy(tree, T)).toBeCloseTo(want.test, 9);
      }
    }
  });

  it('forced split with an empty side keeps the parent impurity', () => {
    const min = Math.min(...S.map((p) => p.x[0]));
    const sp = forcedSplit(S, 0, min - 1, 'gini');
    expect(Array.from(sp.left)).toEqual([0, 0]);
    expect(sp.impurity).toBe(impurity(sp.right, 'gini'));
  });

  it('child sweeps: the search each splitting child of the root runs at depth 2', () => {
    for (const k of crits) {
      const t = buildTree(S, 2, k, DOMAIN);
      const r = t.split!;
      const got = childSweeps(S, k, DOMAIN);
      // every child of the root that splits, left first, contract then complaints
      const want = ([[t.left!, (p: Sample) => p.x[r.feature] <= r.threshold], [t.right!, (p: Sample) => p.x[r.feature] > r.threshold]] as const)
        .filter(([n]) => n.split)
        .flatMap(([n, side]) => ([0, 1] as const)
          .map((f) => ({ box: n.box, counts: n.counts, feature: f, points: sweep(S.filter(side), f, k) }))
          .filter((c) => c.points.length > 0));
      expect(got, k).toEqual(want);
      expect(got.length).toBeGreaterThan(0);
      // the child's own best is the threshold the depth-2 tree chose there
      const right = got.filter((c) => JSON.stringify(c.box) === JSON.stringify(t.right!.box));
      const low = right.flatMap((c) => c.points.map((q) => ({ ...q, f: c.feature })))
        .reduce((m, q) => (q.impurity < m.impurity - 1e-12 ? q : m));
      expect(low.f).toBe(t.right!.split!.feature);
      expect(low.threshold).toBe(t.right!.split!.threshold);
    }
  });

  it('boxes tile the domain', () => {
    const leaves = (n: TreeNode): TreeNode[] => (n.split ? [...leaves(n.left!), ...leaves(n.right!)] : [n]);
    const area = leaves(buildTree(S, 2, 'gini', DOMAIN)).reduce(
      (s, n) => s + (n.box.x[1] - n.box.x[0]) * (n.box.y[1] - n.box.y[0]), 0);
    expect(area).toBeCloseTo((DOMAIN.x[1] - DOMAIN.x[0]) * (DOMAIN.y[1] - DOMAIN.y[0]), 9);
  });
});
