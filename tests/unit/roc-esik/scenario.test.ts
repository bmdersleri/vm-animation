import { describe, it, expect } from 'vitest';
import { rocEsikScenario } from '../../../src/concepts/roc-esik/scenario';

describe('roc-esik scenario', () => {
  it('has at least one step', () => {
    expect(rocEsikScenario.steps.length).toBe(10);
  });
});
