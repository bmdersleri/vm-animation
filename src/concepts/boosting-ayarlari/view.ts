import { formatNumber as f, formatNonZero, formatTrim } from '../../core/plot/format';
import type { LineChartSpec, LineSeries } from '../../core/plot/line-chart';
import { logAxis } from '../../core/plot/log-axis';
import { segmentsFrom, type StepSegment } from '../../core/plot/step-line';
import { bestIndex, earlyStop } from '../boosting/boost';
import { BOOK_LRS, CURVES, REG, SURFACE } from '../boosting/data';
import { lrColorClass } from '../boosting/lr-color';
import { leafCount, predictReg, treeDepth, type RegTree } from '../boosting/regtree';
import { gridTrials, sequentialSearch } from '../boosting/search';
import {
  BOOK_TREES,
  boostingAyarlariScenario,
  curveOf,
  leafTree,
  levelTree,
  lrText,
  MAX_TREES,
  surfaceLrText,
  trainError,
  valError,
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
  /** Steps 6-7: the tree diagram and the residual scatter. */
  grow?: GrowView;
  /** Steps 9-10: the heatmap. */
  search?: SearchView;
}

/** One node of the tree diagram: `l` / `r` are child ids (-1 on a leaf), `order` the split number. */
export interface TreeNodeView {
  id: number;
  l: number;
  r: number;
  depth: number;
  leaf: boolean;
  label: string;
  order: number | null;
}

/** What the growth scene draws for a tree (Ders steps 6-7). */
export interface GrowView {
  head: string[];
  nodes: TreeNodeView[];
  cuts: { t: number; order: number }[];
  steps: StepSegment[];
  points: [number, number][];
  /** One line per split: number, threshold and gain. */
  splits: string[];
  caption: string;
  y: [number, number];
  yTicks: number[];
}

/** One cell of the 6 x 9 heatmap; `order` is its trial number (1-based) or null when untried. */
export interface HeatCell {
  cell: number;
  row: number;
  col: number;
  auc: number;
  fill: string;
  dark: boolean;
  order: number | null;
  best: boolean;
}

/** What the search scene draws (Ders steps 9-10). */
export interface SearchView {
  rowLabels: string[];
  colLabels: string[];
  cells: HeatCell[];
  /** The full surface is visible (Ders step 10 at the last trial, or the Lab toggle). */
  showSurface: boolean;
  aucMin: number;
  aucMax: number;
  bestText: string;
  links: { href: string; text: string }[];
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
    cls: `val ${lrColorClass(lr)}`,
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
  const series: LineSeries[] = [{ id: 'val', cls: `val ${lrColorClass(p.lr)}`, pts: pts(c.valLoss, n) }];
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
    { id: 'train', cls: `train ${lrColorClass(p.lr)}`, pts: pts(c.trainLoss, MAX_TREES) },
    { id: 'val', cls: `val ${lrColorClass(p.lr)}`, pts: pts(c.valLoss, MAX_TREES), dash: '8 5' },
  ]);
  chart.pins = [{ x: dip, y: c.valLoss[dip - 1], label: `${dip}. ağaç · ${f(c.valLoss[dip - 1], 3)}` }];
  return {
    stepId: 'ezber',
    kind: 'curves',
    strip: `ν = ${lrText(p.lr)} · ${MAX_TREES} ağaç · eğitim log-kaybı = ${c.trainLoss[last] < 5e-7 ? '0' : formatNonZero(c.trainLoss[last], 3)} · doğrulama log-kaybı = ${f(c.valLoss[last], 3)}\nen düşük doğrulama kaybı ${dip}. ağaçta · açık (doğrulama − eğitim) = ${f(c.valLoss[last] - c.trainLoss[last], 3)}`,
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
  const chart = lossChart('doğrulama log-kaybı', [{ id: 'val', cls: `val ${lrColorClass(p.lr)}`, pts: pts(c.valLoss, MAX_TREES) }]);
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

/** Node views of a tree in tree order; `order` is the split number (level-wise: the level, leaf-wise: split order). */
export function treeNodes(tree: RegTree, growth: 'level' | 'leaf'): TreeNodeView[] {
  const rank = new Map(tree.splits.map((sp, i) => [sp.node, i + 1]));
  return tree.nodes.map((n, id) => {
    const leaf = n.l === -1;
    return {
      id,
      l: n.l,
      r: n.r,
      depth: n.depth,
      leaf,
      label: leaf ? f(n.v, 3) : `x ≤ ${f(n.t, 3)}`,
      order: leaf ? null : growth === 'level' ? n.depth + 1 : (rank.get(id) ?? null),
    };
  });
}

const firstResiduals = REG.train.x.map((x, i): [number, number] => [x, REG.train.y[i] - REG.mean]);
const resLo = Math.floor(Math.min(...firstResiduals.map((q) => q[1])) * 2) / 2;
const resHi = Math.ceil(Math.max(...firstResiduals.map((q) => q[1])) * 2) / 2;
const resTicks = Array.from({ length: Math.floor(resHi) - Math.ceil(resLo) + 1 }, (_, i) => Math.ceil(resLo) + i);

/** Steps 6-7: a first-residual tree grown level-wise (depth) or leaf-wise (2^depth leaves). */
function growth(id: 'seviye' | 'yaprak', p: TuneParams): TuneView {
  const depth = Math.max(1, Math.round(p.depth));
  const kind = id === 'seviye' ? 'level' : 'leaf';
  const tree = kind === 'level' ? levelTree(depth) : leafTree(2 ** depth);
  const nodes = treeNodes(tree, kind);
  const cuts = nodes.filter((n) => !n.leaf).map((n) => ({ t: tree.nodes[n.id].t, order: n.order! }));
  const err = f(trainError(tree), 3);
  const gain = new Map(tree.splits.map((sp) => [sp.node, sp.gain]));
  const splits = nodes
    .filter((n) => !n.leaf)
    .sort((a, b) => a.order! - b.order! || a.id - b.id)
    .map((n) => `${n.order} · ${n.label} · kazanç ${f(gain.get(n.id)!, 4)}`);
  const first =
    kind === 'level'
      ? `seviye-öncelikli · derinlik ${treeDepth(tree)} · ${leafCount(tree)} yaprak`
      : `yaprak-öncelikli · ${leafCount(tree)} yaprak · derinlik ${treeDepth(tree)}`;
  const grow: GrowView = {
    head: [first, `hata ${err}`],
    nodes,
    cuts,
    steps: segmentsFrom(
      cuts.map((c) => c.t),
      (x) => predictReg(tree, x),
      0,
      10,
    ),
    points: firstResiduals,
    splits,
    caption:
      kind === 'level'
        ? 'Numara = bölünme sırası; aynı numara aynı seviye, birlikte açılır.'
        : 'Numara = bölünme sırası; her adımda en çok kazandıran yaprak açılır.',
    y: [resLo, resHi],
    yTicks: resTicks,
  };
  return { stepId: id, kind: 'grow', strip: `${first} · hata = ${err}`, ...EMPTY, grow };
}

/** One leaf-wise tree of the step 8 sweep: the request, the real leaf count and the errors. */
interface LeafRow {
  asked: number;
  leaves: number;
  depth: number;
  train: number;
  val: number;
}
let leafRows: LeafRow[] | null = null;
/** Trees of 2..64 requested leaves, one row per real leaf count (the data may stop short of the request). */
function leafSweep(): LeafRow[] {
  if (leafRows) {
    return leafRows;
  }
  const out: LeafRow[] = [];
  for (let k = 2; k <= 64; k++) {
    const t = leafTree(k);
    const leaves = leafCount(t);
    if (out.length === 0 || leaves > out[out.length - 1].leaves) {
      out.push({ asked: k, leaves, depth: treeDepth(t), train: trainError(t), val: valError(t) });
    }
  }
  leafRows = out;
  return out;
}

const ERR_FLOOR = 1e-5;
const logErr = (v: number): number => Math.log10(Math.max(v, ERR_FLOOR));

/** Step 8: training and validation error of the leaf-wise tree against its leaf count (log y). */
function leafLimit(p: TuneParams): TuneView {
  const rows = leafSweep();
  const upto = rows.filter((r) => r.asked <= p.leaves);
  const shown = upto.length > 0 ? upto : [rows[0]];
  const cur = shown[shown.length - 1];
  const all = rows.flatMap((r) => [r.train, r.val]);
  const axis = logAxis(Math.max(Math.min(...all), ERR_FLOOR) * 0.3, Math.max(...all) * 1.25);
  const maxLeaves = rows[rows.length - 1].leaves;
  const chart: LineChartSpec = {
    x: [2, maxLeaves],
    y: axis.y,
    xTitle: 'yaprak sayısı',
    yTitle: 'hata (log ölçek)',
    series: [
      { id: 'train', cls: 'train leaf-train', pts: shown.map((r) => [r.leaves, logErr(r.train)]) },
      { id: 'val', cls: 'val leaf-val', pts: shown.map((r) => [r.leaves, logErr(r.val)]), dash: '8 5' },
    ],
    xTicks: [2, ...[16, 32, 48, 64].filter((t) => t <= maxLeaves)],
    yTicks: axis.ticks,
    yFormat: axis.format,
  };
  return {
    stepId: 'yaprak-siniri',
    kind: 'curves',
    strip: `num_leaves < 2^max_depth: max_depth=5 → ${2 ** 5}\n${cur.leaves} yaprak · derinlik ${cur.depth} · eğitim hatası = ${formatNonZero(cur.train, 3)} · doğrulama hatası = ${f(cur.val, 3)}`,
    chart,
    endLabels: [
      { id: 'train', text: 'eğitim', x: cur.leaves, y: logErr(cur.train) },
      { id: 'val', text: 'doğrulama', x: cur.leaves, y: logErr(cur.val) },
    ],
    // the selected leaf count and the depth it needs
    vlines: [
      {
        x: cur.leaves,
        label: `${cur.leaves} yaprak · derinlik ${cur.depth}`,
        anchor: cur.leaves > maxLeaves / 2 ? 'end' : 'start',
        row: 0,
        cls: 'leaf',
      },
    ],
    gap: null,
    note: null,
  };
}

/** Learning rate of a surface column with two significant digits: 0,01 / 0,018 / 0,1 / 1. */
export const colLabel = (lr: number): string => formatTrim(Number(lr.toPrecision(2)), 3);

const FLAT_AUC = SURFACE.auc.flat();
const AUC_MIN = Math.min(...FLAT_AUC);
const AUC_MAX = Math.max(...FLAT_AUC);
const N_LR = SURFACE.lrs.length;

/** Sequential palette: pale blue (low AUC) through mid blue to navy (high AUC). */
const STOPS = [
  [0xf1, 0xf6, 0xfb],
  [0x7f, 0xb2, 0xdc],
  [0x14, 0x36, 0x5c],
];
export function heatColor(t: number): string {
  const u = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0)) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(u));
  const k = u - i;
  const c = STOPS[i].map((v, j) => Math.round(v + (STOPS[i + 1][j] - v) * k));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const LINKS = [
  { href: '../gradyan-artirma/', text: 'Gradyan artırma sayfası' },
  { href: '../capraz-dogrulama/', text: 'Çapraz doğrulama sayfası' },
];

/** Steps 9-10: the heatmap with the first `trial` cells of the grid or of the sequential search. */
function search(id: 'izgara' | 'sirali-arama', p: TuneParams): TuneView {
  const budget = Math.max(1, Math.round(p.budget));
  const trial = Math.max(0, Math.min(budget, Math.round(p.trial)));
  const order = id === 'izgara' ? gridTrials(budget) : sequentialSearch(SURFACE.auc, budget, p.seed);
  const tried = order.slice(0, trial);
  let best = -1;
  for (const c of tried) {
    if (best < 0 || FLAT_AUC[c] > FLAT_AUC[best]) {
      best = c;
    }
  }
  const cells: HeatCell[] = FLAT_AUC.map((auc, cell) => {
    const t = (auc - AUC_MIN) / (AUC_MAX - AUC_MIN);
    const k = tried.indexOf(cell);
    return { cell, row: Math.floor(cell / N_LR), col: cell % N_LR, auc, fill: heatColor(t), dark: t > 0.6, order: k < 0 ? null : k + 1, best: cell === best };
  });
  const bestText =
    best < 0
      ? 'henüz deneme yok'
      : `en iyi: derinlik ${SURFACE.depths[Math.floor(best / N_LR)]} · ν ${surfaceLrText(SURFACE.lrs[best % N_LR])} · AUC ${f(FLAT_AUC[best], 3)}`;
  const label = id === 'izgara' ? 'ızgara' : 'sıralı arama';
  const searchView: SearchView = {
    rowLabels: SURFACE.depths.map(String),
    colLabels: SURFACE.lrs.map(colLabel),
    cells,
    showSurface: p.showSurface || (id === 'sirali-arama' && trial >= budget),
    aucMin: AUC_MIN,
    aucMax: AUC_MAX,
    bestText,
    links: id === 'sirali-arama' ? LINKS : [],
  };
  return {
    stepId: id,
    kind: 'search',
    strip: `${label} · ${trial} / ${order.length} deneme · ${SURFACE.depths.length * N_LR} hücrelik yüzey`,
    ...EMPTY,
    search: searchView,
  };
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
      return growth(id, p);
    case 'yaprak-siniri':
      return leafLimit(p);
    case 'izgara':
    case 'sirali-arama':
      return search(id, p);
    default:
      throw new Error(`unknown step ${id}`);
  }
}
