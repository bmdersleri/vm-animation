import { describe, it, expect } from 'vitest';
import { formatNumber as f } from '../../../src/core/plot/format';
import { CUSTOMERS, MODEL, customerByRow } from '../../../src/concepts/xai/data';
import { marginals, orderings, shapley } from '../../../src/concepts/xai/shapley';
import { shapDegerleriScenario as sc, type ShapParams } from '../../../src/concepts/shap-degerleri/scenario';
import { deriveShapView } from '../../../src/concepts/shap-degerleri/view';

const f3 = (v: number) => f(v, 3);
const signed = (d: number) => (d > 0 ? `+${f3(d)}` : f3(d));
const at = (id: string, over: Partial<ShapParams> = {}) =>
  deriveShapView(
    sc.steps.findIndex((s) => s.id === id),
    { ...sc.defaults, ...over },
  );

describe('shap view', () => {
  it('kinds follow the steps', () => {
    expect(sc.steps.map((_, i) => deriveShapView(i, sc.defaults).kind)).toEqual([
      'card', 'bars', 'lattice', 'lattice', 'lattice', 'waterfall', 'force', 'bars', 'swarm', 'cards',
    ]);
  });

  it('step 4 marginals for the book order', () => {
    const c = customerByRow(301);
    const v = at('marjinal').lattice!;
    expect(v.part).toBe('path');
    expect(v.path).toEqual([0, 1, 3, 7]);
    const onPath = v.edges.filter((e) => e.path);
    expect(onPath).toHaveLength(3);
    expect(onPath.map((e) => e.delta)).toEqual(marginals(c.v, orderings()[0]).map(signed));
    const last = at('marjinal', { order: 5 }).lattice!;
    expect(last.path).toEqual([0, 4, 6, 7]);
    expect(last.edges.filter((e) => e.path).map((e) => e.delta)[2]).toBe(`+${f3(c.v[7] - c.v[6])}`);
    expect(at('marjinal').strip).toContain(f3(c.p - MODEL.base));
  });

  it('step 5 means equal shapley', () => {
    for (const c of CUSTOMERS) {
      const v = at('alti-siralama', { customer: c.row }).lattice!;
      expect(v.orders).toHaveLength(6);
      const phi = shapley(c.v);
      v.meanValues!.forEach((m, i) => expect(Math.abs(m - phi[i])).toBeLessThan(1e-12));
      expect(v.means).toEqual(c.shap.map(f3));
    }
    const partial = at('alti-siralama', { scan: 1 }).lattice!;
    expect(partial.orders!.filter((r) => r.filled)).toHaveLength(1);
  });

  it('step 3 fills nodes layer by layer', () => {
    const first = at('koalisyon', { scan: 1 }).lattice!;
    expect(first.nodes.filter((n) => n.filled).map((n) => n.mask)).toEqual([0]);
    const four = at('koalisyon', { scan: 4 }).lattice!;
    expect(four.nodes.filter((n) => n.filled).map((n) => n.mask).sort()).toEqual([0, 1, 2, 4]);
    expect(at('koalisyon').lattice!.nodes.every((n) => n.filled)).toBe(true);
  });

  it('step 6 waterfall chains the book numbers', () => {
    const c = customerByRow(301);
    const w = at('toplam').waterfall!;
    expect(w.spec.base).toBe(MODEL.base);
    expect(w.spec.parts.map((p) => p.value)).toEqual(c.shap);
    expect(w.spec.total).toBe(c.p);
    expect(w.spec.mode).toBe('waterfall');
  });

  it('step 7 second customer is 77', () => {
    const v = at('kuvvet').force!;
    expect(v.rows.map((r) => r.customer)).toEqual([301, 77]);
    expect(v.rows[1].spec.parts.map((p) => p.value)).toEqual(customerByRow(77).shap);
    expect(v.rows.every((r) => r.spec.mode === 'force')).toBe(true);
    expect(at('kuvvet', { second: 217 }).force!.rows[1].customer).toBe(217);
    // a shared domain wide enough for both bars (77 reaches below zero)
    expect(v.domain[0]).toBeLessThanOrEqual(-0.1);
    expect(v.domain[1]).toBe(1);
    expect(at('kuvvet', { customer: 176, second: 176 }).force!.domain).toEqual([0, 1]);
  });

  it('step 9 colours by the row own feature unless chosen', () => {
    const s = at('ozet-grafik').swarm!;
    expect(s.rows).toHaveLength(3);
    expect(s.rows.every((r) => r.dots.length === 100)).toBe(true);
    expect(s.rows.flatMap((r) => r.dots).filter((d) => d.highlight)).toHaveLength(3);
    const own = s.rows[0].dots.map((d) => d.t);
    const other = at('ozet-grafik', { colorBy: 1 }).swarm!.rows[0].dots.map((d) => d.t);
    expect(other).not.toEqual(own);
    expect(Math.min(...own)).toBe(0);
    expect(Math.max(...own)).toBe(1);
  });

  it('step 4 strip writes each sign once', () => {
    const strip = at('marjinal').strip;
    expect(strip).toContain('0,481 + 0,155 + 0,064');
    expect(strip).not.toMatch(/\+ \+|\+ −|− \+|− −/);
    // a customer with a negative marginal reads "− 0,010" style
    for (const c of CUSTOMERS) {
      for (let order = 0; order < 6; order++) {
        expect(at('marjinal', { customer: c.row, order }).strip).not.toMatch(/\+ \+|\+ −|− \+|− −/);
        expect(at('alti-siralama', { customer: c.row }).strip).not.toMatch(/\+ \+|\+ −|− \+|− −/);
      }
    }
  });

  it('step 6 domain holds every running total (customer 59 dips below zero)', () => {
    for (const c of CUSTOMERS) {
      const w = at('toplam', { customer: c.row }).waterfall!;
      let run = w.spec.base;
      const all = [run];
      for (const part of w.spec.parts) {
        run += part.value;
        all.push(run);
      }
      all.push(w.spec.total);
      expect(Math.min(...all)).toBeGreaterThanOrEqual(w.spec.domain[0] - 1e-9);
      expect(Math.max(...all)).toBeLessThanOrEqual(w.spec.domain[1] + 1e-9);
    }
    expect(at('toplam', { customer: 59 }).waterfall!.spec.domain[0]).toBeLessThan(0);
    expect(at('toplam').waterfall!.spec.domain).toEqual([0, 1]);
  });
});
