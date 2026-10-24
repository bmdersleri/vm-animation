import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../../src/core/random';
import fixture from '../../fixtures/boosting_sklearn.json';

describe('random', () => {
  it('mulberry32 matches the python twin', () => {
    for (const m of fixture.mulberry) {
      const rng = mulberry32(m.seed);
      for (const v of m.values) {
        expect(rng()).toBe(v);
      }
    }
  });
});
