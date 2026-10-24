/**
 * Shifts labels (given by their wanted pixel y, in the order of `ys`) apart by at least `gap`,
 * keeping their order and the range [lo, hi]. Used for the ν labels, whose curves end almost together.
 */
export function dodge(ys: readonly number[], gap: number, lo: number, hi: number): number[] {
  const order = ys.map((_, i) => i).sort((a, b) => ys[a] - ys[b]);
  const out = [...ys];
  let prev = lo - gap;
  for (const i of order) {
    out[i] = Math.max(ys[i], prev + gap, lo);
    prev = out[i];
  }
  let next = hi + gap;
  for (const i of [...order].reverse()) {
    out[i] = Math.min(out[i], next - gap);
    next = out[i];
  }
  return out;
}
