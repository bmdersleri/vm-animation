import { describe, it, expect } from 'vitest';
import { pcaScenario } from '../../../src/concepts/pca/scenario';

describe('pca scenario', () => {
  it('has at least one step', () => {
    expect(pcaScenario.steps.length).toBeGreaterThan(0);
  });
});
