// @vitest-environment jsdom
import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { HATALAR } from '../../../src/concepts/duygu-analizi/calc';
import { go, setup, texts } from './harness';

// badges sit on their lines, so the DOM order is the line order (bug 4's line comes before bugs 2 and 3)
const badges = (el: HTMLElement) => [...el.querySelectorAll('.bug-badge')].map((b) => b.getAttribute('data-bug')).sort();

describe('code scene (step 10)', () => {
  it('step 10 sweep marks four bugs', () => {
    const { el, player } = setup();
    go(player, 'hata-ayiklama');
    expect(el.querySelector('.sa-stage')!.getAttribute('data-view')).toBe('code');
    expect(HATALAR).toHaveLength(4);
    const lines = [...el.querySelectorAll('.code-line')];
    expect(lines.map((l) => l.querySelector('.code-no')!.textContent)).toEqual(lines.map((_, i) => String(i + 1)));
    const marked: number[] = [];
    for (let n = 1; n <= 4; n++) {
      player.setParam('bug', n);
      expect(badges(el)).toEqual(['1', '2', '3', '4'].slice(0, n));
      marked.push(el.querySelectorAll('.code-line.is-bug').length);
      expect(el.querySelectorAll('.code-line.is-current')).toHaveLength(1);
    }
    expect(marked).toEqual([1, 2, 3, 4]);
    const bugText = texts(el, '.code-line.is-bug .code-text').join('\n');
    expect(bugText).toContain('yorumlar = "internet kötü", "destek iyi"');
    expect(bugText).toContain('fit_transform("")');
    expect(bugText).toContain('print(matris[2])');
    expect(bugText).toContain('durak_kelimeler = ["ve", "ile"]');
    expect(el.querySelectorAll('.code-fixed')).toHaveLength(0);
  });

  it('the sweep ends on the corrected code, and the notes stay', () => {
    const { el, player } = setup();
    go(player, 'hata-ayiklama');
    player.setParam('bug', 5);
    expect(el.querySelectorAll('.bug-badge')).toHaveLength(0);
    expect(el.querySelector('.code-title')!.textContent).toBe('Düzeltilmiş kod');
    expect(el.querySelector('.exam-note')!.textContent).toContain("'Model çalıştı' ifadesi, modelin güvenilir olduğu anlamına gelmez.");
    expect([...el.querySelectorAll('.code-links a')].map((a) => a.getAttribute('href'))).toEqual(['../tfidf-kosinus/', '../smote-sizinti/']);
  });

  it('fixed toggle shows the corrected code', () => {
    const { el, player } = setup();
    go(player, 'hata-ayiklama');
    player.setParams({ bug: 4, fixed: false });
    expect(el.querySelectorAll('.code-fixed')).toHaveLength(0);
    player.setParam('fixed', true);
    const fixed = texts(el, '.code-line.code-fixed .code-text').join('\n');
    expect(fixed).toContain('yorumlar = ["internet kötü", "destek iyi"]');
    expect(fixed).toContain('fit_transform(yorumlar)');
    expect(fixed).toContain('print(matris[0].toarray())');
    expect(el.querySelectorAll('.is-fix').length).toBeGreaterThanOrEqual(4);
    player.setParam('fixed', false);
    expect(el.querySelectorAll('.code-fixed')).toHaveLength(0);
  });

  it('the page CSS leaves the shared code panel rules to core/plot/code-panel.css', () => {
    const css = fs.readFileSync('src/concepts/duygu-analizi/duygu-analizi.css', 'utf8');
    expect(css).not.toMatch(/^\.code-(scene|pre|line|no|title)\b/m);
  });
});
