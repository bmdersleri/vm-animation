import { kmeansData, type Pt, type Run } from '../kmeans/data';
import { inertiaOf } from '../kmeans/geometry';
import { formatNumber } from '../../core/plot/format';
import { frameCount } from './scenario';

export type Phase = 'baslangic' | 'ata' | 'tasi';

export interface KMeansView {
  run: Run;
  frame: number;
  /** 0 before the first assignment. */
  turn: number;
  phase: Phase;
  labels: readonly number[] | null;
  centers: readonly Pt[];
  trails: readonly Pt[] | null;
  /** Points that changed cluster in this turn's assignment (empty on turn 1). */
  changedIdx: number[];
  /** Count from the data; null before turn 1 and on turn 1 (everything is new). */
  changed: number | null;
  inertia: number | null;
  sizes: number[] | null;
}

export const inertiaText = (v: number): string => formatNumber(v, 1);

export const clampFrame = (run: Run, frame: number): number => Math.max(0, Math.min(frameCount(run) - 1, Math.trunc(frame)));

export function deriveView(p: { start: number; frame: number }): KMeansView {
  const run = kmeansData.runs[Math.max(0, Math.min(kmeansData.runs.length - 1, Math.trunc(p.start)))];
  const frame = clampFrame(run, p.frame);
  if (frame === 0) {
    return { run, frame, turn: 0, phase: 'baslangic', labels: null, centers: run.start, trails: null, changedIdx: [], changed: null, inertia: null, sizes: null };
  }
  const turn = Math.ceil(frame / 2);
  const t = run.turns[turn - 1];
  const before = turn === 1 ? run.start : run.turns[turn - 2].centers;
  const assign = frame % 2 === 1;
  const changedIdx: number[] = [];
  if (turn > 1) t.labels.forEach((l, i) => { if (l !== run.turns[turn - 2].labels[i]) changedIdx.push(i); });
  const sizes = new Array<number>(t.centers.length).fill(0);
  t.labels.forEach((l) => { sizes[l] += 1; });
  return {
    run,
    frame,
    turn,
    phase: assign ? 'ata' : 'tasi',
    labels: t.labels,
    centers: assign ? before : t.centers,
    trails: assign ? null : before,
    changedIdx,
    changed: t.changed,
    // The assignment already lowers inertia (old centres); the move lowers it again.
    inertia: assign ? inertiaOf(kmeansData.points, t.labels, before) : t.inertia,
    sizes,
  };
}
