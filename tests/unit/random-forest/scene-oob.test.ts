// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { randomForestScenario } from '../../../src/concepts/random-forest/scenario';
import { mountRfScene } from '../../../src/concepts/random-forest/scene';
import { BOOTS, CUSTOMERS, PICKS } from '../../../src/concepts/topluluk/data';
import { predictTree } from '../../../src/concepts/topluluk/tree';

const clean: (() => void)[] = [];
afterEach(() => {
  clean.splice(0).forEach((f) => f());
  document.body.replaceChildren();
});

function setup(w = 1280, h = 540) {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(randomForestScenario);
  const scene = mountRfScene(el, player, 'ders', { durationScale: 0 });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { el, player };
}

const step = (id: string) => randomForestScenario.steps.findIndex((s) => s.id === id);
const host = (el: HTMLElement) => el.querySelector('.rf-oob-host')!;

describe('oob matrix scene', () => {
  it('matrix has 25 rows and 12 tree columns', () => {
    const { el, player } = setup();
    player.goto(step('oob-matris'));
    expect(el.querySelector('.rf-stage')!.getAttribute('data-view')).toBe('oob');
    expect(host(el).querySelectorAll('g.oob-row')).toHaveLength(25);
    expect(host(el).querySelectorAll('g.oob-row')[0].querySelectorAll('g.oob-cell')).toHaveLength(12);
    expect(host(el).querySelectorAll('text.tree-head')).toHaveLength(12);
  });

  it("oob cells show the tree's vote", () => {
    const { el, player } = setup();
    player.goto(step('oob-matris'));
    let oobCells = 0;
    BOOTS.slice(0, 12).forEach((b, k) => {
      CUSTOMERS.forEach((c, i) => {
        const cell = host(el).querySelector(`g.oob-cell[data-row="${i}"][data-tree="${k}"]`)!;
        if (b.counts[i] === 0) {
          oobCells++;
          expect(cell.classList.contains('oob')).toBe(true);
          expect(cell.getAttribute('data-vote')).toBe(String(predictTree(b.tree, [c.t, c.c])));
          expect(cell.querySelector('.vote-mark')).not.toBeNull();
        } else {
          expect(cell.classList.contains('seen')).toBe(true);
          expect(cell.textContent).toBe(String(b.counts[i]));
          expect(cell.querySelector('.vote-mark')).toBeNull();
        }
      });
    });
    expect(oobCells).toBeGreaterThan(0);
    const picked = host(el).querySelectorAll('g.oob-row.picked');
    expect(picked).toHaveLength(1);
    expect(picked[0].getAttribute('data-row')).toBe(String(PICKS.oob));
  });

  it('step 6 score reads correct over total', () => {
    const { el, player } = setup();
    player.goto(step('oob-skor'));
    const right = host(el).querySelectorAll('g.oob-row.right').length;
    const wrong = host(el).querySelectorAll('g.oob-row.wrong').length;
    const none = host(el).querySelectorAll('g.oob-row.none').length;
    expect(right + wrong + none).toBe(25);
    const score = host(el).querySelector('text.oob-score')!.textContent!;
    expect(score).toBe(`OOB skoru = ${right} / ${right + wrong} = ${(right / (right + wrong)).toFixed(3).replace('.', ',')}`);
    expect(el.querySelector('.formula')!.textContent).toContain(score);
  });

  it('a customer seen by every tree shows no oob vote', () => {
    const { el, player } = setup();
    player.goto(step('oob-matris'));
    // with a single voting tree, every customer that tree drew has no out-of-bag vote
    player.setParam('trees', 1);
    const seen = CUSTOMERS.map((_, i) => i).filter((i) => BOOTS[0].counts[i] > 0);
    expect(seen.length).toBeGreaterThan(0);
    for (const i of seen) {
      const row = host(el).querySelector(`g.oob-row[data-row="${i}"]`)!;
      expect(row.classList.contains('none')).toBe(true);
      expect(row.querySelector('text.verdict')!.textContent).toBe('–');
      expect(row.querySelector('.verdict-mark')).toBeNull();
    }
  });

  it('matrix fits 390 px without horizontal overflow', () => {
    const { el, player } = setup(390, 700);
    player.goto(step('oob-matris'));
    const svg = host(el).querySelector('svg')!;
    expect(Number(svg.getAttribute('width'))).toBeLessThanOrEqual(390);
    const rights = [...host(el).querySelectorAll('rect.cell-box')].map((r) => Number(r.getAttribute('x')) + Number(r.getAttribute('width')));
    expect(rights).toHaveLength(25 * 12);
    expect(Math.max(...rights)).toBeLessThanOrEqual(390);
    const verdictRight = [...host(el).querySelectorAll('text.verdict')].map((t) => Number(t.getAttribute('x')));
    expect(Math.max(...verdictRight)).toBeLessThan(390);
  });
});
