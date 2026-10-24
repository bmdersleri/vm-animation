// @vitest-environment jsdom
import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { BOOK } from '../../../src/concepts/metin/data';
import { go, setup, texts } from './harness';

const css = fs.readFileSync('src/concepts/tfidf-kosinus/tfidf-kosinus.css', 'utf8');
const rule = (selector: string): string => new RegExp(`${selector.replace(/[.[\]]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';

describe('token scene', () => {
  it('step 1 makes eight tokens from the book comment', () => {
    const { el } = setup();
    expect(el.querySelector('.tf-stage')!.getAttribute('data-view')).toBe('tokens');
    expect(texts(el, '.token-chip')).toEqual(BOOK.kod01.tokens);
    expect(texts(el, '.token-chip')).toHaveLength(8);
    expect(el.querySelectorAll('.token-chip.is-dropped')).toHaveLength(0);
    // the raw line keeps every character; digits and punctuation are faded
    expect(texts(el, '.raw-char').join('')).toBe(BOOK.kod01.text);
    expect(texts(el, '.raw-char.is-gone').join('')).toContain('3');
    expect(texts(el, '.raw-char.is-lower')).toContain('İ');
    expect(el.querySelector('.formula')!.textContent).toContain('re.sub');
  });

  it('step 2 shows the broken pattern', () => {
    const { el, player } = setup();
    go(player, 'turkce-karakter');
    const wrong = el.querySelector('.pattern-row[data-pattern="yanlis"]')!;
    const right = el.querySelector('.pattern-row[data-pattern="dogru"]')!;
    expect(texts(wrong, '.token-chip.is-broken').filter((t) => t.length > 1)).toEqual(['ba', 'lant']);
    expect(wrong.querySelectorAll('.token-chip.is-dropped').length).toBeGreaterThan(0);
    expect(texts(right, '.token-chip')).toEqual(['bağlantı', 'kötü']);
    expect(right.querySelectorAll('.is-broken')).toHaveLength(0);
    expect(wrong.querySelector('.pattern-code')!.textContent).toBe('[^a-z\\s]');
  });

  it('step 3 drops the book stop words', () => {
    const { el, player } = setup();
    go(player, 'stop-word');
    expect(texts(el, '.tokens-scene > .token-chips:not(.stop-set):not(.counter-row) .token-chip.is-dropped')).toEqual(['çok']);
    expect(texts(el, '.stop-chip')).toHaveLength(8);
    const counter = texts(el, '.counter-chip');
    expect(counter).toHaveLength(BOOK.kod01.tokens.length - 1);
    expect(counter.join(' ')).not.toContain('çok');
    expect(texts(el, '.warn-row .token-chip.is-dropped')).toEqual(['değil']);
    expect(el.querySelector('.warn-row')!.textContent).toContain('[hizmet, kötü]');
    // going back to step 1 restores the chip: the step-3 stop switch belongs to step 3 only
    go(player, 'token');
    expect(el.querySelectorAll('.token-chip.is-dropped')).toHaveLength(0);
  });

  it('tokens wrap at 390 px without overlap', () => {
    const { el, player } = setup(390, 520);
    for (const id of ['token', 'turkce-karakter', 'stop-word']) {
      go(player, id);
      expect(el.querySelector('.tokens-scene')).not.toBeNull();
    }
    // jsdom has no layout: the wrapping itself is checked in the CSS and in the browser pass
    expect(rule('.token-chips')).toMatch(/display:\s*flex/);
    expect(rule('.token-chips')).toMatch(/flex-wrap:\s*wrap/);
    expect(rule('.token-chip')).toMatch(/max-width:\s*100%/);
    expect(rule('.token-chip')).toMatch(/overflow-wrap:\s*anywhere/);
    expect(rule('.raw-line')).toMatch(/overflow-wrap:\s*anywhere/);
  });
});
