import { sepetData, type Itemset } from '../birliktelik/data';
import { aprioriTrace, latticeState, type AprioriTrace, type Candidate, type LatticeState } from '../birliktelik/apriori';
import { conditionalBase, fpTree, type FpTree, type PrefixPath } from '../birliktelik/fptree';
import { itemName, setAbbr, setBraces, setKey } from '../birliktelik/format';
import { count } from '../birliktelik/metrics';
import { formatNumber, formatTrim } from '../../core/plot/format';

const tx = sepetData.transactions;
const N = tx.length;
const ITEMS = sepetData.items;

/** The lesson's min_support stops (steps 1-6 use 0,2) and the basket counts they mean. */
export const SUPPORT_STOPS: readonly { support: number; minCount: number }[] = [
  { support: 0.5, minCount: 9 },
  { support: 0.3, minCount: 6 },
  { support: 0.2, minCount: 4 },
  { support: 0.15, minCount: 3 },
];

export const th = (v: number): string => formatTrim(v, 2);

/** "min_support 0,2 → en az 4 fiş" (a count off the lesson's stops reads its exact ratio, "0,278"). */
export function thresholdText(minCount: number): string {
  const stop = SUPPORT_STOPS.find((s) => s.minCount === minCount);
  const support = stop ? th(stop.support) : formatNumber(minCount / N, 3);
  return `min_support ${support} → en az ${minCount} fiş`;
}

// ---- the 63 itemsets of the lattice ----

export interface LatticeNode {
  /** `setKey` of the set: "ekmek,sut". */
  readonly key: string;
  readonly set: Itemset;
  /** Level = set size, 1..6. */
  readonly k: number;
  /** Letters back to back: "ES". */
  readonly abbr: string;
}

function combinations(k: number): Itemset[] {
  const out: Itemset[] = [];
  const pick = (from: number, chosen: string[]): void => {
    if (chosen.length === k) {
      out.push(chosen);
      return;
    }
    for (let i = from; i < ITEMS.length; i++) pick(i + 1, [...chosen, ITEMS[i]]);
  };
  pick(0, []);
  return out;
}

/** All non-empty itemsets by level (6, 15, 20, 15, 6, 1), each level in product order. */
export const LATTICE: readonly LatticeNode[] = ITEMS.flatMap((_, i) =>
  combinations(i + 1).map((set) => ({ key: setKey(set), set, k: i + 1, abbr: setAbbr(set) })),
);
export const LEVELS = ITEMS.length;
export const TOTAL = LATTICE.length;

// ---- analysis per threshold ----

export interface Analysis {
  readonly minCount: number;
  readonly trace: AprioriTrace;
  readonly states: ReadonlyMap<string, LatticeState>;
  readonly listed: ReadonlyMap<string, Candidate>;
}

const cache = new Map<number, Analysis>();

/** Apriori trace and the state of all 63 nodes at a threshold, memoised (`latticeState` rescans the trace per call). */
export function analyse(minCount: number): Analysis {
  let a = cache.get(minCount);
  if (!a) {
    const trace = aprioriTrace(tx, minCount);
    const listed = new Map<string, Candidate>();
    for (const lv of trace.levels) for (const c of lv.candidates) listed.set(setKey(c.set), c);
    const states = new Map<string, LatticeState>();
    for (const node of LATTICE) states.set(node.key, latticeState(trace, node.set));
    a = { minCount, trace, states, listed };
    cache.set(minCount, a);
  }
  return a;
}

/** Keys of the counted candidates of a level, in scan order. */
export function scanKeys(a: Analysis, level: number): string[] {
  const lv = a.trace.levels[level - 1];
  return lv ? lv.candidates.filter((c) => c.count !== null).map((c) => setKey(c.set)) : [];
}

// ---- painting ----

export type NodeState = LatticeState | 'candidate';

export interface PaintedNode {
  readonly node: LatticeNode;
  readonly state: NodeState;
  /** Shown only once the node is counted. */
  readonly count: number | null;
  /** Letters of the subset that pruned it ("ST"); only for pruned nodes the trace lists. */
  readonly prunedBy: string | null;
}

export interface PaintOptions {
  minCount: number;
  /** Levels 1..level are drawn with their real state. */
  level: number;
  /** From the Apriori-property step on: supersets of an infrequent single product are pruned, however high their level. */
  pruneSingles: boolean;
  /** A level being counted candidate by candidate: `scanned` candidates are done, the next one is being counted. */
  scan: { level: number; scanned: number } | null;
}

export function paintLattice(o: PaintOptions): PaintedNode[] {
  const a = analyse(o.minCount);
  const rare = ITEMS.filter((i) => a.states.get(i) === 'infrequent');
  const scanOrder = o.scan ? scanKeys(a, o.scan.level) : [];
  return LATTICE.map((node): PaintedNode => {
    const real = a.states.get(node.key) ?? 'unseen';
    const cand = a.listed.get(node.key);
    let state: NodeState = 'unseen';
    if (node.k <= o.level) {
      state = real;
      if (o.scan && node.k === o.scan.level && real !== 'pruned') {
        const at = scanOrder.indexOf(node.key);
        state = at < o.scan.scanned ? real : at === o.scan.scanned ? 'candidate' : 'unseen';
      }
    } else if (o.pruneSingles && node.set.some((i) => rare.includes(i))) state = 'pruned';
    const counted = state === 'frequent' || state === 'infrequent';
    return {
      node,
      state,
      count: counted ? (cand?.count ?? null) : null,
      prunedBy: state === 'pruned' && cand?.prunedBy ? setAbbr(cand.prunedBy) : null,
    };
  });
}

/** "sayılan aday: N / 63" and "sık küme: M" read straight off the painted nodes. */
export function counters(painted: readonly PaintedNode[]): { counted: number; frequent: number } {
  let counted = 0;
  let frequent = 0;
  for (const p of painted) {
    if (p.state === 'frequent') frequent++;
    if (p.state === 'frequent' || p.state === 'infrequent') counted++;
  }
  return { counted, frequent };
}

export interface PruneReason {
  readonly abbr: string;
  readonly by: string;
  readonly text: string;
}

/** Pruned candidates the trace lists up to a level: "EST budandı: ST sık değil (3 < 4)". */
export function pruneReasons(minCount: number, level: number): PruneReason[] {
  const out: PruneReason[] = [];
  for (const lv of analyse(minCount).trace.levels) {
    if (lv.k > level) continue;
    for (const c of lv.candidates) {
      if (c.status !== 'pruned' || !c.prunedBy) continue;
      const abbr = setAbbr(c.set);
      const by = setAbbr(c.prunedBy);
      out.push({ abbr, by, text: `${abbr} budandı: ${by} sık değil (${count(tx, c.prunedBy)} < ${minCount})` });
    }
  }
  return out;
}

/** "Reçel sık değil (3 < 4): içeren 31 küme budandı" for each infrequent single product. */
export function rareNotes(minCount: number): string[] {
  const a = analyse(minCount);
  return ITEMS.filter((i) => a.states.get(i) === 'infrequent').map((i) => {
    const supersets = LATTICE.filter((n) => n.k >= 2 && n.set.includes(i)).length;
    return `${itemName(i)} sık değil (${count(tx, [i])} < ${minCount}): içeren ${supersets} küme budandı`;
  });
}

// ---- FP-Growth text parts ----

const pathText = (p: PrefixPath): string => `${p.path.map(itemName).join(' › ')}: ${p.count}`;

export interface ConditionalSummary {
  readonly tree: FpTree;
  readonly paths: PrefixPath[];
  /** Items of the prefix paths with their summed counts, in tree order. */
  readonly local: { item: string; count: number }[];
  readonly kept: string[];
  /** Sets {item, suffix} and the triples of kept items, with their basket counts. */
  readonly sets: { set: Itemset; count: number; frequent: boolean }[];
}

export function conditionalSummary(minCount: number, item: string): ConditionalSummary {
  const tree = fpTree(tx, minCount);
  const paths = conditionalBase(tree, item);
  const sums = new Map<string, number>();
  for (const p of paths) for (const i of p.path) sums.set(i, (sums.get(i) ?? 0) + p.count);
  const local = tree.order.filter((i) => sums.has(i)).map((i) => ({ item: i, count: sums.get(i) as number }));
  const kept = local.filter((l) => l.count >= minCount).map((l) => l.item);
  const make = (set: Itemset): { set: Itemset; count: number; frequent: boolean } => {
    const c = count(tx, set);
    return { set, count: c, frequent: c >= minCount };
  };
  const sets = kept.map((i) => make([i, item]));
  for (let a = 0; a < kept.length; a++) for (let b = a + 1; b < kept.length; b++) sets.push(make([kept[a], kept[b], item]));
  return { tree, paths, local, kept, sets };
}

export const pathsText = (paths: readonly PrefixPath[]): string => paths.map(pathText).join(' · ');
export const itemCountText = (l: { item: string; count: number }): string => `${itemName(l.item)} ${l.count}`;
export const setCountText = (s: { set: Itemset; count: number; frequent: boolean }, minCount: number): string =>
  `${setBraces(s.set)} ${s.count} ${s.frequent ? `≥ ${minCount} sık` : `< ${minCount} değil`}`;
