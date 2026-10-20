export type Metric = 'oklid' | 'manhattan';
export type Weighting = 'esit' | 'agirlikli';
export interface Vec { x: number; y: number }
export interface Scaler { mean: Vec; std: Vec }

export function fitScaler(points: Vec[]): Scaler {
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  const sx = Math.sqrt(points.reduce((s, p) => s + (p.x - mx) ** 2, 0) / n);
  const sy = Math.sqrt(points.reduce((s, p) => s + (p.y - my) ** 2, 0) / n);
  return { mean: { x: mx, y: my }, std: { x: sx || 1, y: sy || 1 } };
}

export function applyScaler(p: Vec, s: Scaler | null): Vec {
  if (!s) return { x: p.x, y: p.y };
  return { x: (p.x - s.mean.x) / s.std.x, y: (p.y - s.mean.y) / s.std.y };
}

export function invertScaler(p: Vec, s: Scaler | null): Vec {
  if (!s) return { x: p.x, y: p.y };
  return { x: p.x * s.std.x + s.mean.x, y: p.y * s.std.y + s.mean.y };
}

export function distance(a: Vec, b: Vec, m: Metric): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return m === 'oklid' ? Math.sqrt(dx * dx + dy * dy) : Math.abs(dx) + Math.abs(dy);
}

export interface Neighbor { index: number; distance: number; weight: number; cls: 0 | 1 }

export function kNearest(
  points: Vec[], labels: (0 | 1)[], q: Vec, k: number, m: Metric, w: Weighting,
): Neighbor[] {
  const sorted = points
    .map((p, index) => ({ index, distance: distance(p, q, m) }))
    .sort((a, b) => a.distance - b.distance || a.index - b.index)
    .slice(0, k);
  const anyZero = sorted.some((n) => n.distance === 0);
  return sorted.map((n) => {
    let weight = 1;
    if (w === 'agirlikli') weight = anyZero ? (n.distance === 0 ? 1 : 0) : 1 / n.distance;
    return { index: n.index, distance: n.distance, weight, cls: labels[n.index] };
  });
}

export interface Vote { scores: [number, number]; winner: 0 | 1 }

export function vote(n: Neighbor[]): Vote {
  const scores: [number, number] = [0, 0];
  for (const x of n) scores[x.cls] += x.weight;
  return { scores, winner: scores[1] > scores[0] ? 1 : 0 };
}
