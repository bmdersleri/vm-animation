// @vitest-environment jsdom
import '../svg-stubs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { dendrogramData as D } from '../../../src/concepts/dendrogram/data';
import { dendrogramScenario, type DendrogramParams } from '../../../src/concepts/dendrogram/scenario';
import { mountDendrogramParams } from '../../../src/concepts/dendrogram/controls';
import { mountDendrogramScene } from '../../../src/concepts/dendrogram/scene';
import { cutForK, kAtHeight } from '../../../src/concepts/dendrogram/tree';
import { axisTopOf } from '../../../src/concepts/dendrogram/view';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

const setup = () => {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }));
  const player = new StepPlayer<DendrogramParams>(dendrogramScenario);
  const sceneHost = document.createElement('div');
  const params = document.createElement('div');
  document.body.append(sceneHost, params);
  const scene = mountDendrogramScene(sceneHost, player, 'lab');
  scene.resize(1000, 600);
  mountDendrogramParams(params, player);
  return { player, sceneHost, params };
};
const input = (h: HTMLElement, p: string) => h.querySelector<HTMLInputElement>(`input[data-param=${p}]`)!;
const move = (i: HTMLInputElement, v: number | string) => { i.value = String(v); i.dispatchEvent(new Event('input', { bubbles: true })); };
const click = (e: Element) => e.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const act = (h: HTMLElement, a: string) => h.querySelector<HTMLButtonElement>(`button[data-act=${a}]`)!;
const kBtn = (h: HTMLElement, k: number) => h.querySelector<HTMLButtonElement>(`button[data-k="${k}"]`)!;
const shown = (e: Element) => !e.closest('[hidden]');
const group = (h: HTMLElement, name: string) => h.querySelector<HTMLElement>(`[data-group=${name}]`)!;
const linkageSel = (h: HTMLElement) => h.querySelector<HTMLSelectElement>('select[data-param=linkage]')!;
const choose = (s: HTMLSelectElement, v: string) => { s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); };
const focused = (h: HTMLElement) => [...h.querySelectorAll('g.dg-point[data-focus="true"]')].map((g) => Number(g.getAttribute('data-i')));

describe('dendrogram controls', () => {
  it('linkage select offers ward, complete, average, single', () => {
    const { player, params } = setup();
    expect([...linkageSel(params).options].map((o) => o.value)).toEqual(['ward', 'complete', 'average', 'single']);
    choose(linkageSel(params), 'average');
    expect(player.state.params.linkage).toBe('average');
  });

  it('merge buttons and slider 0..16', () => {
    const { player, params } = setup();
    const s = input(params, 'merges');
    expect([s.min, s.max, s.step]).toEqual(['0', '16', '1']);
    move(s, 5);
    expect(player.state.params.merges).toBe(5);
    click(act(params, 'next-merge'));
    expect(player.state.params.merges).toBe(6);
    click(act(params, 'prev-merge'));
    expect(player.state.params.merges).toBe(5);
    click(act(params, 'last-merge'));
    expect(player.state.params.merges).toBe(16);
    expect(act(params, 'next-merge').disabled).toBe(true);
    move(s, 0);
    expect(act(params, 'prev-merge').disabled).toBe(true);
  });

  it('k buttons 1–6 set k', () => {
    const { player, params } = setup();
    player.goto(5);
    expect(params.querySelectorAll('button[data-k]')).toHaveLength(6);
    click(kBtn(params, 2));
    expect(player.state.params.k).toBe(2);
    expect(kBtn(params, 2).getAttribute('aria-pressed')).toBe('true');
    expect(kBtn(params, 4).getAttribute('aria-pressed')).toBe('false');
  });

  it('cut slider maps height to k via kAtHeight', () => {
    const { player, params } = setup();
    player.goto(5);
    const s = input(params, 'cut');
    const ld = D.linkages.ward;
    expect(Number(s.min)).toBe(0);
    expect(Number(s.max)).toBeCloseTo(axisTopOf('ward'), 6);
    expect(Number(s.max)).toBeCloseTo(ld.merges[ld.merges.length - 1].height * 1.1, 5);
    move(s, cutForK(ld, 2));
    expect(player.state.params.k).toBe(2);
    const h = (ld.cuts[4].low + ld.cuts[4].high) / 2;
    move(s, h);
    expect(player.state.params.k).toBe(kAtHeight(ld, h));
    expect(player.state.params.k).toBe(5);
    // above the last merge there is one cluster; below the sixth range stays at 6
    move(s, Number(s.max));
    expect(player.state.params.k).toBe(1);
    move(s, 0);
    expect(player.state.params.k).toBe(6);
    // the slider range follows the linkage
    choose(linkageSel(params), 'single');
    expect(Number(s.max)).toBeCloseTo(axisTopOf('single'), 6);
  });

  it('linkage change keeps k', () => {
    const { player, params, sceneHost } = setup();
    player.goto(7);
    const k = player.state.params.k!;
    choose(linkageSel(params), 'complete');
    expect(player.state.params.k).toBe(k);
    const line = sceneHost.querySelector('line.dg-cut')!;
    expect(Number(line.getAttribute('data-cut'))).toBeCloseTo(cutForK(D.linkages.complete, k), 6);
  });

  it('controls shown per step', () => {
    const { player, params } = setup();
    const view = () => ['linkage', 'merges', 'cut', 'point'].map((g) => Number(shown(group(params, g)))).join('');
    for (let i = 0; i <= 4; i++) { player.goto(i); expect(view(), `step ${i + 1}`).toBe('1101'); }
    for (let i = 5; i <= 9; i++) { player.goto(i); expect(view(), `step ${i + 1}`).toBe('1011'); }
  });

  it('point input labelled 1–17 stores a 0-based index', () => {
    const { player, params } = setup();
    const p = input(params, 'point');
    expect([p.min, p.max]).toEqual(['1', '17']);
    move(p, 4);
    expect(player.state.params.point).toBe(3);
    move(p, 18);
    expect(player.state.params.point).toBe(3);
    move(p, '');
    expect(player.state.params.point).toBe(3);
  });

  it('clicking a point highlights its leaf; clicking a branch highlights its points', () => {
    const { player, sceneHost, params } = setup();
    player.goto(5);
    click(sceneHost.querySelector('g.dg-point[data-i="6"] circle')!);
    expect(player.state.params.point).toBe(6);
    expect(sceneHost.querySelector('g.dg-leaf[data-i="6"]')!.getAttribute('data-selected')).toBe('true');
    expect(input(params, 'point').value).toBe('7');
    click(sceneHost.querySelector('g.dg-leaf[data-i="2"] text')!);
    expect(player.state.params.point).toBe(2);

    player.goto(7);
    click(sceneHost.querySelector('path.dg-branch[data-merge="16"]')!);
    expect(focused(sceneHost)).toHaveLength(17);
    click(sceneHost.querySelector('path.dg-branch[data-merge="1"]')!);
    expect(focused(sceneHost)).toHaveLength(2);
    expect(sceneHost.querySelector('path.dg-branch[data-merge="1"]')!.getAttribute('data-picked')).toBe('true');
    // a point click replaces the branch highlight; a step change clears it
    click(sceneHost.querySelector('g.dg-point[data-i="0"] circle')!);
    expect(focused(sceneHost)).toHaveLength(0);
    click(sceneHost.querySelector('path.dg-branch[data-merge="3"]')!);
    expect(focused(sceneHost).length).toBeGreaterThan(1);
    player.goto(8);
    expect(focused(sceneHost)).toHaveLength(0);
  });

  it('linkage change during merge sweep stops it', () => {
    vi.useFakeTimers();
    const { player, params } = setup();
    player.goto(2);
    vi.advanceTimersByTime(1500);
    const at = player.state.params.merges;
    expect(at).toBeLessThan(8);
    choose(linkageSel(params), 'average');
    vi.advanceTimersByTime(10000);
    expect(player.state.params.merges).toBe(at);
    expect(player.state.params.linkage).toBe('average');
  });

  it('linkage change during k sweep stops it', () => {
    vi.useFakeTimers();
    const { player, params } = setup();
    player.goto(6);
    vi.advanceTimersByTime(1500);
    const at = player.state.params.k;
    choose(linkageSel(params), 'complete');
    vi.advanceTimersByTime(10000);
    expect(player.state.params.k).toBe(at);
  });
});
