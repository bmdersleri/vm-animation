import { describe, it, expect } from 'vitest';
import { stepIndex } from '../../../src/core/player';
import { UNDEFINED_TEXT } from '../../../src/concepts/degerlendirme/ui';
import { BOOK01 } from '../../../src/concepts/dengesiz/data';
import { dengesizVeriScenario as sc } from '../../../src/concepts/dengesiz-veri/scenario';
import { deriveImbView } from '../../../src/concepts/dengesiz-veri/view';
import { exampleFor, separation } from '../../../src/concepts/dengesiz-veri/model';

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

describe('step 5 example choice', () => {
  const cases: [number, number][] = [
    [5, 42],
    [1, 42],
    [3, 42],
    [10, 42],
  ];
  it.each(cases)('k %i seed %i: x i and x zi are far apart and x new is inside the segment', (k, seed) => {
    const e = exampleFor(k, seed);
    expect(separation(e)).toBeGreaterThanOrEqual(0.6);
    expect(e.lambda).toBeGreaterThanOrEqual(0.2);
    expect(e.lambda).toBeLessThanOrEqual(0.8);
    const dx = e.xz.tenure - e.xi.tenure;
    const dy = e.xz.charge - e.xi.charge;
    const t = dx !== 0 ? (e.xnew.tenure - e.xi.tenure) / dx : (e.xnew.charge - e.xi.charge) / dy;
    expect(t).toBeGreaterThanOrEqual(0.2);
    expect(t).toBeLessThanOrEqual(0.8);
    expect(e.neighbours).toHaveLength(k);
  });

  it('the three marks are distinct places', () => {
    const e = exampleFor(5, 42);
    const key = (p: { tenure: number; charge: number }) => `${p.tenure.toFixed(2)}|${p.charge.toFixed(2)}`;
    expect(new Set([key(e.xi), key(e.xz), key(e.xnew)]).size).toBe(3);
  });

  it('every step has its own view and an unknown step throws', () => {
    for (const [i, s] of sc.steps.entries()) {
      expect(deriveImbView(i, sc.defaults).stepId).toBe(s.id);
    }
    expect(view('sinir').boundary).toBeTruthy();
    expect(view('karsilastirma').table).toBeTruthy();
    // a step the view does not know (added for this test only) is an error, not the comparison table
    sc.steps.push({ id: 'bilinmeyen', title: 'x', text: 'x' });
    try {
      expect(() => deriveImbView(sc.steps.length - 1, sc.defaults)).toThrow(RangeError);
    } finally {
      sc.steps.pop();
    }
    expect(sc.steps).toHaveLength(10);
  });
});
