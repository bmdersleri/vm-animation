import { describe, expect, it } from 'vitest';
import fixture from '../../fixtures/naive-bayes_sklearn.json';
import { gauss } from '../../../src/concepts/naive-bayes/data';
import { naturalCounts, posteriorOf } from '../../../src/concepts/naive-bayes/bayes';
import { trail, trailWith, PRIOR_SPAM } from '../../../src/concepts/naive-bayes/spam';
import { fitGaussian, proba, pdf } from '../../../src/concepts/naive-bayes/gaussian';

describe('natural frequencies', () => {
  it('natural counts at the defaults', () => {
    const n = naturalCounts(0.01, 0.9, 0.1);
    expect(n.sick).toBe(10);
    expect(n.tp).toBe(9);
    expect(n.fp).toBe(99);
    expect(n.posterior).toBeCloseTo(9 / 108, 12);
  });

  it('prior 10% gives 50%', () => {
    const n = naturalCounts(0.1, 0.9, 0.1);
    expect(n.tp).toBe(90);
    expect(n.fp).toBe(90);
    expect(n.posterior).toBe(0.5);
  });

  it('natural counts stay whole and consistent at slider extremes', () => {
    for (const p of [0.001, 0.5])
      for (const s of [0.5, 0.99])
        for (const f of [0.01, 0.5]) {
          const n = naturalCounts(p, s, f);
          for (const v of [n.sick, n.tp, n.fn, n.healthy, n.fp, n.tn]) {
            expect(Number.isInteger(v)).toBe(true);
          }
          expect(n.sick + n.healthy).toBe(1000);
          expect(n.tp + n.fn).toBe(n.sick);
          expect(n.fp + n.tn).toBe(n.healthy);
        }
  });

  it('zero positives give a null posterior', () => {
    expect(posteriorOf(0, 0)).toBeNull();
  });
});

describe('multinomial trail', () => {
  const r3 = (a: (number | null)[]) => a.map((v) => (v === null ? null : Math.round(v * 1000) / 1000));

  it('story with alpha 0', () => {
    expect(r3(trail(['bedava', 'kazandınız', 'toplantı'], 0))).toEqual([0.4, 0.909, 0.995, 0.964]);
  });

  it('unseen word with alpha 0 zeroes spam, alpha 1 recovers', () => {
    const w = ['bedava', 'kazandınız', 'toplantı', 'rapor'];
    expect(trail(w, 0).at(-1)).toBe(0);
    expect(trail(w, 1).at(-1)!).toBeCloseTo(0.816, 3);
    expect(trail(w, 1).at(-1)!).toBeGreaterThan(0.7);
  });

  it('alpha 0 with both classes at zero gives a null posterior', () => {
    const c = { docs: [10, 10] as [number, number], counts: { a: [5, 5], z: [0, 0] } as Record<string, [number, number]> };
    const t = trailWith(c, ['a', 'z', 'a'], 0);
    expect(t[0]).toBe(PRIOR_SPAM);
    expect(t[1]).not.toBeNull();
    expect(t[2]).toBeNull();
    expect(t[3]).toBeNull();
  });

  it('order does not change the end point', () => {
    const a = trail(['bedava', 'toplantı', 'fatura'], 1).at(-1)!;
    const b = trail(['fatura', 'bedava', 'toplantı'], 1).at(-1)!;
    expect(a).toBeCloseTo(b, 12);
  });

  it('multinomial matches sklearn', () => {
    for (const c of fixture.multinomial) {
      expect(trail(c.words, 1).at(-1)!).toBeCloseTo(c.proba[1], 9);
    }
    for (const c of fixture.alpha0) {
      expect(trail(c.words, 0).at(-1)!).toBeCloseTo(c.proba[1], 9);
    }
  });
});

describe('GaussianNB', () => {
  const x = gauss.train.map((r) => [r.t, r.c] as [number, number]);
  const y = gauss.train.map((r) => r.y);
  const m = fitGaussian(x, y);
  const g = fixture.gaussian;

  it('gaussian matches sklearn', () => {
    for (let k = 0; k < 2; k++) {
      expect(m.prior[k]).toBeCloseTo(g.prior[k], 9);
      for (let f = 0; f < 2; f++) {
        expect(m.theta[k][f]).toBeCloseTo(g.theta[k][f], 9);
        expect(m.var[k][f]).toBeCloseTo(g.var[k][f], 9);
      }
    }
    for (const c of g.cases) {
      const p = proba(m, c.x as [number, number]);
      expect(p[0]).toBeCloseTo(c.proba[0], 9);
      expect(p[1]).toBeCloseTo(c.proba[1], 9);
    }
  });

  it("the book's first test customer is 0.815 / 0.185", () => {
    const p = proba(m, [gauss.firstTest.t, gauss.firstTest.c]);
    expect(p[0]).toBeCloseTo(0.815, 3);
    expect(p[1]).toBeCloseTo(0.185, 3);
  });

  it('pdf integrates to about 1', () => {
    let s = 0;
    for (let v = -100; v <= 150; v += 0.1) s += pdf(m, 0, 0, v) * 0.1;
    expect(s).toBeCloseTo(1, 3);
  });
});
