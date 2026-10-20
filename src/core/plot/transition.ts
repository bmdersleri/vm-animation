import { type Selection } from 'd3-selection';
import 'd3-transition';
import { easeCubicInOut } from 'd3-ease';

// Selection and Transition share attr/style/text/remove. A transition is typed
// as its selection so one code path serves both the animated and the instant case.
export type AnySel = Selection<any, any, any, any>;

export function tr<S extends AnySel>(sel: S, name: string, ms: number, delay?: (d: never, i: number) => number): S {
  if (ms <= 0) return sel;
  const t = sel.transition(name).duration(ms).ease(easeCubicInOut);
  if (delay) t.delay(delay as (d: unknown, i: number) => number);
  return t as unknown as S;
}
