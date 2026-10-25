// @vitest-environment jsdom
import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { go, setup } from './harness';

const css = fs.readFileSync('src/concepts/shap-degerleri/shap-degerleri.css', 'utf8');
const IDS = ['kara-kutu', 'genel-onem', 'koalisyon', 'marjinal', 'alti-siralama', 'toplam', 'kuvvet', 'global', 'ozet-grafik', 'sinirlar'];

describe('narrow layout', () => {
  it('the stage flag follows the stage width, not the window', () => {
    // the Lab stage of a 1280 px window is about 745 px wide: every step takes the narrow layout
    const lab = setup(745, 530, 'lab');
    for (const id of IDS) {
      go(lab.player, id);
      expect(lab.el.querySelector('.shap-stage')!.hasAttribute('data-narrow'), id).toBe(true);
    }
    const wide = setup(1280, 540, 'ders');
    for (const id of IDS) {
      go(wide.player, id);
      expect(wide.el.querySelector('.shap-stage')!.hasAttribute('data-narrow'), id).toBe(false);
    }
    // only the strip's window-wide wrapping stays in a media query; every scene rule keys on the stage flag
    const media = [...css.matchAll(/@media \(max-width:900px\) \{\n([\s\S]*?)\n\}\n/g)].map((m) => m[1]);
    expect(media).toHaveLength(1);
    expect(media[0]).toMatch(/\.formula \.term/);
    expect(media[0]).not.toMatch(/(card|lattice|force|swarm|cards)-scene|\.lattice|\.order|\.text-card|\.bars/);
    expect(css).toMatch(/\.shap-stage\[data-narrow\] \.lattice-scene\[data-part='orders'\] \{ grid-template-columns:minmax\(0,1fr\)/);
    expect(css).toMatch(/\.shap-stage\[data-narrow\] \.text-cards \{ grid-template-columns:minmax\(0,1fr\)/);
    // one mechanism: no scene sets a flag of its own
    expect(css).not.toMatch(/\.card-scene\[data-narrow\]/);
  });

  it('the narrow lattice padding matches the width the lattice takes', () => {
    // the narrow lattice is the stage width minus 8 px: the scene's side padding must be 4 px
    expect(css).toMatch(/\.shap-stage\[data-narrow\] \.lattice-scene \{[^}]*padding:10px 4px/);
    const { el, player } = setup(745, 530, 'lab');
    go(player, 'marjinal');
    expect(Number(el.querySelector('.lattice-plot')!.getAttribute('width'))).toBeLessThanOrEqual(745 - 8);
  });

  it('the step 1 code strip breaks only after a bracket or a dot, never inside an identifier', () => {
    const { el, player } = setup(390, 520, 'lab');
    go(player, 'kara-kutu');
    const terms = [...el.querySelectorAll('.formula .term')];
    const code = terms.find((t) => t.textContent!.includes('predict_proba'))!;
    expect(code.querySelectorAll('wbr').length).toBeGreaterThanOrEqual(2);
    for (const w of el.querySelectorAll('.formula wbr')) {
      expect(w.previousSibling!.textContent).toMatch(/(\(|[A-Za-z_]\.)$/);
    }
    expect(css).toMatch(/\.shap-scene \.formula \.term \{ white-space:normal; overflow-wrap:normal; \}/);
    expect(css).not.toMatch(/\.formula \.term \{[^}]*overflow-wrap:anywhere/);
  });
});
