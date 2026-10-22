// @vitest-environment jsdom
import '../svg-stubs';
import { afterEach, describe, expect, it } from 'vitest';
import { ClusterPlotFrame, PLOT_DOMAIN } from '../../../src/concepts/kmeans/plot-frame';

const NS = 'http://www.w3.org/2000/svg';
afterEach(() => { document.body.replaceChildren(); });

const setup = (prefix: string, share: number) => {
  const host = document.createElement('div');
  const svg = document.createElementNS(NS, 'svg');
  host.append(svg);
  document.body.append(host);
  return { svg, frame: new ClusterPlotFrame(svg, host, prefix, share) };
};

describe('ClusterPlotFrame', () => {
  it('builds axes, the page marks group and a font probe in that order', () => {
    const { svg } = setup('km', 0.62);
    expect([...svg.children].map((c) => c.getAttribute('class'))).toEqual(['axes', 'km-marks', 'km-probe']);
    expect(svg.querySelector('.km-marks .cs-layer')).not.toBeNull();
  });

  it('falls back to the scene size share and the mode fonts when nothing can be measured', () => {
    const { svg, frame } = setup('ks', 0.55);
    // jsdom has no --fs-axis, so the axis title falls back to the mode size
    expect(frame.layout('ders', { w: 1000, h: 600 }).axis).toBe(19);
    expect(svg.getAttribute('width')).toBe('550');
    expect(svg.getAttribute('height')).toBe('600');
    expect(frame.fonts('lab').axis).toBe(14);
  });

  it('keeps one data unit equal on both axes and redraws the axes only when invalidated', () => {
    const { svg, frame } = setup('km', 0.62);
    frame.layer.update({ points: [[0, 0], [1, 1]], labels: null, centers: null }, false);
    frame.layout('lab', { w: 900, h: 600 });
    const [a, b] = [...svg.querySelectorAll('circle.cs-point')].map((p) => [Number(p.getAttribute('cx')), Number(p.getAttribute('cy'))]);
    expect(Math.abs((b[0] - a[0]) - (a[1] - b[1]))).toBeLessThan(0.2);
    const tick = () => svg.querySelector('.axes rect.frame')!;
    const x = tick().getAttribute('x');
    expect(x).not.toBeNull();
    tick().setAttribute('x', '-999');
    frame.layout('lab', { w: 900, h: 600 });
    expect(tick().getAttribute('x')).toBe('-999');
    frame.invalidate();
    frame.layout('lab', { w: 900, h: 600 });
    expect(tick().getAttribute('x')).toBe(x);
    expect(PLOT_DOMAIN).toEqual({ x: [-2.1, 2.7], y: [-1.8, 2.0] });
  });

  it('a short plot gets whole-unit-or-sparser ticks and a two-line y title; a tall one keeps both', () => {
    const { svg, frame } = setup('ks', 0.55);
    const ticks = (axis: 'x' | 'y') => [...svg.querySelectorAll(`.axis.${axis} .tick text`)].map((t) => t.textContent);
    const title = () => [...svg.querySelectorAll('.axis-title.y tspan')].map((t) => t.textContent);
    frame.layout('ders', { w: 1000, h: 600 });
    expect(ticks('y')).toHaveLength(8);
    expect(title()).toEqual(['petal length (ölçeklenmiş)']);
    frame.invalidate();
    frame.layout('ders', { w: 1000, h: 160 });
    expect(ticks('x')).toEqual(['−2', '0', '2']);
    expect(ticks('y')).toEqual(['0', '2']);
    expect(title()).toEqual(['petal length', '(ölçeklenmiş)']);
  });
});
