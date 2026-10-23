// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { select } from 'd3-selection';
import { LineChartLayer, type LineChartSpec } from '../../../src/core/plot/line-chart';
import { TextMeasure } from '../../../src/core/plot/text-measure';

const NS = 'http://www.w3.org/2000/svg';

function setup() {
  const svg = document.createElementNS(NS, 'svg');
  document.body.append(svg);
  const probe = document.createElementNS(NS, 'text');
  svg.append(probe);
  const root = select(svg).append('g');
  const measure = new TextMeasure(probe);
  return { svg, layer: new LineChartLayer(root, measure), measure };
}

afterEach(() => document.body.replaceChildren());

const base: LineChartSpec = {
  x: [1, 100],
  y: [0, 1],
  xTitle: 'n',
  yTitle: 'olasılık',
  series: [
    { id: 'a', cls: 'curve', pts: [[1, 0], [50, 0.36], [100, 0.37]] },
    { id: 'b', cls: 'other', pts: [[1, 0.5], [100, 0.5]], dash: '6 4' },
  ],
  refs: [{ y: 0.368, label: '1/e', cls: 'e-line' }],
  marker: { x: 10, y: 0.349, label: 'n = 10' },
};

describe('LineChartLayer', () => {
  it('draws one path per series and one line per ref', () => {
    const { svg, layer } = setup();
    const plot = layer.plotRect(900, 400, base);
    layer.draw(base, plot, 0);
    expect(svg.querySelectorAll('path.lc-series')).toHaveLength(2);
    expect(svg.querySelectorAll('line.lc-ref')).toHaveLength(1);
    expect(svg.querySelectorAll('circle.lc-marker')).toHaveLength(1);
    expect(svg.querySelector('path.lc-series.other')!.getAttribute('stroke-dasharray')).toBe('6 4');
    // a second draw replaces, not accumulates
    layer.draw({ ...base, series: [base.series[0]], refs: [], marker: null }, plot, 0);
    expect(svg.querySelectorAll('path.lc-series')).toHaveLength(1);
    expect(svg.querySelectorAll('line.lc-ref')).toHaveLength(0);
    expect(svg.querySelectorAll('circle.lc-marker')).toHaveLength(0);
  });

  it('marker label stays inside the plot', () => {
    const { svg, layer, measure } = setup();
    const corners: [number, number][] = [[100, 1], [1, 0], [100, 0], [1, 1], [50, 0.5]];
    for (const [x, y] of corners) {
      const spec: LineChartSpec = { ...base, refs: [], marker: { x, y, label: `n = ${x} · (1 − 1/n)ⁿ = 0,349` } };
      const plot = layer.plotRect(900, 400, spec);
      layer.draw(spec, plot, 0);
      const label = svg.querySelector('text.lc-label')!;
      const w = measure.width(label.textContent!, 'tick', 13);
      const lx = Number(label.getAttribute('x'));
      const ly = Number(label.getAttribute('y'));
      const anchor = label.getAttribute('text-anchor');
      const left = anchor === 'end' ? lx - w : anchor === 'middle' ? lx - w / 2 : lx;
      expect(left).toBeGreaterThanOrEqual(plot.left - 0.5);
      expect(left + w).toBeLessThanOrEqual(plot.left + plot.width + 0.5);
      expect(ly).toBeGreaterThan(plot.top);
      expect(ly).toBeLessThan(plot.top + plot.height + 0.5);
    }
  });
});
