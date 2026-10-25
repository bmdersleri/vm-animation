import type { FlowEdge } from '../../core/plot/flow-graph';
import { DAYS, META, type Cell, type Outcome } from './data';

/** Result of ordering `orders` against the demand of the same days. Shares are null when the denominator is 0. */
export interface Evaluation {
  prepared: number;
  wasted: number;
  lost: number;
  demand: number;
  wasteRate: number | null;
  lostShare: number | null;
}

/** Waste and lost demand of a series of daily orders: sold = min(order, demand), wasted = order - sold, lost = demand - sold. */
export function evaluate(orders: readonly number[], demand: readonly number[]): Evaluation {
  let prepared = 0;
  let wasted = 0;
  let lost = 0;
  let total = 0;
  orders.forEach((order, i) => {
    const d = demand[i];
    const sold = Math.min(order, d);
    prepared += order;
    wasted += order - sold;
    lost += d - sold;
    total += d;
  });
  return {
    prepared,
    wasted,
    lost,
    demand: total,
    wasteRate: prepared > 0 ? wasted / prepared : null,
    lostShare: total > 0 ? lost / total : null,
  };
}

export interface Verdict {
  reduction: number | null;
  wasteOk: boolean;
  serviceOk: boolean;
  ok: boolean;
}

/** The two success conditions: waste rate down by at least `criteria.waste` against `base`, lost demand at most `criteria.service`. */
export function verdict(r: Pick<Evaluation, 'wasteRate' | 'lostShare'>, base: Pick<Evaluation, 'wasteRate'>): Verdict {
  const reduction = r.wasteRate !== null && base.wasteRate !== null && base.wasteRate > 0 ? 1 - r.wasteRate / base.wasteRate : null;
  const wasteOk = reduction !== null && reduction >= META.criteria.waste;
  const serviceOk = r.lostShare !== null && r.lostShare <= META.criteria.service;
  return { reduction, wasteOk, serviceOk, ok: wasteOk && serviceOk };
}

/** "Veri yeterli mi?": at least `minGroup` days in each of the two groups. */
export function enoughData(cell: Cell): boolean {
  return cell.usable.normal >= META.minGroup && cell.usable.sinav >= META.minGroup;
}

/** ia business understanding, va data understanding, vh preparation, mo modelling, de evaluation, ya deployment, d1 and d2 the decisions. */
export type NodeId = 'ia' | 'va' | 'vh' | 'mo' | 'de' | 'ya' | 'd1' | 'd2';

/** Node labels, one string per line. */
export const PHASE_LABELS: Record<NodeId, string[]> = {
  ia: ['İş anlama'],
  va: ['Veri anlama'],
  vh: ['Veri hazırlama'],
  mo: ['Modelleme'],
  de: ['Değerlendirme'],
  ya: ['Yaygınlaştırma'],
  d1: ['Veri', 'yeterli mi?'],
  d2: ['Sonuç', 'uygun mu?'],
};

/** Edges of the cycle: forward along the circle, back edges as chords through it, the outer loop as an arc. */
export const CYCLE_EDGES: FlowEdge[] = [
  { id: 'ia-va', from: 'ia', to: 'va', kind: 'forward' },
  { id: 'va-d1', from: 'va', to: 'd1', kind: 'forward' },
  { id: 'd1-vh', from: 'd1', to: 'vh', kind: 'forward', label: 'Evet' },
  { id: 'vh-mo', from: 'vh', to: 'mo', kind: 'forward' },
  { id: 'mo-de', from: 'mo', to: 'de', kind: 'forward' },
  { id: 'de-d2', from: 'de', to: 'd2', kind: 'forward' },
  { id: 'd2-ya', from: 'd2', to: 'ya', kind: 'forward', label: 'Evet' },
  // bowed toward the circle's centre so the chord keeps clear of the phase it passes
  { id: 'd1-ia', from: 'd1', to: 'ia', kind: 'back', label: 'Hayır', bend: -24 },
  { id: 'd2-va', from: 'd2', to: 'va', kind: 'back', label: 'Hayır', bend: -12 },
  // clockwise travel: a negative bend bows the arc outward
  { id: 'ya-ia', from: 'ya', to: 'ia', kind: 'outer', bend: -36 },
];

export type PathEnd = 'yetersiz' | 'uygun-degil' | 'sahada-dustu' | 'yaygin';

export interface ProjectPath {
  nodes: NodeId[];
  edges: string[];
  end: PathEnd;
  /** The conditions that failed at the decision (or at deployment) that sent the project back. */
  failed: ('waste' | 'service')[];
  /** The node where the path stops or turns back. */
  stopAt: NodeId;
}

const failedOf = (o: Outcome): ('waste' | 'service')[] => {
  const failed: ('waste' | 'service')[] = [];
  if (!o.wasteOk) {
    failed.push('waste');
  }
  if (!o.serviceOk) {
    failed.push('service');
  }
  return failed;
};

/** The one-round route of a choice: back at the first decision, back at the second, through deployment and dropped in the field, or deployed. */
export function projectPath(cell: Cell): ProjectPath {
  if (!enoughData(cell)) {
    return { nodes: ['ia', 'va', 'd1', 'ia'], edges: ['ia-va', 'va-d1', 'd1-ia'], end: 'yetersiz', failed: [], stopAt: 'd1' };
  }
  const head: NodeId[] = ['ia', 'va', 'd1', 'vh', 'mo', 'de', 'd2'];
  const headEdges = ['ia-va', 'va-d1', 'd1-vh', 'vh-mo', 'mo-de', 'de-d2'];
  if (!cell.eval.ok) {
    return { nodes: [...head, 'va'], edges: [...headEdges, 'd2-va'], end: 'uygun-degil', failed: failedOf(cell.eval), stopAt: 'd2' };
  }
  const edges = [...headEdges, 'd2-ya', 'ya-ia'];
  if (!cell.deploy.ok) {
    return { nodes: [...head, 'ya', 'ia'], edges, end: 'sahada-dustu', failed: failedOf(cell.deploy), stopAt: 'ya' };
  }
  return { nodes: [...head, 'ya'], edges, end: 'yaygin', failed: [], stopAt: 'ya' };
}

export interface CycleNode {
  id: NodeId;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CycleLayout {
  cx: number;
  cy: number;
  r: number;
  nodes: CycleNode[];
}

/** Clockwise angles from the top, in degrees: six phases every 60 degrees, the decisions half way between their neighbours. */
const ANGLES: [NodeId, number][] = [
  ['ia', 0], ['va', 60], ['d1', 90], ['vh', 120], ['mo', 180], ['de', 240], ['d2', 270], ['ya', 300],
];

/** The eight nodes on a circle that fits the `w` x `h` area, clockwise from the top (`ia` at 12 o'clock). */
export function cycleLayout(w: number, h: number, narrow: boolean): CycleLayout {
  const phase = narrow ? { w: 88, h: 38 } : { w: 124, h: 44 };
  const decision = narrow ? { w: 84, h: 52 } : { w: 112, h: 60 };
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.max(40, Math.min((w - phase.w) / 2, (h - phase.h) / 2) - 2);
  const nodes = ANGLES.map(([id, deg]) => {
    const size = id === 'd1' || id === 'd2' ? decision : phase;
    const a = (deg * Math.PI) / 180;
    return { id, x: cx + r * Math.sin(a), y: cy - r * Math.cos(a), w: size.w, h: size.h };
  });
  return { cx, cy, r, nodes };
}

const TEST_DAYS = DAYS.filter(d => d.test);

/**
 * The orders a cell gives to the normal days (`exam` false) or the exam week days of the test window, as the rule
 * is read: one number ("63") or, when the orders differ from day to day, "a–b".
 */
export function orderText(cell: Cell, exam: boolean, which: 'eval' | 'deploy' = 'eval'): string {
  const values = cell.orders[which].filter((_o, i) => TEST_DAYS[i].sinav === exam);
  if (values.length === 0) {
    return '—';
  }
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return lo === hi ? String(lo) : `${lo}–${hi}`;
}
