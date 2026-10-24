import { describe, it, expect } from 'vitest';
import { formatNumber as f } from '../../../src/core/plot/format';
import { BOOK } from '../../../src/concepts/metin/data';
import { tfidfKosinusScenario as sc } from '../../../src/concepts/tfidf-kosinus/scenario';

const step = (id: string) => sc.steps.find((s) => s.id === id)!;
const k2 = BOOK.kod02;

describe('tfidf-kosinus scenario', () => {
  it('step ids follow the spec', () => {
    expect(sc.steps.map((s) => s.id)).toEqual([
      'token',
      'turkce-karakter',
      'stop-word',
      'bow',
      'idf',
      'tfidf-norm',
      'yan-yana',
      'kosinus',
      'uzunluk-yon',
      'ortak-sozluk',
    ]);
    expect(sc.defaults.text).toBe(BOOK.kod01.text);
    expect(sc.defaults.docs).toEqual(BOOK.kod02.docs);
    expect(sc.defaults.comments).toEqual(BOOK.kod03.docs);
    expect(sc.defaults.scan).toBe(0);
  });

  it('step texts read numbers from data', () => {
    expect(step('token').text).toContain(`${BOOK.kod01.tokens.length} token kalır`);
    expect(step('token').text).toContain(BOOK.kod01.text);
    expect(step('turkce-karakter').text).toContain('"ba" ve "lant"');
    expect(step('turkce-karakter').text).toContain(`"${BOOK.kod01.naiveTokens[0]}"`);
    expect(step('stop-word').text).toContain('(8 sözcük)');
    expect(step('stop-word').text).toContain('çok');
    expect(step('bow').text).toContain(`${k2.docs.length} belge, ${k2.vocab.length} terim`);
    expect(step('bow').text).toContain('"destek" 0. ve 1. belgede 1');
    expect(step('bow').text).toContain('"yavaş" yalnız 0. belgede 1');
    // df 1 -> 1,693 and df 2 -> 1,288 as the book's matrix has them
    const idfOf = (df: number) => k2.idf[k2.df.indexOf(df)];
    expect(step('idf').text).toContain(`df 1 → ${f(idfOf(1), 3)}`);
    expect(step('idf').text).toContain(`df 2 → ${f(idfOf(2), 3)}`);
    expect(step('idf').text).toContain('1,693');
    expect(step('idf').text).toContain('1,288');
    expect(step('tfidf-norm').text).toContain(`norm ${f(k2.norms[0], 3)}`);
    expect(step('tfidf-norm').text).toContain('1 · 1,288; 1 · 1,693');
    expect(step('tfidf-norm').text).toContain('0,428 / 0,563');
    expect(step('yan-yana').text).toContain('(1 ve 1)');
    expect(step('yan-yana').text).toContain('(0,428 ve 0,563)');
    expect(step('kosinus').text).toContain('skorlar 1,000 / 0,143 / 0,000');
    expect(step('kosinus').text).toContain('0,402 · 0,355 = 0,143');
    expect(step('uzunluk-yon').text).toContain('kosinüs 1,000');
    expect(step('uzunluk-yon').text).toContain('0,000 iken 2,000 olur');
    expect(step('ortak-sozluk').text).toContain(`kosinüsü ${f(BOOK.cosPair.cos, 3)}`);
    expect(step('ortak-sozluk').text).toContain('0,603');
  });

  it('numbers are never followed by an apostrophe suffix and no text prints NaN', () => {
    for (const s of sc.steps) {
      expect(s.text).not.toMatch(/(?<!kod0)\d'/);
      expect(s.text).not.toMatch(/NaN|undefined|Infinity/);
    }
  });

  it('only step 3 and the step-6 sweep set parameters', () => {
    expect(sc.steps.filter((s) => s.params).map((s) => [s.id, s.params])).toEqual([['stop-word', { stop: true }]]);
    expect(step('tfidf-norm').sweep?.key).toBe('scan');
    expect(step('tfidf-norm').sweep?.count?.(sc.defaults)).toBe(6);
  });
});
