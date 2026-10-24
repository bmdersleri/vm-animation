import { describe, it, expect } from 'vitest';
import { stepIndex } from '../../../src/core/player';
import { UNDEFINED_TEXT } from '../../../src/concepts/degerlendirme/ui';
import { BOOK01 } from '../../../src/concepts/dengesiz/data';
import { dengesizVeriScenario as sc } from '../../../src/concepts/dengesiz-veri/scenario';
import { deriveImbView } from '../../../src/concepts/dengesiz-veri/view';

const view = (id: string, over = {}) => deriveImbView(stepIndex(sc, id), { ...sc.defaults, ...over });
const between = (v: number, a: number, b: number) => v >= Math.min(a, b) - 1e-9 && v <= Math.max(a, b) + 1e-9;

describe('dengesiz-veri view', () => {
  it('step 1 counts 1876 and 124', () => {
    const v = view('veri');
    expect(v.kind).toBe('scatter');
    expect([v.counts.neg, v.counts.pos]).toEqual([1876, 124]);
    expect(v.dots).toHaveLength(2000);
    expect(v.dots.filter((d) => d.cls === 1)).toHaveLength(124);
    expect(v.matrix).toBeNull();
  });

  it('step 2 matrix is the book matrix', () => {
    const v = view('dogruluk');
    expect(v.matrix).toEqual(BOOK01.matrix);
    expect(v.metrics!.accuracy).toBe('%93,8');
    expect(v.book).toContain('LogisticRegression(max_iter=1000');
    expect([v.counts.neg, v.counts.pos]).toEqual([563, 37]);
  });

  it('step 3 metrics: recall 0, precision undefined', () => {
    const v = view('azinlik');
    expect(v.metrics!.recall).toBe('0,000');
    expect(v.metrics!.precision).toBe(UNDEFINED_TEXT);
    expect(v.focusPositive).toBe(true);
    expect(v.book).toContain('classification_report');
  });

  it('step 4 hides test points', () => {
    const v = view('egitim', { showTest: false });
    expect(v.dots).toHaveLength(1400);
    expect(v.dots.some((d) => d.test)).toBe(false);
    expect([v.counts.neg, v.counts.pos]).toEqual([1313, 87]);
    expect(view('egitim', { showTest: true }).dots).toHaveLength(2000);
  });

  it('step 5 x new lies between x i and x zi', () => {
    const v = view('sentetik', { showTest: false });
    const e = v.example!;
    expect(e.neighbours).toHaveLength(5);
    expect(between(e.xnew.tenure, e.xi.tenure, e.xz.tenure)).toBe(true);
    expect(between(e.xnew.charge, e.xi.charge, e.xz.charge)).toBe(true);
    expect(e.xnew.tenure).toBeCloseTo(e.xi.tenure + e.lambda * (e.xz.tenure - e.xi.tenure), 9);
    expect(e.xnew.charge).toBeCloseTo(e.xi.charge + e.lambda * (e.xz.charge - e.xi.charge), 9);
    expect(e.xi.tenure).toBeGreaterThanOrEqual(6);
    expect(e.xi.tenure).toBeLessThanOrEqual(66);
    expect(v.strip).toContain('x_new = x_i + λ · (x_zi − x_i)');
    expect(view('sentetik', { k: 3 }).example!.neighbours).toHaveLength(3);
  });

  it('steps 6-10 reserve their placeholder views', () => {
    expect(view('smote-doldur').kind).toBe('smote');
    expect(view('kopyalama').kind).toBe('smote');
    expect(view('agirlik').kind).toBe('weight');
    expect(view('sinir').kind).toBe('boundary');
    expect(view('karsilastirma').kind).toBe('boundary');
    expect(view('smote-doldur').dots.filter((d) => d.synthetic)).toHaveLength(1226);
    expect(view('smote-doldur').counts).toMatchObject({ neg: 1313, pos: 1313 });
    const w = view('agirlik', { weight: 'dengeli' });
    expect(w.dots.find((d) => d.cls === 1)!.weight).toBeCloseTo(8.046, 3);
  });
});
