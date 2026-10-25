// @vitest-environment jsdom
import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { formatNumber as f } from '../../../src/core/plot/format';
import { BOOK, MODELS } from '../../../src/concepts/metin/data';
import { score, sigmoid } from '../../../src/concepts/metin/score';
import { go, num, setup, texts } from './harness';

const css = fs.readFileSync('src/concepts/duygu-analizi/duygu-analizi.css', 'utf8');
const m = MODELS['uni-keep-train'];
const translateY = (e: Element): number => Number(/translate\(0,([\d.]+)\)/.exec(e.getAttribute('transform')!)![1]);

describe('score scene', () => {
  it('step 4 contributions sum to z', () => {
    const { el, player } = setup();
    go(player, 'yorum-skor');
    expect(el.querySelector('.sa-stage')!.getAttribute('data-view')).toBe('score');
    const sc = score(m, BOOK.kod04.newComment);
    const bars = [...el.querySelectorAll('.contrib-bar')];
    expect(bars).toHaveLength(sc.terms.length);
    const sum = bars.reduce((s, b) => s + Number(b.getAttribute('data-contribution')), 0);
    expect(sum + m.intercept).toBeCloseTo(sc.z, 12);
    // signs follow the data, widths follow |contribution|
    for (const b of bars) {
      expect(b.getAttribute('data-sign')).toBe(Number(b.getAttribute('data-contribution')) < 0 ? 'neg' : 'pos');
    }
    const widest = bars.reduce((a, b) => (num(b.querySelector('rect.bar')!, 'width') > num(a.querySelector('rect.bar')!, 'width') ? b : a));
    const top = sc.terms.reduce((a, t) => (Math.abs(t.contribution) > Math.abs(a.contribution) ? t : a));
    expect(widest.getAttribute('data-term')).toBe(top.term);
    expect(el.querySelector('.z-line')!.textContent).toContain(`= ${f(sc.z, 3)}`);
    expect(el.querySelector('.prob-value')!.textContent).toBe(f(sc.p, 3));
    expect(el.querySelector('.compare-line')!.textContent).toContain('p = 0,542');
    // out-of-vocabulary chips are the tokens the vocabulary lacks
    expect(el.querySelectorAll('.token-chip').length).toBe(sc.tokens.length);
    expect(el.querySelectorAll('.token-chip.is-oov').length).toBe(sc.oov.length);
  });

  it('probability point sits on the sigmoid', () => {
    const { el, player } = setup();
    go(player, 'yorum-skor');
    const onCurve = () => {
      const point = el.querySelector('circle.lc-marker')!;
      const cx = num(point, 'cx');
      const cy = num(point, 'cy');
      const pts = [...el.querySelector('path.lc-series')!.getAttribute('d')!.matchAll(/[ML]([-\d.]+),([-\d.]+)/g)].map((x) => [Number(x[1]), Number(x[2])]);
      const i = pts.findIndex(([x]) => x >= cx);
      expect(i).toBeGreaterThan(0);
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      expect(Math.abs(y0 + ((y1 - y0) * (cx - x0)) / (x1 - x0 || 1) - cy)).toBeLessThan(1);
      return [cx, cy];
    };
    const before = onCurve();
    const text = 'harika memnunum teşekkürler';
    player.setParams({ text });
    const after = onCurve();
    expect(after).not.toEqual(before);
    expect(el.querySelector('.prob-value')!.textContent).toBe(f(score(m, text).p, 3));
    expect(sigmoid(0)).toBe(0.5);
  });

  it('step 6 draws two panels and step 7 strikes the dropped word', () => {
    const { el, player } = setup();
    go(player, 'bigram');
    const shown = () => [...el.querySelectorAll('.score-panel:not([hidden])')].map((p) => p.getAttribute('data-model'));
    expect(shown()).toEqual(['uni-keep-train', 'bi-keep-train']);
    go(player, 'degil-tuzagi');
    expect(shown()).toEqual(['bi-drop-train']);
    expect(texts(el, '.token-chip.is-dropped')).toEqual(['değil']);
  });

  it('step 9 marks every chip out of vocabulary and shows the intercept note', () => {
    const { el, player } = setup();
    go(player, 'sozluk-kaymasi');
    const chips = el.querySelectorAll('.token-chip');
    expect(chips.length).toBeGreaterThan(0);
    expect(el.querySelectorAll('.token-chip.is-oov')).toHaveLength(chips.length);
    expect(el.querySelector('.panel-note:not([hidden])')!.textContent).toContain('yalnız kesişimden');
    expect(el.querySelectorAll('.contrib-bar')).toHaveLength(0);
  });

  it('an empty comment shows the note and no probability', () => {
    const { el, player } = setup();
    go(player, 'yorum-skor');
    player.setParams({ text: '' });
    expect(el.querySelector('.panel-note:not([hidden])')!.textContent).toBe('Boş yorum analiz edilemez.');
    expect(el.querySelector('.prob-line')!.hasAttribute('hidden')).toBe(true);
    expect(el.textContent).not.toMatch(/NaN|Infinity|undefined/);
  });

  it('step 5 draws the test matrix', () => {
    const { el, player } = setup();
    go(player, 'test-sonuc');
    expect(el.querySelector('.sa-stage')!.getAttribute('data-view')).toBe('result');
    const read = (k: string) => el.querySelector(`[data-cell="${k}"] .cell-count`)!.textContent;
    expect([read('tn'), read('fp'), read('fn'), read('tp')]).toEqual([m.matrix.tn, m.matrix.fp, m.matrix.fn, m.matrix.tp].map(String));
    expect(texts(el, '.matrix-col-name')).toEqual(['olumsuz', 'olumlu']);
    expect(el.querySelector('.metric[data-metric="accuracy"] .metric-value')!.textContent).toBe('%66,0');
    expect(texts(el, '.report-row .report-name')).toEqual(['olumsuz', 'olumlu']);
    expect(el.querySelector('.report-note')!.textContent).toContain('2 yorumla ölçülen başarı ölçüm değildir');
    expect(el.querySelector('.result-book a')!.getAttribute('href')).toBe('../dengesiz-veri/');
    player.setParams({ bigram: true });
    expect(el.querySelector('[data-cell="tn"] .cell-count')!.textContent).toBe(String(MODELS['bi-keep-train'].matrix.tn));
  });

  it('score panel fits 390 px without clipping', () => {
    const { el, player } = setup(390, 560);
    for (const id of ['yorum-skor', 'bigram', 'degil-tuzagi', 'sozluk-kaymasi']) {
      go(player, id);
      for (const panel of el.querySelectorAll('.score-panel:not([hidden])')) {
        expect(panel.getAttribute('data-layout')).toBe('stack');
        for (const svg of panel.querySelectorAll('svg')) {
          expect(num(svg, 'width')).toBeGreaterThan(0);
          expect(num(svg, 'width')).toBeLessThanOrEqual(390 - 24);
        }
        // the bar plot is as tall as its real row count, so no bar is cut
        const rows = [...panel.querySelectorAll('.contrib-bar')];
        const barSvg = panel.querySelector('.contrib-plot')!;
        if (rows.length > 0) expect(Math.max(...rows.map(translateY)) + 12).toBeLessThanOrEqual(num(barSvg, 'height'));
      }
    }
    // chips, lines and notes wrap instead of overflowing; the stage never scrolls sideways
    expect(css).toMatch(/\.token-chips \{[^}]*flex-wrap:wrap/);
    expect(css).toMatch(/\.token-chip \{[^}]*overflow-wrap:anywhere/);
    expect(css).toMatch(/\.z-line, \.prob-line, \.compare-line \{[^}]*overflow-wrap:anywhere/);
    expect(css).toMatch(/\.sa-host \{[^}]*overflow-x:hidden/);
    expect(css).toMatch(/@media \(max-width:900px\) \{\s*\.score-scene\[data-panels='2'\] \.score-panels \{ grid-template-columns:minmax\(0,1fr\)/);
  });
});
