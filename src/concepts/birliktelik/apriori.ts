import { sepetData, type Basket, type Item, type Itemset } from './data';
import { count } from './metrics';
import { setKey, sortItems } from './format';

export type CandidateStatus = 'frequent' | 'infrequent' | 'pruned';

export interface Candidate {
  readonly set: Itemset;
  readonly status: CandidateStatus;
  /** null for pruned candidates (never counted). */
  readonly count: number | null;
  /** The non-frequent (k-1)-subset that pruned this candidate. */
  readonly prunedBy: Itemset | null;
}
export interface Level {
  readonly k: number;
  readonly candidates: readonly Candidate[];
}
export interface AprioriTrace {
  readonly levels: readonly Level[];
  /** Itemset key (see `setKey`) -> count. */
  readonly frequent: Map<string, number>;
  /** Candidates whose support was counted (pruned ones are not). */
  readonly counted: number;
}

/** Product items plus any extra ones in the baskets, in product order. */
export function itemsOf(tx: readonly Basket[]): Item[] {
  const seen = new Set<Item>(sepetData.items);
  for (const b of tx) for (const i of b) seen.add(i);
  return sortItems([...seen]);
}

export function aprioriTrace(tx: readonly Basket[], minCount: number): AprioriTrace {
  const frequent = new Map<string, number>();
  const levels: Level[] = [];
  let counted = 0;

  const make = (set: Itemset): Candidate => {
    const c = count(tx, set);
    return { set, status: c >= minCount ? 'frequent' : 'infrequent', count: c, prunedBy: null };
  };
  let candidates: Candidate[] = itemsOf(tx).map((i) => make([i]));

  for (let k = 1; candidates.length > 0; k++) {
    levels.push({ k, candidates });
    const freq: Itemset[] = [];
    for (const c of candidates) {
      if (c.count !== null) counted++;
      if (c.status === 'frequent') {
        freq.push(c.set);
        frequent.set(setKey(c.set), c.count as number);
      }
    }
    // Join two frequent k-sets that share their first k-1 items, then prune.
    const next: Candidate[] = [];
    for (let a = 0; a < freq.length; a++) {
      for (let b = a + 1; b < freq.length; b++) {
        const A = freq[a];
        const B = freq[b];
        if (!A.slice(0, k - 1).every((v, i) => v === B[i])) continue;
        const set = sortItems([...A, B[k - 1]]);
        const bad = set.map((_, drop) => set.filter((__, i) => i !== drop)).find((s) => !frequent.has(setKey(s)));
        next.push(bad ? { set, status: 'pruned', count: null, prunedBy: bad } : make(set));
      }
    }
    candidates = next;
  }
  return { levels, frequent, counted };
}

export type LatticeState = CandidateStatus | 'unseen';

/**
 * State of any itemset in the lattice. A listed candidate keeps its status; every
 * superset of an infrequent or pruned set is pruned even when it was never listed.
 */
export function latticeState(trace: AprioriTrace, set: Itemset): LatticeState {
  const sorted = sortItems(set);
  const listed = new Map<string, CandidateStatus>();
  for (const lv of trace.levels) for (const c of lv.candidates) listed.set(setKey(c.set), c.status);
  const own = listed.get(sorted.join(','));
  if (own) return own;
  for (let mask = 1; mask < (1 << sorted.length) - 1; mask++) {
    const s = listed.get(sorted.filter((_, i) => mask & (1 << i)).join(','));
    if (s === 'infrequent' || s === 'pruned') return 'pruned';
  }
  return 'unseen';
}
