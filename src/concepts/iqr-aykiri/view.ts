import { mean, median, std0 } from '../../core/stats';
import { formatNonZero, formatNumber } from '../../core/plot/format';
import type { LineSpec } from '../../core/plot/number-line';
import { FILL, IQR } from './data';
import { impute, intervene, tukey, withExtreme, zOf, type Tukey } from './outlier';
import { iqrAykiriScenario, type IqrParams } from './scenario';

export type IqrPart = 1 | 2;
export type PtShape = 'normal' | 'outlier' | 'filled';

export interface Cell {
  key: string;
  i: number;
  /** 0–7, position in the displayed order. */
  slot: number;
  text: string;
  empty: boolean;
  filled: boolean;
  rank: number | null;
  highlight: boolean;
  outlier: boolean;
  deleted: boolean;
  clipped: boolean;
}
export interface Pt {
  key: string;
  value: number;
  shape: PtShape;
  far: boolean;
  label: string | null;
  highlight: boolean;
  deleted: boolean;
}
export interface Marker {
  kind: 'mean' | 'median' | 'q1' | 'q3' | 'lo' | 'hi';
  value: number;
  label: string;
}
export interface IqrView {
  part: IqrPart;
  stepId: string;
  cells: Cell[];
  sorted: boolean;
  ranks: boolean;
  posMark: { pos: number; label: string } | null;
  points: Pt[];
  markers: Marker[];
  meanFrom: 'start' | null;
  box: { q1: number; q3: number } | null;
  arms: { lo: number; hi: number; label: string } | null;
  whiskers: [number, number] | null;
  zBand: { mean: number; lo: number; hi: number; loLabel: string; hiLabel: string } | null;
  strip: string;
  note: string;
}

export const LINE: LineSpec = { min: 0, max: 100, breakAt: 100, farMax: 600 };

const f2 = (x: number): string => formatNonZero(x, 2);
/** Whole numbers print without decimals ("480"); others like f2. */
const fz = (x: number): string => (Number.isInteger(x) ? formatNumber(x, 0) : f2(x));
const isFar = (v: number): boolean => v > (LINE.breakAt ?? LINE.max);
const NONE = 'Sınırların dışında gözlem yok';

/** Indices ordered by value (nulls last), stable. */
function order(vals: readonly (number | null)[]): number[] {
  return vals
    .map((v, i) => ({ v: v ?? Infinity, i }))
    .sort((a, b) => a.v - b.v || a.i - b.i)
    .map((o) => o.i);
}

function ptLabel(v: number, outlier: boolean, clipped: boolean): string | null {
  if (clipped) return f2(v);
  if (outlier) return `${f2(v)} · aykırı`;
  return isFar(v) ? f2(v) : null;
}

function derivePart1(index: number, p: IqrParams, stepId: string): IqrView {
  const data = withExtreme(FILL.values, FILL.extremeIndex, p.extreme);
  const imputed = impute(data, p.fill).values;
  const present = data.filter((v): v is number => v !== null);
  const mu = mean(present);
  const med = median(present);
  const sorted = index >= 2;
  const ranks = index === 2;

  const ord = sorted ? order(imputed) : imputed.map((_, i) => i);
  const slotOf = new Map(ord.map((i, s) => [i, s]));
  // median pair among the original (non-empty) values
  const presentIdx = order(data).slice(0, present.length);
  const m = presentIdx.length;
  const midIdx = new Set(m % 2 === 0 ? [presentIdx[m / 2 - 1], presentIdx[m / 2]] : [presentIdx[(m - 1) / 2]]);
  const showMid = index === 2;

  let r = 0;
  const rankOf = new Map<number, number>();
  for (const i of ord) if (imputed[i] !== null) rankOf.set(i, r++);

  const cells: Cell[] = imputed.map((v, i) => ({
    key: `1-${i}`,
    i,
    slot: slotOf.get(i)!,
    text: v === null ? 'boş' : f2(v),
    empty: v === null,
    filled: data[i] === null && v !== null,
    rank: ranks ? (rankOf.get(i) ?? null) : null,
    highlight: showMid && midIdx.has(i),
    outlier: false,
    deleted: false,
    clipped: false,
  }));

  const points: Pt[] = [];
  imputed.forEach((v, i) => {
    if (v === null) return;
    const filled = data[i] === null;
    points.push({
      key: filled ? `1-f${i}` : `1-${i}`,
      value: v,
      shape: filled ? 'filled' : 'normal',
      far: isFar(v),
      label: isFar(v) ? f2(v) : null,
      highlight: showMid && !filled && midIdx.has(i),
      deleted: false,
    });
  });

  const markers: Marker[] = [];
  if (index >= 1 && index <= 4) markers.push({ kind: 'mean', value: mu, label: `ortalama ${f2(mu)}` });
  if (index >= 2 && index <= 4) markers.push({ kind: 'median', value: med, label: `medyan ${f2(med)}` });

  const sp = [...present].sort((a, b) => a - b);
  const medTerms =
    sp.length % 2 === 0
      ? `(${f2(sp[sp.length / 2 - 1])} + ${f2(sp[sp.length / 2])}) / 2 = ${f2(med)}`
      : `ortadaki değer = ${f2(med)}`;
  const empties = data.length - present.length;
  const pct = Math.round((100 * empties) / data.length);
  const imp = impute(data, p.fill);
  const impStrip =
    imp.fillValue === null
      ? 'SimpleImputer: doldurma yok'
      : index === 3
        ? `SimpleImputer(strategy="${p.fill === 'ortalama' ? 'mean' : 'median'}") → ${f2(imp.fillValue)}`
        : `strategy="${p.fill === 'ortalama' ? 'mean' : 'median'}" → ${f2(imp.fillValue)}`;
  const strips = [
    `${data.length} hücreden ${empties}’si boş: %${pct} eksik`,
    `(${present.map(f2).join(' + ')}) / ${present.length} = ${f2(mu)}`,
    medTerms,
    impStrip,
    impStrip,
  ];

  return {
    part: 1,
    stepId,
    cells,
    sorted,
    ranks,
    posMark: null,
    points,
    markers,
    meanFrom: index === 1 ? 'start' : null,
    box: null,
    arms: null,
    whiskers: null,
    zBand: null,
    strip: strips[index],
    note: `Uç değer ${f2(p.extreme)} → ortalama ${f2(mu)}, medyan ${f2(med)}: ortalama uç değerle kayar, medyan yerinde kalır.`,
  };
}

function derivePart2(index: number, p: IqrParams, stepId: string): IqrView {
  const raw = withExtreme(IQR.values, IQR.extremeIndex, p.extreme);
  const orig: Tukey = tukey(raw, p.k);
  const iv = intervene(raw, p.k, p.action);
  const kept = iv.kept;
  const tk = tukey(kept, p.k);
  const mu = mean(kept);
  const sd = std0(kept);
  const changed = new Set(iv.changed);
  const outl = new Set(orig.outliers);
  const marksOut = index >= 8;

  const sortVals = iv.values.map((v, i) => v ?? raw[i]);
  const ord = order(sortVals);
  const slotOf = new Map(ord.map((i, s) => [i, s]));
  let r = 0;
  const rankOf = new Map<number, number>();
  for (const i of ord) if (iv.values[i] !== null) rankOf.set(i, r++);

  const q = index === 6 ? tk.q1 : index === 7 ? tk.q3 : null;
  const pairRanks = q ? new Set([q.lo, Math.min(q.lo + 1, q.n - 1)]) : new Set<number>();

  const cells: Cell[] = raw.map((rv, i) => {
    const v = iv.values[i];
    const deleted = v === null;
    const clipped = !deleted && p.action === 'kirp' && changed.has(i);
    const rank = rankOf.get(i) ?? null;
    return {
      key: `2-${i}`,
      i,
      slot: slotOf.get(i)!,
      text: f2(v ?? rv),
      empty: false,
      filled: false,
      rank,
      highlight: rank !== null && pairRanks.has(rank),
      outlier: marksOut && outl.has(i),
      deleted,
      clipped,
    };
  });

  const points: Pt[] = raw.map((rv, i) => {
    const v = iv.values[i];
    const deleted = v === null;
    const val = v ?? rv;
    const clipped = !deleted && p.action === 'kirp' && changed.has(i);
    const out = marksOut && outl.has(i);
    return {
      key: `2-${i}`,
      value: val,
      shape: out ? 'outlier' : 'normal',
      far: isFar(val),
      label: ptLabel(val, out && !clipped, clipped),
      highlight: false,
      deleted,
    };
  });

  const markers: Marker[] = [];
  if (index >= 9) markers.push({ kind: 'mean', value: mu, label: `ortalama ${f2(mu)}` });
  if (index >= 6) markers.push({ kind: 'q1', value: tk.q1.value, label: `Q1 ${f2(tk.q1.value)}` });
  if (index >= 7) markers.push({ kind: 'q3', value: tk.q3.value, label: `Q3 ${f2(tk.q3.value)}` });
  if (index >= 8) {
    markers.push({ kind: 'lo', value: tk.lo, label: `alt ${f2(tk.lo)}` });
    markers.push({ kind: 'hi', value: tk.hi, label: `üst ${f2(tk.hi)}` });
  }

  const posQ = index === 6 ? tk.q1 : index === 7 ? tk.q3 : null;
  const posMark = posQ
    ? { pos: posQ.pos, label: `konum ${formatNumber(posQ.q, 2)} · ${posQ.n - 1} = ${formatNumber(posQ.pos, 2)}` }
    : null;

  const arm = tk.k * tk.iqr;
  const outVals = orig.outliers.map((i) => f2(raw[i]));
  const hasOut = orig.outliers.length > 0;

  const sortedTxt = tk.sorted.map(f2).join(' · ');
  const term = (s: typeof tk.q1, name: string): string =>
    `${name} = ${f2(s.a)} + ${formatNumber(s.frac, 2)} · (${f2(s.b)} − ${f2(s.a)}) = ${f2(s.value)}`;

  let zLine: string;
  {
    const x = Math.max(...kept);
    const z = zOf(kept, x);
    zLine =
      `z(${fz(x)}) = (${fz(x)} − ${f2(mu)}) / ${f2(sd)} = ${f2(z)} ${z < 3 ? '<' : '≥'} 3\n` +
      (hasOut ? `IQR: aykırı · Z-score: ${z >= 3 ? 'aykırı' : 'aykırı değil'}` : NONE);
  }

  const mSil = mean(intervene(raw, p.k, 'sil').kept);
  const mKirp = mean(intervene(raw, p.k, 'kirp').kept);
  let l2: string | null;
  if (!hasOut) l2 = NONE;
  else if (p.action === 'kirp') {
    l2 = `kırpınca ${orig.outliers.map((i) => `${f2(raw[i])} → ${f2(iv.values[i] as number)}`).join(' · ')}`;
  } else if (p.action === 'sil') {
    l2 = `silince n = ${tk.n}: Q1 = ${f2(tk.q1.value)} · Q3 = ${f2(tk.q3.value)} · sınırlar ${f2(tk.lo)} / ${f2(tk.hi)}`;
  } else l2 = null;
  const finalStrip =
    `ortalama olduğu gibi ${f2(mean(raw))} · silince ${f2(mSil)} · kırpınca ${f2(mKirp)}` + (l2 ? `\n${l2}` : '');

  const strips: Record<number, string> = {
    5: `sıralı${tk.n < raw.length ? ` (n = ${tk.n})` : ''}: ${sortedTxt}`,
    6: term(tk.q1, 'Q1'),
    7: `${term(tk.q3, 'Q3')}\nIQR = ${f2(tk.q3.value)} − ${f2(tk.q1.value)} = ${f2(tk.iqr)}`,
    8:
      `${formatNumber(tk.k, 1)} · ${f2(tk.iqr)} = ${f2(arm)} → alt ${f2(tk.q1.value)} − ${f2(arm)} = ${f2(tk.lo)}` +
      ` · üst ${f2(tk.q3.value)} + ${f2(arm)} = ${f2(tk.hi)}\n` +
      (hasOut ? `aykırı: ${outVals.join(', ')}` : NONE),
    9: zLine,
    10: finalStrip,
  };

  const ext = raw[IQR.extremeIndex];
  const note = outl.has(IQR.extremeIndex)
    ? `Uç değer ${f2(ext)} ${ext > orig.hi ? `üst sınırın (${f2(orig.hi)})` : `alt sınırın (${f2(orig.lo)})`} dışında: aykırı.`
    : `Uç değer ${f2(ext)} sınırların içinde: aykırı değil.`;

  return {
    part: 2,
    stepId,
    cells,
    sorted: true,
    ranks: true,
    posMark,
    points,
    markers,
    meanFrom: null,
    box: index >= 7 ? { q1: tk.q1.value, q3: tk.q3.value } : null,
    arms: index === 8 ? { lo: tk.lo, hi: tk.hi, label: `${formatNumber(tk.k, 1)} · IQR = ${f2(arm)}` } : null,
    whiskers: index >= 8 ? tk.whiskers : null,
    zBand:
      index === 9
        ? {
            mean: mu,
            lo: mu - 3 * sd,
            hi: mu + 3 * sd,
            loLabel: `μ − 3σ = ${f2(mu - 3 * sd)}`,
            hiLabel: `μ + 3σ = ${f2(mu + 3 * sd)}`,
          }
        : null,
    strip: strips[index],
    note,
  };
}

export function deriveIqrView(index: number, p: IqrParams): IqrView {
  const steps = iqrAykiriScenario.steps;
  const i = Math.max(0, Math.min(steps.length - 1, index));
  const id = steps[i].id;
  return i <= 4 ? derivePart1(i, p, id) : derivePart2(i, p, id);
}
