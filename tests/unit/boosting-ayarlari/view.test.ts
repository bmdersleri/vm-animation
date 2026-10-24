import { describe, it, expect } from 'vitest';
import { stepIndex } from '../../../src/core/player';
import { BOOK_LRS, CURVES } from '../../../src/concepts/boosting/data';
import { boostingAyarlariScenario as sc } from '../../../src/concepts/boosting-ayarlari/scenario';
import { leafCount } from '../../../src/concepts/boosting/regtree';
import { leafTree } from '../../../src/concepts/boosting-ayarlari/scenario';
import { deriveTuneView } from '../../../src/concepts/boosting-ayarlari/view';

const view = (id: string, over = {}) => deriveTuneView(stepIndex(sc, id), { ...sc.defaults, ...over });

describe('boosting-ayarlari view', () => {
  it('step 1 points sit at the five book rates', () => {
    const v = view('lr-deney');
    expect(v.kind).toBe('points');
    const pts = v.chart!.series[0].pts;
    expect(pts).toHaveLength(5);
    pts.forEach(([x, y], i) => {
      expect(x).toBeCloseTo(Math.log10(BOOK_LRS[i]), 9);
      expect(y).toBe(CURVES.byLr.find((c) => c.lr === BOOK_LRS[i])!.valAuc[149]);
    });
    expect(v.chart!.xTicks!.map(v.chart!.xFormat!)).toEqual(['0,01', '0,05', '0,1', '0,3', '0,5']);
    expect(v.chart!.pins!.map((p) => p.label)).toEqual(['0,930', '0,964', '0,969', '0,970', '0,963']);
    expect(v.strip).toContain('XGBClassifier(n_estimators=150, max_depth=4, learning_rate=oran)');
    expect(v.strip).toContain('GradientBoostingClassifier');
  });

  it('step 5 stop is best plus patience', () => {
    const v = view('erken-durdurma');
    expect(v.vlines.map((l) => l.x)).toEqual([91, 141]);
    expect(view('erken-durdurma', { patience: 30 }).vlines.map((l) => l.x)).toEqual([91, 121]);
    expect(v.strip).toContain('early_stopping_rounds=50');
    expect(v.note).toBeNull();
  });

  it('step 5 with a short patience stops at an early local dip', () => {
    const v = view('erken-durdurma', { patience: 10 });
    expect(v.vlines.map((l) => l.x)).toEqual([48, 58]);
    expect(v.note).toBeNull();
    expect(v.strip).toContain('en iyi ağaç = 48 · durma ağacı = 58');
  });

  it('measured numbers sit next to the scikit-learn call, not the book XGBoost call', () => {
    const lab = deriveTuneView(stepIndex(sc, 'lr-deney'), { ...sc.defaults }, true);
    expect(lab.strip).toContain('GradientBoostingClassifier(n_estimators=');
    expect(lab.strip).not.toContain('XGBClassifier');
    expect(view('lr-deney').strip).toContain('Kitabın kodu: XGBClassifier');
    expect(view('agac-ekle').strip).toContain('GradientBoostingClassifier(n_estimators=');
    expect(view('agac-ekle').strip).toContain('max_depth=4');
  });

  it('step 5 says so when the curve ends before the patience runs out', () => {
    const v = view('erken-durdurma', { lr: 0.01 });
    expect(v.vlines.map((l) => l.x)).toEqual([500]);
    expect(v.note).toBe('500 ağaca kadar durmadı');
  });

  it('step 2 draws the five rates up to the tree count', () => {
    const v = view('egriler', { trees: 40 });
    expect(v.chart!.series).toHaveLength(5);
    expect(v.chart!.series[0].pts).toHaveLength(40);
    expect(v.endLabels.map((l) => l.text)).toEqual(['ν = 0,01', 'ν = 0,05', 'ν = 0,1', 'ν = 0,3', 'ν = 0,5']);
    expect(v.vlines.map((l) => l.x)).toEqual([150]);
  });

  it('step 4 reports a missing dip', () => {
    expect(view('ezber').note).toBeNull();
    expect(view('ezber', { lr: 0.01 }).note).toBe('Henüz dip yok: daha çok ağaç dene');
  });

  it('no NaN or Infinity anywhere', () => {
    for (let i = 0; i < sc.steps.length; i++) {
      const v = deriveTuneView(i, { ...sc.defaults, trees: 500 });
      expect(JSON.stringify(v)).not.toMatch(/NaN|undefined|Infinity/);
    }
  });

  it('step 8 uses the real leaf count and stays finite beyond the data', () => {
    const v = view('yaprak-siniri', { leaves: 500 });
    const pts = v.chart!.series[0].pts;
    expect(pts[pts.length - 1][0]).toBe(leafCount(leafTree(64)));
    expect(pts.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
    expect(v.chart!.series[1].pts.every(([, y]) => Number.isFinite(y))).toBe(true);
    expect(view('yaprak-siniri', { leaves: 4 }).chart!.series[0].pts).toHaveLength(3);
  });

  it('step 10 shows the surface only at the last trial or when asked', () => {
    expect(view('sirali-arama').search!.showSurface).toBe(true);
    expect(view('sirali-arama', { trial: 7 }).search!.showSurface).toBe(false);
    expect(view('sirali-arama', { trial: 7, showSurface: true }).search!.showSurface).toBe(true);
    expect(view('izgara').search!.showSurface).toBe(false);
    expect(view('izgara', { trial: 1 }).search!.cells.filter((c) => c.order !== null)).toHaveLength(1);
  });
});
