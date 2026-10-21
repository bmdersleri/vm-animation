import { describe, it, expect } from 'vitest';
import { COLUMNS, VALUES, RFE, type RfePath } from '../../../src/concepts/ozellik-secimi/data';
import {
  VT_OPTIONS, VARIANCES, F_SCORES, varianceSupport, scoreOrder, selectKBest,
  rfeSelected, rfeRanking, rfeState, names,
} from '../../../src/concepts/ozellik-secimi/select';
import { std0 } from '../../../src/core/stats';
import fixture from '../../fixtures/boyut_sklearn.json';

const close = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
const secim = fixture.secim;

describe('select', () => {
  it('variances match VarianceThreshold', () => {
    expect(VARIANCES).toHaveLength(8);
    VARIANCES.forEach((v, c) => expect(close(v, secim.variance[c]), COLUMNS[c]).toBe(true));
  });

  it('variance support for 0, 0,01, 1 and 10', () => {
    expect([...VT_OPTIONS]).toEqual([0, 0.01, 1, 10]);
    for (const t of VT_OPTIONS) {
      const key = String(t) as keyof typeof secim.vtSupport;
      expect(names(varianceSupport(VARIANCES, t)), key).toEqual(secim.vtSupport[key]);
    }
  });

  it('f_classif matches sklearn including NaN', () => {
    for (let c = 0; c < 8; c++) {
      if (c === 4) continue;
      expect(close(F_SCORES[c], secim.f[c] as number), COLUMNS[c]).toBe(true);
    }
    expect(Number.isNaN(F_SCORES[4])).toBe(true);
    expect(secim.f[4]).toBeNull();
  });

  it('selectKBest puts NaN last', () => {
    expect(scoreOrder(F_SCORES)).toEqual([6, 3, 2, 7, 1, 0, 5, 4]);
    for (let k = 1; k <= 7; k++) {
      expect(names(selectKBest(F_SCORES, k)), `k=${k}`).toEqual(secim.kbest[String(k) as keyof typeof secim.kbest]);
    }
    expect(names(selectKBest(F_SCORES, 7))).not.toContain('sabitDeger');
  });

  it('scoreOrder breaks ties by column index', () => {
    expect(scoreOrder([1, 2, 2, NaN, 1])).toEqual([1, 2, 0, 4, 3]);
  });

  it('RFE selections for n 1–7 in both scalings', () => {
    for (const s of ['yok', 'standard'] as const) {
      for (let n = 1; n <= 7; n++) {
        expect(names(rfeSelected(RFE[s], n)), `${s} n=${n}`).toEqual(secim.rfe[s].support[String(n) as '1']);
      }
    }
    expect(rfeRanking(RFE.yok, 4)).toEqual([3, 5, 2, 1, 4, 1, 1, 1]);
    expect(rfeRanking(RFE.yok, 4)).toEqual(secim.rfe.yok.ranking4);
    expect(rfeRanking(RFE.standard, 4)).toEqual(secim.rfe.standard.ranking4);
  });

  it('rfeState follows the rounds', () => {
    const one = rfeState(RFE.yok, 4, 1);
    expect(one.shown).toBe(1);
    expect(one.eliminated).toEqual([{ col: 1, round: 1 }]);
    expect(one.lastElim).toBe(1);
    expect(one.coef.get(6)!).toBeCloseTo(0.6286, 4);
    expect(one.coef.get(1)!).toBeGreaterThan(3.7e-5);
    expect(one.coef.get(1)!).toBeLessThan(3.9e-5);
    expect(one.coef.size).toBe(8);

    const all = rfeState(RFE.yok, 4, 99);
    expect(all.shown).toBe(4);
    expect(all.lastElim).toBe(2);
    expect(COLUMNS[all.lastElim!]).toBe('hizmetSayisi');
    expect(all.survivors).toEqual([3, 5, 6, 7]);
    expect(all.eliminated.map((e) => e.round)).toEqual([1, 2, 3, 4]);

    const zero = rfeState(RFE.yok, 4, 0);
    expect(zero.shown).toBe(0);
    expect(zero.eliminated).toEqual([]);
    expect(zero.lastElim).toBeNull();
    expect(zero.survivors).toHaveLength(8);
    expect(zero.coef).toEqual(one.coef);

    expect(rfeState(RFE.yok, 7, 3).shown).toBe(1);
  });

  it('a finished RFE shows sklearn’s refit on the survivors (RFE.estimator_) for n 1–7 in both scalings', () => {
    for (const s of ['yok', 'standard'] as const) {
      for (let n = 1; n <= 7; n++) {
        const st = rfeState(RFE[s], n, 99);
        expect([...st.coef.keys()], `${s} n=${n}`).toEqual(st.survivors);
        const want = secim.rfe[s].estimatorCoef[String(n) as '1'];
        st.survivors.forEach((c, i) => expect(close(st.coef.get(c)!, want[i]), `${s} n=${n} ${COLUMNS[c]}`).toBe(true));
      }
    }
    expect(rfeState(RFE.yok, 4, 99).coef.get(7)!).toBeCloseTo(0.0387, 4);
  });

  it('lastCoef: |β| of the eliminated column in the round that dropped it', () => {
    expect(rfeState(RFE.yok, 4, 0).lastCoef).toBeNull();
    expect(rfeState(RFE.yok, 4, 1).lastCoef!).toBeCloseTo(3.7996e-5, 8);
    expect(rfeState(RFE.yok, 7, 1).lastCoef!).toBeCloseTo(3.7996e-5, 8);
    expect(rfeState(RFE.yok, 4, 99).lastCoef!).toBeCloseTo(0.020976, 6);
    // not finished: still the model of the round just played
    expect(rfeState(RFE.yok, 4, 3).coef.size).toBe(6);
  });

  it('rfe order comes from the data, not from coefficients', () => {
    const fake: RfePath = { ...RFE.yok, order: [7, 6, 5, 4, 3, 2, 1, 0] };
    expect(rfeSelected(fake, 2)).toEqual([true, true, false, false, false, false, false, false]);
    expect(rfeRanking(fake, 2)).toEqual([1, 1, 2, 3, 4, 5, 6, 7]);
    expect(rfeState(fake, 2, 1).eliminated).toEqual([{ col: 7, round: 1 }]);
  });

  it('std0 of the noise and the tenure', () => {
    expect(std0(VALUES[5])).toBeCloseTo(0.917, 3);
    expect(std0(VALUES[3])).toBeCloseTo(17.4, 2);
    expect(close(std0(VALUES[3]), secim.std0[3])).toBe(true);
  });
});
