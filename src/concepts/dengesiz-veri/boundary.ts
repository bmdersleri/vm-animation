import { averagePrecision, classify, type ScoredSample } from '../degerlendirme/curves';
import type { Confusion } from '../degerlendirme/metrics';
import { CUSTOMERS, SCALE } from '../dengesiz/data';
import { fitLogReg, predictProba, type LogRegModel } from '../dengesiz/logreg';
import { toScaled, type Pt } from '../dengesiz/smote';
import { BALANCED, smoteFor, TRAIN, X_DOMAIN, Y_DOMAIN } from './model';
import type { ImbParams } from './scenario';

/** The three balancing methods of the decision-boundary steps. */
export type Method = 'yok' | 'smote' | 'agirlik';

/** Methods in reading order with their names on the page. */
export const METHODS: readonly { id: Method; label: string }[] = [
  { id: 'yok', label: 'ağırlıksız' },
  { id: 'smote', label: 'SMOTE' },
  { id: 'agirlik', label: 'ağırlıklı' },
];

/** The parameters that decide the fitted model of a method. */
export type FitParams = Pick<ImbParams, 'k' | 'seed' | 'ratio' | 'weight' | 'manualWeight'>;

/** A boundary line clipped to the plot rectangle, in original units (tenure, charge). */
export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Everything one method shows at one threshold. */
export interface MethodResult {
  method: Method;
  label: string;
  matrix: Confusion;
  /** Average precision (PR-AUC) of the test scores; null when the test part has no churner. */
  ap: number | null;
  /** The line p = threshold inside the plot rectangle; null when it misses the rectangle. */
  segment: Segment | null;
  /** The sentence shown at the edge when there is no line. */
  note: string | null;
}

const TRAIN_PTS: Pt[] = TRAIN.map(toScaled);
const TRAIN_Y: (0 | 1)[] = TRAIN.map((c) => c.churn);
const TEST = CUSTOMERS.filter((c) => c.split === 'test');
const TEST_PTS: Pt[] = TEST.map(toScaled);

const CACHE_LIMIT = 24;
const fitCache = new Map<string, LogRegModel>();

/** Class weights of the weighted method for the page's weight choice (remaining, churner). */
export function weightsFor(p: Pick<ImbParams, 'weight' | 'manualWeight'>): { neg: number; pos: number } {
  if (p.weight === 'dengeli') {
    return { neg: BALANCED.neg, pos: BALANCED.pos };
  }
  return { neg: 1, pos: p.weight === 'elle' ? p.manualWeight : 1 };
}

/**
 * The two-feature logistic model of a method, fitted in the browser on the standardised training
 * part (SMOTE adds its synthetic points, the weighted method gives the churners their weight).
 * Cached by the parameters that matter.
 */
export function modelFor(method: Method, p: FitParams): LogRegModel {
  const w = weightsFor(p);
  let key = 'yok';
  if (method === 'smote') {
    key = `smote|${p.k}|${p.seed}|${p.ratio}`;
  } else if (method === 'agirlik') {
    key = `agirlik|${w.neg}|${w.pos}`;
  }
  let model = fitCache.get(key);
  if (!model) {
    let fit;
    if (method === 'smote') {
      const synthetic = smoteFor(p.k, p.seed, p.ratio);
      fit = fitLogReg(
        TRAIN_PTS.concat(synthetic.map((s) => ({ x: s.x, y: s.y }))),
        TRAIN_Y.concat(synthetic.map(() => 1 as const)),
        null,
        1,
      );
    } else if (method === 'agirlik') {
      fit = fitLogReg(
        TRAIN_PTS,
        TRAIN_Y,
        TRAIN_Y.map((y) => (y === 1 ? w.pos : w.neg)),
        1,
      );
    } else {
      fit = fitLogReg(TRAIN_PTS, TRAIN_Y, null, 1);
    }
    model = { coef: fit.coef, intercept: fit.intercept };
    if (fitCache.size >= CACHE_LIMIT) {
      fitCache.clear();
    }
    fitCache.set(key, model);
  }
  return model;
}

/** The model's probability for every test customer, in test order. */
export function testScores(model: LogRegModel): ScoredSample[] {
  return TEST.map((c, i) => ({ id: String(i), actual: c.churn, score: predictProba(model, TEST_PTS[i]) }));
}

/**
 * The line p = threshold of a model inside the plot rectangle, in original units. The model's
 * line a * zx + b * zy = c (standardised) becomes A * tenure + B * charge = C.
 */
export function boundarySegment(model: LogRegModel, threshold: number): Segment | null {
  const [mx, my] = SCALE.mean;
  const [sx, sy] = SCALE.std;
  const a = model.coef[0];
  const b = model.coef[1];
  const c = Math.log(threshold / (1 - threshold)) - model.intercept;
  const A = a / sx;
  const B = b / sy;
  const C = c + (a * mx) / sx + (b * my) / sy;
  const [x0, x1] = X_DOMAIN;
  const [y0, y1] = Y_DOMAIN;
  const eps = 1e-9;
  const hits: [number, number][] = [];
  const add = (x: number, y: number): void => {
    const inside = x >= x0 - eps && x <= x1 + eps && y >= y0 - eps && y <= y1 + eps;
    if (inside && !hits.some(([hx, hy]) => Math.abs(hx - x) < 1e-6 && Math.abs(hy - y) < 1e-6)) {
      hits.push([Math.min(x1, Math.max(x0, x)), Math.min(y1, Math.max(y0, y))]);
    }
  };
  if (Math.abs(B) > 1e-12) {
    add(x0, (C - A * x0) / B);
    add(x1, (C - A * x1) / B);
  }
  if (Math.abs(A) > 1e-12) {
    add((C - B * y0) / A, y0);
    add((C - B * y1) / A, y1);
  }
  if (hits.length < 2) {
    return null;
  }
  return { x1: hits[0][0], y1: hits[0][1], x2: hits[1][0], y2: hits[1][1] };
}

/** The sentence shown at the plot edge when a method's line misses the rectangle. */
export function outsideNote(matrix: Confusion): string {
  if (matrix.tp + matrix.fp === 0) {
    return "sınır alan dışında: kimse 'ayrılır' denmiyor";
  }
  if (matrix.tn + matrix.fn === 0) {
    return "sınır alan dışında: herkese 'ayrılır' deniyor";
  }
  return 'sınır alan dışında';
}

/** Test scores and PR-AUC of a fitted model; neither depends on the threshold, so a threshold drag reuses them. */
const scoreCache = new WeakMap<LogRegModel, { scores: ScoredSample[]; ap: number | null }>();

function scoredFor(model: LogRegModel): { scores: ScoredSample[]; ap: number | null } {
  let hit = scoreCache.get(model);
  if (!hit) {
    const scores = testScores(model);
    hit = { scores, ap: averagePrecision(scores) };
    scoreCache.set(model, hit);
  }
  return hit;
}

/** Matrix, PR-AUC and line of a method at a threshold. */
export function resultFor(method: Method, p: FitParams, threshold: number): MethodResult {
  const model = modelFor(method, p);
  const { scores, ap } = scoredFor(model);
  const matrix = classify(scores, threshold);
  const segment = boundarySegment(model, threshold);
  return {
    method,
    label: METHODS.find((m) => m.id === method)!.label,
    matrix,
    ap,
    segment,
    note: segment ? null : outsideNote(matrix),
  };
}
