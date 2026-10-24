import { clean } from './tokenize';

/** sklearn's token_pattern `(?u)\b\w\w+\b` on cleaned text: runs of two or more word characters. */
const WORD = /[\p{L}\p{N}_]{2,}/gu;

/**
 * sklearn `build_analyzer()` of `TfidfVectorizer(preprocessor=clean, ngram_range=(1, ngram),
 * stop_words=...)`: clean, tokens by token_pattern, stop words removed, then the unigrams followed
 * by the bigrams (adjacent surviving tokens joined with one space).
 */
export function analyze(
  text: string,
  ngram: 1 | 2,
  stopWords?: ReadonlySet<string>,
): string[] {
  const words = clean(text).match(WORD) ?? [];
  const tokens = stopWords === undefined ? words : words.filter(w => !stopWords.has(w));
  if (ngram === 1) {
    return tokens;
  }
  const terms = tokens.slice();
  for (let i = 0; i + 1 < tokens.length; i += 1) {
    terms.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return terms;
}

/** The vocabulary the documents define: sorted terms (sklearn: code point order, column order). */
export function fitVocab(
  docs: readonly string[],
  ngram: 1 | 2,
  stopWords?: ReadonlySet<string>,
): string[] {
  const seen = new Set<string>();
  for (const doc of docs) {
    for (const term of analyze(doc, ngram, stopWords)) {
      seen.add(term);
    }
  }
  // All terms are Basic Multilingual Plane text, so UTF-16 order is code point order.
  return [...seen].sort();
}

function columns(vocab: readonly string[]): Map<string, number> {
  return new Map(vocab.map((term, j) => [term, j]));
}

/** `CountVectorizer(vocabulary=vocab)` counts: one row per document. */
export function countMatrix(
  docs: readonly string[],
  vocab: readonly string[],
  ngram: 1 | 2,
  stopWords?: ReadonlySet<string>,
): number[][] {
  return countWithOov(docs, vocab, ngram, stopWords).counts;
}

function countWithOov(
  docs: readonly string[],
  vocab: readonly string[],
  ngram: 1 | 2,
  stopWords?: ReadonlySet<string>,
): { counts: number[][]; oov: number[] } {
  const col = columns(vocab);
  const oov: number[] = [];
  const counts = docs.map(doc => {
    const row = new Array<number>(vocab.length).fill(0);
    let missing = 0;
    for (const term of analyze(doc, ngram, stopWords)) {
      const j = col.get(term);
      if (j === undefined) {
        missing += 1;
      } else {
        row[j] += 1;
      }
    }
    oov.push(missing);
    return row;
  });
  return { counts, oov };
}

/** Smoothed IDF of sklearn: ln((1 + N) / (1 + df)) + 1, df = documents that contain the term. */
export function idfOf(
  docs: readonly string[],
  vocab: readonly string[],
  ngram: 1 | 2,
  stopWords?: ReadonlySet<string>,
): number[] {
  const df = new Array<number>(vocab.length).fill(0);
  for (const row of countMatrix(docs, vocab, ngram, stopWords)) {
    row.forEach((c, j) => {
      if (c > 0) {
        df[j] += 1;
      }
    });
  }
  return df.map(d => Math.log((1 + docs.length) / (1 + d)) + 1);
}

/** The Euclidean (L2) norm of a vector. */
export function l2(row: readonly number[]): number {
  let sum = 0;
  for (const v of row) {
    sum += v * v;
  }
  return Math.sqrt(sum);
}

/** A copy of the row with unit L2 norm; the zero vector stays zero. */
export function l2Normalize(row: readonly number[]): number[] {
  const n = l2(row);
  return n === 0 ? row.map(() => 0) : row.map(v => v / n);
}

/**
 * `TfidfVectorizer` fit or transform. Without `vocab` the vocabulary is fitted on `docs`; without
 * `idf` the IDF is computed from `docs` (a fit); with both the documents are only transformed:
 * terms outside the vocabulary are dropped and counted in `oov` (occurrences per document, before
 * the row is normalised over the known terms). Rows are raw count x IDF, L2 normalised.
 */
export function tfidfMatrix(
  docs: readonly string[],
  vocab?: readonly string[],
  idf?: readonly number[],
  ngram: 1 | 2 = 1,
  stopWords?: ReadonlySet<string>,
): { vocab: string[]; idf: number[]; rows: number[][]; oov: number[] } {
  const terms = vocab === undefined ? fitVocab(docs, ngram, stopWords) : [...vocab];
  const weights = idf === undefined ? idfOf(docs, terms, ngram, stopWords) : [...idf];
  const { counts, oov } = countWithOov(docs, terms, ngram, stopWords);
  const rows = counts.map(row => l2Normalize(row.map((c, j) => c * weights[j])));
  return { vocab: terms, idf: weights, rows, oov };
}

/** Cosine similarity A.B / (|A||B|); 0 when either vector is zero (sklearn's value, never NaN). */
export function cosine(a: readonly number[], b: readonly number[]): number {
  const na = l2(a);
  const nb = l2(b);
  if (na === 0 || nb === 0) {
    return 0;
  }
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
  }
  return dot / (na * nb);
}
