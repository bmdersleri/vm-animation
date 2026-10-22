// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { dbscanScenario, type DbscanParams } from '../../../src/concepts/dbscan/scenario';
import { mountDbscanParams } from '../../../src/concepts/dbscan/controls';
import { mountDbscanScene } from '../../../src/concepts/dbscan/scene';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

const setup = () => {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }));
  const player = new StepPlayer<DbscanParams>(dbscanScenario);
  const sceneHost = document.createElement('div');
  const params = document.createElement('div');
  document.body.append(sceneHost, params);
  const scene = mountDbscanScene(sceneHost, player, 'lab');
  scene.resize(1000, 600);
  mountDbscanParams(params, player);
  return { player, sceneHost, params, scene };
};
const input = (h: HTMLElement, p: string) => h.querySelector<HTMLInputElement>(`input[data-param=${p}]`)!;
const move = (i: HTMLInputElement, v: number | string) => { i.value = String(v); i.dispatchEvent(new Event('input', { bubbles: true })); };
const shown = (h: HTMLElement, p: string) => !input(h, p).closest('[hidden]');

describe('dbscan controls', () => {
  it('eps slider 0.05..1.00 step 0.01 writes eps', () => {
    const { player, params } = setup();
    player.goto(8);
    const s = input(params, 'eps');
    expect([s.min, s.max, s.step]).toEqual(['0.05', '1', '0.01']);
    move(s, 0.3);
    expect(player.state.params.eps).toBe(0.3);
    move(s, 0.1 + 0.2);
    expect(player.state.params.eps).toBe(0.3);
    expect(params.textContent).toContain('eps = 0,30');
  });

  it('min_samples slider 2..15', () => {
    const { player, params } = setup();
    player.goto(9);
    const s = input(params, 'minSamples');
    expect([s.min, s.max, s.step]).toEqual(['2', '15', '1']);
    move(s, 7);
    expect(player.state.params.minSamples).toBe(7);
    expect(params.textContent).toContain('min_samples = 7');
  });

  it('point input labelled 1–210 stores a 0-based index', () => {
    const { player, params } = setup();
    player.goto(2);
    const p = input(params, 'point');
    expect([p.min, p.max]).toEqual(['1', '210']);
    expect(params.textContent).toContain('Nokta (1–210)');
    move(p, 20);
    expect(player.state.params.point).toBe(19);
    move(p, 211);
    expect(player.state.params.point).toBe(19);
    move(p, '');
    expect(player.state.params.point).toBe(19);
  });

  it('clicking a point selects it', () => {
    const { player, sceneHost, params } = setup();
    player.goto(5);
    sceneHost.querySelector<SVGGElement>('g.pk-point[data-i="7"] circle')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(player.state.params.point).toBe(7);
    expect(input(params, 'point').value).toBe('8');
    // outside steps 3-8 clicks are ignored
    player.goto(8);
    sceneHost.querySelector<SVGGElement>('g.pk-point[data-i="3"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(player.state.params.point).not.toBe(3);
  });

  it('controls shown per step', () => {
    const { player, params } = setup();
    const want = (i: number) => [shown(params, 'point'), shown(params, 'eps'), shown(params, 'minSamples')].map(Number).join('');
    for (const i of [0, 1]) { player.goto(i); expect(want(i)).toBe('000'); }
    for (let i = 2; i <= 7; i++) { player.goto(i); expect(want(i)).toBe('111'); }
    player.goto(8); expect(want(8)).toBe('010');
    player.goto(9); expect(want(9)).toBe('001');
  });

  it('slider during spread sweep stops it', () => {
    vi.useFakeTimers();
    const { player, params } = setup();
    player.goto(7);
    vi.advanceTimersByTime(600);
    expect(player.state.params.spread).toBeLessThan(1);
    move(input(params, 'eps'), 0.4);
    vi.advanceTimersByTime(5000);
    expect(player.state.params.eps).toBe(0.4);
  });
});
