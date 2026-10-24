import { describe, it, expect } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { formatNumber as f } from '../../../src/core/plot/format';
import { BOOK01, MODELS2D } from '../../../src/concepts/dengesiz/data';
import { exampleFor, MAX_SYNTHETIC, SWEEP_RATIOS, syntheticFor } from '../../../src/concepts/dengesiz-veri/model';
import {
  BOUNDARY_STEPS,
  SCATTER_STEPS,
  SMOTE_STEPS,
  WEIGHT_STEPS,
  dengesizVeriScenario as sc,
} from '../../../src/concepts/dengesiz-veri/scenario';
import { labTextTests } from '../lab-text';

const step = (id: string) => sc.steps.find((s) => s.id === id)!;
const APS = [MODELS2D.base.ap, MODELS2D.smote.ap, MODELS2D.weighted.ap];

describe('dengesiz-veri scenario', () => {
  it('step ids follow the spec', () => {
    expect(sc.steps.map((s) => s.id)).toEqual([
      'veri',
      'dogruluk',
      'azinlik',
      'egitim',
      'sentetik',
      'smote-doldur',
      'kopyalama',
      'agirlik',
      'sinir',
      'karsilastirma',
    ]);
    expect(SCATTER_STEPS).toEqual([0, 1, 2, 3, 4]);
    expect(SMOTE_STEPS).toEqual([5, 6]);
    expect(WEIGHT_STEPS).toEqual([7]);
    expect(BOUNDARY_STEPS).toEqual([8, 9]);
    expect(sc.defaults).toEqual({
      showTest: true,
      k: 5,
      seed: 42,
      ratio: 1,
      weight: 'yok',
      manualWeight: 15,
      method: 'yok',
      threshold: 0.5,
    });
  });

  it('step texts read their numbers from the data', () => {
    expect(step('veri').text).toContain('2000 müşteri, 124 ayrılan (%6,2)');
    expect(step('dogruluk').text).toContain('[[563, 0], [37, 0]]');
    expect(step('dogruluk').text).toContain('%93,8');
    expect(step('azinlik').text).toContain('0 / 37');
    expect(step('azinlik').text).toContain('kesinlik tanımsız');
    expect(step('egitim').text).toContain('1313 kalan / 87 ayrılan');
    const e = exampleFor(5, 42);
    expect(step('sentetik').text).toContain(`λ = ${f(e.lambda, 2)}`);
    expect(step('sentetik').text).toContain(`${f(e.xnew.tenure, 1)} ay; ${f(e.xnew.charge, 2)}`);
    expect(step('smote-doldur').text).toContain(`0 → ${MAX_SYNTHETIC}`);
    expect(step('smote-doldur').text).toContain('87 → 1313');
    expect(step('agirlik').text).toContain('8,05 = 1400 / (2 · 87)');
    expect(step('agirlik').text).toContain('0,53 = 1400 / (2 · 1313)');
    const m = MODELS2D.smote.matrix;
    expect(step('sinir').text).toContain(`${m.tp} / ${m.tp + m.fn}`);
    expect(step('sinir').text).toContain(`${m.fp} yanlış alarm`);
    expect(BOOK01.matrix.tp).toBe(0);
  });

  it('step 10 words the PR-AUCs from the data', () => {
    const texts = APS.map((v) => f(v, 3));
    const text = step('karsilastirma').text;
    if (texts.every((t) => t === texts[0])) {
      expect(text).toContain(`üçünde de aynı (${texts[0]})`);
    } else {
      expect(text).toContain(`neredeyse aynı (${f(Math.min(...APS), 3)}–${f(Math.max(...APS), 3)})`);
    }
  });

  it('step 6 sweeps the synthetic count from 0 to 1226', () => {
    const s = step('smote-doldur').sweep!;
    expect(s.key).toBe('ratio');
    expect(syntheticFor(s.values[0] as number)).toBe(0);
    expect(syntheticFor(s.values[s.values.length - 1] as number)).toBe(1226);
    expect(SWEEP_RATIOS[SWEEP_RATIOS.length - 1]).toBe(1);
  });

  it('the player keeps showTest off after step 4 and weights balanced at step 8', () => {
    const player = new StepPlayer(sc);
    expect(player.state.params.showTest).toBe(true);
    player.goto(3);
    expect(player.state.params.showTest).toBe(false);
    player.goto(7);
    expect(player.state.params.weight).toBe('dengeli');
    player.destroy();
  });
});

labTextTests(sc.steps, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
