import { r1 } from './marks';

/** One horizontal piece of a step function: value `y` on [x0, x1]. */
export type StepSegment = { x0: number; x1: number; y: number };

/**
 * Pieces of a step function on [x0, x1] cut at `thresholds` (sorted here; duplicates and values
 * outside the open range are dropped). Each piece takes the value of `valueAt` at its midpoint.
 */
export function segmentsFrom(
  thresholds: readonly number[],
  valueAt: (x: number) => number,
  x0: number,
  x1: number,
): StepSegment[] {
  const cuts = [...new Set(thresholds.filter((t) => t > x0 && t < x1))].sort((a, b) => a - b);
  const edges = [x0, ...cuts, x1];
  const out: StepSegment[] = [];
  for (let i = 0; i + 1 < edges.length; i++) {
    out.push({ x0: edges[i], x1: edges[i + 1], y: valueAt((edges[i] + edges[i + 1]) / 2) });
  }
  return out;
}

/**
 * One SVG path for a step function: each piece is a horizontal line and the next piece
 * starts with a vertical jump at the shared threshold. `sx` and `sy` map data to pixels.
 */
export function stepPath(
  segs: readonly StepSegment[],
  sx: (v: number) => number,
  sy: (v: number) => number,
): string {
  let d = '';
  segs.forEach((s, i) => {
    const y = r1(sy(s.y));
    d += `${i === 0 ? 'M' : 'L'}${r1(sx(s.x0))},${y}L${r1(sx(s.x1))},${y}`;
  });
  return d;
}
