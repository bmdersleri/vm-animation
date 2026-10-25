// @vitest-environment jsdom
import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { MODELS } from '../../../src/concepts/metin/data';
import { go, num, setup } from './harness';

describe('coefficient scene', () => {
  it('step 3 shows ten positive and ten negative terms', () => {
    const { el, player } = setup();
    go(player, 'kelime-agirlik');
    expect(el.querySelector('.sa-stage')!.getAttribute('data-view')).toBe('coef');
    expect(el.querySelectorAll('.coef-bar[data-sign="pos"]')).toHaveLength(10);
    expect(el.querySelectorAll('.coef-bar[data-sign="neg"]')).toHaveLength(10);
    const m = MODELS['uni-keep-train'];
    const coefOf = (term: string) => m.coef[m.vocab.indexOf(term)];
    for (const b of el.querySelectorAll('.coef-bar')) {
      const c = coefOf(b.getAttribute('data-term')!);
      expect(Math.sign(c)).toBe(b.getAttribute('data-sign') === 'pos' ? 1 : -1);
    }
    player.setParams({ topN: 5 });
    expect(el.querySelectorAll('.coef-bar[data-sign="pos"]')).toHaveLength(5);
  });

  it('bars sort by size', () => {
    const { el, player } = setup();
    go(player, 'kelime-agirlik');
    for (const sign of ['pos', 'neg']) {
      const bars = [...el.querySelectorAll(`.coef-bar[data-sign="${sign}"]`)];
      const widths = bars.map((b) => num(b.querySelector('rect.bar')!, 'width'));
      expect(widths).toEqual([...widths].sort((a, b) => b - a));
      const ys = bars.map((b) => Number(/translate\(0,([\d.]+)\)/.exec(b.getAttribute('transform')!)![1]));
      expect(ys).toEqual([...ys].sort((a, b) => a - b));
    }
    // one scale for both sides: bar width is proportional to |coef| across the two groups
    const rows = [...el.querySelectorAll('.coef-bar')].map((b) => ({ w: num(b.querySelector('rect.bar')!, 'width'), c: Math.abs(Number(b.getAttribute('data-coef'))) }));
    const ref = rows[0];
    for (const r of rows) expect(r.w / ref.w).toBeCloseTo(r.c / ref.c, 1);
  });

  it('term labels are written in the code font', () => {
    const css = fs.readFileSync('src/concepts/duygu-analizi/duygu-analizi.css', 'utf8');
    expect(css).toMatch(/\.coef-plot \.bar-name[^{]*\{[^}]*font-family:var\(--mono/);
  });
});
