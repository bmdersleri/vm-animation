import { describe, it, expect } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { BOOK, REG } from '../../../src/concepts/boosting/data';
import { bestIndex, boost } from '../../../src/concepts/boosting/boost';
import {
  COMPARE_STEPS,
  ERROR_STEPS,
  PANEL_STEPS,
  gradyanArtirmaScenario as sc,
} from '../../../src/concepts/gradyan-artirma/scenario';
import { formatNumber as f } from '../../../src/core/plot/format';

const step = (id: string) => sc.steps.find((s) => s.id === id)!;
const run = (nu: number) => boost(REG.train, REG.val, nu, 2, 200);

describe('gradyan-artirma scenario', () => {
  it('step ids follow the spec', () => {
    expect(sc.steps.map((s) => s.id)).toEqual([
      'veri',
      'baslangic',
      'artik',
      'ilk-agac',
      'kucuk-adim',
      'tekrar',
      'durma',
      'ogrenme-orani',
      'ezber',
      'bagging-karsi',
    ]);
    expect(PANEL_STEPS).toEqual([0, 1, 2, 3, 4, 5]);
    expect(ERROR_STEPS).toEqual([6, 7, 8]);
    expect(COMPARE_STEPS).toEqual([9]);
    expect(sc.defaults).toEqual({ nu: 0.3, depth: 2, m: 0, trees: 200, showVal: false });
  });

  it('step texts read their numbers from the data', () => {
    // step 4: three thresholds of the first tree
    expect(step('ilk-agac').text).toContain('0,616; 2,651; 6,372');
    // step 5: the error after the first tree
    expect(step('kucuk-adim').text).toContain(f(BOOK.mse[0], 4));
    expect(step('kucuk-adim').text).toContain('0,2952');
    expect(step('kucuk-adim').text).toContain('%30');
    // step 6: the table values, the last one and the ratio
    expect(step('tekrar').text).toContain('0,2138; 0,1587; 0,1201; 0,0933');
    const ratio = BOOK.mse[4] / BOOK.mse[0];
    expect(f(ratio, 1)).toBe('0,3');
    expect(step('tekrar').text).toContain('yaklaşık üçte biri');
    // step 7: the dip tree and its error
    const base = run(0.3);
    const best = bestIndex(base.valMse);
    expect(best).toBe(34);
    expect(step('durma').text).toContain(`${best}. ağaçta en düşük (${f(base.valMse[best - 1], 4)})`);
    expect(step('durma').text).toContain('0,0139');
    // step 8: three dips
    const dips = [1, 0.3, 0.05].map((nu) => {
      const r = run(nu);
      const at = bestIndex(r.valMse);
      return { at, v: f(r.valMse[at - 1], 4) };
    });
    expect(dips.map((d) => d.at)).toEqual([17, 34, 184]);
    expect(step('ogrenme-orani').text).toContain('17. / 34. / 184. ağaçta');
    expect(step('ogrenme-orani').text).toContain(dips.map((d) => d.v).join(' / '));
    expect(step('ogrenme-orani').text).toContain('0,0158 / 0,0139 / 0,0126');
    for (const s of sc.steps) {
      expect(s.text).not.toMatch(/NaN|undefined|Infinity/);
    }
  });

  it('plays m 2 to 5 in step 6 and 1 to 200 trees in step 7', () => {
    expect(step('tekrar').sweep!.key).toBe('m');
    expect(step('tekrar').sweep!.values).toEqual([2, 3, 4, 5]);
    expect(step('durma').sweep!.key).toBe('trees');
    expect(step('durma').sweep!.values).toHaveLength(200);
  });

  it('only step 9 shows the validation points', () => {
    const player = new StepPlayer(sc);
    const shown = sc.steps.map((_, i) => {
      player.goto(i);
      return player.state.params.showVal;
    });
    expect(shown.map((v, i) => (v ? i : -1)).filter((i) => i >= 0)).toEqual([8]);
    player.destroy();
  });

  it('no Turkish apostrophe suffix follows a computed number', () => {
    const texts = sc.steps.map((s) => s.text).join(' ');
    expect(texts).not.toMatch(/[\d²³]'(de|da|den|dan|e|a|ye|ya|in|ın|nin|nın|si|sı|sini|sını|yi|yı|i|ı|te|ta)/);
  });
});
