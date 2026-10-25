// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { formatNumber as f } from '../../../src/core/plot/format';
import { LIME_RUNS, SAMPLE_SIZES, SEEDS } from '../../../src/concepts/xai/data';
import { rangeText } from '../../../src/concepts/lime-yerel/scenario';
import { go, num, setup, texts, themeFonts } from './harness';

const f3 = (v: number) => f(v, 3);
const coefs = (row: number, samples: number, feature: number) =>
  SEEDS.map((seed) => LIME_RUNS.find((r) => r.row === row && r.seed === seed && r.samples === samples)!.fit.coef[feature]);
const range = (xs: number[]) => rangeText(Math.min(...xs), Math.max(...xs));
const spread = (row: Element) => {
  const xs = [...row.querySelectorAll('.stab-dot')].map((d) => num(d, 'cx'));
  return Math.max(...xs) - Math.min(...xs);
};

describe('stability scene', () => {
  it('step 8 draws eleven seeds per row', () => {
    const { el, player } = setup();
    go(player, 'kararlilik');
    expect(el.querySelector('.lime-stage')!.getAttribute('data-view')).toBe('stability');
    const groups = [...el.querySelectorAll('.stab-group')];
    expect(groups).toHaveLength(3);
    const rows = [...el.querySelectorAll('.stab-row')];
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      expect(row.querySelectorAll('.stab-dot')).toHaveLength(11);
      // exactly one ringed dot per row: the book run, seed 42
      const ringed = row.querySelectorAll('.stab-dot.is-book');
      expect(ringed).toHaveLength(1);
      expect(ringed[0].getAttribute('data-seed')).toBe('42');
      expect(row.querySelectorAll('.stab-ring')).toHaveLength(1);
    }
    // the Ders compares 5000 samples with 50 samples; the range labels are read from the data
    expect(groups.map((g) => [...g.querySelectorAll('.stab-row')].map((r) => r.getAttribute('data-samples')))).toEqual([
      ['5000', '50'],
      ['5000', '50'],
      ['5000', '50'],
    ]);
    expect(texts(groups[0], '.stab-range')).toEqual([range(coefs(301, 5000, 0)), range(coefs(301, 50, 0))]);
    // ranges read "lo … hi" with thin spaces; a negative end keeps its minus sign and never doubles it
    for (const t of texts(el, '.stab-range')) {
      expect(t).toMatch(/^−?\d,\d{3} … −?\d,\d{3}$/);
    }
    const negative = coefs(301, 5000, 2);
    expect(Math.max(...negative)).toBeLessThan(0);
    expect(texts(groups[2], '.stab-range')[0]).toBe(`${f3(Math.min(...negative))} … ${f3(Math.max(...negative))}`);
    expect(texts(groups[2], '.stab-range')[0]).not.toContain('−−');
    expect(texts(groups[2], '.stab-range')).toEqual([range(coefs(301, 5000, 2)), range(coefs(301, 50, 2))]);
    expect(texts(el, '.stab-name')).toEqual(['tenure', 'MonthlyCharges', 'TotalCharges']);
    expect(el.querySelector('.stability-scene')!.innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it('fifty samples spread wider than five thousand', () => {
    const { el, player } = setup();
    go(player, 'kararlilik');
    for (const group of el.querySelectorAll('.stab-group')) {
      const [big, small] = [...group.querySelectorAll('.stab-row')];
      expect(spread(small), group.getAttribute('data-feature')!).toBeGreaterThan(spread(big));
    }
  });

  it('the range text never sits on a dot, narrow or wide', () => {
    for (const [w, h, font] of [
      [390, 450, 'narrow'],
      [745, 540, 'narrow'],
      [1280, 540, 'wide'],
    ] as const) {
      themeFonts(font);
      const { el, player } = setup(w, h, font === 'wide' ? 'ders' : 'lab');
      go(player, 'kararlilik');
      const fs = font === 'wide' ? 18 : 13;
      for (const row of el.querySelectorAll('.stab-row')) {
        const range = row.querySelector('.stab-range')!;
        const textW = range.textContent!.length * 0.62 * fs;
        const box = { x0: num(range, 'x') - textW, x1: num(range, 'x'), y0: num(range, 'y') - fs * 0.6, y1: num(range, 'y') + fs * 0.6 };
        for (const d of row.querySelectorAll('.stab-dot, .stab-ring')) {
          const r = num(d, 'r');
          const inX = num(d, 'cx') + r > box.x0 && num(d, 'cx') - r < box.x1;
          const inY = num(d, 'cy') + r > box.y0 && num(d, 'cy') - r < box.y1;
          expect(inX && inY, `${w}: ${row.getAttribute('data-samples')} ${range.textContent}`).toBe(false);
        }
      }
    }
  });

  it('the sample size choice moves the second row and the highlight', () => {
    const { el, player } = setup();
    go(player, 'kararlilik');
    player.setParam('samples', 500);
    const g = el.querySelector('.stab-group')!;
    expect([...g.querySelectorAll('.stab-row')].map((r) => r.getAttribute('data-samples'))).toEqual(['5000', '500']);
    expect(el.querySelectorAll('.stab-row.is-selected')).toHaveLength(3);
    expect([...el.querySelectorAll('.stab-row.is-selected')].every((r) => r.getAttribute('data-samples') === '500')).toBe(true);
    expect(texts(g, '.stab-range')[1]).toBe(range(coefs(301, 500, 0)));
  });

  it('every dot and label stays inside the plot at 390 and 1280 px', () => {
    for (const [w, h, font] of [
      [390, 450, 'narrow'],
      [1280, 540, 'wide'],
    ] as const) {
      themeFonts(font);
      const { el, player } = setup(w, h, font === 'wide' ? 'ders' : 'lab');
      go(player, 'kararlilik');
      const svg = el.querySelector('.stab-plot')!;
      const width = num(svg, 'width');
      expect(width).toBeLessThanOrEqual(w);
      for (const d of el.querySelectorAll('.stab-dot')) {
        expect(num(d, 'cx')).toBeGreaterThan(0);
        expect(num(d, 'cx')).toBeLessThan(width);
      }
      const fs = font === 'wide' ? 18 : 13;
      for (const t of el.querySelectorAll('.stab-range, .stab-label')) {
        const x = num(t, 'x');
        const textW = t.textContent!.length * 0.62 * fs;
        const end = t.getAttribute('text-anchor') === 'end';
        expect(end ? x - textW : x).toBeGreaterThanOrEqual(-1);
        expect(end ? x : x + textW).toBeLessThanOrEqual(width + 1);
      }
      const avail = Number(el.querySelector('.lime-stage')!.getAttribute('data-avail'));
      const used = Number(el.querySelector('.stability-scene')!.getAttribute('data-used'));
      expect(used, `${w}: ${used} <= ${avail}`).toBeLessThanOrEqual(avail);
    }
  });
});

describe('empty pattern rows at small sample sizes', () => {
  it('fifty samples show the empty pattern rows', () => {
    // the first seed-42 run in the data with an unsampled pattern (the Lab can reach it with the sample size choice)
    const run = LIME_RUNS.find((r) => r.seed === 42 && r.patterns.some((p) => p.n === 0))!;
    expect(run, 'a seed-42 run with an empty pattern').toBeDefined();
    expect(SAMPLE_SIZES).toContain(run.samples);
    const { el, player } = setup(1280, 540, 'lab');
    go(player, 'cekirdek');
    player.setParams({ customer: run.row, samples: run.samples });
    const empty = run.patterns.filter((p) => p.n === 0).map((p) => String(p.mask));
    const rows = [...el.querySelectorAll('.kernel-scene .pattern-row')];
    const shown = rows.filter((r) => r.classList.contains('is-empty')).map((r) => r.getAttribute('data-mask'));
    expect(shown.sort()).toEqual(empty.sort());
    for (const r of rows.filter((q) => q.classList.contains('is-empty'))) {
      expect(r.querySelector('.pattern-n')!.textContent).toBe('0 örnek');
      expect(r.querySelector('.pattern-mean')!.textContent).toBe('—');
    }
    expect(el.querySelector('.kernel-scene')!.textContent).not.toMatch(/NaN|Infinity|undefined/);
    // the weights stay numbers and the curve is drawn
    expect(el.querySelector('.kernel-curve')!.getAttribute('d')).not.toMatch(/NaN/);
  });
});
