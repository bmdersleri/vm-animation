import { describe, expect, it } from 'vitest';
import { deriveKutuView } from '../../../src/concepts/kutu-grafigi/view';
import { kutuScenario, type KutuParams } from '../../../src/concepts/kutu-grafigi/scenario';

const base = (i: number): KutuParams => ({ ...kutuScenario.defaults, ...kutuScenario.steps[i].params });
const V = (i: number, over: Partial<KutuParams> = {}) => deriveKutuView(i, { ...base(i), ...over });
const ids = (i: number, over: Partial<KutuParams> = {}) => V(i, over).groups.map((g) => g.id);

describe('kutu view', () => {
  it('adım kimlikleri sırayla', () => {
    expect([...Array(8).keys()].map((i) => V(i).stepId)).toEqual(kutuScenario.steps.map((s) => s.id));
  });

  it('adım 1 iki grup ve canlı n', () => {
    expect(V(0).strip).toBe('Bilgisayar n = 5 · Elektrik n = 5');
    expect(V(0, { sixth: true }).strip).toBe('Bilgisayar n = 6 · Elektrik n = 6');
    expect(ids(0)).toEqual(['bilgisayar', 'elektrik']);
    expect(V(0).groups.every((g) => g.values.length === 5)).toBe(true);
  });

  it('adım 2 canlı medyanlar', () => {
    expect(V(1).strip).toBe('Bilgisayar 78 · Elektrik 72');
    expect(V(1, { sixth: true }).strip).toBe('Bilgisayar 76 · Elektrik 70');
  });

  it('adım 3 şeridi Q1 = 74 · Q3 = 82 · IQR = 8', () => {
    const v = V(2);
    expect(v.strip).toBe('Q1 = 74 · Q3 = 82 · IQR = 8');
    expect(v.groups[0].stats.q1.value).toBe(74);
    expect(v.groups[0].stats.q3.value).toBe(82);
    expect(v.groups[1].stats.iqr).toBe(8);
    expect(v.fences).toBe(false);
    expect(V(2, { sixth: true }).strip).toBe('Q1 = 71 · Q3 = 81 · IQR = 10');
  });

  it('adım 4 kutu şeridi', () => {
    expect(V(3).strip).toBe('kutu: 74–82 · medyan 78');
  });

  it('adım 5 sınırlar ve bıyıklar', () => {
    const v = V(4);
    expect(v.strip).toBe('1,5 × 8 = 12 → sınırlar 62 / 94');
    expect(v.fences).toBe(true);
    expect(v.groups[0].stats).toMatchObject({ lo: 62, hi: 94, wLo: 70, wHi: 82 });
    expect(v.groups[1].stats).toMatchObject({ lo: 56, hi: 88, wLo: 68, wHi: 80 });
    expect(V(4, { k: 3 }).strip).toBe('3 × 8 = 24 → sınırlar 50 / 106');
  });

  it('adım 6 iki aykırı indeksi (her gruptan bir)', () => {
    const v = V(5);
    expect(v.groups.map((g) => g.outlierIndexes)).toEqual([[4], [0]]);
    expect(v.groups[0].values[4]).toBe(98);
    expect(v.groups[1].values[0]).toBe(55);
    expect(v.strip).toBe('98 > 94 · 55 < 56 → aykırı');
  });

  it('adım 6 şeridi canlı: 6. öğrenci Elektrik aykırısını kaldırır', () => {
    const v = V(5, { sixth: true });
    expect(v.groups[1].outlierIndexes).toEqual([]);
    expect(v.groups[1].values).toEqual([55, 62, 68, 72, 76, 80]);
    expect(v.groups[0].outlierIndexes).toEqual([5]);
    expect(v.strip).toBe('98 > 96 → aykırı');
  });

  it('adım 6 şeridi canlı: k = 3 aykırı bırakmaz', () => {
    const v = V(5, { k: 3 });
    expect(v.groups.every((g) => g.outlierIndexes.length === 0)).toBe(true);
    expect(v.strip).toBe('bu kuralda aykırı yok · k = 3');
  });

  it('adım 7 üç grup ve Makine IQR 12', () => {
    const v = V(6);
    expect(ids(6)).toEqual(['bilgisayar', 'elektrik', 'makine']);
    expect(v.groups[2].name).toBe('Makine');
    expect(v.groups[2].stats.iqr).toBe(12);
    expect(v.groups[2].stats.median.value).toBe(72);
    expect(v.groups[2].outlierIndexes).toEqual([]);
    expect(v.strip).toBe('medyan 72 = 72 · IQR 12 > 8');
  });

  it('adım 8 violin açar ve iqr-aykiri bağlantısını not eder', () => {
    const v = V(7);
    expect(v.showViolin).toBe(true);
    for (let i = 0; i < 7; i++) expect(V(i).showViolin, String(i)).toBe(false);
    expect(v.strip).toBe('n = 5: yoğunluk tahmini zayıf · k = 1,5');
    expect(V(7, { k: 3 }).strip).toBe('n = 5: yoğunluk tahmini zayıf · k = 3');
    expect(v.note).toContain('iqr-aykiri');
  });

  it('sınırlar 5. adımdan, üçüncü grup 7. adımdan görünür', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((i) => V(i).fences)).toEqual([
      false, false, false, false, true, true, true, true,
    ]);
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((i) => ids(i).length)).toEqual([2, 2, 2, 2, 2, 2, 3, 3]);
  });

  it('üçüncü grup yalnız 7–8. adımlarda ve açıkken görünür', () => {
    expect(ids(6, { third: true })).toEqual(['bilgisayar', 'elektrik', 'makine']);
    expect(ids(6, { third: false })).toEqual(['bilgisayar', 'elektrik']);
    // before step 7 the control is not offered, so the parameter cannot leak the group in
    expect(ids(2, { third: true })).toEqual(['bilgisayar', 'elektrik']);
    expect(V(6, { third: false }).strip).toContain('üçüncü grup kapalı');
  });

  it('noktalar kapalıyken aykırı bilgisi korunur', () => {
    const v = V(5, { dots: false });
    expect(v.groups.every((g) => g.dots === false)).toBe(true);
    expect(v.groups.map((g) => g.outlierIndexes)).toEqual([[4], [0]]);
  });

  it('ortalamalar 80,4 / 70,2 / 72,0', () => {
    expect(V(0).groups[0].mean).toBeCloseTo(80.4, 9);
    expect(V(0).groups[1].mean).toBeCloseTo(70.2, 9);
    expect(V(6).groups[2].mean).toBeCloseTo(72, 9);
  });

  it('k = 3 hiçbir grupta aykırı bırakmaz', () => {
    for (const [i, over] of [[5, {}], [7, {}], [7, { sixth: true }], [5, { sixth: true }]] as const) {
      const v = V(i, { ...over, k: 3 });
      for (const g of v.groups) expect(g.outlierIndexes, `${v.stepId} ${g.id}`).toEqual([]);
    }
  });

  it('her adımın tek cümlelik notu var', () => {
    for (let i = 0; i < 8; i++) {
      const note = V(i).note.trim();
      expect(note.length, String(i)).toBeGreaterThan(10);
      expect(note.endsWith('.'), note).toBe(true);
    }
  });

  it('hiçbir şeritte sıfır olmayan değer 0,00 yazılmaz', () => {
    const params: Partial<KutuParams>[] = [
      {}, { sixth: true }, { k: 3 }, { dots: false }, { third: true }, { k: 3, sixth: true },
    ];
    for (const over of params) {
      for (let i = 0; i < 8; i++) {
        const v = V(i, over);
        expect(v.strip, `${v.stepId} ${JSON.stringify(over)}`).not.toMatch(/0,00/);
        expect(v.note, v.stepId).not.toMatch(/0,00/);
      }
    }
  });
});
