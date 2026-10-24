import { clean } from '../metin/tokenize';
import { cosine, countMatrix, fitVocab, idfOf, l2, l2Normalize, tfidfMatrix } from '../metin/vectorize';

/** Everything the table steps show about a set of documents: counts, df, IDF, raw weights, norms, TF-IDF. */
export interface DocTable {
  vocab: string[];
  bow: number[][];
  df: number[];
  idf: number[];
  /** count x IDF before the L2 step. */
  raw: number[][];
  /** L2 norm of each raw row. */
  norms: number[];
  tfidf: number[][];
}

/** The worked table of `docs` (the book's kod02 for the default documents), computed by the shared vectoriser. */
export function docTable(docs: readonly string[]): DocTable {
  const vocab = fitVocab(docs, 1);
  const bow = countMatrix(docs, vocab, 1);
  const idf = idfOf(docs, vocab, 1);
  const df = vocab.map((_, j) => bow.filter((row) => row[j] > 0).length);
  const raw = bow.map((row) => row.map((c, j) => c * idf[j]));
  return { vocab, bow, df, idf, raw, norms: raw.map(l2), tfidf: raw.map(l2Normalize) };
}

/** Column indexes of the non-zero cells of a row, in column order. */
export function nonZero(row: readonly number[]): number[] {
  const out: number[] = [];
  row.forEach((v, j) => {
    if (v > 0) out.push(j);
  });
  return out;
}

/** Indexes of the documents whose count of `term` is above zero. */
export function docsWith(t: DocTable, term: string): number[] {
  const j = t.vocab.indexOf(term);
  return j < 0 ? [] : t.bow.flatMap((row, i) => (row[j] > 0 ? [i] : []));
}

/** The term of `row` (default 0) with the largest TF-IDF weight other than `term`; ties go to the first column. */
export function contrastTerm(t: DocTable, term: string, row = 0): string {
  let best = -1;
  t.tfidf[row]?.forEach((v, j) => {
    if (t.vocab[j] !== term && v > 0 && (best < 0 || v > t.tfidf[row][best])) best = j;
  });
  return best < 0 ? '' : t.vocab[best];
}

/** Cosine scores of one query document against every document, with the terms each pair shares. */
export interface Similarity {
  docs: string[];
  vocab: string[];
  idf: number[];
  rows: number[][];
  /** Cosine of the query row with each row (the query itself gives 1, or 0 for an empty row). */
  scores: number[];
  /** Document indexes from the highest score to the lowest; ties keep document order. */
  order: number[];
  /** Terms the query shares with each document (the query's own terms for itself). */
  common: string[][];
  query: number;
}

/** TF-IDF of `docs` fitted together and the cosine of document `query` with each one. */
export function similarity(docs: readonly string[], query: number): Similarity {
  const m = tfidfMatrix(docs);
  const q = Math.min(Math.max(0, Math.trunc(query)), Math.max(0, docs.length - 1));
  const scores = m.rows.map((row) => cosine(m.rows[q] ?? [], row));
  const order = scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a] || a - b);
  const common = m.rows.map((row) => m.vocab.filter((_, j) => (m.rows[q]?.[j] ?? 0) > 0 && row[j] > 0));
  return { docs: [...docs], vocab: m.vocab, idf: m.idf, rows: m.rows, scores, order, common, query: q };
}

/** The weight of `term` in a row (0 when the term is not in the vocabulary). */
export function weightOf(vocab: readonly string[], row: readonly number[], term: string): number {
  const j = vocab.indexOf(term);
  return j < 0 ? 0 : row[j];
}

/**
 * The two terms of the vector plane. A chosen pair wins; otherwise x is the heaviest term the query shares with
 * its nearest other document (the query's heaviest term when they share none) and y is the heaviest remaining
 * term of that nearest document ("unit" plane) or of the query itself ("raw" plane, step 9).
 */
export function planeTerms(s: Similarity, chosen: readonly [string, string], from: 'neighbour' | 'query'): [string, string] {
  if (chosen[0] !== '' && chosen[1] !== '') return [chosen[0], chosen[1]];
  const q = s.rows[s.query] ?? [];
  const nearest = s.order.find((i) => i !== s.query);
  const heaviest = (row: readonly number[], skip: string, among?: readonly string[]): string => {
    let best = -1;
    row.forEach((v, j) => {
      const term = s.vocab[j];
      if (term === skip || v <= 0 || (among !== undefined && !among.includes(term))) return;
      if (best < 0 || v > row[best]) best = j;
    });
    return best < 0 ? '' : s.vocab[best];
  };
  const shared = nearest === undefined ? [] : s.common[nearest];
  const x = heaviest(q, '', shared.length > 0 ? shared : undefined);
  if (from === 'query' || nearest === undefined) return [x, heaviest(q, x)];
  return [x, heaviest(s.rows[nearest], x, s.vocab.filter((t) => weightOf(s.vocab, q, t) === 0))];
}

/** Step 9: the query and the query written twice, in raw counts and in TF-IDF. */
export interface Doubled {
  vocab: string[];
  counts: [number[], number[]];
  cos: number;
  /** Euclidean distance of the raw count vectors: the query with itself, and with its doubled form. */
  euclidSelf: number;
  euclid: number;
}

/** The query document and the same text written twice, in the vocabulary and IDF fitted on `docs`. */
export function doubledQuery(docs: readonly string[], query: number): Doubled {
  const m = tfidfMatrix(docs);
  const text = docs[Math.min(Math.max(0, Math.trunc(query)), Math.max(0, docs.length - 1))] ?? '';
  const pair = [text, `${text} ${text}`];
  const counts = countMatrix(pair, m.vocab, 1) as [number[], number[]];
  const rows = tfidfMatrix(pair, m.vocab, m.idf).rows;
  const dist = (a: readonly number[], b: readonly number[]): number => l2(a.map((v, j) => v - b[j]));
  return {
    vocab: m.vocab,
    counts,
    cos: cosine(rows[0], rows[1]),
    euclidSelf: dist(counts[0], counts[0]),
    euclid: dist(counts[0], counts[1]),
  };
}

/** Step 10 card (a): two documents with a vectoriser each, column by column, against one shared vectoriser. */
export interface SeparateVocab {
  pairs: [string, string][];
  /** Cosine of the two rows read column by column (a meaningless number) and of the shared-vocabulary rows. */
  aligned: number;
  shared: number;
}

/** Separate vectorisers on `a` and `b`: column i of one is rarely the term of column i of the other. */
export function separateVocab(a: string, b: string): SeparateVocab {
  const ma = tfidfMatrix([a]);
  const mb = tfidfMatrix([b]);
  const n = Math.max(ma.vocab.length, mb.vocab.length);
  const pairs = Array.from({ length: n }, (_, i): [string, string] => [ma.vocab[i] ?? '', mb.vocab[i] ?? '']);
  const pad = (row: readonly number[]): number[] => Array.from({ length: n }, (_, i) => row[i] ?? 0);
  const both = tfidfMatrix([a, b]);
  return { pairs, aligned: cosine(pad(ma.rows[0]), pad(mb.rows[0])), shared: cosine(both.rows[0], both.rows[1]) };
}

/** The book's cleaning of a string, exported for the raw-line display (characters the cleaning drops or lowers). */
export function charState(ch: string): 'keep' | 'lower' | 'gone' {
  const c = clean(ch);
  if (c === ch) return 'keep';
  return /\s/.test(c) && !/\s/.test(ch) ? 'gone' : 'lower';
}
