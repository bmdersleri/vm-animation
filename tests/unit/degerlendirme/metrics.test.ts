import { describe, expect, it } from 'vitest';
import { allNegative, cost, metrics } from '../../../src/concepts/degerlendirme/metrics';

describe('evaluation metrics', () => {
  it('computes the teaching matrix directly from counts', () => {
    expect(metrics({ tn: 80, fp: 10, fn: 4, tp: 6 })).toEqual({
      accuracy: .86, precision: .375, recall: .6, f1: 12 / 26, specificity: 80 / 90,
    });
  });
  it('preserves undefined ratios and defines zero F1 when there are errors', () => {
    expect(metrics({ tn: 0, fp: 0, fn: 0, tp: 0 })).toEqual({
      accuracy: null, precision: null, recall: null, f1: null, specificity: null,
    });
    expect(metrics({ tn: 8, fp: 0, fn: 2, tp: 0 })).toMatchObject({ precision: null, recall: 0, f1: 0 });
  });
  it('derives the all-negative baseline from the same actual population', () => {
    expect(allNegative({ tn: 80, fp: 10, fn: 4, tp: 6 })).toEqual({ tn: 90, fp: 0, fn: 10, tp: 0 });
    expect(cost({ tn: 80, fp: 10, fn: 4, tp: 6 }, 2, 5)).toBe(40);
  });
  it.each([-1, .5, NaN, Infinity])('rejects invalid counts %s at every public boundary', value => {
    const c = { tn: value, fp: 0, fn: 0, tp: 0 };
    expect(() => metrics(c)).toThrow();
    expect(() => allNegative(c)).toThrow();
    expect(() => cost(c, 1, 1)).toThrow();
  });
  it.each([-1, NaN, Infinity])('rejects invalid costs %s', value => {
    expect(() => cost({ tn: 1, fp: 1, fn: 1, tp: 1 }, value, 1)).toThrow();
    expect(() => cost({ tn: 1, fp: 1, fn: 1, tp: 1 }, 1, value)).toThrow();
  });
});
