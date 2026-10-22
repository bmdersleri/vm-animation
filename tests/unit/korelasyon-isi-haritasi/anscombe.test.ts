import { describe, expect, it } from 'vitest';
import { pearson } from '../../../src/core/stats';
import {
  ANSCOMBE, LEVERAGE, anscombeR, anscombeWithoutLeverage, spearman,
} from '../../../src/concepts/korelasyon-isi-haritasi/anscombe';
import { ANSCOMBE_JSON } from '../../../src/concepts/korelasyon-isi-haritasi/data';

describe('Anscombe dörtlüsü', () => {
  it('dört set aynı özeti verir', () => {
    for (const s of ANSCOMBE) {
      expect(s.meanX).toBe(9);
      expect(s.varX).toBe(11);
      // set III'ün ortalaması tam 7,5: 7,5009 ile farkı 0,0009, 3 basamak toleransından büyük
      expect(s.meanY).toBeCloseTo(7.5009, 2);
      expect(s.varY).toBeCloseTo(4.127, 2);
      expect(s.r).toBeCloseTo(0.8164, 3);
    }
  });

  it('her setin r’si pearson(x, y) ile aynı', () => {
    for (const s of ANSCOMBE) {
      expect(s.r, s.id).toBeCloseTo(pearson(s.x, s.y), 12);
      expect(s.slope, s.id).toBeGreaterThan(0.499);
      expect(s.slope, s.id).toBeLessThan(0.501);
    }
  });

  it('kaldıraç noktası r’yi taşır', () => {
    expect(anscombeR(3, 12.5)).toBeCloseTo(0.816521, 6);
    expect(anscombeR(3, 6)).toBeCloseTo(-0.249327, 6);
    expect(anscombeR(3, 20)).toBeCloseTo(0.958063, 6);
  });

  it('kaldıraç çıkınca x sabit: r NaN', () => {
    const s = ANSCOMBE[3];
    const x = s.x.filter((_, i) => i !== 7);
    const y = s.y.filter((_, i) => i !== 7);
    expect(pearson(x, y)).toBeNaN();
    expect(anscombeWithoutLeverage()).toBeNaN();
  });

  it('kaldıraç noktası set IV’te 7. indeks', () => {
    expect(LEVERAGE).toEqual({ set: 4, index: 7, x: 19, y: 12.5 });
    expect(ANSCOMBE[3].x[LEVERAGE.index]).toBe(LEVERAGE.x);
    expect(ANSCOMBE[3].y[LEVERAGE.index]).toBe(LEVERAGE.y);
  });

  it('sürükleme tablosunun yedi r’si de canlı hesaptan çıkar', () => {
    expect(ANSCOMBE_JSON.drag).toHaveLength(7);
    for (const row of ANSCOMBE_JSON.drag) {
      expect(anscombeR(3, row.y), String(row.y)).toBeCloseTo(row.r, 12);
    }
  });

  it('set II’nin Spearman’ı 0,691', () => {
    const s = ANSCOMBE[1];
    expect(spearman(s.x, s.y)).toBeCloseTo(0.6909090909, 9);
    expect(ANSCOMBE_JSON.spearman).toBeCloseTo(spearman(s.x, s.y), 12);
    // x’te beraberlik yok; sıra korelasyonu Pearson ile aynı tanımı kullanır
    expect(spearman(s.x, s.y)).toBeLessThan(s.r);
  });
});
