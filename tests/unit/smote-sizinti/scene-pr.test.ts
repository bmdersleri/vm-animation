// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import '../svg-stubs';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { labelBox, overlap, type Box } from '../../../src/core/plot/label-place';
import { COMPARE, LEAK } from '../../../src/concepts/dengesiz/data';
import { positiveRate, staircase } from '../../../src/concepts/smote-sizinti/model';
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
const texts = (el: HTMLElement, sel: string) => [...el.querySelectorAll(sel)].map((t) => t.textContent);

/** Boxes of the plot's text labels (width from the character count at jsdom's 16 px). */
function labelBoxes(el: HTMLElement): { name: string; box: Box }[] {
  const out: { name: string; box: Box }[] = [];
  for (const t of el.querySelectorAll('text.lc-pin-label, text.score-name, text.score-big, text.score-book')) {
    // jsdom resolves every font to its 16 px default (no theme CSS), so tick and title sizes are equal here
    out.push({
      name: t.textContent!,
      box: labelBox(num(t, 'x'), num(t, 'y'), t.textContent!.length * 0.88, t.getAttribute('text-anchor') as 'start', 16),
    });
  }
  return out;
}

describe('PR scene', () => {
  it('step 4 draws two curves with dashed baselines at the positive rates', () => {
    const { el, player } = setup();
    go(player, 'pr-taban');
    expect(el.querySelector('.leak-stage')!.getAttribute('data-view')).toBe('pr');
    expect(el.querySelectorAll('path.lc-series')).toHaveLength(2);
    const lines = [...el.querySelectorAll('line.baseline')];
    expect(lines).toHaveLength(2);
    for (const l of lines) {
      expect(l.getAttribute('stroke-dasharray')).toBeTruthy();
    }
    expect(texts(el, 'text.lc-pin-label')).toEqual(['sızıntılı', 'sızıntısız', 'taban 0,470', 'taban 0,062']);
    const frame = el.querySelector('.leak-pr-host rect.frame')!;
    const top = num(frame, 'y');
    const height = num(frame, 'height');
    const run = LEAK.bySeed[0];
    const want = [positiveRate(run.leaky.scores), positiveRate(run.honest.scores)];
    lines.forEach((l, i) => {
      expect(num(l, 'y1')).toBeCloseTo(top + height * (1 - want[i]), 0);
    });
    expect(lines[0].getAttribute('class')).toContain('is-leaky');
  });

  it('step 5 shows both scores', () => {
    const { el, player } = setup();
    go(player, 'iki-skor');
    expect(texts(el, 'text.score-big')).toEqual(['0,704', '0,178']);
    expect(texts(el, 'text.score-name')).toEqual(['sızıntılı', 'sızıntısız']);
    expect(texts(el, 'text.score-book')).toEqual(['kitap 0,724 / 0,147']);
    expect(texts(el, 'text.lc-pin-label')).toEqual(['sızıntılı 0,704', 'sızıntısız 0,178', 'taban 0,470', 'taban 0,062']);
  });

  it('curve points start at recall 0 and end at recall 1', () => {
    const sets = [
      ...LEAK.bySeed.flatMap((r) => [r.leaky.scores, r.honest.scores]),
      COMPARE.base.scores,
      COMPARE.smote.scores,
      COMPARE.weighted.scores,
    ];
    for (const s of sets) {
      const st = staircase(s);
      expect(st[0][0]).toBe(0);
      expect(st[st.length - 1][0]).toBe(1);
      for (let i = 1; i < st.length; i++) {
        expect(st[i][0]).toBeGreaterThanOrEqual(st[i - 1][0]);
      }
    }
    const { el, player } = setup();
    go(player, 'pr-taban');
    const frame = el.querySelector('.leak-pr-host rect.frame')!;
    const d = el.querySelector('path.lc-series')!.getAttribute('d')!;
    expect(Number(/^M([\d.]+),/.exec(d)![1])).toBeCloseTo(num(frame, 'x'), 0);
    const last = /([\d.]+),[\d.]+$/.exec(d)!;
    expect(Number(last[1])).toBeCloseTo(num(frame, 'x') + num(frame, 'width'), 0);
  });

  it('the curve names and floor labels do not overlap at 1280 and 390 px', () => {
    for (const [w, h] of [[1280, 540], [390, 520]] as const) {
      // the three-curve step 7 is checked at full width only; its narrow layout belongs to the Lab task
      for (const id of w >= 1000 ? ['pr-taban', 'iki-skor', 'smote-agirlik'] : ['pr-taban', 'iki-skor']) {
        const { el, player } = setup(w, h);
        go(player, id);
        const boxes = labelBoxes(el);
        expect(boxes.length).toBeGreaterThan(2);
        for (let a = 0; a < boxes.length; a++) {
          for (let b = a + 1; b < boxes.length; b++) {
            expect(overlap(boxes[a].box, boxes[b].box), `${id} ${w}: ${boxes[a].name} / ${boxes[b].name}`).toBe(0);
          }
        }
        for (const { name, box } of boxes) {
          expect(box.l, `${id} ${w}: ${name}`).toBeGreaterThanOrEqual(-1);
          expect(box.r, `${id} ${w}: ${name}`).toBeLessThanOrEqual(w + 1);
        }
        clean.pop()!();
        document.body.replaceChildren();
      }
    }
  });

  it('text and stroke classes stay apart in the CSS', async () => {
    const { readFileSync } = (await import('node:fs' as string)) as { readFileSync: (p: string, e: string) => string };
    const css = readFileSync('src/concepts/smote-sizinti/smote-sizinti.css', 'utf8');
    expect(css).toMatch(/text\.is-leaky \{ fill:/);
    expect(css).toMatch(/line\.baseline \{/);
    expect(css).not.toMatch(/\n\.leak-plot \.baseline \{/);
    const { el, player } = setup();
    go(player, 'pr-taban');
    const floors = [...el.querySelectorAll('text.lc-pin-label')].filter((t) => t.textContent!.startsWith('taban'));
    expect(floors).toHaveLength(2);
    for (const t of floors) {
      expect(t.getAttribute('class')).toMatch(/is-(leaky|honest)/);
      expect(t.getAttribute('class')).not.toContain('baseline');
    }
  });
});
