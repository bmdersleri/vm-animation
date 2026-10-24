import { describe, it, expect } from 'vitest';
import fixture from '../../fixtures/boosting_sklearn.json';
import { REG } from '../../../src/concepts/boosting/data';
import { fitRegTree, leafCount, predictReg, treeDepth } from '../../../src/concepts/boosting/regtree';
import type { RegTree } from '../../../src/concepts/boosting/regtree';

const xs = REG.train.x;
const r0 = REG.train.y.map((v) => v - REG.mean);

/** Internal-node thresholds, sorted. */
function thresholds(tree: RegTree): number[] {
  return tree.nodes.filter((n) => n.l !== -1).map((n) => n.t).sort((a, b) => a - b);
}

/** Leaf values left to right. */
function leafValues(tree: RegTree): number[] {
  const out: number[] = [];
  const walk = (i: number): void => {
    const n = tree.nodes[i];
    if (n.l === -1) {
      out.push(n.v);
      return;
    }
    walk(n.l);
    walk(n.r);
  };
  walk(0);
  return out;
}

function mse(tree: RegTree, x: readonly number[], r: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) {
    s += (r[i] - predictReg(tree, x[i])) ** 2;
  }
  return s / x.length;
}

describe('regtree', () => {
  it('level-wise depth 2 tree matches sklearn thresholds and leaves', () => {
    const tree = fitRegTree(xs, r0, { maxDepth: 2 });
    const want = fixture.firstResiduals.depth2;
    const got = thresholds(tree);
    expect(got).toHaveLength(3);
    got.forEach((t, i) => expect(t).toBeCloseTo(want.thresholds[i], 9));
    leafValues(tree).forEach((v, i) => expect(v).toBeCloseTo(want.leaves[i], 9));
    expect(mse(tree, xs, r0)).toBeCloseTo(want.train, 9);
    expect(treeDepth(tree)).toBe(2);
  });

  it('leaf-wise 4 leaves matches sklearn and splits 2.651 then 6.372 then 9.021', () => {
    const tree = fitRegTree(xs, r0, { maxLeaves: 4 });
    const want = fixture.firstResiduals.leaf4;
    const got = thresholds(tree);
    got.forEach((t, i) => expect(t).toBeCloseTo(want.thresholds[i], 9));
    leafValues(tree).forEach((v, i) => expect(v).toBeCloseTo(want.leaves[i], 9));
    expect(tree.splits.map((s) => s.t.toFixed(3))).toEqual(['2.651', '6.372', '9.021']);
    expect(tree.splits.every((sp) => sp.gain > 0)).toBe(true);
    expect(treeDepth(tree)).toBe(3);
  });

  it('leaf-wise loss is below level-wise at 4 leaves', () => {
    const level = fitRegTree(xs, r0, { maxDepth: 2 });
    const leaf = fitRegTree(xs, r0, { maxLeaves: 4 });
    expect(leafCount(level)).toBe(4);
    expect(leafCount(leaf)).toBe(4);
    expect(mse(leaf, xs, r0)).toBeLessThan(mse(level, xs, r0));
  });

  it('max leaves 2 to 64 match sklearn depth and errors', () => {
    const rv = REG.val.y.map((v) => v - REG.mean);
    expect(fixture.maxLeaves).toHaveLength(63);
    for (const row of fixture.maxLeaves) {
      const tree = fitRegTree(xs, r0, { maxLeaves: row.limit });
      expect(leafCount(tree), `leaves at ${row.limit}`).toBe(row.leaves);
      expect(treeDepth(tree), `depth at ${row.limit}`).toBe(row.depth);
      expect(mse(tree, xs, r0), `train at ${row.limit}`).toBeCloseTo(row.train, 9);
      expect(mse(tree, REG.val.x, rv), `val at ${row.limit}`).toBeCloseTo(row.val, 9);
    }
  });

  it('max leaves beyond the data stops at the real leaf count', () => {
    const row = fixture.beyond;
    const tree = fitRegTree(xs, r0, { maxLeaves: row.limit });
    expect(leafCount(tree)).toBe(row.leaves);
    expect(row.leaves).toBeLessThan(row.limit);
    expect(treeDepth(tree)).toBe(row.depth);
    expect(mse(tree, xs, r0)).toBeCloseTo(row.train, 9);
  });
});
