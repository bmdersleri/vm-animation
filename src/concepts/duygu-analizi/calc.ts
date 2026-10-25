import { formatNumber as f } from '../../core/plot/format';
import { BOOK, CORPUS, DRIFT, MODELS, type Model, type ModelKey } from '../metin/data';
import { score } from '../metin/score';

/** The page's model settings; a `null` setting means "the step's own model" (Ders), a boolean is a Lab choice. */
export interface ModelChoice {
  bigram: boolean | null;
  degilStop: boolean | null;
  leaky: boolean | null;
}

/** A resolved model setting. */
export interface Settings {
  bigram: boolean;
  degilStop: boolean;
  leaky: boolean;
}

/** Ders models of the ten steps, by step id (the page's story; Lab choices replace single settings). */
const STEP_SETTINGS: Record<string, Settings> = {
  gorev: { bigram: false, degilStop: false, leaky: false },
  'boru-hatti': { bigram: false, degilStop: false, leaky: false },
  'kelime-agirlik': { bigram: false, degilStop: false, leaky: false },
  'yorum-skor': { bigram: false, degilStop: false, leaky: false },
  'test-sonuc': { bigram: false, degilStop: false, leaky: false },
  bigram: { bigram: true, degilStop: false, leaky: false },
  'degil-tuzagi': { bigram: true, degilStop: true, leaky: false },
  sizinti: { bigram: false, degilStop: false, leaky: true },
  'sozluk-kaymasi': { bigram: false, degilStop: false, leaky: false },
  'hata-ayiklama': { bigram: false, degilStop: false, leaky: false },
};

/** Model key of three settings. */
export function keyOf(s: Settings): ModelKey {
  return `${s.bigram ? 'bi' : 'uni'}-${s.degilStop ? 'drop' : 'keep'}-${s.leaky ? 'all' : 'train'}`;
}

/** The step's model settings with the Lab choices laid over the step's own. */
export function settingsOf(stepId: string, p: ModelChoice): Settings {
  const base = STEP_SETTINGS[stepId];
  if (!base) throw new RangeError(`no model settings for step "${stepId}"`);
  return {
    bigram: p.bigram ?? base.bigram,
    degilStop: p.degilStop ?? base.degilStop,
    // the leaky switch belongs to step 8 alone; every other step trains the vectoriser on the training part
    leaky: stepId === 'sizinti' ? (p.leaky ?? base.leaky) : false,
  };
}

/** The trained model of a step under the Lab choices. */
export function modelOf(stepId: string, p: ModelChoice): Model {
  return MODELS[keyOf(settingsOf(stepId, p))];
}

/** A vocabulary term with its coefficient. */
export interface CoefTerm {
  term: string;
  coef: number;
}

/** The `n` most positive and the `n` most negative terms of a model, each side by size, largest first. */
export function rankTerms(model: Model, n: number): { pos: CoefTerm[]; neg: CoefTerm[] } {
  const all: CoefTerm[] = model.vocab.map((term, j) => ({ term, coef: model.coef[j] }));
  const by = (a: CoefTerm, b: CoefTerm): number => Math.abs(b.coef) - Math.abs(a.coef) || a.term.localeCompare(b.term, 'tr');
  return {
    pos: all.filter((t) => t.coef > 0).sort(by).slice(0, n),
    neg: all.filter((t) => t.coef < 0).sort(by).slice(0, n),
  };
}

/** The book's new comment (code 04), scored by step 4. */
export const NEW_COMMENT = BOOK.kod04.newComment;

/** The model keys the negation story compares. */
const UNI: ModelKey = 'uni-keep-train';
const BI: ModelKey = 'bi-keep-train';
const BI_DROP: ModelKey = 'bi-drop-train';

/**
 * The negation example of steps 6-7: the test comment of kind "olumsuzlama" and label olumlu whose unigram
 * and "değil"-dropped bigram probabilities lean olumsuz (below 0,5) while the bigram model that keeps
 * "değil" leans olumlu, with the widest margin above 0,5.
 */
function pickNegation(): { index: number; text: string } {
  let best = { index: -1, margin: -Infinity };
  CORPUS.forEach((c, index) => {
    if (c.split !== 'test' || c.kind !== 'olumsuzlama' || c.label !== 1) return;
    const keep = score(MODELS[BI], c.text).p;
    const ok = score(MODELS[UNI], c.text).p < 0.5 && score(MODELS[BI_DROP], c.text).p < 0.5 && keep > 0.5;
    if (ok && keep - 0.5 > best.margin) best = { index, margin: keep - 0.5 };
  });
  if (best.index < 0) throw new RangeError('corpus has no negation example for steps 6-7');
  return { index: best.index, text: CORPUS[best.index].text };
}

/** Steps 6-7's comment. */
export const NEGATION = pickNegation();

/** The bigram of `text` that contains "değil", with its coefficient in the model that keeps it (null when the vocabulary has none). */
export function degilBigram(text: string): CoefTerm | null {
  const t = score(MODELS[BI], text).terms.find((x) => x.term.includes(' değil'));
  return t ? { term: t.term, coef: t.coef } : null;
}

/** Step 9's comment: the first new-period comment whose tokens are all out of vocabulary. */
export const DRIFT_COMMENT = DRIFT.comments[DRIFT.allNew[0]];

/** The four mistakes of the book's `DuyguHata` code (step 10), in the order they are marked. */
export const HATALAR: readonly string[] = [
  'liste yerine demet',
  'boş metinle fit_transform',
  'olmayan satıra erişim',
  'doğrulanmamış stop-word listesi',
];

/** Positive-class view of a confusion matrix: swaps the classes so `metrics` reads olumsuz as positive. */
export function asNegative(m: { tn: number; fp: number; fn: number; tp: number }): { tn: number; fp: number; fn: number; tp: number } {
  return { tn: m.tp, fp: m.fn, fn: m.fp, tp: m.tn };
}

/** Counts of the corpus: label x split. */
export function corpusCounts(): { all: number; pos: number; neg: number; train: [number, number]; test: [number, number] } {
  const n = (label: 0 | 1, split?: 'train' | 'test'): number => CORPUS.filter((c) => c.label === label && (!split || c.split === split)).length;
  return {
    all: CORPUS.length,
    pos: n(1),
    neg: n(0),
    train: [n(1, 'train'), n(0, 'train')],
    test: [n(1, 'test'), n(0, 'test')],
  };
}

/** Number formats shared by the page's texts. */
export const f2 = (v: number): string => f(v, 2);
export const f3 = (v: number): string => f(v, 3);

/** "+1,78" / "−1,47": the value with an explicit sign. */
export const signed = (v: number, d: number): string => `${v < 0 ? '−' : '+'}${f(Math.abs(v), d)}`;

/** Which way a probability leans, in the page's one wording. */
export const lean = (p: number): string => (p > 0.5 ? 'olumlu yönde eğilimli' : p < 0.5 ? 'olumsuz yönde eğilimli' : 'tam ortada');

const quoted = (xs: string[]): string => (xs.length < 2 ? xs.map((x) => `"${x}"`).join('') : `${xs.slice(0, -1).map((x) => `"${x}"`).join(', ')} ve "${xs[xs.length - 1]}"`);

/**
 * Step 4's explanation of a lean: the comment's out-of-vocabulary words (the model never saw them, so they
 * are ignored) and its two strongest negative terms with their contributions; null when there is neither.
 */
export function explainLean(model: Model, text: string): string | null {
  const sc = score(model, text);
  const oov = [...new Set(sc.oov)].slice(0, 2);
  const neg = sc.terms.filter((t) => t.contribution < 0).sort((a, b) => a.contribution - b.contribution).slice(0, 2);
  const parts: string[] = [];
  if (oov.length > 0) parts.push(`Model ${quoted(oov)} ${oov.length > 1 ? 'kelimelerini' : 'kelimesini'} hiç görmedi (sözlük dışı), bu yüzden yok sayar`);
  if (neg.length > 0) parts.push(`${neg.map((t) => `"${t.term}" (${signed(t.contribution, 3)})`).join(' ve ')} olumsuza çeker`);
  return parts.length > 0 ? `${parts.join('; ')}.` : null;
}

/** Out-of-vocabulary token count, token count and rate of a set of comments under one model. */
export interface OovRate {
  oov: number;
  tokens: number;
  rate: number;
}

function oovRate(key: ModelKey, texts: readonly string[]): OovRate {
  const model = MODELS[key];
  let oov = 0;
  let tokens = 0;
  for (const text of texts) {
    const sc = score(model, text);
    oov += sc.oov.length;
    tokens += sc.tokens.length;
  }
  return { oov, tokens, rate: tokens > 0 ? oov / tokens : 0 };
}

/** Step 9: the model's out-of-vocabulary rate on its own test comments and on the new-period comments. */
export function driftRates(key: ModelKey): { test: OovRate; new: OovRate } {
  return {
    test: oovRate(key, CORPUS.filter((c) => c.split === 'test').map((c) => c.text)),
    new: oovRate(key, DRIFT.comments.map((c) => c.text)),
  };
}

/** Step 8's sentence on the accuracy gap between the leaky and the clean vectoriser (a gap up to 2 points is "small"). */
export function gapSentence(leakyAccuracy: number, cleanAccuracy: number): string {
  const gap = leakyAccuracy - cleanAccuracy;
  return Math.abs(gap) <= 0.02
    ? 'Fark küçük; ama test artık görülmemiş veri değil.'
    : `Fark ${f(Math.abs(gap) * 100, 1)} puan; test artık görülmemiş veri değil.`;
}
