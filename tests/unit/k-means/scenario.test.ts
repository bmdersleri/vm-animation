import { describe, it, expect } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { kMeansScenario, frameCount } from '../../../src/concepts/k-means/scenario';
import { deriveView, inertiaText } from '../../../src/concepts/k-means/view';
import { kmeansData } from '../../../src/concepts/kmeans/data';

const good = kmeansData.runs[0];
const bad = kmeansData.runs[1];

describe('k-means scenario', () => {
  it('has the eight steps with Turkish terms', () => {
    expect(kMeansScenario.steps.map((s) => s.id)).toEqual(['etiketsiz', 'baslangic', 'ata', 'tasi', 'tekrar', 'dur', 'kotu', 'ninit']);
    for (const s of kMeansScenario.steps) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.text.length).toBeGreaterThan(0);
    }
    expect(kMeansScenario.steps[1].term).toContain('küme merkezi (centroid)');
    expect(kMeansScenario.steps[2].term).toContain('atama (assignment)');
    expect(kMeansScenario.steps[6].term).toContain('yerel optimum (local optimum)');
    expect(kMeansScenario.defaults).toEqual({ start: 0, frame: 0, pick: kmeansData.nInitBest });
  });

  it('counts two frames per turn plus the start', () => {
    expect(frameCount(good)).toBe(2 * good.turns.length + 1);
    expect(frameCount(bad)).toBe(2 * bad.turns.length + 1);
  });

  it('sweeps frames without writing the swept key into the step params', () => {
    const s5 = kMeansScenario.steps[4];
    const last = frameCount(good) - 1;
    expect(s5.sweep).toEqual({ key: 'frame', values: Array.from({ length: last - 3 }, (_, i) => i + 3), intervalMs: 900 });
    expect(s5.sweep!.values.at(-1)).toBe(frameCount(good) - 2);
    expect(s5.params).toEqual({ start: 0 });
    const s7 = kMeansScenario.steps[6];
    expect(s7.sweep).toEqual({ key: 'frame', values: Array.from({ length: frameCount(bad) }, (_, i) => i), intervalMs: 900 });
    expect(s7.params).toEqual({ start: 1 });
  });

  it('pins the fixed frames of steps 1-4, 6 and 8', () => {
    const p = kMeansScenario.steps.map((s) => s.params);
    expect(p[0]).toEqual({ start: 0, frame: 0 });
    expect(p[1]).toEqual({ start: 0, frame: 0 });
    expect(p[2]).toEqual({ start: 0, frame: 1 });
    expect(p[3]).toEqual({ start: 0, frame: 2 });
    expect(p[5]).toEqual({ start: 0, frame: frameCount(good) - 1 });
    expect(p[7]).toEqual({ start: 0, frame: frameCount(good) - 1 });
  });

  it('a player on step 5 starts the sweep at frame 3', () => {
    const player = new StepPlayer(kMeansScenario);
    player.goto(4);
    expect(player.state.params.frame).toBe(3);
    player.destroy();
  });
});

describe('k-means view', () => {
  it('frame 0 shows start centres and no labels', () => {
    const v = deriveView({ start: 0, frame: 0 });
    expect(v.labels).toBeNull();
    expect(v.centers).toEqual(good.start);
    expect(v.turn).toBe(0);
    expect(v.inertia).toBeNull();
  });

  it('odd frames assign against the previous centres, even frames move', () => {
    const a = deriveView({ start: 0, frame: 3 });
    expect(a.phase).toBe('ata');
    expect(a.turn).toBe(2);
    expect(a.labels).toEqual(good.turns[1].labels);
    expect(a.centers).toEqual(good.turns[0].centers);
    expect(a.trails).toBeNull();
    const m = deriveView({ start: 0, frame: 4 });
    expect(m.phase).toBe('tasi');
    expect(m.centers).toEqual(good.turns[1].centers);
    expect(m.trails).toEqual(good.turns[0].centers);
    expect(m.inertia).toBe(good.turns[1].inertia);
  });

  it('inertia never increases across frames and ends on the run inertia', () => {
    for (const run of [0, 1]) {
      const vals: number[] = [];
      for (let f = 1; f < frameCount(kmeansData.runs[run]); f++) vals.push(deriveView({ start: run, frame: f }).inertia!);
      for (let i = 1; i < vals.length; i++) expect(vals[i]).toBeLessThanOrEqual(vals[i - 1] + 1e-4);
      expect(vals.at(-1)).toBe(kmeansData.runs[run].inertia);
    }
  });

  it('view formats inertia with a comma', () => {
    expect(inertiaText(43.0347)).toBe('43,0');
    expect(inertiaText(bad.inertia)).toBe('79,2');
    expect(inertiaText(bad.inertia)).not.toContain('.');
  });

  it('clamps an out-of-range frame', () => {
    expect(deriveView({ start: 0, frame: 99 }).frame).toBe(frameCount(good) - 1);
    expect(deriveView({ start: 0, frame: -3 }).frame).toBe(0);
  });
});
