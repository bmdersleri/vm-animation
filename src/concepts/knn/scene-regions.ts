import { computeRegions } from './regions';
import { MARK } from '../../core/plot/marks';
import type { KnnView } from './view';
import type { Rect, Scales } from '../../core/plot/viewport';
import type { Mode } from '../../core/mode';

const CELL_PX = 6;
/** Tint opacity per mode: a projector washes light tints out, so Ders is stronger. */
export const REGION_ALPHA: Record<Mode, number> = { lab: 0.12, ders: 0.22 };

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const COLS = MARK.map(rgb);

/**
 * Decision-region tint on a <canvas> under the SVG. The grid is computed at
 * ~one cell per 6 CSS px of the plot rect into a reused Uint8Array, written to
 * a reused grid-resolution ImageData (straight alpha, as ImageData expects) and
 * drawn scaled onto the plot rect without smoothing. Recomputes only when the
 * inputs that decide the regions change (not the query or the phase).
 * setAlpha only repaints the cached grid on the next update (no recompute).
 * A null 2D context (jsdom) makes this a no-op.
 */
export class RegionsLayer {
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly off: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D | null = null;
  private cells = new Uint8Array(0);
  private img: ImageData | null = null;
  private key = '';
  private dpr = 1;
  private alpha: number;
  private n = 0; // cells in the cached grid
  private plot: Rect | null = null;
  private repaint = false;

  constructor(private readonly canvas: HTMLCanvasElement, alpha = REGION_ALPHA.lab) {
    this.ctx = canvas.getContext('2d');
    this.off = canvas.ownerDocument.createElement('canvas');
    this.alpha = Math.round(alpha * 255);
  }

  /** Tint opacity (0..1). Takes effect on the next update(); the grid is reused if still valid. */
  setAlpha(alpha: number): void {
    const a = Math.round(alpha * 255);
    if (a === this.alpha) return;
    this.alpha = a;
    this.repaint = true;
  }

  resize(w: number, h: number): void {
    this.dpr = globalThis.devicePixelRatio || 1;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.width = Math.max(1, Math.round(w * this.dpr));
    this.canvas.height = Math.max(1, Math.round(h * this.dpr));
    this.key = ''; // resizing the backing store cleared it
  }

  update(v: KnnView, sc: Scales, plot: Rect): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (!v.regions) {
      if (this.key !== 'off') this.clear(ctx);
      this.key = 'off';
      return;
    }
    const [x0, x1] = sc.x.domain();
    const [y0, y1] = sc.y.domain();
    const key = [
      v.space.dataset, v.space.scaled, v.k, v.metric, v.weighting,
      plot.left, plot.top, plot.width, plot.height, x0, x1, y0, y1, this.canvas.width, this.canvas.height,
    ].join('|');
    if (key === this.key) {
      if (this.repaint) this.paint(ctx);
      return;
    }
    this.key = key;

    const perf = typeof performance !== 'undefined' && typeof performance.mark === 'function' ? performance : null;
    perf?.mark('regions-start');
    const cols = Math.max(1, Math.round(plot.width / CELL_PX));
    const rows = Math.max(1, Math.round(plot.height / CELL_PX));
    const n = cols * rows;
    if (this.cells.length < n) this.cells = new Uint8Array(n);
    const cells = computeRegions(v.space, v.k, v.metric, v.weighting, { cols, rows, x0, x1, y0, y1 }, this.cells);

    if (!this.img || this.img.width !== cols || this.img.height !== rows) {
      this.img = ctx.createImageData(cols, rows);
      this.off.width = cols;
      this.off.height = rows;
      this.offCtx = this.off.getContext('2d');
    }
    const d = this.img.data;
    for (let i = 0, o = 0; i < n; i++, o += 4) {
      const c = COLS[cells[i]];
      d[o] = c[0];
      d[o + 1] = c[1];
      d[o + 2] = c[2];
    }
    this.n = n;
    this.plot = { ...plot };
    this.paint(ctx);
    if (perf) {
      perf.measure('regions', 'regions-start');
      perf.clearMarks('regions-start');
    }
  }

  /** Write the current alpha into the cached ImageData (colours already set) and draw it. */
  private paint(ctx: CanvasRenderingContext2D): void {
    this.repaint = false;
    const img = this.img;
    const offCtx = this.offCtx;
    const plot = this.plot;
    if (!img || !offCtx || !plot) return;
    const d = img.data;
    const a = this.alpha;
    for (let o = 3, end = this.n * 4; o < end; o += 4) d[o] = a;
    offCtx.putImageData(img, 0, 0);
    this.clear(ctx);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.off, 0, 0, img.width, img.height, plot.left, plot.top, plot.width, plot.height);
  }

  private clear(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
