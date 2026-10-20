import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import {
  DEPTH_MAX, SCAN_N, treeScenario, treeShortcuts, type TreeParams,
} from '../../../src/concepts/karar-agaci/scenario';

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
    expect(n).toBeGreaterThanOrEqual(8);
  });

  it('defaults and constants', () => {
    expect(treeScenario.defaults).toEqual({
      criterion: 'gini', shown: 0, scan: -1, depth: 0, showTest: false, userSplit: null,
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

  it('depth sweep ends at Infinity with test points on', () => {
    const pl = make();
    pl.goto(9);
    expect(pl.state.params.depth).toBe(2);
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
