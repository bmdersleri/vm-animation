import { describe, expect, it } from 'vitest';
import { averagePrecision, bestThreshold, classify, curvePoints, rocAuc, type ScoredSample } from '../../../src/concepts/degerlendirme/curves';

const tied: ScoredSample[] = [
  { id: 'a', actual: 1, score: .8 }, { id: 'b', actual: 0, score: .8 },
  { id: 'c', actual: 1, score: .2 }, { id: 'd', actual: 0, score: .1 },
];

describe('threshold curves', () => {
  it('moves tied scores together with inclusive >= and an explicit none endpoint', () => {
    expect(classify(tied, .8)).toEqual({ tn: 1, fp: 1, fn: 1, tp: 1 });
    expect(classify(tied, 'none')).toEqual({ tn: 2, fp: 0, fn: 2, tp: 0 });
    expect(classify(tied, 0)).toEqual({ tn: 0, fp: 2, fn: 0, tp: 2 });
    expect(curvePoints(tied).map(p => p.threshold)).toEqual(['none', .8, .2, .1]);
    expect(curvePoints(tied)[0].precision).toBeNull();
  });
  it('integrates ROC trapezoids and AP recall steps without interpolating PR', () => {
    expect(rocAuc(tied)).toBe(.625);
    expect(averagePrecision(tied)).toBeCloseTo(7 / 12, 14);
    expect(rocAuc([...tied].reverse())).toBe(.625);
  });
  it('returns undefined areas for absent actual classes', () => {
    expect(rocAuc([])).toBeNull();
    expect(averagePrecision([])).toBeNull();
    expect(rocAuc([tied[0]])).toBeNull();
    expect(rocAuc([tied[1]])).toBeNull();
    expect(averagePrecision([tied[1]])).toBeNull();
    expect(averagePrecision([tied[0]])).toBe(1);
  });
  it('selects costs from validation candidates and prefers higher thresholds on ties', () => {
    expect(bestThreshold(tied, 1, 1)).toBe(.2);
    expect(bestThreshold(tied, 0, 0)).toBe('none');
    expect(bestThreshold([], 1, 1)).toBe('none');
    expect(bestThreshold(tied, 10, 1)).toBe('none');
    expect(bestThreshold(tied, 1, 10)).toBe(.2);
  });
  it.each([-1, 1.1, NaN, Infinity])('rejects invalid probabilities and thresholds %s', score => {
    const samples = [{ id: 'x', actual: 1 as const, score }];
    expect(() => classify(samples, .5)).toThrow();
    expect(() => curvePoints(samples)).toThrow();
    expect(() => rocAuc(samples)).toThrow();
    expect(() => averagePrecision(samples)).toThrow();
    expect(() => bestThreshold(samples, 1, 1)).toThrow();
    expect(() => classify(tied, score)).toThrow();
  });
  it('rejects malformed actual classes, duplicate ids, and invalid cost even on empty data', () => {
    expect(() => classify([{ id: 'x', actual: 2, score: .5 }] as unknown as ScoredSample[], .5)).toThrow();
    expect(() => classify([tied[0], tied[0]], .5)).toThrow();
    expect(() => bestThreshold([], -1, 1)).toThrow();
    expect(() => bestThreshold([], 1, NaN)).toThrow();
  });
});
