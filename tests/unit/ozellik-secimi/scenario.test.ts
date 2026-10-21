import { describe, it, expect } from 'vitest';
import { ozellikSecimiScenario } from '../../../src/concepts/ozellik-secimi/scenario';

describe('ozellik-secimi scenario', () => {
  it('has at least one step', () => {
    expect(ozellikSecimiScenario.steps.length).toBeGreaterThan(0);
  });
});
