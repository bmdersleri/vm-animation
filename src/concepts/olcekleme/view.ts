import { formatNonZero, formatNumber } from '../../core/plot/format';
import type { AspectAnchor, Domain } from '../../core/plot/viewport';
import { CUSTOMERS, RAW, SPLIT } from './data';
import { fitMinMax, fitRobust, fitStandard, transform } from './scalers';
import type { Fit, OlcParams } from './scenario';
import { olceklemeScenario } from './scenario';
import {
  churnRate, distances, fitSplit, nearest, rawPoint, UNIT_FACTOR, UNIT_NAME, Z_FIT, zPoint, type Pt2, type Unit,
} from './space';

export type OlcPart = 1 | 2 | 3;
export type Space = 'ham' | 'kaydir' | 'z';

export interface CustView { id: string; x: number; y: number; d: number; nearest: boolean }
export interface ScatterView {
  unit: Unit;
  space: Space;
  /** ham/kaydir: px ratio of the RAW month box; z: 1. */
  aspect: 'ay-orani' | 'esit';
  /** The RAW box in this space: the drag limit (drawn faintly in Lab where it is not the plot frame). */
  box: Domain;
  /**
   * The domain the plot is fitted to. ham: the RAW box, widened from its
   * minimum (no negative tenure or bill on the axes). Steps 1-5 share one
   * frame holding both the raw and the centred cloud, so the scale never
   * changes between them and x − μ is a visible move. z: the z box, widened from its centre.
   */
  frame: Domain;
  anchor: AspectAnchor;
  customers: CustView[];
  query: { x: number; y: number; label: string };
  /** Ders: index >= 1; the Lab scene always shows the query. */
  queryShown: boolean;
  lines: boolean;
  iso: { r: number } | null;
  mu: { x: number; y: number; sx: number; sy: number; labels: [string, string] } | null;
  axisTitles: { x: string; y: string };
}
export interface ScalerLine { name: 'StandardScaler' | 'MinMaxScaler' | 'RobustScaler'; values: number[]; labels: string[] }
export interface SplitView {
  values: number[];
  /** Indices into `values`. */
  train: number[];
  /** Indices into `values`. */
  test: number[];
  separated: boolean;
  fadeTest: boolean;
  fit: { scope: Fit; mu: number; sigma: number } | null;
  ghostMu: number | null;
  testZ: string[] | null;
  flow: boolean;
}
export interface TableView {
  unitName: string;
  scaled: boolean;
  rows: { id: string; t: string; f: string; zt: string | null; zf: string | null; d: string; nearest: boolean }[];
  query: { t: string; f: string; zt: string | null; zf: string | null };
}
export interface OlcView {
  part: OlcPart;
  stepId: string;
  kind: 'scatter' | 'scalers' | 'split';
  scatter: ScatterView | null;
  scalers: { lines: ScalerLine[]; domain: [number, number] } | null;
  split: SplitView | null;
  table: TableView | null;
  strip: string;
}

const f2 = (x: number): string => formatNonZero(x, 2);
/** Whole numbers print without decimals ("55", "1.800"); others like f2. */
const num = (x: number): string => {
  const r = Math.round(x);
  return Math.abs(x - r) < 1e-9 ? formatNumber(r, 0) : f2(x);
};
/** Subtrahend: a negative number is parenthesised. */
const sub = (b: number): string => (b < 0 ? `(${num(b)})` : num(b));
const minus = (a: number, b: number): string => `${num(a)} − ${sub(b)}`;

const TOTAL = olceklemeScenario.steps.length;
const BOX: Domain = { x: [RAW.x[0], RAW.x[1]], y: [RAW.y[0], RAW.y[1]] };
const FATURA = CUSTOMERS.map((c) => c.f);

const partOf = (index: number): OlcPart => (index <= 2 ? 1 : index <= 8 ? 2 : 3);
const kindOf = (index: number): OlcView['kind'] => (index === 7 ? 'scalers' : index >= 9 ? 'split' : 'scatter');
const spaceOf = (p: OlcParams): Space => (p.scaling === 'standard' ? 'z' : p.scaling === 'kaydir' ? 'kaydir' : 'ham');

/** Mean/sigma labels, tenure scaled to the unit. */
function muLabels(unit: Unit): [string, string] {
  const k = UNIT_FACTOR[unit];
  return [
    `μ = ${num(Z_FIT.t.center * k)}, σ = ${num(Z_FIT.t.scale * k)}`,
    `μ = ${num(Z_FIT.f.center)}, σ = ${num(Z_FIT.f.scale)}`,
  ];
}

interface Geo { pt: (c: { t: number; f: number }) => Pt2; box: Domain; frame: Domain; anchor: AspectAnchor; ds: number[]; qp: Pt2 }

/**
 * Steps 1-5 (data, distance, nearest, μ, x − μ): one shared frame, so the cloud keeps its size from step to step
 * and the centring is a translation on screen.
 */
const SHARED_FRAME_STEPS: readonly number[] = [0, 1, 2, 3, 4];

function geometry(index: number, p: OlcParams, space: Space): Geo {
  const k = UNIT_FACTOR[p.unit];
  let pt: (c: { t: number; f: number }) => Pt2;
  let box: Domain;
  if (space === 'z') {
    pt = (c) => zPoint(c);
    box = {
      x: [transform(Z_FIT.t, BOX.x[0]), transform(Z_FIT.t, BOX.x[1])],
      y: [transform(Z_FIT.f, BOX.y[0]), transform(Z_FIT.f, BOX.y[1])],
    };
  } else {
    const dx = space === 'kaydir' ? Z_FIT.t.center * k : 0;
    const dy = space === 'kaydir' ? Z_FIT.f.center : 0;
    pt = (c) => {
      const [x, y] = rawPoint(c, p.unit);
      return [x - dx, y - dy];
    };
    box = { x: [BOX.x[0] * k - dx, BOX.x[1] * k - dx], y: [BOX.y[0] - dy, BOX.y[1] - dy] };
  }
  let frame = box;
  let anchor: AspectAnchor = space === 'ham' ? 'min' : 'centre';
  if (space !== 'z' && SHARED_FRAME_STEPS.includes(index)) {
    // raw box ∪ centred box, widened from its minimum like the raw views
    const mx = Z_FIT.t.center * k;
    const my = Z_FIT.f.center;
    frame = {
      x: [BOX.x[0] * k - mx, BOX.x[1] * k],
      y: [BOX.y[0] - my, BOX.y[1]],
    };
    anchor = 'min';
  }
  return { pt, box, frame, anchor, ds: distances(p.query, space === 'z' ? 'z' : p.unit), qp: pt(p.query) };
}

/** z: z values; ham: raw values; kaydir: the shifted values x − μ (the frame the axes show). */
function queryLabel(p: OlcParams, space: Space, qp: Pt2): string {
  if (space === 'z') return `Yeni (${f2(qp[0])}; ${f2(qp[1])})`;
  const [x, y] = space === 'kaydir' ? qp : rawPoint(p.query, p.unit);
  return `Yeni (${num(x)} ${UNIT_NAME[p.unit]}; ${num(y)} TL)`;
}

function deriveScatter(index: number, p: OlcParams): ScatterView {
  const space = spaceOf(p);
  const g = geometry(index, p, space);
  const best = nearest(g.ds);
  const k = UNIT_FACTOR[p.unit];
  let mu: ScatterView['mu'] = null;
  if (p.scaling === 'mu' || p.scaling === 'kaydir') {
    const shifted = p.scaling === 'kaydir';
    mu = {
      x: shifted ? 0 : Z_FIT.t.center * k,
      y: shifted ? 0 : Z_FIT.f.center,
      sx: Z_FIT.t.scale * k,
      sy: Z_FIT.f.scale,
      labels: muLabels(p.unit),
    };
  } else if (index === 5 && space === 'z') {
    mu = { x: 0, y: 0, sx: 1, sy: 1, labels: ['μ = 0, σ = 1', 'μ = 0, σ = 1'] };
  }
  const later = index >= 1;
  return {
    unit: p.unit,
    space,
    aspect: space === 'z' ? 'esit' : 'ay-orani',
    box: g.box,
    frame: g.frame,
    anchor: g.anchor,
    customers: CUSTOMERS.map((c, i) => {
      const [x, y] = g.pt(c);
      return { id: c.id, x, y, d: g.ds[i], nearest: i === best };
    }),
    query: { x: g.qp[0], y: g.qp[1], label: queryLabel(p, space, g.qp) },
    queryShown: later,
    lines: later,
    iso: later ? { r: g.ds[best] } : null,
    mu,
    axisTitles: space === 'z'
      ? { x: `Hizmet süresi (z, birim: ${UNIT_NAME[p.unit]})`, y: 'Aylık fatura (z)' }
      : { x: `Hizmet süresi (${UNIT_NAME[p.unit]})`, y: 'Aylık fatura (TL)' },
  };
}

function deriveScalers(): NonNullable<OlcView['scalers']> {
  const mk = (name: ScalerLine['name'], fit: typeof Z_FIT.f): ScalerLine => {
    const values = FATURA.map((x) => transform(fit, x));
    return { name, values, labels: values.map(num) };
  };
  return {
    lines: [
      mk('StandardScaler', fitStandard(FATURA)),
      mk('MinMaxScaler', fitMinMax(FATURA)),
      mk('RobustScaler', fitRobust(FATURA)),
    ],
    domain: [-1, 6],
  };
}

function deriveSplit(index: number, p: OlcParams): SplitView {
  const trainFit = fitSplit('egitim');
  const scoped = fitSplit(index === 9 ? 'egitim' : p.fit);
  const fitted = index >= 10;
  return {
    values: [...SPLIT.values],
    train: [...SPLIT.train],
    test: [...SPLIT.test],
    separated: true,
    fadeTest: index === 10,
    fit: fitted ? { scope: p.fit, mu: scoped.mu, sigma: scoped.sigma } : null,
    ghostMu: index === 11 && p.fit === 'tum' ? trainFit.mu : null,
    testZ: fitted ? scoped.testZ.map(f2) : null,
    flow: index === 12,
  };
}

function deriveTable(p: OlcParams, s: ScatterView): TableView {
  const k = UNIT_FACTOR[p.unit];
  const scaled = p.scaling === 'standard';
  const z = (c: { t: number; f: number }): [string, string] | null => (scaled ? [f2(zPoint(c)[0]), f2(zPoint(c)[1])] : null);
  const rawD = distances(p.query, p.unit);
  const ds = scaled ? distances(p.query, 'z') : rawD;
  return {
    unitName: UNIT_NAME[p.unit],
    scaled,
    rows: CUSTOMERS.map((c, i) => {
      const zz = z(c);
      return {
        id: c.id, t: num(c.t * k), f: num(c.f), zt: zz && zz[0], zf: zz && zz[1], d: num(ds[i]),
        nearest: s.customers[i].nearest,
      };
    }),
    query: { t: num(p.query.t * k), f: num(p.query.f), zt: z(p.query)?.[0] ?? null, zf: z(p.query)?.[1] ?? null },
  };
}

function distanceStrip(p: OlcParams, s: ScatterView): string {
  const c = s.customers.find((x) => x.nearest)!;
  const dx = s.query.x - c.x;
  const dy = s.query.y - c.y;
  const a = dx * dx;
  const b = dy * dy;
  return (
    `d = √((${minus(s.query.x, c.x)})² + (${minus(s.query.y, c.y)})²)` +
    ` = √(${num(a)} + ${num(b)}) = ${num(c.d)}`
  );
}

function deriveStrip(index: number, p: OlcParams, s: ScatterView | null, sp: SplitView | null): string {
  const k = UNIT_FACTOR[p.unit];
  const uname = UNIT_NAME[p.unit];
  const nearestOf = (v: ScatterView): CustView => v.customers.find((c) => c.nearest)!;
  switch (index) {
    case 0: {
      const ts = CUSTOMERS.map((c) => c.t * k);
      return `hizmet süresi ${num(Math.min(...ts))}–${num(Math.max(...ts))} ${uname} · aylık fatura ${num(Math.min(...FATURA))}–${num(Math.max(...FATURA))} TL`;
    }
    case 1:
      return distanceStrip(p, s!);
    case 2: {
      const n = nearestOf(s!);
      return `${s!.space === 'z' ? 'z' : uname}: en yakın ${n.id}, d = ${num(n.d)}`;
    }
    case 3: {
      const [a, b] = muLabels(p.unit);
      return `hizmet süresi ${a} · fatura ${b}`;
    }
    case 4:
      return `x − μ: hizmet süresi − ${num(Z_FIT.t.center * k)} · fatura − ${num(Z_FIT.f.center)}`;
    case 5: {
      const m = CUSTOMERS.reduce((a, c) => (c.f > a.f ? c : a));
      return `z = (${num(m.f)} − ${num(Z_FIT.f.center)}) / ${num(Z_FIT.f.scale)} = ${num(transform(Z_FIT.f, m.f))}`;
    }
    case 6: {
      const n = nearestOf(s!);
      return `${uname}${s!.space === 'z' ? ' → z' : ''}: en yakın ${n.id}, d = ${num(n.d)}`;
    }
    case 7: {
      const part = (name: string, f: { center: number; scale: number }): string =>
        `${name} (x − ${num(f.center)}) / ${num(f.scale)}`;
      return [
        part('StandardScaler', fitStandard(FATURA)),
        part('MinMaxScaler', fitMinMax(FATURA)),
        part('RobustScaler', fitRobust(FATURA)),
      ].join(' · ');
    }
    case 8: {
      const zt = (p.query.t - Z_FIT.t.center) / Z_FIT.t.scale;
      const zf = (p.query.f - Z_FIT.f.center) / Z_FIT.f.scale;
      return (
        `((${minus(p.query.t, Z_FIT.t.center)}) / ${num(Z_FIT.t.scale)}; ` +
        `(${minus(p.query.f, Z_FIT.f.center)}) / ${num(Z_FIT.f.scale)}) = (${f2(zt)}; ${f2(zf)})`
      );
    }
    case 9: {
      const tr = churnRate(SPLIT.train);
      const te = churnRate(SPLIT.test);
      return `stratify: churn oranı eğitimde ${f2(tr)}, testte ${f2(te)}`;
    }
    case 10:
    case 11: {
      const f = sp!.fit!;
      const head = f.scope === 'egitim' ? 'eğitimden fit' : 'tüm veriyle fit';
      return `${head}: μ = ${num(f.mu)}, σ = ${num(f.sigma)} → test z: ${sp!.testZ!.join(' · ')}`;
    }
    default:
      return 'önce ayır, sonra öğren, sonra uygula';
  }
}

export function deriveOlcView(index: number, p: OlcParams): OlcView {
  if (index < 0 || index >= TOTAL) throw new RangeError(`step ${index} out of range`);
  const kind = kindOf(index);
  const scatter = kind === 'scatter' ? deriveScatter(index, p) : null;
  const split = kind === 'split' ? deriveSplit(index, p) : null;
  return {
    part: partOf(index),
    stepId: olceklemeScenario.steps[index].id,
    kind,
    scatter,
    scalers: kind === 'scalers' ? deriveScalers() : null,
    split,
    table: index <= 8 ? deriveTable(p, scatter ?? deriveScatter(index, p)) : null,
    strip: deriveStrip(index, p, scatter, split),
  };
}
