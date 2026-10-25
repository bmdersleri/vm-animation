// @vitest-environment jsdom
import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { BOOK } from '../../../src/concepts/xai/data';
import { BOOK_TIP } from '../../../src/concepts/lime-yerel/view';
import { go, setup, texts, themeFonts } from './harness';

const css = fs.readFileSync('src/concepts/lime-yerel/lime-yerel.css', 'utf8');
/** Bug numbers on the page, sorted (the DOM lists them by line: bug 5 sits on the line before bug 4). */
const badges = (el: Element) => [...el.querySelectorAll('.bug-badge')].map((b) => b.getAttribute('data-bug')).sort();

describe('code scene', () => {
  it('step 10 sweep marks five bugs', () => {
    const { el, player } = setup();
    go(player, 'hata-ayiklama', false);
    expect(el.querySelector('.lime-stage')!.getAttribute('data-view')).toBe('code');
    const lines = [...el.querySelectorAll('.code-line')];
    expect(lines).toHaveLength(17);
    expect(lines.map((l) => l.querySelector('.code-no')!.textContent)).toEqual(lines.map((_, i) => String(i + 1)));
    // the book's code, comments included
    expect(texts(el, '.code-text').slice(0, 4)).toEqual([
      '# File: HataAyiklama.python',
      '# Bu kod, yerel açıklama hazırlarken çeşitli mantık ve tür hataları içermektedir.',
      '# Amaç hataları tanımlamak ve güvenilir bir açıklama üretmektir.',
      '# Çıktı satırı ayrıca yanlış değişken kullanmaktadır.',
    ]);
    const kinds = ['tür hatası', 'mantık hatası', 'indeksleme hatası', 'mantık hatası', 'veri biçimi hatası'];
    const bugLine = ['model = RandomForestClassifier', 'test_ozellikleri.iloc[0]', 'predict_proba(musteri)[1]', 'tahmin_olasiligi', 'shap_values(musteri)'];
    for (let n = 1; n <= 5; n++) {
      player.setParams({ scan: n });
      expect(badges(el)).toEqual(['1', '2', '3', '4', '5'].slice(0, n));
      expect(el.querySelectorAll('.code-line.is-bug')).toHaveLength(n);
      const current = el.querySelector('.code-line.is-current')!;
      // the latest bug's line is the current one
      expect(current.querySelector('.bug-badge:last-child')!.getAttribute('data-bug')).toBe(String(n));
      expect(current.querySelector('.code-text')!.textContent).toContain(bugLine[n - 1]);
      expect(current.querySelector('.bug-badge')!.textContent).toContain(kinds[n - 1]);
    }
    expect(el.querySelectorAll('.code-fixed')).toHaveLength(0);
    // a finished sweep keeps all five marks (the corrected code needs sweep position six or the Lab switch)
    player.setParams({ scan: Number.POSITIVE_INFINITY });
    expect(badges(el)).toHaveLength(5);
    expect(el.querySelectorAll('.code-fixed')).toHaveLength(0);
    // the bug marks are navy / neutral, not the orange of a positive contribution
    expect(css).toMatch(/\.codeview-scene \.code-line\.is-bug \{[^}]*var\(--navy\)/);
    expect(css).not.toMatch(/\.codeview-scene[^{]*\{[^}]*#E07B00/i);
  });

  it('fixed toggle shows the corrected code', () => {
    const { el, player } = setup();
    go(player, 'hata-ayiklama');
    player.setParam('fixed', true);
    const lines = [...el.querySelectorAll('.code-line.code-fixed')];
    expect(lines).toHaveLength(20);
    expect(el.querySelectorAll('.bug-badge')).toHaveLength(0);
    const code = texts(el, '.code-text');
    expect(code).toContain('model = RandomForestClassifier(n_estimators=100, random_state=42)');
    expect(code).toContain('musteri = test_ozellikleri.iloc[[0]]');
    expect(code).toContain('olasilik = model.predict_proba(musteri)[0, 1]');
    expect(code).toContain('print(f"Olasılık: %{olasilik * 100:.1f}")');
    // the output comment carries this data's probability, not the book's printed number
    expect(code[code.length - 1]).toBe(`# Çıktı: Olasılık: %${(BOOK.fixedCodeP * 100).toFixed(1)}`);
    expect(el.querySelectorAll('.code-line.is-fix')).toHaveLength(4);
    expect(el.querySelector('.formula')!.textContent).toContain('0,960');
    player.setParam('fixed', false);
    expect(el.querySelectorAll('.code-fixed')).toHaveLength(0);
    expect(el.querySelectorAll('.code-line.is-bug')).toHaveLength(5);
    // sweep position six brings the corrected code in the Ders as well
    player.setParams({ scan: 6 });
    expect(el.querySelectorAll('.code-fixed')).toHaveLength(20);
  });

  it('the closing tip and the two page links sit beside the code', () => {
    const { el, player } = setup();
    go(player, 'hata-ayiklama');
    expect(el.querySelector('.code-tip')!.textContent).toContain(BOOK_TIP);
    expect([...el.querySelectorAll('.code-links a')].map((a) => a.getAttribute('href'))).toEqual(['../shap-degerleri/', '../smote-sizinti/']);
  });

  it('the panel fits the stage and scrolls inside its own box at 390 and 1280 px', () => {
    for (const [w, h, font] of [
      [390, 450, 'narrow'],
      [1280, 540, 'wide'],
    ] as const) {
      themeFonts(font);
      const { el, player } = setup(w, h, font === 'wide' ? 'ders' : 'lab');
      go(player, 'hata-ayiklama');
      for (const fixed of [false, true]) {
        player.setParam('fixed', fixed);
        const avail = Number(el.querySelector('.lime-stage')!.getAttribute('data-avail'));
        const used = Number(el.querySelector('.codeview-scene')!.getAttribute('data-used'));
        expect(used, `${w} fixed=${fixed}: ${used} <= ${avail}`).toBeLessThanOrEqual(avail);
        const pre = el.querySelector<HTMLElement>('.code-pre')!;
        expect(Number.parseFloat(pre.style.maxHeight)).toBeGreaterThan(60);
      }
    }
    // long lines wrap inside the panel, the page never scrolls sideways
    expect(css).toMatch(/\.codeview-scene[^{]*\.code-pre[^}]*overflow-x:auto/);
  });
});
