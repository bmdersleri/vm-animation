import { describe, it, expect } from 'vitest';
import { modelKaymasiScenario } from '../../../src/concepts/model-kaymasi/scenario';

describe('model-kaymasi scenario', () => {
  it('has at least one step', () => {
    expect(modelKaymasiScenario.steps.length).toBeGreaterThan(0);
  });
});
