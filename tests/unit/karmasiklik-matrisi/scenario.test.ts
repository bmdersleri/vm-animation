import { describe, it, expect } from 'vitest';
import { matrixScenario } from '../../../src/concepts/karmasiklik-matrisi/scenario';
import { labTextTests } from '../lab-text';

describe('karmasiklik-matrisi scenario', () => {
  it('has at least one step', () => {
    expect(matrixScenario.steps.length).toBe(8);
  });

  labTextTests(matrixScenario.steps, [3, 4, 5, 6, 7]);
});
