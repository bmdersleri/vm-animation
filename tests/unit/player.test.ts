import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer, stepIndex, type Scenario } from '../../src/core/player';

type P = { k: number; m: string };
const base = (): Scenario<P> => ({
  defaults: { k: 5, m: 'a' },
  steps: [
    { id: 's0', title: '0', text: '' },
    { id: 's1', title: '1', text: '', params: { k: 1 } },
    { id: 's2', title: '2', text: '', params: { m: 'b' } },
  ],
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('StepPlayer', () => {
  it('cumulative step params', () => {
    const p = new StepPlayer(base());
    p.goto(2);
    expect(p.state.params).toEqual({ k: 1, m: 'b' });
    p.goto(1);
    expect(p.state.params).toEqual({ k: 1, m: 'a' });
    p.goto(0);
    expect(p.state.params).toEqual({ k: 5, m: 'a' });
  });

  it('manual override survives steps that do not set it', () => {
    const p = new StepPlayer(base());
    p.goto(1);
    p.setParam('k', 9);
    p.goto(2);
    expect(p.state.params.k).toBe(9);
    p.goto(0);
    expect(p.state.params.k).toBe(9);
    p.goto(1);
    expect(p.state.params.k).toBe(1);
  });

  it('step that owns a key clears its override', () => {
    const p = new StepPlayer(base());
    p.setParam('k', 9);
    expect(p.state.index).toBe(0);
    p.goto(1);
    expect(p.state.params.k).toBe(1);
  });

  it('goto clamps', () => {
    const p = new StepPlayer(base());
    p.goto(99);
    expect(p.state.index).toBe(2);
    p.goto(-4);
    expect(p.state.index).toBe(0);
  });

  it('next/prev/first/last and subscribe/unsubscribe', () => {
    const p = new StepPlayer(base());
    const fn = vi.fn();
    const un = p.subscribe(fn);
    p.next();
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({ index: 1 }), 'step');
    p.setParam('m', 'z');
    expect(fn).toHaveBeenLastCalledWith(expect.objectContaining({ params: { k: 1, m: 'z' } }), 'param');
    p.last();
    expect(p.state.index).toBe(2);
    p.prev();
    p.first();
    expect(p.state.index).toBe(0);
    un();
    fn.mockClear();
    p.next();
    expect(fn).not.toHaveBeenCalled();
  });

  function sweepScenario(): Scenario<P> {
    return {
      defaults: { k: 5, m: 'a' },
      steps: [
        { id: 'a', title: '', text: '' },
        { id: 'sw', title: '', text: '', params: { k: 7 }, sweep: { key: 'k', values: [1, 3, 5], intervalMs: 100 } },
        { id: 'z', title: '', text: '' },
      ],
    };
  }

  it('sweep applies values then ends at step value', () => {
    const p = new StepPlayer(sweepScenario());
    const seen: [number, string][] = [];
    p.subscribe((s, c) => seen.push([s.params.k, c]));
    p.goto(1);
    vi.advanceTimersByTime(300);
    expect(seen.filter(([, c]) => c === 'sweep').map(([k]) => k)).toEqual([1, 3, 5, 7]);
    expect(p.state.params.k).toBe(7);
  });

  it('sweep without own value ends on last sweep value', () => {
    const sc = sweepScenario();
    delete sc.steps[1].params;
    const p = new StepPlayer(sc);
    p.goto(1);
    vi.advanceTimersByTime(1000);
    expect(p.state.params.k).toBe(5);
  });

  it('leaving a sweeping step cancels it', () => {
    const p = new StepPlayer(sweepScenario());
    p.goto(1);
    expect(p.state.params.k).toBe(1);
    p.goto(2);
    const fn = vi.fn();
    p.subscribe(fn);
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
    expect(p.state.params.k).toBe(7);
  });

  it('manual setParam on swept key cancels the sweep', () => {
    const p = new StepPlayer(sweepScenario());
    p.goto(1);
    p.setParam('k', 9);
    vi.advanceTimersByTime(1000);
    expect(p.state.params.k).toBe(9);
  });

  it('play stops at last step', () => {
    const p = new StepPlayer(base(), { autoplayMs: 1000 });
    p.play();
    expect(p.state.playing).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(p.state.index).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(p.state.index).toBe(2);
    expect(p.state.playing).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(p.state.index).toBe(2);
  });

  it('play waits for sweep to finish before advancing', () => {
    const p = new StepPlayer(
      {
        defaults: { k: 5, m: 'a' },
        steps: [
          { id: 'sw', title: '', text: '', sweep: { key: 'k', values: [1, 3, 5], intervalMs: 200 } },
          { id: 'b', title: '', text: '' },
        ],
      },
      { autoplayMs: 300 },
    );
    p.play();
    vi.advanceTimersByTime(300);
    expect(p.state.index).toBe(0);
    vi.advanceTimersByTime(600);
    expect(p.state.index).toBe(1);
  });

  it('destroy clears timers and subscribers', () => {
    const p = new StepPlayer(base(), { autoplayMs: 100 });
    const fn = vi.fn();
    p.subscribe(fn);
    p.play();
    fn.mockClear();
    p.destroy();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('setParams emits exactly once with both keys applied', () => {
    const p = new StepPlayer(base());
    const fn = vi.fn();
    p.subscribe(fn);
    p.setParams({ k: 9, m: 'q' });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({ params: { k: 9, m: 'q' } }), 'param');
  });

  it('setParams overrides behave like setParam (a later step owning the key clears it)', () => {
    const p = new StepPlayer(base());
    p.setParams({ k: 9, m: 'q' });
    p.goto(1);
    expect(p.state.params).toEqual({ k: 1, m: 'q' });
  });

  it('setParams on the swept key cancels the sweep', () => {
    const p = new StepPlayer(sweepScenario());
    p.goto(1);
    p.setParams({ k: 9, m: 'q' });
    vi.advanceTimersByTime(1000);
    expect(p.state.params).toEqual({ k: 9, m: 'q' });
  });
});

describe('stepIndex', () => {
  it('gives the index of an existing step id and throws for a missing one', () => {
    expect(stepIndex(base(), 's2')).toBe(2);
    expect(() => stepIndex(base(), 'nope')).toThrow('scenario has no step "nope"');
  });
});
