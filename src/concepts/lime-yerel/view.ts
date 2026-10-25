import { formatNumber as f } from '../../core/plot/format';
import type { HBar } from '../../core/plot/hbars';
import { BINS, CLOUD, FEATURES, customerByRow, limeRun, type LimeResult, type Pattern } from '../xai/data';
import { kernelWeight, limeFit, patternDistance } from '../xai/lime';
import { BOOK_SEED, DOTS_PER_GROUP, cutTexts, limeYerelScenario as scenario, plainCharge, sumExpr, type LimeParams } from './scenario';

/** Which scene area draws the step (the last three are placeholders until the later steps are built). */
export type LimeKind = 'flow' | 'bins' | 'cloud' | 'kernel' | 'surrogate' | 'stability' | 'compare' | 'code';

/** One box of the flow strip (step 1). */
export interface FlowBox {
  id: 'komsuluk' | 'kara-kutu' | 'agirlik' | 'vekil';
  title: string;
  lines: string[];
}

/** One cut of a feature, as a number and as the text written at it. */
export interface BinCut {
  value: number;
  text: string;
}

/** One feature's number line of step 2: three cuts, four bins (`lo` / `hi` null at the open ends). */
export interface BinsRow {
  feature: 0 | 1 | 2;
  name: string;
  cuts: BinCut[];
  /** The four lime-style rule names. */
  rules: string[];
  /** Index of the customer's bin. */
  active: number;
  value: number;
  valueText: string;
  /** Domain of the number line: the cuts and the value, padded and rounded outward. */
  domain: [number, number];
}

/** One neighbourhood sample of the cloud (tenure, MonthlyCharges and the model's p). */
export interface CloudDot {
  x: number;
  y: number;
  p: number;
}

/** One row of the pattern table: three "same bin as the customer" marks, the sample count and the mean p. */
export interface PatternRow {
  mask: number;
  marks: [boolean, boolean, boolean];
  n: number;
  nText: string;
  meanText: string;
  /** Kernel weight text, only on the step-5 table. */
  weightText: string | null;
  empty: boolean;
}

/** Steps 3-4: the cloud (tenure x MonthlyCharges) with the bin grid, and from step 4 the pattern table. */
export interface CloudView {
  part: 'sample' | 'color';
  /** All dots of the run; `shown` of them are drawn. */
  dots: CloudDot[];
  shown: number;
  star: { x: number; y: number };
  /** Cut values on the two plotted axes. */
  gridX: number[];
  gridY: number[];
  /** The customer's cell on the plot: [x0, x1, y0, y1], open ends clipped to the domain. */
  cell: [number, number, number, number];
  domainX: [number, number];
  domainY: [number, number];
  rows: PatternRow[] | null;
  samples: number;
}

/** One kernel point of step 5: the distance, its weight and the patterns at that distance. */
export interface KernelPoint {
  d: number;
  dText: string;
  w: number;
  wText: string;
}

/** Step 5: the kernel curve with its four points, and the pattern table with a weight column. */
export interface KernelView {
  width: number;
  widthText: string;
  points: KernelPoint[];
  rows: PatternRow[];
  /** The curve, sampled over the distance axis. */
  curve: { d: number; w: number }[];
  domainD: [number, number];
}

/** Step 7: the model's p and the surrogate's local prediction side by side. */
export interface FidelityView {
  modelText: string;
  localText: string;
  r2Text: string;
  modelRatio: number;
  localRatio: number;
  sumText: string;
}

/** Steps 6-7: the three rule bars with the intercept and, in step 7, the fidelity panel. */
export interface SurrogateView {
  part: 'bars' | 'fit';
  rules: string[];
  bars: HBar[];
  max: number;
  interceptText: string;
  fidelity: FidelityView | null;
  fit: LimeResult;
}

/** Everything a scene draws for one (step, parameters) pair. */
export interface LimeView {
  kind: LimeKind;
  stepId: string;
  strip: string;
  customer: number;
  flow: FlowBox[] | null;
  bins: BinsRow[] | null;
  cloud: CloudView | null;
  kernel: KernelView | null;
  surrogate: SurrogateView | null;
}

const f3 = (v: number): string => (Number.isFinite(v) ? f(v, 3) : '—');
const signed = (v: number): string => (v > 0 ? `+${f3(v)}` : f3(v));

/** The book's code 05 lines (explainer), shown in the strip of step 1. */
export const KOD05_LINES = [
  'lime_aciklayici = LimeTabularExplainer(…, mode="classification", random_state=42)',
  'lime_aciklamasi = lime_aciklayici.explain_instance(musteri, predict_proba, num_features=3)',
];

/** Row order of the pattern tables: by distance from the customer (all three marks first). */
export const PATTERN_ORDER = [7, 6, 5, 3, 4, 2, 1, 0];

const empty = (kind: LimeKind, stepId: string, strip: string, customer: number): LimeView => ({
  kind,
  stepId,
  strip,
  customer,
  flow: null,
  bins: null,
  cloud: null,
  kernel: null,
  surrogate: null,
});

/** The prepared run of the customer at seed 42 and `samples` samples. */
function runOf(p: LimeParams, samples = p.samples) {
  return limeRun(p.customer, BOOK_SEED, samples);
}

/** Domain that holds `values` plus half their span, rounded outward to a power-of-ten step. */
function paddedDomain(values: readonly number[]): [number, number] {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const step = 10 ** Math.floor(Math.log10(span));
  return [Math.floor((lo - span / 2) / step) * step, Math.ceil((hi + span / 2) / step) * step];
}

/**
 * Domain that holds `values` with a small margin (`frac` of their span at each end): the drawn data decide the
 * axis. A quantity that is never negative in the data does not get a negative end.
 */
export function tightDomain(values: readonly number[], frac = 0.04): [number, number] {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo || 1) * frac;
  return [lo >= 0 ? Math.max(0, lo - pad) : lo - pad, hi + pad];
}

function valueText(feature: number, v: number): string {
  return feature === 0 ? f(v, 0) : plainCharge(v);
}

function flowView(p: LimeParams): FlowBox[] {
  const c = customerByRow(p.customer);
  const run = runOf(p);
  return [
    { id: 'komsuluk', title: 'Komşuluk üret', lines: [`${run.samples} örnek`, 'bölme sıklığıyla'] },
    { id: 'kara-kutu', title: 'Kara kutuya sor', lines: [`müşteri ${c.row}: p = ${f3(c.p)}`, 'her örnek için p(ayrılma)'] },
    { id: 'agirlik', title: 'Yakınlığa göre tart', lines: [`w = ${f3(p.width)}`, 'yakın örnek daha çok sayılır'] },
    { id: 'vekil', title: 'Basit model uydur', lines: ['ağırlıklı Ridge', `${FEATURES.length} kural`] },
  ];
}

function binsView(p: LimeParams): BinsRow[] {
  const c = customerByRow(p.customer);
  const run = runOf(p);
  return ([0, 1, 2] as const).map((feature) => {
    const texts = cutTexts(feature);
    const cuts = BINS.cuts[feature].map((value, k) => ({ value, text: texts[k] }));
    return {
      feature,
      name: FEATURES[feature],
      cuts,
      rules: BINS.names[feature],
      active: run.bins[feature],
      value: c.values[feature],
      valueText: valueText(feature, c.values[feature]),
      domain: paddedDomain([...BINS.cuts[feature], c.values[feature]]),
    };
  });
}

/** Rows of the pattern table; `width` adds the kernel weight column. */
export function patternRows(patterns: readonly Pattern[], width: number | null): PatternRow[] {
  return PATTERN_ORDER.map((mask) => {
    const pat = patterns[mask];
    return {
      mask,
      marks: [(mask & 1) === 1, (mask & 2) === 2, (mask & 4) === 4],
      n: pat.n,
      nText: pat.n > 0 ? f(pat.n, 0) : '0 örnek',
      meanText: pat.n > 0 ? f3(pat.mean) : '—',
      weightText: width === null ? null : f3(kernelWeight(patternDistance(mask), width)),
      empty: pat.n === 0,
    };
  });
}

function cloudView(p: LimeParams, stepId: string): LimeView {
  const c = customerByRow(p.customer);
  const cloud = CLOUD[p.customer];
  const part = stepId === 'komsuluk' ? 'sample' : 'color';
  const dots = cloud.values.map((v, i) => ({ x: v[0], y: v[1], p: cloud.p[i] }));
  const groups = Math.min(Math.ceil(dots.length / DOTS_PER_GROUP), Math.max(1, p.scan));
  const shown = part === 'sample' ? Math.min(dots.length, groups * DOTS_PER_GROUP) : dots.length;
  const run = runOf(p, 5000);
  const domainX = tightDomain([...dots.map((d) => d.x), ...BINS.cuts[0], c.values[0]]);
  const domainY = tightDomain([...dots.map((d) => d.y), ...BINS.cuts[1], c.values[1]]);
  // the customer's cell: the bin edges, open ends running to the domain
  const edge = (feature: 0 | 1, domain: [number, number]): [number, number] => {
    const k = run.bins[feature];
    const cuts = BINS.cuts[feature];
    return [k === 0 ? domain[0] : cuts[k - 1], k === 3 ? domain[1] : cuts[k]];
  };
  const cx = edge(0, domainX);
  const cy = edge(1, domainY);
  const strip =
    part === 'sample'
      ? `${run.samples} örnekten ilk ${dots.length} · yıldız = müşteri ${c.row} · ızgara = kartil sınırları`
      : `nokta rengi = modelin p(ayrılma) değeri · her örnek ${run.patterns.length} desenden birine iner`;
  const view = empty('cloud', stepId, strip, c.row);
  view.cloud = {
    part,
    dots,
    shown,
    star: { x: c.values[0], y: c.values[1] },
    gridX: [...BINS.cuts[0]],
    gridY: [...BINS.cuts[1]],
    cell: [cx[0], cx[1], cy[0], cy[1]],
    domainX,
    domainY,
    rows: part === 'color' ? patternRows(run.patterns, null) : null,
    samples: run.samples,
  };
  return view;
}

function kernelView(p: LimeParams, stepId: string): LimeView {
  const c = customerByRow(p.customer);
  const run = runOf(p);
  const points = [0, 1, 2, 3].map((n) => {
    const d = Math.sqrt(n);
    const w = kernelWeight(d, p.width);
    return { d, dText: n === 0 ? '0' : n === 1 ? '1' : `√${n}`, w, wText: f3(w) };
  });
  // the distance axis ends just after the largest distance
  const domainD: [number, number] = [0, Math.max(...points.map((q) => q.d)) * 1.05];
  const curve = Array.from({ length: 41 }, (_, i) => {
    const d = (domainD[1] * i) / 40;
    return { d, w: kernelWeight(d, p.width) };
  }).filter((q) => Number.isFinite(q.w));
  const strip = [
    `w = ${f3(p.width)} · ağırlık = √exp(−d² / w²)`,
    points.map((q) => `d = ${q.dText} → ${q.wText}`).join(' · '),
  ].join('\n');
  const view = empty('kernel', stepId, strip, c.row);
  view.kernel = { width: p.width, widthText: f3(p.width), points, rows: patternRows(run.patterns, p.width), curve, domainD };
  return view;
}

/** The surrogate fit of the chosen run at the chosen kernel width (the stored fit at the default width). */
export function fitOf(p: LimeParams): LimeResult {
  return limeFit(runOf(p).patterns, p.width);
}

function surrogateView(p: LimeParams, stepId: string): LimeView {
  const c = customerByRow(p.customer);
  const run = runOf(p);
  const fit = fitOf(p);
  const rules = FEATURES.map((_, j) => BINS.names[j][run.bins[j]]);
  const bars: HBar[] = fit.coef.map((v, j) => ({
    id: `lime-${j}`,
    row: j,
    slot: 0,
    cls: v >= 0 ? 'is-pos' : 'is-neg',
    value: Math.abs(v),
    text: signed(v),
    label: '',
    attrs: { feature: j, sign: v >= 0 ? 'pos' : 'neg' },
  }));
  const part = stepId === 'vekil' ? 'bars' : 'fit';
  const sum = sumExpr([fit.intercept, ...fit.coef]);
  const strip =
    part === 'bars'
      ? 'vekil = kesişim + Σ katsayı · işaret (işaret 1: müşteri o bölmede)'
      : `vekil tahmini = ${sum} = ${f3(fit.localPred)} · model p = ${f3(c.p)}`;
  const ratio = (v: number): number => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
  const view = empty('surrogate', stepId, strip, c.row);
  view.surrogate = {
    part,
    rules,
    bars,
    max: Math.max(1e-9, ...fit.coef.map((v) => Math.abs(v))),
    interceptText: f3(fit.intercept),
    fidelity:
      part === 'fit'
        ? {
            modelText: f3(c.p),
            localText: f3(fit.localPred),
            r2Text: fit.score === null ? '—' : f3(fit.score),
            modelRatio: ratio(c.p),
            localRatio: ratio(fit.localPred),
            sumText: `${sum} = ${f3(fit.localPred)}`,
          }
        : null,
    fit,
  };
  return view;
}

/** Everything a scene draws for step `index` with parameters `p`. */
export function deriveLimeView(index: number, p: LimeParams): LimeView {
  const id = scenario.steps[index].id;
  switch (id) {
    case 'yerel-soru': {
      const view = empty('flow', id, KOD05_LINES.join('\n'), p.customer);
      view.flow = flowView(p);
      return view;
    }
    case 'kartil': {
      const rows = binsView(p);
      const view = empty('bins', id, rows.map((r) => r.rules[r.active]).join(' · '), p.customer);
      view.bins = rows;
      return view;
    }
    case 'komsuluk':
    case 'ikili':
      return cloudView(p, id);
    case 'cekirdek':
      return kernelView(p, id);
    case 'vekil':
    case 'sadakat':
      return surrogateView(p, id);
    case 'kararlilik':
      return empty('stability', id, '', p.customer);
    case 'shap-lime':
      return empty('compare', id, '', p.customer);
    case 'hata-ayiklama':
      return empty('code', id, '', p.customer);
    default:
      throw new RangeError(`no view for step "${id}"`);
  }
}

