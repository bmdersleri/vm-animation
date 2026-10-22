import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { labTextTests } from '../lab-text';
import {
  iqrAykiriScenario, iqrShortcuts, PART1_LAST, type IqrParams,
} from '../../../src/concepts/iqr-aykiri/scenario';

function make(): StepPlayer<IqrParams> {
  return new StepPlayer<IqrParams>(iqrAykiriScenario);
}

function press(p: StepPlayer<IqrParams>, key: string): void {
  const sc = iqrShortcuts(p).find((s) => s.keys.includes(key));
  if (!sc) throw new Error(`no shortcut ${key}`);
  sc.run();
}

const IDS = [
  'bos-hucre', 'ortalama', 'medyan', 'ortalamayla', 'medyanla',
  'sirala', 'q1', 'q3-kutu', 'tukey', 'z-score', 'sil-kirp',
];

describe('iqrAykiriScenario', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('has 11 steps with unique ids in order', () => {
    expect(iqrAykiriScenario.steps.map((s) => s.id)).toEqual(IDS);
    expect(new Set(IDS).size).toBe(11);
    expect(PART1_LAST).toBe(4);
  });

  it('every English term in a step text is also its Ders term', () => {
    let n = 0;
    for (const s of iqrAykiriScenario.steps) {
      for (const [, en] of s.text.matchAll(/\(([A-Za-z][A-Za-z ]*)\)/g)) {
        n++;
        expect(s.term, s.id).toContain(en);
      }
    }
    expect(n).toBeGreaterThanOrEqual(8);
  });

  it('every step has a term and owns all four params', () => {
    for (const s of iqrAykiriScenario.steps) {
      expect(s.term, s.id).toBeTruthy();
      expect(Object.keys(s.params ?? {}).sort(), s.id).toEqual(['action', 'extreme', 'fill', 'k']);
    }
  });

  it('book extreme per part', () => {
    const p = make();
    for (let i = 0; i < 11; i++) {
      p.goto(i);
      expect(p.state.params.extreme, `step ${i}`).toBe(i <= PART1_LAST ? 200 : 480);
    }
    expect(p.state.params.action).toBe('kirp');
  });

  it('a manual value lasts until the step changes', () => {
    const p = make();
    p.goto(1);
    p.setParam('extreme', 300);
    expect(p.state.params.extreme).toBe(300);
    p.goto(2);
    expect(p.state.params.extreme).toBe(200);
    p.goto(9);
    p.setParam('action', 'sil');
    p.goto(10);
    expect(p.state.params.action).toBe('kirp');
  });

  it('shortcuts cycle within their part', () => {
    const p = make();
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) { press(p, 'd'); seen.push(p.state.params.fill); }
    expect(seen).toEqual(['ortalama', 'medyan', 'yok']);
    press(p, 'k');
    press(p, 'c');
    expect(p.state.params.k).toBe(1.5);
    expect(p.state.params.action).toBe('yok');

    p.goto(8);
    press(p, 'K');
    expect(p.state.params.k).toBe(3);
    press(p, 'K');
    expect(p.state.params.k).toBe(1.5);
    const acts: string[] = [];
    for (let i = 0; i < 3; i++) { press(p, 'c'); acts.push(p.state.params.action); }
    expect(acts).toEqual(['sil', 'kirp', 'yok']);
    press(p, 'D');
    expect(p.state.params.fill).toBe('yok');
  });

  it('shortcut metadata', () => {
    const sc = iqrShortcuts(make());
    expect(sc.map((s) => [s.keys, s.display, s.label])).toEqual([
      [['d', 'D'], 'D', 'Doldurma: yok / ortalama / medyan'],
      [['k', 'K'], 'K', 'IQR katsayısı: 1,5 / 3,0'],
      [['c', 'C'], 'C', 'Müdahale: yok / sil / kırp'],
    ]);
  });

  labTextTests(iqrAykiriScenario.steps, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});
