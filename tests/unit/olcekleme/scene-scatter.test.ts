// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { ScatterLayer, type QueryPointer } from '../../../src/concepts/olcekleme/scene-scatter';
import { deriveOlcView, type OlcView } from '../../../src/concepts/olcekleme/view';
import { olceklemeScenario, type OlcParams } from '../../../src/concepts/olcekleme/scenario';
import { CUSTOMERS } from '../../../src/concepts/olcekleme/data';
import { Z_FIT } from '../../../src/concepts/olcekleme/space';
import type { Mode } from '../../../src/core/mode';

// jsdom has no SVGGraphicsElement.transform.baseVal, which d3-interpolate needs to tween the axes' transform attribute
if (!('transform' in SVGGElement.prototype)) {
  Object.defineProperty(SVGGElement.prototype, 'transform', {
    configurable: true,
    get(this: SVGGElement) {
      const attr = this.getAttribute('transform') ?? '';
      return {
        baseVal: {
          consolidate: () => {
            const t = /translate\(\s*(-?[\d.e+-]+)\s*(?:,|\s)\s*(-?[\d.e+-]+)/.exec(attr);
            const r = /rotate\(\s*(-?[\d.e+-]+)/.exec(attr);
            const rad = r ? (Number(r[1]) * Math.PI) / 180 : 0;
            return { matrix: { a: Math.cos(rad), b: Math.sin(rad), c: -Math.sin(rad), d: Math.cos(rad), e: t ? Number(t[1]) : 0, f: t ? Number(t[2]) : 0 } };
          },
        },
      };
    },
  });
}

const view = (i: number, over: Partial<OlcParams> = {}): OlcView =>
  deriveOlcView(i, { ...olceklemeScenario.defaults, ...olceklemeScenario.steps[i].params, ...over });
let layers: ScatterLayer[] = [];

function setup(mode: Mode = 'ders', w = 1200, h = 520): { host: HTMLElement; layer: ScatterLayer } {
  const host = document.createElement('div');
  document.body.append(host);
  const layer = new ScatterLayer(host);
  layers.push(layer);
  layer.resize(w, h, mode);
  return { host, layer };
}
const all = (el: Element, sel: string): SVGElement[] => [...el.querySelectorAll<SVGElement>(sel)];
const num = (el: Element, a: string): number => Number(el.getAttribute(a));
const cxs = (host: HTMLElement): number[] => all(host, 'circle.pt.cust').map((c) => num(c, 'cx'));
const spread = (xs: number[]): number => Math.max(...xs) - Math.min(...xs);
const plotOf = (host: HTMLElement) => {
  const h = host.querySelector('rect.hit')!;
  return { left: num(h, 'x'), top: num(h, 'y'), width: num(h, 'width'), height: num(h, 'height') };
};
const hidden = (el: Element | null): boolean => !el || el.getAttribute('opacity') === '0';
const shown = (el: Element | null): boolean => !!el && el.getAttribute('opacity') === '1';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
/** Every animated attribute of every mark, as strings. */
const snapshot = (host: HTMLElement): string[] =>
  all(host, 'circle, line, ellipse, rect.sigma, path.query, text.cust-label, text.query-label, text.mu-label')
    .filter((e) => !e.closest('.axes'))
    .map((e) => `${e.tagName.toLowerCase()}:${[...e.attributes].map((a) => `${a.name}=${a.value}`).sort().join(';')}`);

function pointer(host: HTMLElement, type: string, x: number, y: number): void {
  host.querySelector('rect.hit')!.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));
}

afterEach(() => {
  for (const l of layers) l.destroy();
  layers = [];
  document.body.replaceChildren();
});

describe('olcekleme ScatterLayer', () => {
  it('step 1: six customers with labels, no query, no lines, no iso, no mu', () => {
    const { host, layer } = setup('ders');
    layer.update(view(0), 0, 'ders');
    expect(all(host, 'svg.scale-plot g.cust circle.pt.cust')).toHaveLength(6);
    expect(all(host, 'g.cust text.cust-label').map((t) => t.textContent)).toEqual(CUSTOMERS.map((c) => c.id));
    expect(hidden(host.querySelector('path.query'))).toBe(true);
    expect(host.querySelector('text.query-label')).toBeNull();
    expect(all(host, 'line.dist')).toHaveLength(6);
    expect(all(host, 'line.dist').every(hidden)).toBe(true);
    expect(hidden(host.querySelector('ellipse.iso'))).toBe(true);
    expect(all(host, 'line.mu').every(hidden)).toBe(true);
  });

  it('Lab shows the query already at step 1; Ders from step 2', () => {
    const lab = setup('lab');
    lab.layer.update(view(0), 0, 'lab');
    expect(shown(lab.host.querySelector('g.q path.query'))).toBe(true);
    expect(lab.host.querySelector('g.q text.query-label')!.textContent).toBe('Yeni (12 ay; 55 TL)');
    expect(all(lab.host, 'line.dist').every(hidden)).toBe(true);
    const d = setup('ders');
    d.layer.update(view(1), 0, 'ders');
    expect(shown(d.host.querySelector('path.query'))).toBe(true);
    expect(all(d.host, 'line.dist').every(shown)).toBe(true);
    expect(all(d.host, 'line.dist.nearest')).toHaveLength(1);
    expect(d.host.querySelector('line.dist.nearest')!.getAttribute('data-id')).toBe('M3');
  });

  it('step 4: mu lines, sigma bands and the mu labels from the view', () => {
    const { host, layer } = setup('ders');
    layer.update(view(3), 0, 'ders');
    expect(all(host, 'line.mu')).toHaveLength(2);
    expect(all(host, 'line.mu').every(shown)).toBe(true);
    expect(all(host, 'rect.sigma').every(shown)).toBe(true);
    expect(all(host, 'text.mu-label').map((t) => t.textContent)).toEqual(['μ = 25, σ = 22,73', 'μ = 72,95, σ = 58,29']);
    const p = plotOf(host);
    expect(num(host.querySelector('rect.sigma.x')!, 'width')).toBeCloseTo((p.width * 2 * Z_FIT.t.scale) / 64, 0);
  });

  it('step 5: shifted mu lines sit at the origin; the label keeps the raw mean', () => {
    const { host, layer } = setup('ders');
    layer.update(view(4), 0, 'ders');
    const p = plotOf(host);
    // box x runs from -25 to 39 after centring, so 0 sits 25/64 of the way in
    expect(num(host.querySelector('line.mu.x')!, 'x1')).toBeCloseTo(p.left + (p.width * Z_FIT.t.center) / 64, 0);
    expect(all(host, 'text.mu-label')[0].textContent).toBe('μ = 25, σ = 22,73');
  });

  it('unit sweep squeezes years and opens days', () => {
    const { host, layer } = setup('ders');
    const cys = (): number[] => all(host, 'circle.pt.cust').map((c) => num(c, 'cy'));
    const sp = (unit: 'yil' | 'ay' | 'gun'): [number, number] => {
      layer.update(view(2, { unit }), 0, 'ders');
      return [spread(cxs(host)), spread(cys())];
    };
    const [yil, ay, gun] = [sp('yil'), sp('ay'), sp('gun')];
    // years squeeze x; the month box fills the plot, so days keep the x spread and open the y axis instead
    expect(yil[0]).toBeLessThan(ay[0] / 5);
    expect(Math.abs(gun[0] - ay[0])).toBeLessThan(0.2);
    expect(gun[1]).toBeLessThan(ay[1] / 5);
    expect(Math.abs(yil[1] - ay[1])).toBeLessThan(0.2);
  });

  it('step 2: iso curve is an ellipse with the month ratio', () => {
    const { host, layer } = setup('ders');
    layer.update(view(1), 0, 'ders');
    const p = plotOf(host);
    const r0 = (p.width / 64) / (p.height / 190);
    const e = host.querySelector('ellipse.iso')!;
    const rx = num(e, 'rx');
    const ry = num(e, 'ry');
    expect(Math.abs(rx / ry - r0) / r0).toBeLessThan(0.01);
    expect(Math.abs(rx - ry)).toBeGreaterThan(10);
  });

  it('step 6: iso curve is a circle', () => {
    const { host, layer } = setup('ders');
    layer.update(view(5), 0, 'ders');
    const e = host.querySelector('ellipse.iso')!;
    expect(shown(e)).toBe(true);
    expect(Math.abs(num(e, 'rx') - num(e, 'ry'))).toBeLessThanOrEqual(0.5);
  });

  it('pointer in year and z space returns raw values clamped to the data box', () => {
    const { host, layer } = setup('ders');
    const got: [Parameters<QueryPointer>[0], Parameters<QueryPointer>[1]][] = [];
    layer.onPointer((q, k) => got.push([q, k]));
    // year space: the domain is centred; one year spans the px one month spans in the month view
    layer.update(view(2, { unit: 'yil' }), 0, 'ders');
    let p = plotOf(host);
    pointer(host, 'pointermove', p.left + p.width / 2 + 0.01 * p.width, p.top + p.height / 2);
    expect(got.at(-1)![1]).toBe('move');
    expect(got.at(-1)![0].t).toBeCloseTo(32 + 0.01 * 768, 6);
    expect(got.at(-1)![0].f).toBeCloseTo(115, 6);
    // z space (index 8): equal aspect around the centre of the z box
    const v8 = view(8);
    layer.update(v8, 0, 'ders');
    p = plotOf(host);
    const b = v8.scatter!.box;
    const pxPerZ = Math.min(p.width / (b.x[1] - b.x[0]), p.height / (b.y[1] - b.y[0]));
    pointer(host, 'pointermove', p.left + p.width / 2 + 0.1 * pxPerZ, p.top + p.height / 2 - 0.2 * pxPerZ);
    const zt = (b.x[0] + b.x[1]) / 2 + 0.1;
    const zf = (b.y[0] + b.y[1]) / 2 + 0.2;
    expect(got.at(-1)![0].t).toBeCloseTo(zt * Z_FIT.t.scale + Z_FIT.t.center, 6);
    expect(got.at(-1)![0].f).toBeCloseTo(zf * Z_FIT.f.scale + Z_FIT.f.center, 6);
    // outside the plot: clamped to the data box
    pointer(host, 'pointerdown', -900, -900);
    expect(got.at(-1)).toEqual([{ t: 0, f: 210 }, 'down']);
    pointer(host, 'pointerup', 99999, 99999);
    expect(got.at(-1)).toEqual([{ t: 64, f: 20 }, 'up']);
  });

  it('rapid step changes during the unit sweep end in the final state', async () => {
    const { host, layer } = setup('ders');
    layer.update(view(0), 0, 'ders');
    layer.update(view(2, { unit: 'yil' }), 900, 'ders');
    await sleep(150);
    layer.update(view(5), 900, 'ders');
    await sleep(150);
    layer.update(view(0), 900, 'ders');
    await sleep(300); // mid-flight
    layer.interrupt();
    const snapped = snapshot(host);
    const p = plotOf(host);
    const want = CUSTOMERS.map((c) => p.left + (c.t / 64) * p.width);
    cxs(host).forEach((x, i) => expect(Math.abs(x - want[i])).toBeLessThan(0.06));
    expect(all(host, 'line.mu').every(hidden)).toBe(true);
    expect(hidden(host.querySelector('ellipse.iso'))).toBe(true);
    // no transition may survive interrupt(): nothing moves while the 900 ms would run
    await sleep(300);
    expect(snapshot(host)).toEqual(snapped);
    await sleep(650);
    expect(snapshot(host)).toEqual(snapped);
  });

  it('resize snaps in-flight moves to the final layout', async () => {
    const { host, layer } = setup('ders');
    layer.update(view(0), 0, 'ders');
    layer.update(view(2, { unit: 'gun' }), 900, 'ders');
    layer.resize(900, 450, 'ders');
    const p = plotOf(host);
    expect(p.width).toBeLessThan(900);
    const snapped = snapshot(host);
    expect(spread(cxs(host))).toBeGreaterThan(0);
    await sleep(950);
    expect(snapshot(host)).toEqual(snapped);
    // the same holds for a step with an ellipse
    layer.update(view(1), 900, 'ders');
    layer.resize(1000, 480, 'ders');
    const s2 = snapshot(host);
    expect(s2.some((s) => s.startsWith('ellipse'))).toBe(true);
    await sleep(950);
    expect(snapshot(host)).toEqual(s2);
  });

  it('resize keeps label sizes', () => {
    const { host, layer } = setup('ders', 1200);
    layer.update(view(1), 0, 'ders');
    const labels = (): SVGElement[] => all(host, 'text.cust-label, text.query-label');
    const before = labels().map((t) => num(t, 'data-w'));
    const fs = (): string[] => labels().map((t) => `${t.style.fontSize}|${t.getAttribute('font-size')}`);
    const fsBefore = fs();
    layer.resize(900, 520, 'ders');
    expect(labels().map((t) => num(t, 'data-w'))).toEqual(before);
    expect(fs()).toEqual(fsBefore);
    const p = plotOf(host);
    for (const t of labels()) {
      expect(num(t, 'data-lx') - num(t, 'data-w') / 2).toBeGreaterThanOrEqual(p.left);
      expect(num(t, 'data-lx') + num(t, 'data-w') / 2).toBeLessThanOrEqual(p.left + p.width);
    }
  });

  const STAGES: Record<Mode, [number, number][]> = { ders: [[1250, 450], [1000, 420]], lab: [[900, 440], [700, 420]] };
  const CASES: [number, Partial<OlcParams>][] = [
    [0, {}], [1, {}], [2, { unit: 'ay' }], [2, { unit: 'yil' }], [2, { unit: 'gun' }], [3, {}], [4, {}], [5, {}],
    [6, { unit: 'ay' }], [6, { unit: 'yil' }], [6, { unit: 'gun' }], [8, {}],
  ];
  type B = { l: number; r: number; t: number; b: number };
  const gap = (b: B, x: number, y: number): number => Math.hypot(Math.max(b.l - x, 0, x - b.r), Math.max(b.t - y, 0, y - b.b));
  // jsdom has no theme CSS: the probe text computes to the browser default 16 px in both modes
  const tick = (_mode: Mode): number => 16;

  it.each(['ders', 'lab'] as const)('labels stay on their own dot, clear of everything, inside the svg in %s', (mode) => {
    for (const [w, h] of STAGES[mode]) {
      for (const [i, over] of CASES) {
        const { host, layer } = setup(mode, w, h);
        layer.update(view(i, over), 0, mode);
        const tag = `${mode} ${w}x${h} step ${i + 1} ${JSON.stringify(over)}`;
        const lh = tick(mode) * 1.2;
        const dots: { id: string; x: number; y: number; r: number }[] = all(host, 'circle.pt.cust').map((c) => ({
          id: c.getAttribute('data-id')!, x: num(c, 'cx'), y: num(c, 'cy'), r: num(c, 'r'),
        }));
        const R = dots[0].r;
        const q = host.querySelector('path.query');
        if (q && shown(q)) dots.push({ id: 'query', x: num(q, 'data-x'), y: num(q, 'data-y'), r: 1.6 * R });
        const labels = all(host, 'text.cust-label, text.query-label, text.mu-label').map((t) => {
          const cx = num(t, 'data-lx');
          const ly = num(t, 'data-ly');
          const hw = num(t, 'data-w') / 2;
          const box: B = { l: cx - hw, r: cx + hw, t: ly - lh * 0.8, b: ly + lh * 0.3 };
          const cls = t.getAttribute('class')!;
          const id = cls === 'query-label' ? 'query' : cls === 'cust-label' ? t.textContent! : null;
          return { id, box, name: `${tag}: ${t.textContent}` };
        });
        const svg = host.querySelector('svg')!;
        const W = Number(svg.getAttribute('width'));
        const H = Number(svg.getAttribute('height'));
        const hit = (a: B, c: B): boolean => a.l < c.r && a.r > c.l && a.t < c.b && a.b > c.t;
        labels.forEach((A, a) => {
          // (c) inside the svg
          expect(A.box.l >= 0 && A.box.r <= W && A.box.t >= 0 && A.box.b <= H, `${A.name} inside`).toBe(true);
          // (a) no other label, no dot
          labels.slice(a + 1).forEach((B) => expect(hit(A.box, B.box), `${A.name} vs ${B.name}`).toBe(false));
          for (const d of dots) {
            expect(hit(A.box, { l: d.x - d.r, r: d.x + d.r, t: d.y - d.r, b: d.y + d.r }), `${A.name} over dot ${d.id}`).toBe(false);
          }
          // (b) own dot is the nearest one, or a leader line ends at it
          if (!A.id) return;
          const own = dots.find((d) => d.id === A.id)!;
          const d0 = gap(A.box, own.x, own.y);
          const nearestOwn = dots.every((d) => d === own || gap(A.box, d.x, d.y) > d0);
          const ld = [...host.querySelectorAll('line.leader')].find((l) => l.getAttribute('data-id') === A.id);
          const leaderOk = !!ld && Math.abs(num(ld, 'x2') - own.x) < 0.2 && Math.abs(num(ld, 'y2') - own.y) < 0.2;
          expect(nearestOwn || leaderOk, `${A.name} attached to its own dot`).toBe(true);
        });
      }
    }
  });
});
