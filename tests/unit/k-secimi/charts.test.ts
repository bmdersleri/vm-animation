// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { KLineChart } from '../../../src/concepts/k-secimi/charts';

const NS = 'http://www.w3.org/2000/svg';
afterEach(() => { document.body.replaceChildren(); });

const setup = () => {
  const svg = document.createElementNS(NS, 'svg');
  const g = document.createElementNS(NS, 'g');
  svg.append(g);
  document.body.append(svg);
  const chart = new KLineChart(g, { ks: [1, 2, 3, 4], values: [300, 120, 60, 40], label: 'test', yDomain: [0, 330] });
  return { g, chart };
};
const frameWidth = (g: SVGGElement) => g.querySelector('rect.kc-frame')!.getAttribute('width');
const yTicks = (g: SVGGElement) => [...g.querySelectorAll('.kc-tick-y')].map((t) => t.textContent);
const state = { reveal: 4, selected: 2, marks: [] };

describe('KLineChart', () => {
  it('resize only stores the box; the next set() draws it', () => {
    const { g, chart } = setup();
    chart.set(state);
    const before = frameWidth(g);
    chart.resize({ left: 0, top: 0, width: 400, height: 200 }, 13);
    expect(frameWidth(g)).toBe(before);
    chart.set(state);
    expect(frameWidth(g)).not.toBe(before);
    expect(Number(frameWidth(g))).toBe(400 - Math.ceil(13 * 2.9) - Math.ceil(13 * 0.8));
  });

  it('a short chart keeps two y ticks instead of crowding three', () => {
    const { g, chart } = setup();
    chart.resize({ left: 0, top: 0, width: 400, height: 200 }, 13);
    chart.set(state);
    expect(yTicks(g)).toEqual(['0', '100', '200', '300']);
    chart.resize({ left: 0, top: 0, width: 400, height: 108 }, 18);
    chart.set(state);
    expect(yTicks(g)).toEqual(['0', '200']);
  });
});
