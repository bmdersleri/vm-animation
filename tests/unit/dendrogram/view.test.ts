import { describe, expect, it } from 'vitest';
import { dendrogramData as D, type Linkage } from '../../../src/concepts/dendrogram/data';
import {
  clusterName, cutSizes, gapText, linkageRows, mergeInfo, sizesText, splitOfGroup,
} from '../../../src/concepts/dendrogram/view';

const n = D.points.length;

describe('dendrogram view', () => {
  it('merge text names the two clusters and the height', () => {
    const first = mergeInfo('ward', 1);
    const m = D.linkages.ward.merges[0];
    expect(first.height).toBe(m.height);
    expect(first.text).toBe(`Birleşme 1 / ${n - 1}: Nokta ${m.a + 1} ile Nokta ${m.b + 1} birleşti, uzaklık 0,23.`);
    const m5 = D.linkages.ward.merges[4];
    const info = mergeInfo('ward', 5);
    expect(info.left.length + info.right.length).toBe(m5.size);
    expect(info.text).toContain('birleşti, uzaklık');
    expect(info.text).toMatch(/\{\d+(, \d+)*\} kümesi/);
    expect(clusterName([2])).toBe('Nokta 3');
    expect(clusterName([0, 3])).toBe('{1, 4} kümesi');
    expect(clusterName([0, 1, 2, 3, 4, 5, 6])).toBe('7 noktalı küme ({1, 2, 3, …})');
    const last = mergeInfo('single', n - 1);
    expect(last.left.length + last.right.length).toBe(n);
    expect(mergeInfo('ward', 0).text).toBe('');
  });

  it('k text and sizes follow the cut', () => {
    for (const l of ['ward', 'complete', 'average', 'single'] as Linkage[]) {
      for (let k = 1; k <= 6; k++) {
        const sizes = cutSizes(l, k);
        expect(sizes).toHaveLength(k);
        expect(sizes.reduce((a, b) => a + b, 0)).toBe(n);
        expect(sizes).toEqual(Array.from({ length: k }, (_v, c) => D.linkages[l].cuts[k - 1].labels.filter((x) => x === c).length));
      }
    }
    expect(sizesText([7, 7, 3])).toBe('7 · 7 · 3');
    expect(cutSizes('ward', 3).slice().sort((a, b) => b - a)).toEqual([7, 7, 3]);
    expect(cutSizes('ward', 99)).toEqual([n]);
  });

  it('gap text quotes the stored range', () => {
    const t = gapText('ward');
    expect(t).toContain('2,82');
    expect(t).toContain('9,00');
    expect(t).toContain('3 küme');
  });

  it('step 10 table lists ward, complete, single sizes at k=3 from the data', () => {
    const rows = linkageRows();
    expect(rows.map((r) => r.linkage)).toEqual(['ward', 'complete', 'single']);
    for (const r of rows) {
      expect(r.sizes).toEqual(cutSizes(r.linkage, 3).slice().sort((a, b) => b - a));
      expect(r.definition.length).toBeGreaterThan(10);
      expect(r.when.length).toBeGreaterThan(10);
    }
    expect(rows[2].sizes[0]).toBeGreaterThan(rows[0].sizes[0]);
  });

  it('the data back the written claims: ward keeps A, B, C whole; single chains A, chain and B', () => {
    const g = D.meta.groups;
    const ward = D.linkages.ward.cuts[2].labels;
    for (const grp of [g.A, g.B, g.C]) expect(new Set(grp.map((i) => ward[i])).size).toBe(1);
    expect(new Set(g.zincir.map((i) => ward[i])).size).toBe(2);
    const single = D.linkages.single.cuts[2].labels;
    expect(new Set([...g.A, ...g.zincir, ...g.B].map((i) => single[i])).size).toBe(1);
    expect(splitOfGroup('single', 'C')).toEqual([2, 1]);
    expect(splitOfGroup('ward', 'C')).toEqual([3]);
  });
});
