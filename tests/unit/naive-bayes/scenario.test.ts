import { describe, it, expect } from 'vitest';
import { naiveBayesScenario } from '../../../src/concepts/naive-bayes/scenario';

describe('naive-bayes scenario', () => {
  it('has at least one step', () => {
    expect(naiveBayesScenario.steps.length).toBeGreaterThan(0);
  });
});
