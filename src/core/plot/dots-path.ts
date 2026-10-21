import { r1, trianglePath } from './marks';

/** One circle sub-path per point: "M x−r,y a r,r 0 1,0 2r,0 a r,r 0 1,0 −2r,0". */
export function circlesPath(xs: ArrayLike<number>, ys: ArrayLike<number>, r: number): string {
  const arc = `a${r},${r} 0 1,0 `;
  let d = '';
  for (let i = 0; i < xs.length; i++) d += `M${r1(xs[i] - r)},${r1(ys[i])}${arc}${2 * r},0${arc}${-2 * r},0`;
  return d;
}

/** One triangle sub-path per point, with the geometry of trianglePath(r). */
export function trianglesPath(xs: ArrayLike<number>, ys: ArrayLike<number>, r: number): string {
  const pts = [...trianglePath(r).matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  let d = '';
  for (let i = 0; i < xs.length; i++) {
    pts.forEach(([px, py], k) => {
      d += `${k === 0 ? 'M' : 'L'}${r1(xs[i] + px)},${r1(ys[i] + py)}`;
    });
    d += 'Z';
  }
  return d;
}

/** A single diamond whose diagonal radius is r·√2. */
export function diamondPath(x: number, y: number, r: number): string {
  const h = r * Math.SQRT2;
  return `M${r1(x)},${r1(y - h)}L${r1(x + h)},${r1(y)}L${r1(x)},${r1(y + h)}L${r1(x - h)},${r1(y)}Z`;
}

/** "M x1,y1L x2,y2" for each index. */
export function segmentsPath(x1: ArrayLike<number>, y1: ArrayLike<number>, x2: ArrayLike<number>, y2: ArrayLike<number>): string {
  let d = '';
  for (let i = 0; i < x1.length; i++) d += `M${r1(x1[i])},${r1(y1[i])}L${r1(x2[i])},${r1(y2[i])}`;
  return d;
}

/** Number of 'M' commands. */
export function countSubpaths(d: string): number {
  return (d.match(/M/g) ?? []).length;
}
