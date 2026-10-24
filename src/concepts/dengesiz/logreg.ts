import type { Pt } from './smote';

/** A fitted two-feature logistic model. */
export type LogRegModel = { coef: [number, number]; intercept: number };

const MAX_STEPS = 50;
const STEP_TOL = 1e-12;

/** Solves the 3x3 system A s = b by Gaussian elimination with partial pivoting. */
function solve3(a: number[][], b: number[]): number[] {
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let r = col + 1; r < 3; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[piv][col])) {
        piv = r;
      }
    }
    [m[col], m[piv]] = [m[piv], m[col]];
    for (let r = col + 1; r < 3; r++) {
      const f = m[r][col] / m[col][col];
      for (let c = col; c < 4; c++) {
        m[r][c] -= f * m[col][c];
      }
    }
  }
  const s = [0, 0, 0];
  for (let r = 2; r >= 0; r--) {
    let acc = m[r][3];
    for (let c = r + 1; c < 3; c++) {
      acc -= m[r][c] * s[c];
    }
    s[r] = acc / m[r][r];
  }
  return s;
}

/** The logistic function. */
function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

/**
 * L2 logistic regression as in scikit-learn: minimises 1/2 |coef|^2 + C * sum w_i * logloss_i
 * (the intercept is not penalised). Newton's method from zero; stops when the step norm is
 * below 1e-12 or after 50 steps. w = null means all weights 1.
 */
export function fitLogReg(
  X: readonly Pt[],
  y: readonly (0 | 1)[],
  w: readonly number[] | null,
  C: number,
): { coef: [number, number]; intercept: number; iterations: number; converged: boolean } {
  const beta = [0, 0, 0];
  let iterations = 0;
  let converged = false;
  while (iterations < MAX_STEPS) {
    const grad = [beta[0], beta[1], 0];
    const hess = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 0],
    ];
    for (let n = 0; n < X.length; n++) {
      const wi = w ? w[n] : 1;
      const row = [X[n].x, X[n].y, 1];
      const p = sigmoid(beta[0] * row[0] + beta[1] * row[1] + beta[2]);
      const g = C * wi * (p - y[n]);
      const h = C * wi * p * (1 - p);
      for (let a = 0; a < 3; a++) {
        grad[a] += g * row[a];
        for (let b = 0; b < 3; b++) {
          hess[a][b] += h * row[a] * row[b];
        }
      }
    }
    const step = solve3(hess, grad);
    for (let a = 0; a < 3; a++) {
      beta[a] -= step[a];
    }
    iterations++;
    if (Math.hypot(step[0], step[1], step[2]) < STEP_TOL) {
      converged = true;
      break;
    }
  }
  return { coef: [beta[0], beta[1]], intercept: beta[2], iterations, converged };
}

/** Probability of class 1 at a point. */
export function predictProba(model: LogRegModel, p: Pt): number {
  return sigmoid(model.coef[0] * p.x + model.coef[1] * p.y + model.intercept);
}

/** The line a * x + b * y = c where the model gives probability = threshold (standardised plane). */
export function boundaryAt(model: LogRegModel, threshold: number): { a: number; b: number; c: number } {
  return {
    a: model.coef[0],
    b: model.coef[1],
    c: Math.log(threshold / (1 - threshold)) - model.intercept,
  };
}

/** sklearn class_weight="balanced": n / (2 * n_class) for the negative and the positive class. */
export function balancedWeights(y: readonly (0 | 1)[]): { neg: number; pos: number } {
  const pos = y.reduce<number>((s, v) => s + v, 0);
  const neg = y.length - pos;
  return { neg: y.length / (2 * neg), pos: y.length / (2 * pos) };
}
