// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { OUTPUT } from '../../../src/concepts/crisp-dm/code-text';
import { BOOK } from '../../../src/concepts/crisp-dm/data';
import { go, setup, texts } from './harness';

describe('code scene', () => {
  it('step 10 sweep marks six bugs then shows the fix', () => {
    const { el, player } = setup();
    go(player, 'hata-ayiklama', false);
    for (let n = 1; n <= 6; n += 1) {
      player.setParams({ scan: n });
      expect(el.querySelectorAll('.bug-badge')).toHaveLength(n);
    }
    expect(el.querySelector('.code-fixed')).toBeNull();
    expect(el.querySelector('.code-output')).toBeNull();
    player.setParams({ scan: 7 });
    expect(el.querySelectorAll('.code-fixed').length).toBeGreaterThan(0);
    expect(texts(el, '.code-output .output-line')).toEqual([...OUTPUT]);
    expect(el.querySelector('.code-note')!.textContent).toBe(`ortalamaya giren ${BOOK.kafeAnalizi.used} değer`);
    const hrefs = [...el.querySelectorAll('.code-links a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['../model-kaymasi/', '../dagilim-carpiklik/']);
  });

  it('fixed toggle shows the corrected code', () => {
    const { el, player } = setup(745, 530, 'lab');
    go(player, 'hata-ayiklama');
    expect(el.querySelector('.code-fixed')).toBeNull();
    expect(el.querySelectorAll('.bug-badge')).toHaveLength(6);
    player.setParams({ fixed: true });
    expect(el.querySelectorAll('.code-fixed').length).toBeGreaterThan(0);
    expect(texts(el, '.code-output .output-line')).toEqual([...OUTPUT]);
    player.setParams({ fixed: false });
    expect(el.querySelector('.code-fixed')).toBeNull();
  });
});
