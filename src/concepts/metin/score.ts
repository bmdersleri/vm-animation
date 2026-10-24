import type { Model } from './data';
import { DEGIL_STOP } from './tokenize';
import { analyze } from './vectorize';

/** The logistic function; finite for every finite input. */
export function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

/** What `score` needs of a model (the generator's models and the book's two small ones). */
export type ScoringModel = Pick<Model, 'ngram' | 'dropDegil' | 'vocab' | 'idf' | 'coef' | 'intercept'>;

/** One in-vocabulary term of a scored comment. */
export interface ScoredTerm {
  term: string;
  /** TF-IDF weight in the L2-normalised row. */
  weight: number;
  coef: number;
  /** weight x coef. */
  contribution: number;
}

export interface Score {
  /** Every analysed term of the comment (unigrams, then bigrams), out-of-vocabulary ones included. */
  tokens: string[];
  /** In-vocabulary terms in order of first appearance. */
  terms: ScoredTerm[];
  /** Out-of-vocabulary terms, one entry per occurrence, in text order. */
  oov: string[];
  /** Sum of the contributions plus the intercept. */
  z: number;
  /** Probability of "olumlu": 1 / (1 + e^-z). */
  p: number;
}

const columnCache = new WeakMap<readonly string[], Map<string, number>>();

function columnsOf(vocab: readonly string[]): Map<string, number> {
  let cols = columnCache.get(vocab);
  if (cols === undefined) {
    cols = new Map(vocab.map((term, j) => [term, j]));
    columnCache.set(vocab, cols);
  }
  return cols;
}

/**
 * The pipeline `TfidfVectorizer + LogisticRegression` on one comment, with the stored vocabulary,
 * IDF, coefficients and intercept: the row is count x IDF over the known terms, L2 normalised; the
 * logit is the sum of weight x coefficient plus the intercept. Terms outside the vocabulary are
 * ignored (and listed in `oov`); a comment without a known term has the zero vector, so z is the
 * intercept and p comes from it alone.
 */
export function score(model: ScoringModel, text: string): Score {
  const cols = columnsOf(model.vocab);
  const tokens = analyze(text, model.ngram, model.dropDegil ? DEGIL_STOP : undefined);
  const counts = new Map<number, number>();
  const oov: string[] = [];
  for (const term of tokens) {
    const j = cols.get(term);
    if (j === undefined) {
      oov.push(term);
    } else {
      counts.set(j, (counts.get(j) ?? 0) + 1);
    }
  }
  let sumSquares = 0;
  for (const [j, c] of counts) {
    sumSquares += (c * model.idf[j]) ** 2;
  }
  const norm = Math.sqrt(sumSquares);
  const terms: ScoredTerm[] = [];
  let sum = 0;
  for (const [j, c] of counts) {
    const weight = norm === 0 ? 0 : (c * model.idf[j]) / norm;
    const contribution = weight * model.coef[j];
    sum += contribution;
    terms.push({ term: model.vocab[j], weight, coef: model.coef[j], contribution });
  }
  const z = sum + model.intercept;
  return { tokens, terms, oov, z, p: sigmoid(z) };
}
