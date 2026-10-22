import { describe, expect, it } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { dbscanData } from '../../../src/concepts/dbscan/data';
import { dbscanScenario } from '../../../src/concepts/dbscan/scenario';

const steps = dbscanScenario.steps;

describe('dbscan scenario', () => {
  it('has the 10 spec steps in order', () => {
    expect(steps.map((s) => s.id)).toEqual([
      'hilaller', 'kmeans', 'eps', 'cekirdek', 'sinir', 'gurultu', 'turler', 'yayilma', 'eps-degisir', 'k-uzaklik',
    ]);
    for (const s of steps) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.text.length).toBeGreaterThan(0);
      expect(s.text).not.toMatch(/NaN|undefined|Infinity/);
    }
    expect(dbscanScenario.defaults).toEqual({ eps: dbscanData.meta.eps, minSamples: dbscanData.meta.minSamples, point: null, spread: 1 });
  });

  it('steps 3-6 select A, A, B, C from the data', () => {
    const { core, border, noise } = dbscanData.examples;
    expect(steps.map((s) => s.params?.point)).toEqual([null, null, core, core, border, noise, null, null, null, null]);
  });

  it('step 8 sweeps spread 0→1 and step 9 sweeps eps over epsSweep without writing the swept key', () => {
    const sp = steps[7].sweep!;
    expect(sp.key).toBe('spread');
    expect(sp.values[0]).toBe(0);
    expect(sp.values[sp.values.length - 1]).toBe(1);
    expect([...sp.values].sort((a, b) => (a as number) - (b as number))).toEqual(sp.values);
    expect(steps[7].params ?? {}).not.toHaveProperty('spread');
    expect(steps[8].sweep).toEqual({ key: 'eps', values: [...dbscanData.epsSweep], intervalMs: expect.any(Number) });
    expect(steps[8].params ?? {}).not.toHaveProperty('eps');
  });

  it('step 10 returns eps to the data value and the texts quote live numbers', () => {
    expect(steps[9].params?.eps).toBe(dbscanData.meta.eps);
    const p = new StepPlayer(dbscanScenario);
    p.goto(8);
    p.setParam('minSamples', 9);
    p.goto(9);
    expect(p.state.params.eps).toBe(dbscanData.meta.eps);
    expect(p.state.params.minSamples).toBe(dbscanData.meta.minSamples);
    p.destroy();
    expect(steps[2].text).toContain('0,3');
    expect(steps[6].text).toMatch(/191/);
  });

  it('going back clears a Lab point choice', () => {
    const p = new StepPlayer(dbscanScenario);
    p.goto(4);
    p.setParam('point', 12);
    p.goto(2);
    expect(p.state.params.point).toBe(dbscanData.examples.core);
    p.goto(0);
    expect(p.state.params.point).toBeNull();
    p.destroy();
  });
});
