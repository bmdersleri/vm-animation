import { formatNumber as f, formatPercent as pct } from '../../core/plot/format';
import type { HBar } from '../../core/plot/hbars';
import { classify, type ScoredSample } from '../degerlendirme/curves';
import { metrics, type Confusion } from '../degerlendirme/metrics';
import { UNDEFINED_TEXT } from '../degerlendirme/ui';
import { BOOK_NUMBERS, COMPARE, CUSTOMERS, CV, LEAK_EXAMPLE } from '../dengesiz/data';
import { ALL_COUNTS, DEFAULT_SEED, leakFor, matchCaught, positiveRate, staircase, TRAIN_COUNTS } from './model';
import { smoteSizintiScenario as scenario, type LeakParams } from './scenario';

/** Which scene area draws the step. */
export type LeakKind = 'flow' | 'pr' | 'folds' | 'code' | 'cards';

/** The two orders of the split and SMOTE. */
export type Order = LeakParams['order'];

/** A customer point in the original units. */
export interface Spot {
  tenure: number;
  charge: number;
}

/** Step 3: the synthetic test point and its two parents. */
export interface ExampleView {
  point: Spot;
  parents: [Spot, Spot];
}

/** The flow area: the rows of boxes, the count bars of step 2, or the example scatter of step 3. */
export interface FlowView {
  part: 'rows' | 'counts' | 'example';
  /** Rows drawn (both in step 1, the chosen one in step 2, none in step 3). */
  rows: Order[];
  /** The order the Lab chose; the scene emphasises its row. */
  selected: Order;
  bars: HBar[];
  /** Titles of the three bar groups (`row` 0-2 of the bars). */
  barTitles: string[];
  /** Share of churners in the test part, formatted (step 2). */
  testRate: string | null;
  example: ExampleView | null;
  /** Said instead of the example when there is none to draw. */
  note: string | null;
}

/** One PR curve of the PR area. `pin` is the label written beside the curve. */
export interface PrSeries {
  id: string;
  cls: string;
  pts: [number, number][];
  pin: string;
  selected: boolean;
}

/** One dashed floor line (the positive rate). */
export interface PrBaseline {
  y: number;
  label: string;
  cls: string;
}

/** One large score of step 5. */
export interface BigScore {
  id: string;
  label: string;
  value: string;
  cls: string;
}

/** Step 8: the confusion matrix and the lines written beside the curve. */
export interface PrPanel {
  matrix: Confusion;
  /** "27 / 37 yakalandı · kesinlik …" and the line naming the unweighted model's threshold at the same recall. */
  lines: string[];
}

/** The PR area: curves, floors, the large scores of step 5 and the step-8 marker. */
export interface PrView {
  series: PrSeries[];
  baselines: PrBaseline[];
  big: BigScore[] | null;
  /** Small note under the large scores. */
  note: string | null;
  marker: { x: number; y: number; label: string } | null;
  panel: PrPanel | null;
}

/** One cross-validation fold of step 6 (counts as drawn, the score formatted). */
export interface FoldRow {
  fold: number;
  trainNeg: number;
  trainPos: number;
  smoteNeg: number;
  smotePos: number;
  valNeg: number;
  valPos: number;
  ap: string;
}

/** Step 6: the five fold rows, the selected fold (0 = none), the mean and the book's lines. */
export interface FoldsView {
  rows: FoldRow[];
  selected: number;
  mean: string;
  book: string;
}

/** Step 9: how many bugs are marked (0-5) and whether the corrected code is shown. */
export interface CodeView {
  bug: number;
  fixed: boolean;
}

/** Everything a scene draws for one (step, parameters) pair. */
export interface LeakView {
  kind: LeakKind;
  stepId: string;
  strip: string;
  flow: FlowView | null;
  pr: PrView | null;
  folds: FoldsView | null;
  code: CodeView | null;
}

const ORDERS: Order[] = ['yanlis', 'dogru'];
const MODELS = ['base', 'smote', 'weighted'] as const;

/** Names of the three step-7 models. */
export const MODEL_NAMES: Record<LeakParams['model'], string> = {
  base: 'ağırlıksız',
  smote: 'SMOTE',
  weighted: 'ağırlıklı',
};

const ap = (v: number): string => f(v, 3);

const bar = (id: string, row: number, slot: number, cls: string, value: number, text: string, label: string): HBar => ({
  id,
  row,
  slot,
  cls,
  value,
  text,
  label,
});

const emptyFlow = (part: FlowView['part'], p: LeakParams): FlowView => ({
  part,
  rows: [...ORDERS],
  selected: p.order,
  bars: [],
  barTitles: [],
  testRate: null,
  example: null,
  note: null,
});

/** The count bars and strip of step 2 for the chosen order. */
function countsView(p: LeakParams): { flow: FlowView; strip: string } {
  const run = leakFor(p.seed);
  const flow = { ...emptyFlow('counts', p), rows: [p.order] };
  if (p.order === 'yanlis') {
    const { n, pos, synthPos } = run.leaky;
    const neg = n - pos;
    flow.bars = [
      bar('a-neg', 0, 0, 'bar-neg', ALL_COUNTS.neg, String(ALL_COUNTS.neg), 'kalan'),
      bar('a-pos', 0, 1, 'bar-pos', ALL_COUNTS.pos, String(ALL_COUNTS.pos), 'ayrılan'),
      bar('b-neg', 1, 0, 'bar-neg', ALL_COUNTS.neg, String(ALL_COUNTS.neg), 'kalan'),
      bar('b-pos', 1, 1, 'bar-pos', ALL_COUNTS.neg, String(ALL_COUNTS.neg), 'ayrılan'),
      bar('c-neg', 2, 0, 'bar-neg', neg, String(neg), 'kalan'),
      bar('c-synth', 2, 1, 'bar-synth', pos, `${pos} (${synthPos} sentetik)`, 'ayrılan'),
      bar('c-real', 2, 1, 'bar-real', pos - synthPos, '', ''),
    ];
    flow.barTitles = ['önce', 'SMOTE sonrası', 'test'];
    flow.testRate = pct(pos / n, 1);
    const strip = [
      `önce: ${ALL_COUNTS.neg} | ${ALL_COUNTS.pos} → SMOTE sonrası: ${ALL_COUNTS.neg} | ${ALL_COUNTS.neg} → test: kalan ${neg} | ayrılan ${pos} (${synthPos} sentetik)`,
      `test ayrılan oranı = ${flow.testRate}`,
    ].join('\n');
    return { flow, strip };
  }
  const honest = run.honest.scores;
  const pos = honest.filter((s) => s.actual === 1).length;
  const neg = honest.length - pos;
  flow.bars = [
    bar('a-neg', 0, 0, 'bar-neg', TRAIN_COUNTS.neg, String(TRAIN_COUNTS.neg), 'kalan'),
    bar('a-pos', 0, 1, 'bar-pos', TRAIN_COUNTS.pos, String(TRAIN_COUNTS.pos), 'ayrılan'),
    bar('b-neg', 1, 0, 'bar-neg', TRAIN_COUNTS.neg, String(TRAIN_COUNTS.neg), 'kalan'),
    bar('b-pos', 1, 1, 'bar-pos', TRAIN_COUNTS.neg, String(TRAIN_COUNTS.neg), 'ayrılan'),
    bar('c-neg', 2, 0, 'bar-neg', neg, String(neg), 'kalan'),
    bar('c-real', 2, 1, 'bar-real', pos, String(pos), 'ayrılan'),
  ];
  flow.barTitles = ['eğitim', 'SMOTE sonrası', 'test'];
  flow.testRate = pct(pos / honest.length, 1);
  const strip = [
    `eğitim: ${TRAIN_COUNTS.neg} | ${TRAIN_COUNTS.pos} → SMOTE sonrası: ${TRAIN_COUNTS.neg} | ${TRAIN_COUNTS.neg} → test: kalan ${neg} | ayrılan ${pos} (hepsi gerçek)`,
    `test ayrılan oranı = ${flow.testRate}`,
  ].join('\n');
  return { flow, strip };
}

const spotOf = (i: number): Spot => ({ tenure: CUSTOMERS[i].tenure, charge: CUSTOMERS[i].charge });

/** Step 3: the example (seed 42, leaky order only) and the share of synthetic test points with a parent in training. */
function exampleView(p: LeakParams): { flow: FlowView; strip: string } {
  const flow = emptyFlow('example', p);
  flow.rows = [];
  if (p.order === 'dogru') {
    flow.note = 'Doğru sırada test kümesinde sentetik nokta yok.';
    return { flow, strip: 'sentetik test noktası = 0 · ebeveyni eğitimde olan = 0' };
  }
  const run = leakFor(p.seed);
  const { parentInTrain, synthPos } = run.leaky;
  if (p.seed === DEFAULT_SEED) {
    const [a, b] = LEAK_EXAMPLE.parents;
    flow.example = {
      point: { tenure: LEAK_EXAMPLE.point[0], charge: LEAK_EXAMPLE.point[1] },
      parents: [spotOf(a), spotOf(b)],
    };
  } else {
    flow.note = `Örnek nokta yalnız tohum ${DEFAULT_SEED} için çizilir.`;
  }
  return { flow, strip: `ebeveyni eğitimde: ${parentInTrain} / ${synthPos} = ${pct(parentInTrain / synthPos, 0)}` };
}

const empty = (kind: LeakKind, id: string, strip = ''): LeakView => ({ kind, stepId: id, strip, flow: null, pr: null, folds: null, code: null });

const series = (id: string, cls: string, samples: readonly ScoredSample[], score: number | null, selected: boolean, name: string): PrSeries => ({
  id,
  cls,
  pts: staircase(samples),
  pin: score === null ? name : `${name} ${ap(score)}`,
  selected,
});

/** Step 4 and 5: the leaky and the honest test of a seed. */
function twoCurves(id: string, p: LeakParams): LeakView {
  const run = leakFor(p.seed);
  const withScore = id === 'iki-skor';
  const leakyRate = positiveRate(run.leaky.scores);
  const honestRate = positiveRate(run.honest.scores);
  const pr: PrView = {
    series: [
      series('leaky', 'is-leaky', run.leaky.scores, withScore ? run.leaky.ap : null, p.order === 'yanlis', 'sızıntılı'),
      series('honest', 'is-honest', run.honest.scores, withScore ? run.honest.ap : null, p.order === 'dogru', 'sızıntısız'),
    ],
    baselines: [
      { y: leakyRate, label: `taban ${f(leakyRate, 3)}`, cls: 'baseline is-leaky' },
      { y: honestRate, label: `taban ${f(honestRate, 3)}`, cls: 'baseline is-honest' },
    ],
    big: null,
    note: null,
    marker: null,
    panel: null,
  };
  if (!withScore) {
    const count = (s: readonly ScoredSample[]): string => `${s.filter((x) => x.actual === 1).length} / ${s.length}`;
    const strip = `taban = pozitif oran · sızıntılı ${count(run.leaky.scores)} = ${f(leakyRate, 3)} · sızıntısız ${count(run.honest.scores)} = ${f(honestRate, 3)}`;
    return { ...empty('pr', id, strip), pr };
  }
  pr.big = [
    { id: 'leaky', label: 'sızıntılı', value: ap(run.leaky.ap), cls: 'is-leaky' },
    { id: 'honest', label: 'sızıntısız', value: ap(run.honest.ap), cls: 'is-honest' },
  ];
  pr.note = `kitap ${ap(BOOK_NUMBERS.leaky)} / ${ap(BOOK_NUMBERS.honest)}`;
  const strip = `PR-AUC: sızıntılı ${ap(run.leaky.ap)} · sızıntısız ${ap(run.honest.ap)} · kitap ${ap(BOOK_NUMBERS.leaky)} / ${ap(BOOK_NUMBERS.honest)}`;
  return { ...empty('pr', id, strip), pr };
}

/** The book's "Sık yanlış anlama" box, shortened to one sentence for the strip of step 7. */
const MISCONCEPTION =
  'Sık yanlış anlama: "SMOTE her zaman class_weight\'ten daha iyi" sanılır; seçim veri miktarına, azınlık sayısına ve modele bağlıdır.';

const precisionText = (v: number | null): string => (v === null ? UNDEFINED_TEXT : ap(v));

/** Step 8's side lines: the caught count and precision, and where the unweighted model reaches the same recall. */
function thresholdLines(model: LeakParams['model'], c: Confusion, precision: number | null): string[] {
  const lines = [`${c.tp} / ${c.tp + c.fn} yakalandı · kesinlik ${precisionText(precision)}`];
  if (model !== 'base' && c.tp > 0) {
    const same = matchCaught(COMPARE.base.scores, c.tp);
    lines.push(`Ağırlıksız model aynı duyarlılığa en çok ${ap(same.threshold)} eşiğinde ulaşır, kesinliği ${ap(same.precision)}.`);
  }
  return lines;
}

/** Steps 7 and 8 share the three-model PR area; step 7 shows the switched-on curves, step 8 one model and its threshold. */
function compareCurves(id: string, p: LeakParams): LeakView {
  const rate = positiveRate(COMPARE.base.scores);
  const models: LeakParams['model'][] = id === 'esik' ? [p.model] : MODELS.filter((m) => p.show[m]);
  const pr: PrView = {
    series: models.map((m) => series(m, `is-${m}`, COMPARE[m].scores, COMPARE[m].ap, false, MODEL_NAMES[m])),
    baselines: [{ y: rate, label: `taban ${f(rate, 3)}`, cls: 'baseline is-base' }],
    big: null,
    note: null,
    marker: null,
    panel: null,
  };
  if (id !== 'esik') {
    const strip = [`PR-AUC: ${MODELS.map((m) => `${MODEL_NAMES[m]} ${ap(COMPARE[m].ap)}`).join(' · ')}`, MISCONCEPTION].join('\n');
    return { ...empty('pr', id, strip), pr };
  }
  const c = classify(COMPARE[p.model].scores, p.threshold);
  const m = metrics(c);
  if (m.precision !== null && m.recall !== null) {
    pr.marker = { x: m.recall, y: m.precision, label: `eşik ${f(p.threshold, 2)}` };
  }
  pr.panel = { matrix: c, lines: thresholdLines(p.model, c, m.precision) };
  const strip = `${MODEL_NAMES[p.model]} · eşik ${f(p.threshold, 2)} · yakalanan ${c.tp} / ${c.tp + c.fn} · kesinlik ${precisionText(m.precision)}`;
  return { ...empty('pr', id, strip), pr };
}

/** The book's sentence about the pipeline (step 6 strip). */
const PIPELINE_SENTENCE = 'imblearn Pipeline, örnekleyiciyi yalnız fit sırasında çalıştırır';

/** The pipeline book line of step 6. */
const PIPELINE_LINE = 'Pipeline(steps=[("olcekleme", …), ("smote", …), ("model", …)])';

/** Step 6: the five fold rows with the selected fold and the mean. */
function foldsView(id: string, p: LeakParams): LeakView {
  const rows: FoldRow[] = CV.folds.map((fold, i) => ({
    fold: i + 1,
    trainNeg: fold.trainNeg,
    trainPos: fold.trainPos,
    smoteNeg: fold.smoteNeg,
    smotePos: fold.smotePos,
    valNeg: fold.valNeg,
    valPos: fold.valPos,
    ap: ap(fold.ap),
  }));
  const mean = ap(CV.mean);
  const strip = [`ortalama PR-AUC = ${mean} · kitap ${ap(BOOK_NUMBERS.cv)}`, PIPELINE_SENTENCE].join('\n');
  const selected = p.fold >= 1 && p.fold <= rows.length ? p.fold : 0;
  return { ...empty('folds', id, strip), folds: { rows, selected, mean, book: PIPELINE_LINE } };
}

/** Step 9: the marked bug count (a sweep value 6 or the Lab switch brings the corrected code). */
function codeView(id: string, p: LeakParams): LeakView {
  const bug = Math.max(0, Math.min(5, Math.trunc(p.bug)));
  const fixed = p.fixed || p.bug >= 6;
  const strip = fixed
    ? 'düzeltilmiş: önce böl (stratify, random_state) → SMOTE yalnız eğitimde → eğitimde eğit → PR-AUC'
    : `işaretlenen hata: ${bug} / 5`;
  return { ...empty('code', id, strip), code: { bug, fixed } };
}

/** The view of step `index` for the parameters `p`. */
export function deriveLeakView(index: number, p: LeakParams): LeakView {
  const id = scenario.steps[index].id;
  switch (id) {
    case 'iki-sira': {
      const strip = [
        'yanlış: veri → SMOTE → böl → eğit → test',
        'doğru: veri → böl → SMOTE → eğit → test (SMOTE yalnız eğitim parçasında)',
      ].join('\n');
      return { ...empty('flow', id, strip), flow: emptyFlow('rows', p) };
    }
    case 'once-smote': {
      const { flow, strip } = countsView(p);
      return { ...empty('flow', id, strip), flow };
    }
    case 'testte-ne-var': {
      const { flow, strip } = exampleView(p);
      return { ...empty('flow', id, strip), flow };
    }
    case 'pr-taban':
    case 'iki-skor':
      return twoCurves(id, p);
    case 'smote-agirlik':
    case 'esik':
      return compareCurves(id, p);
    case 'pipeline':
      return foldsView(id, p);
    case 'hata-ayiklama':
      return codeView(id, p);
    case 'baska-sizintilar':
      return empty('cards', id, 'ölçekleyici, kodlayıcı, seçici, SMOTE → parametreler yalnız eğitim verisinden öğrenilir');
    default:
      throw new RangeError(`no view for step "${id}"`);
  }
}
