// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { formatNumber as f } from '../../../src/core/plot/format';
import { MODELS } from '../../../src/concepts/metin/data';
import { score } from '../../../src/concepts/metin/score';
import { degilBigram, NEGATION } from '../../../src/concepts/duygu-analizi/calc';
import { go, setup, texts } from './harness';

const probOf = (panel: Element): string => panel.querySelector('.prob-value')!.textContent!;

describe('compare scenes (steps 6-7)', () => {
  it('step 6 shows the bigram in the second model', () => {
    const { el, player } = setup();
    go(player, 'bigram');
    const uni = el.querySelector('.score-panel[data-panel="uni"]')!;
    const bi = el.querySelector('.score-panel[data-panel="bi"]')!;
    expect(uni.getAttribute('data-model')).toBe('uni-keep-train');
    expect(bi.getAttribute('data-model')).toBe('bi-keep-train');
    // the comment's "X değil" bigram is highlighted in the bigram model only
    const term = degilBigram(NEGATION.text)!;
    expect(texts(bi, '.token-chip.is-negation')).toEqual([term.term]);
    expect(uni.querySelectorAll('.token-chip.is-bigram')).toHaveLength(0);
    expect(bi.querySelectorAll('.token-chip.is-bigram').length).toBeGreaterThan(0);
    const bar = bi.querySelector(`.contrib-bar[data-term="${term.term}"]`)!;
    expect(Number(bar.getAttribute('data-coef'))).toBeCloseTo(term.coef, 12);
    expect(uni.querySelector(`.contrib-bar[data-term="${term.term}"]`)).toBeNull();
    // two probabilities from the two models, and the two negation-subset accuracies in the strip
    expect(probOf(uni)).toBe(f(score(MODELS['uni-keep-train'], NEGATION.text).p, 3));
    expect(probOf(bi)).toBe(f(score(MODELS['bi-keep-train'], NEGATION.text).p, 3));
    expect(uni.querySelector('.acc-line')!.textContent).toContain(f(MODELS['uni-keep-train'].negAccuracy * 100, 1));
    expect(bi.querySelector('.acc-line')!.textContent).toContain(f(MODELS['bi-keep-train'].negAccuracy * 100, 1));
    expect(bi.querySelector('.acc-line')!.textContent).toContain(`${MODELS['bi-keep-train'].negN} test yorumunda`);
    expect(el.querySelector('.score-scene')!.getAttribute('data-panels')).toBe('2');
  });

  it('step 7 drops degil and flips the prediction', () => {
    const { el, player } = setup();
    go(player, 'bigram');
    const kept = Number(probOf(el.querySelector('.score-panel[data-panel="bi"]')!).replace(',', '.'));
    go(player, 'degil-tuzagi');
    const panel = el.querySelector('.score-panel[data-panel="main"]')!;
    expect(panel.getAttribute('data-model')).toBe('bi-drop-train');
    expect(texts(panel, '.token-chip.is-dropped')).toEqual(['değil']);
    const dropped = Number(probOf(panel).replace(',', '.'));
    expect(kept).toBeGreaterThan(0.5);
    expect(dropped).toBeLessThan(0.5);
    expect(panel.querySelector('.prob-lean')!.textContent).toContain('olumsuz');
    expect(panel.querySelector('.compare-line')!.textContent).toContain(f(kept, 3));
    // the negation-subset accuracy falls: the panel names both
    const acc = panel.querySelector('.acc-line')!.textContent!;
    expect(acc).toContain(f(MODELS['bi-drop-train'].negAccuracy * 100, 1));
    expect(acc).toContain(`süzülmeden %${f(MODELS['bi-keep-train'].negAccuracy * 100, 1)}`);
  });

  it('the two panels share a row on a Lab-sized stage (745 px) and stack below 700 px', () => {
    for (const [w, wide] of [[745, 'true'], [600, 'false']] as const) {
      const { el, player } = setup(w, 540);
      go(player, 'bigram');
      expect(el.querySelector('.score-scene')!.getAttribute('data-wide'), String(w)).toBe(wide);
      for (const svg of el.querySelectorAll('.score-panel svg')) {
        expect(Number(svg.getAttribute('width'))).toBeLessThanOrEqual(w - 24 - 28);
      }
      document.body.replaceChildren();
    }
  });
});
