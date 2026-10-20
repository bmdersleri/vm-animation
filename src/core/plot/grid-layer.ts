import type { Rect } from './viewport';

export interface GridSize { cols: number; rows: number }

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Tinted cell grid on a <canvas> under the SVG. The grid is sized at ~one cell
 * per `cellPx` CSS px of the plot rect; `fill` writes one colour index per cell
 * into a reused Uint8Array (row-major, row 0 = top of the plot). The cells go
 * into a reused grid-resolution ImageData (straight alpha) and are drawn scaled
 * onto the plot rect without smoothing. `fill` runs only when the key, the plot
 * rect or the canvas size change. setAlpha only repaints the cached grid on the
 * next update (no refill). A null 2D context (jsdom) makes this a no-op.
 */
export class GridLayer {
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly off: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D | null = null;
  private readonly colors: [number, number, number][];
  private readonly cellPx: number;
  private readonly measure: string;
  private cells = new Uint8Array(0);
  private img: ImageData | null = null;
  private key = '';
  private dpr = 1;
  private alpha: number;
  private n = 0; // cells in the cached grid
  private plot: Rect | null = null;
  private repaint = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    colors: readonly string[],
    alpha: number,
    opts: { cellPx?: number; measure?: string } = {},
  ) {
    this.ctx = canvas.getContext('2d');
    this.off = canvas.ownerDocument.createElement('canvas');
    this.colors = colors.map(rgb);
    this.alpha = Math.round(alpha * 255);
    this.cellPx = opts.cellPx ?? 6;
    this.measure = opts.measure ?? 'regions';
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

  /** key null clears. Same key and same plot/canvas size: fill is not called again. */
  update(key: string | null, plot: Rect, fill: (g: GridSize, out: Uint8Array) => void): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (key === null) {
      if (this.key !== 'off') this.clear(ctx);
      this.key = 'off';
      return;
    }
    const full = [key, plot.left, plot.top, plot.width, plot.height, this.canvas.width, this.canvas.height].join('|');
    if (full === this.key) {
      if (this.repaint) this.paint(ctx);
      return;
    }
    this.key = full;

    const perf = typeof performance !== 'undefined' && typeof performance.mark === 'function' ? performance : null;
    const start = `${this.measure}-start`;
    perf?.mark(start);
    const cols = Math.max(1, Math.round(plot.width / this.cellPx));
    const rows = Math.max(1, Math.round(plot.height / this.cellPx));
    const n = cols * rows;
    if (this.cells.length < n) this.cells = new Uint8Array(n);
    fill({ cols, rows }, this.cells);

    if (!this.img || this.img.width !== cols || this.img.height !== rows) {
      this.img = ctx.createImageData(cols, rows);
      this.off.width = cols;
      this.off.height = rows;
      this.offCtx = this.off.getContext('2d');
    }
    const d = this.img.data;
    const cells = this.cells;
    for (let i = 0, o = 0; i < n; i++, o += 4) {
      const c = this.colors[cells[i]];
      d[o] = c[0];
      d[o + 1] = c[1];
      d[o + 2] = c[2];
    }
    this.n = n;
    this.plot = { ...plot };
    this.paint(ctx);
    if (perf) {
      perf.measure(this.measure, start);
      perf.clearMarks(start);
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
