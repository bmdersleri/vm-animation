import { describe, it, expect } from 'vitest';
import { CUSTOMERS, QUERY, SPLIT } from '../../../src/concepts/olcekleme/data';
import fixture from '../../fixtures/onisleme_sklearn.json';

describe('olcekleme data', () => {
  it('has six customers M1..M6', () => {
    expect(CUSTOMERS.map((c) => c.id)).toEqual(['M1', 'M2', 'M3', 'M4', 'M5', 'M6']);
    expect(QUERY).toEqual({ t: 12, f: 55 });
  });

  it('has the book split', () => {
    expect(SPLIT.train).toHaveLength(7);
    expect(SPLIT.test).toEqual([4, 8, 3]);
    expect([...SPLIT.train, ...SPLIT.test].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('has the sklearn fixture', () => {
    expect(fixture.scale.nearest).toEqual({ ay: 2, yil: 1, gun: 4, z: 2 });
  });
});
