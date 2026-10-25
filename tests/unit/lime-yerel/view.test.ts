import { describe, it, expect } from 'vitest';
import { stepIndex } from '../../../src/core/player';
import { limeRun, PRESETS } from '../../../src/concepts/xai/data';
import { limeYerelScenario as sc } from '../../../src/concepts/lime-yerel/scenario';
import { deriveLimeView } from '../../../src/concepts/lime-yerel/view';

const at = (id: string, over: Partial<typeof sc.defaults> = {}) => deriveLimeView(stepIndex(sc, id), { ...sc.defaults, ...over });

describe('lime view', () => {
  it('step 6 fit equals the stored sklearn fit', () => {
    for (const row of PRESETS) {
      const v = at('vekil', { customer: row });
      const stored = limeRun(row, 42, 5000).fit;
      const fit = v.surrogate!.fit;
      fit.coef.forEach((c, j) => expect(c).toBeCloseTo(stored.coef[j], 9));
      expect(fit.intercept).toBeCloseTo(stored.intercept, 9);
      expect(fit.score!).toBeCloseTo(stored.score!, 9);
    }
  });

  it('step 7 local prediction is the fit sum', () => {
    const v = at('sadakat');
    const fit = v.surrogate!.fit;
    expect(fit.localPred).toBeCloseTo(fit.intercept + fit.coef[0] + fit.coef[1] + fit.coef[2], 12);
    expect(v.surrogate!.fidelity!.modelText).toBe('0,945');
    expect(v.surrogate!.fidelity!.localText).toBe('0,737');
    expect(v.strip).toContain('0,146 + 0,540 + 0,074 − 0,023 = 0,737');
  });

  it('step 1 strip carries both kod05 lines of the book', () => {
    const lines = at('yerel-soru').strip.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('lime_aciklayici = LimeTabularExplainer(…, mode="classification", random_state=42)');
    expect(lines[1]).toBe('lime_aciklamasi = lime_aciklayici.explain_instance(musteri, predict_proba, num_features=3)');
  });

  it('kinds follow the steps and later steps are placeholders', () => {
    const kinds = sc.steps.map((_s, i) => deriveLimeView(i, sc.defaults).kind);
    expect(kinds).toEqual(['flow', 'bins', 'cloud', 'cloud', 'kernel', 'surrogate', 'surrogate', 'stability', 'compare', 'code']);
  });

  it('no view text carries NaN or Infinity at extreme widths', () => {
    for (const width of [0.001, 0.3, 4]) {
      for (const id of ['cekirdek', 'vekil', 'sadakat']) {
        const v = at(id, { width, customer: 77 });
        expect(JSON.stringify(v)).not.toMatch(/NaN|Infinity/);
      }
    }
  });
});
