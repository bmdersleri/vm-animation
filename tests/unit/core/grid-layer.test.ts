// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GridLayer } from '../../../src/core/plot/grid-layer';

const PLOT = { left: 10, top: 5, width: 120, height: 60 };

function fakeCtx() {
  return {
    createImageData: vi.fn((w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) })),
    putImageData: vi.fn(),
    drawImage: vi.fn(),
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    imageSmoothingEnabled: true,
  };
}

function setup(ctx: ReturnType<typeof fakeCtx> | null, opts?: { cellPx?: number }) {
  // both the visible canvas and the layer's offscreen canvas get the fake context
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ctx) as unknown as HTMLCanvasElement['getContext']);
  const canvas = document.createElement('canvas');
  const layer = new GridLayer(canvas, ['#ff0000', '#00ff00'], 0.5, opts);
  layer.resize(200, 100);
  return layer;
}

describe('GridLayer', () => {
  afterEach(() => vi.restoreAllMocks());

  it('fill runs once per key', () => {
    const layer = setup(fakeCtx());
    const fill = vi.fn();
    layer.update('a', PLOT, fill);
    layer.update('a', PLOT, fill);
    expect(fill).toHaveBeenCalledTimes(1);
    layer.update('b', PLOT, fill);
    expect(fill).toHaveBeenCalledTimes(2);
  });

  it('grid size follows plot / cellPx', () => {
    const layer = setup(fakeCtx(), { cellPx: 6 });
    const fill = vi.fn();
    layer.update('a', PLOT, fill);
    expect(fill.mock.calls[0][0]).toEqual({ cols: 20, rows: 10 });
  });

  it('null key clears and a later key repaints', () => {
    const ctx = fakeCtx();
    const layer = setup(ctx);
    const fill = vi.fn((_g: unknown, out: Uint8Array) => out.fill(1));
    layer.update('a', PLOT, fill);
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    const clears = ctx.clearRect.mock.calls.length;
    layer.update(null, PLOT, fill);
    expect(ctx.clearRect.mock.calls.length).toBe(clears + 1);
    layer.update('a', PLOT, fill);
    expect(ctx.drawImage).toHaveBeenCalledTimes(2);
  });

  it('null 2D context is a no-op', () => {
    const layer = setup(null);
    const fill = vi.fn();
    expect(() => {
      layer.update('a', PLOT, fill);
      layer.update(null, PLOT, fill);
    }).not.toThrow();
    expect(fill).not.toHaveBeenCalled();
  });
});
