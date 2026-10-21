// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { kSecimiScenario, type KSecimiParams } from '../../../src/concepts/k-secimi/scenario';
import { mountKSecimiScene } from '../../../src/concepts/k-secimi/scene';
import { kmeansData, kResult } from '../../../src/concepts/kmeans/data';
import { CLUSTER } from '../../../src/core/plot/marks';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

// jsdom cannot interpolate SVG transforms, so d3 transitions are switched off (reduced motion) for every test.
const setup = (mode: 'ders' | 'lab' = 'ders') => {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }));
  const player = new StepPlayer<KSecimiParams>(kSecimiScenario);
  const host = document.createElement('div');
  document.body.append(host);
  const scene = mountKSecimiScene(host, player, mode);
  scene.resize(1000, 600);
  return { player, host, scene };
};
const text = (host: HTMLElement, sel: string) => host.querySelector(sel)?.textContent ?? '';
const attr = (host: HTMLElement, sel: string, a: string) => host.querySelector(sel)?.getAttribute(a);
const sizes = (host: HTMLElement) => [...host.querySelectorAll('[data-size]')].map((e) => Number(e.getAttribute('data-size'))).sort((a, b) => a - b);
const fin = (scene: { destroy(): void }, player: StepPlayer<KSecimiParams>) => { scene.destroy(); player.destroy(); };

describe('k-secimi scene', () => {
  it('k=1 shows undefined silhouette', () => {
    const { player, host, scene } = setup();
    expect(host.querySelectorAll('circle.cs-point')).toHaveLength(150);
    expect(host.querySelectorAll('.cs-center')).toHaveLength(1);
    expect(text(host, '[data-silhouette]')).toBe('— (tanımsız)');
    expect(text(host, '[data-inertia]')).toContain('300,0');
    expect(host.querySelector('[data-drop-prev]')).toBeNull();
    expect(host.textContent).not.toMatch(/NaN|Infinity/);
    expect(host.querySelectorAll('.kc-chart-sil .kc-point')).toHaveLength(0);
    fin(scene, player);
  });

  it('k=2 shows sizes 56 / 94 and inertia 84,7', () => {
    const { player, host, scene } = setup();
    player.goto(1);
    expect(sizes(host)).toEqual([56, 94]);
    expect(text(host, '[data-inertia]')).toContain('84,7');
    expect(text(host, '[data-silhouette]')).toBe('0,632');
    fin(scene, player);
  });

  it('k=3 highlights the points whose number changed from k=2', () => {
    const { player, host, scene } = setup();
    player.goto(2);
    const rings = [...host.querySelectorAll('.cs-ring[data-kind="changed"]')].map((r) => Number(r.getAttribute('data-i'))).sort((a, b) => a - b);
    const expected = kmeansData.points.map((_p, i) => i).filter((i) => kResult(3).labels[i] !== kResult(2).labels[i]);
    expect(rings).toEqual(expected);
    expect(rings.length).toBeGreaterThan(0);
    expect(sizes(host)).toEqual([43, 53, 54]);
    fin(scene, player);
  });

  it('sweep ends on k=10', () => {
    vi.useFakeTimers();
    const { player, host, scene } = setup();
    player.goto(3);
    expect(attr(host, '.ks-panel [data-k]', 'data-k')).toBe('4');
    vi.advanceTimersByTime(900 * 20);
    expect(player.state.params.k).toBe(10);
    expect(attr(host, '.ks-panel [data-k]', 'data-k')).toBe('10');
    expect(text(host, '[data-inertia]')).toContain('8,5');
    expect(host.querySelectorAll('.cs-center')).toHaveLength(10);
    expect(host.querySelectorAll('.kc-chart-el .kc-point')).toHaveLength(10);
    fin(scene, player);
  });

  it('elbow step lists the drops and marks the elbow at k=3', () => {
    const { player, host, scene } = setup();
    player.goto(4);
    const d = [...host.querySelectorAll('[data-drop]')].map((e) => e.textContent);
    expect(d).toEqual(['215,3', '41,7', '14,5', '6,1']);
    expect(host.querySelectorAll('.kc-mark[data-kind="elbow"][data-k="3"]')).toHaveLength(1);
    expect(host.querySelectorAll('.kc-mark[data-kind="peak"]')).toHaveLength(0);
    fin(scene, player);
  });

  it('silhouette step shows a, b, s of the chosen point and the formula', () => {
    const { player, host, scene } = setup();
    player.goto(5);
    const i = kmeansData.silhouettePoint;
    const r = kResult(3);
    expect(attr(host, '[data-a]', 'data-a')).toBe(String(r.a![i]));
    expect(attr(host, '[data-b]', 'data-b')).toBe(String(r.b![i]));
    expect(attr(host, '[data-s]', 'data-s')).toBe(String(r.s![i]));
    expect(text(host, '[data-a]')).toBe(r.a![i].toFixed(3).replace('.', ','));
    expect(text(host, '[data-formula]')).toContain('max(a, b)');
    expect(host.querySelector(`.cs-ring[data-kind="selected"][data-i="${i}"]`)).not.toBeNull();
    fin(scene, player);
  });

  it('curve step reveals silhouette points as k sweeps and keeps the peak marked', () => {
    vi.useFakeTimers();
    const { player, host, scene } = setup();
    player.goto(6);
    expect(player.state.params.k).toBe(2);
    expect(host.querySelectorAll('.kc-chart-sil .kc-point')).toHaveLength(1);
    expect(host.querySelectorAll('.kc-mark[data-kind="peak"]')).toHaveLength(0);
    vi.advanceTimersByTime(900 * 3);
    expect(host.querySelectorAll('.kc-chart-sil .kc-point').length).toBeGreaterThan(2);
    vi.advanceTimersByTime(900 * 20);
    expect(host.querySelectorAll('.kc-chart-sil .kc-point')).toHaveLength(9);
    expect(host.querySelectorAll('.kc-mark[data-kind="peak"][data-k="2"]')).toHaveLength(1);
    fin(scene, player);
  });

  it('k=3 vs k=4 side by side, one negative ring and a 12-flower cluster', () => {
    const { player, host, scene } = setup();
    player.goto(7);
    expect(text(host, '[data-compare-k="3"] [data-silhouette]')).toBe('0,545');
    expect(text(host, '[data-compare-k="4"] [data-silhouette]')).toBe('0,547');
    expect(host.querySelectorAll('.cs-ring[data-kind="negative"]')).toHaveLength(1);
    expect(sizes(host)).toContain(12);
    expect(host.querySelectorAll('.kc-mark')).toHaveLength(2);
    fin(scene, player);
  });

  it('decision step marks both charts and states the verdict', () => {
    const { player, host, scene } = setup();
    player.goto(8);
    expect(host.querySelectorAll('.kc-mark[data-kind="elbow"][data-k="3"]')).toHaveLength(1);
    expect(host.querySelectorAll('.kc-mark[data-kind="peak"][data-k="2"]')).toHaveLength(1);
    expect(text(host, '[data-decision]')).toContain('Dirsek');
    expect(text(host, '[data-decision]')).toContain('Iris');
    fin(scene, player);
  });

  it('selected k is highlighted on both charts', () => {
    const { player, host, scene } = setup();
    player.goto(7);
    for (const c of ['el', 'sil']) {
      const sel = host.querySelectorAll(`.kc-chart-${c} .kc-point[data-selected="true"]`);
      expect(sel).toHaveLength(1);
      expect(sel[0].getAttribute('data-k')).toBe('4');
    }
    player.setParam('k', 2);
    for (const c of ['el', 'sil']) {
      expect(host.querySelector(`.kc-chart-${c} .kc-point[data-selected="true"]`)?.getAttribute('data-k')).toBe('2');
    }
    fin(scene, player);
  });

  it('reading box shows drop from previous k', () => {
    const { player, host, scene } = setup();
    player.goto(2);
    expect(text(host, '[data-drop-prev]')).toContain('41,7');
    expect(attr(host, '[data-drop-prev]', 'data-drop-prev')).toBe(String(kResult(2).inertia - kResult(3).inertia));
    // No Turkish case suffix on a number (2'ye, 6'ya, 9'a…): the label needs none.
    expect(host.querySelector('[data-drop-prev]')!.parentElement!.querySelector('.ks-label')!.textContent).toBe('Düşüş (k=2→3)');
    player.goto(3);
    expect(host.textContent).not.toMatch(/'e göre/);
    fin(scene, player);
  });

  it('renders the cluster colours of the labels', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }));
    const { player, host, scene } = setup();
    player.goto(2);
    const labels = kResult(3).labels;
    for (const i of [0, 60, 120]) expect(host.querySelector(`circle.cs-point[data-i="${i}"]`)?.getAttribute('fill')).toBe(CLUSTER[labels[i]]);
    fin(scene, player);
  });

  it('destroy stops updates', () => {
    vi.useFakeTimers();
    const { player, host, scene } = setup();
    player.goto(3);
    vi.advanceTimersByTime(1000);
    scene.destroy();
    expect(host.children).toHaveLength(0);
    const before = host.innerHTML;
    vi.advanceTimersByTime(900 * 20);
    expect(host.innerHTML).toBe(before);
    player.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reduced motion shows final state', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }));
    const { player, host, scene } = setup();
    player.goto(2);
    const labels = kResult(3).labels;
    expect(host.querySelector('circle.cs-point[data-i="7"]')?.getAttribute('fill')).toBe(CLUSTER[labels[7]]);
    expect(host.querySelectorAll('.cs-center')).toHaveLength(3);
    fin(scene, player);
  });

  it('panel is a direct child of the scene, charts stay in the side column', () => {
    const { player, host, scene } = setup('lab');
    const root = host.querySelector('.ks-scene')!;
    expect(host.querySelector('.ks-panel')!.parentElement).toBe(root);
    expect(host.querySelector('.ks-side .ks-panel')).toBeNull();
    expect(host.querySelectorAll('.ks-side > .ks-chart')).toHaveLength(2);
    fin(scene, player);
  });
});
