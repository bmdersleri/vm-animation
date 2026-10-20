import { describe, expect, it } from 'vitest';
import { kNearest, vote } from '../../src/concepts/knn/knn';
import { featureSpace } from '../../src/concepts/knn/space';
import { knnScenario, type KnnParams } from '../../src/concepts/knn/scenario';
import { deriveKnnView } from '../../src/concepts/knn/view';

const base: KnnParams = knnScenario.defaults;

describe('deriveKnnView', () => {
  it('phase and visibility flags', () => {
    const exp: [number, number, boolean, string][] = [
      [0, 0, false, 'none'], [1, 1, true, 'none'], [2, 2, true, 'all'],
      [3, 3, true, 'neighbors'], [4, 4, true, 'neighbors'], [11, 4, true, 'neighbors'],
    ];
    for (const [step, phase, showQuery, lines] of exp) {
      const v = deriveKnnView(step, base);
      expect(v.phase).toBe(phase);
      expect(v.showQuery).toBe(showQuery);
      expect(v.showLines).toBe(lines);
      expect(v.vote === null).toBe(phase < 4);
      expect(v.prediction === null).toBe(phase < 4);
    }
  });

  it('neighbors equal kNearest, radius is k-th distance, distances cover all', () => {
    for (const weighting of ['esit', 'agirlikli'] as const) {
      const p = { ...base, weighting, k: 7 };
      const v = deriveKnnView(3, p);
      const s = featureSpace(p.dataset, p.scaled);
      const exp = kNearest(s.points, s.labels, s.toSpace(p.query), p.k, p.metric, p.weighting);
      expect(v.neighbors).toEqual(exp);
      expect(v.radius).toBe(exp[6].distance);
      expect(v.distances.length).toBe(48);
      for (let i = 0; i < p.k; i++) expect(v.distances[i].index).toBe(v.neighbors[i].index);
    }
  });

  it('prediction detail strings', () => {
    const e = deriveKnnView(4, { ...base, weighting: 'esit' });
    const w = e.vote!.scores[e.vote!.winner];
    expect(e.prediction!.detail).toBe(`${w}/${base.k} oy`);
    const a = deriveKnnView(4, { ...base, weighting: 'agirlikli' });
    const sc = a.vote!.scores;
    const pct = Math.round((100 * sc[a.vote!.winner]) / (sc[0] + sc[1]));
    expect(a.prediction!.detail).toBe(`ağırlığın %${pct}'si`);
    expect(a.prediction!.label).toBe(a.vote!.winner === 1 ? 'AYRILACAK' : 'KALACAK');
    expect(vote(a.neighbors)).toEqual(a.vote);
  });
});
