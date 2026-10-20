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
