import { describe, it, expect } from 'vitest';
import { stepIndex } from '../../../src/core/player';
import { REG, BOOK } from '../../../src/concepts/boosting/data';
import { gradyanArtirmaScenario as sc } from '../../../src/concepts/gradyan-artirma/scenario';
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
    expect(view('kucuk-adim').strip).toContain('[2 + 0,1 · 2; 4 + 0,1 · 0] = [2,2; 4]');
    expect(view('kucuk-adim').strip).toContain('F₁ = F₀ + 0,3 · h₁');
  });

  it('steps 7 to 10 name their later scene kind', () => {
    expect(view('durma').kind).toBe('error');
    expect(view('bagging-karsi').kind).toBe('compare');
    expect(view('durma').panels).toBeNull();
  });
});
