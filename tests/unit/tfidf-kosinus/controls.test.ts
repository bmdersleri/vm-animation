// @vitest-environment jsdom
import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../svg-stubs';
import { bindKeys } from '../../../src/core/keyboard';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { BOOK } from '../../../src/concepts/metin/data';
import { mountTfidfParams } from '../../../src/concepts/tfidf-kosinus/controls';
import { mountTfidfExtra } from '../../../src/concepts/tfidf-kosinus/extra';
import { tfidfKosinusScenario as sc } from '../../../src/concepts/tfidf-kosinus/scenario';
import { mountTfidfScene } from '../../../src/concepts/tfidf-kosinus/scene';
import { deriveTfidfView } from '../../../src/concepts/tfidf-kosinus/view';
import { labTextTests } from '../lab-text';

const css = fs.readFileSync('src/concepts/tfidf-kosinus/tfidf-kosinus.css', 'utf8');

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
  mountTfidfParams(host, player);
  const scene = mountTfidfScene(el, player, 'lab', { durationScale: 0 });
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

/** The controls shown at a step, as `param` or `action` names (a preset select folds into its text box). */
function visible(host: HTMLElement): string[] {
  return [...host.querySelectorAll<HTMLElement>('.ctl:not([data-off])')].map((c) => {
    const input = c.querySelector<HTMLElement>('[data-param], [data-action]')!;
    return input.dataset.param ?? input.dataset.action!;
  });
}

labTextTests(sc.steps, [1, 3, 4, 5, 6, 7, 8, 9, 10]);

describe('tfidf-kosinus Lab controls', () => {
  it('typing in the text box does not change the step', () => {
    const { host, player } = setup();
    clean.push(bindKeys(window, player, { toggleFullscreen: vi.fn(), toggleHelp: vi.fn() }, []));
    const box = ctl(host, 'text');
    for (const key of ['ArrowRight', ' ', 'ArrowLeft', 'End', 'Home', 'p']) {
      const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      box.dispatchEvent(ev);
      expect(ev.defaultPrevented, key).toBe(false);
    }
    expect(player.state.index).toBe(0);
    expect(player.state.playing).toBe(false);
  });

  it('typing a comment updates the chips', () => {
    const { host, el, player } = setup();
    type(ctl(host, 'text'), 'Bağlantı İYİ!!! 5G yok');
    expect(player.state.params.text).toBe('Bağlantı İYİ!!! 5G yok');
    expect(texts(el, '.token-chip')).toEqual(['bağlantı', 'iyi', 'yok']);
    choose(ctl<HTMLSelectElement>(host, 'text-preset'), '1');
    expect(ctl(host, 'text').value).toBe('hizmet kötü değil');
    expect(texts(el, '.token-chip')).toEqual(['hizmet', 'kötü', 'değil']);
  });

  it('stop word switches change the dropped chips', () => {
    const { host, el } = setup();
    const dropped = () => texts(el, '.token-chip.is-dropped');
    expect(dropped()).toEqual([]);
    flip(ctl(host, 'stop'));
    expect(dropped()).toEqual(['çok']);
    type(ctl(host, 'text'), 'hizmet kötü değil');
    expect(dropped()).toEqual([]);
    flip(ctl(host, 'degil'));
    expect(dropped()).toEqual(['değil']);
  });

  it('empty text shows the empty-comment note', () => {
    const { host, el, player } = setup();
    expect(el.querySelector('.empty-note')).toBeNull();
    type(ctl(host, 'text'), '');
    expect(el.querySelector('.empty-note')!.textContent).toBe('Boş yorum analiz edilemez.');
    // only stop words: the same note
    flip(ctl(host, 'stop'));
    type(ctl(host, 'text'), 'çok ve');
    expect(el.querySelector('.empty-note')).not.toBeNull();
    type(ctl(host, 'text'), 'çok iyi');
    expect(el.querySelector('.empty-note')).toBeNull();
    expect(el.textContent).not.toMatch(/NaN|undefined|Infinity/);
    player.goto(step('stop-word'));
    type(ctl(host, 'text'), '');
    expect(el.querySelector('.empty-note')).not.toBeNull();
  });

  it('editing a document updates idf and the table', () => {
    const { host, el, player } = setup();
    player.goto(step('idf'));
    const cols = () => texts(el, '.heat-col-text');
    expect(cols()).toEqual(BOOK.kod02.vocab);
    const before = texts(el, '.idf-bar');
    type(ctl(host, 'doc-2'), 'yeni fiber hat çok hızlı');
    expect(player.state.params.docs[2]).toBe('yeni fiber hat çok hızlı');
    expect(cols()).toContain('fiber');
    expect(cols()).not.toEqual(BOOK.kod02.vocab);
    expect(texts(el, '.idf-bar')).not.toEqual(before);
    // the term choice follows the new vocabulary
    const term = ctl<HTMLSelectElement>(host, 'term');
    expect([...term.options].map((o) => o.value)).toContain('fiber');
    choose(term, 'fiber');
    expect(player.state.params.term).toBe('fiber');
    expect(el.querySelector('.heat-cell.is-focus')).not.toBeNull();
    // the book's documents come back with one press
    host.querySelector<HTMLButtonElement>('[data-action=docs-reset]')!.click();
    expect(player.state.params.docs).toEqual(BOOK.kod02.docs);
    expect(cols()).toEqual(BOOK.kod02.vocab);
  });

  it('editing a document after the step-6 sweep keeps the finished row', () => {
    const { host, el, player } = setup();
    player.goto(step('tfidf-norm'));
    vi.advanceTimersByTime(1100 * 120);
    const title = () => el.querySelector('.heat-block:not([hidden]) .heat-title')!.textContent;
    const strip = () => el.querySelector('.formula')!.textContent ?? '';
    expect(title()).toBe('TF-IDF (L2 normlu)');
    expect(strip()).toContain('bölme →');
    // more terms in row zero than the sweep counted: the norm and the division are recalculated, not dropped
    type(ctl(host, 'doc-0'), 'internet yavaş destek yetersiz fiyat pahalı');
    expect(title()).toBe('TF-IDF (L2 normlu)');
    expect(strip()).toContain('pahalı');
    expect(strip()).toMatch(/norm ‖v‖/);
    expect(strip()).toContain('bölme →');
    host.querySelector<HTMLButtonElement>('[data-action=docs-reset]')!.click();
    expect(title()).toBe('TF-IDF (L2 normlu)');
    expect(strip()).toContain('bölme →');
  });

  it('one document left still draws the table', () => {
    const { host, el, player } = setup();
    player.goto(step('yan-yana'));
    type(ctl(host, 'doc-1'), '');
    type(ctl(host, 'doc-2'), '');
    expect(el.querySelectorAll('.heat-table')).toHaveLength(2);
    expect(el.querySelectorAll('.heat-cell').length).toBeGreaterThan(0);
    expect(el.textContent).not.toMatch(/NaN|undefined|Infinity/);
    player.goto(step('tfidf-norm'));
    expect(el.textContent).not.toMatch(/NaN|undefined|Infinity/);
  });

  it('fourth document joins the ranking', () => {
    const { host, el, player } = setup();
    player.goto(step('kosinus'));
    expect(el.querySelectorAll('.sim-row')).toHaveLength(3);
    type(ctl(host, 'extra'), 'internet bağlantısı çok iyi');
    expect(el.querySelectorAll('.sim-row')).toHaveLength(4);
    const query = ctl<HTMLSelectElement>(host, 'query');
    expect([...query.options].map((o) => o.value)).toEqual(['0', '1', '2', '3']);
    choose(query, '3');
    expect(player.state.params.query).toBe(3);
    expect(el.querySelector('.sim-row.is-query')!.textContent).toContain('internet bağlantısı çok iyi');
    // choosing one plane term keeps the other automatic
    choose(ctl<HTMLSelectElement>(host, 'plane-0'), 'internet');
    expect(player.state.params.plane).toEqual(['internet', '']);
    expect(el.textContent).not.toMatch(/NaN|undefined|Infinity/);
    type(ctl(host, 'extra'), '');
    expect(el.querySelectorAll('.sim-row')).toHaveLength(3);
    // the query index 3 no longer exists: the page clamps it to the last comment
    expect(ctl<HTMLSelectElement>(host, 'query').value).toBe('2');
  });

  it('choosing the automatic second term first never gives two equal axes', () => {
    const { host, player } = setup();
    for (const id of ['kosinus', 'uzunluk-yon']) {
      player.goto(step(id));
      player.setParam('plane', ['', '']);
      const terms = () => deriveTfidfView(player.state.index, player.state.params).vectors!.terms;
      const auto = terms();
      expect(auto[0]).not.toBe(auto[1]);
      choose(ctl<HTMLSelectElement>(host, 'plane-0'), auto[1]);
      expect(terms()[0]).toBe(auto[1]);
      expect(terms()[1]).not.toBe(terms()[0]);
      choose(ctl<HTMLSelectElement>(host, 'plane-1'), auto[1]);
      expect(terms()[1]).not.toBe(terms()[0]);
    }
  });

  it('a fourth document without terms gives cosine zero, never NaN', () => {
    const { host, el, player } = setup();
    player.goto(step('kosinus'));
    type(ctl(host, 'extra'), '1234 !!');
    expect(el.querySelectorAll('.sim-row')).toHaveLength(4);
    expect(el.textContent).not.toMatch(/NaN|undefined|Infinity/);
    choose(ctl<HTMLSelectElement>(host, 'query'), '3');
    expect(el.textContent).not.toMatch(/NaN|undefined|Infinity/);
    player.goto(step('uzunluk-yon'));
    expect(el.textContent).not.toMatch(/NaN|undefined|Infinity/);
  });

  it('separate vocabularies show different columns', () => {
    const { host, el, player } = setup();
    player.goto(step('ortak-sozluk'));
    const card = () => el.querySelector('.text-card[data-kind="ayri-sozluk"]')!;
    const toggle = ctl(host, 'separate');
    expect(toggle.checked).toBe(true);
    expect(card().getAttribute('data-separate')).toBe('true');
    const terms = (): string[] => texts(card(), '.vocab-term');
    const left = (): string[] => terms().filter((_, i) => i % 2 === 0);
    const right = (): string[] => terms().filter((_, i) => i % 2 === 1);
    expect(left()).not.toEqual(right());
    expect(card().querySelector('.card-result.is-wrong')).not.toBeNull();
    // the card shows the two texts it compares, and a Lab edit of document 0 reaches it
    expect(texts(card(), '.card-doc-text')).toEqual([BOOK.kod02.docs[0], BOOK.kod02.docs[2]]);
    expect(texts(card(), '.card-doc-name')).toEqual(['belge 0', 'belge 2']);
    player.goto(step('bow'));
    type(ctl(host, 'doc-0'), 'yeni fiber hat');
    player.goto(step('ortak-sozluk'));
    expect(texts(card(), '.card-doc-text')).toEqual(['yeni fiber hat', BOOK.kod02.docs[2]]);
    flip(toggle);
    expect(player.state.params.separate).toBe(false);
    expect(card().getAttribute('data-separate')).toBe('false');
    expect(left()).toEqual(right());
    expect(card().querySelector('.card-result.is-wrong')).toBeNull();
  });

  it('Lab choices survive the next steps', () => {
    const { host, player } = setup();
    type(ctl(host, 'text'), 'hizmet kötü değil');
    flip(ctl(host, 'degil'));
    player.goto(step('turkce-karakter'));
    player.goto(step('stop-word'));
    expect(player.state.params.text).toBe('hizmet kötü değil');
    expect(player.state.params.degil).toBe(true);
    player.goto(step('bow'));
    type(ctl(host, 'doc-0'), 'sadece bir cümle');
    choose(ctl<HTMLSelectElement>(host, 'term'), 'cümle');
    player.goto(step('idf'));
    player.goto(step('tfidf-norm'));
    player.goto(step('yan-yana'));
    expect(player.state.params.docs[0]).toBe('sadece bir cümle');
    expect(player.state.params.term).toBe('cümle');
    player.goto(step('kosinus'));
    type(ctl(host, 'extra'), 'bir deneme');
    player.goto(step('uzunluk-yon'));
    expect(player.state.params.extra).toBe('bir deneme');
    expect(player.state.params.docs[0]).toBe('sadece bir cümle');
  });

  it('only the step controls are visible', () => {
    const { host, player } = setup();
    const docs = ['doc-0', 'doc-1', 'doc-2', 'docs-reset'];
    const shown: Record<string, string[]> = {
      token: ['text', 'stop', 'degil'],
      'stop-word': ['text', 'stop', 'degil'],
      bow: [...docs, 'term'],
      idf: [...docs, 'term'],
      'tfidf-norm': docs,
      'yan-yana': [...docs, 'term'],
      kosinus: ['query', 'extra', 'plane-0', 'plane-1'],
      'uzunluk-yon': ['query', 'extra', 'plane-0', 'plane-1'],
      'ortak-sozluk': ['separate'],
    };
    for (const [id, keys] of Object.entries(shown)) {
      player.goto(step(id));
      expect(visible(host), id).toEqual(keys);
      // hidden controls are disabled so they cannot take focus
      const off = [...host.querySelectorAll<HTMLInputElement>('.ctl[data-off] input, .ctl[data-off] select, .ctl[data-off] button')];
      expect(off.length).toBeGreaterThan(0);
      expect(off.every((i) => i.disabled), id).toBe(true);
    }
  });

  it('a step without controls hides the card', () => {
    const { host, player } = setup();
    expect(host.hasAttribute('data-off')).toBe(false);
    player.goto(step('turkce-karakter'));
    expect(host.hasAttribute('data-off')).toBe(true);
    expect(visible(host)).toEqual([]);
    player.goto(step('stop-word'));
    expect(host.hasAttribute('data-off')).toBe(false);
    expect(css).toMatch(/\[data-mode='lab'\] \.params\[data-off\]\s*\{\s*display:\s*none/);
  });

  it('the Lab note names n-gram and lemmatization', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const player = new StepPlayer(sc);
    clean.push(() => player.destroy());
    mountTfidfExtra(host, player);
    const notes = texts(host, 'p');
    expect(notes).toHaveLength(2);
    expect(notes[0]).toMatch(/N-gram/);
    expect(notes[1]).toMatch(/Lemmatization/);
  });
});
