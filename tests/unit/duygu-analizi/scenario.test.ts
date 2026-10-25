import { describe, it, expect } from 'vitest';
import { formatNumber as f } from '../../../src/core/plot/format';
import { BOOK, DRIFT, MODELS } from '../../../src/concepts/metin/data';
import { duyguAnaliziScenario as sc } from '../../../src/concepts/duygu-analizi/scenario';
import { DRIFT_COMMENT, HATALAR, NEGATION } from '../../../src/concepts/duygu-analizi/calc';

const step = (id: string) => sc.steps.find((s) => s.id === id)!;
const uni = MODELS['uni-keep-train'];

describe('duygu-analizi scenario', () => {
  it('step ids follow the spec', () => {
    expect(sc.steps.map((s) => s.id)).toEqual([
      'gorev',
      'boru-hatti',
      'kelime-agirlik',
      'yorum-skor',
      'test-sonuc',
      'bigram',
      'degil-tuzagi',
      'sizinti',
      'sozluk-kaymasi',
      'hata-ayiklama',
    ]);
    expect(sc.defaults).toEqual({ bigram: null, degilStop: null, leaky: null, topN: 10, text: null, fixed: false });
  });

  it('step texts read numbers from data', () => {
    expect(step('gorev').text).toContain('400 yorum, 200 olumlu ve 200 olumsuz');
    expect(step('gorev').text).toContain('Duygu etiketi, müşteri kaybı etiketi değildir.');
    expect(step('boru-hatti').text).toContain('300 eğitim (150 olumlu, 150 olumsuz) ve 100 test (50 olumlu, 50 olumsuz)');
    expect(step('boru-hatti').text).toContain(`${uni.vocabSize} terim`);
    expect(step('kelime-agirlik').text).toMatch(/en olumlu terim "[^"]+" \(\+\d,\d\d\)/);
    expect(step('yorum-skor').text).toContain(BOOK.kod04.newComment);
    expect(step('yorum-skor').text).toContain(`p = ${f(BOOK.kod04.pNew, 3)}`);
    expect(step('yorum-skor').text).toContain('p = 0,542');
    expect(step('test-sonuc').text).toContain(`doğruluk %${f(uni.accuracy * 100, 1)}`);
    expect(step('test-sonuc').text).toContain('test 2 yorum, doğruluk 0,50');
    expect(step('bigram').text).toContain(NEGATION.text);
    expect(step('bigram').text).toContain(`${f(uni.negAccuracy * 100, 1)}`);
    expect(step('degil-tuzagi').text).toContain('[hizmet, kötü] kalır');
    expect(step('degil-tuzagi').text).toContain(f(MODELS['bi-drop-train'].negAccuracy * 100, 1));
    expect(step('sizinti').text).toContain(`${MODELS['uni-keep-all'].testOnly.length} terim`);
    expect(step('sizinti').text).toContain(MODELS['uni-keep-all'].testOnly[0]);
    expect(step('sozluk-kaymasi').text).toContain(f(DRIFT.oovRateNew * 100, 1));
    expect(step('sozluk-kaymasi').text).toContain(DRIFT_COMMENT.text);
    expect(step('hata-ayiklama').text).toContain(`${HATALAR.length} hata`);
  });

  it('numbers are never followed by an apostrophe suffix and no text prints NaN', () => {
    for (const s of sc.steps) {
      expect(s.text).not.toMatch(/\d'/);
      expect(s.text).not.toMatch(/NaN|undefined|Infinity/);
      expect(s.text).not.toMatch(/\bemin\b/i);
    }
  });

  it('no step resets the lab model choice', () => {
    // a step's `params` would overwrite a Lab choice on entry; the page keeps every Ders model in the view instead
    for (const s of sc.steps) expect(s.params, s.id).toBeUndefined();
  });
});
