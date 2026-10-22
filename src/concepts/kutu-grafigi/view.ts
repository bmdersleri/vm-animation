import { formatNonZero, formatNumber, formatTrim } from '../../core/plot/format';
import { mean } from '../../core/stats';
import { GROUPS, GROUP_COLOR, type GroupData, type GroupId } from './data';
import { boxStats, type BoxStats } from './kutu';
import { kutuScenario, THIRD_STEPS, type KutuParams } from './scenario';

export interface GroupView {
  id: GroupId;
  name: string;
  /** Sorted observations, the sixth student merged in when the switch is on. */
  values: number[];
  stats: BoxStats;
  mean: number;
  /** Indexes into `values`, not into the JSON order. */
  outlierIndexes: number[];
  dots: boolean;
  color: string;
}

export interface KutuView {
  stepId: string;
  groups: GroupView[];
  strip: string;
  note: string;
  fences: boolean;
  showViolin: boolean;
}

const f2 = (x: number): string => formatNonZero(x, 2);

/** Up to two decimals with trailing zeros trimmed: "74", "63,5", "92,25". */
const trim = (x: number): string => formatTrim(x, 2);

/** The step's values: the group's five marks, the sixth student merged in when asked, sorted. */
function valuesOf(g: GroupData, sixth: boolean): number[] {
  const values = sixth && g.sixth !== null ? [...g.values, g.sixth] : [...g.values];
  return values.sort((a, b) => a - b);
}

function groupView(g: GroupData, p: KutuParams): GroupView {
  const values = valuesOf(g, p.sixth);
  const stats = boxStats(values, p.k);
  const outlierIndexes: number[] = [];
  values.forEach((v, i) => {
    if (v < stats.lo || v > stats.hi) outlierIndexes.push(i);
  });
  return {
    id: g.id,
    name: g.name,
    values,
    stats,
    mean: mean(values),
    outlierIndexes,
    dots: p.dots,
    color: GROUP_COLOR[g.id],
  };
}

const NOTES: readonly string[] = [
  'İki grubu yan yana görmek, iki sınıfın not dağılımını tek bakışta karşılaştırır.',
  'Beş notta medyan tam ortadaki gözlemdir; ortalama gibi tek uç değerden etkilenmez.',
  'Q1 ve Q3 verinin ortadaki yarısını çerçeveler; iki grupta da IQR 8’dir.',
  'Kutunun yarısı verinin ortadaki %50’sidir.',
  'Bıyık sınırın kendisinde değil, sınırın içindeki en uç gözlemde biter.',
  'Nokta “hatalı veri” demek değildir; önce kaynağı incelenir.',
  'Yalnız medyana bakan, yayılımı kaçırır: medyanlar eşit, IQR 12 > 8.',
  'Kutu yoğunluğu ve n’i gizler: beş noktada yoğunluk tahmini zayıftır, ayrıntı için iqr-aykiri sayfasına bakın.',
];

/** 98 > 94 · 55 < 56 → aykırı; with no observation outside, the strip says so. */
function outlierStrip(groups: GroupView[], k: KutuParams['k']): string {
  const parts: string[] = [];
  for (const g of groups) {
    const above = g.values.filter((v) => v > g.stats.hi);
    const below = g.values.filter((v) => v < g.stats.lo);
    if (above.length > 0) parts.push(`${trim(above[above.length - 1])} > ${trim(g.stats.hi)}`);
    if (below.length > 0) parts.push(`${trim(below[0])} < ${trim(g.stats.lo)}`);
  }
  if (parts.length === 0) return `bu kuralda aykırı yok · k = ${trim(k)}`;
  return `${parts.join(' · ')} → aykırı`;
}

/**
 * One step's strip sentence from the groups actually drawn. Exported so the
 * scene can re-render it after a Lab drag, when the groups are no longer the
 * view's own (the sentence must agree with the fences on screen).
 */
export function stripFor(stepId: string, p: KutuParams, groups: GroupView[]): string {
  const first = groups[0];
  switch (stepId) {
    case 'iki-grup':
      return `${first.name} n = ${formatNumber(first.values.length, 0)} · `
        + `${groups[1].name} n = ${formatNumber(groups[1].values.length, 0)}`;
    case 'medyan':
      return `${first.name} ${trim(first.stats.median.value)} · `
        + `${groups[1].name} ${trim(groups[1].stats.median.value)}`;
    case 'ceyrekler':
      return `Q1 = ${trim(first.stats.q1.value)} · Q3 = ${trim(first.stats.q3.value)} `
        + `· IQR = ${trim(first.stats.iqr)}`;
    case 'kutu':
      return `kutu: ${trim(first.stats.q1.value)}–${trim(first.stats.q3.value)} `
        + `· medyan ${trim(first.stats.median.value)}`;
    case 'biyik':
      return `${trim(p.k)} × ${trim(first.stats.iqr)} = ${trim(p.k * first.stats.iqr)} `
        + `→ sınırlar ${trim(first.stats.lo)} / ${trim(first.stats.hi)}`;
    case 'aykiri':
      return outlierStrip(groups, p.k);
    case 'ucuncu-grup': {
      const elektrik = groups[1];
      const makine = groups[2];
      // the third group's own switch is live from step 7: it can be closed again
      if (!makine) return `üçüncü grup kapalı · elektrik IQR ${trim(elektrik.stats.iqr)}`;
      const be = elektrik.stats.median.value;
      const bm = makine.stats.median.value;
      const cmp = be === bm ? '=' : be < bm ? '<' : '>';
      const wide = makine.stats.iqr > first.stats.iqr ? '>' : '≤';
      return `medyan ${trim(be)} ${cmp} ${trim(bm)} · IQR ${trim(makine.stats.iqr)} `
        + `${wide} ${trim(first.stats.iqr)}`;
    }
    case 'sinir':
    default:
      return `n = ${formatNumber(first.values.length, 0)}: yoğunluk tahmini zayıf · k = ${trim(p.k)}`;
  }
}

/**
 * Pure derivation of one step's picture: no DOM, no player.
 * Boxes show from step 4, fences from step 5, outliers from step 6, the third
 * group from step 7 and the violin on step 8; `stepId` is the scene's switch.
 */
export function deriveKutuView(index: number, p: KutuParams): KutuView {
  const steps = kutuScenario.steps;
  const i = Math.max(0, Math.min(steps.length - 1, index));
  const stepId = steps[i].id;
  const third = THIRD_STEPS.includes(i) && p.third;
  const groups = GROUPS
    .filter((g) => g.id !== 'makine' || third)
    .map((g) => groupView(g, p));
  return {
    stepId,
    groups,
    strip: stripFor(stepId, p, groups),
    note: NOTES[i],
    fences: i >= 4,
    showViolin: stepId === 'sinir',
  };
}

/** The scene-local Lab drag: the value each group's extreme observation now has, and where it started. */
export interface DragOverrides {
  values: ReadonlyMap<GroupId, number>;
  origins: ReadonlyMap<GroupId, number>;
}

/**
 * The view's groups with the Lab drag applied: the observation whose value is
 * `origins[id]` moves to `values[id]`, then the five-number summary, the mean
 * and the outlier indexes are recomputed. Groups without a drag are returned
 * untouched. Pure: the scene keeps the drag, the view keeps the statistics.
 */
export function withDrag(groups: readonly GroupView[], drag: DragOverrides, k: number): GroupView[] {
  return groups.map((g) => {
    const value = drag.values.get(g.id);
    const origin = drag.origins.get(g.id);
    if (value === undefined || origin === undefined || !g.values.includes(origin)) return g;
    const values = g.values.map((v) => (v === origin ? value : v)).sort((a, b) => a - b);
    const stats = boxStats(values, k);
    const outlierIndexes: number[] = [];
    values.forEach((v, i) => {
      if (v < stats.lo || v > stats.hi) outlierIndexes.push(i);
    });
    return { ...g, values, stats, outlierIndexes, mean: mean(values) };
  });
}
