import { formatNumber as f, formatPercent as pct } from '../../core/plot/format';
import type { HBar } from '../../core/plot/hbars';
import { metrics, type Confusion } from '../degerlendirme/metrics';
import { BOOK, CORPUS, MODELS, type ModelKey } from '../metin/data';
import { score } from '../metin/score';
import { DEGIL_STOP, tokenize } from '../metin/tokenize';
import { asNegative, corpusCounts, driftRates, explainLean, f2, f3, gapSentence, HATALAR, lean, signed, DRIFT_COMMENT, keyOf, modelOf, NEGATION, NEW_COMMENT, rankTerms, settingsOf } from './calc';
import { duyguAnaliziScenario as scenario, type SentimentParams } from './scenario';

/** Which scene area draws the step. */
export type SentimentKind = 'flow' | 'coef' | 'score' | 'result' | 'vocab' | 'code';

/** Shown instead of a probability when the comment has no analysable token left. */
export const EMPTY_NOTE = 'Boş yorum analiz edilemez.';

/** Shown when no token of the comment is in the vocabulary: the vector is zero and only the intercept speaks. */
export const OOV_NOTE = 'Sözlükte bilinen kelime yok; tahmin yalnız kesişimden.';

/** Contribution bars drawn before the rest is summed into one "other" bar. */
export const MAX_CONTRIB_BARS = 8;

/** One box of the flow strip. */
export interface Stage {
  id: 'yorum' | 'temizle' | 'tfidf' | 'lojistik' | 'etiket';
  label: string;
  active: boolean;
}

/** Steps 1-2: the box-and-arrow strip, the corpus count bars and (step 1) sample comments or (step 2) the book's pipeline line. */
export interface FlowView {
  part: 'task' | 'pipeline';
  stages: Stage[];
  bars: HBar[];
  barMax: number;
  barTitle: string;
  samples: { text: string; label: 'olumlu' | 'olumsuz' }[] | null;
  warning: string | null;
  code: string[] | null;
}

/** Step 3: the strongest terms of both signs, each side sorted by |coefficient|. */
export interface CoefView {
  model: ModelKey;
  pos: HBar[];
  neg: HBar[];
  max: number;
  n: number;
}

/**
 * One token chip of the commented text; `oov` is out of the vocabulary, `dropped` was removed as a stop word,
 * `bigram` is a word pair and `negation` a pair that holds "değil".
 */
export interface ChipView {
  text: string;
  oov: boolean;
  dropped: boolean;
  bigram: boolean;
  negation: boolean;
}

/** One score panel: chips, contribution bars, the z line and the sigmoid point. */
export interface PanelView {
  id: 'main' | 'uni' | 'bi';
  model: ModelKey;
  title: string;
  comment: string;
  chips: ChipView[];
  bars: HBar[];
  barMax: number;
  sum: number;
  intercept: number;
  /** z and p; null for a comment with nothing to analyse. */
  z: number | null;
  p: number | null;
  zText: string;
  pText: string;
  lean: string | null;
  note: string | null;
  /** Extra line under the probability (step 4: the book's model; step 7: the probability with "değil" kept). */
  compare: { label: string; p: string } | null;
  /** Steps 6-7: the accuracy on the negation test comments, as one line. */
  accuracy: string | null;
}

/** Steps 4, 6, 7, 9: one or two panels. */
export interface ScoreView {
  panels: PanelView[];
}

/** One row of the book's classification report. */
export interface ReportRow {
  id: 'olumsuz' | 'olumlu';
  precision: string;
  recall: string;
  f1: string;
  support: number;
}

/** Step 5: the test matrix with its metric row, and the book's 2-comment report. */
export interface ResultView {
  model: ModelKey;
  matrix: Confusion;
  /** Accuracy and the olumsuz class's precision and recall, as text. */
  metrics: { id: 'accuracy' | 'precision' | 'recall'; label: string; value: string }[];
  book: { title: string; testN: number; accuracy: string; rows: ReportRow[]; note: string };
  link: { href: string; text: string };
}

/** One test-only term of step 8; `idf` is the leaky model's IDF as text, null when the chosen vectoriser never saw the term. */
export interface VocabTerm {
  term: string;
  idf: string | null;
}

/** Step 8: the leaky and clean vocabularies, the test-only terms (at most `MAX_VOCAB_CHIPS`) and both accuracies. */
export interface VocabView {
  /** The chosen vectoriser: fitted on all the data (leaky) or on the training part. */
  leaky: boolean;
  model: ModelKey;
  trainSize: number;
  allSize: number;
  testOnlyCount: number;
  terms: VocabTerm[];
  more: number;
  accuracy: { leaky: string; clean: string };
  gap: string;
}

/** One row of step 9's drift strip: the out-of-vocabulary token share of a comment set. */
export interface DriftRow {
  id: 'test' | 'new';
  label: string;
  oov: number;
  tokens: number;
  rate: number;
  rateText: string;
}

/** Step 9: out-of-vocabulary rates of the model's test comments and of the new period. */
export interface DriftView {
  model: ModelKey;
  title: string;
  rows: DriftRow[];
}

/** Step 10: how many bugs are marked (0-4), whether the corrected code shows, the exam note and the links. */
export interface CodeView {
  marked: number;
  fixed: boolean;
  exam: string;
  links: { href: string; text: string }[];
}

/** What a step draws. */
export interface SentimentView {
  kind: SentimentKind;
  stepId: string;
  strip: string;
  flow: FlowView | null;
  coef: CoefView | null;
  score: ScoreView | null;
  result: ResultView | null;
  vocab: VocabView | null;
  drift: DriftView | null;
  code: CodeView | null;
}

/** Test-only term chips drawn before "ve N terim daha". */
export const MAX_VOCAB_CHIPS = 24;

/** The book's exam note (end of the debugging example). */
export const EXAM_NOTE = "'Model çalıştı' ifadesi, modelin güvenilir olduğu anlamına gelmez.";


const pc = (v: number): string => pct(v, 1);

const empty = (kind: SentimentKind, stepId: string, strip = ''): SentimentView => ({
  kind,
  stepId,
  strip,
  flow: null,
  coef: null,
  score: null,
  result: null,
  vocab: null,
  drift: null,
  code: null,
});

// ---- steps 1-2: flow strip ----

const PIPE_LINES = (ngram: 1 | 2): string[] => [
  'duygu_boru_hatti = Pipeline(steps=[',
  '    ("tfidf", TfidfVectorizer(',
  `        ngram_range=(1, ${ngram}), preprocessor=temizle)),`,
  '    ("siniflandirici", LogisticRegression(max_iter=1000)),',
  '])',
  'duygu_boru_hatti.fit(egitim_yorumlari, egitim_etiketleri)',
];

function samples(): FlowView['samples'] {
  const first = (kind: string, label: 0 | 1): string => CORPUS.find((c) => c.kind === kind && c.label === label)?.text ?? '';
  return [
    { text: first('duz', 1), label: 'olumlu' as const },
    { text: first('duz', 0), label: 'olumsuz' as const },
    { text: first('olumsuzlama', 1), label: 'olumlu' as const },
    { text: first('olumsuzlama', 0), label: 'olumsuz' as const },
  ].filter((s) => s.text !== '');
}

function flowView(id: string, p: SentimentParams): SentimentView {
  const c = corpusCounts();
  const step1 = id === 'gorev';
  const ngram = settingsOf(id, p).bigram ? 2 : 1;
  const stages: Stage[] = [
    { id: 'yorum', label: 'yorum', active: step1 },
    { id: 'temizle', label: 'temizle', active: !step1 },
    { id: 'tfidf', label: 'TF-IDF', active: !step1 },
    { id: 'lojistik', label: 'lojistik regresyon', active: !step1 },
    { id: 'etiket', label: 'olumlu / olumsuz', active: step1 },
  ];
  const bar = (key: string, row: number, label: string, value: number, cls: string, split: string): HBar => ({
    id: key,
    row,
    slot: 0,
    cls,
    value,
    text: String(value),
    label,
    attrs: { split, class: cls.replace('is-', ''), count: value },
  });
  const bars: HBar[] = step1
    ? [bar('all-pos', 0, 'olumlu', c.pos, 'is-pos', 'all'), bar('all-neg', 1, 'olumsuz', c.neg, 'is-neg', 'all')]
    : [
        bar('train-pos', 0, 'eğitim · olumlu', c.train[0], 'is-pos', 'train'),
        bar('train-neg', 1, 'eğitim · olumsuz', c.train[1], 'is-neg', 'train'),
        bar('test-pos', 2, 'test · olumlu', c.test[0], 'is-pos is-test', 'test'),
        bar('test-neg', 3, 'test · olumsuz', c.test[1], 'is-neg is-test', 'test'),
      ];
  const nTrain = c.train[0] + c.train[1];
  const nTest = c.test[0] + c.test[1];
  const strip = step1
    ? `külliyat: ${c.all} yorum = ${c.pos} olumlu + ${c.neg} olumsuz\netiket: olumlu = 1 · olumsuz = 0`
    : `katmanlı bölme: ${nTrain} eğitim + ${nTest} test = ${c.all} yorum (%${Math.round((nTrain / c.all) * 100)} / %${Math.round((nTest / c.all) * 100)})\nfit yalnız eğitimde: sözlük ve IDF eğitimden öğrenilir`;
  return {
    ...empty('flow', id, strip),
    flow: {
      part: step1 ? 'task' : 'pipeline',
      stages,
      bars,
      barMax: Math.max(...bars.map((b) => b.value)),
      barTitle: step1 ? 'yorum sayısı' : 'katmanlı bölme',
      samples: step1 ? samples() : null,
      warning: step1 ? 'Duygu etiketi, müşteri kaybı etiketi değildir.' : null,
      code: step1 ? null : PIPE_LINES(ngram),
    },
  };
}

// ---- step 3: coefficient bars ----

/** The term count range of the coefficient bars. */
export const TOP_RANGE = { min: 5, max: 20 };

function coefView(id: string, p: SentimentParams): SentimentView {
  const model = modelOf(id, p);
  const n = Math.max(TOP_RANGE.min, Math.min(TOP_RANGE.max, Math.round(Number.isFinite(p.topN) ? p.topN : 10)));
  const { pos, neg } = rankTerms(model, n);
  const max = Math.max(1e-9, ...pos.map((t) => Math.abs(t.coef)), ...neg.map((t) => Math.abs(t.coef)));
  const bar = (sign: 'pos' | 'neg') => (t: { term: string; coef: number }, row: number): HBar => ({
    id: `${sign}-${t.term}`,
    row,
    slot: 0,
    cls: `is-${sign}`,
    value: Math.abs(t.coef),
    text: signed(t.coef, 2),
    label: t.term,
    attrs: { sign, term: t.term, coef: t.coef },
  });
  const strip = [
    `katsayı > 0: terim yorumu olumluya çeker · katsayı < 0: olumsuza çeker (çubuk uzunluğu = |katsayı|)`,
    `en olumlu: ${pos[0] ? `${pos[0].term} ${signed(pos[0].coef, 2)}` : '-'} · en olumsuz: ${neg[0] ? `${neg[0].term} ${signed(neg[0].coef, 2)}` : '-'} · ${model.vocabSize} terimden ${n} + ${n} gösterilir`,
  ].join('\n');
  return { ...empty('coef', id, strip), coef: { model: model.key, pos: pos.map(bar('pos')), neg: neg.map(bar('neg')), max, n } };
}

// ---- steps 4, 6, 7, 9: score panels ----

/** The comment a score step analyses: the learner's text, else the step's own. */
export function commentOf(id: string, p: SentimentParams): string {
  if (p.text !== null) return p.text;
  if (id === 'bigram' || id === 'degil-tuzagi') return NEGATION.text;
  if (id === 'sozluk-kaymasi') return DRIFT_COMMENT.text;
  return NEW_COMMENT;
}

/** One panel of `text` under `model`. */
export function panelOf(panelId: PanelView['id'], key: ModelKey, title: string, text: string): PanelView {
  const model = MODELS[key];
  const sc = score(model, text);
  const droppedWords = model.dropDegil ? tokenize(text, DEGIL_STOP).dropped : [];
  const inVocab = new Set(sc.terms.map((t) => t.term));
  const chips: ChipView[] = [
    ...sc.tokens.map((t) => ({ text: t, oov: !inVocab.has(t), dropped: false, bigram: t.includes(' '), negation: t.includes(' ') && t.split(' ').includes('değil') })),
    ...droppedWords.map((t) => ({ text: t, oov: false, dropped: true, bigram: false, negation: false })),
  ];
  const nothing = sc.tokens.length === 0;
  const sorted = [...sc.terms].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const shown = sorted.slice(0, MAX_CONTRIB_BARS);
  const rest = sorted.slice(MAX_CONTRIB_BARS);
  const bar = (id: string, label: string, v: number, extra: Record<string, string | number>): HBar => ({
    id,
    row: 0,
    slot: 0,
    cls: v < 0 ? 'is-neg' : 'is-pos',
    value: Math.abs(v),
    text: signed(v, 3),
    label,
    attrs: { sign: v < 0 ? 'neg' : 'pos', contribution: v, ...extra },
  });
  const bars = shown.map((t, i) => ({ ...bar(`t-${t.term}`, t.term, t.contribution, { term: t.term, weight: t.weight, coef: t.coef }), row: i }));
  if (rest.length > 0) {
    const sum = rest.reduce((s, t) => s + t.contribution, 0);
    bars.push({ ...bar('t-diger', `${rest.length} terim daha`, sum, { term: '' }), row: bars.length });
  }
  const sum = sc.terms.reduce((s, t) => s + t.contribution, 0);
  const allOov = !nothing && sc.terms.length === 0;
  const notes = nothing ? EMPTY_NOTE : allOov ? OOV_NOTE : null;
  return {
    id: panelId,
    model: key,
    title,
    comment: text,
    chips,
    bars,
    barMax: Math.max(1e-9, ...bars.map((b) => b.value)),
    sum,
    intercept: model.intercept,
    z: nothing ? null : sc.z,
    p: nothing ? null : sc.p,
    zText: nothing ? '' : `z = Σ katkı + b = ${f3(sum)} ${model.intercept < 0 ? '−' : '+'} ${f3(Math.abs(model.intercept))} = ${f3(sc.z)}`,
    pText: nothing ? '' : f3(sc.p),
    lean: nothing ? null : lean(sc.p),
    note: notes,
    compare: null,
    accuracy: null,
  };
}

const modelName = (key: ModelKey): string => (MODELS[key].ngram === 2 ? 'unigram + bigram' : 'unigram') + (MODELS[key].dropDegil ? ', "değil" süzülür' : '');

/** The negation-subset accuracy line of a panel; with "değil" dropped it also names the accuracy without the drop. */
function negationLine(key: ModelKey): string {
  const m = MODELS[key];
  const base = `Olumsuzlama içeren ${m.negN} test yorumunda doğruluk ${pc(m.negAccuracy)}`;
  if (!m.dropDegil) return base;
  const kept = MODELS[key.replace('-drop-', '-keep-') as ModelKey];
  return `${base} (süzülmeden ${pc(kept.negAccuracy)})`;
}

/** Step 9's drift strip: out-of-vocabulary token shares under the page's model. */
function driftView(key: ModelKey): DriftView {
  const r = driftRates(key);
  const row = (id: DriftRow['id'], label: string, v: { oov: number; tokens: number; rate: number }): DriftRow => ({
    id,
    label,
    oov: v.oov,
    tokens: v.tokens,
    rate: v.rate,
    rateText: pc(v.rate),
  });
  return {
    model: key,
    title: 'Sözlük dışı token oranı',
    rows: [row('test', 'eğitim dönemi · test yorumları', r.test), row('new', 'yeni dönem yorumları', r.new)],
  };
}

function scoreView(id: string, p: SentimentParams): SentimentView {
  const text = commentOf(id, p);
  const s = settingsOf(id, p);
  let panels: PanelView[];
  if (id === 'bigram') {
    const k = (bigram: boolean): ModelKey => keyOf({ ...s, bigram });
    panels = [panelOf('uni', k(false), modelName(k(false)), text), panelOf('bi', k(true), modelName(k(true)), text)];
    panels[0].accuracy = negationLine(k(false));
    panels[1].accuracy = negationLine(k(true));
  } else {
    const key = keyOf(s);
    const main = panelOf('main', key, modelName(key), text);
    if (id === 'yorum-skor') {
      const book = score(BOOK.kod04.model, text);
      // both lines read the step's own comment; a learner's text gets neither
      const own = p.text === null && main.p !== null;
      main.compare = own ? { label: `Kitabın ${BOOK.kod04.docs.length} yorumluk modeli`, p: f3(book.p) } : null;
      if (own && main.note === null) main.note = explainLean(MODELS[key], text);
    } else if (id === 'degil-tuzagi') {
      main.accuracy = negationLine(key);
      if (s.degilStop && main.p !== null) {
        main.compare = { label: '"değil" süzülmeden', p: f3(score(MODELS[keyOf({ ...s, degilStop: false })], text).p) };
      }
    }
    panels = [main];
  }
  const lines = panels.flatMap((pn) =>
    pn.p === null || pn.z === null ? [pn.note ?? EMPTY_NOTE] : [`p = 1 / (1 + e^−z) = 1 / (1 + e^${f3(-pn.z)}) = ${pn.pText}`],
  );
  const strip = panels.length > 1 ? panels.map((pn, i) => `${i === 0 ? 'unigram' : 'bigram'}: ${lines[i]}`).join('\n') : lines.join('\n');
  return { ...empty('score', id, strip), score: { panels }, drift: id === 'sozluk-kaymasi' ? driftView(keyOf(s)) : null };
}

// ---- step 8: vocabulary strip ----

function vocabView(id: string, p: SentimentParams): SentimentView {
  const s = settingsOf(id, p);
  const leakyKey = keyOf({ ...s, leaky: true });
  const cleanKey = keyOf({ ...s, leaky: false });
  const all = MODELS[leakyKey];
  const train = MODELS[cleanKey];
  const terms: VocabTerm[] = all.testOnly.slice(0, MAX_VOCAB_CHIPS).map((term) => ({
    term,
    idf: s.leaky ? f2(all.idf[all.vocab.indexOf(term)]) : null,
  }));
  const gap = gapSentence(all.accuracy, train.accuracy);
  const strip = [
    `sözlük: eğitim ${train.vocabSize} terim · tüm veri ${all.vocabSize} terim = ${train.vocabSize} + ${all.testOnly.length} yalnız testte`,
    `test doğruluğu: sızıntılı ${pc(all.accuracy)} · sızıntısız ${pc(train.accuracy)}`,
  ].join('\n');
  return {
    ...empty('vocab', id, strip),
    vocab: {
      leaky: s.leaky,
      model: s.leaky ? leakyKey : cleanKey,
      trainSize: train.vocabSize,
      allSize: all.vocabSize,
      testOnlyCount: all.testOnly.length,
      terms,
      more: Math.max(0, all.testOnly.length - terms.length),
      accuracy: { leaky: pc(all.accuracy), clean: pc(train.accuracy) },
      gap,
    },
  };
}

// ---- step 10: debugging code ----

/** Bugs marked at the sweep position `bug` (0-4); the sweep value 5 or the Lab switch brings the corrected code. */
function codeView(id: string, p: SentimentParams): SentimentView {
  const bug = Number.isFinite(p.bug) ? Math.trunc(p.bug) : 0;
  const marked = Math.max(0, Math.min(HATALAR.length, bug));
  const fixed = p.fixed || bug > HATALAR.length;
  const strip = fixed
    ? 'düzeltilmiş: liste · yalnız anlamlı belgelerle fit_transform · geçerli satır · doğrulanmış stop-word listesi'
    : `işaretlenen hata: ${marked} / ${HATALAR.length}`;
  return {
    ...empty('code', id, strip),
    code: {
      marked,
      fixed,
      exam: EXAM_NOTE,
      links: [
        { href: '../tfidf-kosinus/', text: 'TF-IDF ve kosinüs benzerliği' },
        { href: '../smote-sizinti/', text: 'Bölüm 11: SMOTE sızıntısı ve PR-AUC' },
      ],
    },
  };
}

// ---- step 5: test result ----

function resultView(id: string, p: SentimentParams): SentimentView {
  const model = modelOf(id, p);
  const m = model.matrix;
  const n = m.tn + m.fp + m.fn + m.tp;
  const mNeg = metrics(asNegative(m));
  const acc = metrics(m).accuracy ?? 0;
  const k4 = BOOK.kod04;
  const rows: ReportRow[] = (['0', '1'] as const).map((c) => ({
    id: c === '0' ? 'olumsuz' : 'olumlu',
    precision: f2(k4.report[c].precision),
    recall: f2(k4.report[c].recall),
    f1: f2(k4.report[c]['f1-score']),
    support: k4.report[c].support,
  }));
  const strip = [
    `doğruluk = (${m.tn} + ${m.tp}) / ${n} = ${pct(acc, 1)}`,
    `olumsuz sınıf: kesinlik = ${m.tn} / (${m.tn} + ${m.fn}) = ${pct(mNeg.precision ?? 0, 1)} · duyarlılık = ${m.tn} / (${m.tn} + ${m.fp}) = ${pct(mNeg.recall ?? 0, 1)}`,
  ].join('\n');
  return {
    ...empty('result', id, strip),
    result: {
      model: model.key,
      matrix: m,
      metrics: [
        { id: 'accuracy', label: 'doğruluk', value: pct(acc, 1) },
        { id: 'precision', label: 'olumsuz kesinlik', value: pct(mNeg.precision ?? 0, 1) },
        { id: 'recall', label: 'olumsuz duyarlılık', value: pct(mNeg.recall ?? 0, 1) },
      ],
      book: {
        title: `Kitabın ${k4.docs.length} yorumluk örneği`,
        testN: k4.testIdx.length,
        accuracy: f2(k4.accuracy),
        rows,
        note: `Test ${k4.testIdx.length} yorum, doğruluk ${f2(k4.accuracy)}: ${k4.testIdx.length} yorumla ölçülen başarı ölçüm değildir.`,
      },
      link: { href: '../dengesiz-veri/', text: 'Bölüm 11: dengesiz veri' },
    },
  };
}

// ---- derivation ----

/** What a step draws under the page parameters (`deriveSentimentView`); NaN and Infinity never reach the scene. */
export function deriveSentimentView(index: number, p: SentimentParams): SentimentView {
  const id = scenario.steps[index].id;
  switch (id) {
    case 'gorev':
    case 'boru-hatti':
      return flowView(id, p);
    case 'kelime-agirlik':
      return coefView(id, p);
    case 'yorum-skor':
    case 'bigram':
    case 'degil-tuzagi':
    case 'sozluk-kaymasi':
      return scoreView(id, p);
    case 'test-sonuc':
      return resultView(id, p);
    case 'sizinti':
      return vocabView(id, p);
    case 'hata-ayiklama':
      return codeView(id, p);
    default:
      throw new RangeError(`no view for step "${id}"`);
  }
}
