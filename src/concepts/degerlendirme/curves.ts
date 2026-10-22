import { cost, metrics, type Confusion } from './metrics';

export interface ScoredSample { id: string; actual: 0 | 1; score: number }
export type Threshold = number | 'none';
export interface CurvePoint {
  threshold: Threshold;
  confusion: Confusion;
  fpr: number | null;
  tpr: number | null;
  precision: number | null;
  recall: number | null;
}

function validateSamples(samples: readonly ScoredSample[]): void {
  const ids = new Set<string>();
  for (const sample of samples) {
    if (typeof sample.id !== 'string' || sample.id.length === 0 || ids.has(sample.id)
      || (sample.actual !== 0 && sample.actual !== 1)
      || !Number.isFinite(sample.score) || sample.score < 0 || sample.score > 1) {
      throw new RangeError('Samples require unique ids, binary actual classes, and scores in [0, 1]');
    }
    ids.add(sample.id);
  }
}

export function classify(samples: readonly ScoredSample[], threshold: Threshold): Confusion {
  validateSamples(samples);
  if (threshold !== 'none' && (!Number.isFinite(threshold) || threshold < 0 || threshold > 1)) {
    throw new RangeError('Threshold must be none or a probability in [0, 1]');
  }
  const confusion: Confusion = { tn: 0, fp: 0, fn: 0, tp: 0 };
  for (const sample of samples) {
    const positive = threshold !== 'none' && sample.score >= threshold;
    confusion[sample.actual ? (positive ? 'tp' : 'fn') : (positive ? 'fp' : 'tn')]++;
  }
  return confusion;
}

export function curvePoints(samples: readonly ScoredSample[]): CurvePoint[] {
  validateSamples(samples);
  const thresholds: Threshold[] = ['none', ...new Set(samples.map(sample => sample.score).sort((a, b) => b - a))];
  return thresholds.map(threshold => {
    const confusion = classify(samples, threshold);
    const m = metrics(confusion);
    const negatives = confusion.tn + confusion.fp;
    return { threshold, confusion, fpr: negatives ? confusion.fp / negatives : null, tpr: m.recall, precision: m.precision, recall: m.recall };
  });
}

export function rocAuc(samples: readonly ScoredSample[]): number | null {
  const points = curvePoints(samples);
  if (points[0].fpr === null || points[0].tpr === null) return null;
  let area = 0;
  for (let i = 1; i < points.length; i++) {
    area += (points[i].fpr! - points[i - 1].fpr!) * (points[i].tpr! + points[i - 1].tpr!) / 2;
  }
  return area;
}

export function averagePrecision(samples: readonly ScoredSample[]): number | null {
  const points = curvePoints(samples);
  if (points[0].recall === null) return null;
  let area = 0;
  for (let i = 1; i < points.length; i++) {
    area += (points[i].recall! - points[i - 1].recall!) * points[i].precision!;
  }
  return area;
}

export function bestThreshold(samples: readonly ScoredSample[], fpCost: number, fnCost: number): Threshold {
  validateSamples(samples);
  // Descending order makes ties prefer fewer positive predictions; none is highest.
  const candidates: Threshold[] = ['none', ...new Set([...samples.map(sample => sample.score), 0].sort((a, b) => b - a))];
  let best: Threshold = 'none';
  let minimum = Infinity;
  const seen = new Set<string>();
  for (const threshold of candidates) {
    const c = classify(samples, threshold);
    const candidateCost = cost(c, fpCost, fnCost);
    const key = `${c.tn}/${c.fp}/${c.fn}/${c.tp}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (candidateCost < minimum) { minimum = candidateCost; best = threshold; }
  }
  return best;
}
