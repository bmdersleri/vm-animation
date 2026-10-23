// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/concepts/topluluk/vote', async (orig) => {
  const m = await orig<typeof import('../../../src/concepts/topluluk/vote')>();
  return { ...m, votes: vi.fn(m.votes) };
});
import { StepPlayer } from '../../../src/core/player';
import { baggingScenario, rootLabel } from '../../../src/concepts/bagging/scenario';
import { mountBaggingScene } from '../../../src/concepts/bagging/scene';
import { BOOTS, CUSTOMERS, PICKS, SINGLE } from '../../../src/concepts/topluluk/data';
import { predictTree } from '../../../src/concepts/topluluk/tree';
import { voteFill, votes } from '../../../src/concepts/topluluk/vote';
import { VOTE_COLORS, voteCells } from '../../../src/concepts/bagging/scene-regions';
import { scaleLinear } from 'd3-scale';

const clean: (() => void)[] = [];
afterEach(() => {
  vi.useRealTimers();
  clean.splice(0).forEach((f) => f());
  document.body.replaceChildren();
});

function setup(w = 1280, h = 540, mode: 'ders' | 'lab' = 'ders') {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(baggingScenario);
  const scene = mountBaggingScene(el, player, mode, { durationScale: 0 });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { el, player, scene };
}

const step = (id: string) => baggingScenario.steps.findIndex((s) => s.id === id);
const num = (e: Element, a: string) => Number(e.getAttribute(a));

describe('region scene', () => {
  it('step 5 draws the single tree and 25 customers', () => {
    const { el, player } = setup();
    player.goto(step('tek-agac'));
    expect(el.querySelector('.bagging-stage')!.getAttribute('data-view')).toBe('regions');
    expect(el.querySelectorAll('g.panel')).toHaveLength(1);
    const pts = [...el.querySelectorAll('path.pt')];
    expect(pts).toHaveLength(CUSTOMERS.length);
    expect(el.querySelectorAll('path.pt.ayrildi')).toHaveLength(CUSTOMERS.filter((c) => c.y === 1).length);
    expect(el.querySelector('.formula')!.textContent).toContain('25 / 25 doğru');
    expect(CUSTOMERS.every((c) => predictTree(SINGLE, [c.t, c.c]) === c.y)).toBe(true);
    const titles = [...el.querySelectorAll('.bagging-regions-host text.axis-title')].map((t) => t.textContent);
    expect(titles).toContain('Sözleşme süresi (ay)');
    expect(titles).toContain('Şikâyet sayısı');
  });

  it('step 6 draws three panels with distinct root titles', () => {
    const { el, player } = setup();
    player.goto(step('uc-agac'));
    expect(el.querySelectorAll('g.panel')).toHaveLength(3);
    const titles = [...el.querySelectorAll('g.panel text.panel-title')].map((t) => t.textContent!);
    const roots = [0, 1, 2].map((i) => rootLabel(BOOTS[i].tree));
    expect(new Set(roots).size).toBe(3);
    roots.forEach((r, i) => expect(titles[i].replace(/\s+/g, ' ')).toContain(r));
    expect(titles[0]).toContain('Bootstrap 1');
    expect(el.querySelectorAll('path.pt')).toHaveLength(75);
  });

  it('step 6 marks oob customers hollow and sizes by count', () => {
    const { el, player } = setup();
    player.goto(step('uc-agac'));
    const panels = [...el.querySelectorAll('g.panel')];
    panels.forEach((g, k) => {
      const pts = [...g.querySelectorAll('path.pt')];
      const oob = pts.filter((p) => p.classList.contains('oob'));
      expect(oob).toHaveLength(BOOTS[k].counts.filter((c) => c === 0).length);
      for (const p of oob) {
        expect(p.getAttribute('fill')).toBe('none');
        expect(p.getAttribute('stroke-dasharray')).toBeTruthy();
      }
      const size = (c: number) => pts.filter((p) => num(p, 'data-count') === c).map((p) => num(p, 'data-r'));
      const one = size(1);
      const more = size(Math.max(...BOOTS[k].counts));
      expect(Math.min(...more)).toBeGreaterThan(Math.max(...one));
      pts.forEach((p) => expect(num(p, 'data-count')).toBe(BOOTS[k].counts[num(p, 'data-i')]));
    });
  });

  it("step 7 sweep ends at 50 trees with the pick's vote text", () => {
    vi.useFakeTimers();
    const { el, player } = setup();
    player.goto(step('oylama'));
    vi.advanceTimersByTime(120 * 60);
    const c = CUSTOMERS[PICKS.vote];
    const k = votes([c.t, c.c], 50);
    expect(player.state.params.trees).toBe(50);
    expect(el.querySelector('.formula')!.textContent).toContain(`${k} / 50`);
    const callout = el.querySelector('text.vote-callout')!.textContent!;
    expect(callout).toBe(`50 ağaçtan ${k} tanesi Ayrıldı → Ayrıldı`);
    expect(el.querySelectorAll('circle.pick-ring')).toHaveLength(1);
    expect(el.querySelector('path.vote-boundary')!.getAttribute('d')!.length).toBeGreaterThan(20);
    expect(el.querySelectorAll('g.vote-ramp rect')).toHaveLength(11);
  });

  it('an even tree count shows the tie text', () => {
    const { el, player } = setup();
    let found: [number, number] | null = null;
    for (let m = 2; m <= 50 && !found; m += 2) {
      for (let i = 0; i < CUSTOMERS.length; i++) {
        if (votes([CUSTOMERS[i].t, CUSTOMERS[i].c], m) * 2 === m) {
          found = [i, m];
          break;
        }
      }
    }
    expect(found).not.toBeNull();
    player.goto(step('oylama'));
    player.setParams({ pick: found![0], trees: found![1] });
    expect(el.querySelector('.formula')!.textContent).toContain('berabere → Kaldı');
    expect(el.querySelector('text.vote-callout')!.textContent).toBe(
      `${found![1]} ağaçtan ${found![1] / 2} tanesi Ayrıldı → berabere → Kaldı`,
    );
  });

  it('three panels fit 390 px without overlap', () => {
    const { el, player } = setup(390, 600, 'lab');
    player.goto(step('uc-agac'));
    const frames = [...el.querySelectorAll('g.panel rect.frame')].map((r) => ({
      l: num(r, 'x'),
      r: num(r, 'x') + num(r, 'width'),
    }));
    expect(frames).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      expect(frames[i].l).toBeGreaterThanOrEqual(0);
      expect(frames[i].r).toBeLessThanOrEqual(390);
      expect(frames[i].r - frames[i].l).toBeGreaterThan(60);
      if (i > 0) expect(frames[i].l).toBeGreaterThan(frames[i - 1].r);
    }
    // each title starts inside its own panel and never reaches the next
    const titles = [...el.querySelectorAll('g.panel text.panel-title')];
    titles.forEach((t, i) => {
      expect(num(t, 'x')).toBeGreaterThanOrEqual(frames[i].l - 1);
      expect(num(t, 'x')).toBeLessThan(frames[i].r);
    });
  });

  it('a pick-only change recounts no votes', () => {
    const { el, player } = setup();
    player.goto(step('oylama'));
    const calls = vi.mocked(votes);
    const before = calls.mock.calls.length;
    const d = el.querySelector('path.vote-boundary')!.getAttribute('d');
    player.setParams({ pick: 3 });
    expect(el.querySelector('text.vote-callout')!.textContent).toContain('ağaçtan');
    // only the view's single count for the picked customer, no per-cell counting
    expect(calls.mock.calls.length - before).toBe(1);
    expect(el.querySelector('path.vote-boundary')!.getAttribute('d')).toBe(d);
    // a new tree count does recount
    const mid = calls.mock.calls.length;
    player.setParams({ trees: 20 });
    expect(calls.mock.calls.length).toBeGreaterThan(mid + 1000);
  });

  it('vote cells share the tint of voteFill', () => {
    const sc = {
      x: scaleLinear().domain([0, 60]).range([0, 100]),
      y: scaleLinear().domain([-0.5, 5.5]).range([100, 0]),
    };
    const g = { cols: 20, rows: 10 };
    const out = new Uint8Array(200);
    voteFill(17, sc)(g, out);
    expect([...voteCells(17, sc, 20, 10).shade]).toEqual([...out]);
    expect(VOTE_COLORS).toHaveLength(11);
  });
});
