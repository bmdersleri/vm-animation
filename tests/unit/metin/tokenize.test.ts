import { describe, expect, it } from 'vitest';
import fixture from '../../fixtures/metin_sklearn.json';
import { clean, tokenize } from '../../../src/concepts/metin/tokenize';

const stop = new Set<string>(fixture.tokenize.stopWords);

describe('metin tokenize', () => {
  it('tokenize matches python on the twenty fixture comments', () => {
    expect(fixture.tokenize.examples).toHaveLength(20);
    for (const ex of fixture.tokenize.examples) {
      expect(tokenize(ex.text).tokens, ex.text).toEqual(ex.tokens);
      expect(tokenize(ex.text).dropped, ex.text).toEqual([]);
      const filtered = tokenize(ex.text, stop);
      expect(filtered.tokens, ex.text).toEqual(ex.kept);
      expect(filtered.dropped, ex.text).toEqual(ex.dropped);
    }
  });

  it('turkish capital i becomes dotted i', () => {
    expect(clean('İnternet IŞIK')).toBe('internet ışık');
    expect(tokenize('İnternetim 3 gündür çok yavaş; destek ekibi dönüş yapmadı!').tokens).toEqual([
      'internetim', 'gündür', 'çok', 'yavaş', 'destek', 'ekibi', 'dönüş', 'yapmadı',
    ]);
    expect(tokenize('ISI İYİ').tokens).toEqual(['ısı', 'iyi']);
  });

  it('stop words go to dropped in order', () => {
    const r = tokenize('çok yavaş ve destek ama değil', new Set(['ve', 'ama', 'çok']));
    expect(r.tokens).toEqual(['yavaş', 'destek', 'değil']);
    expect(r.dropped).toEqual(['çok', 've', 'ama']);
  });
});
