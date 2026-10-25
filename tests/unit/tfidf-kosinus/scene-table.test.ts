// @vitest-environment jsdom
import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { BOOK } from '../../../src/concepts/metin/data';
import { go, num, setup, texts } from './harness';

const css = fs.readFileSync('src/concepts/tfidf-kosinus/tfidf-kosinus.css', 'utf8');

const cell = (el: Element, row: number, col: number, table = ''): HTMLElement =>
  el.querySelector<HTMLElement>(`${table} .heat-cell[data-row="${row}"][data-col="${col}"]`)!;

describe('table scene', () => {
  it('step 4 draws the book count matrix', () => {
    const { el, player } = setup();
    go(player, 'bow');
    expect(el.querySelector('.tf-stage')!.getAttribute('data-view')).toBe('table');
    expect(texts(el, '.heat-block:not([hidden]) .heat-col')).toEqual(BOOK.kod02.vocab);
    const vals = BOOK.kod02.bow.map((r, i) => r.map((_, j) => cell(el, i, j).textContent));
    expect(vals).toEqual(BOOK.kod02.bow.map((r) => r.map(String)));
  });

  it('step 5 idf bars read 1.693 and 1.288', () => {
    const { el, player } = setup();
    go(player, 'idf');
    const bars = [...el.querySelectorAll('.idf-bar')];
    expect(bars).toHaveLength(BOOK.kod02.vocab.length);
    const by = (term: string) => bars.find((b) => b.querySelector('.bar-name')!.textContent === term)!;
    expect(by('yavaş').querySelector('.bar-value')!.textContent).toBe('df 1 · 1,693');
    expect(by('destek').querySelector('.bar-value')!.textContent).toBe('df 2 · 1,288');
    const wRare = num(by('yavaş').querySelector('rect.bar')!, 'width');
    const wCommon = num(by('destek').querySelector('rect.bar')!, 'width');
    expect(wCommon / wRare).toBeCloseTo(1.287682 / 1.693147, 2);
    expect(el.querySelector('.formula')!.textContent).toContain('ln(4 / 2) + 1 = 1,693');
    expect(el.querySelector('.idf-panel')!.hasAttribute('hidden')).toBe(false);
  });

  it('step 6 sweep normalises row zero', () => {
    const { el, player } = setup();
    go(player, 'tfidf-norm');
    const row0 = () => [...el.querySelectorAll<HTMLElement>('.heat-cell[data-row="0"]')];
    const raw = BOOK.kod02.raw[0];
    const nz = raw.map((v, j) => (v > 0 ? j : -1)).filter((j) => j >= 0);
    // before the sweep reaches a cell it is empty; each step fills the next non-zero cell with the raw weight
    player.setParams({ scan: 1 });
    expect(row0().filter((c) => c.classList.contains('is-hidden'))).toHaveLength(nz.length - 1);
    expect(cell(el, 0, nz[0]).textContent).toBe('1,288');
    expect(cell(el, 0, nz[0]).classList.contains('is-focus')).toBe(true);
    player.setParams({ scan: nz.length });
    expect(nz.map((j) => cell(el, 0, j).textContent)).toEqual(['1,288', '1,288', '1,693', '1,693']);
    // the norm step keeps the raw weights and writes the norm in the strip
    player.setParams({ scan: nz.length + 1 });
    expect(el.querySelector('.formula')!.textContent).toContain('3,008');
    expect(cell(el, 0, nz[0]).textContent).toBe('1,288');
    // the division step turns the row into the book's TF-IDF row
    player.setParams({ scan: nz.length + 2 });
    expect(nz.map((j) => cell(el, 0, j).textContent)).toEqual(['0,428', '0,428', '0,563', '0,563']);
    expect(el.querySelector('.formula')!.textContent).toContain('1,693 / 3,008 = 0,563');
  });

  it('step 7 draws two tables', () => {
    const { el, player } = setup();
    go(player, 'yan-yana');
    const shown = [...el.querySelectorAll<HTMLElement>('.heat-block:not([hidden])')];
    expect(shown.map((b) => b.dataset.table)).toEqual(['bow', 'tfidf']);
    expect(shown.map((b) => b.querySelectorAll('.heat-cell').length)).toEqual([27, 27]);
    const j = BOOK.kod02.vocab.indexOf('destek');
    const k = BOOK.kod02.vocab.indexOf('yavaş');
    // counts weigh the two terms the same; TF-IDF makes "destek" lighter than "yavaş"
    expect(cell(el, 0, j, '[data-table="bow"]').textContent).toBe(cell(el, 0, k, '[data-table="bow"]').textContent);
    expect(cell(el, 0, j, '[data-table="bow"]').style.backgroundColor).toBe(cell(el, 0, k, '[data-table="bow"]').style.backgroundColor);
    expect(cell(el, 0, j, '[data-table="tfidf"]').textContent).toBe('0,428');
    expect(cell(el, 0, k, '[data-table="tfidf"]').textContent).toBe('0,563');
    expect(cell(el, 0, j, '[data-table="tfidf"]').style.backgroundColor).not.toBe(cell(el, 0, k, '[data-table="tfidf"]').style.backgroundColor);
    expect(el.querySelector('.idf-panel')!.hasAttribute('hidden')).toBe(true);
  });

  it('table fits 390 px', () => {
    const { el, player } = setup(390, 520);
    go(player, 'yan-yana');
    const wraps = el.querySelectorAll('.heat-block:not([hidden]) .heat-wrap');
    expect(wraps).toHaveLength(2);
    // jsdom has no layout: a table that would not fit scrolls inside its own wrapper, and the narrow
    // layout stacks the two tables; the real width is checked in the browser pass
    expect(/\.heat-wrap\s*\{[^}]*overflow-x:\s*auto/.test(css)).toBe(true);
    expect(css).toContain('min-width:calc(var(--row-head) + var(--cols, 1) * var(--cell-min))');
    const narrow = /@media \(max-width:900px\) \{[^@]*\.table-scene\[data-part='both'\] \.table-area \{ grid-template-columns:minmax\(0,1fr\)/.test(css);
    expect(narrow).toBe(true);
    expect(el.querySelectorAll('.heat-block:not([hidden]) .heat-col')).toHaveLength(18);
  });
});
