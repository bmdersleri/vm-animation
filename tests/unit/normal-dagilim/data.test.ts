import { describe, expect, it } from 'vitest';
import { SERIES, NORM, SINAV_FIXED } from '../../../src/concepts/normal-dagilim/data';
import { mean, median, skewness, std, std0, zscores, normCdf } from '../../../src/core/stats';

describe('normal data', () => {
  it('browser stats match the pandas fixture for both series', () => {
    for (const s of Object.values(SERIES)) {
      expect(s.values).toHaveLength(200);
      expect(mean(s.values)).toBeCloseTo(s.mean, 10);
      expect(median(s.values)).toBeCloseTo(s.median, 10);
      expect(std(s.values)).toBeCloseTo(s.std, 10);
      expect(skewness(s.values)).toBeCloseTo(s.skew, 10);
    }
  });
  it('fixed-edge histogram counts match numpy', () => {
    for (const s of Object.values(SERIES)) {
      const counts = s.edges.slice(0, -1).map((lo, i) => s.values.filter((x) => x >= lo && (i === s.edges.length - 2 ? x <= s.edges[i + 1] : x < s.edges[i + 1])).length);
      expect(counts).toEqual(s.counts);
      expect(counts.reduce((a, b) => a + b, 0)).toBe(s.values.length);
      expect(s.edges[0]).toBe(s.domain[0]);
      expect(s.edges.at(-1)).toBe(s.domain[1]);
      s.edges.slice(1).forEach((x, i) => expect(x - s.edges[i]).toBe(s.binWidth));
    }
  });
  it('band counts match the fixture', () => {
    for (const s of Object.values(SERIES)) for (const b of s.band) {
      expect(b.lo).toBeCloseTo(mean(s.values) - b.k * std(s.values), 10);
      expect(b.hi).toBeCloseTo(mean(s.values) + b.k * std(s.values), 10);
      expect(s.values.filter((x) => x >= b.lo && x <= b.hi)).toHaveLength(b.count);
    }
  });
  it('fixture std and scaler std differ by ddof', () => {
    for (const s of Object.values(SERIES)) {
      expect(s.std).toBeCloseTo(std0(s.values) * Math.sqrt(200 / 199), 10);
      const z = zscores(s.values);
      expect(mean(z)).toBeCloseTo(s.scaled.mean, 10);
      expect(std0(z)).toBeCloseTo(s.scaled.std0, 10);
      expect(s.scaled.std0).toBeCloseTo(1, 10);
      expect(skewness(z)).toBeCloseTo(s.scaled.skew, 10);
      expect(s.scaled.skew).toBeCloseTo(s.skew, 10);
    }
  });
  it('sinav band fractions follow the 68-95-99.7 rule', () => {
    const s = SERIES.sinav;
    expect(s.mean).toBeGreaterThanOrEqual(69.5); expect(s.mean).toBeLessThanOrEqual(70.5);
    expect(s.std).toBeGreaterThanOrEqual(9.5); expect(s.std).toBeLessThanOrEqual(10.5);
    expect(Math.abs(s.skew)).toBeLessThan(0.2);
    const ranges = [[0.65, 0.71], [0.93, 0.97], [0.99, 1]];
    s.band.forEach((b, i) => {
      expect(b.count / 200).toBeGreaterThanOrEqual(ranges[i][0]);
      expect(b.count / 200).toBeLessThanOrEqual(ranges[i][1]);
    });
  });
  it('cagri breaks the rule at one sigma', () => {
    const s = SERIES.cagri;
    expect(s.skew).toBeGreaterThan(1);
    expect(s.mean).toBeGreaterThan(s.median);
    expect(s.band[0].count / 200).toBeGreaterThanOrEqual(0.75);
    expect(s.band[0].count / 200 - NORM.bands[0][1]).toBeGreaterThan(0.06);
  });
  it('fixed lesson values match scipy and the sample', () => {
    const s = SERIES.sinav; const f = SINAV_FIXED;
    expect(normCdf(f.b, s.mean, s.std) - normCdf(f.a, s.mean, s.std)).toBeCloseTo(f.area, 7);
    expect(s.values.filter((x) => x >= f.a && x <= f.b)).toHaveLength(f.count);
    expect((f.x - mean(s.values)) / std(s.values)).toBeCloseTo(f.z, 10);
    expect(normCdf(f.z, 0, 1)).toBeCloseTo(f.phi, 7);
    NORM.bands.forEach(([k, area]) => expect(normCdf(k, 0, 1) - normCdf(-k, 0, 1)).toBeCloseTo(area, 7));
  });
});
