import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { labTextTests } from '../lab-text';
import {
  pcaScenario, pcaShortcuts, animateTheta, THETA_SWEEP, THETA_SWEEP_MS,
  THETA_STEPS, BIRIM_STEPS, THRESHOLD_STEPS, PERPLEXITY_STEPS, type PcaParams,
} from '../../../src/concepts/pca/scenario';

function make(): StepPlayer<PcaParams> {
  return new StepPlayer<PcaParams>(pcaScenario);
}

function press(p: StepPlayer<PcaParams>, key: string): void {
  const sc = pcaShortcuts(p).find((s) => s.keys.includes(key));
  if (!sc) throw new Error(`no shortcut ${key}`);
  sc.run();
}

const IDS = [
  'bulut', 'yon-sec', 'yonu-cevir', 'pc1', 'pc2', 'yeni-eksenler', 'bir-boyut',
  'olcek-tuzagi', 'ozdegerler', 'esik', 'yan-yana', 'yeni-musteri', 'kural',
];

/** Manual frame clock: frames run only when `tick(ms)` is called. */
function fakeClock(): { raf: (cb: FrameRequestCallback) => number; now: () => number; tick: (ms: number) => void } {
  let t = 0;
  let queue: FrameRequestCallback[] = [];
  return {
    raf: (cb) => { queue.push(cb); return queue.length; },
    now: () => t,
    tick: (ms) => {
      t = ms;
      const run = queue;
      queue = [];
      for (const cb of run) cb(t);
    },
  };
}

describe('pcaScenario', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // node has no rAF: a 16 ms frame on the fake clock (performance.now is faked too)
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('13 steps with unique ids and the step sets', () => {
    expect(pcaScenario.steps.map((s) => s.id)).toEqual(IDS);
    expect(new Set(IDS).size).toBe(13);
    expect(THETA_SWEEP.length).toBe(61);
    expect(THETA_SWEEP[0]).toBe(0);
    expect(THETA_SWEEP[60]).toBe(180);
    expect(THETA_SWEEP_MS).toBe(50);
    expect(THETA_STEPS).toEqual([1, 2, 3, 4]);
    expect(BIRIM_STEPS).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(THRESHOLD_STEPS).toEqual([8, 9]);
    expect(PERPLEXITY_STEPS).toEqual([10, 11]);
    expect(pcaScenario.defaults).toEqual({ theta: 0, birim: 1, threshold: 90, perplexity: 30 });
  });

  it('every English term in a step text is also its Ders term', () => {
    let n = 0;
    for (const s of pcaScenario.steps) {
      for (const [, en] of s.text.matchAll(/\(([A-Za-z][A-Za-z -]*)\)/g)) {
        n++;
        expect(s.term, s.id).toContain(en);
      }
    }
    expect(n).toBeGreaterThanOrEqual(10);
  });

  it('step 4 introduces the eigenvector (spec term list)', () => {
    const s = pcaScenario.steps[3];
    expect(s.text).toContain('özvektör (eigenvector)');
    expect(s.term).toBe('temel bileşen (principal component) · özvektör (eigenvector)');
  });

  it('every step has a term and owns its params', () => {
    pcaScenario.steps.forEach((s, i) => {
      expect(s.term, s.id).toBeTruthy();
      const keys = Object.keys(s.params ?? {}).sort();
      expect(keys, s.id).toEqual(i === 2 ? ['birim', 'perplexity', 'threshold'] : ['birim', 'perplexity', 'theta', 'threshold']);
    });
  });

  it('theta sweep 0 -> 180 in about 3 s', () => {
    const p = make();
    p.goto(2);
    expect(p.state.params.theta).toBe(0);
    vi.advanceTimersByTime(50);
    expect(p.state.params.theta).toBe(3);
    vi.advanceTimersByTime(2950);
    expect(p.state.params.theta).toBe(180);
    vi.advanceTimersByTime(100);
    expect(p.state.params.theta).toBe(180);
    p.goto(3);
    expect(p.state.params.theta).toBe(45);
  });

  it('book values per step', () => {
    const p = make();
    p.goto(7);
    expect(p.state.params.birim).toBe(1000);
    p.goto(8);
    expect(p.state.params.birim).toBe(1);
    p.goto(9);
    expect(p.state.params.threshold).toBe(90);
  });

  it('a manual value lasts until the step changes', () => {
    const p = make();
    p.goto(3);
    p.setParam('theta', 30);
    expect(p.state.params.theta).toBe(30);
    p.goto(4);
    expect(p.state.params.theta).toBe(45);
    p.goto(10);
    p.setParam('perplexity', 5);
    expect(p.state.params.perplexity).toBe(5);
    p.goto(11);
    expect(p.state.params.perplexity).toBe(30);
  });

  it('animateTheta eases to the target and stops on a step change', () => {
    const p = make();
    p.goto(1);
    const seen: number[] = [];
    p.subscribe((s) => seen.push(s.params.theta));
    const c = fakeClock();
    animateTheta(p, 45, { ms: 600, raf: c.raf, now: c.now });
    c.tick(0);
    c.tick(300);
    c.tick(600);
    expect(seen.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    expect(seen[seen.length - 1]).toBe(45);
    expect(p.state.params.theta).toBe(45);

    p.goto(1);
    const c2 = fakeClock();
    const spy = vi.spyOn(p, 'setParam');
    animateTheta(p, 90, { ms: 600, raf: c2.raf, now: c2.now });
    c2.tick(0);
    c2.tick(300);
    const calls = spy.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    p.goto(2);
    c2.tick(450);
    c2.tick(600);
    expect(spy.mock.calls.length).toBe(calls);
  });

  it('animateTheta jumps in one setParam when already near, and the stopper cancels', () => {
    const p = make();
    p.goto(1);
    const spy = vi.spyOn(p, 'setParam');
    const c = fakeClock();
    animateTheta(p, 0.3, { raf: c.raf, now: c.now });
    expect(spy).toHaveBeenCalledTimes(1);
    const stop = animateTheta(p, 90, { ms: 600, raf: c.raf, now: c.now });
    c.tick(0);
    const n = spy.mock.calls.length;
    stop();
    c.tick(300);
    c.tick(600);
    expect(spy.mock.calls.length).toBe(n);
  });

  it('animateTheta stops as soon as another source writes theta (drag, slider, a second trigger)', () => {
    const p = make();
    p.goto(1);
    const c = fakeClock();
    animateTheta(p, 45, { ms: 600, raf: c.raf, now: c.now });
    c.tick(0);
    c.tick(200);
    p.setParam('theta', 120); // e.g. a pointer drag
    c.tick(400);
    c.tick(600);
    expect(p.state.params.theta).toBe(120);

    // the button starts one animation, Y another: the first gives way
    p.goto(1);
    const c2 = fakeClock();
    animateTheta(p, 45, { ms: 600, raf: c2.raf, now: c2.now });
    c2.tick(0);
    c2.tick(100);
    animateTheta(p, 150, { ms: 600, raf: c2.raf, now: c2.now });
    for (const t of [200, 300, 400, 500, 600, 700, 800]) c2.tick(t);
    expect(p.state.params.theta).toBe(150);
  });

  it('animateTheta takes the short way round the 180° direction circle', () => {
    const p = make();
    p.goto(2);
    vi.advanceTimersByTime(3100);
    expect(p.state.params.theta).toBe(180);
    const seen: number[] = [];
    const off = p.subscribe((s) => seen.push(s.params.theta));
    const c = fakeClock();
    animateTheta(p, 45, { ms: 600, raf: c.raf, now: c.now });
    for (const t of [0, 100, 200, 300, 400, 500, 600]) c.tick(t);
    off();
    expect(seen[seen.length - 1]).toBe(45);
    for (const t of seen) {
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(45);
    }

    p.goto(1);
    p.setParam('theta', 170);
    const seen2: number[] = [];
    p.subscribe((s) => seen2.push(s.params.theta));
    const c2 = fakeClock();
    animateTheta(p, 45, { ms: 600, raf: c2.raf, now: c2.now });
    for (const t of [0, 100, 200, 300, 400, 500, 600]) c2.tick(t);
    expect(seen2[seen2.length - 1]).toBe(45);
    // 170 → 180 ≡ 0 → 45 (55°), never back through 90°
    for (const t of seen2) expect(t <= 45 || t >= 170, String(t)).toBe(true);
    for (const t of seen2) expect(t).toBeLessThan(180);
  });

  it('shortcuts act only in their steps', () => {
    const p = make();
    press(p, 'b');
    expect(p.state.params.birim).toBe(1000);
    press(p, 'B');
    expect(p.state.params.birim).toBe(1);
    press(p, 'y');
    press(p, 't');
    vi.advanceTimersByTime(1000);
    expect(p.state.params.theta).toBe(0);
    expect(p.state.params.perplexity).toBe(30);

    p.goto(1);
    press(p, 'Y');
    vi.advanceTimersByTime(1000);
    expect(p.state.params.theta).toBe(45);
    press(p, 'b');
    expect(p.state.params.birim).toBe(1000);
    press(p, 'y');
    vi.advanceTimersByTime(1000);
    expect(p.state.params.theta).toBe(90);

    p.goto(10);
    const per: number[] = [];
    for (let i = 0; i < 3; i++) { press(p, 't'); per.push(p.state.params.perplexity); }
    expect(per).toEqual([50, 5, 30]);

    p.goto(8);
    press(p, 'b');
    press(p, 'y');
    press(p, 't');
    vi.advanceTimersByTime(1000);
    expect(p.state.params.birim).toBe(1);
    expect(p.state.params.theta).toBe(45);
    expect(p.state.params.perplexity).toBe(30);
  });

  it('a second Y cancels the first animation', () => {
    const p = make();
    p.goto(1);
    const sc = pcaShortcuts(p).find((x) => x.keys.includes('y'))!;
    sc.run();
    vi.advanceTimersByTime(200);
    sc.run();
    const spy = vi.spyOn(p, 'setParam');
    vi.advanceTimersByTime(16);
    expect(spy).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(p.state.params.theta).toBe(45);
    const n = spy.mock.calls.length;
    vi.advanceTimersByTime(500);
    expect(spy.mock.calls.length).toBe(n);
  });

  it('shortcut metadata', () => {
    expect(pcaShortcuts(make()).map((s) => [s.keys, s.display, s.label])).toEqual([
      [['b', 'B'], 'B', '9. öznitelik birimi: ×1 / ×1000'],
      [['y', 'Y'], 'Y', 'PC1’i bul'],
      [['t', 'T'], 'T', 'perplexity: 5 / 30 / 50'],
    ]);
  });

  labTextTests(pcaScenario.steps, [2, 4, 5, 6, 7, 10]);
  // step 8: the 9th feature's id and the x1000 unit option are fixed labels, not results
  labTextTests(pcaScenario.steps, [8], ['9', '1000']);
});
