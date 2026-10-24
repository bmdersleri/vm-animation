import { formatNumber as f, formatNonZero } from '../../core/plot/format';
import type { LineChartSpec, LineSeries } from '../../core/plot/line-chart';
import { bestIndex, earlyStop } from '../boosting/boost';
import { BOOK_LRS, CURVES, SURFACE } from '../boosting/data';
import { leafCount, treeDepth } from '../boosting/regtree';
import { gridTrials } from '../boosting/search';
import {
  BOOK_TREES,
  boostingAyarlariScenario,
  curveOf,
  leafTree,
  levelTree,
  lrText,
  MAX_TREES,
  trainError,
  type TuneParams,
} from './scenario';

/** A vertical marker line at a tree count; `row` stacks its label below the plot's top edge. */
export interface VLine {
  x: number;
  label: string;
  anchor: 'start' | 'end';
  row: number;
  cls: string;
}

/** A label at the end of a curve: (x, y) is in chart space, `id` is the series it names. */
export interface TuneEndLabel {
  id: string;
  text: string;
  x: number;
  y: number;
}

/** One point of the train-validation gap (step 4): the lower and upper curve at tree count `x`. */
export interface GapPoint {
  x: number;
  lo: number;
  hi: number;
}

/**
 * Everything the scene draws for one step and parameter set. `kind` picks the host: `points`
 * (step 1) and `curves` (steps 2-5) are drawn by the curve scene; `grow` (steps 6-8) and `search`
 * (steps 9-10) are reserved for the growth and search scenes.
 */
export interface TuneView {
  stepId: string;
  kind: 'points' | 'curves' | 'grow' | 'search';
  strip: string;
  chart: LineChartSpec | null;
  endLabels: TuneEndLabel[];
  vlines: VLine[];
  gap: GapPoint[] | null;
  note: string | null;
}

/** Spec "Hata durumları": the validation minimum sits on the last tree. */
const NO_DIP = 'Henüz dip yok: daha çok ağaç dene';

/** The y axis of every log-loss chart: from 0 up to the next 0,2 above the largest loss of the data. */
const LOSS_TOP =
  Math.ceil(Math.max(...CURVES.byLr.flatMap((c) => [...c.valLoss, ...c.trainLoss])) * 5) / 5;
const LOSS_TICKS = Array.from({ length: Math.round(LOSS_TOP * 5) + 1 }, (_, i) => i / 5);

const TREE_TICKS = [1, 100, 200, 300, 400, 500];

const EMPTY = { chart: null, endLabels: [], vlines: [], gap: null, note: null };

/** The first `n` points (tree count, value) of a curve. */
const pts = (values: readonly number[], n: number): [number, number][] =>
  values.slice(0, n).map((v, i) => [i + 1, v]);

/** Base of every loss chart: tree counts on x, loss on y. */
function lossChart(yTitle: string, series: LineSeries[]): LineChartSpec {
  return {
    x: [1, MAX_TREES],
    y: [0, LOSS_TOP],
    xTitle: 'ağaç sayısı',
    yTitle,
    series,
    xTicks: TREE_TICKS,
    yTicks: LOSS_TICKS,
  };
}

/** Step 1: validation AUC at 150 trees over the five book rates, on a log10 x axis. */
function lrExperiment(): TuneView {
  const xs = BOOK_LRS.map((lr) => Math.log10(lr));
  const ys = BOOK_LRS.map((lr) => curveOf(lr).valAuc[BOOK_TREES - 1]);
  const pad = 0.12;
  const chart: LineChartSpec = {
    x: [xs[0] - pad, xs[xs.length - 1] + pad],
    y: [Math.floor(Math.min(...ys) * 100) / 100 - 0.01, Math.ceil(Math.max(...ys) * 100) / 100 + 0.01],
    xTitle: 'öğrenme oranı ν (log ölçek)',
    yTitle: 'doğrulama AUC',
    series: [{ id: 'auc', cls: 'auc', pts: xs.map((x, i) => [x, ys[i]]) }],
    pins: xs.map((x, i) => ({ x, y: ys[i], label: f(ys[i], 3) })),
    xTicks: xs,
    xFormat: (t) => lrText(10 ** t),
  };
  return {
    stepId: 'lr-deney',
    kind: 'points',
    strip: `XGBClassifier(n_estimators=${BOOK_TREES}, max_depth=4, learning_rate=oran)\nBu sayfada aynı deney scikit-learn'ün GradientBoostingClassifier'ıyla yapılır.`,
    ...EMPTY,
    chart,
  };
}

/** Step 2: the five book rates' validation log-loss up to `trees` trees. */
function curves(trees: number): TuneView {
  const n = Math.max(1, Math.min(MAX_TREES, Math.round(trees)));
  const series: LineSeries[] = BOOK_LRS.map((lr, i) => ({
    id: `val-${lr}`,
    cls: `val lr-${i}`,
    pts: pts(curveOf(lr).valLoss, n),
  }));
  const values = BOOK_LRS.map((lr) => `ν = ${lrText(lr)}: ${f(curveOf(lr).valLoss[n - 1], 3)}`);
  return {
    stepId: 'egriler',
    kind: 'curves',
    strip: `doğrulama log-kaybı · ${n} ağaç\n${values.join(' · ')}`,
    chart: lossChart('doğrulama log-kaybı', series),
    endLabels: BOOK_LRS.map((lr, i) => ({
      id: series[i].id,
      text: `ν = ${lrText(lr)}`,
      x: n,
      y: curveOf(lr).valLoss[n - 1],
    })),
    vlines: [{ x: BOOK_TREES, label: `${BOOK_TREES} ağaç`, anchor: 'start', row: 0, cls: 'book' }],
    gap: null,
    note: null,
  };
}

/** Step 3: one rate's validation curve up to `trees`, pinned with the AUC at 150 and at the end. */
function moreTrees(p: TuneParams): TuneView {
  const c = curveOf(p.lr);
  const n = Math.max(1, Math.min(MAX_TREES, Math.round(p.trees)));
  const at = n > BOOK_TREES ? [BOOK_TREES, n] : [n];
  const series: LineSeries[] = [{ id: 'val', cls: 'val lr-0', pts: pts(c.valLoss, n) }];
  const chart = lossChart('doğrulama log-kaybı', series);
  chart.pins = at.map((k) => ({ x: k, y: c.valLoss[k - 1], label: `${k}. ağaç · AUC ${f(c.valAuc[k - 1], 3)}` }));
  return {
    stepId: 'agac-ekle',
    kind: 'curves',
    strip: `ν = ${lrText(p.lr)} · ${n} ağaç · doğrulama AUC = ${f(c.valAuc[n - 1], 3)} · log-kaybı = ${f(c.valLoss[n - 1], 3)}\nGradientBoostingClassifier(n_estimators=${n}, learning_rate=${p.lr})`,
    chart,
    endLabels: [{ id: 'val', text: `ν = ${lrText(p.lr)}`, x: n, y: c.valLoss[n - 1] }],
    vlines: [{ x: BOOK_TREES, label: '', anchor: 'start', row: 0, cls: 'book' }],
    gap: null,
    note: null,
  };
}

/** Step 4: training and validation log-loss of one rate, the gap between them and the validation dip. */
function overfit(p: TuneParams): TuneView {
  const c = curveOf(p.lr);
  const dip = bestIndex(c.valLoss);
  const last = MAX_TREES - 1;
  const chart = lossChart('log-kaybı', [
    { id: 'train', cls: 'train', pts: pts(c.trainLoss, MAX_TREES) },
    { id: 'val', cls: 'val', pts: pts(c.valLoss, MAX_TREES), dash: '8 5' },
  ]);
  chart.pins = [{ x: dip, y: c.valLoss[dip - 1], label: `${dip}. ağaç · ${f(c.valLoss[dip - 1], 4)}` }];
  return {
    stepId: 'ezber',
    kind: 'curves',
    strip: `ν = ${lrText(p.lr)} · ${MAX_TREES} ağaç · eğitim log-kaybı = ${c.trainLoss[last] < 5e-7 ? '0' : formatNonZero(c.trainLoss[last], 4)} · doğrulama log-kaybı = ${f(c.valLoss[last], 4)}\nen düşük doğrulama kaybı ${dip}. ağaçta · açık (doğrulama − eğitim) = ${f(c.valLoss[last] - c.trainLoss[last], 3)}`,
    chart,
    endLabels: [
      { id: 'train', text: 'eğitim', x: MAX_TREES, y: c.trainLoss[last] },
      { id: 'val', text: 'doğrulama', x: MAX_TREES, y: c.valLoss[last] },
    ],
    vlines: [],
    gap: c.valLoss.map((v, i) => ({ x: i + 1, lo: Math.min(v, c.trainLoss[i]), hi: Math.max(v, c.trainLoss[i]) })),
    note: dip === MAX_TREES ? NO_DIP : null,
  };
}

/** Step 5: early stopping on one rate's validation curve: best tree and best + patience. */
function earlyStopping(p: TuneParams): TuneView {
  const c = curveOf(p.lr);
  const es = earlyStop(c.valLoss, p.patience);
  const side = (x: number): 'start' | 'end' => (x > MAX_TREES / 2 ? 'end' : 'start');
  const vlines: VLine[] = [
    { x: es.best, label: `${es.best}. ağaçta en düşük`, anchor: side(es.best), row: 0, cls: 'best' },
  ];
  if (es.stop !== null) {
    vlines.push({ x: es.stop, label: `${es.stop}. ağaçta dur`, anchor: side(es.stop), row: 1, cls: 'stop' });
  }
  const chart = lossChart('doğrulama log-kaybı', [{ id: 'val', cls: 'val', pts: pts(c.valLoss, MAX_TREES) }]);
  const stopText = es.stop === null ? 'durma yok' : `durma ağacı = ${es.stop}`;
  return {
    stepId: 'erken-durdurma',
    kind: 'curves',
    strip: `early_stopping_rounds=${p.patience} · ν = ${lrText(p.lr)} · en iyi ağaç = ${es.best} · ${stopText}\nDurmaya doğrulama kümesi karar verir; test kümesi en sona saklanır.`,
    chart,
    endLabels: [{ id: 'val', text: `ν = ${lrText(p.lr)}`, x: MAX_TREES, y: c.valLoss[MAX_TREES - 1] }],
    vlines,
    gap: null,
    note: es.stop === null ? `${MAX_TREES} ağaca kadar durmadı` : null,
  };
}

/** Steps 6-8 (Task 5 draws them): a one-line strip from the same trees the texts quote. */
function growPlaceholder(id: string, p: TuneParams): TuneView {
  let strip: string;
  if (id === 'seviye') {
    const t = levelTree(p.depth);
    strip = `seviye-öncelikli · derinlik ${treeDepth(t)} · ${leafCount(t)} yaprak · hata = ${f(trainError(t), 3)}`;
  } else if (id === 'yaprak') {
    const t = leafTree(2 ** p.depth);
    strip = `yaprak-öncelikli · ${leafCount(t)} yaprak · derinlik ${treeDepth(t)} · hata = ${f(trainError(t), 3)}`;
  } else {
    const l = leafTree(p.leaves);
    strip = `yaprak-öncelikli · ${leafCount(l)} yaprak · derinlik ${treeDepth(l)} · eğitim hatası = ${formatNonZero(trainError(l), 3)}`;
  }
  return { stepId: id, kind: 'grow', strip, ...EMPTY };
}

/** Steps 9-10 (Task 5 draws them): the grid's size and the surface's cell count. */
function searchPlaceholder(id: string, p: TuneParams): TuneView {
  const cells = SURFACE.depths.length * SURFACE.lrs.length;
  const strip =
    id === 'izgara'
      ? `ızgara · ${gridTrials(p.budget).length} deneme · ${cells} hücrelik yüzey`
      : `sıralı arama · ${p.budget} deneme · ${cells} hücrelik yüzey`;
  return { stepId: id, kind: 'search', strip, ...EMPTY };
}

/** The view of step `index` for the parameters `p`. */
export function deriveTuneView(index: number, p: TuneParams): TuneView {
  const id = boostingAyarlariScenario.steps[index].id;
  switch (id) {
    case 'lr-deney':
      return lrExperiment();
    case 'egriler':
      return curves(p.trees);
    case 'agac-ekle':
      return moreTrees(p);
    case 'ezber':
      return overfit(p);
    case 'erken-durdurma':
      return earlyStopping(p);
    case 'seviye':
    case 'yaprak':
    case 'yaprak-siniri':
      return growPlaceholder(id, p);
    default:
      return searchPlaceholder(id, p);
  }
}
