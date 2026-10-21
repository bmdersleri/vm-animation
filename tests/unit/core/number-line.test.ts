// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { select } from 'd3-selection';
import { lineScale, NumberLineLayer, stackLevels, staggerRows } from '../../../src/core/plot/number-line';

describe('lineScale', () => {
  it('broken scale', () => {
    const sc = lineScale({ min: 0, max: 100, breakAt: 100, farMax: 600, farFrac: 0.2, gapPx: 20 }, [0, 1000]);
    expect(sc(0)).toBe(0);
    expect(sc(100)).toBe(780);
    expect(sc(100.0001)).toBeGreaterThanOrEqual(800);
    expect(sc(350)).toBe(900);
    expect(sc(600)).toBe(1000);
    expect(sc(-5)).toBe(0);
    expect(sc(700)).toBe(1000);
    expect(sc.isFar(100)).toBe(false);
    expect(sc.isFar(100.01)).toBe(true);
    expect(sc.gap).toEqual([780, 800]);
    expect(sc.ticks(5).every((t) => t <= 100)).toBe(true);
  });
  it('plain scale', () => {
    const sc = lineScale({ min: -1, max: 6 }, [0, 700]);
    expect(sc(-1)).toBe(0);
    expect(sc(6)).toBe(700);
    expect(sc.gap).toBeNull();
    expect(sc.isFar(1000)).toBe(false);
  });
});

describe('stackLevels', () => {
  it('stacks beeswarm style', () => {
    expect(stackLevels([0, 3, 50, 52, 53], 10)).toEqual([0, 1, 0, 1, 2]);
  });
  it('separates equal values', () => {
    const l = stackLevels([5, 5], 10);
    expect(l[0]).not.toBe(l[1]);
  });
});

describe('staggerRows', () => {
  it('moves overlapping labels to another row', () => {
    expect(staggerRows([{ x: 0, w: 100 }, { x: 60, w: 100 }, { x: 300, w: 50 }], 4)).toEqual([0, 1, 0]);
  });
});

describe('NumberLineLayer', () => {
  function draw(sc: ReturnType<typeof lineScale>) {
    const svg = select(document.body).append('svg');
    const layer = new NumberLineLayer(svg.append('g') as never);
    layer.draw(sc, 50, { tickCount: 5, tickY: 70, title: 'Başlık', titleY: 90 }, 0, 'k');
    return svg;
  }
  it('draws ticks, break glyph and title', () => {
    const b = draw(lineScale({ min: 0, max: 100, breakAt: 100, farMax: 600 }, [0, 500]));
    expect(b.selectAll('g.tick').size()).toBeGreaterThan(1);
    expect(b.selectAll('g.break-mark line.break-slash').size()).toBe(2);
    expect(b.select('text.axis-title').text()).toBe('Başlık');
    const p = draw(lineScale({ min: 0, max: 10 }, [0, 500]));
    expect(p.selectAll('g.break-mark line.break-slash').size()).toBe(0);
  });
});
