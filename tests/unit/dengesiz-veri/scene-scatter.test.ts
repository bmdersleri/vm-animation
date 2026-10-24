// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import '../svg-stubs';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { UNDEFINED_TEXT } from '../../../src/concepts/degerlendirme/ui';
import { dengesizVeriScenario as sc } from '../../../src/concepts/dengesiz-veri/scenario';
import { mountImbScene } from '../../../src/concepts/dengesiz-veri/scene';
import { labelBox, overlap } from '../../../src/core/plot/label-place';
import { splitLayout } from '../../../src/concepts/dengesiz-veri/scene-scatter';

const clean: (() => void)[] = [];
afterEach(() => {
  clean.splice(0).forEach((fn) => fn());
  document.body.replaceChildren();
});

function setup(w = 1280, h = 540) {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(sc);
  const scene = mountImbScene(el, player, 'ders', { durationScale: 0 });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { el, player };
}

const go = (player: StepPlayer<(typeof sc)['defaults']>, id: string) => player.goto(stepIndex(sc, id));
const count = (el: HTMLElement, sel: string) => el.querySelectorAll(sel).length;

describe('scatter scene', () => {
  it('step 1 draws 2000 points with 124 churners', () => {
    const { el } = setup();
    expect(el.querySelector('.imb-stage')!.getAttribute('data-view')).toBe('scatter');
    expect(count(el, 'circle.pt')).toBe(2000);
    expect(count(el, 'circle.pt.pos')).toBe(124);
    expect(el.querySelector('.imb-bar.neg .bar-value')!.textContent).toBe('1876');
    expect(el.querySelector('.imb-bar.pos .bar-value')!.textContent).toBe('124');
    expect(count(el, '.neighbour-line')).toBe(0);
  });

  it('step 3 shows undefined precision', () => {
    const { el, player } = setup();
    go(player, 'azinlik');
    expect(el.querySelector('.metric.precision .metric-value')!.textContent).toBe(UNDEFINED_TEXT);
    expect(el.querySelector('[data-cell="fn"] .cell-count')!.textContent).toBe('37');
    expect(el.querySelector('.book-line')!.textContent).toContain('classification_report');
  });

  it('step 4 leaves only the 1400 training points', () => {
    const { el, player } = setup();
    go(player, 'egitim');
    expect(count(el, 'circle.pt')).toBe(1400);
    expect(count(el, 'circle.pt.is-test')).toBe(0);
  });

  it('step 5 draws five neighbour lines and x new', () => {
    const { el, player } = setup();
    go(player, 'sentetik');
    expect(count(el, 'line.neighbour-line')).toBe(5);
    expect(count(el, 'line.chosen-line')).toBe(1);
    expect(count(el, 'circle.x-new')).toBe(1);
    expect(count(el, 'circle.x-i')).toBe(1);
  });

  it('step 5 strip shows both features with numbers', () => {
    const { el, player } = setup();
    go(player, 'sentetik');
    const strip = el.querySelector('.formula')!.textContent!;
    expect(strip).toContain('x_new = x_i + λ · (x_zi − x_i)');
    expect(strip).toMatch(/kıdem: \d+ \+ \d,\d\d · \(\d+ − \d+\) = \d+,\d ay/);
    expect(strip).toMatch(/aylık ücret: \d+,\d\d \+ \d,\d\d/);
  });

  it('steps 6-10 only reserve their view area', () => {
    const { el, player } = setup();
    go(player, 'smote-doldur');
    expect(el.querySelector('.imb-stage')!.getAttribute('data-view')).toBe('smote');
    go(player, 'sinir');
    expect(el.querySelector('.imb-stage')!.getAttribute('data-view')).toBe('boundary');
  });

  it('scatter and side panel fit 390 px without overlap', () => {
    const { el, player } = setup(390, 520);
    go(player, 'azinlik');
    const lay = splitLayout(390, 520, 380);
    expect(lay.narrow).toBe(true);
    expect(lay.scatter.x + lay.scatter.w).toBeLessThanOrEqual(390);
    expect(lay.side.x + lay.side.w).toBeLessThanOrEqual(390);
    expect(lay.side.y).toBeGreaterThanOrEqual(lay.scatter.y + lay.scatter.h);
    const wide = splitLayout(1280, 540, 380);
    expect(wide.scatter.x + wide.scatter.w).toBeLessThanOrEqual(wide.side.x);
    const svg = el.querySelector('svg.imb-plot')!;
    expect(Number(svg.getAttribute('width'))).toBe(390);
    expect(Number(svg.getAttribute('height'))).toBeGreaterThanOrEqual(lay.scatter.h);
    for (const c of el.querySelectorAll('circle.pt')) {
      expect(Number(c.getAttribute('cx'))).toBeLessThanOrEqual(390);
      expect(Number(c.getAttribute('cx'))).toBeGreaterThanOrEqual(0);
    }
  });
  it('step 5 labels x_i, x_zi and x_new sit apart from each other and from the marks', () => {
    const { el, player } = setup();
    go(player, 'sentetik');
    const labels = [...el.querySelectorAll('text.x-label')];
    expect(labels.map((l) => l.textContent).sort()).toEqual(['x_i', 'x_new', 'x_zi']);
    const fs = 18;
    const boxes = labels.map((l) =>
      labelBox(Number(l.getAttribute('x')), Number(l.getAttribute('y')), l.textContent!.length, l.getAttribute('text-anchor') as 'start', fs),
    );
    for (let a = 0; a < boxes.length; a++) {
      for (let b = a + 1; b < boxes.length; b++) {
        expect(overlap(boxes[a], boxes[b])).toBe(0);
      }
    }
    const marks = ['x-i', 'x-zi', 'x-new'].map((c) => {
      const m = el.querySelector(`circle.${c}`)!;
      return `${m.getAttribute('cx')}|${m.getAttribute('cy')}`;
    });
    expect(new Set(marks).size).toBe(3);
    for (const c of ['x-i', 'x-zi', 'x-new']) {
      const m = el.querySelector(`circle.${c}`)!;
      const cx = Number(m.getAttribute('cx'));
      const cy = Number(m.getAttribute('cy'));
      const r = Number(m.getAttribute('r'));
      const mark = { l: cx - r, t: cy - r, r: cx + r, b: cy + r };
      for (const box of boxes) {
        expect(overlap(box, mark)).toBe(0);
      }
    }
  });

  it('metric labels and values sit in separate columns', () => {
    const { el, player } = setup();
    go(player, 'azinlik');
    const fs = 18;
    const rows = [...el.querySelectorAll('.metric')];
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      const name = row.querySelector('.metric-name')!;
      const value = row.querySelector('.metric-value')!;
      const nameEnd = Number(name.getAttribute('x')) + name.textContent!.length * fs * 0.62;
      expect(Number(value.getAttribute('x'))).toBeGreaterThan(nameEnd);
      expect(name.textContent!.length).toBeGreaterThan(0);
    }
  });

  it('the book code line wraps at commas and never runs past the column', () => {
    const { el, player } = setup(900, 420);
    go(player, 'azinlik');
    const lines = [...el.querySelectorAll('text.book-line')];
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.map((l) => l.textContent).join(' ')).toContain('classification_report');
    const svgW = Number(el.querySelector('svg.imb-plot')!.getAttribute('width'));
    // the side column is 40 % of the width; the estimate is 0,62 em per character at jsdom's 16 px
    const column = Math.max(300, Math.min(560, Math.round(svgW * 0.4)));
    for (const l of lines) {
      expect(l.textContent!.length * 16 * 0.62).toBeLessThanOrEqual(column - 8);
    }
  });
});
