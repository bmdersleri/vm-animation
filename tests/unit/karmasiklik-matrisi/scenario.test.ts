import { describe, it, expect } from 'vitest';
import { matrixScenario } from '../../../src/concepts/karmasiklik-matrisi/scenario';

describe('karmasiklik-matrisi scenario', () => {
  it('has at least one step', () => {
    expect(matrixScenario.steps.length).toBe(8);
  });
});
