// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { formatNumber as f } from '../../../src/core/plot/format';
import { BOOK } from '../../../src/concepts/model-kaymasi/data';
import { go, num, setup, texts } from './harness';

describe('number lines (steps 2-3)', () => {
  it('step 2 draws the two book periods and their means', () => {
    const { el, player } = setup();
    go(player, 'iki-donem');
    const dots = (period: string) => [...el.querySelectorAll(`.nl-dot[data-period="${period}"]`)];
    expect(dots('ref')).toHaveLength(BOOK.reference.length);
    expect(dots('cur')).toHaveLength(BOOK.current.length);
    expect(dots('ref').map((d) => num(d, 'data-value'))).toEqual(BOOK.reference);
    expect(el.querySelector('.mean-mark[data-period="ref"]')!.textContent).toContain(f(BOOK.refMean, 2));
    expect(el.querySelector('.mean-mark[data-period="cur"]')!.textContent).toContain(f(BOOK.curMean, 2));
    expect(el.querySelector('.diff-bridge')).not.toBeNull();
    // the reference period is drawn left of the current one: its dots have the smaller x on average
    const meanX = (ds: Element[]) => ds.reduce((a, d) => a + num(d, 'cx'), 0) / ds.length;
    expect(meanX(dots('ref'))).toBeLessThan(meanX(dots('cur')));
    expect(el.querySelector('.esik-line')).toBeNull();
  });

  it('step 2 sweep shows the reference period alone first', () => {
    const { el, player } = setup();
    go(player, 'iki-donem', false);
    player.setParams({ scan: 1 });
    expect(el.querySelectorAll('.nl-dot[data-period="cur"]')).toHaveLength(0);
    expect(el.querySelectorAll('.nl-dot[data-period="ref"]')).toHaveLength(BOOK.reference.length);
    expect(el.querySelector('.mean-mark[data-period="cur"]')).toBeNull();
  });

  it('step 3 reads 14,40 > 8,0 and shows UYARI', () => {
    const { el, player } = setup();
    go(player, 'fark-esik');
    expect(el.querySelector('.formula')!.textContent).toContain(`${f(BOOK.diff, 2)} > ${f(BOOK.esik, 1)}`);
    const badge = el.querySelector('.status-badge')!;
    expect(badge.getAttribute('data-status')).toBe('UYARI');
    expect(badge.textContent).toContain('UYARI');
    // a non-colour cue: the triangle
    expect(badge.querySelector('path')!.getAttribute('d')).toMatch(/^M0,/);
    expect(el.querySelector('.diff-mark')!.textContent).toContain(f(BOOK.diff, 2));
    expect(el.querySelector('.esik-line')).not.toBeNull();
    expect(texts(el, '.esik-label')[0]).toContain(f(BOOK.esik, 1));
  });

  it('esik above the difference shows NORMAL', () => {
    const { el, player } = setup(745, 530, 'lab');
    go(player, 'fark-esik');
    player.setParams({ esik: 15 });
    const badge = el.querySelector('.status-badge')!;
    expect(badge.getAttribute('data-status')).toBe('NORMAL');
    expect(badge.textContent).toContain('NORMAL');
    expect(badge.querySelector('circle')).not.toBeNull();
    expect(badge.querySelector('path')).toBeNull();
    expect(el.querySelector('.formula')!.textContent).toContain('≤');
  });
});
