import { describe, it, expect } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { baggingScenario, BAG_STEPS, CHART_STEPS, REGION_STEPS } from '../../../src/concepts/bagging/scenario';
import { BOOK_BOOT, BOOTS, EXPERIMENT, PICKS, CUSTOMERS } from '../../../src/concepts/topluluk/data';
import { meanStd } from '../../../src/concepts/topluluk/math';
import { votes } from '../../../src/concepts/topluluk/vote';
import { formatNumber } from '../../../src/core/plot/format';

const step = (id: string) => baggingScenario.steps.find((s) => s.id === id)!;

describe('bagging scenario', () => {
  it('step ids follow the spec', () => {
    expect(baggingScenario.steps.map((s) => s.id)).toEqual([
      'torba',
      'cekilis',
      'oob',
      'yuzde',
      'tek-agac',
      'uc-agac',
      'oylama',
      'cogunluk',
      'deney',
      'sinir',
    ]);
    expect(BAG_STEPS).toEqual([0, 1, 2, 3]);
    expect(REGION_STEPS).toEqual([4, 5, 6]);
    expect(CHART_STEPS).toEqual([7, 8, 9]);
  });

  it('step texts read their numbers from the data', () => {
    expect(BOOK_BOOT.oob).toEqual([1, 3, 5, 9]);
    expect(step('oob').text).toContain('4 / 10');
    expect(step('oob').text).toContain('0 ×3, 4 ×2, 6 ×2');
    expect(step('oob').text).toContain('%40,0');
    expect(step('cekilis').text).toContain('[0 7 6 4 4 8 0 6 2 0]');
    expect(step('yuzde').text).toContain('0,349');
    expect(step('yuzde').text).toContain('0,651');
    expect(step('yuzde').text).toContain('0,368');
    expect(step('tek-agac').text).toContain('25 / 25');
    const yes = votes([CUSTOMERS[PICKS.vote].t, CUSTOMERS[PICKS.vote].c], 50);
    expect(step('oylama').text).toContain(`${yes} tanesi Ayrıldı`);
    expect(step('cogunluk').text).toContain('0,104');
    expect(step('cogunluk').text).toContain('0,896');
    const t = meanStd(EXPERIMENT.tree);
    const b = meanStd(EXPERIMENT.bagging);
    expect(step('deney').text).toContain(`ortalama ${formatNumber(t.mean, 3)}, std ${formatNumber(t.std, 3)}`);
    expect(step('deney').text).toContain('0,749');
    expect(step('deney').text).toContain('0,835');
    expect(step('deney').text).toContain(`ortalama ${formatNumber(b.mean, 3)}, std ${formatNumber(b.std, 3)}`);
    expect(BOOTS).toHaveLength(50);
    for (const s of baggingScenario.steps) {
      expect(s.text).not.toMatch(/NaN|undefined|Infinity/);
    }
  });

  it('plays 10 draws in step 2 and 1 to 50 trees in step 7', () => {
    expect(step('cekilis').sweep!.key).toBe('shown');
    expect(step('cekilis').sweep!.count!(baggingScenario.defaults)).toBe(10);
    expect(step('oylama').sweep!.key).toBe('trees');
    expect(step('oylama').sweep!.values).toHaveLength(50);
    expect(baggingScenario.defaults).toMatchObject({ n: 10, draw: 0, tree: 1, trees: 50, p: 0.8, m: 3, pick: PICKS.vote });
  });

  it('the shown draws come back to all after step 2', () => {
    const player = new StepPlayer(baggingScenario);
    player.goto(0);
    expect(player.state.params.shown).toBe(0);
    player.goto(2);
    expect(player.state.params.shown).toBeGreaterThanOrEqual(10);
    player.destroy();
  });
});

it('no Turkish apostrophe suffix follows a computed number', () => {
  const texts = baggingScenario.steps.map((s) => s.text).join(' ').replaceAll("Bölüm 5'in", 'Bölüm beşin');
  expect(texts).not.toMatch(/[\d²³]'(de|da|den|dan|e|a|ye|ya|in|ın|nin|nın|si|sı|sini|sını|yi|yı|i|ı)/);
});
