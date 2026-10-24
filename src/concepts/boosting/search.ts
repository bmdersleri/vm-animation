import { mulberry32 } from '../../core/random';

/** Re-exported so existing imports keep working. */
export { mulberry32 };

const N_LR = 9;
const N_DEPTH = 6;
const N_CELLS = N_DEPTH * N_LR;

/**
 * Scores within this relative distance are a tie (the smaller cell index wins): mirror cells
 * have mathematically equal scores that differ in the last bit between Python and JavaScript.
 */
const TIE_EPS = 1e-9;

/** The order in which the grid search takes learning-rate indices (even ones first). */
const LR_ORDER = [0, 2, 4, 6, 8, 1, 3, 5, 7];

/** Cell index of the surface: depth index times 9 plus learning-rate index. */
export function cellIndex(depthIdx: number, lrIdx: number): number {
  return depthIdx * N_LR + lrIdx;
}

/**
 * Cells a grid search with `budget` trials tries: depth indices {2, 4} below budget 12,
 * {1, 3, 5} from 12 on; the first floor(budget / depth count) learning-rate indices of
 * LR_ORDER (at most 9), small to large. Depth outside, learning rate inside.
 */
export function gridTrials(budget: number): number[] {
  const depths = budget < 12 ? [2, 4] : [1, 3, 5];
  const count = Math.min(N_LR, Math.floor(budget / depths.length));
  const lrs = LR_ORDER.slice(0, count).sort((a, b) => a - b);
  const cells: number[] = [];
  for (const d of depths) {
    for (const l of lrs) {
      cells.push(cellIndex(d, l));
    }
  }
  return cells;
}

function kernel(a: number, b: number): number {
  const du = (Math.floor(a / N_LR) - Math.floor(b / N_LR)) / 5;
  const dv = ((a % N_LR) - (b % N_LR)) / 8;
  return Math.exp(-(du * du + dv * dv) / (2 * 0.2 * 0.2));
}

/**
 * Sequential (Parzen-style) search: three seeded random cells, then every trial takes the
 * untried cell with the best ratio of closeness to the good quarter of the tried cells
 * over closeness to the rest. Returns the cell indices in trial order.
 */
export function sequentialSearch(
  auc: readonly (readonly number[])[],
  budget: number,
  seed: number,
): number[] {
  const flat = auc.flat();
  const rng = mulberry32(seed);
  const tried: number[] = [];
  const total = Math.min(budget, N_CELLS);
  while (tried.length < Math.min(3, total)) {
    let c = Math.floor(rng() * N_CELLS);
    while (tried.includes(c)) {
      c = (c + 1) % N_CELLS;
    }
    tried.push(c);
  }
  while (tried.length < total) {
    const ranked = tried.map((_, k) => k).sort((p, q) => flat[tried[q]] - flat[tried[p]] || p - q);
    const nGood = Math.max(1, Math.ceil(0.25 * tried.length));
    const goodSet = new Set(ranked.slice(0, nGood));
    const good = tried.filter((_, k) => goodSet.has(k));
    const bad = tried.filter((_, k) => !goodSet.has(k));
    let best = -1;
    let bestScore = 0;
    for (let c = 0; c < N_CELLS; c++) {
      if (tried.includes(c)) {
        continue;
      }
      let kg = 0;
      for (const g of good) {
        kg += kernel(c, g);
      }
      let kb = 0;
      for (const b of bad) {
        kb += kernel(c, b);
      }
      const score = kg / good.length / ((bad.length > 0 ? kb / bad.length : 0) + 1e-9);
      if (best < 0 || score > bestScore + TIE_EPS * Math.max(1, Math.abs(bestScore))) {
        best = c;
        bestScore = score;
      }
    }
    tried.push(best);
  }
  return tried;
}
