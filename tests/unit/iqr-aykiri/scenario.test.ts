import { describe, it, expect } from 'vitest';
import { iqrAykiriScenario } from '../../../src/concepts/iqr-aykiri/scenario';

describe('iqr-aykiri scenario', () => {
  it('has at least one step', () => {
    expect(iqrAykiriScenario.steps.length).toBeGreaterThan(0);
  });
});
