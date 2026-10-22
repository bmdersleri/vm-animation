import { formatNumber } from '../../core/plot/format';
import { dendrogramData as D, type Linkage } from './data';
import { branches, largestGap, type Branch } from './tree';

const N = D.points.length;

const treeCache = new Map<Linkage, readonly Branch[]>();
/** Branches of a linkage, computed once. */
export function treeOf(linkage: Linkage): readonly Branch[] {
  let t = treeCache.get(linkage);
  if (!t) {
    t = branches(D.linkages[linkage], N);
    treeCache.set(linkage, t);
  }
  return t;
}

/** A merge height with a decimal comma: 0,23. */
export const heightText = (h: number): string => formatNumber(h, 2);

/** Highest merge of a linkage: the top of the height axis. */
export const maxHeightOf = (linkage: Linkage): number => D.linkages[linkage].merges[N - 2].height;

/** A cluster by its 1-based point numbers: "Nokta 3", "{1, 4} kümesi" or "7 noktalı küme ({1, 2, 3, …})". */
export function clusterName(members: readonly number[]): string {
  if (members.length === 1) return `Nokta ${members[0] + 1}`;
  if (members.length <= 5) return `{${members.map((m) => m + 1).join(', ')}} kümesi`;
  return `${members.length} noktalı küme ({${members.slice(0, 3).map((m) => m + 1).join(', ')}, …})`;
}

export interface MergeInfo {
  /** Points of the two merged clusters. */
  left: readonly number[];
  right: readonly number[];
  height: number;
  text: string;
}

/** The `m`-th merge (1-based) of a linkage; m = 0 (or out of range) has no merge. */
export function mergeInfo(linkage: Linkage, m: number): MergeInfo {
  const merges = D.linkages[linkage].merges;
  if (!Number.isInteger(m) || m < 1 || m > merges.length) return { left: [], right: [], height: 0, text: '' };
  const tree = treeOf(linkage);
  const members = (id: number): readonly number[] => (id < N ? [id] : tree[id - N].members);
  const row = merges[m - 1];
  const left = members(row.a);
  const right = members(row.b);
  return {
    left,
    right,
    height: row.height,
    text: `Birleşme ${m} / ${merges.length}: ${clusterName(left)} ile ${clusterName(right)} birleşti, uzaklık ${heightText(row.height)}.`,
  };
}

/** Cluster sizes of the k-cluster cut, in cluster-number order (left to right); an unknown k reads as one cluster. */
export function cutSizes(linkage: Linkage, k: number): number[] {
  const cut = D.linkages[linkage].cuts.find((c) => c.k === k);
  if (!cut) return [N];
  const sizes = new Array<number>(k).fill(0);
  for (const l of cut.labels) sizes[l] += 1;
  return sizes;
}

/** "7 · 7 · 3". */
export const sizesText = (sizes: readonly number[]): string => sizes.join(' · ');

/** How a named group is spread over the clusters of the 3-cluster cut: sizes, largest first (C: [3] whole, [2, 1] split). */
export function splitOfGroup(linkage: Linkage, group: 'A' | 'B' | 'C' | 'zincir', k = D.naturalK): number[] {
  const labels = D.linkages[linkage].cuts.find((c) => c.k === k)?.labels ?? [];
  const per = new Map<number, number>();
  for (const i of D.meta.groups[group]) per.set(labels[i], (per.get(labels[i]) ?? 0) + 1);
  return [...per.values()].sort((a, b) => b - a);
}

/** The widest vertical gap of a linkage, in words. */
export function gapText(linkage: Linkage): string {
  const g = largestGap(D.linkages[linkage]);
  return `En uzun dikey boşluk ${heightText(g.low)} ile ${heightText(g.high)} arasında; bu aralıkta kesince ${g.k} küme kalır.`;
}

export interface LinkageRow {
  linkage: Linkage;
  definition: string;
  when: string;
  /** Cluster sizes at k = 3, largest first. */
  sizes: number[];
}

const ROW_TEXT: Record<'ward' | 'complete' | 'single', { definition: string; when: string }> = {
  ward: {
    definition: 'Birleşince küme içi kareler toplamının en az arttığı iki küme birleşir.',
    when: 'Derli toplu, benzer boyda kümeler beklendiğinde; en yaygın ilk seçim.',
  },
  complete: {
    definition: 'İki kümenin uzaklığı, en uzak iki noktasının uzaklığıdır.',
    when: 'Sıkı, benzer çaplı kümeler için; aykırı noktalara duyarlıdır.',
  },
  single: {
    definition: 'İki kümenin uzaklığı, en yakın iki noktasının uzaklığıdır.',
    when: 'Uzun, ince şekilli kümeler için; ama zincirleme eğilimi vardır.',
  },
};

/** Step 10 rows: Ward, complete, single (average is Lab-only). */
export function linkageRows(): LinkageRow[] {
  return (['ward', 'complete', 'single'] as const).map((linkage) => ({
    linkage,
    ...ROW_TEXT[linkage],
    sizes: cutSizes(linkage, 3).sort((a, b) => b - a),
  }));
}

export const LINKAGE_NAME: Readonly<Record<Linkage, string>> = { ward: 'Ward', complete: 'complete', average: 'average', single: 'single' };
