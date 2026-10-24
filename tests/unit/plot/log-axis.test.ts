import { describe, it, expect } from 'vitest';
import { logAxis } from '../../../src/core/plot/log-axis';

describe('logAxis', () => {
  it('uses decades when the span is wider than three decades', () => {
    const a = logAxis(1e-5, 1);
    expect(a.ticks).toEqual([-5, -4, -3, -2, -1, 0]);
    expect(a.y).toEqual([-5, 0]);
    expect(a.ticks.map(a.format)).toEqual(['0,00001', '0,0001', '0,001', '0,01', '0,1', '1']);
  });

  it('adds the 2 and 5 of each decade on a narrow span', () => {
    const a = logAxis(0.01, 0.1);
    expect(a.ticks.map((t) => 10 ** t)).toEqual([0.01, 0.02, 0.05, 0.1].map((v) => expect.closeTo(v, 12)));
    expect(a.ticks.map(a.format)).toEqual(['0,01', '0,02', '0,05', '0,1']);
  });

  it('keeps only ticks inside the range', () => {
    const a = logAxis(0.03, 0.4);
    expect(a.ticks.map(a.format)).toEqual(['0,05', '0,1', '0,2']);
    expect(a.y[0]).toBeCloseTo(Math.log10(0.03), 12);
    expect(a.y[1]).toBeCloseTo(Math.log10(0.4), 12);
  });
});
