import { describe, expect, it } from 'vitest';
import fixture from '../../fixtures/crisp_pandas.json';
import { BASELINE, DAYS, GRID, META, cellOf, type Cell } from '../../../src/concepts/crisp-dm/data';
import {
  CYCLE_EDGES, PHASE_LABELS, cycleLayout, enoughData, evaluate, projectPath, verdict, type NodeId,
} from '../../../src/concepts/crisp-dm/calc';

const DEMAND = DAYS.filter(d => d.test).map(d => d.talep);
const ORDER: NodeId[] = ['ia', 'va', 'd1', 'vh', 'mo', 'de', 'd2', 'ya'];

interface FixtureCell {
  days: number;
  missing: string;
  stock: string;
  leak: boolean;
  eval: { wasteRate: number | null; lostShare: number | null; wasted: number; lost: number; prepared: number; demand: number };
  deploy: { wasteRate: number | null; lostShare: number | null };
}
const cells = fixture.cells as unknown as FixtureCell[];

describe('crisp-dm calc', () => {
  it('evaluate matches the fixture for all thirty-two cells', () => {
    expect(GRID).toHaveLength(32);
    expect(DEMAND).toEqual(fixture.demand);
    for (const cell of GRID) {
      const fx = cells.find(c => c.days === cell.days && c.missing === cell.missing && c.stock === cell.stock && c.leak === cell.leak)!;
      const ev = evaluate(cell.orders.eval, DEMAND);
      const dp = evaluate(cell.orders.deploy, DEMAND);
      expect(ev.wasteRate!).toBeCloseTo(fx.eval.wasteRate!, 12);
      expect(ev.lostShare!).toBeCloseTo(fx.eval.lostShare!, 12);
      expect(ev.wasted).toBe(fx.eval.wasted);
      expect(ev.lost).toBe(fx.eval.lost);
      expect(ev.prepared).toBe(fx.eval.prepared);
      expect(ev.demand).toBe(fx.eval.demand);
      expect(dp.wasteRate!).toBeCloseTo(fx.deploy.wasteRate!, 12);
      expect(dp.lostShare!).toBeCloseTo(fx.deploy.lostShare!, 12);
    }
  });

  it('the fixed fifty baseline matches', () => {
    const base = evaluate(DEMAND.map(() => META.oldOrder), DEMAND);
    expect(base.wasteRate!).toBeCloseTo(fixture.baseline.wasteRate, 12);
    expect(base.lostShare!).toBeCloseTo(fixture.baseline.lostShare, 12);
  });

  it('verdict matches the stored conditions', () => {
    for (const cell of GRID) {
      for (const which of ['eval', 'deploy'] as const) {
        const v = verdict(evaluate(cell.orders[which], DEMAND), BASELINE);
        const label = `${cell.days}/${cell.missing}/${cell.stock}/${cell.leak} ${which}`;
        expect(v.wasteOk, label).toBe(cell[which].wasteOk);
        expect(v.serviceOk, label).toBe(cell[which].serviceOk);
        expect(v.ok, label).toBe(cell[which].ok);
      }
    }
    const v = verdict(evaluate(cellOf(56, 'cikar', 'soran', false).orders.eval, DEMAND), BASELINE);
    expect(v.reduction!).toBeCloseTo(0.298088, 5);
  });

  it('evaluate returns null shares for an empty window', () => {
    expect(evaluate([], [])).toEqual({ prepared: 0, wasted: 0, lost: 0, demand: 0, wasteRate: null, lostShare: null });
    const v = verdict(evaluate([], []), evaluate([], []));
    expect(v.reduction).toBeNull();
    expect(v.wasteOk).toBe(false);
    expect(v.ok).toBe(false);
  });

  it('enoughData needs five days in both groups', () => {
    expect(GRID.map(enoughData)).toEqual(GRID.map(c => c.enough));
  });

  it('projectPath ends yetersiz for four days', () => {
    const path = projectPath(cellOf(4, 'cikar', 'soran', false));
    expect(path.end).toBe('yetersiz');
    expect(path.nodes).toEqual(['ia', 'va', 'd1', 'ia']);
    expect(path.edges).toEqual(['ia-va', 'va-d1', 'd1-ia']);
    expect(path.stopAt).toBe('d1');
    expect(path.failed).toEqual([]);
  });

  it('projectPath ends uygun-degil when the service condition fails', () => {
    const path = projectPath(cellOf(56, 'cikar', 'satis', false));
    expect(path.end).toBe('uygun-degil');
    expect(path.nodes).toEqual(['ia', 'va', 'd1', 'vh', 'mo', 'de', 'd2', 'va']);
    expect(path.edges.at(-1)).toBe('d2-va');
    expect(path.stopAt).toBe('d2');
    expect(path.failed).toEqual(['service']);
  });

  it('projectPath ends sahada-dustu with a leak', () => {
    const path = projectPath(cellOf(56, 'cikar', 'soran', true));
    expect(path.end).toBe('sahada-dustu');
    expect(path.nodes.slice(-3)).toEqual(['d2', 'ya', 'ia']);
    expect(path.edges.slice(-2)).toEqual(['d2-ya', 'ya-ia']);
    expect(path.stopAt).toBe('ya');
    expect(path.failed).toEqual(['waste']);
  });

  it('projectPath ends yaygin for the default choices', () => {
    const path = projectPath(cellOf(56, 'cikar', 'soran', false));
    expect(path.end).toBe('yaygin');
    expect(path.nodes.at(-1)).toBe('ya');
    expect(path.edges.at(-1)).toBe('ya-ia');
    expect(path.failed).toEqual([]);
  });

  it('every path edge exists and joins consecutive nodes', () => {
    for (const cell of GRID) {
      const p = projectPath(cell);
      p.edges.forEach((id, i) => {
        const e = CYCLE_EDGES.find(x => x.id === id)!;
        expect(e, id).toBeDefined();
        expect(e.from).toBe(p.nodes[i]);
        if (p.end !== 'yaygin' || i < p.edges.length - 1) {
          expect(e.to).toBe(p.nodes[i + 1]);
        }
      });
    }
  });

  it('an empty group reads veri yok', () => {
    const cell: Cell = cellOf(4, 'cikar', 'soran', false);
    expect(cell.pred.sinav).toBeNull();
    expect(cell.usable.sinav).toBe(0);
    expect(enoughData(cell)).toBe(false);
  });

  it('edges carry the book labels and kinds', () => {
    const by = Object.fromEntries(CYCLE_EDGES.map(e => [e.id, e]));
    expect(CYCLE_EDGES).toHaveLength(10);
    expect(by['d1-vh'].label).toBe('Evet');
    expect(by['d2-ya'].label).toBe('Evet');
    expect(by['d1-ia'].label).toBe('Hayır');
    expect(by['d2-va'].label).toBe('Hayır');
    expect(by['d1-ia'].kind).toBe('back');
    expect(by['ya-ia'].kind).toBe('outer');
    expect(Object.keys(PHASE_LABELS).sort()).toEqual([...ORDER].sort());
  });

  describe('cycleLayout', () => {
    // wide Ders stage, Lab stage beside the controls, a phone; measured sizes of 13 and 18 px labels
    const fallback: [number, number, boolean][] = [[390, 360, true], [560, 440, false], [640, 540, false], [1280, 540, false]];
    const label = (fs: number) => (id: NodeId) => {
      const lines = PHASE_LABELS[id];
      const widest = Math.max(...lines.map(l => l.length * fs * 0.62));
      const decision = id === 'd1' || id === 'd2';
      const tw = widest + 8;
      const th = lines.length * fs * 1.2 + 4;
      const w = decision ? 1.6 * tw : widest + 16;
      return { w, h: decision ? th / (1 - tw / w) : th + 12 };
    };
    const measured = (fs: number): Partial<Record<NodeId, { w: number; h: number }>> =>
      Object.fromEntries(ORDER.map(id => [id, label(fs)(id)]));
    const cases: [number, number, boolean, Partial<Record<NodeId, { w: number; h: number }>> | undefined][] = [
      ...fallback.map(([w, h, n]) => [w, h, n, undefined] as [number, number, boolean, undefined]),
      [390, 360, true, measured(13)],
      [745, 360, true, measured(13)],
      [560, 450, false, measured(18)],
    ];

    it('cycleLayout nodes do not overlap and keep inside the area', () => {
      for (const [w, h, narrow, sizes] of cases) {
        const { nodes } = cycleLayout(w, h, narrow, sizes);
        expect(nodes).toHaveLength(8);
        for (const n of nodes) {
          expect(n.x - n.w / 2, `${n.id} ${w}`).toBeGreaterThanOrEqual(0);
          expect(n.x + n.w / 2).toBeLessThanOrEqual(w);
          expect(n.y - n.h / 2).toBeGreaterThanOrEqual(0);
          expect(n.y + n.h / 2).toBeLessThanOrEqual(h);
        }
        for (let i = 0; i < nodes.length; i += 1) {
          for (let j = i + 1; j < nodes.length; j += 1) {
            const a = nodes[i];
            const b = nodes[j];
            const apart = Math.abs(a.x - b.x) >= (a.w + b.w) / 2 || Math.abs(a.y - b.y) >= (a.h + b.h) / 2;
            expect(apart, `${a.id} ${b.id} at ${w}x${h}`).toBe(true);
          }
        }
      }
    });

    it('cycleLayout goes clockwise from the top', () => {
      for (const [w, h, narrow, sizes] of cases) {
        const { cx, cy, nodes } = cycleLayout(w, h, narrow, sizes);
        const by = Object.fromEntries(nodes.map(n => [n.id, n]));
        expect(nodes.map(n => n.id)).toEqual(ORDER);
        expect(by.ia.x).toBeCloseTo(cx, 6);
        expect(by.ia.y).toBeLessThan(cy);
        const angle = (n: { x: number; y: number }): number => {
          const a = Math.atan2(n.x - cx, -(n.y - cy));
          return a < 0 ? a + 2 * Math.PI : a;
        };
        const angles = ORDER.map(id => angle(by[id]));
        for (let i = 1; i < angles.length; i += 1) {
          expect(angles[i]).toBeGreaterThan(angles[i - 1]);
        }
      }
    });

    it('all nodes sit on the ellipse', () => {
      const { cx, cy, rx, ry, nodes } = cycleLayout(1280, 540, false);
      for (const n of nodes) {
        expect(((n.x - cx) / rx) ** 2 + ((n.y - cy) / ry) ** 2).toBeCloseTo(1, 9);
      }
    });
  });
});
