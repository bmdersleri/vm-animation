import { describe, it, expect } from 'vitest';
import {
  CURVE_STEPS,
  IMPORTANCE_STEPS,
  OOB_STEPS,
  ROOT_STEPS,
  randomForestScenario,
} from '../../../src/concepts/random-forest/scenario';
import { BOOTS, CUSTOMERS, RF } from '../../../src/concepts/topluluk/data';
import { predictTree } from '../../../src/concepts/topluluk/tree';
import { formatNumber } from '../../../src/core/plot/format';

const step = (id: string) => randomForestScenario.steps.find((s) => s.id === id)!;
const fmt = (x: number) => formatNumber(x, 3);

/** OOB score of the 50 trees counted straight from the bootstrap counts (no vote.ts). */
function oobFixture(): { correct: number; total: number } {
  let correct = 0;
  let total = 0;
  CUSTOMERS.forEach((c, i) => {
    let yes = 0;
    let n = 0;
    for (const b of BOOTS) {
      if (b.counts[i] !== 0) continue;
      n++;
      yes += predictTree(b.tree, [c.t, c.c]);
    }
    if (n === 0) return;
    total++;
    if ((yes * 2 > n ? 1 : 0) === c.y) correct++;
  });
  return { correct, total };
}

describe('random-forest scenario', () => {
  it('step ids follow the spec', () => {
    expect(randomForestScenario.steps.map((s) => s.id)).toEqual([
      'kokler',
      'alt-kume',
      'varyans',
      'max-features',
      'oob-matris',
      'oob-skor',
      'oob-cv',
      'agac-sayisi',
      'onem',
      'tuzak',
    ]);
    expect(ROOT_STEPS).toEqual([0, 1, 2, 3]);
    expect(OOB_STEPS).toEqual([4, 5]);
    expect(CURVE_STEPS).toEqual([6, 7]);
    expect(IMPORTANCE_STEPS).toEqual([8, 9]);
    expect(step('max-features').sweep).toMatchObject({ key: 'maxFeatures', values: [1, 2, 3, 4, 5, 6, 7, 8] });
    expect(step('agac-sayisi').sweep!.key).toBe('nEstimators');
    expect(step('agac-sayisi').sweep!.values[0]).toBe(10);
    expect(step('agac-sayisi').sweep!.values.at(-1)).toBe(500);
  });

  it('step texts read their numbers from the data', () => {
    const bag = RF.byMf[7];
    const forest = RF.byMf[1];
    // step 1: the two biggest root counts of the 250 bagging trees
    const top = [...bag.roots].sort((a, b) => b - a);
    expect(bag.roots.reduce((s, x) => s + x, 0)).toBe(250);
    expect(step('kokler').text).toContain(`köklerin ${top[0] + top[1]} tanesi`);
    expect(step('kokler').text).toContain(`${RF.names[bag.roots.indexOf(top[0])]} ${top[0]}`);
    expect(step('kokler').text).toContain(`${RF.names[bag.roots.indexOf(top[1])]} ${top[1]}`);
    // step 3: both correlations
    expect(step('varyans').text).toContain(`bagging ${fmt(bag.rho)}`);
    expect(step('varyans').text).toContain(`Random Forest ${fmt(forest.rho)}`);
    expect(step('varyans').text).toContain('ρσ² + (1 − ρ)σ²/M');
    // step 6: the OOB score of 50 trees
    const s = oobFixture();
    expect(step('oob-skor').text).toContain(`OOB skoru = ${s.correct} / ${s.total} = ${fmt(s.correct / s.total)}`);
    // later steps
    expect(step('oob-cv').text).toContain('0,899');
    expect(step('oob-cv').text).toContain('0,896');
    expect(step('tuzak').text).toContain('musteriNo');
    for (const st of randomForestScenario.steps) {
      expect(st.text).not.toMatch(/NaN|undefined|Infinity/);
    }
  });

  it('step 5 writes the unseen count without an apostrophe suffix', () => {
    expect(step('oob-matris').text).toMatch(/12 ağaçtan \d+ tanesi onu görmedi: /);
    expect(step('oob-matris').text).not.toMatch(/\d+'(si|sı|u|ü|i|ı)(?![\p{L}])/u);
  });

  it('defaults follow the spec', () => {
    expect(randomForestScenario.defaults).toMatchObject({
      maxFeatures: 2,
      rho: RF.byMf[1].rho,
      trees: 50,
      pick: 1,
      nEstimators: 300,
      method: 'mdi',
      withId: false,
    });
  });
});
