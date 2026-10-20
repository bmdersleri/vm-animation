import { describe, it, expect } from 'vitest';
import { featureSpace } from '../../src/concepts/knn/space';
import { computeRegions, type RegionGrid } from '../../src/concepts/knn/regions';
import { kNearest, vote, type Metric, type Weighting } from '../../src/concepts/knn/knn';

function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}

describe('computeRegions', () => {
  for (const scaled of [false, true]) {
    it(`agrees with vote(kNearest) on 200 random cells (scaled=${scaled})`, () => {
      const s = featureSpace('aylik', scaled);
      const g: RegionGrid = { cols: 40, rows: 30, x0: s.domain.x[0], x1: s.domain.x[1], y0: s.domain.y[0], y1: s.domain.y[1] };
      const rand = rng(42);
      for (const k of [1, 5, 15]) for (const m of ['oklid', 'manhattan'] as Metric[]) for (const w of ['esit', 'agirlikli'] as Weighting[]) {
        const out = computeRegions(s, k, m, w, g);
        for (let i = 0; i < 200; i++) {
          const c = Math.floor(rand() * g.cols), r = Math.floor(rand() * g.rows);
          const q = { x: g.x0 + (c + 0.5) * (g.x1 - g.x0) / g.cols, y: g.y1 - (r + 0.5) * (g.y1 - g.y0) / g.rows };
          expect(out[r * g.cols + c]).toBe(vote(kNearest(s.points, s.labels, q, k, m, w)).winner);
        }
      }
    });
  }

  it('reuses out and handles a cell centre exactly on a point', () => {
    const s = featureSpace('toplam', false);
    const p = s.points[0];
    const g: RegionGrid = { cols: 1, rows: 1, x0: p.x - 1, x1: p.x + 1, y0: p.y - 1, y1: p.y + 1 };
    const out = new Uint8Array(1);
    expect(computeRegions(s, 5, 'oklid', 'agirlikli', g, out)).toBe(out);
    expect(out[0]).toBe(s.labels[0]);
  });

  const isCI = Boolean((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.CI);
  const budgetMs = isCI ? 40 : 8;
  it(`is fast: 220x120, k=15 averages < ${budgetMs} ms (${isCI ? 'CI sanity bound' : 'local budget'})`, () => {
    const s = featureSpace('aylik', true);
    const g: RegionGrid = { cols: 220, rows: 120, x0: s.domain.x[0], x1: s.domain.x[1], y0: s.domain.y[0], y1: s.domain.y[1] };
    const out = new Uint8Array(g.cols * g.rows);
    for (let i = 0; i < 5; i++) computeRegions(s, 15, 'oklid', 'agirlikli', g, out);
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) computeRegions(s, 15, 'oklid', 'agirlikli', g, out);
    const avg = (performance.now() - t0) / 20;
    console.log(`computeRegions avg ${avg.toFixed(2)} ms`);
    expect(avg).toBeLessThan(budgetMs);
  });
});
