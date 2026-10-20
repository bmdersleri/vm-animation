import type { Metric, Weighting } from './knn';
import type { FeatureSpace } from './space';

export interface RegionGrid { cols: number; rows: number; x0: number; x1: number; y0: number; y1: number }

/**
 * Class per cell centre (row-major, row 0 = top / y1). Same result as
 * vote(kNearest(...)): ties on distance go to the lower index, a zero-distance
 * neighbour takes all the weight in 'agirlikli'. Uses a sorted insertion buffer
 * of size k and typed arrays; no per-cell allocation.
 */
export function computeRegions(
  s: FeatureSpace, k: number, m: Metric, w: Weighting, g: RegionGrid, out?: Uint8Array,
): Uint8Array {
  const { cols, rows } = g;
  const res = out && out.length >= cols * rows ? out : new Uint8Array(cols * rows);
  const n = s.points.length;
  const px = new Float64Array(n);
  const py = new Float64Array(n);
  const lab = new Uint8Array(n);
  for (let i = 0; i < n; i++) { px[i] = s.points[i].x; py[i] = s.points[i].y; lab[i] = s.labels[i]; }
  const kk = Math.min(k, n);
  const bd = new Float64Array(kk);
  const bi = new Int32Array(kk); // indices of the previous cell's neighbours (seeds the pruning bound)
  let haveSeed = false;
  const euclid = m === 'oklid';
  const weighted = w === 'agirlikli';
  const dxCell = (g.x1 - g.x0) / cols;
  const dyCell = (g.y1 - g.y0) / rows;

  // per-column / per-row partial terms (dx*dx or |dx|), so a cell costs one add per point
  const tx = new Float64Array(cols * n);
  for (let c = 0; c < cols; c++) {
    const qx = g.x0 + (c + 0.5) * dxCell;
    for (let i = 0; i < n; i++) {
      const dx = px[i] - qx;
      tx[c * n + i] = euclid ? dx * dx : Math.abs(dx);
    }
  }
  const ty = new Float64Array(n);

  for (let r = 0; r < rows; r++) {
    const qy = g.y1 - (r + 0.5) * dyCell;
    for (let i = 0; i < n; i++) {
      const dy = py[i] - qy;
      ty[i] = euclid ? dy * dy : Math.abs(dy);
    }
    for (let c = 0; c < cols; c++) {
      const off = c * n;
      let cnt = 0;
      let worst = Infinity; // exact distance of the k-th entry once the buffer is full
      let gate = Infinity; // cheap pre-filter (squared for Euclid), slightly loose so exact d decides
      if (haveSeed) {
        // the previous cell's k neighbours are k valid candidates here, so their max distance bounds the k-th
        let b = 0;
        for (let j = 0; j < kk; j++) {
          const t2 = tx[off + bi[j]] + ty[bi[j]];
          if (t2 > b) b = t2;
        }
        gate = euclid ? b * (1 + 1e-9) : b;
      }
      for (let i = 0; i < n; i++) {
        const t2 = tx[off + i] + ty[i];
        if (t2 > gate) continue;
        const d = euclid ? Math.sqrt(t2) : t2;
        if (cnt === kk) {
          // equal distance has a larger index, so it loses
          if (d >= worst) continue;
        } else cnt++;
        // insert after all entries with distance <= d (keeps (distance, index) order)
        let j = cnt - 1;
        while (j > 0 && bd[j - 1] > d) { bd[j] = bd[j - 1]; bi[j] = bi[j - 1]; j--; }
        bd[j] = d;
        bi[j] = i;
        if (cnt === kk) {
          worst = bd[kk - 1];
          gate = euclid ? worst * worst * (1 + 1e-9) : worst;
        }
      }
      haveSeed = true;
      let s0 = 0;
      let s1 = 0;
      if (weighted && cnt > 0 && bd[0] === 0) {
        for (let j = 0; j < cnt && bd[j] === 0; j++) { if (lab[bi[j]]) s1 += 1; else s0 += 1; }
      } else {
        for (let j = 0; j < cnt; j++) {
          const wt = weighted ? 1 / bd[j] : 1;
          if (lab[bi[j]]) s1 += wt; else s0 += wt;
        }
      }
      res[r * cols + c] = s1 > s0 ? 1 : 0;
    }
  }
  return res;
}
