// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { GridLayer } from '../../../src/core/plot/grid-layer';
import { fitViewport } from '../../../src/core/plot/viewport';
import { nbScenario, type NbParams } from '../../../src/concepts/naive-bayes/scenario';
import { mountNbScene, type NbSceneHandle } from '../../../src/concepts/naive-bayes/scene';
import { regionFill } from '../../../src/concepts/naive-bayes/scene-gauss';
import { DOMAIN, gauss } from '../../../src/concepts/naive-bayes/data';
import { fitGaussian, proba } from '../../../src/concepts/naive-bayes/gaussian';

let cleanup: (() => void)[] = [];

beforeEach(() => {
  // jsdom has no canvas backend; make the "no 2D context" path explicit and quiet
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  for (const f of cleanup) f();
  cleanup = [];
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function setup(
  mode: 'lab' | 'ders' = 'ders', size: [number, number] = [1280, 541], durationScale = 0,
): { el: HTMLElement; player: StepPlayer<NbParams>; scene: NbSceneHandle } {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(nbScenario);
  const scene = mountNbScene(el, player, mode, { durationScale });
  scene.resize(...size);
  cleanup.push(() => { scene.destroy(); player.destroy(); });
  return { el, player, scene };
}

const all = (el: Element, sel: string): Element[] => [...el.querySelectorAll(sel)];
const num = (e: Element, a: string): number => Number(e.getAttribute(a));
const shown = (e: Element): boolean => !e.closest('[hidden]') && !e.closest('[display="none"]');
const translate = (e: Element): [number, number] => {
  const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(e.getAttribute('transform') ?? '');
  if (!m) throw new Error(`no translate on ${e.outerHTML}`);
  return [Number(m[1]), Number(m[2])];
};
/** The scatter's plot rect, read from the axes frame. */
const frame = (el: Element): { x: number; y: number; w: number; h: number } => {
  const f = el.querySelector('.nb-gauss rect.frame')!;
  return { x: num(f, 'x'), y: num(f, 'y'), w: num(f, 'width'), h: num(f, 'height') };
};
const Ev = (): typeof MouseEvent => (window.PointerEvent ?? MouseEvent) as typeof MouseEvent;

describe('GaussianNB layer', () => {
  it('154 points with class shapes', () => {
    const { el, player } = setup();
    player.goto(10);
    const kaldi = all(el, '.nb-gauss circle.pt.kaldi');
    const ayrildi = all(el, '.nb-gauss path.pt.ayrildi');
    expect(kaldi).toHaveLength(gauss.train.filter((r) => r.y === 0).length);
    expect(ayrildi).toHaveLength(gauss.train.filter((r) => r.y === 1).length);
    expect(kaldi.length + ayrildi.length).toBe(154);
    expect(kaldi.every(shown) && ayrildi.every(shown)).toBe(true);
    // every point sits inside the plot frame
    const f = frame(el);
    for (const p of [...kaldi, ...ayrildi]) {
      const [x, y] = translate(p);
      expect(x).toBeGreaterThanOrEqual(f.x);
      expect(x).toBeLessThanOrEqual(f.x + f.w);
      expect(y).toBeGreaterThanOrEqual(f.y);
      expect(y).toBeLessThanOrEqual(f.y + f.h);
    }
  });

  it('two marginal curves per feature', () => {
    const { el, player } = setup();
    player.goto(10);
    expect(all(el, 'path.marginal.kaldi').filter(shown)).toHaveLength(2);
    expect(all(el, 'path.marginal.ayrildi').filter(shown)).toHaveLength(2);
    // contract length above the plot, complaints to its right
    const f = frame(el);
    const top = all(el, '.marginal-t path.marginal');
    const right = all(el, '.marginal-c path.marginal');
    expect(top).toHaveLength(2);
    expect(right).toHaveLength(2);
    const coords = (p: Element): number[][] => (p.getAttribute('d') ?? '').slice(1).split('L')
      .map((s) => s.split(',').map(Number));
    for (const p of top) expect(coords(p).every(([, y]) => y <= f.y + 0.5)).toBe(true);
    for (const p of right) expect(coords(p).every(([x]) => x >= f.x + f.w - 0.5)).toBe(true);
    // each curve peaks at its class mean: the Kaldı contract curve peaks to the right of the Ayrıldı one
    const peakX = (p: Element): number => coords(p).reduce((a, b) => (b[1] < a[1] ? b : a))[0];
    const [tKaldi, tAyrildi] = ['kaldi', 'ayrildi'].map((k) => peakX(el.querySelector(`.marginal-t path.marginal.${k}`)!));
    const model = fitGaussian(gauss.train.map((r) => [r.t, r.c]), gauss.train.map((r) => r.y));
    expect(tKaldi > tAyrildi).toBe(model.theta[0][0] > model.theta[1][0]);
  });

  it('height marks only at step 11', () => {
    const { el, player } = setup();
    for (let i = 0; i < nbScenario.steps.length; i++) {
      player.goto(i);
      expect(all(el, 'line.height-mark').filter(shown), `step ${i}`).toHaveLength(i === 11 ? 4 : 0);
    }
    // at step 11 the taller mark belongs to the class with the higher density at the query
    player.goto(11);
    const len = (k: string, axis: 'x' | 'y'): number => {
      const l = el.querySelector(`.marginal-${axis === 'y' ? 't' : 'c'} line.height-mark.${k}`)!;
      return Math.abs(num(l, `${axis}2`) - num(l, `${axis}1`));
    };
    const model = fitGaussian(gauss.train.map((r) => [r.t, r.c]), gauss.train.map((r) => r.y));
    const q = gauss.firstTest;
    const dens = (k: 0 | 1, f: 0 | 1, v: number): number =>
      Math.exp(-((v - model.theta[k][f]) ** 2) / (2 * model.var[k][f])) / Math.sqrt(2 * Math.PI * model.var[k][f]);
    expect(len('kaldi', 'y') > len('ayrildi', 'y')).toBe(dens(0, 0, q.t) > dens(1, 0, q.t));
    expect(len('kaldi', 'x') > len('ayrildi', 'x')).toBe(dens(0, 1, q.c) > dens(1, 1, q.c));
  });

  it('regions only at step 12', () => {
    const spy = vi.spyOn(GridLayer.prototype, 'update');
    const { player } = setup();
    const lastKey = (): string | null => spy.mock.calls[spy.mock.calls.length - 1][0];
    for (const i of [10, 11, 12]) {
      player.goto(i);
      expect(spy, `step ${i}`).toHaveBeenCalled();
      if (i === 12) expect(lastKey(), `step ${i}`).not.toBeNull();
      else expect(lastKey(), `step ${i}`).toBeNull();
    }
    // the B shortcut hides them again
    player.setParam('regions', false);
    expect(lastKey()).toBeNull();
    player.setParam('regions', true);
    const key = lastKey();
    // moving the new customer does not change the regions' key (no refill per drag frame)
    player.setParam('query', { t: 40, c: 3 });
    expect(lastKey()).toBe(key);
  });

  it('query follows params.query', () => {
    const { el, player } = setup();
    player.goto(11);
    const q = (): Element => el.querySelector('.nb-gauss g.q')!;
    expect(q().querySelector('rect.query')).not.toBeNull();
    const expectAt = (t: number, c: number): void => {
      const f = frame(el);
      const [x, y] = translate(q());
      expect(x).toBeCloseTo(f.x + ((t - DOMAIN.x[0]) / (DOMAIN.x[1] - DOMAIN.x[0])) * f.w, 0);
      expect(y).toBeCloseTo(f.y + f.h - ((c - DOMAIN.y[0]) / (DOMAIN.y[1] - DOMAIN.y[0])) * f.h, 0);
    };
    expectAt(gauss.firstTest.t, gauss.firstTest.c);
    player.setParam('query', { t: 45.5, c: 3.25 });
    expectAt(45.5, 3.25);
    // the posterior bar follows the query too
    const s = num(el.querySelector('.nb-gauss rect.bar-spam')!, 'width');
    const n = num(el.querySelector('.nb-gauss rect.bar-normal')!, 'width');
    const model = fitGaussian(gauss.train.map((r) => [r.t, r.c]), gauss.train.map((r) => r.y));
    expect(s / (s + n)).toBeCloseTo(proba(model, [45.5, 3.25])[1], 3);
  });

  it('Ders shows the new customer and the bar from step 11 on; Lab already at step 10', () => {
    const ders = setup('ders');
    ders.player.goto(10);
    expect(all(ders.el, '.nb-gauss rect.query')).toHaveLength(0);
    expect(shown(ders.el.querySelector('.nb-gauss rect.bar-spam')!)).toBe(false);
    ders.player.goto(11);
    expect(all(ders.el, '.nb-gauss rect.query')).toHaveLength(1);
    expect(shown(ders.el.querySelector('.nb-gauss rect.bar-spam')!)).toBe(true);
    const lab = setup('lab', [900, 560]);
    lab.player.goto(10);
    expect(all(lab.el, '.nb-gauss rect.query')).toHaveLength(1);
  });

  it('layout keeps the plot, axis titles and bar apart at 1280×541 Ders', () => {
    const { el, player } = setup();
    player.goto(12);
    const f = frame(el);
    expect(f.h).toBeGreaterThanOrEqual(200);
    const xTitle = el.querySelector('.nb-gauss text.axis-title.x')!;
    expect(num(xTitle, 'y')).toBeGreaterThan(f.y + f.h);
    const bar = el.querySelector<HTMLElement>('.nb-gauss .gauss-bar')!;
    expect(parseFloat(bar.style.top)).toBeGreaterThan(num(xTitle, 'y'));
    // the bar block fits its band
    const frameBar = bar.querySelector('rect.bar-frame')!;
    expect(num(frameBar, 'y') + num(frameBar, 'height')).toBeLessThanOrEqual(parseFloat(bar.style.height));
    // the complaint axis has explicit integer ticks
    expect(all(el, '.nb-gauss .axis.y g.tick').map((t) => t.textContent)).toEqual(['0', '1', '2', '3', '4', '5']);
  });

  it('onPointer: Lab drags report clamped continuous values; Ders and other parts report nothing', () => {
    const { el, player, scene } = setup('lab');
    const got: [{ t: number; c: number }, string][] = [];
    scene.onPointer((q, kind) => got.push([q, kind]));
    player.goto(11);
    const svg = el.querySelector('.nb-gauss svg.gauss-plot')!;
    const f = frame(el);
    const at = (t: number, c: number): { clientX: number; clientY: number } => ({
      clientX: f.x + ((t - DOMAIN.x[0]) / (DOMAIN.x[1] - DOMAIN.x[0])) * f.w,
      clientY: f.y + f.h - ((c - DOMAIN.y[0]) / (DOMAIN.y[1] - DOMAIN.y[0])) * f.h,
    });
    const E = Ev();
    svg.dispatchEvent(new E('pointerdown', { ...at(30.25, 2.4), bubbles: true }));
    svg.dispatchEvent(new E('pointermove', { ...at(0.2, 5.4), bubbles: true })); // past both clamps
    svg.dispatchEvent(new E('pointermove', { ...at(59.9, -0.4), bubbles: true }));
    svg.dispatchEvent(new E('pointerup', { ...at(59.9, -0.4), bubbles: true }));
    expect(got.map(([, k]) => k)).toEqual(['down', 'move', 'move', 'up']);
    expect(got[0][0].t).toBeCloseTo(30.25, 1);
    expect(got[0][0].c).toBeCloseTo(2.4, 1);
    expect(got[0][0].c % 1).not.toBe(0); // continuous, not rounded
    expect(got[1][0]).toEqual({ t: 1, c: 5 });
    expect(got[2][0]).toEqual({ t: 59, c: 0 });
    // a press outside the plot starts nothing
    got.length = 0;
    svg.dispatchEvent(new E('pointerdown', { clientX: 1, clientY: 1, bubbles: true }));
    expect(got).toHaveLength(0);
    // Ders: no drag
    scene.setMode('ders');
    svg.dispatchEvent(new E('pointerdown', { ...at(30, 2), bubbles: true }));
    expect(got).toHaveLength(0);
    // other parts: no drag
    scene.setMode('lab');
    player.goto(5);
    svg.dispatchEvent(new E('pointerdown', { ...at(30, 2), bubbles: true }));
    expect(got).toHaveLength(0);
  });

  it('with real transitions, rapid step changes converge to the final state', async () => {
    const { el, player } = setup('ders', [1280, 541], 0.2);
    player.goto(12);
    player.setParam('query', { t: 50, c: 4 });
    await new Promise((r) => setTimeout(r, 30));
    player.goto(11); // the step resets the query to the book's first test customer
    await new Promise((r) => setTimeout(r, 30));
    player.goto(10);
    await new Promise((r) => setTimeout(r, 30));
    player.goto(11);
    await new Promise((r) => setTimeout(r, 400));
    expect(all(el, '.nb-gauss g.q')).toHaveLength(1);
    const f = frame(el);
    const [x] = translate(el.querySelector('.nb-gauss g.q')!);
    expect(x).toBeCloseTo(f.x + (gauss.firstTest.t / 60) * f.w, 0);
    expect(all(el, 'line.height-mark')).toHaveLength(4);
    expect(Number(el.querySelector('.nb-gauss g.points')!.getAttribute('opacity'))).toBe(1);
  });
});

describe('regionFill', () => {
  // plot rect 600×300 px at (50, 20); 60 × 30 cells of 1 month × 0,2 complaints
  const sc = fitViewport({ x: [DOMAIN.x[0], DOMAIN.x[1]], y: [DOMAIN.y[0], DOMAIN.y[1]] },
    { left: 50, top: 20, width: 600, height: 300 }, false);
  const g = { cols: 60, rows: 30 };
  const model = fitGaussian(gauss.train.map((r) => [r.t, r.c]), gauss.train.map((r) => r.y));
  const out = new Uint8Array(g.cols * g.rows);
  regionFill(model, sc)(g, out);
  const centre = (r: number, c: number): [number, number] => [
    DOMAIN.x[0] + ((c + 0.5) / g.cols) * (DOMAIN.x[1] - DOMAIN.x[0]),
    DOMAIN.y[1] - ((r + 0.5) / g.rows) * (DOMAIN.y[1] - DOMAIN.y[0]), // row 0 = top
  ];

  it('every cell is argmax(proba) at its centre (row 0 = top, x left to right)', () => {
    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.cols; c++) {
        const p = proba(model, centre(r, c));
        expect(out[r * g.cols + c], `row ${r} col ${c}`).toBe(p[1] > p[0] ? 1 : 0);
      }
    }
  });

  it('class mapping: short contracts with many complaints are Ayrıldı (1), long and calm Kaldı (0)', () => {
    const cell = (t: number, c: number): number => {
      const col = Math.floor(((t - DOMAIN.x[0]) / (DOMAIN.x[1] - DOMAIN.x[0])) * g.cols);
      const row = Math.floor(((DOMAIN.y[1] - c) / (DOMAIN.y[1] - DOMAIN.y[0])) * g.rows);
      return out[row * g.cols + col];
    };
    expect(cell(5, 4.5)).toBe(1);
    expect(cell(50, 0.2)).toBe(0);
    expect(new Set(out)).toEqual(new Set([0, 1]));
  });
});
