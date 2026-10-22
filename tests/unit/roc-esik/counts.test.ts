// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';

// Drop one negative from each validation sample: copy that hard-codes "2 / 4" and "2 / 12" fails here.
vi.mock('../../../src/concepts/degerlendirme/data', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../src/concepts/degerlendirme/data')>();
  const data = structuredClone(actual.evaluationData) as unknown as { scoreSets: Record<string, { validation: { actual: number }[] }> };
  for (const set of Object.values(data.scoreSets)) set.validation.splice(set.validation.findIndex(s => s.actual === 0), 1);
  return { ...actual, evaluationData: data };
});
const { rocScenario } = await import('../../../src/concepts/roc-esik/scenario');
const { mountRocParams } = await import('../../../src/concepts/roc-esik/controls');
const { evaluationData } = await import('../../../src/concepts/degerlendirme/data');

it('labels the dataset options with positive / total counts from the data', () => {
  const player = new StepPlayer(rocScenario); const host = document.createElement('div');
  const params = mountRocParams(host, player);
  const options = [...host.querySelectorAll('select[name="dataset"] option')].map(o => o.textContent);
  const label = (key: 'balanced' | 'imbalanced') => { const v = evaluationData.scoreSets[key].validation; return `${v.filter(s => s.actual === 1).length} / ${v.length} pozitif`; };
  expect(label('balanced')).toBe('2 / 3 pozitif');
  expect(options).toEqual([`Dengeli · ${label('balanced')}`, `Dengesiz · ${label('imbalanced')}`]);
  params.destroy(); player.destroy();
});
