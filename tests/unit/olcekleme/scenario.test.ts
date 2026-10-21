import { describe, it, expect } from 'vitest';
import { olceklemeScenario } from '../../../src/concepts/olcekleme/scenario';

describe('olcekleme scenario', () => {
  it('has at least one step', () => {
    expect(olceklemeScenario.steps.length).toBeGreaterThan(0);
  });
});
