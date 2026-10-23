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

  it('explicit ticks replace the d3 choice', () => {
    const { svg, layer } = setup();
    const spec: LineChartSpec = { ...base, x: [1, 8], xTicks: [1, 2, 3, 4, 5, 6, 7, 8], refs: [], marker: null };
    layer.draw(spec, layer.plotRect(900, 400, spec), 0);
    const labels = [...svg.querySelectorAll('g.axis.x g.tick text')].map((t) => t.textContent);
    expect(labels).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
  });

  it('a ref label moves to the side of its line that the curve does not occupy', () => {
    const { svg, layer } = setup();
    // the curve runs just above the ref line at the right end: the label must go below the line
    const spec: LineChartSpec = {
      ...base,
      x: [1, 100],
      y: [0, 1],
      series: [{ id: 'a', cls: 'curve', pts: [[1, 0.9], [20, 0.56], [100, 0.5]] }],
      refs: [{ y: 0.48, label: 'taban', cls: 'floor' }],
      marker: null,
    };
    layer.draw(spec, layer.plotRect(900, 400, spec), 0);
    const line = Number(svg.querySelector('line.lc-ref')!.getAttribute('y1'));
    expect(Number(svg.querySelector('text.lc-ref-label')!.getAttribute('y'))).toBeGreaterThan(line);
    // a curve far below leaves the label above, as before
    const far: LineChartSpec = { ...spec, series: [{ id: 'a', cls: 'curve', pts: [[1, 0.1], [100, 0.1]] }] };
    layer.draw(far, layer.plotRect(900, 400, far), 0);
    const line2 = Number(svg.querySelector('line.lc-ref')!.getAttribute('y1'));
    expect(Number(svg.querySelector('text.lc-ref-label')!.getAttribute('y'))).toBeLessThan(line2);
  });

  it('each ref label has a background plate that covers its text', () => {
    const { svg, layer } = setup();
    const spec: LineChartSpec = {
      ...base,
      series: [{ id: 'a', cls: 'curve', pts: [[1, 0.9], [100, 0.5]] }],
      refs: [{ y: 0.5, label: 'taban 0,5', cls: 'floor' }, { y: 0.2, label: 'alt', cls: 'low' }],
      marker: null,
    };
    layer.draw(spec, layer.plotRect(900, 400, spec), 0);
    const plates = [...svg.querySelectorAll('rect.lc-ref-bg')];
    const labels = [...svg.querySelectorAll('text.lc-ref-label')];
    expect(plates).toHaveLength(2);
    plates.forEach((r, i) => {
      const ty = Number(labels[i].getAttribute('y'));
      const ry = Number(r.getAttribute('y'));
      expect(ry).toBeLessThan(ty);
      expect(ry + Number(r.getAttribute('height'))).toBeGreaterThan(ty);
      expect(Number(r.getAttribute('x')) + Number(r.getAttribute('width'))).toBeGreaterThanOrEqual(Number(labels[i].getAttribute('x')));
    });
  });

  it('a ref with an empty label gets no background plate', () => {
    const { svg, layer } = setup();
    const spec: LineChartSpec = {
      ...base,
      refs: [
        { y: 0.368, label: '1/e', cls: 'e-line' },
        { y: 0.2, label: '', cls: 'plain' },
      ],
    };
    layer.draw(spec, layer.plotRect(900, 400, spec), 0);
    expect(svg.querySelectorAll('line.lc-ref')).toHaveLength(2);
    expect(svg.querySelectorAll('rect.lc-ref-bg')).toHaveLength(1);
  });
});
