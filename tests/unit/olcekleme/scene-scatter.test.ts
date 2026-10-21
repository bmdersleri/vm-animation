// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { ScatterLayer, type QueryPointer } from '../../../src/concepts/olcekleme/scene-scatter';
import { deriveOlcView, type OlcView } from '../../../src/concepts/olcekleme/view';
import { olceklemeScenario, type OlcParams } from '../../../src/concepts/olcekleme/scenario';
import { CUSTOMERS } from '../../../src/concepts/olcekleme/data';
import { Z_FIT } from '../../../src/concepts/olcekleme/space';
import type { Mode } from '../../../src/core/mode';

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

  it('rapid step changes during the unit sweep end in the final state', () => {
    const { host, layer } = setup('ders');
    layer.update(view(0), 0, 'ders');
    layer.update(view(2, { unit: 'yil' }), 900, 'ders');
    layer.update(view(5), 900, 'ders');
    layer.update(view(0), 900, 'ders');
    layer.interrupt();
    const p = plotOf(host);
    const want = CUSTOMERS.map((c) => p.left + (c.t / 64) * p.width);
    cxs(host).forEach((x, i) => expect(Math.abs(x - want[i])).toBeLessThan(0.06));
    expect(all(host, 'line.mu').every(hidden)).toBe(true);
    expect(hidden(host.querySelector('ellipse.iso'))).toBe(true);
  });

  it('resize snaps in-flight moves to the final layout', () => {
    const { host, layer } = setup('ders');
    layer.update(view(0), 0, 'ders');
    layer.update(view(2, { unit: 'gun' }), 900, 'ders');
    layer.resize(900, 450, 'ders');
    const p = plotOf(host);
    expect(p.width).toBeLessThan(900);
    const snapped = cxs(host);
    // a snapped layout is stable: interrupting changes nothing
    layer.interrupt();
    expect(cxs(host)).toEqual(snapped);
    expect(spread(snapped)).toBeGreaterThan(spread(CUSTOMERS.map((c) => (c.t / 64) * p.width)));
  });

  it('resize keeps label sizes', () => {
    const { host, layer } = setup('ders', 1200);
    layer.update(view(1), 0, 'ders');
    const fs = (): string[] =>
      all(host, 'text.cust-label').map((t) => `${t.style.fontSize}|${t.getAttribute('font-size')}|${getComputedStyle(t).fontSize}`);
    const before = fs();
    layer.resize(900, 520, 'ders');
    expect(fs()).toEqual(before);
    expect(all(host, 'text.cust-label')).toHaveLength(6);
  });

  it.each(['ders', 'lab'] as const)('labels never overlap in %s', (mode) => {
    const cases: [number, Partial<OlcParams>][] = [
      [1, {}], [3, {}], [4, {}], [5, {}], [8, {}], [2, { unit: 'yil' }], [2, { unit: 'gun' }],
    ];
    for (const [i, over] of cases) {
      const { host, layer } = setup(mode);
      layer.update(view(i, over), 0, mode);
      const boxes = all(host, 'text.cust-label, text.query-label, text.mu-label').map((t) => {
        const cx = num(t, 'data-lx');
        const ly = num(t, 'data-ly');
        const w = num(t, 'data-w');
        return { id: `${i}:${t.textContent}`, l: cx - w / 2, r: cx + w / 2, t: ly - 14, b: ly + 3 };
      });
      for (let a = 0; a < boxes.length; a++) {
        for (let c = a + 1; c < boxes.length; c++) {
          const A = boxes[a];
          const B = boxes[c];
          expect(A.l < B.r && A.r > B.l && A.t < B.b && A.b > B.t, `${A.id} vs ${B.id}`).toBe(false);
        }
      }
    }
  });
});
