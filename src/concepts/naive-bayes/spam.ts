import { spam } from './data';

export interface Corpus {
  /** Training e-mails per class: [normal, spam]. */
  docs: [number, number];
  /** Word occurrences per class: [normal, spam]. */
  counts: Record<string, [number, number]>;
}

/** Prior P(spam) of the training set. */
export const PRIOR_SPAM = 0.4;

/** Vocabulary size V. */
const V = spam.words.length;

const corpus: Corpus = {
  docs: spam.docs,
  counts: Object.fromEntries(spam.words.map((x) => [x.w, x.n])),
};

function classTotal(c: Corpus, cls: 0 | 1): number {
  let s = 0;
  for (const n of Object.values(c.counts)) s += n[cls];
  return s;
}

function lik(c: Corpus, word: string, cls: 0 | 1, alpha: 0 | 1, total: number): number {
  const n = c.counts[word]?.[cls] ?? 0;
  const den = total + alpha * V;
  return den === 0 ? 0 : (n + alpha) / den;
}

/** P(word | class) = (n + α) / (N_c + α·V). */
export function likelihood(word: string, cls: 0 | 1, alpha: 0 | 1): number {
  return lik(corpus, word, cls, alpha, classTotal(corpus, cls));
}

/** Trail including the prior: [P(spam), P(spam|w1), P(spam|w1,w2), …]; null once both classes hit zero. */
export function trailWith(c: Corpus, words: string[], alpha: 0 | 1): (number | null)[] {
  const t0 = classTotal(c, 0);
  const t1 = classTotal(c, 1);
  let normal = 1 - PRIOR_SPAM;
  let spamScore = PRIOR_SPAM;
  const out: (number | null)[] = [PRIOR_SPAM];
  for (const w of words) {
    normal *= lik(c, w, 0, alpha, t0);
    spamScore *= lik(c, w, 1, alpha, t1);
    const sum = normal + spamScore;
    out.push(sum === 0 ? null : spamScore / sum);
  }
  return out;
}

export function trail(words: string[], alpha: 0 | 1): (number | null)[] {
  return trailWith(corpus, words, alpha);
}
