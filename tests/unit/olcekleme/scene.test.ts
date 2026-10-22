// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { olceklemeScenario, type OlcParams } from '../../../src/concepts/olcekleme/scenario';
import { mountOlcScene } from '../../../src/concepts/olcekleme/scene';
import { MOVE_MS, ScatterLayer } from '../../../src/concepts/olcekleme/scene-scatter';
import { ScalersLayer } from '../../../src/concepts/olcekleme/scene-scalers';
import { SplitLayer } from '../../../src/concepts/olcekleme/scene-split';
import { deriveOlcView } from '../../../src/concepts/olcekleme/view';
import { CUSTOMERS } from '../../../src/concepts/olcekleme/data';
import type { Mode } from '../../../src/core/mode';

// jsdom has no DOMMatrix, which d3-transition needs to tween CSS transforms
class FakeMatrix {
  a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
  constructor(s = '') {
    const t = /translate\(\s*(-?[\d.]+)(?:px)?\s*,\s*(-?[\d.]+)/.exec(s);
    const m = /matrix\(([^)]+)\)/.exec(s);
    if (t) { this.e = Number(t[1]); this.f = Number(t[2]); }
    else if (m) [this.a, this.b, this.c, this.d, this.e, this.f] = m[1].split(',').map(Number);
  }
  get isIdentity(): boolean { return this.e === 0 && this.f === 0 && this.a === 1 && this.d === 1; }
}
(globalThis as { DOMMatrix?: unknown }).DOMMatrix ??= FakeMatrix;

const D = olceklemeScenario.defaults;
const view = (i: number, over: Partial<OlcParams> = {}) =>
  deriveOlcView(i, { ...D, ...olceklemeScenario.steps[i].params, ...over });
let cleanup: (() => void)[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const f of cleanup) f();
  cleanup = [];
  document.body.replaceChildren();
});

function setup(durationScale = 0, size: [number, number] = [1280, 540], mode: Mode = 'ders') {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(olceklemeScenario);
  const scene = mountOlcScene(el, player, mode, { durationScale });
  scene.resize(...size);
  cleanup.push(() => { scene.destroy(); player.destroy(); });
  return { el, player, scene };
}
const all = (el: Element, sel: string): SVGElement[] => [...el.querySelectorAll<SVGElement>(sel)];
const one = (el: Element, sel: string): SVGElement => {
  const e = el.querySelector<SVGElement>(sel);
  if (!e) throw new Error(`missing ${sel}`);
  return e;
};
const num = (e: Element, a: string): number => Number(e.getAttribute(a));
const text = (e: Element | null): string => (e?.textContent ?? '').trim();
const frame = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const visible = (e: Element | null): boolean => !!e && (e as HTMLElement).style.display !== 'none';
const hidden = (e: Element | null): boolean => !e || e.getAttribute('opacity') === '0';
function tickX(root: Element, t: string): number {
  const g = all(root, 'g.tick').find((k) => text(k.querySelector('text')) === t);
  if (!g) throw new Error(`no tick ${t}`);
  return Number(/translate\(([-\d.]+)/.exec(g.getAttribute('transform') ?? '')![1]);
}
/** px of a data value between the two neighbouring ticks of the split axis. */
const splitX = (host: Element, v: number): number => {
  const root = one(host, 'svg.split-plot');
  const lo = Math.floor(v / 10) * 10;
  const a = tickX(root, String(lo));
  const b = tickX(root, String(lo + 10));
  return a + ((v - lo) / 10) * (b - a);
};
const pointer = (host: Element, type: string, x = 100, y = 100): void => {
  host.querySelector('rect.hit')!.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));
};

describe('olcekleme scene', () => {
  it('strip text equals view.strip at every step', () => {
    const { el, player } = setup();
    for (let i = 0; i < olceklemeScenario.steps.length; i++) {
      player.goto(i);
      const v = deriveOlcView(i, player.state.params);
      const strip = one(el, 'p.formula');
      expect(strip.textContent!.replace(/\s+/g, ' ').trim()).toBe(v.strip.replace(/\s+/g, ' ').trim());
    }
  });

  it('only the layer of view.kind is shown', () => {
    const { el, player } = setup();
    const layers: [string, string][] = [['scatter', 'svg.scale-plot'], ['scalers', 'svg.scalers-plot'], ['split', 'svg.split-plot']];
    for (let i = 0; i < olceklemeScenario.steps.length; i++) {
      player.goto(i);
      const kind = deriveOlcView(i, player.state.params).kind;
      expect(one(el, '.olc-scene').dataset.kind).toBe(kind);
      for (const [k, sel] of layers) expect(visible(one(el, sel))).toBe(k === kind);
    }
  });

  it('render is measured', () => {
    const { player } = setup();
    performance.clearMeasures('olc-render');
    player.goto(3);
    expect(performance.getEntriesByName('olc-render', 'measure').length).toBeGreaterThan(0);
  });

  it('step 8: three number lines on one shared axis', () => {
    const { el, player } = setup();
    player.goto(7);
    const lines = all(el, 'g.number-line[data-scaler]');
    expect(lines.map((l) => l.getAttribute('data-scaler'))).toEqual(['standard', 'minmax', 'robust']);
    expect(all(el, 'text.line-name').map((t) => t.textContent)).toEqual(['StandardScaler', 'MinMaxScaler', 'RobustScaler']);
    for (const l of lines) {
      expect(all(l, 'circle.pt')).toHaveLength(6);
      expect(all(l, 'text.pt-label')).toHaveLength(6);
    }
    // shared axis: tick "0" sits at the same x on all three lines
    const zeros = lines.map((l) => tickX(l, '0'));
    expect(zeros[1]).toBe(zeros[0]);
    expect(zeros[2]).toBe(zeros[0]);
    const axis = lines.map((l) => [num(one(l, 'line.nl-axis'), 'x1'), num(one(l, 'line.nl-axis'), 'x2')]);
    expect(axis[1]).toEqual(axis[0]);
    expect(axis[2]).toEqual(axis[0]);
  });

  it('step 8: MinMax squeezes the crowd to the left of 1, Robust keeps it open', () => {
    const { el, player } = setup();
    player.goto(7);
    const cx = (s: string): number[] => all(one(el, `g.number-line[data-scaler=${s}]`), 'circle.pt').map((c) => num(c, 'cx'));
    const m5 = CUSTOMERS.findIndex((c) => c.id === 'M5');
    const rest = (xs: number[]): number[] => xs.filter((_, i) => i !== m5);
    const spread = (xs: number[]): number => Math.max(...xs) - Math.min(...xs);
    const mm = cx('minmax');
    const l = one(el, 'g.number-line[data-scaler=minmax]');
    expect(mm[m5]).toBeCloseTo(tickX(l, '1'), 0);
    expect(Math.max(...rest(mm))).toBeLessThanOrEqual(tickX(l, '0') + 0.25 * (tickX(l, '1') - tickX(l, '0')) + 0.5);
    expect(spread(rest(cx('robust')))).toBeGreaterThan(spread(rest(cx('standard'))));
    expect(spread(rest(cx('standard')))).toBeGreaterThan(spread(rest(mm)));
  });

  // sizes the scene really gives the scalers svg at 1280x720 (measured in Chrome)
  it.each([['ders', 1280, 456], ['lab', 744, 518]] as [Mode, number, number][])(
    'step 8: every text in the scalers svg is inside it and overlaps no other text (%s)',
    (mode, w, h) => {
      const host = document.createElement('div');
      document.body.append(host);
      const layer = new ScalersLayer(host);
      cleanup.push(() => layer.destroy());
      layer.resize(w, h, mode);
      layer.update(view(7), 0, mode);
      // jsdom fallback font sizes (theme.css at 1280 px); widths use the layer's own estimate
      const fs = mode === 'ders' ? { tick: 18, axis: 19, name: 22 } : { tick: 13, axis: 14, name: 16 };
      interface B { what: string; l: number; r: number; t: number; b: number }
      const boxes: B[] = [];
      const add = (what: string, x: number, y: number, wd: number, size: number, anchor: 'start' | 'middle'): void => {
        const l = anchor === 'start' ? x : x - wd / 2;
        boxes.push({ what, l, r: l + wd, t: y - size * 0.8, b: y + size * 0.2 });
      };
      const svg = one(host, 'svg.scalers-plot');
      for (const t of all(svg, 'text.pt-label')) add(`pt ${text(t)}`, num(t, 'x'), num(t, 'y'), num(t, 'data-w'), fs.tick, 'middle');
      for (const t of all(svg, 'text.line-name')) add(text(t), num(t, 'x'), num(t, 'y'), text(t).length * fs.name * 0.62, fs.name, 'start');
      for (const t of all(svg, 'g.tick text')) {
        if ((t as unknown as HTMLElement).style.display === 'none') continue;
        const g = t.parentElement!;
        const x = Number(/translate\(([-\d.]+)/.exec(g.getAttribute('transform') ?? '')![1]);
        add(`tick ${text(t)}`, x, num(t, 'y'), text(t).length * fs.tick * 0.62, fs.tick, 'middle');
      }
      for (const t of all(svg, 'text.axis-title')) {
        if (text(t) !== '') add(text(t), num(t, 'x'), num(t, 'y'), text(t).length * fs.axis * 0.62, fs.axis, 'middle');
      }
      expect(boxes.length).toBeGreaterThan(18 + 3 + 5);
      const eps = 0.05;
      for (const bx of boxes) {
        expect(bx.l, bx.what).toBeGreaterThanOrEqual(-eps);
        expect(bx.t, bx.what).toBeGreaterThanOrEqual(-eps);
        expect(bx.r, bx.what).toBeLessThanOrEqual(w + eps);
        expect(bx.b, bx.what).toBeLessThanOrEqual(h + eps);
      }
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]; const c = boxes[j];
          const clash = a.l < c.r - eps && c.l < a.r - eps && a.t < c.b - eps && c.t < a.b - eps;
          expect(clash, `${a.what} vs ${c.what}`).toBe(false);
        }
      }
    },
  );

  it('step 10: 7 filled train and 3 hollow test points on two rows', () => {
    const { el, player } = setup();
    player.goto(9);
    expect(all(el, 'circle.pt.train')).toHaveLength(7);
    expect(all(el, 'circle.pt.test')).toHaveLength(3);
    expect(all(el, 'text.row-label').map((t) => t.textContent)).toEqual(['eğitim', 'test']);
    const trainY = num(all(el, 'circle.pt.train')[0], 'cy');
    expect(all(el, 'circle.pt.train').every((c) => num(c, 'cy') === trainY)).toBe(true);
    expect(all(el, 'circle.pt.test').every((c) => num(c, 'cy') > trainY)).toBe(true);
    expect(all(el, 'circle.pt.test.faded')).toHaveLength(0);
    expect(all(el, 'text.z-label')).toHaveLength(0);
    expect(hidden(el.querySelector('svg.split-plot line.mu'))).toBe(true);
    expect(visible(one(el, 'div.flow'))).toBe(false);
  });

  it('step 11: test faded, mu at 58,63, three z labels', () => {
    const { el, player } = setup();
    player.goto(10);
    expect(all(el, 'circle.pt.test.faded')).toHaveLength(3);
    const mu = one(el, 'svg.split-plot line.mu[data-fit=egitim]');
    expect(mu.getAttribute('opacity')).toBe('1');
    expect(num(mu, 'x1')).toBeCloseTo(splitX(el, 58.63), 0);
    expect(all(el, 'svg.split-plot rect.sigma')).toHaveLength(1);
    expect(num(one(el, 'svg.split-plot rect.sigma'), 'width')).toBeGreaterThan(0);
    expect(all(el, 'text.z-label').map((t) => t.textContent)).toEqual(['−0,71', '−1,33', '−1,04']);
    expect(text(one(el, 'svg.split-plot text.mu-label'))).toContain('58,63');
    expect(all(el, 'svg.split-plot line.mu.ghost').every(hidden)).toBe(true);
  });

  it('step 12: two mu lines side by side, z labels change', () => {
    const { el, player } = setup();
    player.goto(11);
    const live = one(el, 'svg.split-plot line.mu[data-fit=tum]:not(.ghost)');
    const ghost = one(el, 'svg.split-plot line.mu.ghost[data-fit=egitim]');
    expect(ghost.getAttribute('opacity')).toBe('1');
    expect(num(live, 'x1')).toBeCloseTo(splitX(el, 52.69), 0);
    expect(num(ghost, 'x1')).toBeCloseTo(splitX(el, 58.63), 0);
    expect(num(ghost, 'x1')).toBeGreaterThan(num(live, 'x1'));
    expect(all(el, 'text.z-label').map((t) => t.textContent)).toEqual(['−0,41', '−1,05', '−0,76']);
    expect(all(el, 'circle.pt.test.faded')).toHaveLength(0);
    // each z label sits under its test point
    const order = view(11).split!.test;
    all(el, 'text.z-label').forEach((z, i) => {
      const pt = one(el, `circle.pt.test[data-index="${order[i]}"]`);
      expect(num(z, 'x')).toBeCloseTo(num(pt, 'cx'), 0);
      expect(num(z, 'y')).toBeGreaterThan(num(pt, 'cy'));
    });
  });

  it('step 13: three flow boxes and the rule sentence in the strip', () => {
    const { el, player } = setup();
    player.goto(12);
    const flow = el.querySelector<HTMLElement>('div.flow')!;
    expect(flow.style.display).not.toBe('none');
    expect([...flow.querySelectorAll('.flow-box')].map((b) => b.textContent))
      .toEqual(['train_test_split', 'fit (yalnızca eğitim)', 'transform (eğitim ve test)']);
    expect(flow.querySelectorAll('.flow-arrow')).toHaveLength(2);
    expect(one(el, 'p.formula').textContent).toContain('önce ayır, sonra öğren, sonra uygula');
  });

  it('the split fit follows the T parameter', () => {
    const { el, player } = setup();
    player.goto(11);
    player.setParam('fit', 'egitim');
    expect(all(el, 'svg.split-plot line.mu[data-fit=egitim]').length).toBeGreaterThan(0);
    expect(all(el, 'text.z-label').map((t) => t.textContent)).toEqual(['−0,71', '−1,33', '−1,04']);
  });

  it('passes the scatter layer MOVE_MS x durationScale once', async () => {
    const spy = vi.spyOn(ScatterLayer.prototype, 'update');
    const spyS = vi.spyOn(ScalersLayer.prototype, 'update');
    const spyP = vi.spyOn(SplitLayer.prototype, 'update');
    const { player } = setup(0.5);
    await frame();
    spy.mockClear();
    spyS.mockClear();
    spyP.mockClear();
    player.goto(1);
    await frame(80);
    const ms = spy.mock.calls.map((c) => c[1]);
    expect(ms.length).toBeGreaterThan(0);
    expect(ms.at(-1)).toBe(MOVE_MS * 0.5);
    expect(spyS.mock.calls.at(-1)![1]).toBe(MOVE_MS * 0.5);
    expect(spyP.mock.calls.at(-1)![1]).toBe(MOVE_MS * 0.5);
    spy.mockClear();
    const z = setup(0);
    z.player.goto(1);
    expect(spy.mock.calls.at(-1)![1]).toBe(0);
  });

  it('a query drag (param change of the query only) renders instantly', async () => {
    // the layer's own transitions are not under test (jsdom cannot tween SVG transforms)
    const spy = vi.spyOn(ScatterLayer.prototype, 'update').mockImplementation(() => {});
    const { player } = setup(1);
    player.goto(1);
    await frame(80);
    spy.mockClear();
    player.setParam('query', { t: 30, f: 100 });
    await frame(80);
    expect(spy.mock.calls.at(-1)![1]).toBe(0);
    spy.mockClear();
    player.setParam('unit', 'yil');
    await frame(80);
    expect(spy.mock.calls.at(-1)![1]).toBe(MOVE_MS);
  });

  it('onPointer ignores plain hover and reports one down-move-up drag', () => {
    const { el, scene } = setup();
    const got: string[] = [];
    scene.onPointer((_q, k) => got.push(k));
    pointer(el, 'pointermove');
    expect(got).toEqual([]);
    pointer(el, 'pointerdown');
    pointer(el, 'pointermove');
    pointer(el, 'pointerup');
    pointer(el, 'pointermove');
    pointer(el, 'pointerup');
    expect(got).toEqual(['down', 'move', 'up']);
  });

  it('rapid goto(2), goto(5), goto(0) ends in the index-0 state, not mid-transition', async () => {
    const { el, player } = setup(1);
    await frame(30);
    const ref = setup(0);
    const cx0 = all(ref.el, 'circle.pt.cust').map((c) => num(c, 'cx'));
    const v0 = view(0);
    expect(cx0).toHaveLength(6);
    player.goto(2);
    player.goto(5);
    player.goto(0);
    await frame(40);
    const cx = all(el, 'circle.pt.cust').map((c) => num(c, 'cx'));
    expect(cx).toEqual(cx0);
    expect(v0.scatter!.unit).toBe('ay');
    expect(all(el, 'line.mu').every(hidden)).toBe(true);
    expect(hidden(one(el, 'ellipse.iso'))).toBe(true);
    expect(one(el, 'p.formula').textContent).toContain('hizmet süresi 1–60 ay');
  });
});

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
/** Every attribute of every mark, as strings (ticks excluded: they have their own transitions). */
const snapshot = (host: HTMLElement): string[] =>
  all(host, 'circle, line, rect, text')
    .filter((e) => !e.closest('g.tick') && !e.classList.contains('probe'))
    .map((e) => `${e.tagName.toLowerCase()}:${[...e.attributes].map((a) => `${a.name}=${a.value}`).sort().join(';')}:${e.textContent}`);

type V = ReturnType<typeof view>;
interface Snappable { resize(w: number, h: number, m: Mode): void; update(v: V, ms: number, m: Mode): void; interrupt(): void; destroy(): void }
function layerOf(kind: 'scalers' | 'split', w = 1280, h = 456): { host: HTMLElement; layer: Snappable } {
  const host = document.createElement('div');
  document.body.append(host);
  const layer: Snappable = kind === 'scalers' ? new ScalersLayer(host) : new SplitLayer(host);
  cleanup.push(() => layer.destroy());
  layer.resize(w, h, 'ders');
  return { host, layer };
}
/** The scalers view with every line reversed, so that the points really move. */
const movedScalers = (): V => {
  const v = view(7);
  return { ...v, scalers: { ...v.scalers!, lines: v.scalers!.lines.map((l) => ({ ...l, values: [...l.values].reverse(), labels: [...l.labels].reverse() })) } };
};
const CASES: ['scalers' | 'split', () => V, () => V][] = [
  ['scalers', () => view(7), movedScalers],
  ['split', () => view(9), () => view(11)],
];

describe.each(CASES)('olcekleme %s layer: no transition survives interrupt() or resize()', (kind, from, to) => {
  it('interrupt() mid-flight snaps to the final state and nothing moves afterwards', async () => {
    const ref = layerOf(kind);
    ref.layer.update(from(), 0, 'ders');
    ref.layer.update(to(), 0, 'ders');
    const want = snapshot(ref.host);
    const { host, layer } = layerOf(kind);
    layer.update(from(), 0, 'ders');
    layer.update(to(), 900, 'ders');
    await sleep(300);
    layer.interrupt();
    const snapped = snapshot(host);
    expect(snapped).toEqual(want);
    await sleep(300);
    expect(snapshot(host)).toEqual(snapped);
    await sleep(650);
    expect(snapshot(host)).toEqual(snapped);
  });

  it('resize() mid-flight snaps to the final layout and nothing moves afterwards', async () => {
    const ref = layerOf(kind, 900, 450);
    ref.layer.update(from(), 0, 'ders');
    ref.layer.update(to(), 0, 'ders');
    const want = snapshot(ref.host);
    const { host, layer } = layerOf(kind);
    layer.update(from(), 0, 'ders');
    layer.update(to(), 900, 'ders');
    await sleep(150);
    layer.resize(900, 450, 'ders');
    const snapped = snapshot(host);
    expect(snapped).toEqual(want);
    await sleep(950);
    expect(snapshot(host)).toEqual(snapped);
  });
});
