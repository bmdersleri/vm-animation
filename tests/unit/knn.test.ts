import { describe, expect, it } from 'vitest';
import { customers, rawPoint, type DatasetId } from '../../src/concepts/knn/data';
import {
  applyScaler, distance, fitScaler, kNearest, vote, type Metric, type Weighting,
} from '../../src/concepts/knn/knn';
import fixtures from '../fixtures/knn_sklearn.json';

describe('knn math', () => {
  it('fitScaler uses population std', () => {
    const s = fitScaler([{ x: 0, y: 0 }, { x: 2, y: 4 }]);
    expect(s.mean).toEqual({ x: 1, y: 2 });
    expect(s.std).toEqual({ x: 1, y: 2 });
  });

  it('distance', () => {
    const a = { x: 0, y: 0 }, b = { x: 3, y: 4 };
    expect(distance(a, b, 'oklid')).toBe(5);
    expect(distance(a, b, 'manhattan')).toBe(7);
  });

  it('vote tie goes to Kaldı', () => {
    const v = vote([
      { index: 0, distance: 1, weight: 1, cls: 0 },
      { index: 1, distance: 1, weight: 1, cls: 1 },
    ]);
    expect(v.scores).toEqual([1, 1]);
    expect(v.winner).toBe(0);
  });

  it('weighted vote with zero distance matches sklearn', () => {
    const pts = customers.map((c) => ({ x: c.tenure, y: c.monthly }));
    const labels = customers.map((c) => c.churn);
    const n = kNearest(pts, labels, pts[0], 5, 'oklid', 'agirlikli');
    expect(n[0].index).toBe(0);
    expect(n[0].weight).toBe(1);
    n.slice(1).forEach((x) => expect(x.weight).toBe(0));
    n.forEach((x) => expect(Number.isFinite(x.weight)).toBe(true));
  });

  it('matches sklearn fixtures', () => {
    const cases = (fixtures as unknown as { cases: {
      dataset: DatasetId; scaled: boolean; metric: Metric; weighting: Weighting; k: number;
      query: { tenure: number; value: number }; neighbors: number[]; prediction: number; proba: number[];
    }[] }).cases;
    expect(cases.length).toBeGreaterThan(0);
    const labels = customers.map((c) => c.churn);
    for (const c of cases) {
      const raw = customers.map((cu) => {
        const r = rawPoint(cu, c.dataset);
        return { x: r.tenure, y: r.value };
      });
      const scaler = c.scaled ? fitScaler(raw) : null;
      const pts = raw.map((p) => applyScaler(p, scaler));
      const q = applyScaler({ x: c.query.tenure, y: c.query.value }, scaler);
      const n = kNearest(pts, labels, q, c.k, c.metric, c.weighting);
      expect(n.map((x) => x.index)).toEqual(c.neighbors);
      const v = vote(n);
      expect(v.winner).toBe(c.prediction);
      const sum = v.scores[0] + v.scores[1];
      expect(v.scores[0] / sum).toBeCloseTo(c.proba[0], 9);
      expect(v.scores[1] / sum).toBeCloseTo(c.proba[1], 9);
    }
  });
});
