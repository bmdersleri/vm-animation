import { computeRegions } from './regions';
import { MARK } from '../../core/plot/marks';
import { GridLayer } from '../../core/plot/grid-layer';
import type { KnnView } from './view';
import type { Rect, Scales } from '../../core/plot/viewport';
import type { Mode } from '../../core/mode';

/** Tint opacity per mode: a projector washes light tints out, so Ders is stronger. */
export const REGION_ALPHA: Record<Mode, number> = { lab: 0.12, ders: 0.22 };

/**
 * k-NN decision-region tint: a GridLayer whose cells come from computeRegions.
 * Recomputes only when the inputs that decide the regions change (not the
 * query or the phase).
 */
export class RegionsLayer {
  private readonly grid: GridLayer;

  constructor(canvas: HTMLCanvasElement, alpha = REGION_ALPHA.lab) {
    this.grid = new GridLayer(canvas, MARK, alpha, { measure: 'regions' });
  }

  /** Tint opacity (0..1). Takes effect on the next update(); the grid is reused if still valid. */
  setAlpha(alpha: number): void {
    this.grid.setAlpha(alpha);
  }

  resize(w: number, h: number): void {
    this.grid.resize(w, h);
  }

  update(v: KnnView, sc: Scales, plot: Rect): void {
    if (!v.regions) {
      this.grid.update(null, plot, () => {});
      return;
    }
    const [x0, x1] = sc.x.domain();
    const [y0, y1] = sc.y.domain();
    const key = [v.space.dataset, v.space.scaled, v.k, v.metric, v.weighting, x0, x1, y0, y1].join('|');
    this.grid.update(key, plot, (g, out) => {
      computeRegions(v.space, v.k, v.metric, v.weighting, { cols: g.cols, rows: g.rows, x0, x1, y0, y1 }, out);
    });
  }
}
