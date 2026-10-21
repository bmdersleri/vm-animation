export interface Step<P> {
  id: string;
  title: string;
  text: string;
  /** Term introduced by this step, e.g. "tembel öğrenme (lazy learning)"; Ders shows it beside the title. */
  term?: string;
  params?: Partial<P>;
  sweep?: { key: keyof P; values: unknown[]; intervalMs: number };
}
export interface Scenario<P> {
  defaults: P;
  steps: Step<P>[];
}
/** Index of the step with this id; throws when the scenario has no such step (so a scene's module-level constant fails at load). */
export function stepIndex<P>(scenario: Scenario<P>, id: string): number {
  const i = scenario.steps.findIndex((s) => s.id === id);
  if (i < 0) throw new Error(`scenario has no step "${id}"`);
  return i;
}
export type ChangeCause = 'step' | 'param' | 'sweep';
export interface PlayerState<P> {
  index: number;
  count: number;
  step: Step<P>;
  params: P;
  playing: boolean;
}
type Listener<P> = (s: PlayerState<P>, cause: ChangeCause) => void;

export class StepPlayer<P extends object> {
  private index = 0;
  private overrides: Partial<P> = {};
  private sweepValue: { key: keyof P; value: unknown } | null = null;
  private sweepTimer: ReturnType<typeof setTimeout> | null = null;
  private sweeping = false;
  private playTimer: ReturnType<typeof setInterval> | null = null;
  private playing = false;
  private listeners = new Set<Listener<P>>();
  private readonly autoplayMs: number;

  constructor(
    private readonly scenario: Scenario<P>,
    opts: { autoplayMs?: number } = {},
  ) {
    this.autoplayMs = opts.autoplayMs ?? 3500;
    this.startSweep(false);
  }

  get state(): PlayerState<P> {
    const { defaults, steps } = this.scenario;
    const params = { ...defaults } as P;
    for (let i = 0; i <= this.index; i++) Object.assign(params, steps[i].params);
    if (this.sweepValue) (params as Record<keyof P, unknown>)[this.sweepValue.key] = this.sweepValue.value;
    Object.assign(params, this.overrides);
    return {
      index: this.index,
      count: steps.length,
      step: steps[this.index],
      params,
      playing: this.playing,
    };
  }

  goto(i: number): void {
    const idx = Math.max(0, Math.min(this.scenario.steps.length - 1, Math.trunc(i)));
    this.cancelSweep();
    this.index = idx;
    const step = this.scenario.steps[idx];
    for (const key of Object.keys(step.params ?? {}) as (keyof P)[]) delete this.overrides[key];
    if (step.sweep) delete this.overrides[step.sweep.key];
    this.startSweep(true);
    if (!step.sweep) this.emit('step');
  }

  next(): void { this.goto(this.index + 1); }
  prev(): void { this.goto(this.index - 1); }
  first(): void { this.goto(0); }
  last(): void { this.goto(this.scenario.steps.length - 1); }

  setParam<K extends keyof P>(key: K, value: P[K]): void {
    this.setParams({ [key]: value } as unknown as Partial<P>);
  }

  /** Batch manual override: one atomic change, one 'param' emission. */
  setParams(patch: Partial<P>): void {
    const keys = Object.keys(patch) as (keyof P)[];
    const swept = this.sweepValue?.key ?? this.scenario.steps[this.index].sweep?.key;
    if (swept !== undefined && keys.includes(swept)) this.cancelSweep();
    Object.assign(this.overrides, patch);
    this.emit('param');
  }

  play(): void {
    if (this.playing || this.index >= this.scenario.steps.length - 1) return;
    this.playing = true;
    this.playTimer = setInterval(() => this.tick(), this.autoplayMs);
    this.emit('step');
  }

  pause(): void {
    if (!this.playing) return;
    this.stopPlay();
    this.emit('step');
  }

  togglePlay(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  subscribe(fn: Listener<P>): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  destroy(): void {
    this.cancelSweep();
    this.stopPlay();
    this.listeners.clear();
  }

  private tick(): void {
    if (this.sweeping) return;
    if (this.index >= this.scenario.steps.length - 1) {
      this.pause();
      return;
    }
    this.next();
    if (this.index >= this.scenario.steps.length - 1 && !this.sweeping) this.pause();
  }

  private stopPlay(): void {
    this.playing = false;
    if (this.playTimer !== null) clearInterval(this.playTimer);
    this.playTimer = null;
  }

  private cancelSweep(): void {
    if (this.sweepTimer !== null) clearTimeout(this.sweepTimer);
    this.sweepTimer = null;
    this.sweeping = false;
    this.sweepValue = null;
  }

  private startSweep(notify: boolean): void {
    const sw = this.scenario.steps[this.index].sweep;
    if (!sw || sw.values.length === 0) return;
    const step = this.scenario.steps[this.index];
    this.sweeping = true;
    let n = 0;
    const apply = (): void => {
      if (n < sw.values.length) {
        this.sweepValue = { key: sw.key, value: sw.values[n++] };
        this.sweepTimer = setTimeout(apply, sw.intervalMs);
        if (notify || n > 1) this.emit('sweep');
      } else {
        this.sweepTimer = null;
        this.sweeping = false;
        if (step.params && sw.key in step.params) {
          this.sweepValue = null;
          this.emit('sweep');
        }
      }
    };
    apply();
  }

  private emit(cause: ChangeCause): void {
    const s = this.state;
    for (const fn of [...this.listeners]) fn(s, cause);
  }
}
