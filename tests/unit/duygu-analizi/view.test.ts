import { describe, it, expect } from 'vitest';
import { stepIndex } from '../../../src/core/player';
import { formatNumber as f } from '../../../src/core/plot/format';
import { BOOK, CORPUS, MODELS } from '../../../src/concepts/metin/data';
import { score } from '../../../src/concepts/metin/score';
import { duyguAnaliziScenario as sc, type SentimentParams } from '../../../src/concepts/duygu-analizi/scenario';
import { EMPTY_NOTE, OOV_NOTE, deriveSentimentView } from '../../../src/concepts/duygu-analizi/view';
import { NEGATION } from '../../../src/concepts/duygu-analizi/calc';

const at = (id: string, over: Partial<SentimentParams> = {}) => deriveSentimentView(stepIndex(sc, id), { ...sc.defaults, ...over });

describe('duygu-analizi view', () => {
  it('step 4 probability matches the model', () => {
    const v = at('yorum-skor').score!;
    expect(v.panels).toHaveLength(1);
    const m = score(MODELS['uni-keep-train'], BOOK.kod04.newComment);
    expect(v.panels[0].p!).toBeCloseTo(m.p, 12);
    expect(v.panels[0].pText).toBe(f(m.p, 3));
    // the contributions and the intercept add up to z
    const sum = v.panels[0].bars.reduce((s, b) => s + Number(b.attrs!.contribution), 0);
    expect(sum + MODELS['uni-keep-train'].intercept).toBeCloseTo(m.z, 12);
    expect(v.panels[0].compare).toEqual({ label: 'Kitabın 8 yorumluk modeli', p: '0,542' });
    expect(score(BOOK.kod04.model, BOOK.kod04.newComment).p).toBeCloseTo(BOOK.kod04.pNew, 5);
  });

  it('step 5 matrix matches the data', () => {
    const r = at('test-sonuc').result!;
    expect(r.matrix).toEqual(MODELS['uni-keep-train'].matrix);
    expect(r.metrics.find((m) => m.id === 'accuracy')!.value).toBe(`%${f(MODELS['uni-keep-train'].accuracy * 100, 1)}`);
    expect(r.book.accuracy).toBe('0,50');
    expect(r.book.testN).toBe(2);
    expect(r.book.rows.map((x) => x.id)).toEqual(['olumsuz', 'olumlu']);
    expect(r.book.rows[1].precision).toBe('0,50');
    expect(at('test-sonuc', { bigram: true }).result!.matrix).toEqual(MODELS['bi-keep-train'].matrix);
  });

  it('every Ders step uses the model the spec names', () => {
    const key = (id: string, over: Partial<SentimentParams> = {}) => (at(id, over).score ?? at(id, over).result ?? at(id, over).coef)!;
    expect((key('yorum-skor') as { panels: { model: string }[] }).panels[0].model).toBe('uni-keep-train');
    expect(at('bigram').score!.panels.map((p) => p.model)).toEqual(['uni-keep-train', 'bi-keep-train']);
    expect(at('degil-tuzagi').score!.panels[0].model).toBe('bi-drop-train');
    expect(at('sozluk-kaymasi').score!.panels[0].model).toBe('uni-keep-train');
    expect(at('kelime-agirlik').coef!.model).toBe('uni-keep-train');
    // a Lab choice holds on later steps; the leaky switch is read on step 8 only
    expect(at('sozluk-kaymasi', { bigram: true, leaky: true }).score!.panels[0].model).toBe('bi-keep-train');
    expect(at('degil-tuzagi', { degilStop: false }).score!.panels[0].model).toBe('bi-keep-train');
  });

  it('steps 6 and 7 show the negation flip', () => {
    const [uni, bi] = at('bigram').score!.panels;
    expect(uni.comment).toBe(NEGATION.text);
    expect(uni.p!).toBeLessThan(0.5);
    expect(bi.p!).toBeGreaterThan(0.5);
    const drop = at('degil-tuzagi').score!.panels[0];
    expect(drop.p!).toBeLessThan(0.5);
    expect(drop.chips.some((c) => c.dropped && c.text === 'değil')).toBe(true);
    expect(drop.compare!.p).toBe(f(bi.p!, 3));
  });

  it('step 9 comment is out of vocabulary and only the intercept speaks', () => {
    const pn = at('sozluk-kaymasi').score!.panels[0];
    expect(pn.chips.every((c) => c.oov)).toBe(true);
    expect(pn.bars).toHaveLength(0);
    expect(pn.note).toBe(OOV_NOTE);
    expect(pn.z).toBeCloseTo(MODELS['uni-keep-train'].intercept, 12);
  });

  it('an empty comment prints no probability and no NaN', () => {
    for (const id of ['yorum-skor', 'bigram', 'degil-tuzagi', 'sozluk-kaymasi']) {
      for (const text of ['', '   ', '!!! 123', 've']) {
        const v = at(id, { text });
        for (const pn of v.score!.panels) {
          expect(pn.p === null || Number.isFinite(pn.p)).toBe(true);
          if (text !== 've') {
            expect(pn.note).toBe(EMPTY_NOTE);
            expect(pn.p).toBeNull();
            expect(pn.pText).toBe('');
          }
        }
        expect(v.strip).not.toMatch(/NaN|Infinity|undefined/);
      }
    }
  });

  it('long comments sum the rest into one bar and keep z', () => {
    const text = CORPUS.slice(0, 12).map((c) => c.text).join(' ');
    const pn = at('yorum-skor', { text }).score!.panels[0];
    expect(pn.bars.length).toBeLessThanOrEqual(9);
    const m = score(MODELS['uni-keep-train'], text);
    const sum = pn.bars.reduce((s, b) => s + Number(b.attrs!.contribution), 0);
    expect(sum + pn.intercept).toBeCloseTo(m.z, 12);
  });

  it('flow and coefficient views read the corpus counts and the model', () => {
    const g = at('gorev').flow!;
    expect(g.bars.map((b) => b.value)).toEqual([200, 200]);
    expect(g.stages.map((s) => s.id)).toEqual(['yorum', 'temizle', 'tfidf', 'lojistik', 'etiket']);
    expect(g.samples!.length).toBe(4);
    const b = at('boru-hatti').flow!;
    expect(b.bars.map((x) => x.value)).toEqual([150, 150, 50, 50]);
    expect(b.code!.join('\n')).toContain('LogisticRegression(max_iter=1000)');
    const c = at('kelime-agirlik', { topN: 5 }).coef!;
    expect(c.pos).toHaveLength(5);
    expect(c.neg).toHaveLength(5);
    expect(at('kelime-agirlik', { topN: 99 }).coef!.pos).toHaveLength(20);
    expect(at('kelime-agirlik', { topN: Number.NaN }).coef!.pos).toHaveLength(10);
  });

  it('no step prints NaN, undefined or Infinity under odd parameters', () => {
    const odd: Partial<SentimentParams>[] = [{}, { text: '' }, { bigram: true, degilStop: true, leaky: true }, { topN: 0 }, { text: 'değil değil değil' }];
    for (let i = 0; i < sc.steps.length; i++) {
      for (const o of odd) {
        const v = deriveSentimentView(i, { ...sc.defaults, ...o });
        expect(v.strip).not.toMatch(/NaN|Infinity|undefined/);
        expect(JSON.stringify(v)).not.toMatch(/NaN|Infinity|undefined/);
      }
    }
  });

  it('step 4 explains the lean from the score: out-of-vocabulary words and the strongest negative terms', () => {
    const sc = score(MODELS['uni-keep-train'], BOOK.kod04.newComment);
    const pn = at('yorum-skor').score!.panels[0];
    const note = pn.note!;
    expect(sc.oov.length).toBeGreaterThan(0);
    for (const t of [...new Set(sc.oov)].slice(0, 2)) expect(note).toContain(`"${t}"`);
    expect(note).toContain('sözlük dışı');
    const neg = sc.terms.filter((t) => t.contribution < 0).sort((a, b) => a.contribution - b.contribution).slice(0, 2);
    expect(neg.length).toBeGreaterThan(0);
    for (const t of neg) expect(note).toContain(`"${t.term}"`);
    expect(note).not.toMatch(/NaN|undefined|emin/);
    // a learner's own text gets neither the explanation nor the book comparison
    const own = at('yorum-skor', { text: 'harika memnunum' }).score!.panels[0];
    expect(own.note).toBeNull();
    expect(own.compare).toBeNull();
  });

  it('step 7 text claims a fall only while the data shows one', () => {
    expect(MODELS['bi-drop-train'].negAccuracy).toBeLessThan(MODELS['bi-keep-train'].negAccuracy);
  });
});

