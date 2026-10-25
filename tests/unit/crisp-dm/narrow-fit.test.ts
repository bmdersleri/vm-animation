// @vitest-environment jsdom
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { go, num, setup } from './harness';

const css = fs.readFileSync('src/concepts/crisp-dm/crisp-dm.css', 'utf8');
const IDS = ['sorun', 'is-anlama', 'veri-anlama', 'veri-yeterli', 'eksik-sifir-degil', 'sizinti', 'modelleme', 'degerlendirme', 'ikinci-tur', 'hata-ayiklama'];

describe('narrow layout', () => {
  it('the stage flag follows the stage width, not the window', () => {
    // the Lab stage of a 1280 px window is about 745 px wide: every step takes the narrow layout
    const lab = setup(745, 530, 'lab');
    for (const id of IDS) {
      go(lab.player, id);
      expect(lab.el.querySelector('.crisp-stage')!.hasAttribute('data-narrow'), id).toBe(true);
    }
    const wide = setup(1280, 540, 'ders');
    for (const id of IDS) {
      go(wide.player, id);
      expect(wide.el.querySelector('.crisp-stage')!.hasAttribute('data-narrow'), id).toBe(false);
    }
    // only the strip's window-wide wrapping may stay in a media query; every scene rule keys on the stage flag
    const media = [...css.matchAll(/@media \(max-width:900px\) \{\n([\s\S]*?)\n\}\n/g)].map((m) => m[1]);
    expect(media.length).toBeLessThanOrEqual(1);
    for (const m of media) {
      expect(m).toMatch(/\.formula \.term/);
      expect(m).not.toMatch(/crisp-stage|phase-card|result-board|cafe-table/);
    }
    expect(css).toMatch(/\.crisp-stage\[data-narrow\] \{[^}]*grid-template-rows:var\(--cycle-h\) minmax\(0,1fr\)/);
    expect(css).toMatch(/\.phase-card \{[^}]*overflow:auto/);
  });

  it('the cycle takes at most 48 percent of a narrow area', () => {
    const { el, player } = setup(390, 520, 'lab');
    go(player, 'modelleme');
    const stage = el.querySelector<HTMLElement>('.crisp-stage')!;
    const h = parseFloat(stage.style.getPropertyValue('--cycle-h'));
    expect(h).toBeGreaterThan(0);
    expect(h).toBeLessThanOrEqual(0.48 * 520);
    const svg = el.querySelector('svg.crisp-cycle')!;
    expect(num(svg, 'width')).toBeLessThanOrEqual(390);
    expect(num(svg, 'height')).toBeLessThanOrEqual(h);
  });

  for (const [w, h, mode] of [[390, 520, 'lab'], [1280, 540, 'ders']] as const) {
    it(`cycle and card fit ${w} px`, () => {
      const { el, player } = setup(w, h, mode);
      for (const id of IDS) {
        go(player, id);
        const svg = el.querySelector('svg.crisp-cycle')!;
        const sw = num(svg, 'width');
        const sh = num(svg, 'height');
        expect(sw, id).toBeLessThanOrEqual(w);
        expect(sh, id).toBeLessThanOrEqual(h);
        for (const p of el.querySelectorAll('.crisp-card-host svg')) {
          expect(num(p, 'width'), id).toBeLessThanOrEqual(w);
        }
        for (const n of el.querySelectorAll('.flow-node')) {
          const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(n.getAttribute('transform')!)!;
          const shape = n.querySelector('.flow-shape')!;
          const d = shape.getAttribute('d') ?? '';
          const hw = shape.tagName === 'rect' ? num(shape, 'width') / 2 : Math.max(...[...d.matchAll(/(-?[\d.]+),0/g)].map((x) => Math.abs(Number(x[1]))));
          const hh = shape.tagName === 'rect' ? num(shape, 'height') / 2 : Math.abs(Number(/M0,(-?[\d.]+)/.exec(d)![1]));
          const name = `${id} ${n.getAttribute('data-node')}`;
          expect(Number(m[1]) - hw, `${name} left`).toBeGreaterThanOrEqual(0);
          expect(Number(m[1]) + hw, `${name} right`).toBeLessThanOrEqual(sw);
          expect(Number(m[2]) - hh, `${name} top`).toBeGreaterThanOrEqual(0);
          expect(Number(m[2]) + hh, `${name} bottom`).toBeLessThanOrEqual(sh);
        }
      }
    });

    it(`cycle labels stay inside the svg at ${w}`, () => {
      const { el, player } = setup(w, h, mode);
      go(player, 'sorun');
      const svg = el.querySelector('svg.crisp-cycle')!;
      const sw = num(svg, 'width');
      const sh = num(svg, 'height');
      const labels = [...el.querySelectorAll('text.flow-edge-label')];
      expect(labels.length).toBe(4);
      for (const t of labels) {
        const x = num(t, 'x');
        const y = num(t, 'y');
        const est = (t.textContent ?? '').length * 0.62 * 13;
        const anchor = t.getAttribute('text-anchor');
        const l = anchor === 'end' ? x - est : anchor === 'middle' ? x - est / 2 : x;
        expect(l, t.textContent!).toBeGreaterThanOrEqual(0);
        expect(l + est, t.textContent!).toBeLessThanOrEqual(sw);
        expect(y - 13, t.textContent!).toBeGreaterThanOrEqual(0);
        expect(y, t.textContent!).toBeLessThanOrEqual(sh);
      }
    });
  }
});
