import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOOK, CORPUS, DRIFT, MODELS, STOP_WORDS } from '../../../src/concepts/metin/data';
import { tokenize } from '../../../src/concepts/metin/tokenize';

const round = (v: number, d: number): number => Math.round(v * 10 ** d) / 10 ** d;

describe('metin data', () => {
  it('book numbers come from data', () => {
    const k2 = BOOK.kod02;
    expect(k2.vocab).toHaveLength(9);
    expect(k2.tfidf[0].map(v => round(v, 2))).toEqual([0, 0.43, 0, 0, 0.43, 0, 0.56, 0.56, 0]);
    expect(round(k2.idf[k2.vocab.indexOf('destek')], 4)).toBe(1.2877);
    expect(round(k2.idf[k2.vocab.indexOf('yavaş')], 4)).toBe(1.6931);
    expect(round(k2.norms[0], 3)).toBe(3.008);
    expect(BOOK.kod03.scores.map(v => round(v, 2))).toEqual([1, 0.14, 0]);
    expect(BOOK.kod04.accuracy).toBe(0.5);
    expect(BOOK.kod04.predictions).toEqual([1, 1]);
    expect(BOOK.kod04.testLabels).toEqual([0, 1]);
    expect(round(BOOK.kod04.pNew, 3)).toBe(0.542);
    expect(round(BOOK.mini.p, 3)).toBe(0.5);
    expect(BOOK.mini.pred).toBe(1);
    expect(round(BOOK.cosPair.cos, 3)).toBe(0.603);
    expect(BOOK.kod01.tokens).toHaveLength(8);
    expect(tokenize(BOOK.kod01.text).tokens).toEqual(BOOK.kod01.tokens);
    expect(STOP_WORDS.has('çok')).toBe(true);
    expect(STOP_WORDS.size).toBe(8);
  });

  it('corpus split is stratified 75/25', () => {
    expect(CORPUS).toHaveLength(400);
    const train = CORPUS.filter(c => c.split === 'train');
    const test = CORPUS.filter(c => c.split === 'test');
    expect([train.length, test.length]).toEqual([300, 100]);
    expect([train.filter(c => c.label === 1).length, test.filter(c => c.label === 1).length]).toEqual([150, 50]);
    expect(CORPUS.filter(c => c.kind === 'olumsuzlama').length).toBeGreaterThanOrEqual(60);
    expect(new Set(CORPUS.map(c => c.text)).size).toBe(400);
    for (const c of CORPUS) {
      const n = tokenize(c.text).tokens.length;
      expect(n).toBeGreaterThanOrEqual(4);
      expect(n).toBeLessThanOrEqual(10);
    }
    expect(DRIFT.comments).toHaveLength(40);
    expect(DRIFT.novelTerms.length).toBeGreaterThanOrEqual(6);
    expect(DRIFT.allNew.length).toBeGreaterThanOrEqual(2);
  });

  it('keeping degil with bigrams beats dropping it on negations', () => {
    const keep = MODELS['bi-keep-train'];
    const drop = MODELS['bi-drop-train'];
    expect(keep.negN).toBeGreaterThan(10);
    expect(keep.negAccuracy).toBeGreaterThan(drop.negAccuracy);
    expect(MODELS['uni-keep-all'].testOnly.length).toBeGreaterThan(0);
    expect(MODELS['uni-keep-train'].testOnly).toEqual([]);
    for (const m of Object.values(MODELS)) {
      expect(m.vocab).toHaveLength(m.vocabSize);
      expect(m.idf).toHaveLength(m.vocabSize);
      expect(m.coef).toHaveLength(m.vocabSize);
      const mx = m.matrix;
      expect(mx.tn + mx.fp + mx.fn + mx.tp).toBe(100);
      expect(round((mx.tn + mx.tp) / 100, 6)).toBe(m.accuracy);
    }
  });

  it('drift oov rate is above the test rate', () => {
    expect(DRIFT.oovRateNew).toBeGreaterThan(DRIFT.oovRateTest);
    expect(DRIFT.model).toBe('uni-keep-train');
    expect(DRIFT.comments.every(c => c.p > 0 && c.p < 1)).toBe(true);
  });

  it('the README names the files make_metin_data.py writes where they are', () => {
    const line = fs.readFileSync('README.md', 'utf8').split('\n').find((l) => l.startsWith('- `make_metin_data.py`'))!;
    const paths = [...line.matchAll(/`([^`]+\.json)`/g)].map((m) => m[1]);
    expect(paths).toEqual(['src/concepts/metin/data/metin.json', 'tests/fixtures/metin_sklearn.json']);
    for (const p of paths) expect(fs.existsSync(p), p).toBe(true);
  });
});
