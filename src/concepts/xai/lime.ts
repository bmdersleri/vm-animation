import type { LimeResult, Pattern, Triple } from './data';

/** Euclidean distance of a binary pattern from the customer (all three features in its bin). */
export function patternDistance(mask: number): number {
  let ones = 0;
  for (let j = 0; j < 3; j++) {
    ones += (mask >> j) & 1;
  }
  return Math.sqrt(3 - ones);
}

/** LIME exponential kernel on a distance: sqrt(exp(-d^2 / width^2)). */
export function kernelWeight(d: number, width: number): number {
  return Math.sqrt(Math.exp(-(d * d) / (width * width)));
}

/** Solves a 3 x 3 linear system by Gauss elimination with partial pivoting. */
function solve3(a: number[][], b: number[]): number[] {
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let r = col + 1; r < 3; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) {
        pivot = r;
      }
    }
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let r = col + 1; r < 3; r++) {
      const f = m[r][col] / m[col][col];
      for (let c = col; c < 4; c++) {
        m[r][c] -= f * m[col][c];
      }
    }
  }
  const x = [0, 0, 0];
  for (let r = 2; r >= 0; r--) {
    let s = m[r][3];
    for (let c = r + 1; c < 3; c++) {
      s -= m[r][c] * x[c];
    }
    x[r] = s / m[r][r];
  }
  return x;
}

/**
 * Weighted Ridge (intercept unpenalised) solved from the eight pattern summaries: features are the
 * mask bits, a pattern sample weight is its kernel weight (multiplicity n). Centre on the weighted
 * means, solve (X'WX + alpha I) beta = X'Wy. `score` is the weighted R^2 (within-pattern `ss`
 * included), null when the weighted total variance vanishes.
 */
export function limeFit(patterns: readonly Pattern[], width: number, alpha = 1): LimeResult {
  const rows = patterns.filter(p => p.n > 0);
  const weights = rows.map(p => kernelWeight(patternDistance(p.mask), width));
  const mult = rows.map((p, i) => p.n * weights[i]);
  const total = mult.reduce((a, b) => a + b, 0);
  const bit = (p: Pattern, j: number): number => (p.mask >> j) & 1;
  const xbar = [0, 1, 2].map(j => rows.reduce((s, p, i) => s + mult[i] * bit(p, j), 0) / total);
  const ybar = rows.reduce((s, p, i) => s + mult[i] * p.mean, 0) / total;
  const a = [0, 1, 2].map(r => [0, 1, 2].map(c => {
    const sum = rows.reduce((s, p, i) => s + mult[i] * (bit(p, r) - xbar[r]) * (bit(p, c) - xbar[c]), 0);
    return sum + (r === c ? alpha : 0);
  }));
  const b = [0, 1, 2].map(j => rows.reduce((s, p, i) => s + mult[i] * (bit(p, j) - xbar[j]) * (p.mean - ybar), 0));
  const beta = solve3(a, b);
  const intercept = ybar - beta[0] * xbar[0] - beta[1] * xbar[1] - beta[2] * xbar[2];
  const pred = (p: Pattern): number => intercept + beta[0] * bit(p, 0) + beta[1] * bit(p, 1) + beta[2] * bit(p, 2);
  let ssRes = 0;
  let ssTot = 0;
  rows.forEach((p, i) => {
    ssRes += weights[i] * (p.ss + p.n * (p.mean - pred(p)) ** 2);
    ssTot += weights[i] * (p.ss + p.n * (p.mean - ybar) ** 2);
  });
  return {
    coef: [beta[0], beta[1], beta[2]] as Triple,
    intercept,
    localPred: intercept + beta[0] + beta[1] + beta[2],
    score: ssTot < 1e-12 ? null : 1 - ssRes / ssTot,
  };
}
