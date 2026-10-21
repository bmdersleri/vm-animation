import { describe, it, expect } from 'vitest';
import { FILL, IQR, MODE_VALUES } from '../../../src/concepts/iqr-aykiri/data';
import fixture from '../../fixtures/onisleme_sklearn.json';

describe('iqr-aykiri data', () => {
  it('has the book fill series with two gaps', () => {
    expect(FILL.values).toHaveLength(8);
    expect(FILL.values[2]).toBeNull();
    expect(FILL.values[5]).toBeNull();
    expect(FILL.values.filter((v) => v === null)).toHaveLength(2);
    expect(FILL.values[FILL.extremeIndex]).toBe(200);
  });

  it('has the book IQR series', () => {
    expect(IQR.values[7]).toBe(480);
    expect(IQR.values[IQR.extremeIndex]).toBe(480);
    expect(MODE_VALUES).toEqual(['Aylık', 'Aylık', null, 'Bir Yıllık']);
  });

  it('has the sklearn fixture', () => {
    expect(Math.abs(fixture.iqr.q1 - 41.35)).toBeLessThan(1e-9);
    expect(fixture.extremeSweep).toHaveLength(12);
  });
});
