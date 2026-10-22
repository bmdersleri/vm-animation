import type { Pt } from './data';

export type Kind = 'core' | 'border' | 'noise';
export interface DbscanResult {
  readonly kind: readonly Kind[];
  /** -1 noise; clusters 0.. in discovery order. */
  readonly label: readonly number[];
  /** Indices with d <= eps, self included. */
  readonly neighbours: readonly (readonly number[])[];
  /** Points in the order the expansion reached them. */
  readonly order: readonly number[];
  readonly clusters: number;
}

/** DBSCAN as sklearn defines it: d <= eps, self counted, core = count >= minSamples. */
export function dbscan(points: readonly Pt[], eps: number, minSamples: number): DbscanResult {
  const n = points.length;
  const e2 = eps * eps;
  const neighbours: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    neighbours[i].push(i);
    for (let j = i + 1; j < n; j++) {
      const dx = points[i][0] - points[j][0];
      const dy = points[i][1] - points[j][1];
      if (dx * dx + dy * dy <= e2) {
        neighbours[i].push(j);
        neighbours[j].push(i);
      }
    }
  }
  for (const list of neighbours) list.sort((a, b) => a - b);
  const isCore = neighbours.map((list) => list.length >= minSamples);

  const label = new Array<number>(n).fill(-1);
  const order: number[] = [];
  let clusters = 0;
  for (let start = 0; start < n; start++) {
    if (!isCore[start] || label[start] !== -1) continue;
    const c = clusters++;
    label[start] = c;
    order.push(start);
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
      const v = queue[head];
      for (const w of neighbours[v]) {
        if (label[w] !== -1) continue;
        label[w] = c;
        order.push(w);
        if (isCore[w]) queue.push(w);
      }
    }
  }
  const kind = label.map((l, i): Kind => (isCore[i] ? 'core' : l >= 0 ? 'border' : 'noise'));
  return { kind, label, neighbours, order, clusters };
}
