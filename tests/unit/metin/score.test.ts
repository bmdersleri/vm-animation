import { describe, expect, it } from 'vitest';
import fixture from '../../fixtures/metin_sklearn.json';
import { BOOK, CORPUS, DRIFT, MODELS } from '../../../src/concepts/metin/data';
import type { ModelKey } from '../../../src/concepts/metin/data';
import { score, sigmoid } from '../../../src/concepts/metin/score';

const KEYS = Object.keys(fixture.models) as ModelKey[];

describe('metin score', () => {
  it('score matches sklearn probabilities for all eight models', () => {
    expect(KEYS).toHaveLength(8);
    for (const key of KEYS) {
      const fx = fixture.models[key];
      expect(fx.testTexts).toHaveLength(30);
      fx.testTexts.forEach((text, i) => {
        const s = score(MODELS[key], text);
        expect(Math.abs(s.p - fx.probs[i]), `${key} #${i}`).toBeLessThan(1e-9);
        expect(Math.abs(s.z - fx.logits[i]), `${key} #${i}`).toBeLessThan(1e-9);
      });
    }
    const k4 = fixture.books.kod04;
    expect(Math.abs(score(BOOK.kod04.model, BOOK.kod04.newComment).p - k4.pNew)).toBeLessThan(1e-9);
    expect(Math.abs(score(BOOK.mini.model, BOOK.mini.comment).p - fixture.books.mini.p)).toBeLessThan(1e-9);
  });

  it('contributions sum to z minus intercept', () => {
    for (const key of KEYS) {
      const m = MODELS[key];
      for (const text of fixture.models[key].testTexts.slice(0, 10)) {
        const s = score(m, text);
        const sum = s.terms.reduce((a, t) => a + t.contribution, 0);
        expect(Math.abs(sum - (s.z - m.intercept))).toBeLessThan(1e-12);
        for (const t of s.terms) {
          expect(Math.abs(t.contribution - t.weight * t.coef)).toBeLessThan(1e-15);
        }
        expect(Math.abs(s.p - sigmoid(s.z))).toBeLessThan(1e-15);
      }
    }
  });

  it('drift comments match the fixture oov counts', () => {
    for (const key of KEYS) {
      const fx = fixture.models[key].new;
      fx.texts.forEach((text, i) => {
        const s = score(MODELS[key], text);
        expect(s.oov.length, `${key} ${text}`).toBe(fx.oov[i]);
        expect(Math.abs(s.p - fx.probs[i]), `${key} ${text}`).toBeLessThan(1e-9);
      });
    }
    // An all-new comment: empty vector, probability from the intercept only.
    const m = MODELS['uni-keep-train'];
    const text = DRIFT.comments[DRIFT.allNew[0]].text;
    const s = score(m, text);
    expect(s.terms).toEqual([]);
    expect(s.z).toBe(m.intercept);
    expect(s.p).toBeCloseTo(sigmoid(m.intercept), 15);
    expect(s.oov.length).toBe(s.tokens.length);
    // The stored drift rates are what the browser computes.
    const rate = (texts: readonly string[]): number => {
      let miss = 0;
      let total = 0;
      for (const t of texts) {
        const r = score(m, t);
        miss += r.oov.length;
        total += r.tokens.length;
      }
      return miss / total;
    };
    const testTexts = CORPUS.filter(c => c.split === 'test').map(c => c.text);
    expect(Math.abs(rate(testTexts) - DRIFT.oovRateTest)).toBeLessThan(1e-6);
    expect(Math.abs(rate(DRIFT.comments.map(c => c.text)) - DRIFT.oovRateNew)).toBeLessThan(1e-6);
  });

  it('empty and unknown comments never give NaN', () => {
    for (const text of ['', '   ', '!!! 123', 'x']) {
      const s = score(MODELS['bi-keep-train'], text);
      expect(Number.isFinite(s.z)).toBe(true);
      expect(Number.isFinite(s.p)).toBe(true);
      expect(s.terms).toEqual([]);
    }
  });
});
