// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { kSecimiScenario, type KSecimiParams } from '../../../src/concepts/k-secimi/scenario';
import { mountKSecimiParams } from '../../../src/concepts/k-secimi/controls';
import { mountKSecimiScene } from '../../../src/concepts/k-secimi/scene';
import { changedBetween } from '../../../src/concepts/k-secimi/view';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

const setup = () => {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }));
  const player = new StepPlayer<KSecimiParams>(kSecimiScenario);
  const sceneHost = document.createElement('div');
  const params = document.createElement('div');
  document.body.append(sceneHost, params);
  const scene = mountKSecimiScene(sceneHost, player, 'lab');
  scene.resize(1000, 600);
  mountKSecimiParams(params, player);
  return { player, sceneHost, params, scene };
};
const slider = (h: HTMLElement) => h.querySelector<HTMLInputElement>('input[data-param=k]')!;
const pointInput = (h: HTMLElement) => h.querySelector<HTMLInputElement>('input[data-param=point]')!;
const move = (input: HTMLInputElement, v: number) => { input.value = String(v); input.dispatchEvent(new Event('input', { bubbles: true })); };
const rings = (h: HTMLElement) => [...h.querySelectorAll('.cs-ring[data-kind="changed"]')].map((r) => Number(r.getAttribute('data-i'))).sort((a, b) => a - b);
const shown = (h: HTMLElement, sel: string) => !h.querySelector(sel)!.closest('[hidden]');

describe('k-secimi controls', () => {
  it('slider moves k 1..10 and updates both charts', () => {
    const { player, sceneHost, params } = setup();
    const s = slider(params);
    expect([s.min, s.max]).toEqual(['1', '10']);
    player.goto(4);
    move(s, 6);
    expect(player.state.params.k).toBe(6);
    expect(sceneHost.querySelector('.ks-panel [data-k]')?.getAttribute('data-k')).toBe('6');
    expect(sceneHost.querySelectorAll('.cs-center')).toHaveLength(6);
    for (const c of ['el', 'sil']) {
      expect(sceneHost.querySelector(`.kc-chart-${c} .kc-point[data-selected="true"]`)?.getAttribute('data-k')).toBe('6');
    }
    move(s, 1);
    expect(sceneHost.querySelectorAll('.cs-center')).toHaveLength(1);
    expect(params.textContent).not.toMatch(/NaN|Infinity/);
  });

  it('point control hidden at k=1', () => {
    const { player, params } = setup();
    player.goto(5);
    expect(shown(params, 'input[data-param=point]')).toBe(true);
    player.setParam('k', 1);
    expect(shown(params, 'input[data-param=point]')).toBe(false);
    player.goto(2);
    expect(shown(params, 'input[data-param=point]')).toBe(false);
  });

  it('clicking a point selects it and shows a, b, s', () => {
    const { player, sceneHost, params } = setup();
    player.goto(5);
    sceneHost.querySelector<SVGCircleElement>('circle.cs-point[data-i="7"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(player.state.params.point).toBe(7);
    for (const a of ['data-a', 'data-b', 'data-s']) expect(sceneHost.querySelector(`[${a}]`)?.textContent).toMatch(/^-?\d+,\d{3}$/);
    expect(sceneHost.querySelector('.cs-ring[data-kind="selected"]')?.getAttribute('data-i')).toBe('7');
    expect(pointInput(params).value).toBe('8');
    pointInput(params).value = '20';
    pointInput(params).dispatchEvent(new Event('input', { bubbles: true }));
    expect(player.state.params.point).toBe(19);
    // clicks outside the silhouette steps are ignored
    player.goto(1);
    sceneHost.querySelector<SVGCircleElement>('circle.cs-point[data-i="3"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(player.state.params.point).not.toBe(3);
  });

  it('k change during sweep stops it', () => {
    vi.useFakeTimers();
    const { player, params } = setup();
    player.goto(3);
    vi.advanceTimersByTime(950);
    const k = player.state.params.k;
    expect(k).toBeGreaterThan(3);
    move(slider(params), 5);
    vi.advanceTimersByTime(5000);
    expect(player.state.params.k).toBe(5);
    expect(slider(params).value).toBe('5');
  });

  it('changed rings follow the previous k', () => {
    vi.useFakeTimers();
    const { player, sceneHost, params } = setup();
    player.goto(7);
    expect(rings(sceneHost)).toEqual([]);
    move(slider(params), 5);
    expect(rings(sceneHost)).toEqual(changedBetween(5));
    expect(rings(sceneHost).length).toBeGreaterThan(0);
    vi.advanceTimersByTime(1100);
    expect(rings(sceneHost)).toEqual([]);
  });
});
