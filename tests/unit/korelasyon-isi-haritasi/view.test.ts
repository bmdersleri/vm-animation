import { describe, expect, it } from 'vitest';
import { deriveKorelView } from '../../../src/concepts/korelasyon-isi-haritasi/view';
import { korelasyonScenario, type KorelParams } from '../../../src/concepts/korelasyon-isi-haritasi/scenario';

const base = (i: number): KorelParams => ({ ...korelasyonScenario.defaults, ...korelasyonScenario.steps[i].params });
const V = (i: number, over: Partial<KorelParams> = {}) => deriveKorelView(i, { ...base(i), ...over });

const STEPS = 10;

describe('korelasyon görünümü', () => {
  it('adım kimlikleri sırayla', () => {
    expect([...Array(STEPS).keys()].map((i) => V(i).stepId)).toEqual(korelasyonScenario.steps.map((s) => s.id));
  });

  it('adım 1 tek saçılım: çalışma–not ve şerit', () => {
    const v = V(0);
    expect(v.strip).toBe('7 öğrenci · x: çalışma saati · y: sınav notu');
    expect(v.panels).toHaveLength(1);
    expect(v.panels[0].id).toBe('calisma-not');
    expect(v.panels[0].points).toHaveLength(7);
    expect(v.panels[0].points[0]).toEqual({ x: 8, y: 58 });
    expect(v.panels[0].points[6]).toEqual({ x: 25, y: 94 });
    expect(v.heat).toBeNull();
    expect(v.r).toBeCloseTo(0.9954, 4);
  });

  it('adım 2 r = 0,995 ve en küçük kareler eğilimi', () => {
    const v = V(1);
    expect(v.strip).toBe('r = cov(x,y) / (σx · σy) = 0,995');
    expect(v.r).toBeCloseTo(0.9954, 4);
    const trend = v.panels[0].trend;
    if (!trend) throw new Error('eğilim yok');
    expect(trend.m).toBeCloseTo(2.18344, 4);
    expect(trend.b).toBeCloseTo(41.3126, 3);
  });

  it('adım 3 dikey eksen devamsızlık: r = −0,993', () => {
    const v = V(2);
    expect(v.panels).toHaveLength(1);
    expect(v.panels[0].id).toBe('not-devamsizlik');
    expect(v.panels[0].points[0]).toEqual({ x: 58, y: 10 });
    expect(v.r).toBeCloseTo(-0.9928, 4);
    expect(v.strip).toBe('r = −0,993 · korelasyon ≠ nedensellik');
    const trend = v.panels[0].trend;
    if (!trend) throw new Error('eğilim yok');
    expect(trend.m).toBeLessThan(0);
  });

  it('adım 4 4 × 4 ısı haritası: 16 hücre, köşegen 1,000', () => {
    const v = V(3);
    expect(v.panels).toEqual([]);
    const heat = v.heat;
    if (!heat) throw new Error('ısı haritası yok');
    expect(heat.variables).toEqual(['Çalışma', 'Devamsızlık', 'Not', 'Uyku']);
    expect(heat.cells).toHaveLength(16);
    for (const cell of heat.cells.filter((c) => c.row === c.col)) expect(cell.text).toBe('1,000');
    expect(heat.cells.find((c) => c.row === 0 && c.col === 2)?.text).toBe('0,999');
    expect(heat.cells.find((c) => c.row === 0 && c.col === 1)?.text).toBe('−0,991');
    expect(v.strip).toBe('4 değişken · 16 hücre · köşegen 1,000');
  });

  it('adım 4 churn açıkken 5 × 5 olur', () => {
    const heat = V(3, { churn: true }).heat;
    if (!heat) throw new Error('ısı haritası yok');
    expect(heat.cells).toHaveLength(25);
    expect(heat.variables[4]).toBe('churn');
    expect(V(3, { churn: true }).strip).toBe('5 değişken · 25 hücre · köşegen 1,000');
  });

  it('adım 5 dört panel, aynı özet: r = 0,816', () => {
    const v = V(4);
    expect(v.panels.map((p) => p.id)).toEqual(['I', 'II', 'III', 'IV']);
    expect(v.panels.every((p) => p.points.length === 11)).toBe(true);
    const stats = v.panels.map((p) => p.stats);
    expect(new Set(stats).size).toBe(1);
    expect(stats[0]).toContain('r = 0,816');
    expect(v.heat).toBeNull();
    expect(v.set).toBe(1);
  });

  it('adım 6 büyük set IV: kaldıraç y canlı, r canlı', () => {
    const v = V(5);
    expect(v.panels).toHaveLength(1);
    expect(v.panels[0].id).toBe('IV');
    expect(v.panels[0].points).toHaveLength(11);
    expect(v.panels[0].points[7]).toEqual({ x: 19, y: 12.5 });
    expect(v.r).toBeCloseTo(0.816521, 6);
    expect(v.set).toBe(4);

    const low = V(5, { noktaY: 6 });
    expect(low.panels[0].points[7]).toEqual({ x: 19, y: 6 });
    expect(low.r).toBeCloseTo(-0.249327, 6);
    expect(low.strip).toContain('−0,249');

    expect(V(5, { noktaY: 20 }).r).toBeCloseTo(0.958063, 6);
  });

  it('adım 7 set II: Pearson 0,816, Spearman 0,691', () => {
    const v = V(6);
    expect(v.panels.map((p) => p.id)).toEqual(['II']);
    expect(v.r).toBeCloseTo(0.8162365, 6);
    expect(v.set).toBe(2);
    expect(v.strip).toContain('r = 0,816');
    expect(v.strip).toContain('Spearman 0,691');
    expect(v.panels[0].stats).toContain('Spearman 0,691');
  });

  it('adım 8 5 × 5 matris ve churn satır/sütunu', () => {
    const v = V(7);
    const heat = v.heat;
    if (!heat) throw new Error('ısı haritası yok');
    expect(heat.cells).toHaveLength(25);
    expect(heat.variables).toHaveLength(5);
    expect(heat.variables[4]).toBe('churn');
    expect(heat.cells.filter((c) => c.row === 4)).toHaveLength(5);
    expect(heat.cells.filter((c) => c.col === 4)).toHaveLength(5);
    expect(heat.cells.find((c) => c.row === 4 && c.col === 2)?.text).toBe('−0,363');
    expect(v.strip).toContain('churn');
    expect(v.strip).toContain('−0,387');
  });

  it('adım 9 iki kutu metni, panel yok', () => {
    const v = V(8);
    expect(v.panels).toEqual([]);
    expect(v.heat).toBeNull();
    expect(v.strip).toContain('tüm veri üzerinde EDA');
    expect(v.strip).toContain('yalnız eğitim kümesinde EDA');
    expect(v.note).toContain('bilgi sızıntısı');
  });

  it('adım 10 kural ve üç bağlantı', () => {
    const v = V(9);
    expect(v.strip).toContain('Özet istatistik yeterli değildir, grafik şart');
    for (const link of ['kutu-grafigi', 'iqr-aykiri', 'pca']) expect(v.strip).toContain(link);
    expect(v.panels).toEqual([]);
    expect(v.note).toContain('grafik şart');
  });

  it('her adımın tek cümlelik notu var', () => {
    for (let i = 0; i < STEPS; i++) {
      const note = V(i).note.trim();
      expect(note.length, String(i)).toBeGreaterThan(10);
      expect(note.endsWith('.'), note).toBe(true);
    }
  });

  it('hiçbir şeritte ya da notta sıfır olmayan değer 0,00 yazılmaz', () => {
    const params: Partial<KorelParams>[] = [{}, { churn: true }, { noktaY: 6 }, { noktaY: 20 }, { set: 4 }];
    for (const over of params) {
      for (let i = 0; i < STEPS; i++) {
        const v = V(i, over);
        const text = [v.strip, v.note, ...v.panels.map((p) => p.stats),
          ...(v.heat?.cells.map((c) => c.text) ?? [])].join(' ');
        expect(text, `${v.stepId} ${JSON.stringify(over)}`).not.toMatch(/0,00/);
      }
    }
  });
});
