import type { Scenario } from '../../core/player';

/** Index of the step with this id; throws at module load when the scenario has no such step. */
export function stepIndex<P>(scenario: Scenario<P>, id: string): number {
  const i = scenario.steps.findIndex((s) => s.id === id);
  if (i < 0) throw new Error(`scenario has no step "${id}"`);
  return i;
}
