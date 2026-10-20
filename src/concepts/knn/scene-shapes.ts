import type { Metric } from './knn';

/** Scene colours (ruling R8): marks/fills vs AA-safe text variants. */
export const NAVY = '#14365C';
export const MARK = ['#0EA5A4', '#F08A00'] as const; // Kaldı, Ayrıldı
export const TEXT = ['#0B7473', '#A85A00'] as const;
export const GRID = '#E3E9F0';
export const FRAME = '#C9D5E3';
export const WHITE = '#ffffff';

/** One decimal is plenty for SVG coordinates and keeps attribute strings short. */
export const r1 = (n: number): number => Math.round(n * 10) / 10;

/** Equilateral triangle (apex up) with the same area as a circle of radius r, centred on its centroid. */
export function trianglePath(r: number): string {
  const a = r * Math.sqrt((4 * Math.PI) / Math.sqrt(3));
  const R = a / Math.sqrt(3);
  return `M0,${r1(-R)}L${r1(a / 2)},${r1(R / 2)}L${r1(-a / 2)},${r1(R / 2)}Z`;
}

/** Neighbourhood boundary in px: m = 0 is an ellipse (Öklid), m = 1 a diamond (Manhattan). */
export interface Shape { cx: number; cy: number; rx: number; ry: number; m: number }

export function boundaryShape(metric: Metric, cx: number, cy: number, rx: number, ry: number): Shape {
  return { cx, cy, rx, ry, m: metric === 'manhattan' ? 1 : 0 };
}

export function lerpShape(a: Shape, b: Shape, t: number): Shape {
  const l = (p: number, q: number): number => p + (q - p) * t;
  return { cx: l(a.cx, b.cx), cy: l(a.cy, b.cy), rx: l(a.rx, b.rx), ry: l(a.ry, b.ry), m: l(a.m, b.m) };
}

const MORPH_N = 96;

/**
 * Exact shapes at m = 0 (two arcs) and m = 1 (4 vertices); in between (only
 * during a metric morph) a polygon blending the ellipse and diamond points at
 * the same angle.
 */
export function shapePath(s: Shape): string {
  const { cx, cy, rx, ry } = s;
  if (s.m <= 0) {
    return `M${r1(cx - rx)},${r1(cy)}A${r1(rx)},${r1(ry)} 0 1 0 ${r1(cx + rx)},${r1(cy)}`
      + `A${r1(rx)},${r1(ry)} 0 1 0 ${r1(cx - rx)},${r1(cy)}Z`;
  }
  if (s.m >= 1) {
    return `M${r1(cx)},${r1(cy - ry)}L${r1(cx + rx)},${r1(cy)}L${r1(cx)},${r1(cy + ry)}L${r1(cx - rx)},${r1(cy)}Z`;
  }
  let d = '';
  for (let i = 0; i < MORPH_N; i++) {
    const th = (2 * Math.PI * i) / MORPH_N;
    const c = Math.cos(th);
    const sn = Math.sin(th);
    const k = 1 + s.m * (1 / (Math.abs(c) + Math.abs(sn)) - 1); // 1 on the ellipse, |c|+|s| scaling on the diamond
    d += `${i ? 'L' : 'M'}${r1(cx + rx * c * k)},${r1(cy + ry * sn * k)}`;
  }
  return `${d}Z`;
}
