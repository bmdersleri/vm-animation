// @vitest-environment jsdom
import '../svg-stubs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PointKindsLayer, type PointKindsSpec } from '../../../src/core/plot/point-kinds';
import { CLUSTER, NAVY, UNASSIGNED } from '../../../src/core/plot/marks';
import { fitEqualAspect } from '../../../src/core/plot/viewport';

const NS = 'http://www.w3.org/2000/svg';
const PTS = [[0, 0], [1, 1], [-1, 2], [2, -1]] as const;
const DOMAIN: { x: [number, number]; y: [number, number] } = { x: [-3, 3], y: [-3, 3] };
const RECT = { left: 10, top: 10, width: 400, height: 200 };

afterEach(() => { vi.unstubAllGlobals(); document.body.replaceChildren(); });

function setup() {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }));
  const svg = document.createElementNS(NS, 'svg');
  const g = document.createElementNS(NS, 'g');
  svg.append(g);
  document.body.append(svg);
  const layer = new PointKindsLayer(g, DOMAIN);
  layer.resize(RECT);
  return { svg, layer };
}
const spec = (o: Partial<PointKindsSpec> = {}): PointKindsSpec => ({ points: PTS, kind: null, label: null, ...o });
const mark = (svg: Element, i: number) => svg.querySelector(`g.pk-point[data-i="${i}"]`)!;

describe('PointKindsLayer', () => {
  it('draws core as filled circle, border as ring, noise as grey cross', () => {
    const { svg, layer } = setup();
    layer.update(spec({ kind: ['core', 'border', 'noise', 'core'], label: [0, 1, -1, 1] }), false);
    const core = mark(svg, 0);
    expect(core.getAttribute('data-kind')).toBe('core');
    expect(core.querySelector('circle')!.getAttribute('fill')).toBe(CLUSTER[0]);
    const ring = mark(svg, 1);
    expect(ring.getAttribute('data-kind')).toBe('border');
    expect(ring.querySelector('circle')!.getAttribute('fill')).toBe('#ffffff');
    expect(ring.querySelector('circle')!.getAttribute('stroke')).toBe(CLUSTER[1]);
    const noise = mark(svg, 2);
    expect(noise.getAttribute('data-kind')).toBe('noise');
    expect(noise.querySelector('circle')!.getAttribute('display')).toBe('none');
    expect(noise.querySelector('path')!.getAttribute('display')).toBeNull();
    expect(noise.querySelector('path')!.getAttribute('stroke')).toBe(UNASSIGNED);
    expect(core.querySelector('path')!.getAttribute('display')).toBe('none');
  });

  it('kind null draws every point as a plain dot in its label colour', () => {
    const { svg, layer } = setup();
    layer.update(spec({ label: [0, 1, 1, 0] }), false);
    expect([...svg.querySelectorAll('g.pk-point')].map((g) => g.getAttribute('data-kind'))).toEqual(['-', '-', '-', '-']);
    expect(mark(svg, 1).querySelector('circle')!.getAttribute('fill')).toBe(CLUSTER[1]);
    layer.update(spec(), false);
    expect(mark(svg, 1).querySelector('circle')!.getAttribute('fill')).toBe(UNASSIGNED);
  });

  it('colouredUpTo reveals the first points of order only', () => {
    const { svg, layer } = setup();
    layer.update(spec({ kind: ['core', 'core', 'noise', 'core'], label: [0, 0, -1, 0], order: [1, 0, 3, 2], colouredUpTo: 2 }), false);
    expect([...svg.querySelectorAll('g.pk-point')].map((g) => g.getAttribute('data-kind'))).toEqual(['core', 'core', '-', '-']);
    layer.update(spec({ kind: ['core', 'core', 'noise', 'core'], label: [0, 0, -1, 0], order: [1, 0, 3, 2], colouredUpTo: 4 }), false);
    expect(mark(svg, 2).getAttribute('data-kind')).toBe('noise');
  });

  it('eps circle radius equals eps in pixels on both axes', () => {
    const { svg, layer } = setup();
    layer.update(spec({ eps: { center: 1, r: 0.5 } }), false);
    const c = svg.querySelector('circle.pk-eps')!;
    const sc = fitEqualAspect(DOMAIN, RECT);
    expect(Number(c.getAttribute('r'))).toBeCloseTo(sc.x(0.5) - sc.x(0), 0);
    expect(Number(c.getAttribute('r'))).toBeCloseTo(sc.y(0) - sc.y(0.5), 0);
    expect(Number(c.getAttribute('cx'))).toBeCloseTo(sc.x(1), 0);
    expect(Number(c.getAttribute('cy'))).toBeCloseTo(sc.y(1), 0);
    layer.update(spec({ eps: null }), false);
    expect(svg.querySelector('circle.pk-eps')).toBeNull();
  });

  it('neighbours get a thin navy ring and the selected point a labelled one', () => {
    const { svg, layer } = setup();
    layer.update(spec({ neighbours: [0, 1, 3], selected: 0, via: 3 }), false);
    const rings = [...svg.querySelectorAll('circle.pk-nbr')];
    expect(rings.map((r) => r.getAttribute('data-i'))).toEqual(['1', '3']);
    for (const r of rings) {
      expect(r.getAttribute('stroke')).toBe(NAVY);
      expect(Number(r.getAttribute('stroke-width'))).toBeLessThan(2);
    }
    expect(svg.querySelector('circle.pk-sel')!.getAttribute('data-i')).toBe('0');
    expect(svg.querySelector('text.pk-sel-label')!.textContent).toBe('Nokta 1');
    expect(svg.querySelector('circle.pk-via')!.getAttribute('data-i')).toBe('3');
  });

  it('repeated update keeps element counts', () => {
    const { svg, layer } = setup();
    const s = spec({ kind: ['core', 'border', 'noise', 'core'], label: [0, 0, -1, 1], eps: { center: 0, r: 1 }, neighbours: [0, 1], selected: 0 });
    layer.update(s, false);
    const count = () => svg.querySelectorAll('*').length;
    const n = count();
    layer.update(s, false);
    layer.update(s, true);
    layer.resize({ left: 0, top: 0, width: 300, height: 300 });
    expect(count()).toBe(n);
    layer.destroy();
    expect(svg.querySelector('.pk-layer')).toBeNull();
  });
});
