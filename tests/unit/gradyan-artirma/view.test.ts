import { describe, it, expect } from 'vitest';
import { stepIndex } from '../../../src/core/player';
import { REG, BOOK } from '../../../src/concepts/boosting/data';
import { gradyanArtirmaScenario as sc } from '../../../src/concepts/gradyan-artirma/scenario';
import { boost } from '../../../src/concepts/boosting/boost';
import { predictReg } from '../../../src/concepts/boosting/regtree';
import { deriveGbView } from '../../../src/concepts/gradyan-artirma/view';

const view = (id: string, over = {}) => deriveGbView(stepIndex(sc, id), { ...sc.defaults, ...over });
const at = (segs: { x0: number; x1: number; y: number }[], x: number) =>
  segs.find((s) => x >= s.x0 && x <= s.x1)!.y;

describe('gradyan-artirma view', () => {
  it('step 2 F is the flat mean', () => {
    const p = view('baslangic').panels!;
    expect(p.f).toHaveLength(1);
    expect(p.f![0].y).toBeCloseTo(REG.mean, 9);
    expect([p.f![0].x0, p.f![0].x1]).toEqual([0, 10]);
    expect(p.residuals).toHaveLength(0);
    expect(view('veri').panels!.f).toBeNull();
  });

  it('step 3 residuals sum to zero', () => {
    const p = view('artik').panels!;
    expect(p.residuals).toHaveLength(80);
    expect(Math.abs(p.residuals.reduce((s, r) => s + r.r, 0))).toBeLessThan(1e-9);
  });

  it('step 4 h has four pieces at the book thresholds', () => {
    const p = view('ilk-agac').panels!;
    expect(p.h).toHaveLength(4);
    expect(p.thresholds.map((t) => t.toFixed(3))).toEqual(['0.616', '2.651', '6.372']);
    // leaf means of the residuals, left to right
    expect(p.h![0].y).toBeCloseTo(0.041185, 6);
    expect(p.h![1].y).toBeCloseTo(0.617835, 6);
    expect(p.h![2].y).toBeCloseTo(-0.671219, 5);
    expect(p.h![3].y).toBeCloseTo(0.238089, 5);
    // depth slider: one split gives two pieces
    expect(view('ilk-agac', { depth: 1 }).panels!.h).toHaveLength(2);
  });

  it('step 5 F moves by 0.3 h', () => {
    const p = view('kucuk-adim').panels!;
    expect(BOOK.nu).toBe(0.3);
    for (const x of [0.3, 1.5, 4, 8]) {
      expect(at(p.f!, x)).toBeCloseTo(REG.mean + 0.3 * at(p.h!, x), 9);
    }
    expect(p.fPrev![0].y).toBeCloseTo(REG.mean, 9);
    expect(view('kucuk-adim').strip).toContain('[2 + 0,1 · 1; 4 + 0,1 · 1] = [2,1; 4,1]');
    expect(view('kucuk-adim').strip).toContain('F₁ = F₀ + 0,3 · h₁');
  });

  it('step 5 in Lab at m = 5: the faint line is F4, one nu h step below F5', () => {
    const p = view('kucuk-adim', { m: 5 }).panels!;
    const run = boost(REG.train, REG.val, 0.3, 2, 20);
    expect(p.fPrev![0].y).not.toBeCloseTo(REG.mean, 3);
    for (const x of [0.3, 1.5, 4, 8]) {
      expect(at(p.f!, x) - at(p.fPrev!, x)).toBeCloseTo(0.3 * predictReg(run.trees[4], x), 9);
    }
  });

  it('a training error under the log floor ends its line with a pin instead of a flat run', () => {
    const run = boost(REG.train, REG.val, 1, 3, 200);
    const cut = run.trainMse.findIndex((v) => v < 1e-5);
    expect(cut).toBeGreaterThan(0);
    for (const id of ['durma', 'ezber']) {
      const e = view(id, { nu: 1, depth: 3 }).error!;
      const train = e.chart.series.find((s) => s.id === 'train')!;
      expect(train.pts).toHaveLength(cut + 1);
      expect(train.pts[cut]).toEqual([cut + 1, -5]);
      expect(train.pts[cut - 1][1]).toBeGreaterThan(-5);
      expect(e.chart.pins!.map((p) => p.label)).toContain('eğitim < 0,00001');
      expect(e.chart.pins!.find((p) => p.label.startsWith('eğitim'))).toMatchObject({ x: cut + 1, y: -5 });
      expect(e.endLabels.map((l) => l.id)).toEqual(['val']);
    }
    // the strip still shows the real value
    expect(view('durma', { nu: 1, depth: 3 }).strip).toContain('eğitim hatası = < 0,000001');
  });

  it('a training curve above the floor keeps its full line and end label', () => {
    const e = view('durma').error!;
    expect(e.chart.series.find((s) => s.id === 'train')!.pts).toHaveLength(200);
    expect(e.endLabels.map((l) => l.id)).toEqual(['train', 'val']);
  });

  it('steps 7 to 10 name their later scene kind', () => {
    expect(view('durma').kind).toBe('error');
    expect(view('bagging-karsi').kind).toBe('compare');
    expect(view('durma').panels).toBeNull();
  });
});
