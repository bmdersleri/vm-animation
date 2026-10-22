import { describe, it, expect } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { kSecimiScenario, ELBOW_K } from '../../../src/concepts/k-secimi/scenario';
import { deriveKView, silhouetteText, inertiaText, dropText, changedBetween, pointStats, peakK, clampK } from '../../../src/concepts/k-secimi/view';
import { kmeansData, kResult } from '../../../src/concepts/kmeans/data';
import { drops } from '../../../src/concepts/kmeans/geometry';

const steps = kSecimiScenario.steps;

describe('k-secimi scenario', () => {
  it('has the nine steps with Turkish terms', () => {
    expect(steps.map((s) => s.id)).toEqual(['k1', 'k2', 'k3', 'hep-duser', 'dirsek', 'silhouette', 'egri', 'k3-k4', 'karar']);
    for (const s of steps) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.text.length).toBeGreaterThan(0);
    }
    expect(steps[3].term).toContain('inertia');
    expect(steps[4].term).toContain('dirsek yöntemi (elbow method)');
    expect(steps[5].term).toContain('silhouette skoru');
    expect(kSecimiScenario.defaults).toEqual({ k: 3, point: null });
  });

  it('pins k on the fixed steps', () => {
    expect(steps.map((s) => s.params?.k)).toEqual([1, 2, 3, undefined, 3, 3, undefined, 4, 3]);
    expect(steps[5].params).toEqual({ k: 3, point: kmeansData.silhouettePoint });
  });

  it('sweeps k without writing k into the step params', () => {
    expect(steps[3].sweep).toEqual({ key: 'k', values: [4, 5, 6, 7, 8, 9, 10], intervalMs: 900 });
    expect(steps[6].sweep).toEqual({ key: 'k', values: [2, 3, 4, 5, 6, 7, 8, 9, 10], intervalMs: 900 });
    expect(steps[3].params ?? {}).not.toHaveProperty('k');
    expect(steps[6].params ?? {}).not.toHaveProperty('k');
  });

  it('going back from a silhouette step clears the point', () => {
    const player = new StepPlayer(kSecimiScenario);
    for (const from of [5, 6, 7, 8]) {
      player.goto(from);
      player.setParam('point', 49);
      for (const back of [0, 1, 2, 3, 4]) {
        player.goto(from);
        player.setParam('point', 49);
        player.goto(back);
        expect(player.state.params.point, `step ${from + 1} → ${back + 1}`).toBeNull();
      }
    }
    player.destroy();
  });

  it('a player on step 4 starts at k=4 and one on step 7 at k=2', () => {
    const player = new StepPlayer(kSecimiScenario);
    player.goto(3);
    expect(player.state.params.k).toBe(4);
    player.goto(6);
    expect(player.state.params.k).toBe(2);
    player.destroy();
  });

  it('copy numbers come from the data', () => {
    expect(steps[0].text).toContain('300,0');
    expect(steps[1].text).toContain('84,7');
    expect(steps[1].text).toContain('56 / 94');
    expect(steps[2].text).toContain('43,0');
    expect(steps[2].text).toContain('43 / 53 / 54');
    expect(steps[3].text).toContain('8,5');
    expect(steps[4].text).toContain('215,3');
    expect(steps[4].text).toContain('6,1');
    expect(steps[5].text).toMatch(new RegExp(`^Örnek: Nokta ${kmeansData.silhouettePoint + 1} için a = `));
    expect(steps[6].text).toContain('0,632');
    expect(steps[7].text).toContain('0,545');
    expect(steps[7].text).toContain('0,547');
    expect(steps[7].text).toContain('12');
    expect(steps[8].text).toContain(`k=${ELBOW_K}`);
    expect(steps[8].text).toContain(`k=${peakK()}`);
    expect(steps[8].text).toContain('Iris');
    for (const s of steps) expect(s.text).not.toMatch(/NaN|Infinity|undefined/);
  });

  it('the elbow is k=3: the gain after it is far smaller than before it', () => {
    const d = drops(kmeansData.ks);
    expect(d[ELBOW_K - 2]).toBeGreaterThan(30);
    expect(d[ELBOW_K - 1]).toBeLessThan(d[ELBOW_K - 2] / 2);
    expect(peakK()).toBe(2);
  });
});

describe('k-secimi view', () => {
  it('k=1 has an undefined silhouette and no drop', () => {
    const v = deriveKView(1);
    expect(v.silhouette).toBeNull();
    expect(silhouetteText(v.silhouette)).toBe('— (tanımsız)');
    expect(v.dropFromPrev).toBeNull();
    expect(inertiaText(v.inertia)).toBe('300,0');
  });

  it('formats with commas and fixed decimals', () => {
    expect(inertiaText(kResult(10).inertia)).toBe('8,5');
    expect(silhouetteText(kResult(2).silhouette)).toBe('0,632');
    expect(dropText(215.28)).toBe('215,3');
    expect(dropText(41.69)).toBe('41,7');
  });

  it('drop from the previous k and negative points come from the data', () => {
    expect(deriveKView(3).dropFromPrev).toBeCloseTo(kResult(2).inertia - kResult(3).inertia, 9);
    expect(deriveKView(4).negatives).toHaveLength(1);
    expect(deriveKView(3).negatives).toHaveLength(0);
    expect(deriveKView(4).sizes.slice().sort((a, b) => a - b)[0]).toBe(12);
  });

  it('clamps k and finds the points that changed number between ks', () => {
    expect(clampK(0)).toBe(1);
    expect(clampK(99)).toBe(10);
    expect(clampK(3.7)).toBe(3);
    expect(changedBetween(1)).toEqual([]);
    const ch = changedBetween(3);
    expect(ch.length).toBeGreaterThan(30);
    expect(ch.length).toBeLessThan(110);
    for (const i of ch) expect(kResult(3).labels[i]).not.toBe(kResult(2).labels[i]);
  });

  it('point stats are the stored a, b, s', () => {
    const i = kmeansData.silhouettePoint;
    const r = kResult(3);
    expect(pointStats(3, i)).toEqual({ a: r.a![i], b: r.b![i], s: r.s![i] });
    expect(pointStats(1, i)).toBeNull();
  });
});
