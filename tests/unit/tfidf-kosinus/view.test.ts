import { describe, it, expect } from 'vitest';
import { stepIndex } from '../../../src/core/player';
import { BOOK } from '../../../src/concepts/metin/data';
import { tokenize } from '../../../src/concepts/metin/tokenize';
import { tfidfKosinusScenario as sc, type TfidfParams } from '../../../src/concepts/tfidf-kosinus/scenario';
import { deriveTfidfView } from '../../../src/concepts/tfidf-kosinus/view';

const view = (id: string, over: Partial<TfidfParams> = {}) => deriveTfidfView(stepIndex(sc, id), { ...sc.defaults, ...over });
const close = (a: number, b: number, tol = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(tol);

describe('tfidf-kosinus view', () => {
  it('step 1 tokens come from tokenize', () => {
    const v = view('token');
    expect(v.kind).toBe('tokens');
    expect(v.tokens!.chips.map((c) => c.text)).toEqual(tokenize(BOOK.kod01.text).tokens);
    expect(v.tokens!.chips.map((c) => c.text)).toEqual(BOOK.kod01.tokens);
    expect(v.tokens!.raw!.map((c) => c.ch).join('')).toBe(BOOK.kod01.text);
    expect(v.tokens!.raw!.find((c) => c.ch === '3')!.state).toBe('gone');
    expect(v.tokens!.raw!.find((c) => c.ch === 'İ')!.state).toBe('lower');
    expect(v.strip).toContain('re.sub');
  });

  it('step 3 stop words come from the step params', () => {
    const v = view('stop-word', { stop: true });
    expect(v.tokens!.chips.filter((c) => c.dropped).map((c) => c.text)).toEqual(['çok']);
    expect(v.tokens!.counter!.map((c) => c.term)).not.toContain('çok');
    expect(v.tokens!.warn!.kept).toEqual(['hizmet', 'kötü']);
    expect(v.strip).toContain("Counter({'internetim': 1");
  });

  it('step 4 table is the book count matrix', () => {
    const v = view('bow');
    const spec = v.table!.tables[0].spec;
    expect(spec.cols).toEqual(BOOK.kod02.vocab);
    expect(spec.cells.map((r) => r.map((c) => c.value))).toEqual(BOOK.kod02.bow);
  });

  it('step 5 bars carry df and the book idf', () => {
    const v = view('idf');
    const bars = v.table!.bars!;
    expect(bars).toHaveLength(BOOK.kod02.vocab.length);
    bars.forEach((b, j) => close(b.value, BOOK.kod02.idf[j]));
    expect(bars.find((b) => b.id === 'destek')!.text).toBe('df 2 · 1,288');
    expect(v.strip).toContain('ln(4 / 2) + 1 = 1,693');
    expect(v.strip).toContain('ln(3 / 1) = 1,099');
  });

  it('step 6 row zero norm matches sklearn', () => {
    const last = view('tfidf-norm', { scan: 6 });
    const spec = last.table!.tables[0].spec;
    BOOK.kod02.tfidf[0].forEach((want, j) => close(spec.cells[0][j].value, want));
    expect(last.strip).toContain('3,008');
    expect(last.strip).toContain('1,288 / 3,008 = 0,428');
    const raw = view('tfidf-norm', { scan: 5 });
    BOOK.kod02.raw[0].forEach((want, j) => close(raw.table!.tables[0].spec.cells[0][j].value, want));
    expect(raw.strip).toContain('‖v‖ = √(Σ ham ağırlık²) = 3,008');
  });

  it('step 6 scan reveals the cells of row zero one by one', () => {
    const shown = (scan: number) =>
      view('tfidf-norm', { scan }).table!.tables[0].spec.cells[0].filter((c) => c.state !== 'hidden' && c.value > 0).length;
    expect([0, 1, 2, 3, 4].map(shown)).toEqual([0, 1, 2, 3, 4]);
  });

  it('step 8 ranks the query and finds the shared term', () => {
    const v = view('kosinus');
    expect(v.vectors!.list.map((r) => r.score)).toEqual(['1,000', '0,143', '0,000']);
    expect(v.vectors!.list[1].note).toBe('ortak terim: internet');
    expect(v.vectors!.list[2].note).toBe('ortak terim yok');
    expect(v.vectors!.terms).toEqual(['internet', 'bağlantı']);
    expect(v.strip).toContain('ortak terim "internet": 0,402 · 0,355 = 0,143');
    const [a, b] = v.vectors!.arrows;
    close(a.x, BOOK.kod03.tfidf[0][BOOK.kod03.vocab.indexOf('internet')]);
    close(b.y, BOOK.kod03.tfidf[1][BOOK.kod03.vocab.indexOf('bağlantı')]);
    close(a.y, 0);
    // the arc is the projection's angle; the true angle is arccos of the cosine in the data
    const cos = BOOK.kod03.scores[1];
    const trueDeg = (Math.acos(cos) * 180) / Math.PI;
    close(v.vectors!.trueAngle!, trueDeg, 1e-4);
    expect(Math.round(trueDeg * 10) / 10).toBe(81.8);
    expect(v.vectors!.angle!.text).toBe('izdüşümde 53°');
    close(v.vectors!.angle!.deg, (Math.atan2(b.y, b.x) * 180) / Math.PI, 1e-6);
    expect(v.strip).toContain('açı = arccos(0,143) = 81,8°');
    expect(v.strip).toContain('izdüşümde 53°');
  });

  it('step 9 doubled query keeps cosine one', () => {
    const v = view('uzunluk-yon');
    expect(v.vectors!.list[0].score).toBe('1,000');
    expect(v.vectors!.list[1].score).toBe('2,000');
    const [q, d] = v.vectors!.arrows;
    close(d.x, 2 * q.x);
    close(d.y, 2 * q.y);
    expect(v.vectors!.angle!.text).toBe('izdüşümde 0°');
    // the plane shows a two-term slice: (1,1) to (2,2) is sqrt(2), the list distance runs over all terms
    close(v.vectors!.sliceDistance!, Math.SQRT2);
    expect(v.vectors!.list[1].note).toContain('tüm terimlerde');
    expect(v.vectors!.list[1].note).toContain('1,414');
    expect(v.strip).toContain('düzlemde yalnız iki terim: 1,414');
    expect(v.strip).toContain('tüm terimler) → 0,000 · 2,000');
    expect(v.vectors!.terms).toEqual(['internet', 'bağlantısı']);
  });

  it('step 10 cards read the book pair and the separate vocabularies', () => {
    const v = view('ortak-sozluk');
    expect(v.cards!.pair.cos).toBe('0,603');
    expect(v.cards!.separate.pairs.every(([a, b]) => a !== b)).toBe(true);
    expect(v.cards!.separate.aligned).toBe('1,000');
    expect(v.cards!.links.map((l) => l.href)).toEqual(['../duygu-analizi/', '../k-means/']);
  });

  it('no step prints NaN or Infinity, even for empty documents', () => {
    const empties: Partial<TfidfParams> = { text: '', docs: ['', '', ''], comments: ['', '', ''], extra: '' };
    for (let i = 0; i < sc.steps.length; i += 1) {
      for (const over of [{}, empties]) {
        const v = deriveTfidfView(i, { ...sc.defaults, ...over, scan: 3 });
        expect(JSON.stringify(v)).not.toMatch(/NaN|Infinity|undefined/);
      }
    }
  });
});
