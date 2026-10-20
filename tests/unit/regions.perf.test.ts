// Timing test: `npm test` runs *.perf.test.ts in a second, serial pass so
// parallel test workers do not slow the measured window.
import { describe, it, expect } from 'vitest';
import { featureSpace } from '../../src/concepts/knn/space';
import { computeRegions, type RegionGrid } from '../../src/concepts/knn/regions';

describe('computeRegions', () => {
  const isCI = Boolean((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.CI);
  const budgetMs = isCI ? 40 : 8;
  it(`is fast: 220x120, k=15 median of 20 runs < ${budgetMs} ms (${isCI ? 'CI sanity bound' : 'local budget'})`, () => {
    const s = featureSpace('aylik', true);
    const g: RegionGrid = { cols: 220, rows: 120, x0: s.domain.x[0], x1: s.domain.x[1], y0: s.domain.y[0], y1: s.domain.y[1] };
    const out = new Uint8Array(g.cols * g.rows);
    for (let i = 0; i < 5; i++) computeRegions(s, 15, 'oklid', 'agirlikli', g, out);
    // per-run times and their median: a run slowed by parallel test workers does not tip the budget
    const times: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      computeRegions(s, 15, 'oklid', 'agirlikli', g, out);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const median = (times[9] + times[10]) / 2;
    console.log(`computeRegions median ${median.toFixed(2)} ms`);
    expect(median).toBeLessThan(budgetMs);
  });
});
