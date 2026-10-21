import { mean, median, quantile, std0 } from '../../core/stats';

/** transform = (x − center) / scale; a zero scale is treated as 1 (sklearn). */
export interface Fitted { center: number; scale: number }

const safe = (s: number): number => (s === 0 ? 1 : s);

export function fitStandard(xs: readonly number[]): Fitted {
  return { center: mean(xs), scale: safe(std0(xs)) };
}

export function fitMinMax(xs: readonly number[]): Fitted {
  const lo = Math.min(...xs);
  return { center: lo, scale: safe(Math.max(...xs) - lo) };
}

export function fitRobust(xs: readonly number[]): Fitted {
  return { center: median(xs), scale: safe(quantile(xs, 0.75) - quantile(xs, 0.25)) };
}

export function transform(f: Fitted, x: number): number {
  return (x - f.center) / f.scale;
}
