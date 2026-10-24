import type { ScoredSample } from '../degerlendirme/curves';
import type { Confusion } from '../degerlendirme/metrics';
import generated from './data/dengesiz.json';

/** One customer: tenure in months, monthly charge, class (1 = churns) and the stratified split. */
export type Customer = { tenure: number; charge: number; churn: 0 | 1; split: 'train' | 'test' };

/** One two-feature model of the generator (standardised features, threshold 0.5 matrix). */
export type Model2d = { coef: [number, number]; intercept: number; matrix: Confusion; ap: number };

/** One run of the leakage experiment (book code 02) for a SMOTE seed. */
export type LeakRun = {
  seed: number;
  leaky: {
    n: number;
    pos: number;
    synthPos: number;
    parentInTrain: number;
    scores: readonly ScoredSample[];
    ap: number;
  };
  honest: { scores: readonly ScoredSample[]; ap: number };
};

/** Scored test rows and their PR-AUC. */
export type Scored = { scores: readonly ScoredSample[]; ap: number };

type RawScored = { scores: number[]; actual?: number[]; ap: number };

type Generated = {
  customers: { tenure: number[]; charge: number[]; churn: number[]; test: number[] };
  scale: { mean: [number, number]; std: [number, number] };
  book01: {
    matrix: Confusion;
    precision: number | null;
    recall: number;
    f1: number;
    accuracy: number;
  };
  models2d: Record<'base' | 'smote' | 'weighted', Model2d>;
  leak: {
    seeds: number[];
    bySeed: {
      seed: number;
      leaky: { n: number; pos: number; synthPos: number; parentInTrain: number } & RawScored;
      honest: RawScored;
    }[];
    example: { point: [number, number]; parents: [number, number] };
  };
  cv: {
    folds: {
      trainNeg: number;
      trainPos: number;
      smoteNeg: number;
      smotePos: number;
      valNeg: number;
      valPos: number;
      ap: number;
    }[];
    mean: number;
  };
  compare: Record<'base' | 'smote' | 'weighted', RawScored>;
  kod05: { matrix: Confusion };
};

const data = generated as unknown as Generated;

/** The test labels of the stratified split, in test order (the order of every stored score list). */
function testLabels(): (0 | 1)[] {
  const out: (0 | 1)[] = [];
  data.customers.test.forEach((flag, i) => {
    if (flag === 1) {
      out.push(data.customers.churn[i] as 0 | 1);
    }
  });
  return out;
}

function toSamples(scores: readonly number[], actual: readonly (0 | 1)[]): ScoredSample[] {
  return scores.map((score, i) => ({ id: String(i), actual: actual[i], score }));
}

/** The 2000 customers of the severe churn data. */
export const CUSTOMERS: readonly Customer[] = data.customers.tenure.map((tenure, i) => ({
  tenure,
  charge: data.customers.charge[i],
  churn: data.customers.churn[i] as 0 | 1,
  split: data.customers.test[i] === 1 ? 'test' : 'train',
}));

/** Training mean and standard deviation of tenure and monthly charge (StandardScaler). */
export const SCALE: { mean: [number, number]; std: [number, number] } = data.scale;

/** The book code 01 model (all 8 features, no balancing) on the test part. */
export const BOOK01: {
  matrix: Confusion;
  precision: number | null;
  recall: number;
  f1: number;
  accuracy: number;
} = data.book01;

/** The three two-feature models of page 1. */
export const MODELS2D: Record<'base' | 'smote' | 'weighted', Model2d> = data.models2d;

/**
 * The stratified test labels in test order. The generator stores the honest scores and the
 * kod04 / kod05 scores in this order.
 */
const LABELS = testLabels();

/** The leakage experiment: seeds and, per seed, the leaky and the honest test scores. */
export const LEAK: { seeds: readonly number[]; bySeed: readonly LeakRun[] } = {
  seeds: data.leak.seeds,
  bySeed: data.leak.bySeed.map(run => ({
    seed: run.seed,
    leaky: {
      n: run.leaky.n,
      pos: run.leaky.pos,
      synthPos: run.leaky.synthPos,
      parentInTrain: run.leaky.parentInTrain,
      scores: toSamples(run.leaky.scores, run.leaky.actual as (0 | 1)[]),
      ap: run.leaky.ap,
    },
    honest: { scores: toSamples(run.honest.scores, LABELS), ap: run.honest.ap },
  })),
};

/** A synthetic test point of seed 42 (tenure, charge in original units) and its parents' indexes. */
export const LEAK_EXAMPLE: { point: [number, number]; parents: [number, number] } = data.leak.example;

/** Pipeline cross validation of book code 03. */
export const CV: {
  folds: readonly {
    trainNeg: number;
    trainPos: number;
    smoteNeg: number;
    smotePos: number;
    valNeg: number;
    valPos: number;
    ap: number;
  }[];
  mean: number;
} = data.cv;

/** Book codes 04 / 05: three models on the same stratified test part. */
export const COMPARE: Record<'base' | 'smote' | 'weighted', Scored> = {
  base: { scores: toSamples(data.compare.base.scores, LABELS), ap: data.compare.base.ap },
  smote: { scores: toSamples(data.compare.smote.scores, LABELS), ap: data.compare.smote.ap },
  weighted: { scores: toSamples(data.compare.weighted.scores, LABELS), ap: data.compare.weighted.ap },
};

/** Book code 05 matrix at the 0.5 threshold. */
export const KOD05: { matrix: Confusion } = data.kod05;

/** The numbers the book prints and this site's generator does not reproduce (its SMOTE differs). */
export const BOOK_NUMBERS: { leaky: number; honest: number; cv: number } = {
  leaky: 0.724,
  honest: 0.147,
  cv: 0.177,
};
