// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { select } from 'd3-selection';
import { AxesLayer, type AxesSpec } from '../../../src/core/plot/axes';
import { fitViewport } from '../../../src/core/plot/viewport';

const PLOT = { left: 50, top: 10, width: 300, height: 150 };

function setup(domain: { x: [number, number]; y: [number, number] }, extra: Partial<AxesSpec> = {}, lines = ['Y title']) {
  const svg = select(document.body).append('svg');
  const g = svg.append('g');
  const layer = new AxesLayer(g as never);
  const sc = fitViewport(domain, PLOT, false);
  const spec: AxesSpec = {
    xTickCount: 5, yTickCount: 5, xTickY: 175, yTickX: 44,
    xTitle: { x: 200, y: 200, text: 'X title' },
    yTitle: { x: 12, y: 85, lines },
    ...extra,
  };
  layer.draw(sc, PLOT, spec, 0, 'k');
  return { g, sc };
}

describe('AxesLayer', () => {
  it('draws ticks and titles', () => {
    const { g, sc } = setup({ x: [0, 10], y: [0, 5] });
    expect(g.selectAll('g.axis.x g.tick').size()).toBe(sc.x.ticks(5).length);
    expect(g.selectAll('g.axis.y g.tick').size()).toBe(sc.y.ticks(5).length);
    expect(g.select('text.axis-title.x').text()).toBe('X title');
    expect(g.select('text.axis-title.y').text()).toBe('Y title');
    expect(g.select('rect.frame').attr('width')).toBe('300');
  });

  it('explicit integer ticks', () => {
    const { g } = setup({ x: [0, 10], y: [0, 5] }, { yTicks: [0, 1, 2, 3, 4, 5] });
    const labels = g.selectAll<SVGTextElement, unknown>('g.axis.y g.tick text').nodes().map((n) => n.textContent);
    expect(labels).toEqual(['0', '1', '2', '3', '4', '5']);
  });

  it('two-line y title', () => {
    const { g } = setup({ x: [0, 10], y: [0, 5] }, {}, ['A', 'B']);
    expect(g.selectAll('text.axis-title.y tspan').size()).toBe(2);
  });
});
