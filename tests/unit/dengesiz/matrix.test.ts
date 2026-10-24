// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { select } from 'd3-selection';
import { MatrixLayer } from '../../../src/concepts/dengesiz/matrix';
import { TextMeasure } from '../../../src/core/plot/text-measure';

function draw(matrix: { tn: number; fp: number; fn: number; tp: number }) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  document.body.append(svg);
  const probe = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  svg.append(probe);
  const g = select(svg).append('g');
  const layer = new MatrixLayer(g, new TextMeasure(probe as SVGTextElement));
  layer.draw(matrix, { rect: { x: 0, y: 0, w: 300, h: 200 }, tick: 18, axis: 19, focusPositive: false, ms: 0 });
  return svg;
}

describe('confusion matrix layer', () => {
  it('four cells carry their counts', () => {
    const svg = draw({ tn: 563, fp: 0, fn: 37, tp: 0 });
    const read = (k: string) => svg.querySelector(`[data-cell="${k}"] .cell-count`)!.textContent;
    expect(read('tn')).toBe('563');
    expect(read('fp')).toBe('0');
    expect(read('fn')).toBe('37');
    expect(read('tp')).toBe('0');
    expect(svg.querySelectorAll('[data-cell]').length).toBe(4);
  });

  it('cell labels use kalan and ayrılan', () => {
    const svg = draw({ tn: 1, fp: 2, fn: 3, tp: 4 });
    const cols = [...svg.querySelectorAll('.matrix-col-name')].map((t) => t.textContent);
    const rows = [...svg.querySelectorAll('.matrix-row-name')].map((t) => t.textContent);
    expect(cols).toEqual(['kalan', 'ayrılan']);
    expect(rows).toEqual(['kalan', 'ayrılan']);
    expect(svg.textContent).not.toMatch(/Kaldı|Ayrıldı/);
  });
});
