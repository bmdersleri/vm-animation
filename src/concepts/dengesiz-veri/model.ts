import { CUSTOMERS, type Customer } from '../dengesiz/data';
import { balancedWeights } from '../dengesiz/logreg';
import {
  fromScaled,
  neighbours,
  randomOversample,
  smote,
  syntheticCount,
  toScaled,
  type Pt,
  type Synthetic,
} from '../dengesiz/smote';

/** Training customers of the stratified split. */
export const TRAIN: readonly Customer[] = CUSTOMERS.filter((c) => c.split === 'train');

/** The training churners (the SMOTE minority), in data order; SMOTE indexes refer to this list. */
export const MINORITY: readonly Customer[] = TRAIN.filter((c) => c.churn === 1);

/** The minority in the standardised plane. */
export const MINORITY_PTS: readonly Pt[] = MINORITY.map(toScaled);

const count = (rows: readonly Customer[]): { neg: number; pos: number } => {
  const pos = rows.filter((c) => c.churn === 1).length;
  return { neg: rows.length - pos, pos };
};

/** Class counts of all customers, of the training part and of the test part. */
export const COUNTS = {
  all: count(CUSTOMERS),
  train: count(TRAIN),
  test: count(CUSTOMERS.filter((c) => c.split === 'test')),
};

/** Balanced class weights of the training labels (n / (2 n_c)). */
export const BALANCED = balancedWeights(TRAIN.map((c) => c.churn));

/** Most synthetic points SMOTE ever adds (ratio 1,0). */
export const MAX_SYNTHETIC = syntheticCount(COUNTS.train.neg, COUNTS.train.pos, 1);

/** Number of stops of the step-6 sweep after the first one. */
const SWEEP_STOPS = 20;

/** Ratios of the step-6 sweep: 0 synthetic points up to MAX_SYNTHETIC, minority / majority. */
export const SWEEP_RATIOS: readonly number[] = Array.from(
  { length: SWEEP_STOPS + 1 },
  (_, t) => (COUNTS.train.pos + Math.round((MAX_SYNTHETIC * t) / SWEEP_STOPS)) / COUNTS.train.neg,
);

/** How many synthetic points a ratio asks for. */
export function syntheticFor(ratio: number): number {
  return syntheticCount(COUNTS.train.neg, COUNTS.train.pos, ratio);
}

const CACHE_LIMIT = 24;
const smoteCache = new Map<string, Synthetic[]>();

/** SMOTE on the training minority, cached by (k, seed, ratio). */
export function smoteFor(k: number, seed: number, ratio: number): Synthetic[] {
  const key = `${k}|${seed}|${ratio}`;
  let out = smoteCache.get(key);
  if (!out) {
    out = smote(MINORITY_PTS, k, syntheticFor(ratio), seed);
    if (smoteCache.size >= CACHE_LIMIT) {
      smoteCache.clear();
    }
    smoteCache.set(key, out);
  }
  return out;
}

const copyCache = new Map<string, number[]>();

/** Random oversampling copies per minority point, cached by (seed, ratio). */
export function copiesFor(seed: number, ratio: number): number[] {
  const key = `${seed}|${ratio}`;
  let out = copyCache.get(key);
  if (!out) {
    out = randomOversample(MINORITY.length, syntheticFor(ratio), seed);
    if (copyCache.size >= CACHE_LIMIT) {
      copyCache.clear();
    }
    copyCache.set(key, out);
  }
  return out;
}

/** A plane position in the original units. */
export interface Place {
  tenure: number;
  charge: number;
}

/** The step-5 example: x_i, its k neighbours, the chosen x_zi, lambda and x_new. */
export interface Example {
  i: number;
  j: number;
  neighbours: number[];
  lambda: number;
  xi: Place;
  xz: Place;
  xnew: Place;
}

const nbCache = new Map<number, number[][]>();

const legible = (p: Place): boolean => p.tenure >= 6 && p.tenure <= 66 && p.charge >= 30 && p.charge <= 110;

/**
 * The first synthetic point of `smote(minority, k, 1, seed)`, or the next one whose three
 * points lie in the readable part of the plane (tenure 6-66, charge 30-110).
 */
export function exampleFor(k: number, seed: number): Example {
  let nb = nbCache.get(k);
  if (!nb) {
    nb = neighbours(MINORITY_PTS, k);
    nbCache.set(k, nb);
  }
  const lists = nb;
  const run = smote(MINORITY_PTS, k, 40, seed);
  const place = (c: Customer): Place => ({ tenure: c.tenure, charge: c.charge });
  const build = (s: Synthetic): Example => ({
    i: s.i,
    j: s.j,
    neighbours: lists[s.i],
    lambda: s.lambda,
    xi: place(MINORITY[s.i]),
    xz: place(MINORITY[s.j]),
    xnew: fromScaled(s),
  });
  const all = run.map(build);
  return all.find((e) => legible(e.xi) && legible(e.xz) && legible(e.xnew)) ?? all[0];
}
