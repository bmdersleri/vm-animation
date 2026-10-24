import type { Confusion } from '../degerlendirme/metrics';
import generated from './data/metin.json';

/** `<ngram>-<keep|drop "değil" as a stop word>-<vectoriser fitted on train|all data (leaky)>`. */
export type ModelKey = `${'uni' | 'bi'}-${'keep' | 'drop'}-${'train' | 'all'}`;

/** The pattern a corpus comment was made from. */
export type CommentKind = 'duz' | 'olumsuzlama' | 'karisik';

/** One labelled corpus comment (label 1 = olumlu, 0 = olumsuz). */
export interface Comment {
  text: string;
  label: 0 | 1;
  kind: CommentKind;
  split: 'train' | 'test';
}

/**
 * A trained `TfidfVectorizer(preprocessor=clean) + LogisticRegression(max_iter=1000)`. `vocab` is in
 * column order (code point order), `idf` and `coef` follow it; olumlu (1) is the positive class of
 * `matrix` (tn = olumsuz predicted olumsuz, tp = olumlu predicted olumlu), on the 100 test comments.
 */
export interface Model {
  key: ModelKey;
  ngram: 1 | 2;
  /** "değil" is a stop word of this model. */
  dropDegil: boolean;
  /** The vectoriser was fitted on all corpus comments (leakage). */
  leaky: boolean;
  /** Documents the vectoriser was fitted on. */
  nDocs: number;
  vocab: string[];
  idf: number[];
  coef: number[];
  intercept: number;
  matrix: Confusion;
  accuracy: number;
  /** Test comments of kind olumsuzlama and the accuracy on them. */
  negN: number;
  negAccuracy: number;
  vocabSize: number;
  /** Vocabulary terms no training comment has (only the leaky models). */
  testOnly: string[];
}

/** A book model of a few comments (kod04 / mini application); enough for `score`. */
export interface BookModel {
  ngram: 1 | 2;
  dropDegil: boolean;
  vocab: string[];
  idf: number[];
  coef: number[];
  intercept: number;
}

export interface ClassRow {
  precision: number;
  recall: number;
  'f1-score': number;
  support: number;
}

/** The book's worked examples, numbers as the generator printed them (6 decimals). */
export interface Book {
  kod01: {
    text: string;
    tokens: string[];
    /** Tokens when the "İ" -> "i" step is left out (Python lower() splits the word). */
    naiveTokens: string[];
    /** `[^a-z\s]` and `[^a-zçğıöşü\s]` on "bağlantı kötü". */
    trap: { wrongPattern: string; rightPattern: string };
  };
  kod02: {
    docs: string[];
    vocab: string[];
    bow: number[][];
    df: number[];
    idf: number[];
    /** count x IDF before the L2 step. */
    raw: number[][];
    /** L2 norm of each raw row. */
    norms: number[];
    tfidf: number[][];
  };
  kod03: {
    docs: string[];
    vocab: string[];
    tfidf: number[][];
    /** Cosine of the first comment (the query) with every comment, in document order. */
    scores: number[];
    /** Document indexes from the highest score to the lowest. */
    order: number[];
  };
  cosPair: { a: string; b: string; cos: number };
  kod04: {
    docs: string[];
    labels: (0 | 1)[];
    trainIdx: number[];
    testIdx: number[];
    testLabels: (0 | 1)[];
    predictions: (0 | 1)[];
    accuracy: number;
    report: Record<'0' | '1', ClassRow>;
    newComment: string;
    pNew: number;
    predNew: 0 | 1;
    model: BookModel;
  };
  mini: {
    docs: string[];
    labels: (0 | 1)[];
    comment: string;
    p: number;
    pred: 0 | 1;
    /** Cosine of the comment with each training comment. */
    similarities: number[];
    /** Index `argmax` picks (first of the ties). */
    best: number;
    /** Indexes that share the highest similarity. */
    tied: number[];
    model: BookModel;
  };
}

/** The "new period" comments and the drift numbers of the leak-free unigram model. */
export interface Drift {
  model: ModelKey;
  comments: { text: string; label: 0 | 1; p: number }[];
  oovTokensTest: number;
  tokensTest: number;
  /** Out-of-vocabulary token share on the test part and on the new period. */
  oovRateTest: number;
  oovTokensNew: number;
  tokensNew: number;
  oovRateNew: number;
  accuracyTest: number;
  accuracyNew: number;
  /** Terms of the new comments the training vocabulary lacks. */
  newTerms: string[];
  /** Of those, the terms no corpus comment uses (fiber, esim, ...). */
  novelTerms: string[];
  /** Indexes of the new comments whose every token is out of vocabulary. */
  allNew: number[];
}

type Generated = {
  stopWords: string[];
  book: Book;
  corpus: { text: string[]; label: number[]; kind: string[]; test: number[] };
  models: Record<ModelKey, Omit<Model, 'key'>>;
  drift: {
    model: ModelKey;
    comments: { text: string[]; label: number[]; p: number[] };
  } & Omit<Drift, 'comments'>;
};

const data = generated as unknown as Generated;

/** The book's stop-word set (code 01). "değil" is not in it; it is a model setting. */
export const STOP_WORDS: ReadonlySet<string> = new Set(data.stopWords);

/** The book's worked examples. */
export const BOOK: Book = data.book;

/** The 400 synthetic telecom comments, in data order, with their stratified 75/25 split. */
export const CORPUS: readonly Comment[] = data.corpus.text.map((text, i) => ({
  text,
  label: data.corpus.label[i] as 0 | 1,
  kind: data.corpus.kind[i] as CommentKind,
  split: data.corpus.test[i] === 1 ? 'test' : 'train',
}));

/** The eight trained models. */
export const MODELS: Record<ModelKey, Model> = Object.fromEntries(
  Object.entries(data.models).map(([key, m]) => [key, { key: key as ModelKey, ...m }]),
) as Record<ModelKey, Model>;

/** Model keys in the order the generator trains them. */
export const MODEL_KEYS: readonly ModelKey[] = [
  'uni-keep-train', 'uni-keep-all', 'uni-drop-train', 'uni-drop-all',
  'bi-keep-train', 'bi-keep-all', 'bi-drop-train', 'bi-drop-all',
];

/** The 40 new-period comments and the vocabulary drift numbers. */
export const DRIFT: Drift = {
  ...data.drift,
  comments: data.drift.comments.text.map((text, i) => ({
    text,
    label: data.drift.comments.label[i] as 0 | 1,
    p: data.drift.comments.p[i],
  })),
};
