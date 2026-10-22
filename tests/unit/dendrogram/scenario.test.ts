import { describe, expect, it } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { dendrogramData as D } from '../../../src/concepts/dendrogram/data';
import { cutForK } from '../../../src/concepts/dendrogram/tree';
import { cutSizes, heightText, sizesText } from '../../../src/concepts/dendrogram/view';
import { dendrogramScenario } from '../../../src/concepts/dendrogram/scenario';

const steps = dendrogramScenario.steps;
const n = D.points.length;

describe('dendrogram scenario', () => {
  it('has the 10 spec steps in order', () => {
    expect(steps.map((s) => s.id)).toEqual([
      'yapraklar', 'ilk-birlesme', 'birlesmeler', 'ward', 'agac', 'kesim', 'kesim-kayar', 'dogal-kesim', 'single', 'tablo',
    ]);
    for (const s of steps) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.text.length).toBeGreaterThan(0);
      expect(s.text).not.toMatch(/NaN|undefined|Infinity/);
    }
    expect(dendrogramScenario.defaults).toEqual({ linkage: 'ward', merges: 0, k: null, point: null, focusMerge: null });
  });

  it('step 3 sweeps merges 2..8 and step 5 sweeps to 16 without writing merges', () => {
    expect(steps[2].sweep).toEqual({ key: 'merges', values: [2, 3, 4, 5, 6, 7, 8], intervalMs: expect.any(Number) });
    expect(steps[2].params ?? {}).not.toHaveProperty('merges');
    const s5 = steps[4].sweep!;
    expect(s5.key).toBe('merges');
    expect(s5.values[s5.values.length - 1]).toBe(n - 1);
    expect([...s5.values].sort((a, b) => (a as number) - (b as number))).toEqual(s5.values);
    expect(steps[4].params ?? {}).not.toHaveProperty('merges');
    expect(steps[0].params?.merges).toBe(0);
    expect(steps[1].params?.merges).toBe(1);
  });

  it('step 4 keeps the merges of step 3 and focuses the example merge', () => {
    const sweep = steps[2].sweep!;
    const lastOfSweep = sweep.values[sweep.values.length - 1];
    expect(steps[3].params?.merges).toBe(lastOfSweep);
    expect(steps[3].params?.merges).toBeGreaterThan(D.wardExample.merge);
    expect(steps[3].params?.focusMerge).toBe(D.wardExample.merge);
    expect(dendrogramScenario.defaults.focusMerge).toBeNull();
    for (const i of [0, 1, 2, 4, 5, 6, 7, 8, 9]) expect(steps[i].params?.focusMerge ?? null).toBeNull();
  });

  it('step 6 cuts at k = 5, the widest range below the natural cut', () => {
    const k = steps[5].params!.k!;
    expect(k).toBe(5);
    const w = D.linkages.ward;
    const span = (kk: number) => { const c = w.cuts.find((x) => x.k === kk)!; return c.high - c.low; };
    expect(span(5)).toBeGreaterThan(span(4));
    expect(steps[5].text).toContain(`${heightText(cutForK(w, 5))} yüksekliğinde 5 dal`);
    expect(steps[5].text).toContain(sizesText(cutSizes('ward', 5)));
  });

  it('step 7 sweeps k 1..6', () => {
    expect(steps[6].sweep).toEqual({ key: 'k', values: [1, 2, 3, 4, 5, 6], intervalMs: expect.any(Number) });
    expect(steps[6].params ?? {}).not.toHaveProperty('k');
    expect(steps[5].params?.k).toBeTypeOf('number');
    expect(steps[5].params?.merges).toBe(n - 1);
  });

  it('step 8 uses naturalK', () => {
    expect(steps[7].params?.k).toBe(D.naturalK);
    expect(steps[7].params?.linkage).toBe('ward');
  });

  it('step 9 is single linkage with k=3', () => {
    expect(steps[8].params).toMatchObject({ linkage: 'single', k: 3 });
    expect(steps[9].params).toMatchObject({ linkage: 'ward', k: 3 });
  });

  it('the player reaches the example merge and texts quote the data', () => {
    const p = new StepPlayer(dendrogramScenario);
    p.goto(3);
    expect(p.state.params.merges).toBe(8);
    expect(steps[3].text).toContain('0,085');
    // the written Ward relation: height = sqrt(2 x increase)
    expect(Math.sqrt(2 * D.wardExample.increase)).toBeCloseTo(D.linkages.ward.merges[D.wardExample.merge].height, 2);
    const sizes = [0, 1, 2].map((l) => D.linkages.single.cuts[2].labels.filter((x) => x === l).length).sort((a, b) => b - a);
    expect(steps[8].text).toContain(String(sizes[0]));
    // step 9 lists the sizes largest first, the same order as the step 10 table
    const desc = (l: 'ward' | 'single') => [0, 1, 2].map((c) => D.linkages[l].cuts[2].labels.filter((x) => x === c).length).sort((a, b) => b - a).join(' · ');
    expect(steps[8].text).toContain(`Ward'da boylar ${desc('ward')}, single'da ${desc('single')}.`);
    expect(steps[9].text).toContain(`Ward ${desc('ward')}`);
    expect(steps[9].text).toContain(`single ${desc('single')}`);
    p.destroy();
  });
});
