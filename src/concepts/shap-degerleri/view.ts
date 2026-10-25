import { formatNumber as f, formatPercent } from '../../core/plot/format';
import type { HBar } from '../../core/plot/hbars';
import type { WaterfallSpec } from '../../core/plot/waterfall';
import { CUSTOMERS, customerByRow, FEATURES, MODEL, PRESETS, type Customer, type FeatureIndex } from '../xai/data';
import { marginals, orderings, popcount, shapleyWeight } from '../xai/shapley';
import { FILL_ORDER, fraction, plainCharge, tenureCorrelation, valueRanks } from './calc';
import { TREES, shapDegerleriScenario as scenario, type ShapParams } from './scenario';

/** Which scene area draws the step. */
export type ShapKind = 'card' | 'bars' | 'lattice' | 'waterfall' | 'force' | 'swarm' | 'cards';

/** The customer card: three values (names in code font), p and the p bar. */
export interface CardView {
  row: number;
  features: { name: string; value: string }[];
  p: string;
  ratio: number;
  /** Test accuracy text, shown on step 1 only. */
  accuracy: string | null;
}

/** One group of horizontal bars (`HBarsLayer`). */
export interface BarGroup {
  id: 'imp' | 'mean-shap';
  title: string;
  bars: HBar[];
  max: number;
}

/** Steps 2 and 8: importance bars, with the customer card beside them (step 2) or the mean |SHAP| bars (step 8). */
export interface BarsView {
  card: CardView | null;
  groups: BarGroup[];
}

/** One coalition node of the lattice. */
export interface LatticeNode {
  mask: number;
  layer: number;
  /** Full feature names in the coalition (empty for the empty set). */
  names: string[];
  value: number;
  v: string;
  filled: boolean;
}

/** One edge: the feature `feature` joins the coalition `from`. `delta` is the marginal contribution on a path edge. */
export interface LatticeEdge {
  from: number;
  to: number;
  feature: FeatureIndex;
  path: boolean;
  delta: string | null;
  visible: boolean;
}

/** One row of the ordering table: the three marginal contributions in feature order. */
export interface OrderRow {
  index: number;
  order: FeatureIndex[];
  text: string;
  marginals: [string, string, string];
  filled: boolean;
}

/** The coalition lattice (steps 3-5) with, in step 5, the ordering table and the column means. */
export interface LatticeView {
  part: 'coalitions' | 'path' | 'orders';
  nodes: LatticeNode[];
  edges: LatticeEdge[];
  /** Masks of the highlighted ordering path (step 4). */
  path: number[] | null;
  orders: OrderRow[] | null;
  /** Column means over the filled rows ("—" when none), and as numbers. */
  means: string[] | null;
  meanValues: number[] | null;
}

/** Step 6: the waterfall of one customer. */
export interface WaterfallView {
  customer: number;
  spec: WaterfallSpec;
}

/** Step 7: two force bars on one shared axis. */
export interface ForceView {
  rows: { row: 0 | 1; customer: number; spec: WaterfallSpec }[];
  domain: [number, number];
}

/** One dot of the summary plot: `t` is the value rank 0..1 that sets its colour. */
export interface SwarmDot {
  row: number;
  x: number;
  t: number;
  highlight: boolean;
}

/** Step 9: the summary plot. */
export interface SwarmView {
  rows: { feature: FeatureIndex; name: string; dots: SwarmDot[] }[];
  xDomain: [number, number];
  /** -1: each row colours by its own feature. */
  colorBy: number;
  colorName: string;
  highlight: number;
  note: string;
}

/** Step 10: four text cards and the closing links. */
export interface CardsView {
  cards: { kind: 'yerel-global' | 'nedensellik' | 'olcek' | 'sizinti'; title: string; text: string }[];
  links: { href: string; text: string }[];
}

/** Everything a scene draws for one (step, parameters) pair. */
export interface ShapView {
  kind: ShapKind;
  stepId: string;
  strip: string;
  card: CardView | null;
  bars: BarsView | null;
  lattice: LatticeView | null;
  waterfall: WaterfallView | null;
  force: ForceView | null;
  swarm: SwarmView | null;
  cards: CardsView | null;
}

const f3 = (v: number): string => f(v, 3);
const signed = (v: number): string => (v > 0 ? `+${f3(v)}` : f3(v));
const all = orderings();
const FULL = (1 << FEATURES.length) - 1;

/** The book's code 01 lines (model, fit, probability), shown in the strip of step 1. */
export const KOD01_LINES = [
  `kara_kutu_modeli = RandomForestClassifier(n_estimators=${TREES}, random_state=42)`,
  'kara_kutu_modeli.fit(egitim_ozellikleri, egitim_hedefi)',
  'ayrilma_olasiligi = kara_kutu_modeli.predict_proba(musteri)[0, 1]',
];

/** "=" when the 3-decimal parts add up to the 3-decimal total, otherwise "≈" (rounding of the shown numbers). */
const eq = (parts: readonly number[], total: number): '=' | '≈' =>
  f3(parts.map((v) => Number(v.toFixed(3))).reduce((s, v) => s + v, 0)) === f3(total) ? '=' : '≈';

const empty = (kind: ShapKind, stepId: string, strip: string): ShapView => ({
  kind,
  stepId,
  strip,
  card: null,
  bars: null,
  lattice: null,
  waterfall: null,
  force: null,
  swarm: null,
  cards: null,
});

function cardOf(c: Customer, withAccuracy: boolean): CardView {
  return {
    row: c.row,
    features: FEATURES.map((name, i) => ({ name, value: i === 0 ? f(c.values[i], 0) : plainCharge(f(c.values[i], 2)) })),
    p: f3(c.p),
    ratio: Math.max(0, Math.min(1, c.p)),
    accuracy: withAccuracy ? formatPercent(MODEL.accuracy, 1) : null,
  };
}

function importanceGroup(): BarGroup {
  return {
    id: 'imp',
    title: 'Ormanın önemi (feature_importances_)',
    max: Math.max(...MODEL.importances),
    bars: FEATURES.map((name, i) => ({
      id: `imp-${i}`,
      row: i,
      slot: 0,
      cls: 'imp-bar',
      value: MODEL.importances[i],
      text: f3(MODEL.importances[i]),
      label: name,
      attrs: { feature: i },
    })),
  };
}

function meanShapGroup(): BarGroup {
  return {
    id: 'mean-shap',
    title: 'Ortalama |SHAP| (olasılık birimi)',
    max: Math.max(...MODEL.meanAbsShap),
    bars: FEATURES.map((name, i) => ({
      id: `shap-${i}`,
      row: i,
      slot: 0,
      cls: 'mean-shap-bar',
      value: MODEL.meanAbsShap[i],
      text: f3(MODEL.meanAbsShap[i]),
      label: name,
      attrs: { feature: i },
    })),
  };
}

const orderText = (o: readonly number[]): string => o.map((i) => FEATURES[i]).join(' → ');

/** The weighted-subset formula of the book with the numbers of feature 0 (tenure), as two strip lines. */
function formulaStrip(c: Customer, phi: number): string {
  const feature = 0;
  const terms: string[] = [];
  const parts: number[] = [];
  for (let mask = 0; mask <= FULL; mask++) {
    if (mask & (1 << feature)) {
      continue;
    }
    const delta = c.v[mask | (1 << feature)] - c.v[mask];
    terms.push(`${fraction(shapleyWeight(popcount(mask), FEATURES.length))} · ${f3(delta)}`);
    parts.push(shapleyWeight(popcount(mask), FEATURES.length) * delta);
  }
  return [
    'φᵢ = Σ |S|! (|F| − |S| − 1)! / |F|! · [v(S ∪ {i}) − v(S)]',
    `φ(${FEATURES[feature]}) = ${terms.join(' + ')} = ${f3(phi)}`,
  ].join('\n');
}

function latticeView(id: string, p: ShapParams): ShapView {
  const c = customerByRow(p.customer);
  const part = id === 'koalisyon' ? 'coalitions' : id === 'marjinal' ? 'path' : 'orders';
  const scan = p.scan;
  const rank = (mask: number): number => FILL_ORDER.indexOf(mask);
  const nodes: LatticeNode[] = FILL_ORDER.map((mask) => ({
    mask,
    layer: popcount(mask),
    names: FEATURES.filter((_, i) => mask & (1 << i)),
    value: c.v[mask],
    v: f3(c.v[mask]),
    filled: part !== 'coalitions' || rank(mask) < scan,
  })).sort((a, b) => a.mask - b.mask);
  const o = all[Math.max(0, Math.min(all.length - 1, p.order))];
  const path = part === 'path' ? o.reduce<number[]>((acc, i) => [...acc, acc[acc.length - 1] | (1 << i)], [0]) : null;
  const edges: LatticeEdge[] = [];
  for (let from = 0; from <= FULL; from++) {
    for (const feature of [0, 1, 2] as const) {
      if (from & (1 << feature)) {
        continue;
      }
      const to = from | (1 << feature);
      const onPath = path !== null && path.some((m, k) => m === from && path[k + 1] === to);
      edges.push({
        from,
        to,
        feature,
        path: onPath,
        delta: onPath ? signed(c.v[to] - c.v[from]) : null,
        visible: nodes[from].filled && nodes[to].filled,
      });
    }
  }
  let orders: OrderRow[] | null = null;
  let means: string[] | null = null;
  let meanValues: number[] | null = null;
  if (part === 'orders') {
    orders = all.map((order, index) => {
      const m = marginals(c.v, order);
      return { index, order, text: orderText(order), marginals: [signed(m[0]), signed(m[1]), signed(m[2])], filled: index < scan };
    });
    const rows = all.map((order) => marginals(c.v, order)).filter((_, index) => index < scan);
    meanValues = FEATURES.map((_, i) => (rows.length > 0 ? rows.reduce((s, m) => s + m[i], 0) / rows.length : Number.NaN));
    means = meanValues.map((v) => (Number.isNaN(v) ? '—' : f3(v)));
  }
  let strip: string;
  if (part === 'coalitions') {
    strip = [
      'v(S) = S içindeki özellikler bilinirken ormanın beklenen tahmini',
      `v(∅) = ${f3(c.v[0])} · v({${FEATURES[0]}}) = ${f3(c.v[1])} · v(hepsi) = ${f3(c.v[FULL])}`,
    ].join('\n');
  } else if (part === 'path') {
    const m = marginals(c.v, o);
    const seq = o.map((i) => signed(m[i]));
    const sym = eq(m, c.p - c.v[0]);
    strip = [
      `${orderText(o)}: ${seq.join(' + ')} ${sym} ${f3(c.p - c.v[0])}`,
      `toplam ${f3(c.p - c.v[0])} = ${f3(c.p)} − ${f3(c.v[0])}`,
    ].join('\n');
    if (sym === '≈') {
      strip += '\n(≈: gösterilen değerler 3 ondalığa yuvarlanmıştır)';
    }
  } else {
    strip = formulaStrip(c, c.shap[0]);
  }
  return { ...empty('lattice', id, strip), lattice: { part, nodes, edges, path, orders, means, meanValues } };
}

function forceSpec(c: Customer, title: string, axis: boolean): WaterfallSpec {
  return {
    base: MODEL.base,
    parts: FEATURES.map((name, i) => ({ id: name, label: name, value: c.shap[i] })),
    total: c.p,
    domain: [0, 1],
    mode: 'force',
    title,
    baseLabel: 'temel',
    totalLabel: 'p',
    axis,
  };
}

/** Left and right edge of a force bar: positives stack leftward from p, negatives rightward. */
function forceExtent(c: Customer): [number, number] {
  const pos = c.shap.filter((v) => v >= 0).reduce((s, v) => s + v, 0);
  const neg = c.shap.filter((v) => v < 0).reduce((s, v) => s + v, 0);
  return [c.p - pos, c.p - neg];
}

/** Sum line "φ₀ + φ₁ + … = p" with the signs written out. */
function sumLine(c: Customer): string {
  const terms = c.shap.map((v) => (v < 0 ? `− ${f3(-v)}` : `+ ${f3(v)}`)).join(' ');
  return `${f3(MODEL.base)} ${terms} ${eq([MODEL.base, ...c.shap], c.p)} ${f3(c.p)}`.replace(/\+ \+/g, '+');
}

function forceView(id: string, p: ShapParams): ShapView {
  const a = customerByRow(p.customer);
  const b = customerByRow(p.second);
  const extents = [a, b].map(forceExtent);
  const lo = Math.min(0, ...extents.map((e) => Math.floor(e[0] * 10 + 1e-9) / 10));
  const hi = Math.max(1, ...extents.map((e) => Math.ceil(e[1] * 10 - 1e-9) / 10));
  const domain: [number, number] = [lo, hi];
  const rows = ([a, b] as const).map((c, i) => ({
    row: i as 0 | 1,
    customer: c.row,
    spec: { ...forceSpec(c, `Müşteri ${c.row} · p = ${f3(c.p)}`, i === 1), domain },
  }));
  const strip = ['Turuncu ayrılmaya iter, mavi kalmaya çeker.', `müşteri ${a.row}: ${sumLine(a)}`, `müşteri ${b.row}: ${sumLine(b)}`].join('\n');
  return { ...empty('force', id, strip), force: { rows, domain } };
}

function swarmView(id: string, p: ShapParams): ShapView {
  const ranks = [valueRanks(0), valueRanks(1), valueRanks(2)];
  const rows = ([0, 1, 2] as const).map((feature) => {
    const by = p.colorBy >= 0 && p.colorBy <= 2 ? p.colorBy : feature;
    return {
      feature,
      name: FEATURES[feature],
      dots: CUSTOMERS.map((c) => ({ row: c.row, x: c.shap[feature], t: ranks[by].get(c.row)!, highlight: c.row === p.highlight })),
    };
  });
  const xs = rows.flatMap((r) => r.dots.map((d) => d.x));
  const xDomain: [number, number] = [Math.floor(Math.min(...xs) * 10 + 1e-9) / 10, Math.ceil(Math.max(...xs) * 10 - 1e-9) / 10];
  const r = tenureCorrelation();
  const note = `${FEATURES[0]} değeri ile katkısı arasındaki korelasyon ${f(r, 2)}. Kitabın metni kısa süreli müşterilerin sağda olduğunu söyler; ${
    r > 0 ? 'bu veride tersi görülür.' : 'bu veride de böyle görülür.'
  }`;
  const colorName = p.colorBy >= 0 && p.colorBy <= 2 ? `${FEATURES[p.colorBy]} değeri` : 'her satırın kendi özelliğinin değeri';
  const strip = 'her nokta bir test müşterisi · konum = SHAP · renk = özellik değeri (düşük mavi, yüksek kırmızı-pembe)';
  return { ...empty('swarm', id, strip), swarm: { rows, xDomain, colorBy: p.colorBy, colorName, highlight: p.highlight, note } };
}

function cardsView(id: string): ShapView {
  const mid = customerByRow(PRESETS[2]);
  const top = mid.shap.reduce((best, v, i) => (Math.abs(v) > Math.abs(mid.shap[best]) ? i : best), 0);
  const topGlobal = MODEL.meanAbsShap.reduce((best, v, i) => (v > MODEL.meanAbsShap[best] ? i : best), 0);
  return {
    ...empty('cards', id, 'global ≠ yerel · katkı ≠ neden · ölçek: olasılık'),
    cards: {
      cards: [
        {
          kind: 'yerel-global',
          title: 'Global ≠ yerel',
          text: `Global sırada ${FEATURES[topGlobal]} birinci; ama müşteri ${mid.row} için en büyük katkı ${FEATURES[top]} (${signed(mid.shap[top])}), ${FEATURES[0]} ${signed(mid.shap[0])}.`,
        },
        {
          kind: 'nedensellik',
          title: 'Nedensellik değil',
          text: 'Açıklama modelin neyi kullandığını gösterir; gerçek dünyada neyin ayrılmaya yol açtığını göstermez.',
        },
        {
          kind: 'olcek',
          title: 'Ölçek',
          text: 'Bu modelde (Random Forest, predict_proba) katkı olasılık birimidir. XGBoost çıktısı log-odds ölçeğindedir; orada katkılar olasılığa doğrudan toplanmaz.',
        },
        {
          kind: 'sizinti',
          title: 'Sızıntı',
          text: 'Yüksek katkılı bir özellik önce hedefle nasıl hesaplandığına bakılarak denetlenir: hedeften türemiş bir sütun açıklamada da en büyük görünür.',
        },
      ],
      links: [
        { href: '../lime-yerel/', text: 'LIME: yerel vekil model ve SHAP ile karşılaştırma' },
        { href: '../random-forest/', text: 'Random Forest, OOB ve öznitelik önemi (Bölüm 9)' },
      ],
    },
  };
}

/** Everything a scene draws for step `index` with parameters `p`. */
export function deriveShapView(index: number, p: ShapParams): ShapView {
  const id = scenario.steps[index].id;
  switch (id) {
    case 'kara-kutu': {
      const c = customerByRow(p.customer);
      return { ...empty('card', id, KOD01_LINES.join('\n')), card: cardOf(c, true) };
    }
    case 'genel-onem': {
      const c = customerByRow(p.customer);
      const strip = `feature_importances_ ${FEATURES.map((name, i) => `${name} ${f3(MODEL.importances[i])}`).join(' · ')}`;
      return { ...empty('bars', id, strip), bars: { card: cardOf(c, false), groups: [importanceGroup()] } };
    }
    case 'koalisyon':
    case 'marjinal':
    case 'alti-siralama':
      return latticeView(id, p);
    case 'toplam': {
      const c = customerByRow(p.customer);
      const spec: WaterfallSpec = {
        base: MODEL.base,
        parts: FEATURES.map((name, i) => ({ id: name, label: name, value: c.shap[i] })),
        total: c.p,
        domain: [0, 1],
        mode: 'waterfall',
        baseLabel: 'φ₀ temel değer',
        totalLabel: 'p(ayrılma)',
      };
      const strip = ['φ₀ + Σ φ = p', sumLine(c)].join('\n');
      return { ...empty('waterfall', id, strip), waterfall: { customer: c.row, spec } };
    }
    case 'kuvvet':
      return forceView(id, p);
    case 'global': {
      const strip = `ortalama |SHAP| ${FEATURES.map((name, i) => `${name} ${f3(MODEL.meanAbsShap[i])}`).join(' · ')}`;
      return { ...empty('bars', id, strip), bars: { card: null, groups: [importanceGroup(), meanShapGroup()] } };
    }
    case 'ozet-grafik':
      return swarmView(id, p);
    case 'sinirlar':
      return cardsView(id);
    default:
      throw new RangeError(`no view for step "${id}"`);
  }
}
