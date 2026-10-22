import { describe, expect, it } from 'vitest';
import { deriveDagilimView } from '../../../src/concepts/dagilim-carpiklik/view';
import type { DagilimParams } from '../../../src/concepts/dagilim-carpiklik/scenario';
import { BINS, SERIES, SWEEP } from '../../../src/concepts/dagilim-carpiklik/data';

const p = (over: Partial<DagilimParams> = {}): DagilimParams => (
  { seri: '002', extreme: 28, bins: 5, log: false, ...over }
);

describe('dagilim view', () => {
  it('adım 1 on noktanın en düşüğü ve en yükseği', () => {
    const v = deriveDagilimView(0, p());
    expect(v.stepId).toBe('noktalar');
    expect(v.values).toEqual(SERIES['002'].values);
    expect(v.strip).toBe('n = 10 · en düşük 8 · en yüksek 30');
  });

  it('adım 2 beş kova ve 4,2,2,1,1', () => {
    const v = deriveDagilimView(1, p());
    expect(v.bins.map((b) => b.count)).toEqual([4, 2, 2, 1, 1]);
    expect(v.strip).toContain('4, 2, 2, 1, 1');
    expect(v.bins[0].lo).toBe(8);
    expect(v.bins[4].hi).toBe(30);
    expect(v.bins.map((b) => b.count)).toEqual(BINS['002']['5']);
  });

  it('adım 3 ortalama 16,4 medyan 14,5', () => {
    const v = deriveDagilimView(2, p());
    expect(v.mean).toBeCloseTo(16.4, 6);
    expect(v.median).toBeCloseTo(14.5, 6);
    expect(v.strip).toContain('16,4');
    expect(v.strip).toContain('14,5');
    expect(v.strip).toBe('(8 + 10 + … + 30) / 10 = 16,4; ortadaki iki değer (14 + 15) / 2 = 14,5');
  });

  it('adım 4 çarpıklık 0,90 sağ kuyruk', () => {
    const v = deriveDagilimView(3, p());
    expect(v.skew).toBeCloseTo(0.9010585, 6);
    expect(v.tail).toBe('right');
    expect(v.strip).toContain('0,90');
    expect(v.strip).toBe('çarpıklık = 0,90 > 0: sağ kuyruk uzun');
    // the series selector is live on step 4: the shaded side follows the sign
    expect(deriveDagilimView(3, p({ seri: 'sol' })).tail).toBe('left');
    expect(deriveDagilimView(3, p({ seri: 'simetrik' })).tail).toBeNull();
  });

  it('adım 5 şerit seçilen kova sayısını izler', () => {
    expect(deriveDagilimView(4, p({ bins: 3 })).strip).toBe('bins = 3 → 6, 2, 2');
    expect(deriveDagilimView(4, p({ bins: 3 })).bins.map((b) => b.count)).toEqual(BINS['002']['3']);
    expect(deriveDagilimView(4, p({ bins: 10 })).strip).toBe('bins = 10 → 2, 2, 1, 1, 1, 1, 0, 1, 0, 1');
    expect(deriveDagilimView(4, p({ bins: 10 })).bins.map((b) => b.count)).toEqual(BINS['002']['10']);
  });

  it('adım 6 log 0,90 → 0,25', () => {
    const v = deriveDagilimView(5, p({ log: true }));
    // plan 0,2506 yazıyor; pandas değeri 0,250676, yani dört basamakta 0,2507.
    expect(v.skew).toBeCloseTo(0.250676, 4);
    expect(v.mean).toBeCloseTo(2.7887, 4);
    expect(v.strip).toContain('0,90 → 0,25');
    expect(v.strip).toBe('log1p: çarpıklık 0,90 → 0,25; ortalama 16,4 → 2,79');
    expect(v.log).toBe(true);
  });

  it('adım 6 şeridin iki tarafı aynı seriden', () => {
    const v = deriveDagilimView(5, p({ seri: '003', log: true }));
    expect(v.strip).toBe('log1p: çarpıklık 2,54 → 1,50; ortalama 10,4 → 2,33');
  });

  it('adım 7 uç değer 60: medyan sabit', () => {
    const v = deriveDagilimView(6, p({ seri: '003', extreme: 60 }));
    expect(v.seri).toBe('003');
    expect(v.mean).toBeCloseTo(13.6, 6);
    expect(v.median).toBeCloseTo(8.5, 6);
    expect(v.skew).toBeCloseTo(3.0602, 4);
    expect(v.values).toEqual([5, 6, 7, 8, 8, 9, 10, 11, 12, 60]);
    expect(v.strip).toBe('uç değer 60 → ortalama 13,6 · medyan 8,5 · çarpıklık 3,06');
    expect(v.mean).toBeCloseTo(SWEEP[SWEEP.length - 1].mean, 6);
  });

  it('adım 7 seri parametresi ne olursa olsun 003 serisini gösterir', () => {
    const v = deriveDagilimView(6, p({ extreme: 60 }));
    expect(v.seri).toBe('003');
    expect(v.mean).toBeCloseTo(13.6, 6);
    expect(deriveDagilimView(6, p()).mean).toBeCloseTo(10.4, 6);
  });

  it('adım 8 üç şekil', () => {
    expect(deriveDagilimView(7, p({ seri: 'simetrik' })).skew).toBeCloseTo(0, 6);
    // plan −1,0607 yazıyor; pandas değeri −1,060769, yani dört basamakta −1,0608.
    expect(deriveDagilimView(7, p({ seri: 'sol' })).skew).toBeCloseTo(-1.060769, 4);
    expect(deriveDagilimView(7, p({ seri: 'sol' })).tail).toBe('left');
    expect(deriveDagilimView(7, p({ seri: 'simetrik' })).tail).toBeNull();
    expect(deriveDagilimView(7, p()).tail).toBe('right');
    expect(deriveDagilimView(7, p()).strip).toBe('sağ: 0,90 · simetrik: 0 · sol: −1,06');
    expect(deriveDagilimView(7, p({ seri: '003' })).strip).toBe('sağ: 2,54 · simetrik: 0 · sol: −1,06');
  });

  it('adım 8 artık log taşımaz: ham seriler ve işaret çarpıklıktan', () => {
    const v = deriveDagilimView(7, p({ log: true }));
    expect(v.log).toBe(false);
    expect(v.values).toEqual(SERIES['002'].values);
    expect(v.strip).toBe('sağ: 0,90 · simetrik: 0 · sol: −1,06');
    expect(deriveDagilimView(7, p({ log: true, seri: 'sol' })).tail).toBe('left');
  });

  it('adım 9 eşikler ve dayanıklı özet', () => {
    const v = deriveDagilimView(8, p());
    expect(v.stepId).toBe('kural');
    expect(v.thresholds).toBe(true);
    expect(v.strip).toContain('|çarpıklık| < 0,5 ≈ simetrik · 0,5–1 orta · > 1 güçlü');
    expect(v.strip).toContain('medyan + IQR');
    // the small-sample warning closes the page (spec red line)
    expect(v.strip.split('\n')).toEqual([
      '|çarpıklık| < 0,5 ≈ simetrik · 0,5–1 orta · > 1 güçlü · çarpıklık varsa özet: medyan + IQR',
      'n = 10: küçük örneklemde çarpıklık tek gözlemle değişir',
    ]);
    for (let i = 0; i < 8; i++) expect(deriveDagilimView(i, p()).thresholds).toBe(false);
  });

  it('işaretler 3–8. adımlarda görünür', () => {
    const shown = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => deriveDagilimView(i, p()).showMean);
    expect(shown).toEqual([false, false, true, true, true, true, true, true, false]);
    for (let i = 0; i < 9; i++) {
      expect(deriveDagilimView(i, p()).showMedian, String(i)).toBe(shown[i]);
    }
  });

  it('her adımın tek cümlelik bir notu var', () => {
    for (let i = 0; i < 9; i++) {
      const note = deriveDagilimView(i, p()).note.trim();
      expect(note.length, String(i)).toBeGreaterThan(10);
      expect(note.endsWith('.'), note).toBe(true);
    }
  });

  it('hiçbir şeritte sıfır olmayan değer 0,00 yazılmaz', () => {
    const params = [p(), p({ log: true }), p({ seri: 'sol' }), p({ seri: 'simetrik' }), p({ seri: '003' })];
    for (const q of params) {
      for (let i = 0; i < 9; i++) {
        const v = deriveDagilimView(i, q);
        expect(v.strip, v.stepId).not.toMatch(/0,00/);
        expect(v.note, v.stepId).not.toMatch(/0,00/);
      }
    }
  });
});
