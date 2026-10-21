import type { KResult, Pt } from './data';

export function sqDist(p: Pt, q: Pt): number {
  const dx = p[0] - q[0];
  const dy = p[1] - q[1];
  return dx * dx + dy * dy;
}

/** Index of the nearest centre; the smaller index wins a tie. */
export function nearest(p: Pt, centers: readonly Pt[]): number {
  let best = 0;
  let bestD = Infinity;
  centers.forEach((c, j) => {
    const d = sqDist(p, c);
    if (d < bestD) { bestD = d; best = j; }
  });
  return best;
}

export function inertiaOf(points: readonly Pt[], labels: readonly number[], centers: readonly Pt[]): number {
  return points.reduce((sum, p, i) => sum + sqDist(p, centers[labels[i]]), 0);
}

/**
 * Inertia drop from k-1 to k, for k=2..10, taken between the inertias as shown
 * (2 decimals) so the displayed drops add up to the displayed values.
 */
export function drops(ks: readonly KResult[]): number[] {
  const cents = (v: number) => Math.round(v * 100);
  const out: number[] = [];
  for (let i = 1; i < ks.length; i++) out.push((cents(ks[i - 1].inertia) - cents(ks[i].inertia)) / 100);
  return out;
}
