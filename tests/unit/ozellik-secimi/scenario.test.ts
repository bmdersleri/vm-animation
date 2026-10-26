import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import {
  ozellikSecimiScenario as sc, secimShortcuts, ROUNDS_ALL, RFE_SWEEP_MS, RFE_REPLAY_MS,
  VT_STEPS, K_STEPS, RFE_STEPS, type SecimParams,
} from '../../../src/concepts/ozellik-secimi/scenario';
import { CHURN, COLUMNS, VALUES } from '../../../src/concepts/ozellik-secimi/data';
import { labTextTests } from '../lab-text';

const make = (): StepPlayer<SecimParams> => new StepPlayer<SecimParams>(sc);

function press(p: StepPlayer<SecimParams>, key: string): void {
  const s = secimShortcuts(p).find((x) => x.keys.includes(key));
  if (!s) throw new Error(`no shortcut ${key}`);
  s.run();
}

const IDS = [
  'sekiz-sutun', 'varyans-esigi', 'f-skoru', 'ilk-dort', 'tek-basina',
  'rfe-tur-1', 'turlar', 'gurultu-secildi', 'olceklenince', 'kesisim',
];

describe('ozellikSecimiScenario', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('10 steps with unique ids and the constants', () => {
    expect(sc.steps.map((s) => s.id)).toEqual(IDS);
    expect(new Set(IDS).size).toBe(10);
    expect(sc.defaults).toEqual({ vt: 0.01, k: 4, nSelect: 4, scaling: 'yok', rounds: 0 });
    expect(ROUNDS_ALL).toBe(99);
    expect(RFE_SWEEP_MS).toBe(1200);
    expect(RFE_REPLAY_MS).toBe(900);
    expect(VT_STEPS).toEqual([1]);
    expect(K_STEPS).toEqual([2, 3, 4]);
    expect(RFE_STEPS).toEqual([5, 6, 7, 8, 9]);
  });

  it('every English term in a step text is also its Ders term', () => {
    let n = 0;
    for (const s of sc.steps) {
      for (const [, en] of s.text.matchAll(/\(([A-Za-z][A-Za-z -]*)\)/g)) {
        n++;
        expect(s.term, s.id).toContain(en);
      }
    }
    expect(n).toBeGreaterThanOrEqual(6);
  });

  it('step 3 term carries its English in parentheses, in the text and the term', () => {
    expect(sc.steps[2].term).toBe('ANOVA F-istatistiği (ANOVA F-statistic)');
    expect(sc.steps[2].text).toContain('ANOVA F-istatistiği (ANOVA F-statistic)');
  });

  it('step 5 states what the data shows: every customer under 12 months churns, most churners do not', () => {
    const kidem = VALUES[COLUMNS.indexOf('musteriKidemAy')];
    const under = kidem.map((m, i) => (m < 12 ? i : -1)).filter((i) => i >= 0);
    expect(under.every((i) => CHURN[i] === 1)).toBe(true);
    const churners = CHURN.reduce<number>((a, b) => a + b, 0);
    expect(under.length / churners).toBeLessThan(0.5);
    const text = sc.steps[4].text;
    expect(text).toContain('12 ayın altındaki her müşteri churn ediyor');
    expect(text).not.toContain('çoğu');
  });

  it('every step has a term and owns all five params', () => {
    for (const s of sc.steps) {
      expect(s.term, s.id).toBeTruthy();
      expect(Object.keys(s.params ?? {}).sort(), s.id).toEqual(['k', 'nSelect', 'rounds', 'scaling', 'vt']);
    }
  });

  it('rounds sweep 1 → 2 → 3 → 4', () => {
    const p = make();
    p.goto(6);
    expect(p.state.params.rounds).toBe(1);
    vi.advanceTimersByTime(RFE_SWEEP_MS);
    expect(p.state.params.rounds).toBe(2);
    vi.advanceTimersByTime(RFE_SWEEP_MS);
    expect(p.state.params.rounds).toBe(3);
    vi.advanceTimersByTime(RFE_SWEEP_MS);
    expect(p.state.params.rounds).toBe(ROUNDS_ALL);
    p.goto(8);
    expect(p.state.params.rounds).toBe(0);
    expect(p.state.params.scaling).toBe('standard');
    vi.advanceTimersByTime(RFE_REPLAY_MS);
    expect(p.state.params.rounds).toBe(1);
    vi.advanceTimersByTime(4 * RFE_REPLAY_MS);
    expect(p.state.params.rounds).toBe(ROUNDS_ALL);
  });

  it('step 7 sweep covers every RFE round for each nSelect', () => {
    // nSelect runs 1-7; rounds shown are 1 .. 7 - nSelect (round 1 is applied on arrival, before nSelect can change), then ROUNDS_ALL
    for (let n = 1; n <= 7; n++) {
      const p = make();
      p.goto(6);
      p.setParam('nSelect', n);
      const shown = [p.state.params.rounds];
      for (let t = 0; t < 8; t++) {
        vi.advanceTimersByTime(RFE_SWEEP_MS);
        shown.push(p.state.params.rounds);
      }
      const distinct = shown.filter((v, i) => i === 0 || v !== shown[i - 1]);
      const expected = [...Array.from({ length: Math.max(1, 7 - n) }, (_, i) => i + 1), ROUNDS_ALL];
      expect(distinct, `nSelect ${n}`).toEqual(expected);
      expect(shown.at(-1)).toBe(ROUNDS_ALL);
      p.destroy();
    }
  });

  it('step 9 replay covers every RFE round for each nSelect, and Ders (nSelect 4) still plays 0 .. 3', () => {
    // rounds shown are 0 .. 7 - nSelect (round 0 is applied on arrival, before nSelect can change), then ROUNDS_ALL
    for (let n = 1; n <= 7; n++) {
      const p = make();
      p.goto(8);
      p.setParam('nSelect', n);
      const shown = [p.state.params.rounds];
      for (let t = 0; t < 9; t++) {
        vi.advanceTimersByTime(RFE_REPLAY_MS);
        shown.push(p.state.params.rounds);
      }
      const distinct = shown.filter((v, i) => i === 0 || v !== shown[i - 1]);
      const expected = [...Array.from({ length: 8 - n }, (_, i) => i), ROUNDS_ALL];
      expect(distinct, `nSelect ${n}`).toEqual(expected);
      p.destroy();
    }
    const d = make();
    d.goto(8);
    const shown = [d.state.params.rounds];
    for (let t = 0; t < 5; t++) { vi.advanceTimersByTime(RFE_REPLAY_MS); shown.push(d.state.params.rounds); }
    expect(shown).toEqual([0, 1, 2, 3, ROUNDS_ALL, ROUNDS_ALL]);
    d.destroy();
  });

  it('step 7 sweep: an nSelect set before arriving is reset by the step (it owns nSelect), so the default sweeps', () => {
    const p = make();
    p.setParam('nSelect', 6);
    p.goto(6);
    expect(p.state.params.nSelect).toBe(4);
    const shown = [p.state.params.rounds];
    for (let t = 0; t < 5; t++) { vi.advanceTimersByTime(RFE_SWEEP_MS); shown.push(p.state.params.rounds); }
    expect(shown).toEqual([1, 2, 3, ROUNDS_ALL, ROUNDS_ALL, ROUNDS_ALL]);
    p.destroy();
  });

  it('step 7 sweep follows an nSelect changed after several ticks', () => {
    const p = make();
    p.goto(6);
    p.setParam('nSelect', 1); // 6 rounds then ALL
    const shown = [p.state.params.rounds];
    for (let t = 0; t < 3; t++) { vi.advanceTimersByTime(RFE_SWEEP_MS); shown.push(p.state.params.rounds); }
    expect(shown).toEqual([1, 2, 3, 4]);
    p.setParam('nSelect', 5); // only rounds 1-2 now: the sweep is already past them and ends
    vi.advanceTimersByTime(RFE_SWEEP_MS);
    expect(p.state.params.rounds).toBe(ROUNDS_ALL);
    vi.advanceTimersByTime(RFE_SWEEP_MS * 5);
    expect(p.state.params.rounds).toBe(ROUNDS_ALL);
    p.destroy();
  });

  it('book scaling per step', () => {
    const p = make();
    p.goto(8);
    expect(p.state.params.scaling).toBe('standard');
    p.goto(9);
    expect(p.state.params.scaling).toBe('standard');
    expect(p.state.params.k).toBe(2);
    expect(p.state.params.nSelect).toBe(2);
    expect(p.state.params.rounds).toBe(ROUNDS_ALL);
  });

  it('a manual value lasts until the step changes', () => {
    const p = make();
    p.goto(3);
    p.setParam('k', 2);
    expect(p.state.params.k).toBe(2);
    p.goto(4);
    expect(p.state.params.k).toBe(4);
    p.goto(6);
    p.setParam('nSelect', 2);
    expect(p.state.params.nSelect).toBe(2);
    vi.advanceTimersByTime(RFE_SWEEP_MS);
    expect(p.state.params.rounds).toBe(2);
    p.goto(7);
    expect(p.state.params.nSelect).toBe(4);
  });

  it('shortcuts act only in their steps', () => {
    const p = make();
    p.goto(1);
    const vt: number[] = [];
    for (let i = 0; i < 4; i++) { press(p, 'V'); vt.push(p.state.params.vt); }
    expect(vt).toEqual([1, 10, 0, 0.01]);
    p.goto(0);
    press(p, 'v');
    expect(p.state.params.vt).toBe(0.01);

    p.goto(5);
    press(p, 'S');
    expect(p.state.params.scaling).toBe('standard');
    press(p, 's');
    expect(p.state.params.scaling).toBe('yok');
    p.goto(3);
    press(p, 'S');
    expect(p.state.params.scaling).toBe('yok');
  });

  labTextTests(sc.steps, [2, 4, 6, 7, 8, 9, 10]);
});
