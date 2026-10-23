import { describe, it, expect } from 'vitest';
import { normalScenario, normalShortcuts, SERIES_STEPS, MU_SIGMA_STEPS } from '../../../src/concepts/normal-dagilim/scenario';
import { SERIES, SINAV_FIXED } from '../../../src/concepts/normal-dagilim/data';
import { formatNumber, formatPercent } from '../../../src/core/plot/format';
import { StepPlayer } from '../../../src/core/player';
import { labTextTests } from '../lab-text';
describe('normal scenario', () => {
 it('has the eight teaching steps and measured defaults', () => { expect(normalScenario.steps.map(s => s.id)).toEqual(['histogram','egri','mu-sigma','alan','kural','z-skor','carpik','olcekleme']); expect(normalScenario.defaults.mu).toBe(SERIES.sinav.mean); expect(normalScenario.defaults.sigma).toBe(SERIES.sinav.std); expect(SERIES_STEPS).toEqual([0,1,4,6,7]); expect(MU_SIGMA_STEPS).toEqual([2]); });
 it('only applies band shortcuts where the band control is visible', () => { const player=new StepPlayer(normalScenario);const keys=normalShortcuts(player);keys[1].run();expect(player.state.params.k).toBe(1);player.goto(4);keys[1].run();expect(player.state.params.k).toBe(2);player.destroy(); });
 it('resets lesson series when entering constrained steps', () => { const player=new StepPlayer(normalScenario);for(const i of [2,3,5]) {player.setParam('seri','cagri');player.goto(i);expect(player.state.params.seri).toBe('sinav');}for(const i of [6,7]) {player.setParam('seri','sinav');player.goto(i);expect(player.state.params.seri).toBe('cagri');}player.destroy(); });
 it('introduces the bilingual standard deviation term', () => {
  expect(normalScenario.steps.find(s => s.id === 'mu-sigma')?.term).toBe('ortalama μ · standart sapma σ (standard deviation)');
 });
 it('lesson summaries report fixture measurements and probabilities', () => {
  const text = (id: string): string => normalScenario.steps.find(s => s.id === id)!.text;
  for (const measurement of [SERIES.sinav.mean, SERIES.sinav.median, SERIES.sinav.std]) expect(text('histogram')).toContain(formatNumber(measurement, 1));
  expect(text('histogram')).toContain(formatNumber(SERIES.sinav.values.length, 0));
  expect(text('alan')).toContain(formatPercent(SINAV_FIXED.area));
  expect(text('alan')).toContain(formatNumber(SINAV_FIXED.count, 0));
  expect(text('z-skor')).toContain(formatNumber(SINAV_FIXED.z, 2));
  expect(text('z-skor')).toContain(formatPercent(SINAV_FIXED.phi));
  expect(text('carpik')).toContain(formatPercent(SERIES.cagri.band[0].count / SERIES.cagri.values.length));
  expect(text('olcekleme')).toContain(formatNumber(SERIES.cagri.scaled.skew, 2));
 });
 labTextTests(normalScenario.steps, [1,2,3,4,5,6,7,8]);
});
