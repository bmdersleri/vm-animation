// @vitest-environment jsdom
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { modelKaymasiScenario as sc } from '../../../src/concepts/model-kaymasi/scenario';
import { go, num, setup } from './harness';

const css = fs.readFileSync('src/concepts/model-kaymasi/model-kaymasi.css', 'utf8');
const IDS = sc.steps.map((s) => s.id);

/** Absolute position of an element inside its svg: the sum of the `translate` transforms of its ancestors. */
function offset(e: Element): { x: number; y: number; rotated: boolean } {
  let x = 0;
  let y = 0;
  let rotated = false;
  for (let n: Element | null = e; n && n.tagName.toLowerCase() !== 'svg'; n = n.parentElement) {
    const t = n.getAttribute('transform') ?? '';
    const m = /translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/.exec(t);
    if (m) {
      x += Number(m[1]);
      y += Number(m[2]);
    }
    if (/rotate/.test(t)) {
      rotated = true;
    }
  }
  return { x, y, rotated };
}

/** Every mark of the svg lies inside its width and height (text by the 0.62 em estimate jsdom's measure uses). */
function inside(svg: Element, fs: number, name: string): void {
  const W = num(svg, 'width');
  const H = num(svg, 'height');
  const eps = 1;
  for (const e of svg.querySelectorAll('rect, circle, line, text, path')) {
    if (e.closest('defs') || e.getAttribute('visibility') === 'hidden' || e.classList.contains('probe')) {
      continue;
    }
    const o = offset(e);
    if (o.rotated) {
      continue;
    }
    const tag = e.tagName.toLowerCase();
    const label = `${name} ${tag}.${e.getAttribute('class') ?? ''}`;
    if (tag === 'rect' && e.hasAttribute('width')) {
      expect(o.x + num(e, 'x'), `${label} left`).toBeGreaterThanOrEqual(-eps);
      expect(o.x + num(e, 'x') + num(e, 'width'), `${label} right`).toBeLessThanOrEqual(W + eps);
      expect(o.y + num(e, 'y') + num(e, 'height'), `${label} bottom`).toBeLessThanOrEqual(H + eps);
    } else if (tag === 'circle' && e.hasAttribute('cx')) {
      expect(o.x + num(e, 'cx') - num(e, 'r'), `${label} left`).toBeGreaterThanOrEqual(-eps);
      expect(o.x + num(e, 'cx') + num(e, 'r'), `${label} right`).toBeLessThanOrEqual(W + eps);
      expect(o.y + num(e, 'cy') + num(e, 'r'), `${label} bottom`).toBeLessThanOrEqual(H + eps);
    } else if (tag === 'line' && e.hasAttribute('x1')) {
      for (const a of ['x1', 'x2']) {
        expect(o.x + num(e, a), `${label} ${a}`).toBeGreaterThanOrEqual(-eps);
        expect(o.x + num(e, a), `${label} ${a}`).toBeLessThanOrEqual(W + eps);
      }
      expect(o.y + Math.max(num(e, 'y1'), num(e, 'y2')), `${label} bottom`).toBeLessThanOrEqual(H + eps);
    } else if (tag === 'text' && e.hasAttribute('x')) {
      const len = (e.textContent ?? '').length * fs * 0.62;
      const anchor = e.getAttribute('text-anchor') ?? 'start';
      const x = o.x + num(e, 'x');
      const left = anchor === 'end' ? x - len : anchor === 'middle' ? x - len / 2 : x;
      const right = anchor === 'end' ? x : anchor === 'middle' ? x + len / 2 : x + len;
      expect(left, `${label} "${e.textContent}" left`).toBeGreaterThanOrEqual(-eps);
      expect(right, `${label} "${e.textContent}" right`).toBeLessThanOrEqual(W + eps);
      expect(o.y + num(e, 'y'), `${label} "${e.textContent}" bottom`).toBeLessThanOrEqual(H + eps);
    }
  }
}

describe('narrow layout', () => {
  it('the stage flag follows the stage width, not the window', () => {
    // the Lab stage of a 1280 px window is about 745 px wide: every step takes the narrow layout
    const lab = setup(745, 530, 'lab');
    for (const id of IDS) {
      go(lab.player, id);
      expect(lab.el.querySelector('.kayma-stage')!.hasAttribute('data-narrow'), id).toBe(true);
    }
    const wide = setup(1280, 540, 'ders');
    for (const id of IDS) {
      go(wide.player, id);
      expect(wide.el.querySelector('.kayma-stage')!.hasAttribute('data-narrow'), id).toBe(false);
    }
    // only the strip's window-wide wrapping may stay in a media query; every scene rule keys on the stage flag
    const media = [...css.matchAll(/@media \(max-width:900px\) \{\n([\s\S]*?)\n\}\n/g)].map((m) => m[1]);
    expect(media.length).toBeLessThanOrEqual(1);
    for (const m of media) {
      expect(m).toMatch(/\.formula \.term/);
      expect(m).not.toMatch(/kayma-stage|monitor|threshold-table|psi/);
    }
    expect(css).toMatch(/\.stage:has\(\.kayma-stage\[data-tall\]\) \{ height:auto; overflow:visible; \}/);
  });

  it('the timeline uses the whole area and is taller than 100 px on a phone', () => {
    const { el } = setup(390, 520, 'lab');
    const svg = el.querySelector('svg.timeline')!;
    expect(num(svg, 'width')).toBeLessThanOrEqual(390);
    expect(num(svg, 'height')).toBeGreaterThan(100);
    const wide = setup(1280, 540, 'ders');
    expect(num(wide.el.querySelector('svg.timeline')!, 'height')).toBeGreaterThan(200);
  });

  for (const [w, h, mode] of [[390, 520, 'lab'], [745, 530, 'lab'], [1280, 540, 'ders']] as const) {
    it(`every svg mark stays inside its svg at ${w} px`, () => {
      const { el, player } = setup(w, h, mode);
      const fs = mode === 'ders' ? 18 : 13;
      for (const id of IDS) {
        go(player, id);
        const svgs = [...el.querySelectorAll('.kayma-host:not([hidden]) svg')];
        // the code step is HTML only
        expect(svgs.length > 0 || id === 'hata-ayiklama', id).toBe(true);
        for (const svg of svgs) {
          expect(num(svg, 'width'), `${id} width`).toBeLessThanOrEqual(w);
          inside(svg, fs, `${id}@${w}`);
        }
      }
    });
  }

  it('monitor, table and readout fit 390 px', () => {
    const { el, player } = setup(390, 520, 'lab');
    for (const id of ['aylik-izleme', 'esik-secimi']) {
      go(player, id);
      const stage = el.querySelector<HTMLElement>('.kayma-stage')!;
      expect(stage.hasAttribute('data-tall'), id).toBe(true);
      for (const svg of el.querySelectorAll('.monitor svg')) {
        expect(num(svg, 'width'), id).toBeLessThanOrEqual(390);
        // a plot a phone can read: not squashed
        expect(num(svg, 'height'), id).toBeGreaterThanOrEqual(220);
      }
    }
    expect(el.querySelector('.threshold-table')).not.toBeNull();
    expect(el.querySelector('.readout')).not.toBeNull();
  });

  it('psi bars and terms fit 390 px', () => {
    const { el, player } = setup(390, 520, 'lab');
    go(player, 'psi');
    const svg = el.querySelector('svg.psi-plot')!;
    expect(num(svg, 'width')).toBeLessThanOrEqual(390);
    // ten rows of two bars with room for the 13 px names: not squashed
    expect(num(svg, 'height')).toBeGreaterThanOrEqual(10 * 40);
    const widest = Math.max(...[...el.querySelectorAll('.psi-bar rect.bar')].map((r) => num(r, 'x') + num(r, 'width')));
    const termX = Math.min(...[...el.querySelectorAll('.psi-term')].map((t) => num(t, 'x')));
    expect(widest).toBeLessThanOrEqual(termX);
    // the value written after each bar ("0,256", "q = 0") also ends before the term column: bar end + 6 px gap + its text
    for (const g of el.querySelectorAll('.psi-bar')) {
      const bar = g.querySelector('rect.bar')!;
      const value = g.querySelector('.bar-value')!;
      const end = num(value, 'x') + (value.textContent ?? '').length * 16 * 0.62;
      expect(end, `${g.getAttribute('data-kind')}${g.getAttribute('data-bin')} value`).toBeLessThanOrEqual(termX + 0.5);
      expect(num(value, 'x')).toBeGreaterThanOrEqual(num(bar, 'x') + num(bar, 'width'));
    }
  });

  for (const [w, h, mode] of [[390, 520, 'lab'], [745, 530, 'lab'], [1280, 540, 'ders']] as const) {
    it(`alarm flow fits ${w} px: boxes inside the area, none overlapping`, () => {
      const { el, player } = setup(w, h, mode);
      go(player, 'alarm-akisi');
      const svg = el.querySelector('svg.alarm-flow')!;
      const W = num(svg, 'width');
      const H = num(svg, 'height');
      expect(W).toBeLessThanOrEqual(w);
      const boxes = [...el.querySelectorAll('.flow-node')].map((n) => {
        const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(n.getAttribute('transform')!)!;
        const shape = n.querySelector('.flow-shape')!;
        const d = shape.getAttribute('d') ?? '';
        const rect = shape.tagName === 'rect';
        const bw = rect ? num(shape, 'width') : 2 * Math.max(...[...d.matchAll(/(-?[\d.]+),0/g)].map((x) => Math.abs(Number(x[1]))));
        const bh = rect ? num(shape, 'height') : 2 * Math.abs(Number(/M0,(-?[\d.]+)/.exec(d)![1]));
        return { name: n.getAttribute('data-node')!, x: Number(m[1]), y: Number(m[2]), bw, bh };
      });
      expect(boxes).toHaveLength(9);
      for (const b of boxes) {
        expect(b.x - b.bw / 2, `${b.name} left`).toBeGreaterThanOrEqual(0);
        expect(b.x + b.bw / 2, `${b.name} right`).toBeLessThanOrEqual(W);
        expect(b.y - b.bh / 2, `${b.name} top`).toBeGreaterThanOrEqual(0);
        expect(b.y + b.bh / 2, `${b.name} bottom`).toBeLessThanOrEqual(H);
      }
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i];
          const b = boxes[j];
          const apart = Math.abs(a.x - b.x) >= (a.bw + b.bw) / 2 || Math.abs(a.y - b.y) >= (a.bh + b.bh) / 2;
          expect(apart, `${a.name} / ${b.name} at ${w}`).toBe(true);
        }
      }
    });
  }
});
