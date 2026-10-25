// @vitest-environment jsdom
import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { narrowTableHeight, TABLE_LINE, TABLE_PAD, TABLE_SPACING } from '../../../src/concepts/lime-yerel/pattern-table';
import { go, num, setup, themeFonts } from './harness';

const css = fs.readFileSync('src/concepts/lime-yerel/lime-yerel.css', 'utf8');

const SCENES: [string, string][] = [
  ['kartil', '.bins-scene'],
  ['komsuluk', '.cloud-scene'],
  ['ikili', '.cloud-scene'],
  ['cekirdek', '.kernel-scene'],
  ['vekil', '.surrogate-scene'],
  ['sadakat', '.surrogate-scene'],
  ['kararlilik', '.stability-scene'],
  ['shap-lime', '.compare-scene'],
  ['hata-ayiklama', '.codeview-scene'],
];

describe('narrow layout', () => {
  it('every scene of steps 2-10 fits the narrow stage height', () => {
    // 470 px of scene minus the strip leaves a stage of about 380 px, as in the 390 x 844 screenshots
    themeFonts('narrow');
    const { el, player } = setup(390, 450, 'lab');
    for (const [id, sel] of SCENES) {
      go(player, id);
      const avail = Number(el.querySelector('.lime-stage')!.getAttribute('data-avail'));
      const used = Number(el.querySelector(sel)!.getAttribute('data-used'));
      expect(avail, id).toBeGreaterThan(300);
      expect(used, id).toBeGreaterThan(0);
      expect(used, `${id}: ${used} <= ${avail}`).toBeLessThanOrEqual(avail);
    }
  });

  it('every scene of steps 2-10 fits the 1280 px stage height', () => {
    themeFonts('wide');
    const { el, player } = setup(1280, 540, 'ders');
    for (const [id, sel] of SCENES) {
      go(player, id);
      const avail = Number(el.querySelector('.lime-stage')!.getAttribute('data-avail'));
      const used = Number(el.querySelector(sel)!.getAttribute('data-used'));
      expect(used, `${id}: ${used} <= ${avail}`).toBeLessThanOrEqual(avail);
    }
  });

  it('every scene of steps 1-10 fits the Lab stage of a 1280 px window (about 745 x 530)', () => {
    // the Lab stage is narrower than the window: the layout follows the stage box, and the stage flag is set
    themeFonts('narrow');
    const { el, player } = setup(745, 530, 'lab');
    for (const [id, sel] of [['yerel-soru', '.flow-scene'], ...SCENES]) {
      go(player, id);
      expect(el.querySelector('.lime-stage')!.hasAttribute('data-narrow'), id).toBe(true);
      const avail = Number(el.querySelector('.lime-stage')!.getAttribute('data-avail'));
      const used = Number(el.querySelector(sel)!.getAttribute('data-used') ?? 0);
      expect(used, `${id}: ${used} <= ${avail}`).toBeLessThanOrEqual(avail);
    }
  });

  it('the stage flag follows the stage width, not the window', () => {
    themeFonts('wide');
    const wide = setup(1280, 540, 'ders');
    go(wide.player, 'cekirdek');
    expect(wide.el.querySelector('.lime-stage')!.hasAttribute('data-narrow')).toBe(false);
    // only the strip and its window-wide wrapping stay in a media query; every scene rule keys on the stage flag
    const media = [...css.matchAll(/@media \(max-width:900px\) \{\n([\s\S]*?)\n\}\n/g)].map((m) => m[1]);
    expect(media).toHaveLength(1);
    expect(media[0]).toMatch(/\.formula \.term/);
    expect(media[0]).not.toMatch(/(flow|bins|cloud|kernel|surrogate|stability|compare|codeview)-scene|\.pattern|\.compare|\.code/);
  });

  it('the step 1 strip breaks only at spaces and after a bracket or a dot, never inside an identifier', () => {
    const { el } = setup(390, 450, 'lab');
    const terms = [...el.querySelectorAll('.formula .term')];
    const code = terms.find((t) => t.textContent!.includes('explain_instance'))!;
    expect(code.querySelectorAll('wbr').length).toBeGreaterThanOrEqual(2);
    for (const w of code.querySelectorAll('wbr')) {
      expect(w.previousSibling!.textContent).toMatch(/(\(|[A-Za-z_]\.)$/);
    }
    expect(css).toMatch(/\.formula \.term \{ white-space:normal; overflow-wrap:normal; \}/);
    expect(el.querySelector('.formula')!.textContent).toContain('explain_instance(musteri, predict_proba, num_features=3)');
  });

  it('narrow table height follows its metrics', () => {
    // caption + two-line header + eight rows of one line with padding and spacing
    expect(narrowTableHeight(12)).toBe(Math.ceil(14.4 + 2 + (2 * 11 * 1.2 + 3) + 8 * (14.4 + 3) + 1 + 6));
    // a table row is at most 18 px with the 12 px font
    expect(12 * TABLE_LINE + 2 * TABLE_PAD + TABLE_SPACING).toBeLessThanOrEqual(18);
  });

  it('the narrow css keeps the table metrics, the two-column flow and the camel-case header', () => {
    expect(css).toMatch(/\[data-narrow\] \.pattern-table \{[^}]*line-height:1\.2; border-spacing:1px/);
    expect(css).toMatch(/\[data-narrow\] \.pattern-head, [^{]*\{[^}]*padding:1px 2px/);
    expect(css).toMatch(/\[data-narrow\] \.flow-scene \{ display:grid; grid-template-columns:repeat\(2/);
    expect(css).toMatch(/\[data-narrow\] \.pattern-head \{ overflow-wrap:normal; word-break:keep-all/);
  });

  it('the pattern header breaks only at the camel-case capital', () => {
    const { el, player } = setup(390, 470, 'lab');
    go(player, 'cekirdek');
    const heads = [...el.querySelectorAll('.kernel-scene thead .pattern-head .feature-name')];
    expect(heads.map((h) => h.textContent)).toEqual(['tenure', 'MonthlyCharges', 'TotalCharges']);
    expect(heads.map((h) => h.querySelectorAll('wbr').length)).toEqual([0, 1, 1]);
  });

  it('cut labels of one level never overlap', () => {
    for (const w of [390, 1280]) {
      const { el, player } = setup(w, 470, 'lab');
      go(player, 'kartil');
      for (const row of el.querySelectorAll('.bins-row')) {
        const labels = [...row.querySelectorAll('.bin-cut-label')].map((t) => ({
          x: num(t, 'x'),
          y: num(t, 'y'),
          w: t.textContent!.length * 0.62 * 13,
        }));
        for (let i = 0; i < labels.length; i++) {
          for (let j = i + 1; j < labels.length; j++) {
            if (labels[i].y === labels[j].y) {
              expect(Math.abs(labels[i].x - labels[j].x)).toBeGreaterThanOrEqual((labels[i].w + labels[j].w) / 2);
            }
          }
        }
      }
    }
  });

  it('the cloud and kernel plots keep at least 150 px at 390 px, and the kernel weights keep apart', () => {
    themeFonts('narrow');
    const { el, player } = setup(390, 450, 'lab');
    for (const [id, sel] of [
      ['ikili', '.cloud-plot'],
      ['cekirdek', '.kernel-plot'],
    ]) {
      go(player, id);
      expect(num(el.querySelector(sel)!, 'height'), id).toBeGreaterThanOrEqual(150);
    }
    const labels = [...el.querySelectorAll('.kernel-weight')].map((t) => ({ x: num(t, 'x'), w: t.textContent!.length * 0.62 * 13 }));
    expect(labels).toHaveLength(4);
    for (let i = 1; i < labels.length; i++) {
      expect(labels[i].x - labels[i - 1].x).toBeGreaterThanOrEqual((labels[i].w + labels[i - 1].w) / 2);
    }
    // the colour legend is dropped on a narrow stage, the strip names the colour
    go(player, 'ikili');
    expect(el.querySelector('.cloud-legend')!.hasAttribute('hidden')).toBe(true);
    for (const t of el.querySelectorAll('.kernel-weight')) {
      expect(t.textContent).not.toMatch(/NaN/);
    }
  });
});
