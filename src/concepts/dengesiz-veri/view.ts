import { formatNumber as f, formatPercent as pct } from '../../core/plot/format';
import { metrics, type Confusion } from '../degerlendirme/metrics';
import { UNDEFINED_TEXT } from '../degerlendirme/ui';
import { BOOK01, CUSTOMERS, MODELS2D } from '../dengesiz/data';
import { fromScaled } from '../dengesiz/smote';
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

/** Class weight of a churner for the page's weight choice. */
function positiveWeight(p: ImbParams): number {
  if (p.weight === 'dengeli') {
    return BALANCED.pos;
  }
  return p.weight === 'elle' ? p.manualWeight : 1;
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
 * The view of step `index` for the parameters `p`. Steps 1-5 are fully derived; steps 6-10 carry
 * their scenario ids, points and strip for the Task 3 scenes (`kind` smote / weight / boundary).
 */
export function deriveImbView(index: number, p: ImbParams): ImbView {
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
        strip:
          id === 'smote-doldur'
            ? `sentetik = ${COUNTS.train.neg} − ${COUNTS.train.pos} = ${n} · ayrılan = ${COUNTS.train.pos} + ${n} = ${COUNTS.train.pos + n}`
            : `kopya: en çok ×${copies ? Math.max(...copies) + 1 : 1} · SMOTE: ${n} yeni nokta, hiçbiri özgün müşteri değil`,
      };
    }
    case 'agirlik': {
      const w = { neg: p.weight === 'yok' ? 1 : BALANCED.neg, pos: positiveWeight(p) };
      const total = COUNTS.train.neg + COUNTS.train.pos;
      return {
        ...base,
        kind: 'weight',
        dots: customerDots(false, w),
        counts: trainCounts,
        strip: `ayrılan ağırlığı = ${total} / (2 · ${COUNTS.train.pos}) = ${f(BALANCED.pos, 2)} · kalan ağırlığı = ${total} / (2 · ${COUNTS.train.neg}) = ${f(BALANCED.neg, 2)}`,
      };
    }
    default: {
      const m = MODELS2D;
      const row = (c: Confusion): string => `${c.tp} / ${c.tp + c.fn}`;
      return {
        ...base,
        kind: 'boundary',
        dots: customerDots(true, { neg: 1, pos: 1 }),
        counts: { title: `Test kümesi (${COUNTS.test.neg + COUNTS.test.pos})`, neg: COUNTS.test.neg, pos: COUNTS.test.pos },
        strip: `yakalanan: ağırlıksız ${row(m.base.matrix)} · SMOTE ${row(m.smote.matrix)} · ağırlıklı ${row(m.weighted.matrix)}`,
      };
    }
  }
}
