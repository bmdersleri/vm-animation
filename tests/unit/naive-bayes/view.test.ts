import { describe, expect, it } from 'vitest';
import { deriveNbView } from '../../../src/concepts/naive-bayes/view';
import { nbScenario, type NbParams } from '../../../src/concepts/naive-bayes/scenario';
import { trail } from '../../../src/concepts/naive-bayes/spam';
import { gauss } from '../../../src/concepts/naive-bayes/data';
import { fitGaussian, pdf } from '../../../src/concepts/naive-bayes/gaussian';

const D = nbScenario.defaults;
const p = (over: Partial<NbParams> = {}): NbParams => ({ ...D, ...over });

describe('deriveNbView', () => {
  it('part per step', () => {
    const parts = nbScenario.steps.map((_, i) => deriveNbView(i, p()).part);
    expect(parts).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3]);
  });

  it('reveal 2 strip at defaults', () => {
    const v = deriveNbView(2, p({ reveal: 2 }));
    expect(v.strip.split('\n')).toEqual([
      '9 / (9 + 99) = %8,3',
      'P(hasta | +) = 0,01 · 0,9 / (0,01 · 0,9 + 0,99 · 0,1)',
    ]);
    expect(v.bar).toBeNull();
    expect(v.gauss).toBeNull();
  });

  it('step 6 strip says yeni öncül', () => {
    const v = deriveNbView(6, p({ words: ['bedava', 'kazandınız'] }));
    expect(v.strip).toBe(
      'yeni öncül 0,91 · P(kazandınız | spam) 0,20  vs  0,09 · P(kazandınız | normal) 0,01 → %99,5 spam',
    );
    expect(v.bar?.label).toBe('P(spam)');
    const first = deriveNbView(5, p({ words: ['bedava'] }));
    expect(first.strip.startsWith('öncül 0,40 · P(bedava | spam)')).toBe(true);
  });

  it('ghost trail only at step 8', () => {
    const v8 = deriveNbView(8, p({ words: ['toplantı', 'kazandınız', 'bedava'] }));
    expect(v8.ghost).toEqual(trail(['bedava', 'kazandınız', 'toplantı'], 0));
    for (const i of [0, 4, 5, 6, 7, 9, 10, 12]) expect(deriveNbView(i, p()).ghost).toBeNull();
    const end = v8.trail[3] as number;
    expect(end).toBeCloseTo(v8.ghost![3] as number, 12);
  });

  it('null posterior strip', () => {
    const v = deriveNbView(9, p({ words: ['bedava', 'rapor'], alpha: 0 }));
    expect(v.trail.at(-1)).not.toBeNull();
    const w = deriveNbView(9, p({ words: ['xyz'], alpha: 0 }));
    expect(w.trail.at(-1)).toBeNull();
    expect(w.strip).toBe('İki sınıf da sıfır: karar verilemiyor');
    expect(w.bar?.spam).toBeNull();
  });

  it('empty words strip', () => {
    const v = deriveNbView(4, p({ words: [] }));
    expect(v.strip).toBe('Henüz kelime yok: sonsal = öncül');
    expect(v.bar?.spam).toBeCloseTo(0.4, 12);
  });

  it('gauss heights equal pdf at the query', () => {
    const q = { t: 30, c: 2 };
    const v = deriveNbView(11, p({ query: q }));
    const m = fitGaussian(
      gauss.train.map((r) => [r.t, r.c] as [number, number]),
      gauss.train.map((r) => r.y),
    );
    expect(v.gauss!.query).toEqual(q);
    for (const f of [0, 1] as const)
      for (const k of [0, 1] as const)
        expect(v.gauss!.heights[f][k]).toBeCloseTo(pdf(m, k, f, f === 0 ? q.t : q.c), 12);
  });

  it('bar at step 11 equals the book\'s 0.185', () => {
    const v = deriveNbView(11, p());
    expect(v.bar!.label).toBe('P(Ayrıldı)');
    expect(v.bar!.spam!).toBeCloseTo(0.185, 3);
    expect(v.strip).toContain('0,185');
    expect(v.trail).toEqual([]);
  });
});
