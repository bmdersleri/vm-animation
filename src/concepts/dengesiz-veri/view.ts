import { formatNumber as f, formatPercent as pct } from '../../core/plot/format';
import { metrics, type Confusion } from '../degerlendirme/metrics';
import { UNDEFINED_TEXT } from '../degerlendirme/ui';
import { BOOK01, CUSTOMERS } from '../dengesiz/data';
import { fromScaled } from '../dengesiz/smote';
import { METHODS, resultFor, weightsFor, type Method, type MethodResult, type Segment } from './boundary';
import {
  BALANCED,
  COUNTS,
  copiesFor,
  exampleFor,
  MINORITY,
  smoteFor,
  syntheticFor,
  type Example,
  type Place,
} from './model';
import { dengesizVeriScenario as scenario, type ImbParams } from './scenario';

/** Which scene layer draws the step: the scatter with side panel (steps 1-5) or a Task 3 placeholder. */
export type ImbKind = 'scatter' | 'smote' | 'weight' | 'boundary';

/** One dot of the scatter. `weight` is the class weight the step gives it (1 = unweighted). */
export interface ImbDot {
  id: string;
  tenure: number;
  charge: number;
  cls: 0 | 1;
  test: boolean;
  synthetic: boolean;
  weight: number;
}

/** The two class counts the side panel's bars show, with the set they count. */
export interface CountsView {
  title: string;
  neg: number;
  pos: number;
}

/** The metric row as it is written (already formatted). */
export interface MetricRow {
  accuracy: string;
  precision: string;
  recall: string;
  f1: string;
}

/** The step-5 example in the form the scene draws. */
export interface ExampleView {
  xi: Place;
  xz: Place;
  xnew: Place;
  neighbours: Place[];
  lambda: number;
}

/** One boundary line of step 9: the clipped segment, or the note when it misses the plot. */
export interface LineView {
  method: Method;
  label: string;
  segment: Segment | null;
  note: string | null;
  /** The Lab's chosen method (never set in Ders). */
  selected: boolean;
}

/** The test matrix of one method. */
export interface MatrixView {
  method: Method;
  label: string;
  matrix: Confusion;
}

/** Step 9: three lines, three matrices at one threshold. */
export interface BoundaryView {
  threshold: number;
  lines: LineView[];
  matrices: MatrixView[];
}

/** One row of the step-10 comparison table (already formatted). */
export interface TableRow {
  id: string;
  label: string;
  caught: string;
  falseAlarm: string;
  precision: string;
  recall: string;
  ap: string;
  /** The Lab's fourth row. */
  selection: boolean;
}

/** Step 10: the comparison table, its closing sentence and the links. */
export interface TableView {
  rows: TableRow[];
  note: string;
  links: { href: string; label: string }[];
}

/** Everything a scene draws for one (step, parameters) pair. */
export interface ImbView {
  kind: ImbKind;
  stepId: string;
  strip: string;
  dots: ImbDot[];
  /** True when the test dots are drawn faint (`.is-test`). */
  fadeTest: boolean;
  counts: CountsView;
  matrix: Confusion | null;
  /** The actual-churner row of the matrix is emphasised. */
  focusPositive: boolean;
  metrics: MetricRow | null;
  /** The book's code line shown under the metrics. */
  book: string | null;
  example: ExampleView | null;
  /** Random-oversampling copies per training churner (step 7). */
  copies: number[] | null;
  /** A short explanation under the count bars (step 8: what a dot's area means). */
  note: string | null;
  boundary: BoundaryView | null;
  table: TableView | null;
}

const BOOK_LINES: Record<string, string> = {
  dogruluk: 'temel_model = LogisticRegression(max_iter=1000, random_state=42)',
  azinlik: 'print(classification_report(test_hedefi, tahminler, digits=3))',
};

const placeOf = (c: { tenure: number; charge: number }): Place => ({ tenure: c.tenure, charge: c.charge });

/** The metric row of a confusion matrix; an undefined ratio reads "— (tanımsız)". */
export function metricRow(c: Confusion): MetricRow {
  const m = metrics(c);
  const ratio = (v: number | null): string => (v === null ? UNDEFINED_TEXT : f(v, 3));
  return {
    accuracy: m.accuracy === null ? UNDEFINED_TEXT : pct(m.accuracy, 1),
    precision: ratio(m.precision),
    recall: ratio(m.recall),
    f1: ratio(m.f1),
  };
}

/** The strip of step 5: the formula and, per feature, the numbers in the original units. */
function exampleStrip(e: Example): string {
  const lam = f(e.lambda, 2);
  return [
    'x_new = x_i + λ · (x_zi − x_i)',
    `kıdem: ${f(e.xi.tenure, 0)} + ${lam} · (${f(e.xz.tenure, 0)} − ${f(e.xi.tenure, 0)}) = ${f(e.xnew.tenure, 1)} ay`,
    `aylık ücret: ${f(e.xi.charge, 2)} + ${lam} · (${f(e.xz.charge, 2)} − ${f(e.xi.charge, 2)}) = ${f(e.xnew.charge, 2)}`,
  ].join('\n');
}

/** The dots of the customers (all, or the training part only), churners drawn last. */
function customerDots(includeTest: boolean, weights: { neg: number; pos: number }): ImbDot[] {
  const dots: ImbDot[] = [];
  CUSTOMERS.forEach((c, i) => {
    const test = c.split === 'test';
    if (test && !includeTest) {
      return;
    }
    dots.push({
      id: `c${i}`,
      tenure: c.tenure,
      charge: c.charge,
      cls: c.churn,
      test,
      synthetic: false,
      weight: c.churn === 1 ? weights.pos : weights.neg,
    });
  });
  return dots.sort((a, b) => a.cls - b.cls);
}

/** The test customers' dots (step 9), churners drawn last. */
function testDots(): ImbDot[] {
  return customerDots(true, { neg: 1, pos: 1 }).filter((d) => d.test);
}

/** The test part's counts, shown beside the boundary and the table. */
const testCounts = { title: `Test kümesi (${COUNTS.test.neg + COUNTS.test.pos})`, neg: COUNTS.test.neg, pos: COUNTS.test.pos };

/** "caught / churners" of a matrix. */
const caughtText = (c: Confusion): string => `${c.tp} / ${c.tp + c.fn}`;

/** Row of the comparison table for a method result. */
function tableRow(id: string, r: MethodResult, label: string, selection: boolean): TableRow {
  const m = metrics(r.matrix);
  const ratio = (v: number | null): string => (v === null ? UNDEFINED_TEXT : f(v, 3));
  return {
    id,
    label,
    caught: caughtText(r.matrix),
    falseAlarm: String(r.matrix.fp),
    precision: ratio(m.precision),
    recall: ratio(m.recall),
    ap: ratio(r.ap),
    selection,
  };
}

/** The sentence under the comparison table. */
export const COMPARE_NOTE = 'Dengeleme sıralamayı değil eşiği kaydırdı: aynı şeyi eşiği düşürerek de elde edebilirdik.';

/** Ders-end links of the comparison step. */
export const COMPARE_LINKS: { href: string; label: string }[] = [
  { href: '../smote-sizinti/', label: 'SMOTE sızıntısı ve PR-AUC' },
  { href: '../roc-esik/', label: 'Bölüm 6: ROC, PR ve karar eşiği' },
];

/** The step-6 scatter source: training customers plus the synthetic points. */
function smoteDots(p: ImbParams): ImbDot[] {
  const dots = customerDots(false, { neg: 1, pos: 1 });
  smoteFor(p.k, p.seed, p.ratio).forEach((s, n) => {
    const at = fromScaled(s);
    dots.push({ id: `s${n}`, ...at, cls: 1, test: false, synthetic: true, weight: 1 });
  });
  return dots;
}

/**
 * The view of step `index` for the parameters `p`. `lab` adds the Lab-only parts (the chosen
 * method's emphasis and the comparison table's fourth row).
 */
export function deriveImbView(index: number, p: ImbParams, lab = false): ImbView {
  const id = scenario.steps[index].id;
  const base: ImbView = {
    kind: 'scatter',
    stepId: id,
    strip: '',
    dots: [],
    fadeTest: index > 0,
    counts: { title: 'Tüm müşteriler', neg: COUNTS.all.neg, pos: COUNTS.all.pos },
    matrix: null,
    focusPositive: false,
    metrics: null,
    book: BOOK_LINES[id] ?? null,
    example: null,
    copies: null,
    note: null,
    boundary: null,
    table: null,
  };
  const trainCounts: CountsView = { title: 'Eğitim kümesi', neg: COUNTS.train.neg, pos: COUNTS.train.pos };
  switch (id) {
    case 'veri': {
      return {
        ...base,
        dots: customerDots(p.showTest, { neg: 1, pos: 1 }),
        strip: `${COUNTS.all.neg + COUNTS.all.pos} müşteri · ayrılan = ${COUNTS.all.pos} (${pct(COUNTS.all.pos / (COUNTS.all.neg + COUNTS.all.pos), 1)})`,
      };
    }
    case 'dogruluk':
    case 'azinlik': {
      const m = BOOK01.matrix;
      const row = metricRow(m);
      const total = m.tn + m.fp + m.fn + m.tp;
      const strip =
        id === 'dogruluk'
          ? `doğruluk = (${m.tn} + ${m.tp}) / ${total} = ${row.accuracy} · herkese "kalır" demek de ${pct(COUNTS.test.neg / total, 1)}`
          : `duyarlılık = ${m.tp} / (${m.tp} + ${m.fn}) = ${row.recall} · kesinlik = ${m.tp} / (${m.tp} + ${m.fp}) → ${row.precision} · F1 = ${row.f1}`;
      return {
        ...base,
        dots: customerDots(p.showTest, { neg: 1, pos: 1 }),
        counts: { title: `Test kümesi (${total})`, neg: COUNTS.test.neg, pos: COUNTS.test.pos },
        matrix: m,
        focusPositive: id === 'azinlik',
        metrics: row,
        strip,
      };
    }
    case 'egitim': {
      return {
        ...base,
        dots: customerDots(p.showTest, { neg: 1, pos: 1 }),
        counts: trainCounts,
        strip: `eğitim ${COUNTS.train.neg} : ${COUNTS.train.pos} ≈ ${Math.round(COUNTS.train.neg / COUNTS.train.pos)} : 1 · test ${COUNTS.test.neg + COUNTS.test.pos} (${COUNTS.test.neg} + ${COUNTS.test.pos})`,
      };
    }
    case 'sentetik': {
      const e = exampleFor(p.k, p.seed);
      return {
        ...base,
        dots: customerDots(p.showTest, { neg: 1, pos: 1 }),
        counts: trainCounts,
        example: {
          xi: e.xi,
          xz: e.xz,
          xnew: e.xnew,
          neighbours: e.neighbours.map((n) => placeOf(MINORITY[n])),
          lambda: e.lambda,
        },
        strip: exampleStrip(e),
      };
    }
    case 'smote-doldur':
    case 'kopyalama': {
      const n = syntheticFor(p.ratio);
      const copies = id === 'kopyalama' ? copiesFor(p.seed, p.ratio) : null;
      return {
        ...base,
        kind: 'smote',
        dots: smoteDots(p),
        counts: { title: 'Eğitim kümesi', neg: COUNTS.train.neg, pos: COUNTS.train.pos + n },
        copies,
        note: id === 'smote-doldur' ? `ayrılan ${COUNTS.train.pos} + ${n} sentetik` : null,
        strip:
          id === 'smote-doldur'
            ? `sentetik = ${COUNTS.train.neg} − ${COUNTS.train.pos} = ${n} · ayrılan = ${COUNTS.train.pos} + ${n} = ${COUNTS.train.pos + n}`
            : `kopya: en çok ×${copies ? Math.max(...copies) + 1 : 1} · SMOTE: ${n} yeni nokta, hiçbiri özgün müşteri değil`,
      };
    }
    case 'agirlik': {
      const w = weightsFor(p);
      const total = COUNTS.train.neg + COUNTS.train.pos;
      return {
        ...base,
        kind: 'weight',
        dots: customerDots(false, w),
        counts: trainCounts,
        note:
          p.weight === 'yok'
            ? 'Ağırlık yok: bütün noktalar aynı boyda.'
            : `Nokta alanı ağırlıkla orantılı: ayrılan ${f(w.pos, 2)}, kalan ${f(w.neg, 2)}.`,
        strip: `ayrılan ${f(BALANCED.pos, 2)} = ${total} / (2 · ${COUNTS.train.pos}) · kalan ${f(BALANCED.neg, 2)} = ${total} / (2 · ${COUNTS.train.neg})`,
      };
    }
    case 'sinir': {
      const results = METHODS.map((m) => resultFor(m.id, p, p.threshold));
      return {
        ...base,
        kind: 'boundary',
        dots: testDots(),
        counts: testCounts,
        boundary: {
          threshold: p.threshold,
          lines: results.map((r) => ({
            method: r.method,
            label: r.label,
            segment: r.segment,
            note: r.note,
            selected: lab && r.method === p.method,
          })),
          matrices: results.map((r) => ({ method: r.method, label: r.label, matrix: r.matrix })),
        },
        strip: `eşik p = ${f(p.threshold, 2)} · yakalanan: ${results.map((r) => `${r.label} ${caughtText(r.matrix)}`).join(' · ')}`,
      };
    }
    case 'karsilastirma': {
      const rows = METHODS.map((m) => tableRow(m.id, resultFor(m.id, p, 0.5), m.label, false));
      if (lab) {
        const chosen = resultFor(p.method, p, p.threshold);
        rows.push(tableRow('secim', chosen, `seçim: ${chosen.label}, eşik ${f(p.threshold, 2)}`, true));
      }
      return {
        ...base,
        kind: 'boundary',
        dots: [],
        counts: testCounts,
        table: { rows, note: COMPARE_NOTE, links: COMPARE_LINKS },
        strip: `PR-AUC: ${rows.map((r) => `${r.label} ${r.ap}`).join(' · ')}`,
      };
    }
    default:
      throw new RangeError(`no view for step "${id}"`);
  }
}
