import { r1 } from './marks';
type Scale = (value: number) => number;
function points(f: Scale, a: number, b: number, n: number, sx: Scale, sy: Scale): string[] {
 if (!Number.isInteger(n) || n < 2) throw new RangeError('At least two samples required');
 return Array.from({ length: n }, (_, i) => { const x = a + (b - a) * i / (n - 1); return r1(sx(x)) + ',' + r1(sy(f(x))); });
}
export function curvePath(f: Scale, x0: number, x1: number, n: number, sx: Scale, sy: Scale): string {
 return 'M' + points(f, x0, x1, n, sx, sy).join('L');
}
export function areaPath(f: Scale, a: number, b: number, n: number, sx: Scale, sy: Scale, baseY: number): string {
 if (a === b) return '';
 const lo = Math.min(a, b), hi = Math.max(a, b);
 return 'M' + r1(sx(lo)) + ',' + r1(baseY) + 'L' + points(f, lo, hi, n, sx, sy).join('L') + 'L' + r1(sx(hi)) + ',' + r1(baseY) + 'Z';
}
