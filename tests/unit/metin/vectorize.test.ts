import { describe, expect, it } from 'vitest';
import fixture from '../../fixtures/metin_sklearn.json';
import {
  analyze, cosine, countMatrix, fitVocab, idfOf, l2, tfidfMatrix,
} from '../../../src/concepts/metin/vectorize';
import { CORPUS, MODELS } from '../../../src/concepts/metin/data';
import type { ModelKey } from '../../../src/concepts/metin/data';

const close = (a: readonly (readonly number[])[], b: readonly (readonly number[])[], tol: number): void => {
  expect(a).toHaveLength(b.length);
  a.forEach((row, i) => {
    expect(row).toHaveLength(b[i].length);
    row.forEach((v, j) => expect(Math.abs(v - b[i][j])).toBeLessThan(tol));
  });
};

const dense = (sparse: readonly (readonly (readonly number[])[])[], width: number): number[][] =>
  sparse.map(row => {
    const out = new Array<number>(width).fill(0);
    for (const [col, val] of row) {
      out[col] = val;
    }
    return out;
  });

const DEGIL = new Set(['değil']);

describe('metin vectorize', () => {
  it('tfidf matches sklearn on book examples and corpus', () => {
    for (const k of ['kod02', 'kod03'] as const) {
      const b = fixture.books[k];
      const m = tfidfMatrix(b.docs);
      expect(m.vocab).toEqual(b.vocab);
      m.idf.forEach((v, i) => expect(Math.abs(v - b.idf[i])).toBeLessThan(1e-12));
      close(m.rows, b.tfidf, 1e-12);
    }
    const b2 = fixture.books.kod02;
    expect(countMatrix(b2.docs, b2.vocab, 1)).toEqual(b2.bow);
    const cp = fixture.books.cosPair;
    const mp = tfidfMatrix(cp.docs);
    expect(mp.vocab).toEqual(cp.vocab);
    close(mp.rows, cp.tfidf, 1e-12);
    expect(Math.abs(cosine(mp.rows[0], mp.rows[1]) - cp.cos)).toBeLessThan(1e-12);

    const train = CORPUS.filter(c => c.split === 'train').map(c => c.text);
    const all = CORPUS.map(c => c.text);
    for (const key of Object.keys(fixture.models) as ModelKey[]) {
      const fx = fixture.models[key];
      const model = MODELS[key];
      const stop = model.dropDegil ? DEGIL : undefined;
      const fit = model.leaky ? all : train;
      const vocab = fitVocab(fit, model.ngram, stop);
      expect(vocab, key).toEqual(fx.vocab);
      const idf = idfOf(fit, vocab, model.ngram, stop);
      idf.forEach((v, i) => expect(Math.abs(v - fx.idf[i]), key).toBeLessThan(1e-12));
      const trainM = tfidfMatrix(fx.trainTexts, vocab, idf, model.ngram, stop);
      close(trainM.rows, dense(fx.trainRows, vocab.length), 1e-12);
      const testM = tfidfMatrix(fx.testTexts, vocab, idf, model.ngram, stop);
      close(testM.rows, dense(fx.testRows, vocab.length), 1e-12);
    }
  });

  it('vocabulary follows code point order', () => {
    const vocab = fitVocab(['çay şeker ağa zeytin öğle ıslak iyi', 'bir ay'], 1);
    // Python: sorted(...) gives the same order (ç < ö < ğ < ı < ş by code point).
    expect(vocab).toEqual(['ay', 'ağa', 'bir', 'iyi', 'zeytin', 'çay', 'öğle', 'ıslak', 'şeker']);
  });

  it('bigrams join with one space', () => {
    for (const ex of fixture.analyze) {
      expect(analyze(ex.text, ex.ngram as 1 | 2, ex.drop ? DEGIL : undefined), ex.text).toEqual(ex.terms);
    }
    expect(analyze('hizmet kötü değil', 2)).toEqual(['hizmet', 'kötü', 'değil', 'hizmet kötü', 'kötü değil']);
    expect(analyze('hizmet kötü değil', 2, DEGIL)).toEqual(['hizmet', 'kötü', 'hizmet kötü']);
  });

  it('zero vector gives cosine zero and intercept-only probability', () => {
    expect(cosine([0, 0, 0], [1, 2, 3])).toBe(0);
    expect(cosine([0, 0], [0, 0])).toBe(0);
    expect(l2([3, 4])).toBe(5);
    const m = tfidfMatrix(['fiber esim'], ['destek', 'internet'], [1.5, 1.2], 1);
    expect(m.rows[0]).toEqual([0, 0]);
    expect(m.oov).toEqual([2]);
  });

  it('transform drops and counts out-of-vocabulary terms', () => {
    const vocab = ['destek', 'internet'];
    const idf = [2, 1];
    const m = tfidfMatrix(['internet internet destek fiber esim mesh', 'destek'], vocab, idf, 1);
    expect(m.oov).toEqual([3, 0]);
    const n = Math.hypot(2 * 1, 1 * 2);
    expect(Math.abs(m.rows[0][0] - 2 / n)).toBeLessThan(1e-15);
    expect(Math.abs(m.rows[0][1] - 2 / n)).toBeLessThan(1e-15);
    expect(m.rows[1]).toEqual([1, 0]);
    expect(m.vocab).toEqual(vocab);
    expect(m.idf).toEqual(idf);
  });
});
