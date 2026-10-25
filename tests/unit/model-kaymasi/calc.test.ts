import { describe, expect, it } from 'vitest';
import fixture from '../../fixtures/kayma_sklearn.json';
import { BOOK, META, REFERENCE, SCENARIO_IDS, scenarioById, type ScenarioId } from '../../../src/concepts/model-kaymasi/data';
import {
  accuracyAlarm, accuracyReading, alarmMonths, delayText, detectionDelay, falseAlarms, logistic, mean, meanDiff,
  psi, psiTerms, shares, status,
} from '../../../src/concepts/model-kaymasi/calc';

const diffs = (id: ScenarioId): number[] => scenarioById(id).months.map(m => m.diff);
const psis = (id: ScenarioId): number[] => scenarioById(id).months.map(m => m.psi);
const readout = (id: ScenarioId, values: number[], threshold: number) => {
  const alarms = alarmMonths(values, threshold);
  const change = scenarioById(id).changeMonth;
  return { alarms, fa: falseAlarms(alarms, change), delay: detectionDelay(alarms, change) };
};

describe('model-kaymasi calc', () => {
  it('book numbers', () => {
    expect(mean(BOOK.reference)).toBeCloseTo(55.8, 12);
    expect(mean(BOOK.current)).toBeCloseTo(70.2, 12);
    expect(meanDiff(BOOK.reference, BOOK.current)).toBeCloseTo(14.4, 12);
    expect(meanDiff(BOOK.reference, BOOK.current)).toBeCloseTo(BOOK.diff, 12);
    expect(status(meanDiff(BOOK.reference, BOOK.current), BOOK.esik)).toBe('UYARI');
    // the mini application of the book (three monthly fees per period)
    expect(meanDiff([45, 51, 54], [65, 71, 78])).toBeCloseTo(BOOK.miniDiff, 12);
    expect(BOOK.miniDiff).toBeCloseTo(21.33, 2);
  });

  it('status is NORMAL at equality', () => {
    expect(status(8, 8)).toBe('NORMAL');
    expect(status(8.0001, 8)).toBe('UYARI');
    expect(status(0, 0)).toBe('NORMAL');
  });

  it('psi matches the fixture for five scenarios and twenty-four months', () => {
    expect(Object.keys(fixture.scenarios).sort()).toEqual([...SCENARIO_IDS].sort());
    for (const id of SCENARIO_IDS) {
      const fx = (fixture.scenarios as Record<string, { month: number; psi: number; diff: number; accuracy: number }[]>)[id];
      expect(fx).toHaveLength(24);
      for (const m of scenarioById(id).months) {
        const got = psi(m.psiCounts, META.perMonth, REFERENCE.psiCounts, REFERENCE.n);
        expect(Math.abs(got - fx[m.month - 1].psi), `${id} ${m.month}`).toBeLessThan(1e-12);
        // the stored value is rounded to six decimals
        expect(Math.abs(m.psi - fx[m.month - 1].psi), `stored ${id} ${m.month}`).toBeLessThan(1e-6);
      }
    }
  });

  it('psi floors an empty bin', () => {
    const refCounts = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100];
    const counts = [0, 200, 100, 100, 100, 100, 100, 100, 100, 100];
    const terms = psiTerms(counts, 1000, refCounts, 1000);
    expect(terms[0].empty).toBe(true);
    expect(terms[0].q).toBe(1e-4);
    // the floor is in the whole term, not only in the logarithm
    expect(terms[0].term).toBeCloseTo((1e-4 - 0.1) * Math.log(1e-4 / 0.1), 12);
    expect(terms[1].empty).toBe(false);
    expect(terms[1].q).toBeCloseTo(0.2, 12);
    expect(terms[2].term).toBeCloseTo(0, 12);
    expect(psi(counts, 1000, refCounts, 1000)).toBeCloseTo(terms.reduce((a, t) => a + t.term, 0), 12);
    expect(psiTerms([0, 0], 1, [1, 1], 2, 0.01)[0].q).toBe(0.01);
  });

  it('yok has no false alarm at 8 and some at 4', () => {
    expect(readout('yok', diffs('yok'), 8).fa).toBe(0);
    expect(readout('yok', diffs('yok'), 4).fa).toBeGreaterThanOrEqual(2);
    expect(readout('yok', diffs('yok'), 4).delay).toBeNull();
  });

  it('ani alarms at the change month at 8', () => {
    const r = readout('ani', diffs('ani'), 8);
    expect(r.fa).toBe(0);
    expect(r.delay).toBe(0);
    expect(r.alarms[0]).toBe(15);
  });

  it('yavas waits longer at 8 than at 4 and misses at 12', () => {
    const at4 = readout('yavas', diffs('yavas'), 4);
    const at8 = readout('yavas', diffs('yavas'), 8);
    const at12 = readout('yavas', diffs('yavas'), 12);
    expect(at4.delay!).toBeLessThan(at8.delay!);
    expect(at12.delay).toBeNull();
    expect(at12.alarms).toEqual([]);
  });

  it('yayilim hides from the mean and shows in psi', () => {
    const change = scenarioById('yayilim').changeMonth!;
    const d = diffs('yayilim').slice(change - 1);
    const p = psis('yayilim').slice(change - 1);
    expect(Math.max(...d)).toBeLessThan(8);
    expect(Math.min(...p)).toBeGreaterThanOrEqual(0.25);
    expect(readout('yayilim', diffs('yayilim'), 8).delay).toBeNull();
    expect(readout('yayilim', psis('yayilim'), 0.25).delay).toBe(0);
  });

  it('kavram stays silent in the inputs', () => {
    expect(readout('kavram', diffs('kavram'), 8).alarms).toEqual([]);
    expect(readout('kavram', psis('kavram'), 0.25).alarms).toEqual([]);
  });

  it('delay is null when the alarm never comes', () => {
    expect(detectionDelay([], 15)).toBeNull();
    expect(detectionDelay([9, 10], 15)).toBeNull();
    expect(detectionDelay([15, 16], 15)).toBe(0);
    expect(detectionDelay([10, 17], 15)).toBe(2);
    expect(detectionDelay([10, 17], null)).toBeNull();
    expect(delayText(null, null)).toBe('—');
    expect(delayText(null, 15)).toBe('kaçırıldı');
    expect(delayText(0, 15)).toBe('0 ay');
    expect(delayText(9, 13)).toBe('9 ay');
  });

  it('false alarms count the months before the change, every alarm without one', () => {
    expect(falseAlarms([10, 15, 16], 15)).toBe(1);
    expect(falseAlarms([10, 15, 16], null)).toBe(3);
    expect(falseAlarms([], 15)).toBe(0);
  });

  it('alarmMonths is strict and starts at month 7', () => {
    const values = Array.from({ length: 24 }, () => 0);
    values[2] = 99;
    values[6] = 8;
    values[7] = 8.5;
    expect(alarmMonths(values, 8)).toEqual([8]);
    expect(alarmMonths(values, 8, 3)).toEqual([3, 8]);
  });

  it('accuracyAlarm in kavram is month 15 known at 18', () => {
    const acc = scenarioById('kavram').months.map(m => m.accuracy);
    expect(accuracyAlarm(acc, REFERENCE.accuracy, META.accMargin, META.labelDelay)).toEqual({ month: 15, knownAt: 18 });
    expect(accuracyAlarm(acc, REFERENCE.accuracy)).toEqual({ month: 15, knownAt: 18 });
    // no performance alarm in the monitored months before the change, in any scenario
    for (const id of SCENARIO_IDS) {
      const a = accuracyAlarm(scenarioById(id).months.map(m => m.accuracy).slice(0, 14), REFERENCE.accuracy);
      expect(a, id).toBeNull();
    }
    expect(accuracyAlarm([0.9, 0.9], 0.9, 0.05, 3, 1)).toBeNull();
    expect(accuracyAlarm([0.9, 0.8], 0.9, 0.05, 3, 1)).toEqual({ month: 2, knownAt: 5 });
  });

  it('accuracy alarm known after month 24 reads henüz bilinmiyor', () => {
    expect(accuracyReading({ month: 15, knownAt: 18 }, 24)).toEqual({ month: 'ay 15', known: 'ay 18' });
    expect(accuracyReading({ month: 23, knownAt: 26 }, 24)).toEqual({ month: 'ay 23', known: 'henüz bilinmiyor' });
    expect(accuracyReading({ month: 21, knownAt: 24 }, 24).known).toBe('ay 24');
    expect(accuracyReading(null, 24)).toEqual({ month: 'başarım düşüşü yok', known: '—' });
  });

  it('logistic and shares', () => {
    expect(logistic(0, 1, 0)).toBeCloseTo(0.5, 12);
    expect(logistic(100, 0.06, -5.2)).toBeGreaterThan(0.5);
    expect(logistic(50, 0.06, -5.2)).toBeLessThan(0.5);
    expect(shares([1, 3])).toEqual([0.25, 0.75]);
    expect(shares([0, 0])).toEqual([0, 0]);
  });
});
