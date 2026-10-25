import type { FeatureIndex, Triple } from './data';

/** Number of set bits of a coalition mask. */
export function popcount(mask: number): number {
  let count = 0;
  let rest = mask;
  while (rest > 0) {
    count += rest & 1;
    rest >>= 1;
  }
  return count;
}

/** The six orderings of the three features, in lexicographic order. */
export function orderings(): FeatureIndex[][] {
  return [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ];
}

/**
 * Marginal contribution of each feature (by feature index) when the features are added in `order`:
 * the difference of the coalition values `v` (index = feature bit mask) before and after the addition.
 */
export function marginals(v: readonly number[], order: readonly FeatureIndex[]): Triple {
  const out: Triple = [0, 0, 0];
  let mask = 0;
  for (const feature of order) {
    const next = mask | (1 << feature);
    out[feature] = v[next] - v[mask];
    mask = next;
  }
  return out;
}

function factorial(n: number): number {
  return n <= 1 ? 1 : n * factorial(n - 1);
}

/** Shapley weight of a coalition of `size` players among `n`: size! (n - size - 1)! / n!. */
export function shapleyWeight(size: number, n: number): number {
  return (factorial(size) * factorial(n - size - 1)) / factorial(n);
}

/** Shapley values by the weighted-subset formula. */
export function shapley(v: readonly number[]): Triple {
  const out: Triple = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    let sum = 0;
    for (let mask = 0; mask < 8; mask++) {
      if (mask & (1 << i)) {
        continue;
      }
      sum += shapleyWeight(popcount(mask), 3) * (v[mask | (1 << i)] - v[mask]);
    }
    out[i] = sum;
  }
  return out;
}

/** Shapley values as the mean of the marginal contributions over the six orderings. */
export function shapleyByOrder(v: readonly number[]): Triple {
  const out: Triple = [0, 0, 0];
  const all = orderings();
  for (const order of all) {
    const m = marginals(v, order);
    for (let i = 0; i < 3; i++) {
      out[i] += m[i] / all.length;
    }
  }
  return out;
}
