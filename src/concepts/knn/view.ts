import { kNearest, vote, type Metric, type Neighbor, type Vec, type Vote, type Weighting } from './knn';
import { featureSpace, type FeatureSpace } from './space';
import type { KnnParams } from './scenario';

export type Phase = 0 | 1 | 2 | 3 | 4;

export interface KnnView {
  phase: Phase;
  space: FeatureSpace;
  query: Vec;
  showQuery: boolean;
  distances: Neighbor[];
  neighbors: Neighbor[];
  showLines: 'none' | 'all' | 'neighbors';
  radius: number;
  metric: Metric;
  vote: Vote | null;
  prediction: { cls: 0 | 1; label: 'KALACAK' | 'AYRILACAK'; detail: string } | null;
  regions: boolean;
  k: number;
  weighting: Weighting;
}

export function deriveKnnView(stepIndex: number, p: KnnParams): KnnView {
  const phase = Math.max(0, Math.min(stepIndex, 4)) as Phase;
  const space = featureSpace(p.dataset, p.scaled);
  const query = space.toSpace(p.query);
  const distances = kNearest(space.points, space.labels, query, space.points.length, p.metric, p.weighting);
  // Weights (zero-distance rule) are defined over the k selected neighbours.
  const neighbors = kNearest(space.points, space.labels, query, p.k, p.metric, p.weighting);
  const radius = neighbors.length ? neighbors[neighbors.length - 1].distance : 0;
  const v = phase >= 4 ? vote(neighbors) : null;
  let prediction: KnnView['prediction'] = null;
  if (v) {
    const win = v.scores[v.winner];
    const detail = p.weighting === 'esit'
      ? `${win}/${p.k} oy`
      : `ağırlığın %${Math.round((100 * win) / (v.scores[0] + v.scores[1]))}'si`;
    prediction = {
      cls: v.winner,
      label: v.winner === 1 ? 'AYRILACAK' : 'KALACAK',
      detail,
    };
  }
  return {
    phase, space, query,
    showQuery: phase >= 1,
    distances, neighbors,
    showLines: phase === 2 ? 'all' : phase >= 3 ? 'neighbors' : 'none',
    radius, metric: p.metric, vote: v, prediction,
    regions: p.regions, k: p.k, weighting: p.weighting,
  };
}
