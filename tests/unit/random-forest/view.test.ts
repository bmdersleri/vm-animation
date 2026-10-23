import { describe, it, expect } from 'vitest';
import { randomForestScenario } from '../../../src/concepts/random-forest/scenario';
import { deriveRfView } from '../../../src/concepts/random-forest/view';
import { BOOTS, CUSTOMERS, PICKS, RF } from '../../../src/concepts/topluluk/data';
import { predictTree } from '../../../src/concepts/topluluk/tree';

const d = randomForestScenario.defaults;
const at = (id: string, patch: Partial<typeof d> = {}) =>
  deriveRfView(
    randomForestScenario.steps.findIndex((s) => s.id === id),
    { ...d, ...patch },
  );

describe('deriveRfView', () => {
  it('bagging is max_features 8 in step 1', () => {
    const v = at('kokler', { maxFeatures: 3 }).roots!;
    expect(v.kind).toBe('bars');
    expect(v.bagging).toEqual(RF.byMf[7].roots);
    expect(v.forest).toBeNull();
    expect(v.card).toBeNull();
    const two = at('alt-kume', { maxFeatures: 3 }).roots!;
    expect(two.bagging).toEqual(RF.byMf[7].roots);
    expect(two.forest).toEqual(RF.byMf[2].roots);
    expect(two.card).toMatchObject({ drawn: [2, 6], winner: 6 });
    expect(at('kokler').strip).toContain('250');
  });

  it('oob breakdown counts unseen trees', () => {
    const v = at('oob-matris').oob!;
    expect(v.m).toBe(12);
    expect(v.pick).toBe(PICKS.oob);
    const x: [number, number] = [CUSTOMERS[PICKS.oob].t, CUSTOMERS[PICKS.oob].c];
    const unseen = BOOTS.slice(0, 12).filter((b) => b.counts[PICKS.oob] === 0);
    const yes = unseen.filter((b) => predictTree(b.tree, x) === 1).length;
    expect(v.breakdown).toMatchObject({ k: unseen.length, ayrildi: yes, kaldi: unseen.length - yes });
    expect(at('oob-matris').strip).toContain(`12 ağaçtan ${unseen.length} tanesi onu görmedi`);
    expect(at('oob-matris', { pick: null }).oob!.breakdown).toBeNull();
    // step 6 votes with all 50 trees
    const six = at('oob-skor').oob!;
    expect(six.m).toBe(50);
    expect(six.score!.total).toBeGreaterThan(0);
    expect(at('oob-skor').strip).toContain(`OOB skoru = ${six.score!.correct} / ${six.score!.total}`);
  });

  it('later steps name their scene', () => {
    expect(at('oob-cv').view).toBe('curves');
    expect(at('agac-sayisi').view).toBe('curves');
    expect(at('onem').view).toBe('importance');
    expect(at('tuzak').view).toBe('importance');
    expect(at('varyans').roots!.kind).toBe('variance');
    expect(at('max-features').roots!.kind).toBe('sweep');
  });
});
