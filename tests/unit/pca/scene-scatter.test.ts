// @vitest-environment jsdom
import '../svg-stubs';
import { describe, it, expect, afterEach } from 'vitest';
import { ScatterLayer } from '../../../src/concepts/pca/scene-scatter';
import { derivePcaView, type ScatterView } from '../../../src/concepts/pca/view';
import { pcaScenario, type PcaParams } from '../../../src/concepts/pca/scenario';
import { footOn, pairFit } from '../../../src/concepts/pca/pca2';
import { PAIR } from '../../../src/concepts/pca/data';
import { countSubpaths } from '../../../src/core/plot/dots-path';
import type { Mode } from '../../../src/core/mode';

const SVGNS = 'http://www.w3.org/2000/svg';
const RECT = { left: 60, top: 10, width: 520, height: 520 };
const view = (i: number, over: Partial<PcaParams> = {}): ScatterView =>
  derivePcaView(i, { ...pcaScenario.defaults, ...pcaScenario.steps[i].params, ...over }).scatter!;

let made: { svg: SVGSVGElement; layer: ScatterLayer }[] = [];
function setup(ds = 0, mode: Mode = 'ders', rect = RECT): { svg: SVGSVGElement; layer: ScatterLayer } {
  const svg = document.createElementNS(SVGNS, 'svg') as SVGSVGElement;
  document.body.append(svg);
  const layer = new ScatterLayer(svg, ds);
  layer.layout(rect, mode);
  const m = { svg, layer };
  made.push(m);
  return m;
}
afterEach(() => { made.forEach((m) => { m.layer.destroy(); m.svg.remove(); }); made = []; });

const q = (svg: Element, sel: string): SVGElement => svg.querySelector<SVGElement>(sel)!;
const all = (svg: Element, sel: string): SVGElement[] => [...svg.querySelectorAll<SVGElement>(sel)];
const num = (el: Element, a: string): number => Number(el.getAttribute(a));
const val = (s: string): number => Number(s.replace('−', '-').replace(/\./g, '').replace(',', '.'));
const ticksOf = (svg: Element, a: 'x' | 'y'): { v: number; text: string; at: number }[] =>
  all(svg, `g.axis.${a} g.tick`).map((g) => {
    const m = /translate\(([^,]+),([^)]+)\)/.exec(g.getAttribute('transform') ?? '')!;
    const text = g.querySelector('text')!.textContent!;
    return { v: val(text), text, at: Number(a === 'x' ? m[1] : m[2]) };
  });
/** px per unit from the first and last tick of an axis (signed: y is negative). */
const ppu = (svg: Element, a: 'x' | 'y'): { k: number; px: (v: number) => number } => {
  const t = ticksOf(svg, a);
  const f = t[0];
  const l = t[t.length - 1];
  const k = (l.at - f.at) / (l.v - f.v);
  return { k, px: (v) => f.at + (v - f.v) * k };
};
/** Centres of the circle sub-paths of a circlesPath string. */
const centres = (d: string, r: number): [number, number][] =>
  [...d.matchAll(/M(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]) + r, Number(m[2])]);

describe('pca ScatterLayer', () => {
  it('step 1: one path with 500 dots, equal px per unit on both axes', () => {
    const { svg, layer } = setup();
    layer.update(view(0), 0);
    const pts = svg.querySelectorAll('g.cloud path.pts');
    expect(pts).toHaveLength(1);
    expect(pts[0].getAttribute('data-n')).toBe('500');
    expect(countSubpaths(pts[0].getAttribute('d')!)).toBe(500);
    expect(q(svg, 'g.pca-scatter').getAttribute('data-birim')).toBe('1');
    expect(svg.querySelector('clipPath#pca-clip')).not.toBeNull();
    expect(svg.querySelector('rect.frame')).not.toBeNull();
    expect(q(svg, 'g.center-cross').getAttribute('display')).not.toBe('none');
    expect(q(svg, 'g.cloud').getAttribute('data-collapsed')).toBe('0');
    expect(ppu(svg, 'x').k).toBeCloseTo(-ppu(svg, 'y').k, 1);
    expect(svg.querySelectorAll('circle')).toHaveLength(1); // only the handle: the dots are paths
  });

  it('step 2: direction line at 0° and projections as two paths', () => {
    const { svg, layer } = setup();
    layer.update(view(1), 0);
    expect(q(svg, 'line.dir').getAttribute('data-theta')).toBe('0');
    expect(q(svg, 'text.dir-label').textContent).toBe('θ = 0°');
    const lines = all(svg, 'path.proj-lines');
    const pts = all(svg, 'path.proj-pts');
    expect(lines).toHaveLength(1);
    expect(pts).toHaveLength(1);
    expect(lines[0].getAttribute('data-n')).toBe('500');
    expect(pts[0].getAttribute('data-n')).toBe('500');
    expect(countSubpaths(lines[0].getAttribute('d')!)).toBe(500);
    expect(countSubpaths(pts[0].getAttribute('d')!)).toBe(500);
    // at 0° every projected dot sits on the horizontal line through the centre
    const cy = ppu(svg, 'y').px(0);
    for (const [, y] of centres(pts[0].getAttribute('d')!, 3)) expect(Math.abs(y - cy)).toBeLessThan(0.6);
    expect(q(svg, 'line.dir2').getAttribute('opacity')).toBe('0');
  });

  it('step 4: direction label PC1 at 45°', () => {
    const { svg, layer } = setup();
    layer.update(view(3), 0);
    expect(q(svg, 'line.dir').getAttribute('data-theta')).toBe('45');
    expect(q(svg, 'text.dir-label').textContent).toBe('PC1');
  });

  it('step 5: second line at 135° labelled PC2', () => {
    const { svg, layer } = setup();
    layer.update(view(4), 0);
    expect(q(svg, 'line.dir2').getAttribute('data-theta')).toBe('135');
    expect(q(svg, 'line.dir2').getAttribute('opacity')).toBe('1');
    expect(q(svg, 'text.dir2-label').textContent).toBe('PC2');
  });

  it('step 6: one group transform rotates the cloud', () => {
    const { svg, layer } = setup();
    layer.update(view(5), 0);
    const cloud = q(svg, 'g.cloud');
    expect(cloud.getAttribute('transform')!.startsWith('rotate(45,')).toBe(true);
    expect(cloud.getAttribute('data-rot')).toBe('-45');
    const stray = all(svg, 'path, circle').filter((e) => !e.closest('g.cloud') && e.hasAttribute('transform'));
    expect(stray).toHaveLength(0);
    expect(all(svg, 'g.cloud path, g.cloud circle, g.cloud line').filter((e) => e.hasAttribute('transform'))).toHaveLength(0);
  });

  it('step 7: points collapse onto the PC1 feet, drop lines fade', () => {
    const { svg, layer } = setup();
    layer.update(view(6), 0);
    expect(q(svg, 'g.cloud').getAttribute('data-collapsed')).toBe('1');
    const X = ppu(svg, 'x');
    const Y = ppu(svg, 'y');
    const feet = footOn(PAIR, pairFit(1).pc1Deg);
    const got = centres(q(svg, 'path.pts').getAttribute('d')!, 3.5);
    expect(got).toHaveLength(500);
    got.forEach(([x, y], i) => {
      expect(Math.abs(x - X.px(feet[i][0]))).toBeLessThan(0.4);
      expect(Math.abs(y - Y.px(feet[i][1]))).toBeLessThan(0.4);
    });
    expect(q(svg, 'path.drop-lines').getAttribute('opacity')).toBe('0');
  });

  it('step 8: ×1000 rescales the y axis and PC1 is vertical', () => {
    const { svg, layer } = setup();
    layer.update(view(6), 0);
    layer.update(view(7), 0);
    expect(q(svg, 'g.pca-scatter').getAttribute('data-birim')).toBe('1000');
    expect(q(svg, 'text.axis-title.y').textContent).toBe('9. öznitelik × 1000');
    expect(ticksOf(svg, 'y').map((t) => t.text)).toContain('−4.000');
    expect(q(svg, 'line.dir').getAttribute('data-theta')).toBe('90');
    expect(q(svg, 'g.cloud').getAttribute('data-rot')).toBe('0');
  });

  it('pointer angle wraps mod 180 and works outside the plot', () => {
    const { svg, layer } = setup(0, 'lab');
    layer.update(view(1), 0);
    const got: [number, string][] = [];
    layer.onPointer((deg, kind) => got.push([deg, kind]));
    const hit = q(svg, 'rect.hit');
    const cx = ppu(svg, 'x').px(0);
    const cy = ppu(svg, 'y').px(0);
    const fire = (type: string, x: number, y: number): void => {
      hit.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));
    };
    fire('pointermove', cx + 100, cy);
    fire('pointermove', cx - 50, cy - 50);
    fire('pointermove', cx + 50, cy + 50);
    fire('pointermove', cx + 5000, cy);
    fire('pointermove', cx - 100, cy);
    expect(got.map((g) => g[0])).toEqual([0, 135, 135, 0, 0]);
    expect(got.every((g) => g[1] === 'move')).toBe(true);
    fire('pointerdown', cx, cy - 100);
    fire('pointerup', cx, cy - 100);
    expect(got.slice(5)).toEqual([[90, 'down'], [90, 'up']]);
    expect(num(q(svg, 'circle.handle'), 'r')).toBeGreaterThanOrEqual(22);
    expect(q(svg, 'circle.handle').getAttribute('display')).not.toBe('none');
  });

  it('the handle is hidden in ders', () => {
    const { svg, layer } = setup(0, 'ders');
    layer.update(view(1), 0);
    expect(q(svg, 'circle.handle').getAttribute('display')).toBe('none');
  });

  it('layout keeps label sizes', () => {
    const { svg, layer } = setup();
    layer.update(view(1), 0);
    const label = q(svg, 'text.dir-label');
    const size = (): string => `${label.getAttribute('font-size')}|${(label as unknown as HTMLElement).style.fontSize}|${getComputedStyle(label).fontSize}`;
    const before = size();
    const w0 = ppu(svg, 'x').k;
    layer.layout({ left: 60, top: 10, width: 400, height: 400 }, 'ders');
    expect(size()).toBe(before);
    expect(ppu(svg, 'x').k).toBeLessThan(w0);
    expect(num(q(svg, 'rect.hit'), 'width')).toBe(400);
    expect(num(q(svg, 'clipPath#pca-clip rect'), 'width')).toBe(400);
  });

  it('null view hides the layer', () => {
    const { svg, layer } = setup();
    layer.update(view(0), 0);
    layer.update(null, 0);
    expect((q(svg, 'g.pca-scatter') as unknown as HTMLElement).style.display).toBe('none');
    layer.update(view(0), 0);
    expect((q(svg, 'g.pca-scatter') as unknown as HTMLElement).style.display).toBe('');
  });

  it('real transitions settle', async () => {
    const { svg, layer } = setup(1);
    layer.update(view(4), 0);
    layer.update(view(5), 1);
    await new Promise((r) => setTimeout(r, 1000 + 250));
    expect(q(svg, 'g.cloud').getAttribute('data-rot')).toBe('-45');
    expect(q(svg, 'g.cloud').getAttribute('transform')!.startsWith('rotate(45,')).toBe(true);
    expect(q(svg, 'line.dir').getAttribute('data-theta')).toBe('45');
  });

  it('collapse transition ends on the feet with the drop lines faded; interrupt snaps', async () => {
    const { svg, layer } = setup(1);
    layer.update(view(5), 0);
    layer.update(view(6), 1);
    expect(q(svg, 'path.drop-lines').getAttribute('opacity')).toBe('1');
    layer.interrupt();
    expect(q(svg, 'path.drop-lines').getAttribute('opacity')).toBe('0');
    const X = ppu(svg, 'x');
    const feet = footOn(PAIR, pairFit(1).pc1Deg);
    const got = centres(q(svg, 'path.pts').getAttribute('d')!, 3.5);
    expect(Math.abs(got[0][0] - X.px(feet[0][0]))).toBeLessThan(0.4);
    layer.update(view(5), 1); // back: dots return
    await new Promise((r) => setTimeout(r, 900 + 250));
    const back = centres(q(svg, 'path.pts').getAttribute('d')!, 3.5);
    expect(Math.abs(back[0][0] - X.px(PAIR[0][0]))).toBeLessThan(0.4);
  });
});
