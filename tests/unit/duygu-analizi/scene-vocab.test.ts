// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { formatNumber as f } from '../../../src/core/plot/format';
import { DRIFT, MODELS } from '../../../src/concepts/metin/data';
import { score, sigmoid } from '../../../src/concepts/metin/score';
import { driftRates, DRIFT_COMMENT } from '../../../src/concepts/duygu-analizi/calc';
import { stepIndex } from '../../../src/core/player';
import { duyguAnaliziScenario as sc } from '../../../src/concepts/duygu-analizi/scenario';
import { VocabScene } from '../../../src/concepts/duygu-analizi/scene-vocab';
import { deriveSentimentView, MAX_VOCAB_CHIPS } from '../../../src/concepts/duygu-analizi/view';
import { go, setup, texts } from './harness';

const leaky = MODELS['uni-keep-all'];
const clean = MODELS['uni-keep-train'];

describe('vocabulary strip (steps 8-9)', () => {
  it('step 8 counts test-only terms in the leaky vocabulary', () => {
    const { el, player } = setup();
    go(player, 'sizinti');
    expect(el.querySelector('.sa-stage')!.getAttribute('data-view')).toBe('vocab');
    expect(texts(el, '.vocab-test-only .vocab-term')).toEqual(leaky.testOnly);
    expect(el.querySelectorAll('.vocab-test-only.is-oov')).toHaveLength(0);
    // the IDF of each is the leaky model's, with three decimals like page 1
    const first = el.querySelector('.vocab-test-only')!;
    const j = leaky.vocab.indexOf(leaky.testOnly[0]);
    expect(first.querySelector('.vocab-idf')!.textContent).toBe(` IDF ${f(leaky.idf[j], 3)}`);
    expect(el.querySelector('.vocab-count[data-count="train"]')!.textContent).toContain(String(clean.vocabSize));
    expect(el.querySelector('.vocab-count[data-count="all"]')!.textContent).toContain(String(leaky.vocabSize));
    expect(el.querySelector('.vocab-count[data-count="test-only"]')!.textContent).toContain(String(leaky.testOnly.length));
    expect(el.querySelector('.vocab-acc[data-model="leaky"]')!.textContent).toContain(f(leaky.accuracy * 100, 1));
    expect(el.querySelector('.vocab-acc[data-model="clean"]')!.textContent).toContain(f(clean.accuracy * 100, 1));
    expect(el.querySelector('.vocab-gap')!.textContent).toContain('test artık görülmemiş veri değil');
  });

  it('step 8 caps the chips at 24 and counts the rest', () => {
    // step 8 keeps its unigram model (7 test-only terms), so the cap is checked on a longer list drawn by the scene
    const host = document.createElement('div');
    document.body.append(host);
    const scene = new VocabScene(host);
    const all = MODELS['bi-keep-all'].testOnly;
    expect(all.length).toBeGreaterThan(MAX_VOCAB_CHIPS);
    const v = deriveSentimentView(stepIndex(sc, 'sizinti'), sc.defaults);
    const terms = all.slice(0, MAX_VOCAB_CHIPS).map((term) => ({ term, idf: null }));
    scene.update({ ...v, vocab: { ...v.vocab!, terms, more: all.length - terms.length } }, 0);
    expect(host.querySelectorAll('.vocab-test-only')).toHaveLength(24);
    expect(host.querySelector('.vocab-more')!.textContent).toBe(`ve ${all.length - 24} terim daha`);
    scene.destroy();
  });

  it('step 9 unknown-only comment uses the intercept', () => {
    const { el, player } = setup();
    go(player, 'sozluk-kaymasi');
    expect(el.querySelector('.sa-stage')!.getAttribute('data-view')).toBe('score');
    const sc = score(clean, DRIFT_COMMENT.text);
    expect(sc.terms).toHaveLength(0);
    expect(el.querySelectorAll('.token-chip.is-oov')).toHaveLength(sc.tokens.length);
    expect(el.querySelector('.prob-value')!.textContent).toBe(f(sigmoid(clean.intercept), 3));
    expect(el.querySelector('.z-line')!.textContent).toContain(f(clean.intercept, 3));
    expect(el.querySelector('.panel-note')!.textContent).toContain('yalnız kesişimden');
    // the drift strip: out-of-vocabulary rates of the training test part and the new period
    const rows = el.querySelectorAll('.drift-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain(f(DRIFT.oovRateTest * 100, 1));
    expect(rows[1].textContent).toContain(f(DRIFT.oovRateNew * 100, 1));
    expect(rows[1].textContent).toContain(`${DRIFT.oovTokensNew} / ${DRIFT.tokensNew}`);
  });

  it('live drift rates equal the generator for the unigram model', () => {
    const r = driftRates('uni-keep-train');
    expect(r.test.rate).toBeCloseTo(DRIFT.oovRateTest, 6);
    expect(r.new.rate).toBeCloseTo(DRIFT.oovRateNew, 6);
    expect(r.new.oov).toBe(DRIFT.oovTokensNew);
    expect(r.test.tokens).toBe(DRIFT.tokensTest);
  });
});
