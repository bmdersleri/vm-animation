import type { Basket, Item, Itemset } from './data';
import { itemsOf } from './apriori';
import { count } from './metrics';
import { itemRank, setKey } from './format';

export interface Node {
  /** Path id: "root", then parent id + ">" + item. Stable across snapshots. */
  readonly id: string;
  readonly item: Item | null;
  readonly count: number;
  readonly children: readonly Node[];
}
interface MNode {
  id: string;
  item: Item | null;
  count: number;
  children: MNode[];
}
export interface FpTree {
  /** Frequent items, most frequent first (ties: product order). */
  readonly order: Item[];
  /** Each basket filtered to frequent items and sorted by `order`. */
  readonly filtered: Itemset[];
  /** Trees after 0..n baskets were inserted. */
  readonly snapshots: Node[];
  readonly header: { item: Item; total: number }[];
}
export interface PrefixPath {
  /** Root side first, the item itself excluded. */
  readonly path: Itemset;
  readonly count: number;
}

const newRoot = (): MNode => ({ id: 'root', item: null, count: 0, children: [] });

function insert(root: MNode, path: Itemset, by: number): void {
  let cur = root;
  for (const item of path) {
    let child = cur.children.find((c) => c.item === item);
    if (!child) {
      child = { id: `${cur.id}>${item}`, item, count: 0, children: [] };
      cur.children.push(child);
    }
    child.count += by;
    cur = child;
  }
}

function clone(n: MNode): Node {
  return { id: n.id, item: n.item, count: n.count, children: n.children.map(clone) };
}

function walk(n: Node, f: (n: Node, path: Item[]) => void, path: Item[] = []): void {
  for (const c of n.children) {
    f(c, path);
    walk(c, f, [...path, c.item as Item]);
  }
}

const byFrequency = (a: [Item, number], b: [Item, number]): number => b[1] - a[1] || itemRank(a[0]) - itemRank(b[0]);

export function fpTree(tx: readonly Basket[], minCount: number): FpTree {
  const header = itemsOf(tx)
    .map((item): [Item, number] => [item, count(tx, [item])])
    .filter(([, total]) => total >= minCount)
    .sort(byFrequency)
    .map(([item, total]) => ({ item, total }));
  const order = header.map((h) => h.item);
  const filtered = tx.map((b) => order.filter((i) => b.includes(i)));
  const root = newRoot();
  const snapshots: Node[] = [clone(root)];
  for (const f of filtered) {
    insert(root, f, 1);
    snapshots.push(clone(root));
  }
  return { order, filtered, snapshots, header };
}

function baseOf(root: Node, item: Item): PrefixPath[] {
  const out: PrefixPath[] = [];
  walk(root, (n, path) => {
    if (n.item === item && path.length > 0) out.push({ path, count: n.count });
  });
  return out;
}

/** Prefix paths of every `item` node in the finished tree, each with that node's count. */
export function conditionalBase(tree: FpTree, item: Item): PrefixPath[] {
  return baseOf(tree.snapshots[tree.snapshots.length - 1], item);
}

function mine(root: Node, minCount: number, suffix: Item[], out: Map<string, number>): void {
  const totals = new Map<Item, number>();
  walk(root, (n) => totals.set(n.item as Item, (totals.get(n.item as Item) ?? 0) + n.count));
  for (const [item, total] of totals) {
    if (total < minCount) continue;
    const set = [item, ...suffix];
    out.set(setKey(set), total);
    const base = baseOf(root, item);
    const local = new Map<Item, number>();
    for (const p of base) for (const i of p.path) local.set(i, (local.get(i) ?? 0) + p.count);
    const keep = [...local.entries()]
      .filter(([, c]) => c >= minCount)
      .sort(byFrequency)
      .map(([i]) => i);
    if (keep.length === 0) continue;
    const sub = newRoot();
    for (const p of base) insert(sub, keep.filter((i) => p.path.includes(i)), p.count);
    mine(clone(sub), minCount, set, out);
  }
}

/** Frequent itemsets by FP-Growth (key = item ids in product order joined by ","). */
export function fpGrowth(tx: readonly Basket[], minCount: number): Map<string, number> {
  const t = fpTree(tx, minCount);
  const out = new Map<string, number>();
  mine(t.snapshots[t.snapshots.length - 1], minCount, [], out);
  return out;
}
