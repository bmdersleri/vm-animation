import { r1 } from './marks';

type Scale = (value: number) => number;
/** Maps an argument and its function value to one `x,y` path point. */
type Place = (arg: number, value: number) => string;

function points(f: Scale, a: number, b: number, n: number, place: Place): string[] {
  if (!Number.isInteger(n) || n < 2) throw new RangeError('At least two samples required');
  return Array.from({ length: n }, (_, i) => {
    const x = a + ((b - a) * i) / (n - 1);
    return place(x, f(x));
  });
}

function upright(sx: Scale, sy: Scale): Place {
  return (x, y) => `${r1(sx(x))},${r1(sy(y))}`;
}

/** SVG path of the function `f` sampled at `n` points over [x0, x1], mapped through `sx` and `sy`. */
export function curvePath(f: Scale, x0: number, x1: number, n: number, sx: Scale, sy: Scale): string {
  return 'M' + points(f, x0, x1, n, upright(sx, sy)).join('L');
}

/**
 * `curvePath` on its side, for a marginal curve beside a plot: the argument runs over [y0, y1] along the y axis
 * through `sy`, the function value along the x axis through `sx`.
 */
export function curvePathV(f: Scale, y0: number, y1: number, n: number, sx: Scale, sy: Scale): string {
  return 'M' + points(f, y0, y1, n, (y, v) => `${r1(sx(v))},${r1(sy(y))}`).join('L');
}

/** Closed SVG path under `f` between `a` and `b` down to `baseY`, sampled at `n` points. */
export function areaPath(f: Scale, a: number, b: number, n: number, sx: Scale, sy: Scale, baseY: number): string {
  if (a === b) return '';
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const curve = points(f, lo, hi, n, upright(sx, sy)).join('L');
  return `M${r1(sx(lo))},${r1(baseY)}L${curve}L${r1(sx(hi))},${r1(baseY)}Z`;
}
