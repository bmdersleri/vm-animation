import { formatNonZero, formatNumber as f } from '../../core/plot/format';
import type { LineChartSpec, LineSeries } from '../../core/plot/line-chart';
import { logAxis } from '../../core/plot/log-axis';
import { segmentsFrom, type StepSegment } from '../../core/plot/step-line';
import { REG } from '../boosting/data';
import { lrColorClass } from '../boosting/lr-color';
import { bestIndex, boostSegments, predictBoost, type BoostRun } from '../boosting/boost';
import { predictReg } from '../boosting/regtree';
import {
  gradyanArtirmaScenario,
  M_MAX,
  MAX_TREES,
  nuText,
  runFor,
  STEP8_NUS,
  sub,
  thresholdsOf,
  type GbParams,
} from './scenario';

/** x axis shared by both panels. */
export const X_DOMAIN: [number, number] = [0, 10];

/** Rows of the book's error table. */
export const BOOK_ROWS = 5;

/** The book's hand example (gerçek, tahmin, düzeltme and ν are the book's own, not data of this page). */
const HAND = 'Kitabın elle örneği: [3; 5] gerçek · [2; 4] tahmin · [2; 0] düzeltme · ν = 0,1 → [2 + 0,1 · 2; 4 + 0,1 · 0] = [2,2; 4]';

/** One training or validation point. */
export interface GbPoint {
  x: number;
  y: number;
}

/** One row of the book's table: `text` is "Adım k: 0,2952" once the row is filled, else "Adım k: —". */
export interface BookRow {
  k: number;
  filled: boolean;
  text: string;
}

/** Everything the two-panel scene draws. */
export interface PanelView {
  points: GbPoint[];
  valPoints: GbPoint[];
  /** The generating curve sin x on the plotting grid (faint reference). */
  sin: GbPoint[];
  /** Total prediction F as a step function; null before F₀ is introduced. */
  f: StepSegment[] | null;
  /** The previous F (faint) when one step moved it; else null. */
  fPrev: StepSegment[] | null;
  /** Residuals at the training points (what the next tree fits); empty before they are introduced. */
  residuals: { x: number; r: number }[];
  /** The tree's correction h as a step function, or null. */
  h: StepSegment[] | null;
  /** Thresholds of h, sorted. */
  thresholds: number[];
  /** Y domains of the top and bottom panel. */
  yTop: [number, number];
  yBottom: [number, number];
  /** The book's error table (step 6 only). */
  table: BookRow[] | null;
}

/** Step 9's top panel: the points and two F lines (soft = the dip's tree count, zig = M trees). */
export interface TopView {
  points: GbPoint[];
  valPoints: GbPoint[];
  soft: StepSegment[];
  zig: StepSegment[];
  softTrees: number;
  zigTrees: number;
  y: [number, number];
}

/** A label at the right end of a curve (ν = 0,3 / eğitim / doğrulama); `y` is in chart space. */
export interface EndLabel {
  id: string;
  text: string;
  y: number;
}

/**
 * The error chart of steps 7-9. It is drawn on log10 of the error (`chart.y` is in log space,
 * `chart.yFormat` writes the ticks back as decimals). `selectedId` is the series the Lab
 * emphasises (step 8); `labMarker` says the marker is a Lab-only control on that step.
 */
export interface ErrorView {
  chart: LineChartSpec;
  endLabels: EndLabel[];
  selectedId: string | null;
  labMarker: boolean;
  noDip: string | null;
  top: TopView | null;
}

/** One row of the book's bagging-boosting table. */
export interface CompareRow {
  label: string;
  bagging: string;
  boosting: string;
}

/** The comparison of step 10: two scheme rows, the book's table rows and the links. */
export interface CompareView {
  schemes: { id: 'bagging' | 'boosting'; title: string; note: string; out: string }[];
  rows: CompareRow[];
  links: { href: string; label: string }[];
}

/** Everything the scene draws for one step and parameter set. */
export interface GbView {
  stepId: string;
  kind: 'panels' | 'error' | 'compare';
  strip: string;
  panels: PanelView | null;
  error: ErrorView | null;
  compare: CompareView | null;
}

const SIN: GbPoint[] = Array.from({ length: 101 }, (_, i) => ({ x: i / 10, y: Math.sin(i / 10) }));

const yTop: [number, number] = [
  Math.floor(Math.min(...REG.train.y, -1) * 2) / 2,
  Math.ceil(Math.max(...REG.train.y, 1) * 2) / 2,
];
const rBound = Math.ceil(Math.max(...REG.train.y.map((y) => Math.abs(y - REG.mean))) * 2) / 2;
const yBottom: [number, number] = [-rBound, rBound];

/** F after `m` trees as a step function over the x axis. */
function fSegments(run: BoostRun, nu: number, m: number): StepSegment[] {
  return boostSegments(run, nu, m, X_DOMAIN[0], X_DOMAIN[1]);
}

/** Residuals y − F after `m` trees at the training points. */
function residualsAfter(run: BoostRun, nu: number, m: number): { x: number; r: number }[] {
  return REG.train.x.map((x, i) => ({ x, r: REG.train.y[i] - predictBoost(run, nu, x, m) }));
}

/** Tree number `k` (0-based) as a step function, cut at its own thresholds. */
function treeSegments(run: BoostRun, k: number): StepSegment[] {
  return segmentsFrom(thresholdsOf(run, k), (x) => predictReg(run.trees[k], x), X_DOMAIN[0], X_DOMAIN[1]);
}

const pts = (d: { x: readonly number[]; y: readonly number[] }): GbPoint[] => d.x.map((x, i) => ({ x, y: d.y[i] }));

/** Mean square error of the constant F₀ on the training set. */
function meanSquare0(run: BoostRun): number {
  return REG.train.y.reduce((s, y) => s + (y - run.f0) ** 2, 0) / REG.train.y.length;
}

/** Trees in F per panel step: none until the first correction is applied. */
function treesIn(id: string, p: GbParams): number {
  if (id === 'kucuk-adim' || id === 'tekrar') return Math.max(1, Math.min(M_MAX, Math.round(p.m)));
  return 0;
}

function panelsFor(id: string, p: GbParams): { panels: PanelView; strip: string } {
  const run = runFor(p.nu, p.depth);
  const m = treesIn(id, p);
  const showResiduals = id !== 'veri' && id !== 'baslangic';
  const showH = id === 'ilk-agac' || m >= 1;
  // the tree fitted at this moment: the first one, or number m (1-based) of the loop
  const tree = Math.max(0, m - 1);
  const table: BookRow[] | null =
    id === 'tekrar'
      ? Array.from({ length: BOOK_ROWS }, (_, i) => {
          const k = i + 1;
          const filled = k <= m;
          return { k, filled, text: `Adım ${k}: ${filled ? f(run.trainMse[k - 1], 4) : '—'}` };
        })
      : null;
  const panels: PanelView = {
    points: pts(REG.train),
    valPoints: p.showVal ? pts(REG.val) : [],
    sin: SIN,
    f: id === 'veri' ? null : fSegments(run, p.nu, m),
    fPrev: id === 'kucuk-adim' ? fSegments(run, p.nu, m - 1) : null,
    residuals: showResiduals ? residualsAfter(run, p.nu, Math.max(0, m - 1)) : [],
    h: showH ? treeSegments(run, tree) : null,
    thresholds: showH ? thresholdsOf(run, tree) : [],
    yTop,
    yBottom,
    table,
  };
  const mse = (k: number): string => f(k === 0 ? meanSquare0(run) : run.trainMse[k - 1], 4);
  const nu = nuText(p.nu);
  let strip: string;
  switch (id) {
    case 'veri':
      strip = `y = sin x + gürültü · ${REG.train.x.length} eğitim noktası`;
      break;
    case 'baslangic':
      strip = `F${sub(0)} = ȳ = ${f(run.f0, 4)} · ortalama kare hata = ${mse(0)}`;
      break;
    case 'artik':
      strip = `r = y − F${sub(0)} · ortalama kare hata = ${mse(0)}`;
      break;
    case 'ilk-agac':
      strip = `h${sub(1)} = ağaç(r) · eşikler ${panels.thresholds.map((t) => f(t, 3)).join('; ')}\nsigAgac.fit(girisDegerleri, artikHata)`;
      break;
    case 'kucuk-adim':
      strip = `F${sub(m)} = F${sub(m - 1)} + ${nu} · h${sub(m)} · ortalama kare hata = ${mse(m)}\n${HAND}`;
      break;
    default:
      strip = `F${sub(m)} = F${sub(m - 1)} + ${nu} · h${sub(m)} · ortalama kare hata = ${mse(m)}`;
  }
  return { panels, strip };
}


/** Error floor of the log chart: smaller errors are drawn on the bottom edge (the strip still prints them). */
const ERR_FLOOR = 1e-5;
const logErr = (v: number): number => Math.log10(Math.max(v, ERR_FLOOR));

/**
 * An error as the strip writes it: 4 decimals, more while it would read as zero. The one exception to
 * the 4-decimal rule: a near-zero training error (Lab, large ν with depth) would print as "0,000000"
 * or "0,0000", which reads as exactly zero, so below 5e-7 it prints "< 0,000001".
 */
export function errText(v: number): string {
  return v < 5e-7 ? '< 0,000001' : formatNonZero(v, 4);
}

const curve = (values: readonly number[]): [number, number][] => values.map((v, i) => [i + 1, logErr(v)]);

/** The dip of a validation curve as a pin; `last` says the minimum is the last tree (no dip yet). */
function dipPin(valMse: readonly number[]): { pin: { x: number; y: number; label: string }; last: boolean } {
  const at = bestIndex(valMse);
  return {
    pin: { x: at, y: logErr(valMse[at - 1]), label: `${at}. ağaç · ${errText(valMse[at - 1])}` },
    last: at === valMse.length,
  };
}

const NO_DIP = 'Henüz dip yok: daha çok ağaç dene';

/** Step 9's top panel; the y domain grows to hold every F value and point, on a 0,5 grid. */
function topFor(run: BoostRun, p: GbParams, trees: number): TopView {
  const best = bestIndex(run.valMse);
  const soft = fSegments(run, p.nu, best);
  const zig = fSegments(run, p.nu, trees);
  const ys = [...REG.train.y, ...REG.val.y, ...soft.map((s) => s.y), ...zig.map((s) => s.y), -1, 1];
  return {
    points: pts(REG.train),
    valPoints: p.showVal ? pts(REG.val) : [],
    soft,
    zig,
    softTrees: best,
    zigTrees: trees,
    y: [Math.floor(Math.min(...ys) * 2) / 2, Math.ceil(Math.max(...ys) * 2) / 2],
  };
}

/** Step 8: the three curves of the spec, plus the Lab's chosen ν as a fourth when it is another value. */
function learningRates(p: GbParams, trees: number): { error: ErrorView; strip: string } {
  const nus = STEP8_NUS.includes(p.nu) ? [...STEP8_NUS] : [...STEP8_NUS, p.nu];
  const runs = nus.map((v) => runFor(v, p.depth));
  const all = runs.flatMap((r) => r.valMse);
  const axis = logAxis(Math.min(...all) * 0.3, Math.max(...all) * 1.25);
  const dips = runs.map((r) => dipPin(r.valMse));
  const series: LineSeries[] = nus.map((v, i) => ({ id: `val-${v}`, cls: `val ${lrColorClass(v)}`, pts: curve(runs[i].valMse), dash: '8 5' }));
  const chosen = nus.indexOf(p.nu);
  const chart: LineChartSpec = {
    x: [1, MAX_TREES],
    y: axis.y,
    xTitle: 'ağaç sayısı M',
    yTitle: 'doğrulama hatası (log)',
    series,
    pins: dips.map((d) => d.pin),
    marker: { x: trees, y: logErr(runs[chosen].valMse[trees - 1]), label: `M = ${trees}` },
    xTicks: [1, 50, 100, 150, 200],
    yTicks: axis.ticks,
    yFormat: axis.format,
  };
  const dipText = nus.map((v, i) => `ν = ${nuText(v)}: ${dips[i].pin.label.replace(' · ', ', ')}`);
  return {
    error: {
      chart,
      endLabels: nus.map((v, i) => ({ id: series[i].id, text: `ν = ${nuText(v)}`, y: logErr(runs[i].valMse[MAX_TREES - 1]) })),
      selectedId: series[chosen].id,
      labMarker: true,
      noDip: dips[chosen].last ? NO_DIP : null,
      top: null,
    },
    strip: `${dipText.join(' · ')}\nderinlik ${p.depth}`,
  };
}

/** Steps 7 and 9: training and validation curves of one run, the dip pin and the M marker. */
function trainAndVal(id: string, p: GbParams, trees: number): { error: ErrorView; strip: string } {
  const run = runFor(p.nu, p.depth);
  const dip = dipPin(run.valMse);
  const axis = logAxis(ERR_FLOOR, Math.max(...run.valMse, ...run.trainMse) * 1.25);
  const chart: LineChartSpec = {
    x: [1, MAX_TREES],
    y: axis.y,
    xTitle: 'ağaç sayısı M',
    yTitle: 'ortalama kare hata (log)',
    series: [
      { id: 'train', cls: 'train', pts: curve(run.trainMse) },
      { id: 'val', cls: 'val', pts: curve(run.valMse), dash: '8 5' },
    ],
    pins: [dip.pin],
    marker: { x: trees, y: logErr(run.valMse[trees - 1]), label: `M = ${trees}` },
    xTicks: [1, 50, 100, 150, 200],
    yTicks: axis.ticks,
    yFormat: axis.format,
  };
  return {
    error: {
      chart,
      endLabels: [
        { id: 'train', text: 'eğitim', y: logErr(run.trainMse[MAX_TREES - 1]) },
        { id: 'val', text: 'doğrulama', y: logErr(run.valMse[MAX_TREES - 1]) },
      ],
      selectedId: null,
      labMarker: false,
      noDip: dip.last ? NO_DIP : null,
      top: id === 'ezber' ? topFor(run, p, trees) : null,
    },
    strip: `ν = ${nuText(p.nu)} · derinlik ${p.depth} · M = ${trees}\neğitim hatası = ${errText(run.trainMse[trees - 1])} · doğrulama hatası = ${errText(run.valMse[trees - 1])}`,
  };
}

/** Rows of the book's bagging-boosting table that the comparison shows (the book's own words). */
const COMPARE_ROWS: CompareRow[] = [
  { label: 'Ağaç kurma sırası', bagging: 'Paralel, bağımsız', boosting: 'Sıralı, bağımlı' },
  { label: 'Odaklandığı hata', bagging: 'Varyans', boosting: 'Yanlılık (bias)' },
  { label: 'Tipik zayıf öğrenici derinliği', bagging: 'Derin ağaçlar', boosting: 'Sığ ağaçlar (derinlik 3-8)' },
  { label: 'Aşırı öğrenme eğilimi', bagging: 'Düşük', boosting: 'Orta-yüksek (regularizasyon gerekir)' },
];

const COMPARE: CompareView = {
  schemes: [
    { id: 'bagging', title: 'Bagging', note: 'bağımsız derin ağaçlar → oy / ortalama · varyansı azaltır', out: 'ortalama' },
    { id: 'boosting', title: 'Boosting', note: 'sığ ağaçlar zinciri, her biri öncekinin artığına · yanlılığı azaltır, sırayla kurulur', out: 'F' },
  ],
  rows: COMPARE_ROWS,
  links: [
    { href: '../boosting-ayarlari/', label: 'Boosting ayarları: ν, derinlik ve arama' },
    { href: '../bagging/', label: 'Bölüm 9: bootstrap ve bagging' },
  ],
};

/** The view of step `index` for the parameters `p`. */
export function deriveGbView(index: number, p: GbParams): GbView {
  const id = gradyanArtirmaScenario.steps[index].id;
  if (id === 'bagging-karsi') {
    const strip = 'bagging: bağımsız derin ağaçlar → varyans · boosting: sığ ağaçlar zinciri → yanlılık';
    return { stepId: id, kind: 'compare', strip, panels: null, error: null, compare: COMPARE };
  }
  if (id === 'durma' || id === 'ogrenme-orani' || id === 'ezber') {
    const trees = Math.max(1, Math.min(MAX_TREES, Math.round(p.trees)));
    const e = id === 'ogrenme-orani' ? learningRates(p, trees) : trainAndVal(id, p, trees);
    return { stepId: id, kind: 'error', strip: e.strip, panels: null, error: e.error, compare: null };
  }
  const { panels, strip } = panelsFor(id, p);
  return { stepId: id, kind: 'panels', strip, panels, error: null, compare: null };
}
