// @vitest-environment jsdom
import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../svg-stubs';
import { bindKeys } from '../../../src/core/keyboard';
import { formatNumber as f } from '../../../src/core/plot/format';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { DRIFT, MODELS } from '../../../src/concepts/metin/data';
import { score } from '../../../src/concepts/metin/score';
import { NEGATION, NEW_COMMENT } from '../../../src/concepts/duygu-analizi/calc';
import { DRIFT_PRESETS, mountSentimentParams, TEXT_PRESETS } from '../../../src/concepts/duygu-analizi/controls';
import { mountSentimentExtra } from '../../../src/concepts/duygu-analizi/extra';
import { duyguAnaliziScenario as sc } from '../../../src/concepts/duygu-analizi/scenario';
import { mountSentimentScene } from '../../../src/concepts/duygu-analizi/scene';
import { EMPTY_NOTE } from '../../../src/concepts/duygu-analizi/view';
import { labTextTests } from '../lab-text';

const css = fs.readFileSync('src/concepts/duygu-analizi/duygu-analizi.css', 'utf8');

const clean: (() => void)[] = [];
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  clean.splice(0).forEach((fn) => fn());
  document.body.replaceChildren();
  vi.useRealTimers();
});

function setup(w = 1280, h = 540) {
  const host = document.createElement('div');
  const el = document.createElement('div');
  document.body.append(host, el);
  const player = new StepPlayer(sc);
  mountSentimentParams(host, player);
  const scene = mountSentimentScene(el, player, 'lab', { durationScale: 0 });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { host, el, player };
}

const step = (id: string) => stepIndex(sc, id);
const ctl = <T extends HTMLElement = HTMLInputElement>(host: HTMLElement, key: string) => host.querySelector<T>(`[data-param=${key}]`)!;
const texts = (root: ParentNode, sel: string) => [...root.querySelectorAll(sel)].map((e) => e.textContent ?? '');

function type(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  vi.advanceTimersByTime(150);
}

function choose(input: HTMLSelectElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function flip(input: HTMLInputElement): void {
  input.checked = !input.checked;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** The controls shown at a step, as `param` names (a preset select folds into its text box). */
function visible(host: HTMLElement): string[] {
  return [...host.querySelectorAll<HTMLElement>('.ctl:not([data-off])')].map((c) => c.querySelector<HTMLElement>('[data-param]')!.dataset.param!);
}

// step 1 has no control (the flow strip does not depend on the model), so its lab text is not needed
labTextTests(sc.steps, [2, 3, 4, 5, 6, 7, 8, 9, 10]);

describe('duygu-analizi Lab controls', () => {
  it('only the step\'s controls are visible', () => {
    const { host, player } = setup();
    const shown: Record<string, string[]> = {
      'boru-hatti': ['bigram'],
      'kelime-agirlik': ['bigram', 'topN'],
      'yorum-skor': ['text', 'bigram', 'degilStop'],
      'test-sonuc': ['bigram'],
      // step 6 always compares unigram with bigram, so its bigram switch is hidden
      bigram: ['text', 'degilStop'],
      'degil-tuzagi': ['text', 'bigram', 'degilStop'],
      sizinti: ['leaky'],
      'sozluk-kaymasi': ['text-new', 'bigram', 'degilStop'],
      'hata-ayiklama': ['fixed'],
    };
    for (const [id, keys] of Object.entries(shown)) {
      player.goto(step(id));
      expect(visible(host), id).toEqual(keys);
      expect(host.hasAttribute('data-off'), id).toBe(false);
      // hidden controls are disabled too, so Tab skips them
      for (const input of host.querySelectorAll<HTMLInputElement>('[data-param]')) {
        const key = input.dataset.param!.replace(/-preset$/, '');
        expect(input.disabled, `${id} ${input.dataset.param}`).toBe(!keys.includes(key));
      }
    }
  });

  it('a step without controls hides the card', () => {
    const { host, player } = setup();
    expect(player.state.index).toBe(step('gorev'));
    expect(visible(host)).toEqual([]);
    expect(host.hasAttribute('data-off')).toBe(true);
    player.goto(step('boru-hatti'));
    expect(host.hasAttribute('data-off')).toBe(false);
    expect(css).toMatch(/\[data-mode='lab'\] \.params\[data-off\]\s*\{\s*display:\s*none/);
  });

  it('typing in the text box does not change the step', () => {
    const { host, player } = setup();
    player.goto(step('yorum-skor'));
    clean.push(bindKeys(window, player, { toggleFullscreen: vi.fn(), toggleHelp: vi.fn() }, []));
    const box = ctl(host, 'text');
    for (const key of ['ArrowRight', ' ', 'ArrowLeft', 'End', 'Home', 'p']) {
      const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      box.dispatchEvent(ev);
      expect(ev.defaultPrevented, key).toBe(false);
    }
    expect(player.state.index).toBe(step('yorum-skor'));
    expect(player.state.playing).toBe(false);
  });

  it('typing a comment rescored live', () => {
    const { host, el, player } = setup();
    player.goto(step('yorum-skor'));
    // the box starts with the step's own comment
    expect(ctl(host, 'text').value).toBe(NEW_COMMENT);
    const text = 'harika hizmet ama internet kötü';
    type(ctl(host, 'text'), text);
    expect(player.state.params.text).toBe(text);
    const sc4 = score(MODELS['uni-keep-train'], text);
    expect(texts(el, '.token-chip')).toEqual(sc4.tokens);
    expect(el.querySelector('.prob-value')!.textContent).toBe(f(sc4.p, 3));
    expect(el.querySelector('.z-line')!.textContent).toContain(f(sc4.z, 3));
    // a preset fills the box and the score
    choose(ctl<HTMLSelectElement>(host, 'text-preset'), '1');
    expect(ctl(host, 'text').value).toBe(TEXT_PRESETS[1].text);
    expect(el.querySelector('.prob-value')!.textContent).toBe(f(score(MODELS['uni-keep-train'], TEXT_PRESETS[1].text).p, 3));
    // the text stays on the next score steps
    player.goto(step('bigram'));
    expect(ctl(host, 'text').value).toBe(TEXT_PRESETS[1].text);
    expect(el.querySelector('.score-comment')!.textContent).toContain(TEXT_PRESETS[1].text);
  });

  it('the presets include the step\'s own comments and the drift presets are new-period comments', () => {
    expect(TEXT_PRESETS.map((p) => p.text)).toEqual(expect.arrayContaining([NEW_COMMENT, NEGATION.text]));
    expect(DRIFT_PRESETS.length).toBeGreaterThanOrEqual(3);
    const newPeriod = new Set(DRIFT.comments.map((c) => c.text));
    expect(DRIFT_PRESETS.every((p) => newPeriod.has(p.text))).toBe(true);
    const { host, el, player } = setup();
    player.goto(step('sozluk-kaymasi'));
    expect(ctl(host, 'text-new').value).toBe(DRIFT.comments[DRIFT.allNew[0]].text);
    choose(ctl<HTMLSelectElement>(host, 'text-new-preset'), '3');
    expect(el.querySelector('.comment-text')!.textContent).toBe(DRIFT_PRESETS[3].text);
    expect(el.querySelector('.prob-value')!.textContent).toBe(f(score(MODELS['uni-keep-train'], DRIFT_PRESETS[3].text).p, 3));
  });

  it('bigram switch changes the model', () => {
    const { host, el, player } = setup();
    player.goto(step('yorum-skor'));
    expect(ctl(host, 'bigram').checked).toBe(false);
    flip(ctl(host, 'bigram'));
    expect(el.querySelector('.score-panel')!.getAttribute('data-model')).toBe('bi-keep-train');
    expect(player.state.params.bigram).toBe(true);
    // the choice survives the next steps; step 7 shows the switch in the position the learner chose
    player.goto(step('degil-tuzagi'));
    expect(ctl(host, 'bigram').checked).toBe(true);
    expect(el.querySelector('.score-panel')!.getAttribute('data-model')).toBe('bi-drop-train');
    flip(ctl(host, 'bigram'));
    expect(el.querySelector('.score-panel')!.getAttribute('data-model')).toBe('uni-drop-train');
    // the switch shows the step's own model while nothing is chosen
    const fresh = setup();
    fresh.player.goto(step('degil-tuzagi'));
    expect(ctl(fresh.host, 'bigram').checked).toBe(true);
    expect(ctl(fresh.host, 'degilStop').checked).toBe(true);
    expect(fresh.player.state.params.bigram).toBeNull();
  });

  it('the degil switch changes the dropped chips, and step 6 keeps comparing unigram with bigram', () => {
    const { host, el, player } = setup();
    player.goto(step('bigram'));
    expect(ctl(host, 'degilStop').checked).toBe(false);
    flip(ctl(host, 'degilStop'));
    expect(texts(el, '.token-chip.is-dropped')).toEqual(['değil', 'değil']);
    expect([...el.querySelectorAll('.score-panel')].map((p) => p.getAttribute('data-model'))).toEqual(['uni-drop-train', 'bi-drop-train']);
    // a bigram choice from another step does not touch step 6
    flip(ctl(host, 'degilStop'));
    player.setParam('bigram', true);
    expect([...el.querySelectorAll('.score-panel')].map((p) => p.getAttribute('data-model'))).toEqual(['uni-keep-train', 'bi-keep-train']);
  });

  it('model switch draws the coefficient bars, the pipeline line and the matrix of that model', () => {
    const { host, el, player } = setup();
    player.goto(step('kelime-agirlik'));
    flip(ctl(host, 'bigram'));
    expect(texts(el, '.coef-bar[data-sign="pos"]').length).toBe(10);
    expect([...el.querySelectorAll('.coef-bar')].some((b) => b.getAttribute('data-term')!.includes(' '))).toBe(true);
    const slider = ctl(host, 'topN');
    slider.value = '6';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    expect(player.state.params.topN).toBe(6);
    expect(el.querySelectorAll('.coef-bar[data-sign="pos"]')).toHaveLength(6);
    player.goto(step('boru-hatti'));
    expect(el.querySelector('.code-text')!.textContent).toContain('ngram_range=(1, 2)');
    player.goto(step('test-sonuc'));
    expect(el.querySelector('.result-scene')!.getAttribute('data-model')).toBe('bi-keep-train');
  });

  it('leaky switch changes the vocabulary strip', () => {
    const { host, el, player } = setup();
    player.goto(step('sizinti'));
    expect(ctl(host, 'leaky').checked).toBe(true);
    const leaky = MODELS['uni-keep-all'];
    expect(el.querySelectorAll('.vocab-test-only:not(.is-oov)')).toHaveLength(leaky.testOnly.length);
    expect(el.querySelector('.vocab-scene')!.getAttribute('data-leaky')).toBe('true');
    flip(ctl(host, 'leaky'));
    expect(player.state.params.leaky).toBe(false);
    expect(el.querySelector('.vocab-scene')!.getAttribute('data-leaky')).toBe('false');
    expect(el.querySelectorAll('.vocab-test-only.is-oov')).toHaveLength(leaky.testOnly.length);
    expect(el.querySelectorAll('.vocab-idf')).toHaveLength(0);
    // the selected vocabulary and the chosen accuracy follow the switch
    expect(el.querySelector('.vocab-acc.is-chosen')!.getAttribute('data-model')).toBe('clean');
    // the switch belongs to step 8 alone: the next step still trains on the training part
    player.goto(step('sozluk-kaymasi'));
    expect(el.querySelector('.score-panel')!.getAttribute('data-model')).toBe('uni-keep-train');
  });

  it('empty text shows the empty-comment note', () => {
    const { host, el, player } = setup();
    player.goto(step('yorum-skor'));
    type(ctl(host, 'text'), '');
    expect(player.state.params.text).toBe('');
    expect(el.querySelector('.panel-note')!.textContent).toBe(EMPTY_NOTE);
    expect(el.querySelector('.prob-value')!.textContent).toBe('');
    expect(el.querySelector('.prob-line')!.hasAttribute('hidden')).toBe(true);
    // only stop words (with the "değil" switch on)
    type(ctl(host, 'text'), 'değil');
    flip(ctl(host, 'degilStop'));
    expect(el.querySelector('.panel-note')!.textContent).toBe(EMPTY_NOTE);
    expect(el.textContent).not.toMatch(/NaN|undefined|Infinity/);
    player.goto(step('sozluk-kaymasi'));
    type(ctl(host, 'text-new'), '');
    expect(el.querySelector('.panel-note')!.textContent).toBe(EMPTY_NOTE);
    expect(el.textContent).not.toMatch(/NaN|undefined|Infinity/);
  });

  it('the fixed switch follows the real sequence: sweep ends, untick, tick', () => {
    const { host, el, player } = setup();
    player.goto(step('hata-ayiklama'));
    const box = ctl(host, 'fixed');
    const shown = () => el.querySelector('.code-title')!.textContent === 'Düzeltilmiş kod';
    const check = (fixed: boolean, bugs: number) => {
      expect(shown()).toBe(fixed);
      expect(box.checked).toBe(fixed);
      expect(el.querySelectorAll('.bug-badge')).toHaveLength(bugs);
    };
    check(false, 1);
    // the sweep plays to its end: the corrected code, and the switch reads ticked
    vi.advanceTimersByTime(1400 * 6);
    check(true, 0);
    // untick: the faulty code with all four bugs marked, sweep stays cancelled
    flip(box);
    check(false, 4);
    vi.advanceTimersByTime(1400 * 6);
    check(false, 4);
    flip(box);
    check(true, 0);
    flip(box);
    check(false, 4);
  });

  it('a Lab tick does not leak into the Ders sweep of step 10', () => {
    const { host, el, player } = setup();
    player.goto(step('hata-ayiklama'));
    flip(ctl(host, 'fixed'));
    player.goto(step('sozluk-kaymasi'));
    player.goto(step('hata-ayiklama'));
    expect(player.state.params.fixed).toBe(false);
    expect(el.querySelector('.code-title')!.textContent).toBe('Hatalı kod');
    expect(el.querySelectorAll('.bug-badge')).toHaveLength(1);
  });

  it('the Lab note names the three-class sentiment and the emoji in one sentence each', async () => {
    const host = document.createElement('div');
    mountSentimentExtra(host, new StepPlayer(sc));
    const ps = [...host.querySelectorAll('p')];
    expect(ps).toHaveLength(2);
    expect(ps[0].textContent).toMatch(/üç sınıf/i);
    expect(ps[1].textContent).toMatch(/emoji/i);
  });
});
