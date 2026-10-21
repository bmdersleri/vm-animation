// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { kMeansScenario, frameCount, type KMeansParams } from '../../../src/concepts/k-means/scenario';
import { mountKMeansScene } from '../../../src/concepts/k-means/scene';
import { kmeansData } from '../../../src/concepts/kmeans/data';
import { CLUSTER } from '../../../src/core/plot/marks';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

const good = kmeansData.runs[0];
const bad = kmeansData.runs[1];
const setup = (mode: 'ders' | 'lab' = 'ders') => {
  const player = new StepPlayer<KMeansParams>(kMeansScenario);
  const host = document.createElement('div');
  document.body.append(host);
  const scene = mountKMeansScene(host, player, mode);
  scene.resize(900, 600);
  return { player, host, scene };
};
const text = (host: HTMLElement, sel: string) => host.querySelector(sel)?.textContent ?? '';
const attr = (host: HTMLElement, sel: string, a: string) => host.querySelector(sel)?.getAttribute(a);

describe('k-means scene', () => {
  it('step 1 shows unlabeled points', () => {
    const { player, host, scene } = setup();
    const pts = host.querySelectorAll('circle.cs-point');
    expect(pts).toHaveLength(150);
    expect([...pts].every((p) => p.getAttribute('data-cluster') === '-')).toBe(true);
    expect(host.querySelectorAll('.cs-center')).toHaveLength(0);
    scene.destroy(); player.destroy();
  });

  it('step 2 shows three start centres and still no labels', () => {
    const { player, host, scene } = setup();
    player.goto(1);
    expect(host.querySelectorAll('.cs-center')).toHaveLength(3);
    expect([...host.querySelectorAll('circle.cs-point')].every((p) => p.getAttribute('data-cluster') === '-')).toBe(true);
    scene.destroy(); player.destroy();
  });

  it('step 3 draws distance lines', () => {
    const { player, host, scene } = setup();
    player.goto(2);
    const lines = host.querySelectorAll('line.cs-line');
    expect(lines).toHaveLength(9);
    expect(host.querySelectorAll('line.cs-line[data-nearest="true"]')).toHaveLength(3);
    for (const p of kmeansData.distancePoints) {
      const nearest = host.querySelector(`line.cs-line[data-point="${p}"][data-nearest="true"]`);
      expect(nearest?.getAttribute('data-center')).toBe(String(good.turns[0].labels[p]));
      expect(host.querySelector(`circle.cs-point[data-i="${p}"]`)?.getAttribute('data-cluster')).toBe(String(good.turns[0].labels[p]));
    }
    expect(host.querySelectorAll('circle.cs-point[data-cluster="-"]')).toHaveLength(0);
    expect(host.querySelectorAll('[data-size]')).toHaveLength(3);
    scene.destroy(); player.destroy();
  });

  it('step 4 moves the centres, leaves three trails and shows turn 1 inertia', () => {
    const { player, host, scene } = setup();
    player.goto(3);
    expect(host.querySelectorAll('.cs-trail')).toHaveLength(3);
    expect(host.querySelectorAll('line.cs-line')).toHaveLength(0);
    expect(attr(host, '[data-inertia]', 'data-inertia')).toBe(String(good.turns[0].inertia));
    expect(text(host, '[data-inertia]')).toContain('46,0');
    scene.destroy(); player.destroy();
  });

  it('step 5 reports turn, changed count and inertia on every frame', () => {
    vi.useFakeTimers();
    const { player, host, scene } = setup();
    player.goto(4);
    let prev = Infinity;
    let n = 0;
    for (let f = 3; f <= frameCount(good) - 2; f++) {
      const turn = Math.ceil(f / 2);
      expect(player.state.params.frame).toBe(f);
      expect(attr(host, '[data-turn]', 'data-turn')).toBe(String(turn));
      expect(attr(host, '[data-phase]', 'data-phase')).toBe(f % 2 ? 'ata' : 'tasi');
      expect(host.querySelector('[data-changed]')).not.toBeNull();
      if (f % 2) expect(attr(host, '[data-changed]', 'data-changed')).toBe(String(good.turns[turn - 1].changed));
      const inertia = Number(attr(host, '[data-inertia]', 'data-inertia'));
      expect(inertia).toBeLessThanOrEqual(prev + 1e-4);
      prev = inertia;
      n++;
      vi.advanceTimersByTime(900);
    }
    expect(n).toBe(frameCount(good) - 4);
    scene.destroy(); player.destroy();
  });

  it('sweep ends on the last frame', () => {
    vi.useFakeTimers();
    const { player, host, scene } = setup();
    player.goto(4);
    vi.advanceTimersByTime(900 * 40);
    expect(player.state.params.frame).toBe(frameCount(good) - 2);
    const lastTurn = Math.ceil((frameCount(good) - 2) / 2);
    expect(attr(host, '[data-turn]', 'data-turn')).toBe(String(lastTurn));
    expect(attr(host, '[data-phase]', 'data-phase')).toBe('ata');
    scene.destroy(); player.destroy();
  });

  it('step 6 stops with nothing changed and sizes 43 / 53 / 54', () => {
    const { player, host, scene } = setup();
    player.goto(5);
    expect(attr(host, '[data-changed]', 'data-changed')).toBe('0');
    const sizes = [...host.querySelectorAll('[data-size]')].map((e) => Number(e.getAttribute('data-size'))).sort((a, b) => a - b);
    expect(sizes).toEqual([43, 53, 54]);
    expect(text(host, '[data-inertia]')).toContain('43,0');
    expect(text(host, '[data-stop]')).toMatch(/renk değiştirmedi/);
    scene.destroy(); player.destroy();
  });

  it('step 7 ends in the local optimum with a comparison to the good run', () => {
    vi.useFakeTimers();
    const { player, host, scene } = setup();
    player.goto(6);
    expect(host.querySelector('[data-compare]')).toBeNull();
    vi.advanceTimersByTime(900 * (frameCount(bad) + 2));
    expect(player.state.params.frame).toBe(frameCount(bad) - 1);
    expect(Number(attr(host, '[data-inertia]', 'data-inertia'))).toBeCloseTo(79.2, 1);
    expect(text(host, '[data-inertia]')).toContain('79,2');
    const cmp = host.querySelector('[data-compare]')!;
    expect(cmp).not.toBeNull();
    expect(cmp.textContent).toContain('79,2');
    expect(cmp.textContent).toContain('43,0');
    expect(cmp.querySelector('[data-value-bad]')?.getAttribute('data-value-bad')).toBe(String(bad.inertia));
    expect(cmp.querySelector('[data-value-good]')?.getAttribute('data-value-good')).toBe(String(good.inertia));
    scene.destroy(); player.destroy();
  });

  it('step 8 lists ten starts and marks the best one', () => {
    const { player, host, scene } = setup();
    player.goto(7);
    const rows = host.querySelectorAll('[data-ninit-row]');
    expect(rows).toHaveLength(10);
    const best = host.querySelectorAll('[data-best]');
    expect(best).toHaveLength(1);
    expect(best[0].getAttribute('data-ninit-row')).toBe(String(kmeansData.nInitBest));
    expect(best[0].textContent).toContain('43,0');
    expect(text(host, '[data-ninit-code]')).toContain('KMeans(n_clusters=3, n_init=10, random_state=42)');
    scene.destroy(); player.destroy();
  });

  it('renders the cluster colours of the labels', () => {
    // Instant writes (reduced motion): jsdom does not run d3 transitions to the end.
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }));
    const { player, host, scene } = setup();
    player.goto(5);
    const labels = good.turns.at(-1)!.labels;
    for (const i of [0, 40, 100]) {
      expect(host.querySelector(`circle.cs-point[data-i="${i}"]`)?.getAttribute('fill')).toBe(CLUSTER[labels[i]]);
    }
    scene.destroy(); player.destroy();
  });

  it('destroy stops updates', () => {
    vi.useFakeTimers();
    const { player, host, scene } = setup();
    player.goto(4);
    vi.advanceTimersByTime(1000);
    scene.destroy();
    expect(host.children).toHaveLength(0);
    const before = host.innerHTML;
    vi.advanceTimersByTime(900 * 40);
    expect(host.innerHTML).toBe(before);
    player.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reduced motion shows final state', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }));
    const { player, host, scene } = setup();
    player.goto(5);
    const labels = good.turns.at(-1)!.labels;
    // no transition time has passed: the final colours are already written
    expect(host.querySelector('circle.cs-point[data-i="7"]')?.getAttribute('fill')).toBe(CLUSTER[labels[7]]);
    expect(attr(host, '[data-changed]', 'data-changed')).toBe('0');
    scene.destroy(); player.destroy();
  });
});
