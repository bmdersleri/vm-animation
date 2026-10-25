import { describe, expect, it } from 'vitest';
import {
  BOOK, CURVES, META, REFERENCE, SCENARIOS, SCENARIO_IDS, SPREAD_MONTH, monthOf, scenarioById,
} from '../../../src/concepts/model-kaymasi/data';

const round = (v: number, d: number): number => Math.round(v * 10 ** d) / 10 ** d;
const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

describe('model-kaymasi data', () => {
  it('book numbers come from data', () => {
    expect(round(BOOK.refMean, 2)).toBe(55.8);
    expect(round(BOOK.curMean, 2)).toBe(70.2);
    expect(round(BOOK.diff, 2)).toBe(14.4);
    expect(BOOK.esik).toBe(8);
    expect(BOOK.status).toBe('UYARI');
    expect(round(BOOK.miniDiff, 2)).toBe(21.33);
    expect(BOOK.reference).toEqual([45, 51, 54, 62, 67]);
    expect(BOOK.current).toEqual([58, 64, 71, 76, 82]);
  });

  it('five scenarios of twenty-four months', () => {
    expect(SCENARIO_IDS).toEqual(['yok', 'ani', 'yavas', 'yayilim', 'kavram']);
    expect(SCENARIOS.map(s => s.id)).toEqual([...SCENARIO_IDS]);
    expect(META.months).toBe(24);
    expect(META.perMonth).toBe(250);
    for (const s of SCENARIOS) {
      expect(s.months.map(m => m.month)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
      for (const m of s.months) {
        expect(m.psiCounts).toHaveLength(10);
        expect(sum(m.psiCounts)).toBe(250);
        expect(m.hist).toHaveLength(22);
        expect(sum(m.hist)).toBe(250);
      }
    }
    expect(scenarioById('ani').changeMonth).toBe(15);
    expect(scenarioById('yavas').changeMonth).toBe(13);
    expect(scenarioById('yok').changeMonth).toBeNull();
  });

  it('reference shares sum to one and cuts rise', () => {
    expect(REFERENCE.n).toBe(1500);
    expect(REFERENCE.psiCuts).toHaveLength(9);
    expect(REFERENCE.psiCounts).toHaveLength(10);
    expect(sum(REFERENCE.psiCounts)).toBe(1500);
    expect(sum(REFERENCE.psiCounts.map(c => c / REFERENCE.n))).toBeCloseTo(1, 12);
    for (let i = 1; i < REFERENCE.psiCuts.length; i += 1) {
      expect(REFERENCE.psiCuts[i]).toBeGreaterThan(REFERENCE.psiCuts[i - 1]);
    }
    expect(sum(REFERENCE.hist)).toBe(1500);
    expect(REFERENCE.hist).toHaveLength(22);
  });

  it('scenarios share the reference months', () => {
    for (let month = 1; month <= 6; month += 1) {
      const first = monthOf('yok', month);
      for (const id of SCENARIO_IDS) {
        expect(monthOf(id, month)).toEqual(first);
      }
    }
    expect(Object.keys(CURVES).sort()).toEqual([...SCENARIO_IDS].sort());
  });

  it('spread month is the smallest mean difference after the change', () => {
    const after = scenarioById('yayilim').months.filter(m => m.month >= 15);
    const smallest = after.reduce((a, b) => (b.diff < a.diff ? b : a));
    expect(SPREAD_MONTH).toBe(smallest.month);
    expect(REFERENCE.maxMonthlyDiff).toBeGreaterThan(0);
  });
});
