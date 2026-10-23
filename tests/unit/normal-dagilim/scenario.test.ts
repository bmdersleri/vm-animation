import { describe, it, expect } from 'vitest';
import { normalDagilimScenario } from '../../../src/concepts/normal-dagilim/scenario';

describe('normal-dagilim scenario', () => {
  it('has at least one step', () => {
    expect(normalDagilimScenario.steps.length).toBeGreaterThan(0);
  });
});
