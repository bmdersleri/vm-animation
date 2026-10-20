import { describe, it, expect } from 'vitest';
import { spam, gauss, WORDS } from '../../../src/concepts/naive-bayes/data';
import fixture from '../../fixtures/naive-bayes_sklearn.json';

describe('naive-bayes data', () => {
  it('has an 8-word dictionary', () => {
    expect(spam.words).toHaveLength(8);
    expect(WORDS).toHaveLength(8);
    expect(spam.docs).toEqual([150, 100]);
  });

  it('has class totals 300 (normal) and 200 (spam)', () => {
    expect(spam.words.reduce((s, w) => s + w.n[0], 0)).toBe(300);
    expect(spam.words.reduce((s, w) => s + w.n[1], 0)).toBe(200);
  });

  it('has the book GaussianNB training set', () => {
    expect(gauss.train).toHaveLength(154);
    expect(gauss.firstTest).toEqual({ t: 18, c: 1 });
    for (const r of gauss.train) {
      expect(Number.isInteger(r.t)).toBe(true);
      expect(Number.isInteger(r.c)).toBe(true);
      expect([0, 1]).toContain(r.y);
      expect(Math.abs(r.jy)).toBeLessThanOrEqual(0.25);
    }
  });

  it('fixture priors and first-test posterior match the book', () => {
    expect(fixture.gaussian.prior[0]).toBeCloseTo(0.383, 3);
    expect(fixture.gaussian.prior[1]).toBeCloseTo(0.617, 3);
    const first = fixture.gaussian.cases[0];
    expect(first.x).toEqual([18, 1]);
    expect(first.proba[0]).toBeCloseTo(0.815, 3);
    expect(first.proba[1]).toBeCloseTo(0.185, 3);
  });

  it('fixture has multinomial, alpha0 and gaussian cases', () => {
    expect(fixture.multinomial.length).toBeGreaterThanOrEqual(10);
    expect(fixture.alpha0).toHaveLength(fixture.multinomial.length);
    expect(fixture.gaussian.cases).toHaveLength(11);
  });
});
