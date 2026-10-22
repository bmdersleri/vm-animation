import { describe, expect, it } from 'vitest';
import { sepetData } from '../../../src/concepts/birliktelik/data';
import { confidence, count, lift, support } from '../../../src/concepts/birliktelik/metrics';

const tx = sepetData.transactions;

describe('metrics', () => {
  it('book numbers: ekmek 11/18, ekmek and sut 7/18, confidence 0.636 and 0.583, lift 0.955', () => {
    expect(count(tx, ['ekmek'])).toBe(11);
    expect(support(tx, ['ekmek'])).toBeCloseTo(11 / 18, 12);
    expect(count(tx, ['ekmek', 'sut'])).toBe(7);
    expect(support(tx, ['ekmek', 'sut'])).toBeCloseTo(7 / 18, 12);
    expect(confidence(tx, ['ekmek'], ['sut'])).toBeCloseTo(0.636364, 6);
    expect(confidence(tx, ['sut'], ['ekmek'])).toBeCloseTo(0.583333, 6);
    expect(lift(tx, ['ekmek'], ['sut'])).toBeCloseTo(0.954545, 6);
    expect(lift(tx, ['sut'], ['ekmek'])).toBeCloseTo(0.954545, 6);
  });

  it('undefined confidence and lift return null', () => {
    expect(confidence(tx, ['kahve'], ['sut'])).toBeNull();
    expect(lift(tx, ['kahve'], ['sut'])).toBeNull();
    expect(lift(tx, ['ekmek'], ['kahve'])).toBeNull();
    expect(confidence([], ['ekmek'], ['sut'])).toBeNull();
    expect(support([], ['ekmek'])).toBe(0);
  });
});
