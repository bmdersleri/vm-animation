import type { GridSize } from '../../core/plot/grid-layer';
import type { Scales } from '../../core/plot/viewport';
import { BOOTS, CUSTOMERS } from './data';
import { predictTree } from './tree';

/** Ayrıldı votes of the first `m` bootstrap trees for a point. */
export function votes(x: readonly [number, number], m: number): number {
  let n = 0;
  for (let k = 0; k < m; k++) {
    n += predictTree(BOOTS[k].tree, x);
  }
  return n;
}

/** Majority class of `m` voters; a tie goes to Kaldı (0). */
export function majority(ayrildi: number, m: number): 0 | 1 {
  return ayrildi * 2 > m ? 1 : 0;
}

/**
 * Votes about customer `i` from the first `m` trees that did not draw it
 * (their out-of-bag trees).
 */
export function oobVotes(i: number, m: number): { ayrildi: number; kaldi: number } {
  const x: [number, number] = [CUSTOMERS[i].t, CUSTOMERS[i].c];
  let ayrildi = 0;
  let kaldi = 0;
  for (let k = 0; k < m; k++) {
    if (BOOTS[k].counts[i] !== 0) {
      continue;
    }
    if (predictTree(BOOTS[k].tree, x) === 1) {
      ayrildi++;
    } else {
      kaldi++;
    }
  }
  return { ayrildi, kaldi };
}

/**
 * OOB score of the first `m` trees: customers with no OOB vote are left out
 * of the total; the rest are predicted by their OOB majority.
 */
export function oobScore(m: number): { correct: number; total: number } {
  let correct = 0;
  let total = 0;
  for (let i = 0; i < CUSTOMERS.length; i++) {
    const v = oobVotes(i, m);
    const n = v.ayrildi + v.kaldi;
    if (n === 0) {
      continue;
    }
    total++;
    if (majority(v.ayrildi, n) === CUSTOMERS[i].y) {
      correct++;
    }
  }
  return { correct, total };
}

/**
 * GridLayer fill for the vote map of the first `m` trees: each cell gets the
 * Ayrıldı vote share at its centre as one of 11 steps, round(10 * share)
 * (x over the scale's x domain, row 0 = the top of the plot).
 */
export function voteFill(m: number, sc: Scales): (g: GridSize, out: Uint8Array) => void {
  const [x0, x1] = sc.x.domain();
  const [y0, y1] = sc.y.domain();
  return (g, out) => {
    const xs = new Float64Array(g.cols);
    for (let c = 0; c < g.cols; c++) {
      xs[c] = x0 + ((c + 0.5) / g.cols) * (x1 - x0);
    }
    const at: [number, number] = [0, 0];
    let i = 0;
    for (let r = 0; r < g.rows; r++) {
      at[1] = y1 - ((r + 0.5) / g.rows) * (y1 - y0);
      for (let c = 0; c < g.cols; c++) {
        at[0] = xs[c];
        out[i] = m > 0 ? Math.round((10 * votes(at, m)) / m) : 0;
        i++;
      }
    }
  };
}
