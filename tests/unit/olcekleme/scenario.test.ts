import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { labTextTests } from '../lab-text';
import {
  olceklemeScenario, olcShortcuts, UNIT_SWEEP_MS, SCATTER_STEPS, FIT_STEPS, type OlcParams,
} from '../../../src/concepts/olcekleme/scenario';

function make(): StepPlayer<OlcParams> {
  return new StepPlayer<OlcParams>(olceklemeScenario);
}

function press(p: StepPlayer<OlcParams>, key: string): void {
  const sc = olcShortcuts(p).find((s) => s.keys.includes(key));
  if (!sc) throw new Error(`no shortcut ${key}`);
  sc.run();
}

const IDS = [
  'iki-olcek', 'en-yakin', 'birim', 'ortalama-sapma', 'kaydir', 'bol', 'birim-fark-etmez',
  'uc-olcekleyici', 'transform', 'ayir', 'egitimden', 'sizinti', 'altin-kural',
];

describe('olceklemeScenario', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('13 steps with unique ids', () => {
    expect(olceklemeScenario.steps.map((s) => s.id)).toEqual(IDS);
    expect(new Set(IDS).size).toBe(13);
    expect(UNIT_SWEEP_MS).toBe(1800);
    expect(SCATTER_STEPS).toEqual([0, 1, 2, 3, 4, 5, 6, 8]);
    expect(FIT_STEPS).toEqual([10, 11, 12]);
  });

  it('every English term in a step text is also its Ders term', () => {
    let n = 0;
    for (const s of olceklemeScenario.steps) {
      for (const [, en] of s.text.matchAll(/\(([A-Za-z][A-Za-z -]*)\)/g)) {
        n++;
        expect(s.term, s.id).toContain(en);
      }
    }
    expect(n).toBeGreaterThanOrEqual(7);
  });

  it('every step has a term', () => {
    for (const s of olceklemeScenario.steps) expect(s.term, s.id).toBeTruthy();
  });

  it.each([[2, 'yok'], [6, 'standard']])(
    'unit sweep at step %i ends at gun and the next step returns to ay',
    (i, scaling) => {
      const p = make();
      p.goto(i);
      expect(p.state.params.scaling).toBe(scaling);
      expect(p.state.params.unit).toBe('ay');
      vi.advanceTimersByTime(1800);
      expect(p.state.params.unit).toBe('yil');
      vi.advanceTimersByTime(1800);
      expect(p.state.params.unit).toBe('gun');
      vi.advanceTimersByTime(1800);
      expect(p.state.params.unit).toBe('gun');
      p.goto(i + 1);
      expect(p.state.params.unit).toBe('ay');
    },
  );

  it('a manual query lasts until the step changes', () => {
    const p = make();
    p.goto(1);
    p.setParam('query', { t: 30, f: 100 });
    expect(p.state.params.query).toEqual({ t: 30, f: 100 });
    p.goto(2);
    expect(p.state.params.query).toEqual({ t: 12, f: 55 });
  });

  it('shortcuts act only in their steps', () => {
    const p = make();
    p.goto(1);
    const units: string[] = [];
    for (let i = 0; i < 3; i++) { press(p, 'u'); units.push(p.state.params.unit); }
    expect(units).toEqual(['yil', 'gun', 'ay']);
    press(p, 'S');
    expect(p.state.params.scaling).toBe('standard');
    press(p, 's');
    expect(p.state.params.scaling).toBe('yok');
    press(p, 't');
    expect(p.state.params.fit).toBe('egitim');

    p.goto(7);
    press(p, 'U');
    press(p, 'S');
    expect(p.state.params.unit).toBe('ay');
    expect(p.state.params.scaling).toBe('standard');

    p.goto(9);
    press(p, 'T');
    expect(p.state.params.fit).toBe('egitim');
    p.goto(10);
    press(p, 'T');
    expect(p.state.params.fit).toBe('tum');
    press(p, 'T');
    expect(p.state.params.fit).toBe('egitim');
    press(p, 'U');
    expect(p.state.params.unit).toBe('ay');
  });

  it('shortcut metadata', () => {
    expect(olcShortcuts(make()).map((s) => [s.keys, s.display, s.label])).toEqual([
      [['u', 'U'], 'U', 'Birim: ay / yıl / gün'],
      [['s', 'S'], 'S', 'Ölçekleme: yok / StandardScaler'],
      [['t', 'T'], 'T', 'fit kapsamı: yalnız eğitim / tüm veri'],
    ]);
  });

  labTextTests(olceklemeScenario.steps, [1, 2, 3, 4, 5, 6, 7, 9, 11, 12]);
});
