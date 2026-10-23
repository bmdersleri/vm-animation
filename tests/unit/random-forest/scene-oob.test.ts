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

function setup(w = 1280, h = 540, mode: 'ders' | 'lab' = 'ders') {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(randomForestScenario);
  const scene = mountRfScene(el, player, mode, { durationScale: 0 });
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

  it('columns beyond the voting trees cast no vote', () => {
    const { el, player } = setup();
    player.goto(step('oob-matris'));
    player.setParam('trees', 5);
    expect(host(el).querySelectorAll('g.oob-cell')).toHaveLength(25 * 12);
    expect(host(el).querySelectorAll('g.oob-cell.oob:not(.idle) .vote-mark').length).toBeGreaterThan(0);
    for (let k = 5; k < 12; k++) {
      const cells = host(el).querySelectorAll(`g.oob-cell[data-tree="${k}"]`);
      expect([...cells].every((c) => c.classList.contains('idle') && c.querySelector('.vote-mark') === null)).toBe(true);
    }
    for (let k = 0; k < 5; k++) {
      const oobCells = host(el).querySelectorAll(`g.oob-cell.oob[data-tree="${k}"]`);
      expect([...oobCells].every((c) => c.querySelector('.vote-mark') !== null && !c.classList.contains('idle'))).toBe(true);
    }
    // the verdict column counts the same 5 trees
    const row = host(el).querySelector(`g.oob-row[data-row="${PICKS.oob}"]`)!;
    const votes = [...row.querySelectorAll('g.oob-cell .vote-mark')].map((m) => m.classList.contains('ayrildi'));
    const yes = votes.filter(Boolean).length;
    const mark = row.querySelector('.verdict-mark');
    if (votes.length === 0) expect(mark).toBeNull();
    else expect(mark!.classList.contains('ayrildi')).toBe(yes * 2 > votes.length);
  });
});

describe('oob rows are interactive in Lab only', () => {
  const key = (k: string) => new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });

  it('Space and Enter on a Lab row pick it without advancing the step', () => {
    const { el, player } = setup(1280, 540, 'lab');
    const idx = step('oob-matris');
    player.goto(idx);
    const row = (i: number) => host(el).querySelector<SVGGElement>(`g.oob-row[data-row="${i}"]`)!;
    expect(row(3).getAttribute('tabindex')).toBe('0');
    expect(row(3).getAttribute('role')).toBe('button');
    row(3).dispatchEvent(key(' '));
    expect(player.state.params.pick).toBe(3);
    expect(player.state.index).toBe(idx);
    row(7).dispatchEvent(key('Enter'));
    expect(player.state.params.pick).toBe(7);
    expect(player.state.index).toBe(idx);
    row(9).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(player.state.params.pick).toBe(9);
  });

  it('Ders rows have no tabindex or role and a click does not pick', () => {
    const { el, player } = setup(1280, 540, 'ders');
    player.goto(step('oob-matris'));
    const rows = [...host(el).querySelectorAll('g.oob-row')];
    expect(rows).toHaveLength(25);
    for (const r of rows) {
      expect(r.hasAttribute('tabindex')).toBe(false);
      expect(r.hasAttribute('role')).toBe(false);
    }
    const before = player.state.params.pick;
    rows[3].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    rows[4].dispatchEvent(key('Enter'));
    expect(player.state.params.pick).toBe(before);
  });

  it('the legend says which trees are shown when M exceeds the columns', () => {
    const { el, player } = setup(1280, 1000, 'lab');
    player.goto(step('oob-matris'));
    player.setParam('trees', 30);
    expect(host(el).querySelectorAll('text.oob-legend').length).toBeGreaterThan(0);
    expect(host(el).querySelector('.oob-legend')!.parentElement!.textContent).toContain('30 ağaçtan');
    expect(el.querySelector('.formula')!.textContent).toContain('matris ilk 12 ağacı gösterir');
  });
});
