import { mulberry32 } from '../../core/random';

/** Chance that a customer is never drawn in n draws with replacement: (1 - 1/n)^n, tends to 1/e. */
export function oobChance(n: number): number {
  return Math.pow(1 - 1 / n, n);
}

/**
 * Accuracy of the majority of m independent models that are each right with
 * probability p (binomial sum). m should be odd; with an even m a tie counts
 * as wrong.
 */
export function majorityAccuracy(p: number, m: number): number {
  let sum = 0;
  let choose = 1; // C(m, k), built up from k = 0
  for (let k = 0; k <= m; k++) {
    if (k > 0) {
      choose = (choose * (m - k + 1)) / k;
    }
    if (k * 2 > m) {
      sum += choose * Math.pow(p, k) * Math.pow(1 - p, m - k);
    }
  }
  return sum;
}

/** Variance of the mean of m models with variance sigma2 and pairwise correlation rho. */
export function ensembleVariance(rho: number, sigma2: number, m: number): number {
  return rho * sigma2 + ((1 - rho) * sigma2) / m;
}

/** n draws with replacement from 0..n-1 with a seeded generator (mulberry32). */
export function labBootstrap(n: number, seed: number): number[] {
  const next = mulberry32(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(Math.floor(next() * n));
  }
  return out;
}

/** Mean and population standard deviation (numpy `np.std`, ddof 0). */
export function meanStd(xs: number[]): { mean: number; std: number } {
  const n = xs.length;
  let sum = 0;
  for (const x of xs) {
    sum += x;
  }
  const mean = sum / n;
  let sq = 0;
  for (const x of xs) {
    sq += (x - mean) * (x - mean);
  }
  return { mean, std: Math.sqrt(sq / n) };
}
