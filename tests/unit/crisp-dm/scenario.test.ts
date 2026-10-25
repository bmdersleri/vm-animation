import { describe, it, expect } from 'vitest';
import { crispDmScenario } from '../../../src/concepts/crisp-dm/scenario';

describe('crisp-dm scenario', () => {
  it('has at least one step', () => {
    expect(crispDmScenario.steps.length).toBeGreaterThan(0);
  });
});
