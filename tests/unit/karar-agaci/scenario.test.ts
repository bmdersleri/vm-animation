import { describe, it, expect } from 'vitest';
import { kararAgaciScenario } from '../../../src/concepts/karar-agaci/scenario';

describe('karar-agaci scenario', () => {
  it('has at least one step', () => {
    expect(kararAgaciScenario.steps.length).toBeGreaterThan(0);
  });
});
