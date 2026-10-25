import { describe, expect, it } from 'vitest';
import {
  BASELINE, BOOK, DAYS, DAY_OPTIONS, GRID, META, cellOf,
} from '../../../src/concepts/crisp-dm/data';

const round = (v: number, d: number): number => Math.round(v * 10 ** d) / 10 ** d;

describe('crisp-dm data', () => {
  it('book numbers come from data', () => {
    expect(BOOK.isHedefi.amac).toBe('Sandviç israfını azaltmak');
    expect(BOOK.kafeVerisi).toHaveLength(4);
    expect(BOOK.kafeVerisi.map(r => r.satis_adedi)).toEqual([95, 110, 42, 30]);
    expect(round(BOOK.satisKayitlari.normal, 1)).toBe(63.5);
    expect(round(BOOK.satisKayitlari.sinav, 1)).toBe(70.5);
    expect(round(BOOK.hamVeri.kahveFillna0, 1)).toBe(40);
    expect(round(BOOK.hamVeri.kahveAtlanir, 1)).toBe(80);
    expect(round(BOOK.hamVeri.genelAtlanir, 1)).toBe(57.5);
    expect(round(BOOK.hamVeri.genelFillna0, 2)).toBe(38.33);
    expect(round(BOOK.kafeAnalizi.mean, 1)).toBe(90);
    expect(BOOK.kafeAnalizi.count).toBe(2);
    expect(BOOK.kafeAnalizi.used).toBe(1);
    expect(round(BOOK.kafeVerisiGrup.normal, 1)).toBe(68.5);
    expect(round(BOOK.kafeVerisiGrup.sinav, 1)).toBe(70);
  });

  it('seventy days with a fifty-six day pool and a fourteen day test', () => {
    expect(DAYS).toHaveLength(70);
    expect(META.poolDays).toBe(56);
    expect(META.testDays).toBe(14);
    expect(DAYS[0].date).toBe('2026-03-06');
    expect(DAYS[55].date).toBe('2026-04-30');
    expect(DAYS[56].date).toBe('2026-05-01');
    expect(DAYS[69].date).toBe('2026-05-14');
    expect(DAYS.filter(d => d.test)).toHaveLength(14);
    expect(DAYS.slice(56).every(d => d.test)).toBe(true);
    expect(DAYS.slice(0, 56).every(d => !d.test)).toBe(true);
  });

  it('four missing sales in the pool', () => {
    const pool = DAYS.slice(0, 56);
    const missing = pool.filter(d => d.satis === null);
    expect(missing).toHaveLength(4);
    expect(missing.filter(d => d.sinav)).toHaveLength(2);
    expect(missing.filter(d => !d.sinav)).toHaveLength(2);
    expect(DAYS.slice(56).every(d => d.satis !== null)).toBe(true);
  });

  it('grid holds thirty-two cells', () => {
    expect(GRID).toHaveLength(32);
    expect(new Set(GRID.map(c => `${c.days}/${c.missing}/${c.stock}/${c.leak}`)).size).toBe(32);
    expect(cellOf(56, 'cikar', 'soran', false).enough).toBe(true);
    expect(BASELINE.demand).toBe(DAYS.slice(56).reduce((a, d) => a + d.talep, 0));
  });

  it('four and fourteen days have no exam day', () => {
    for (const c of GRID) {
      if (c.days === 4 || c.days === 14) {
        expect(c.usable.sinav).toBe(0);
        expect(c.enough).toBe(false);
        expect(c.pred.sinav).toBeNull();
      } else {
        expect(c.enough).toBe(true);
      }
    }
    expect(DAY_OPTIONS).toEqual([4, 14, 28, 56]);
  });

  it('old order sells min of demand and fifty', () => {
    expect(META.oldOrder).toBe(50);
    for (const d of DAYS) {
      expect(d.stokTukendi).toBe(d.talep >= 50);
      if (d.satis !== null) {
        expect(d.satis).toBe(Math.min(d.talep, 50));
      }
    }
  });
});
