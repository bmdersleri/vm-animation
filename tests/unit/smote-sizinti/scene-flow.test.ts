// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import '../svg-stubs';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { labelBox, overlap, type Box } from '../../../src/core/plot/label-place';
import { LEAK_EXAMPLE } from '../../../src/concepts/dengesiz/data';
import { smoteSizintiScenario as sc } from '../../../src/concepts/smote-sizinti/scenario';
import { mountLeakScene } from '../../../src/concepts/smote-sizinti/scene';

const clean: (() => void)[] = [];
afterEach(() => {
  clean.splice(0).forEach((fn) => fn());
  document.body.replaceChildren();
});

function setup(w = 1280, h = 540) {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(sc);
  const scene = mountLeakScene(el, player, 'ders', { durationScale: 0 });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { el, player };
}

const go = (player: StepPlayer<(typeof sc)['defaults']>, id: string) => player.goto(stepIndex(sc, id));
const num = (e: Element, a: string) => Number(e.getAttribute(a));
const rectOf = (e: Element): Box => ({ l: num(e, 'x'), t: num(e, 'y'), r: num(e, 'x') + num(e, 'width'), b: num(e, 'y') + num(e, 'height') });
const inside = (a: Box, outer: Box) => a.l >= outer.l - 0.5 && a.t >= outer.t - 0.5 && a.r <= outer.r + 0.5 && a.b <= outer.b + 0.5;

describe('flow scene', () => {
  it('step 1 draws two rows with smote inside the training box on the right order', () => {
    const { el } = setup();
    expect(el.querySelector('.leak-stage')!.getAttribute('data-view')).toBe('flow');
    const rows = [...el.querySelectorAll('.flow-row')];
    expect(rows.map((r) => r.getAttribute('data-order'))).toEqual(['yanlis', 'dogru']);
    expect(rows.map((r) => r.querySelectorAll('.flow-box').length)).toEqual([5, 5]);
    expect(rows[0].querySelector('.train-only')).toBeNull();
    const frame = rectOf(rows[1].querySelector('.train-only')!);
    const smote = rectOf(rows[1].querySelector('.flow-box[data-kind="smote"]')!);
    const egit = rectOf(rows[1].querySelector('.flow-box[data-kind="egit"]')!);
    const test = rectOf(rows[1].querySelector('.flow-box[data-kind="test"]')!);
    expect(inside(smote, frame)).toBe(true);
    expect(inside(egit, frame)).toBe(true);
    expect(overlap(test, frame)).toBe(0);
    // on the wrong order SMOTE comes right after the data box, before the split
    const kinds = [...rows[0].querySelectorAll('.flow-box')].map((b) => b.getAttribute('data-kind'));
    expect(kinds).toEqual(['veri', 'smote', 'bol', 'egit', 'test']);
  });

  it('step 2 splits the test churn bar into real and synthetic', () => {
    const { el, player } = setup();
    go(player, 'once-smote');
    expect(el.querySelectorAll('.flow-row')).toHaveLength(1);
    const synth = el.querySelector('.flow-bar.bar-synth')!;
    const real = el.querySelector('.flow-bar.bar-real')!;
    expect(synth.querySelector('.bar-value')!.textContent).toBe('529 (505 sentetik)');
    const wSynth = num(synth.querySelector('rect.bar')!, 'width');
    const wReal = num(real.querySelector('rect.bar')!, 'width');
    expect(wReal / wSynth).toBeCloseTo(24 / 529, 1);
    expect(el.querySelector('.formula')!.textContent).toContain('önce: 1876 | 124');
    const titles = [...el.querySelectorAll('text.flow-bar-title')].map((t) => t.textContent);
    expect(titles).toEqual(['önce', 'SMOTE sonrası', 'test']);
  });

  it('step 3 draws the example and its two parents', () => {
    const { el, player } = setup();
    go(player, 'testte-ne-var');
    expect(el.querySelectorAll('circle.parent')).toHaveLength(2);
    expect(el.querySelectorAll('line.parent-segment')).toHaveLength(1);
    expect(el.querySelectorAll('circle.synth-point')).toHaveLength(1);
    expect(el.querySelector('.formula')!.textContent).toContain('%98');
    const seg = el.querySelector('line.parent-segment')!;
    const p = el.querySelector('circle.synth-point')!;
    const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map((a) => num(seg, a));
    const px = num(p, 'cx');
    const py = num(p, 'cy');
    // distance from the point to the segment
    const t = Math.max(0, Math.min(1, ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / ((x2 - x1) ** 2 + (y2 - y1) ** 2)));
    expect(Math.hypot(x1 + t * (x2 - x1) - px, y1 + t * (y2 - y1) - py)).toBeLessThan(1);
    expect(LEAK_EXAMPLE.parents).toHaveLength(2);
    // the window around the example keeps the customers inside it, faint
    const bg = el.querySelectorAll('circle.bg-pt').length;
    expect(bg).toBeGreaterThan(5);
    expect(bg).toBeLessThan(2000);
  });

  it('step 3 labels sit apart from each other and from the marks', () => {
    const { el, player } = setup();
    go(player, 'testte-ne-var');
    const labels = [...el.querySelectorAll('text.leak-label')];
    expect(labels.map((l) => l.textContent).sort()).toEqual(['ebeveyn 1', 'ebeveyn 2', 'sentetik nokta']);
    // the mark radius is 0,4 of the tick font, which jsdom resolves itself
    const fs = num(el.querySelector('circle.synth-point')!, 'r') / 0.4;
    const boxes = labels.map((l) => labelBox(num(l, 'x'), num(l, 'y'), l.textContent!.length * 0.9, l.getAttribute('text-anchor') as 'start', fs));
    for (let a = 0; a < boxes.length; a++) {
      for (let b = a + 1; b < boxes.length; b++) {
        expect(overlap(boxes[a], boxes[b]), `${labels[a].textContent} / ${labels[b].textContent}`).toBe(0);
      }
    }
    for (const c of el.querySelectorAll('circle.parent, circle.synth-point')) {
      const r = num(c, 'r');
      const mark = { l: num(c, 'cx') - r, t: num(c, 'cy') - r, r: num(c, 'cx') + r, b: num(c, 'cy') + r };
      for (const box of boxes) {
        expect(overlap(box, mark)).toBe(0);
      }
    }
  });

  it('step 3 says why there is no example on the right order', () => {
    const { el, player } = setup();
    go(player, 'testte-ne-var');
    player.setParams({ order: 'dogru' });
    expect(el.querySelectorAll('circle.synth-point')).toHaveLength(0);
    expect(el.querySelector('.note-line')!.textContent).toContain('Doğru sırada');
  });

  it('flow fits 390 px without overlap', () => {
    const { el, player } = setup(390, 560);
    const svg = el.querySelector('svg.leak-plot')!;
    expect(num(svg, 'width')).toBe(390);
    const check = () => {
      for (const row of el.querySelectorAll('.flow-row')) {
        const boxes = [...row.querySelectorAll('.flow-box')].map(rectOf);
        for (const b of boxes) {
          expect(b.l).toBeGreaterThanOrEqual(0);
          expect(b.r).toBeLessThanOrEqual(390);
        }
        for (let a = 0; a < boxes.length; a++) {
          for (let b = a + 1; b < boxes.length; b++) {
            expect(overlap(boxes[a], boxes[b])).toBe(0);
          }
        }
        const frame = row.querySelector('.train-only');
        if (frame) {
          const f = rectOf(frame);
          expect(f.l).toBeGreaterThanOrEqual(0);
          expect(f.r).toBeLessThanOrEqual(390);
          // the framed boxes sit on one line inside it
          const kinds = ['smote', 'egit'].map((k) => rectOf(row.querySelector(`.flow-box[data-kind="${k}"]`)!));
          kinds.forEach((k) => expect(inside(k, f)).toBe(true));
        }
        // a box's text fits inside the box
        for (const t of row.querySelectorAll('text.flow-text')) {
          const box = rectOf(row.querySelector(`.flow-box[data-kind="${t.getAttribute('data-kind')}"]`)!);
          expect(t.textContent!.length * 16 * 0.62).toBeLessThanOrEqual(box.r - box.l);
        }
      }
    };
    check();
    // both rows of step 1 must not run into each other
    const rows = [...el.querySelectorAll('.flow-row')];
    expect(rows).toHaveLength(2);
    go(player, 'once-smote');
    check();
    go(player, 'testte-ne-var');
    for (const c of el.querySelectorAll('circle.bg-pt, circle.parent')) {
      expect(num(c, 'cx')).toBeLessThanOrEqual(390);
      expect(num(c, 'cx')).toBeGreaterThanOrEqual(0);
    }
  });

  it('the rows of step 1 do not overlap vertically', () => {
    const { el } = setup(390, 560);
    const bottoms: number[] = [];
    const tops: number[] = [];
    for (const row of el.querySelectorAll('.flow-row')) {
      const ty = Number(/translate\(0,([\d.]+)\)/.exec(row.getAttribute('transform')!)![1]);
      const boxes = [...row.querySelectorAll('.flow-box')].map(rectOf);
      tops.push(ty);
      bottoms.push(ty + Math.max(...boxes.map((b) => b.b)));
    }
    expect(tops[1]).toBeGreaterThanOrEqual(bottoms[0]);
  });
});
