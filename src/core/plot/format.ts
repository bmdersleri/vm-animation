const fmtCache = new Map<number, Intl.NumberFormat>();

export function formatNumber(v: number, decimals: number): string {
  let f = fmtCache.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    fmtCache.set(decimals, f);
  }
  return f.format(v === 0 ? 0 : v).replace('-', '−');
}

/** Formatter with just enough decimals for evenly spaced d3 ticks (steps are 1, 2 or 5 × 10^n). */
export function tickFormat(ticks: number[]): (v: number) => string {
  const step = ticks.length > 1 ? Math.abs(ticks[1] - ticks[0]) : 1;
  const dec = step > 0 ? Math.max(0, Math.min(6, -Math.floor(Math.log10(step) + 1e-9))) : 0;
  return (v) => formatNumber(v, dec);
}

/** "%91,2": ratio × 100 with `decimals`; while 0 < ratio < 1 would read "%0,0…" or "%100,0…", decimals grow up to `max`. */
export function formatPercent(ratio: number, decimals = 1, max = 6): string {
  let d = decimals;
  let s = formatNumber(ratio * 100, d);
  const inside = ratio > 0 && ratio < 1;
  while (inside && d < max && (!/[1-9]/.test(s) || /^100(,0*)?$/.test(s))) {
    d += 1;
    s = formatNumber(ratio * 100, d);
  }
  return `%${s}`;
}

/** formatNumber(v, decimals); while v ≠ 0 would still read as zero, decimals grow up to `max`. */
export function formatNonZero(v: number, decimals = 2, max = 6): string {
  let d = decimals;
  let s = formatNumber(v, d);
  while (v !== 0 && d < max && !/[1-9]/.test(s)) {
    d += 1;
    s = formatNumber(v, d);
  }
  return s;
}
