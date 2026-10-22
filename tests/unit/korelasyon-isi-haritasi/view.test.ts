import { describe, expect, it } from 'vitest';
import { ANSCOMBE, spearman } from '../../../src/concepts/korelasyon-isi-haritasi/anscombe';
import {
  ANSCOMBE_SUMMARY, deriveKorelView,
} from '../../../src/concepts/korelasyon-isi-haritasi/view';
import { korelasyonScenario, type KorelParams } from '../../../src/concepts/korelasyon-isi-haritasi/scenario';

const base = (i: number): KorelParams => ({ ...korelasyonScenario.defaults, ...korelasyonScenario.steps[i].params });
const V = (i: number, over: Partial<KorelParams> = {}) => deriveKorelView(i, { ...base(i), ...over });

const STEPS = 10;

describe('korelasyon görünümü', () => {
  it('adım kimlikleri sırayla', () => {
    expect([...Array(STEPS).keys()].map((i) => V(i).stepId)).toEqual(korelasyonScenario.steps.map((s) => s.id));
  });

  it('adım 1 yalnız noktalar: eğilim ve r yok', () => {
    const v = V(0);
    expect(v.strip).toBe('7 öğrenci · x: çalışma saati · y: sınav notu');
    expect(v.panels).toHaveLength(1);
    expect(v.panels[0].id).toBe('calisma-not');
    expect(v.panels[0].points).toHaveLength(7);
    expect(v.panels[0].points[0]).toEqual({ x: 8, y: 58 });
    expect(v.panels[0].points[6]).toEqual({ x: 25, y: 94 });
    expect(v.panels[0].trend).toBeNull();
    expect(v.panels[0].stats).toBe('n = 7 öğrenci');
    expect(v.heat).toBeNull();
    expect(v.r).toBeNaN();
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

  it('adım 5 dört panel, aynı yaklaşık özet: r ≈ 0,816', () => {
    const v = V(4);
    expect(v.panels.map((p) => p.id)).toEqual(['I', 'II', 'III', 'IV']);
    expect(v.panels.every((p) => p.points.length === 11)).toBe(true);
    const stats = v.panels.map((p) => p.stats);
    expect(new Set(stats).size).toBe(1);
    expect(stats[0]).toBe(ANSCOMBE_SUMMARY);
    expect(stats[0]).toContain('r ≈ 0,816');
    expect(v.heat).toBeNull();
    expect(v.set).toBe(1);
  });

  it('panel özeti dört setin hepsine tolerans içinde yaklaşır', () => {
    const parts = ANSCOMBE_SUMMARY.split(' · ');
    const first = (s: string): number =>
      Number((s.match(/-?\d+(?:,\d+)?/)?.[0] ?? 'NaN').replace(',', '.'));
    const vars = parts[2].match(/-?\d+(?:,\d+)?/g) ?? [];
    const varAt = (k: number): number => Number((vars[k] ?? 'NaN').replace(',', '.'));
    const printed = {
      meanX: first(parts[0]),
      meanY: first(parts[1]),
      varX: varAt(0),
      varY: varAt(1),
      r: first(parts[3]),
    };
    expect(parts[0]).toContain('≈');
    expect(parts[3]).toContain('≈');
    for (const s of ANSCOMBE) {
      expect(Math.abs(printed.meanX - s.meanX), s.id).toBeLessThanOrEqual(0.5);
      expect(Math.abs(printed.meanY - s.meanY), s.id).toBeLessThanOrEqual(0.05);
      expect(Math.abs(printed.varX - s.varX), s.id).toBeLessThanOrEqual(0.5);
      // set III 4,12262: 2 basamakta 4,12 olurdu; ortak satır 4,13 der, sapma 0,0074
      expect(Math.abs(printed.varY - s.varY), s.id).toBeLessThanOrEqual(0.01);
      // set IV 0,8165214: tek başına 3 basamak 0,817 olurdu; sapma 0,00052
      expect(Math.abs(printed.r - s.r), s.id).toBeLessThanOrEqual(0.001);
    }
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

  it('adım 6 seçilen seti büyütür; kaldıraç yalnız set IV’te', () => {
    expect(V(5).set).toBe(4);
    const one = V(5, { set: 1 });
    expect(one.set).toBe(1);
    expect(one.panels[0].id).toBe('I');
    expect(one.r).toBeCloseTo(ANSCOMBE[0].r, 12);
    expect(one.panels[0].points[7]).toEqual({ x: 4, y: 4.26 });
    expect(one.strip).toContain('kaldıraç yok');
    expect(one.strip).not.toContain('tek nokta');
    // set IV dışında `noktaY` hiçbir şeyi değiştirmez
    expect(V(5, { set: 1, noktaY: 6 }).r).toBeCloseTo(ANSCOMBE[0].r, 12);
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

  it('adım 7 seçilen seti çizer; Spearman o setin kendi değeri', () => {
    expect(V(6).set).toBe(2);
    const three = V(6, { set: 3 });
    expect(three.panels[0].id).toBe('III');
    expect(three.r).toBeCloseTo(ANSCOMBE[2].r, 12);
    expect(three.strip).toContain('set III');
    expect(three.strip).toContain('Spearman');
    expect(three.strip).not.toContain('0,691');
    expect(three.panels[0].stats).toContain('Spearman');
    expect(spearman(ANSCOMBE[2].x, ANSCOMBE[2].y)).not.toBeCloseTo(0.6909090909, 3);
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

  it('adım 8 churn kapatılınca 4 × 4 kalır', () => {
    expect(V(7).heat?.variables).toHaveLength(5);
    const off = V(7, { churn: false });
    expect(off.heat?.variables).toHaveLength(4);
    expect(off.heat?.cells).toHaveLength(16);
    expect(off.strip).toContain('4 değişken · 16 hücre');
    expect(off.strip).toContain('churn kapalı');
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

  it('köşegen dışındaki hiçbir hücre 1,000 yazmaz', () => {
    for (const over of [{}, { churn: true }]) {
      for (const i of [3, 7]) {
        const heat = V(i, over).heat;
        if (!heat) throw new Error(`${i}: ısı haritası yok`);
        for (const cell of heat.cells) {
          if (cell.row === cell.col) continue;
          expect(cell.text, `${i} ${cell.row},${cell.col}`).not.toBe('1,000');
          expect(cell.text, `${i} ${cell.row},${cell.col}`).not.toMatch(/^1,00/);
        }
      }
    }
  });
});
