import { describe, it, expect } from 'vitest';
import { caprazDogrulamaScenario } from '../../../src/concepts/capraz-dogrulama/scenario';
import { labTextTests } from '../lab-text';

describe('capraz-dogrulama scenario', () => {
  it('has at least one step', () => {
    expect(caprazDogrulamaScenario.steps.length).toBeGreaterThan(0);
  });

  labTextTests(caprazDogrulamaScenario.steps, [7]);
});
