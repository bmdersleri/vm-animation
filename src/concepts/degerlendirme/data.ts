import generated from './data/degerlendirme.json';
import type { ScoredSample } from './curves';
import type { Confusion } from './metrics';

export interface CvSample {
  readonly id: string;
  readonly x: readonly number[];
  readonly actual: 0 | 1;
  readonly partition: 'development' | 'test';
}
export interface Prediction { readonly id: string; readonly actual: 0 | 1; readonly predicted: 0 | 1 }
export interface PredictionResult {
  readonly predictions: readonly Prediction[];
  readonly confusion: Readonly<Confusion>;
  /** sklearn F1 uses zero_division=0; UI metrics uses null for a zero denominator. */
  readonly f1: number;
}
export interface CvFold extends PredictionResult {
  readonly trainIds: readonly string[];
  readonly validationIds: readonly string[];
  readonly mean: readonly number[];
  readonly scale: readonly number[];
}
export interface CvRun {
  readonly k: 3 | 5;
  readonly method: 'kfold' | 'stratified';
  readonly c: .1 | 1;
  readonly folds: readonly CvFold[];
  readonly meanF1: number;
  readonly stdF1: number;
}
export interface EvaluationData {
  readonly metadata: {
    readonly seed: number;
    readonly versions: { readonly python: string; readonly numpy: string; readonly sklearn: string };
    readonly scoreDescription: string;
    readonly zeroDivisionPolicy: string;
    readonly cvParameters: { readonly solver: string; readonly maxIter: number; readonly shuffle: boolean };
  };
  readonly matrix: Readonly<Confusion>;
  readonly scoreSets: Readonly<Record<'balanced' | 'imbalanced', {
    readonly validation: readonly Readonly<ScoredSample>[];
    readonly test: readonly Readonly<ScoredSample>[];
  }>>;
  readonly cv: {
    readonly samples: readonly CvSample[];
    readonly runs: readonly CvRun[];
    readonly selection: {
      readonly k: 5;
      readonly method: 'stratified';
      readonly c: .1 | 1;
      readonly meanF1: number;
      readonly fitMean: readonly number[];
      readonly fitScale: readonly number[];
      readonly finalTest: PredictionResult;
    };
  };
}

// JSON widens binary/enum literals to number/string. This assertion is confined to
// the generated boundary; unit tests verify its fields against sklearn fixtures.
export const evaluationData = generated as EvaluationData;
