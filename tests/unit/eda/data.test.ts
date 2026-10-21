import fs from 'node:fs';
import { describe, it, expect } from 'vitest';

const read = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));

describe('eda data files', () => {
  const dag = read('src/concepts/dagilim-carpiklik/data/dagilim_data.json');
  const kutu = read('src/concepts/kutu-grafigi/data/kutu_data.json');
  const kor = read('src/concepts/korelasyon-isi-haritasi/data/korelasyon_data.json');
  const fx = read('tests/fixtures/eda_pandas.json');

  it('dagilim JSON fikstürle aynı', () => {
    expect(dag.series['002'].mean).toBe(fx.dagilim.series['002'].mean);
    expect(dag.series['002'].skew).toBe(fx.dagilim.series['002'].skew);
    expect(dag.bins['002']['5']).toEqual([4, 2, 2, 1, 1]);
    expect(dag.extremeSweep.map((e: { x: number }) => e.x)).toEqual([28, 32, 36, 40, 45, 50, 60]);
  });

  it('kutu JSON üç grubu ve 6. öğrenciyi taşır', () => {
    expect(kutu.groups.map((g: { id: string }) => g.id)).toEqual(['bilgisayar', 'elektrik', 'makine']);
    const e = kutu.groups[1];
    expect(e.stats['1.5']).toMatchObject({ q1: 68, median: 72, q3: 76, iqr: 8, lo: 56, hi: 88, wLo: 68, wHi: 80, outliers: [55] });
    expect(e.withSixth.stats['1.5'].outliers).toEqual([]);
  });

  it('korelasyon JSON matrisleri ve Anscombe özetlerini taşır', () => {
    expect(kor.korelasyon.matrix[0][2]).toBeCloseTo(0.995366, 6);
    expect(kor.anscombe.sets).toHaveLength(4);
    for (const s of kor.anscombe.sets) {
      expect(s.meanX).toBe(9);
      expect(s.varX).toBe(11);
      expect(s.r).toBeCloseTo(0.8164, 3);
    }
    expect(kor.anscombe.leverage.index).toBe(7);
    expect(kor.anscombe.spearman).toBeCloseTo(0.6909, 4);
  });
});
