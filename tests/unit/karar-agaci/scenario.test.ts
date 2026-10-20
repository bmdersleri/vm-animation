import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import {
  DEPTH_MAX, SCAN_N, SUB_N, treeScenario, treeShortcuts, type TreeParams,
} from '../../../src/concepts/karar-agaci/scenario';
import { childSweeps, toSamples } from '../../../src/concepts/karar-agaci/cart';
import { DOMAIN, train } from '../../../src/concepts/karar-agaci/data';
import { deriveTreeView } from '../../../src/concepts/karar-agaci/view';
import { ATTRS, candidates, winner } from '../../../src/concepts/karar-agaci/tennis';
import { formatNumber } from '../../../src/core/plot/format';

function make(): StepPlayer<TreeParams> {
  return new StepPlayer<TreeParams>(treeScenario);
}

describe('treeScenario', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('has 12 steps with unique ids', () => {
    expect(treeScenario.steps).toHaveLength(12);
    expect(new Set(treeScenario.steps.map((s) => s.id)).size).toBe(12);
  });

  it('every English term in a step text is also its Ders term', () => {
    let n = 0;
    for (const s of treeScenario.steps) {
      for (const [, en] of s.text.matchAll(/\(([A-Za-z][A-Za-z ]*)\)/g)) {
        n++;
        expect(s.term, s.id).toContain(en);
      }
    }
    expect(n).toBeGreaterThanOrEqual(13);
  });

  it('every step has a Ders term', () => {
    for (const s of treeScenario.steps) expect(s.term, s.id).toBeTruthy();
  });

  it('the numbers in the step texts are the computed ones', () => {
    const f3 = (x: number): string => formatNumber(x, 3);
    const text = (id: string): string => treeScenario.steps.find((s) => s.id === id)!.text;
    // root of the tennis table
    const root = deriveTreeView(1, { ...treeScenario.defaults }).rootRow!;
    expect(text('kok')).toContain(`${root.counts[0]} evet, ${root.counts[1]} hayır`);
    expect(text('kok')).toContain(`(${root.counts[0]}/14)² − (${root.counts[1]}/14)²`);
    expect(text('kok')).toContain(f3(root.measures[0].value));
    // the entropy winner's information gain
    const e = candidates('entropi');
    expect(ATTRS[e[winner(e)].attr]).toBe('Hava');
    expect(text('entropi')).toContain(`${f3(e[winner(e)].decrease)} bit`);
    // the book example, under both criteria
    const g = deriveTreeView(11, { ...treeScenario.defaults });
    const k = deriveTreeView(11, { ...treeScenario.defaults, criterion: 'entropi' });
    const [kaldi, ayrildi] = g.rootRow!.counts;
    expect(text('kitap')).toContain(`${kaldi + ayrildi} müşteri: ${ayrildi} ayrılan, ${kaldi} kalan`);
    expect(text('kitap')).toContain(`Gini ${f3(g.rootRow!.measures[0].value)} değerinden ${f3(g.cards[0].impurity)} değerine`);
    expect(text('kitap')).toContain(`entropi ${f3(k.rootRow!.measures[0].value)} değerinden ${f3(k.cards[0].impurity)} değerine`);
    expect(text('kitap')).toContain(`${f3(k.cards[0].decrease)} bit`);
    const [short, long] = g.cards[0].branches.map((b) => b.counts);
    expect(text('kitap')).toContain(`${short[1]} ayrılan ve ${short[0]} kalan`);
    expect(text('kitap')).toContain(`${long[1]} ayrılan ve ${long[0]} kalan`);
  });

  it('defaults and constants', () => {
    expect(treeScenario.defaults).toEqual({
      criterion: 'gini', shown: 0, scan: -1, subScan: -1, depth: 0, showTest: false, userSplit: null,
    });
    expect(SCAN_N).toBeGreaterThan(0);
    expect(DEPTH_MAX).toBe(6);
  });

  it('cards fill 1, 2, 3, 4 across steps 2-4', () => {
    const pl = make();
    pl.goto(2);
    expect(pl.state.params.shown).toBe(1);
    pl.goto(3);
    const seen = [pl.state.params.shown];
    pl.subscribe((s) => seen.push(s.params.shown));
    vi.advanceTimersByTime(700 * 4);
    expect(seen.slice(0, 3)).toEqual([2, 3, 4]);
    expect(pl.state.params.shown).toBe(4);
    pl.goto(4);
    expect(pl.state.params.shown).toBe(4);
    pl.destroy();
  });

  it('entropy step switches criterion and the numeric part resets it', () => {
    const pl = make();
    pl.goto(5);
    expect(pl.state.params).toMatchObject({ criterion: 'entropi', shown: 4 });
    pl.goto(6);
    expect(pl.state.params).toMatchObject({ criterion: 'gini', depth: 0, scan: -1, showTest: false });
    pl.destroy();
  });

  it('scan sweep visits every candidate and ends at -1 on the next step', () => {
    const pl = make();
    pl.goto(7);
    const seen = [pl.state.params.scan];
    pl.subscribe((s) => seen.push(s.params.scan));
    vi.advanceTimersByTime(70 * (SCAN_N + 2));
    expect(seen.slice(0, SCAN_N)).toEqual(Array.from({ length: SCAN_N }, (_, i) => i));
    expect(pl.state.params.scan).toBe(SCAN_N - 1);
    pl.goto(8);
    expect(pl.state.params).toMatchObject({ scan: -1, depth: 1 });
    pl.destroy();
  });

  it('step 10 replays the sub-branch search briefly, then ends at -1 with depth 2', () => {
    const want = childSweeps(toSamples(train), 'gini', DOMAIN).reduce((s, c) => s + c.points.length, 0);
    expect(SUB_N).toBe(want);
    const pl = make();
    pl.goto(9);
    const seen = [pl.state.params.subScan];
    pl.subscribe((s) => seen.push(s.params.subScan));
    const step = treeScenario.steps[9];
    expect(step.sweep?.key).toBe('subScan');
    // brief: the whole replay is over in well under the e2e settle time (1,5 s)
    expect(step.sweep!.intervalMs * (SUB_N + 1)).toBeLessThanOrEqual(1200);
    vi.advanceTimersByTime(step.sweep!.intervalMs * (SUB_N + 2));
    expect(seen.slice(0, SUB_N)).toEqual(Array.from({ length: SUB_N }, (_, i) => i));
    expect(pl.state.params).toMatchObject({ subScan: -1, depth: 2 });
    pl.goto(10);
    expect(pl.state.params.subScan).toBe(-1);
    pl.destroy();
  });

  it('depth sweep ends at Infinity with test points on', () => {
    const pl = make();
    pl.goto(9);
    expect(pl.state.params.depth).toBe(2);
    vi.advanceTimersByTime(2000);
    pl.goto(10);
    const seen = [pl.state.params.depth];
    pl.subscribe((s) => seen.push(s.params.depth));
    vi.advanceTimersByTime(900 * 6);
    expect(seen.slice(0, 5)).toEqual([3, 4, 5, 6, Infinity]);
    expect(pl.state.params.depth).toBe(Infinity);
    expect(pl.state.params.showTest).toBe(true);
    pl.destroy();
  });

  it('part-2 steps clear a manual userSplit', () => {
    const pl = make();
    pl.goto(6);
    pl.setParam('userSplit', { feature: 0, threshold: 10 });
    expect(pl.state.params.userSplit).not.toBeNull();
    pl.goto(8);
    expect(pl.state.params.userSplit).toBeNull();
    pl.setParam('userSplit', { feature: 1, threshold: 2 });
    pl.goto(9);
    expect(pl.state.params.userSplit).toBeNull();
    pl.destroy();
  });
});

describe('treeShortcuts', () => {
  const setup = () => {
    const pl = make();
    const sc = treeShortcuts(pl);
    const run = (label: string) => sc.find((s) => s.label === label)!.run();
    return { pl, sc, run };
  };

  it('exposes keys for the help overlay', () => {
    const { sc } = setup();
    expect(sc.map((s) => s.display)).toEqual(['G', '+', '-', 'T']);
    expect(sc[0].keys).toEqual(['g', 'G']);
  });

  it('+ goes 6 -> Infinity and - goes Infinity -> 6', () => {
    const { pl, run } = setup();
    pl.setParam('depth', 6);
    run('Derinliği artır');
    expect(pl.state.params.depth).toBe(Infinity);
    run('Derinliği artır');
    expect(pl.state.params.depth).toBe(Infinity);
    run('Derinliği azalt');
    expect(pl.state.params.depth).toBe(6);
    pl.setParam('depth', 0);
    run('Derinliği azalt');
    expect(pl.state.params.depth).toBe(0);
    run('Derinliği artır');
    expect(pl.state.params.depth).toBe(1);
    pl.destroy();
  });

  it('G toggles criterion and T toggles test points', () => {
    const { pl, run } = setup();
    run('Ölçüt: Gini / Entropi');
    expect(pl.state.params.criterion).toBe('entropi');
    run('Ölçüt: Gini / Entropi');
    expect(pl.state.params.criterion).toBe('gini');
    run('Test noktalarını göster / gizle');
    expect(pl.state.params.showTest).toBe(true);
    run('Test noktalarını göster / gizle');
    expect(pl.state.params.showTest).toBe(false);
    pl.destroy();
  });
});
