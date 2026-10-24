import { formatNumber as f } from './format';

/** Ticks of a log axis over [lo, hi]: decades when the span is wide, else 1-2-5 per decade. */
export function logAxis(lo: number, hi: number): { y: [number, number]; ticks: number[]; format: (v: number) => string } {
  const mult = Math.log10(hi / lo) > 3 ? [1] : [1, 2, 5];
  const ticks: number[] = [];
  for (let k = Math.floor(Math.log10(lo)); k <= Math.ceil(Math.log10(hi)); k++) {
    for (const m of mult) {
      const v = Number(`${m}e${k}`);
      if (v >= lo && v <= hi) ticks.push(Math.log10(v));
    }
  }
  const format = (t: number): string => f(10 ** t, Math.max(0, -Math.floor(t + 1e-9)));
  return { y: [Math.log10(lo), Math.log10(hi)], ticks, format };
}
