import { describe, expect, it } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import {
  dagilimScenario, dagilimShortcuts, SERIES_STEPS, BINS_STEPS, LOG_STEPS, EXTREME_STEPS,
  type DagilimParams,
} from '../../../src/concepts/dagilim-carpiklik/scenario';

function make(): StepPlayer<DagilimParams> {
  return new StepPlayer<DagilimParams>(dagilimScenario);
}

function press(p: StepPlayer<DagilimParams>, key: string): void {
  const sc = dagilimShortcuts(p).find((s) => s.keys.includes(key));
  if (!sc) throw new Error(`no shortcut ${key}`);
  sc.run();
}

const IDS = [
  'noktalar', 'histogram', 'ortalama-medyan', 'carpiklik', 'kova', 'log', 'kuyruk', 'uc-sekil', 'kural',
];

describe('dagilimScenario', () => {
  it('9 steps with unique ids', () => {
    expect(dagilimScenario.steps.map((s) => s.id)).toEqual(IDS);
    expect(new Set(IDS).size).toBe(9);
    expect(SERIES_STEPS).toEqual([0, 1, 2, 3, 7]);
    expect(BINS_STEPS).toEqual([1, 2, 3, 4, 5]);
    expect(LOG_STEPS).toEqual([0, 1, 2, 3, 4, 5]);
    expect(EXTREME_STEPS).toEqual([6]);
  });

  it('defaults are the 002 distribution with five bins', () => {
    expect(dagilimScenario.defaults).toEqual({ seri: '002', extreme: 28, bins: 5, log: false });
  });

  it('every step has a title, a text and a term', () => {
    for (const s of dagilimScenario.steps) {
      expect(s.title.trim(), s.id).toBeTruthy();
      expect(s.text.trim(), s.id).toBeTruthy();
      expect(s.term, s.id).toBeTruthy();
    }
  });

  it('every English term in a step text is also its Ders term', () => {
    let n = 0;
    for (const s of dagilimScenario.steps) {
      for (const [, en] of s.text.matchAll(/\(([A-Za-z][A-Za-z -]*)\)/g)) {
        n++;
        expect(s.term, s.id).toContain(en);
      }
    }
    expect(n).toBeGreaterThanOrEqual(7);
  });

  it('step 7 owns 003 and step 8 returns to 002', () => {
    expect(dagilimScenario.steps[6].params?.seri).toBe('003');
    expect(dagilimScenario.steps[7].params?.seri).toBe('002');
    const p = make();
    p.goto(6);
    expect(p.state.params.seri).toBe('003');
    expect(p.state.params.extreme).toBe(28);
    p.goto(7);
    expect(p.state.params.seri).toBe('002');
  });

  it('S cycles the series', () => {
    const p = make();
    p.goto(0);
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) { press(p, 'S'); seen.push(p.state.params.seri); }
    expect(seen).toEqual(['003', 'simetrik', 'sol', '002']);
  });

  it('K cycles the bin count 3 → 5 → 10 → 3', () => {
    const p = make();
    p.goto(4);
    expect(p.state.params.bins).toBe(3);
    const seen: number[] = [];
    for (let i = 0; i < 3; i++) { press(p, 'k'); seen.push(p.state.params.bins); }
    expect(seen).toEqual([5, 10, 3]);
  });

  it('L toggles the log transform', () => {
    const p = make();
    p.goto(0);
    expect(p.state.params.log).toBe(false);
    press(p, 'L');
    expect(p.state.params.log).toBe(true);
    press(p, 'l');
    expect(p.state.params.log).toBe(false);
  });

  it('E moves the extreme value between 28 and 60', () => {
    const p = make();
    p.goto(6);
    press(p, 'E');
    expect(p.state.params.extreme).toBe(60);
    press(p, 'e');
    expect(p.state.params.extreme).toBe(28);
  });

  it('shortcuts act only in their own steps', () => {
    const p = make();
    p.goto(6);
    press(p, 'S');
    press(p, 'K');
    press(p, 'L');
    expect([p.state.params.seri, p.state.params.bins, p.state.params.log]).toEqual(['003', 5, false]);

    p.goto(8);
    const before = { ...p.state.params };
    press(p, 'S');
    press(p, 'K');
    press(p, 'L');
    press(p, 'E');
    expect(p.state.params).toEqual(before);
  });

  it('shortcut metadata', () => {
    expect(dagilimShortcuts(make()).map((s) => [s.keys, s.display, s.label])).toEqual([
      [['s', 'S'], 'S', 'Seri: 002 / 003 / simetrik / sol'],
      [['k', 'K'], 'K', 'Kova sayısı: 3 / 5 / 10'],
      [['l', 'L'], 'L', 'Log dönüşümü aç / kapat'],
      [['e', 'E'], 'E', 'Uç değer: 28 ↔ 60'],
    ]);
  });
});
