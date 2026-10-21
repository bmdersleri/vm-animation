import { describe, expect, it } from 'vitest';
import { boxStats, kde } from '../../../src/concepts/kutu-grafigi/kutu';
import { GROUPS, type GroupId } from '../../../src/concepts/kutu-grafigi/data';

const valuesOf = (id: GroupId): number[] => {
  const g = GROUPS.find((x) => x.id === id);
  if (!g) throw new Error(id);
  return g.values;
};

const withSixthOf = (id: GroupId): number[] => {
  const g = GROUPS.find((x) => x.id === id);
  if (!g || !g.withSixth) throw new Error(id);
  return g.withSixth.values;
};

describe('boxStats', () => {
  it('Bilgisayar k=1,5', () => {
    const b = boxStats([70, 74, 78, 82, 98], 1.5);
    expect(b).toMatchObject({ iqr: 8, lo: 62, hi: 94, wLo: 70, wHi: 82, outliers: [98] });
    expect(b.q1.value).toBe(74);
    expect(b.q3.value).toBe(82);
  });

  it('Elektrik k=1,5 ve 6. öğrenci', () => {
    expect(boxStats([55, 68, 72, 76, 80], 1.5).outliers).toEqual([55]);
    expect(boxStats([55, 62, 68, 72, 76, 80], 1.5).outliers).toEqual([]);
    expect(boxStats([66, 70, 74, 78, 82, 98], 1.5).q1.value).toBe(71);
  });

  it('k=3 hiçbir grupta aykırı bırakmaz', () => {
    for (const v of [[70, 74, 78, 82, 98], [55, 68, 72, 76, 80], [50, 66, 72, 78, 94]]) {
      expect(boxStats(v, 3).outliers).toEqual([]);
    }
  });

  it('sınıra eşit değer aykırı değildir', () => {
    // 62 ve 94 tam sınır: ikisi de içeride
    expect(boxStats([62, 70, 74, 82, 94], 1.5).outliers).toEqual([]);
  });

  it('Makine medyan 72, IQR 12', () => {
    const m = boxStats([50, 66, 72, 78, 94], 1.5);
    expect([m.q1.value, m.median.value, m.q3.value]).toEqual([66, 72, 78]);
    expect(m.iqr).toBe(12);
  });

  it('Makine k=3 sınırları 30 / 114', () => {
    const m = boxStats(valuesOf('makine'), 3);
    expect([m.lo, m.hi]).toEqual([30, 114]);
    expect([m.wLo, m.wHi]).toEqual([50, 94]);
    expect(m.outliers).toEqual([]);
  });

  it('çift n doğrusal ara değer: Elektrik 6. öğrenciyle Q1 63,5', () => {
    const e = boxStats([55, 62, 68, 72, 76, 80], 1.5);
    expect(e.q1.pos).toBe(1.25);
    expect(e.q1.value).toBe(63.5);
    expect(e.q3.value).toBe(75);
    expect(e.iqr).toBe(11.5);
    expect([e.lo, e.hi]).toEqual([46.25, 92.25]);
  });

  it('kutu_data.json fikstürü: her grup, her k ve 6. öğrencili hâli', () => {
    for (const g of GROUPS) {
      for (const k of [1.5, 3] as const) {
        const want = g.stats[String(k) as '1.5' | '3'];
        const got = boxStats(g.values, k);
        expect(got.q1.value, `${g.id} k=${k}`).toBeCloseTo(want.q1, 9);
        expect(got.median.value, `${g.id} k=${k}`).toBeCloseTo(want.median, 9);
        expect(got.q3.value, `${g.id} k=${k}`).toBeCloseTo(want.q3, 9);
        expect(got.iqr, `${g.id} k=${k}`).toBeCloseTo(want.iqr, 9);
        expect(got.lo, `${g.id} k=${k}`).toBeCloseTo(want.lo, 9);
        expect(got.hi, `${g.id} k=${k}`).toBeCloseTo(want.hi, 9);
        expect(got.wLo, `${g.id} k=${k}`).toBe(want.wLo);
        expect(got.wHi, `${g.id} k=${k}`).toBe(want.wHi);
        expect(got.outliers, `${g.id} k=${k}`).toEqual(want.outliers);
      }
      if (!g.withSixth) {
        expect(g.sixth).toBeNull();
        continue;
      }
      expect(g.sixth).not.toBeNull();
      for (const k of [1.5, 3] as const) {
        const want = g.withSixth.stats[String(k) as '1.5' | '3'];
        const got = boxStats(g.withSixth.values, k);
        expect(got.q1.value, `${g.id} altı k=${k}`).toBeCloseTo(want.q1, 9);
        expect(got.median.value, `${g.id} altı k=${k}`).toBeCloseTo(want.median, 9);
        expect(got.q3.value, `${g.id} altı k=${k}`).toBeCloseTo(want.q3, 9);
        expect(got.iqr, `${g.id} altı k=${k}`).toBeCloseTo(want.iqr, 9);
        expect(got.lo, `${g.id} altı k=${k}`).toBeCloseTo(want.lo, 9);
        expect(got.hi, `${g.id} altı k=${k}`).toBeCloseTo(want.hi, 9);
        expect(got.wLo, `${g.id} altı k=${k}`).toBe(want.wLo);
        expect(got.wHi, `${g.id} altı k=${k}`).toBe(want.wHi);
        expect(got.outliers, `${g.id} altı k=${k}`).toEqual(want.outliers);
      }
    }
  });

  it('girdi dizisi değişmez', () => {
    const v = [98, 70, 82, 74, 78];
    boxStats(v, 1.5);
    expect(v).toEqual([98, 70, 82, 74, 78]);
  });

  it('6. öğrencili Elektrik aykırısını kaybeder', () => {
    expect(boxStats(withSixthOf('elektrik'), 1.5).outliers).toEqual([]);
  });
});

describe('kde', () => {
  it('40 örnek, [lo, hi] aralığında ve negatif değil', () => {
    const pts = kde(valuesOf('bilgisayar'), 60, 100);
    expect(pts).toHaveLength(40);
    expect(pts[0].x).toBe(60);
    expect(pts[39].x).toBe(100);
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(60);
      expect(p.x).toBeLessThanOrEqual(100);
      expect(p.y).toBeGreaterThanOrEqual(0);
    }
    expect(pts.some((p) => p.y > 0)).toBe(true);
  });

  it('basamak sayısı verilebilir', () => {
    expect(kde(valuesOf('elektrik'), 40, 100, 12)).toHaveLength(12);
  });

  it('sabit seride düz çizgi', () => {
    const pts = kde([5, 5, 5, 5], 0, 10);
    expect(pts).toHaveLength(40);
    expect(new Set(pts.map((p) => p.y)).size).toBe(1);
  });

  it('tek gözlemde düz çizgi', () => {
    const pts = kde([7], 0, 10);
    expect(pts).toHaveLength(40);
    expect(new Set(pts.map((p) => p.y)).size).toBe(1);
  });

  it('mod kutunun içinde kalır', () => {
    const pts = kde(valuesOf('bilgisayar'), 60, 100);
    const top = pts.reduce((a, b) => (b.y > a.y ? b : a));
    expect(top.x).toBeGreaterThan(70);
    expect(top.x).toBeLessThan(86);
  });
});
