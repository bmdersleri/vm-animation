// @vitest-environment jsdom
import '../svg-stubs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { dbscanData as d } from '../../../src/concepts/dbscan/data';
import { dbscan } from '../../../src/concepts/dbscan/dbscan';
import { dbscanScenario, type DbscanParams } from '../../../src/concepts/dbscan/scenario';
import { mountDbscanScene } from '../../../src/concepts/dbscan/scene';
import { clusterSizes, countsText, kindCounts, verdictFor } from '../../../src/concepts/dbscan/view';
import { CLUSTER } from '../../../src/core/plot/marks';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

// jsdom cannot interpolate SVG transforms, so d3 transitions are switched off (reduced motion) for every test.
const setup = (mode: 'ders' | 'lab' = 'ders', reduce = true) => {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: reduce && q.includes('reduce'), media: q }));
  const player = new StepPlayer<DbscanParams>(dbscanScenario);
  const host = document.createElement('div');
  document.body.append(host);
  const scene = mountDbscanScene(host, player, mode);
  scene.resize(1000, 600);
  return { player, host, scene };
};
const text = (host: HTMLElement, sel: string) => host.querySelector(sel)?.textContent ?? '';
const attr = (host: HTMLElement, sel: string, a: string) => host.querySelector(sel)?.getAttribute(a);
const kinds = (host: HTMLElement) => [...host.querySelectorAll('g.pk-point')].map((g) => g.getAttribute('data-kind'));
const count = (host: HTMLElement, k: string) => kinds(host).filter((v) => v === k).length;
const fin = (scene: { destroy(): void }, player: StepPlayer<DbscanParams>) => { scene.destroy(); player.destroy(); };
const base = dbscan(d.points, d.meta.eps, d.meta.minSamples);
const { core: A, border: B, noise: C } = d.examples;

describe('dbscan scene', () => {
  it('the panel eps reads like the Lab slider output (two decimals); Ders keeps the short form', () => {
    const { player, host, scene } = setup('lab');
    player.goto(2);
    expect(text(host, '[data-eps]')).toBe('0,30');
    player.setParam('eps', 0.4);
    expect(text(host, '[data-eps]')).toBe('0,40');
    player.setParam('eps', 0.15);
    expect(text(host, '[data-eps]')).toBe('0,15');
    scene.setMode('ders');
    expect(text(host, '[data-eps]')).toBe('0,15');
    player.setParam('eps', 0.3);
    expect(text(host, '[data-eps]')).toBe('0,3');
    fin(scene, player);
  });

  it('step 1 draws every point grey with no kinds', () => {
    const { player, host, scene } = setup();
    expect(host.querySelectorAll('g.pk-point')).toHaveLength(d.points.length);
    expect(new Set(kinds(host))).toEqual(new Set(['-']));
    expect(host.querySelector('circle.pk-eps')).toBeNull();
    expect(host.textContent).not.toMatch(/NaN|Infinity|undefined/);
    fin(scene, player);
  });

  it('step 2 colours by kmeansLabels with no kinds', () => {
    const { player, host, scene } = setup();
    player.goto(1);
    expect(new Set(kinds(host))).toEqual(new Set(['-']));
    const fills = [...host.querySelectorAll('g.pk-point')].map((g) => g.querySelector('circle')!.getAttribute('fill'));
    expect(fills).toEqual(d.kmeansLabels.map((l) => CLUSTER[l]));
    fin(scene, player);
  });

  it('step 3 draws the eps circle of A with its neighbour count', () => {
    const { player, host, scene } = setup();
    player.goto(2);
    expect(host.querySelectorAll('circle.pk-eps')).toHaveLength(1);
    expect(Number(attr(host, 'circle.pk-eps', 'data-r'))).toBe(d.meta.eps);
    expect(text(host, '[data-neighbours]')).toBe(String(base.neighbours[A].length));
    expect(host.querySelectorAll('circle.pk-nbr')).toHaveLength(base.neighbours[A].length - 1);
    expect(text(host, 'text.pk-sel-label')).toBe(`Nokta ${A + 1}`);
    expect(host.querySelector('[data-verdict]')).toBeNull();
    expect(new Set(kinds(host))).toEqual(new Set(['-']));
    fin(scene, player);
  });

  it('steps 4-6 show core, border and noise verdicts', () => {
    const { player, host, scene } = setup();
    for (const [step, i, kind] of [[3, A, 'core'], [4, B, 'border'], [5, C, 'noise']] as const) {
      player.goto(step);
      const v = verdictFor(base, i, d.meta.minSamples);
      expect(attr(host, '[data-verdict]', 'data-verdict')).toBe(kind);
      expect(text(host, '[data-verdict]')).toContain(v.text);
      expect(text(host, '[data-neighbours]')).toBe(String(v.neighbours));
      // the chosen point's kind is revealed; a border point also reveals the core it hangs on
      const shown = kinds(host).filter((k) => k !== '-').sort();
      expect(shown).toEqual(kind === 'border' ? ['border', 'core'] : [kind]);
      expect(host.querySelector(`g.pk-point[data-i="${i}"]`)!.getAttribute('data-kind')).toBe(kind);
    }
    player.goto(4);
    expect(host.querySelector('circle.pk-via')).not.toBeNull();
    player.goto(3);
    expect(host.querySelector('circle.pk-via')).toBeNull();
    fin(scene, player);
  });

  it('step 7 counts match the data', () => {
    const { player, host, scene } = setup();
    player.goto(6);
    const k = kindCounts(base);
    expect([count(host, 'core'), count(host, 'border'), count(host, 'noise')]).toEqual([k.core, k.border, k.noise]);
    expect(text(host, '[data-counts]')).toBe(countsText(base));
    expect(host.querySelector('circle.pk-eps')).toBeNull();
    fin(scene, player);
  });

  it('step 8 sweep ends with every cluster coloured', () => {
    vi.useFakeTimers();
    const { player, host, scene } = setup();
    player.goto(7);
    expect(Number(attr(host, '[data-spread]', 'data-spread'))).toBe(0);
    expect(count(host, 'core') + count(host, 'border')).toBe(0);
    vi.advanceTimersByTime(150 * 30);
    expect(player.state.params.spread).toBe(1);
    const k = kindCounts(base);
    expect([count(host, 'core'), count(host, 'border'), count(host, 'noise')]).toEqual([k.core, k.border, k.noise]);
    const sizes = [...host.querySelectorAll('[data-clusters] [data-size]')].map((e) => Number(e.getAttribute('data-size')));
    expect(sizes).toEqual(clusterSizes(base));
    expect(text(host, '[data-clusters]')).toContain('Küme 1');
    fin(scene, player);
  });

  it('step 8 colours the points in expansion order while it spreads', () => {
    vi.useFakeTimers();
    const { player, host, scene } = setup();
    player.goto(7);
    vi.advanceTimersByTime(150 * 10);
    const sp = player.state.params.spread;
    expect(sp).toBeGreaterThan(0);
    expect(sp).toBeLessThan(1);
    const coloured = kinds(host).filter((v) => v !== '-').length;
    expect(coloured).toBe(Math.round(sp * (base.order.length + kindCounts(base).noise)));
    const first = base.order[0];
    expect(host.querySelector(`g.pk-point[data-i="${first}"]`)!.getAttribute('data-kind')).not.toBe('-');
    fin(scene, player);
  });

  it('step 9 sweeps eps and ends on the last stop with the live counts', () => {
    vi.useFakeTimers();
    const { player, host, scene } = setup();
    player.goto(8);
    expect(player.state.params.eps).toBe(d.epsSweep[0]);
    vi.advanceTimersByTime(1800 * 5);
    expect(player.state.params.eps).toBe(d.epsSweep[2]);
    const r = dbscan(d.points, d.epsSweep[2], d.meta.minSamples);
    expect(text(host, '[data-counts]')).toBe(countsText(r));
    expect(count(host, 'noise')).toBe(kindCounts(r).noise);
    fin(scene, player);
  });

  it('step 10 marks the knee and eps', () => {
    const { player, host, scene } = setup();
    player.goto(9);
    expect(host.querySelector('svg.kd-chart')).not.toBeNull();
    expect(Number(attr(host, '[data-knee]', 'data-knee'))).toBe(d.knee);
    expect(Number(attr(host, '[data-eps-line]', 'data-eps-line'))).toBe(d.meta.eps);
    expect(text(host, '.db-code')).toBe('DBSCAN(eps=0.3, min_samples=5)');
    expect(host.querySelectorAll('.kd-line')).toHaveLength(1);
    expect(host.textContent).not.toMatch(/NaN|Infinity|undefined/);
    player.setParam('minSamples', 9);
    expect(text(host, '.db-code')).toBe('DBSCAN(eps=0.3, min_samples=9)');
    fin(scene, player);
  });

  it('step 10 marks a knee for every min_samples', () => {
    const { player, host, scene } = setup('lab');
    player.goto(9);
    for (const m of [2, 5, 15]) {
      player.setParam('minSamples', m);
      const curve = d.kdist.find((k) => k.minSamples === m)!;
      expect(host.querySelectorAll('[data-knee]'), `m ${m}`).toHaveLength(1);
      expect(Number(attr(host, '[data-knee]', 'data-knee'))).toBe(curve.knee);
    }
    fin(scene, player);
  });

  it('root view names the k-distance step', () => {
    const { player, host, scene } = setup();
    const root = host.querySelector('.db-scene')!;
    expect(root.getAttribute('data-view')).toBe('scatter');
    player.goto(9);
    expect(root.getAttribute('data-view')).toBe('kdist');
    player.goto(8);
    expect(root.getAttribute('data-view')).toBe('scatter');
    expect(root.hasAttribute('data-step')).toBe(false);
    fin(scene, player);
  });

  it('cluster list caps at 12 chips and names the rest', () => {
    const { player, host, scene } = setup('lab');
    player.goto(6);
    player.setParams({ eps: 0.11, minSamples: 2 });
    const r = dbscan(d.points, 0.11, 2);
    const total = clusterSizes(r).length;
    expect(total).toBeGreaterThan(12);
    expect(host.querySelectorAll('li.db-size')).toHaveLength(12);
    expect(attr(host, '[data-more]', 'data-more')).toBe(String(total - 12));
    expect(text(host, '[data-more]')).toBe(`… ${total - 12} küme daha`);
    expect(host.querySelector('[data-clusters]')!.lastElementChild).toBe(host.querySelector('[data-more]'));
    fin(scene, player);
  });

  it('play and pause do not restart the step 3 count-up', () => {
    vi.useFakeTimers();
    const { player, host, scene } = setup('ders', false);
    player.goto(2);
    const total = base.neighbours[A].length;
    vi.advanceTimersByTime(60 * (total + 2));
    const shown = () => text(host, '[data-neighbours]');
    expect(shown()).toBe(String(total));
    player.play();
    player.pause();
    expect(shown()).toBe(String(total));
    vi.advanceTimersByTime(60 * 3);
    expect(shown()).toBe(String(total));
    // mid-count: play and pause keep the same count-up running
    player.goto(0);
    player.goto(2);
    vi.advanceTimersByTime(60 * 3);
    player.play();
    player.pause();
    expect(shown()).toBe('3');
    vi.advanceTimersByTime(60);
    expect(shown()).toBe('4');
    fin(scene, player);
  });

  it('count-up ticks update the neighbour count in place', () => {
    vi.useFakeTimers();
    const { player, host, scene } = setup('ders', false);
    player.goto(2);
    vi.advanceTimersByTime(60 * 2);
    const block = host.querySelector('.db-point');
    const num = host.querySelector('[data-neighbours]');
    expect(num!.textContent).toBe('2');
    vi.advanceTimersByTime(60);
    expect(host.querySelector('.db-point')).toBe(block);
    expect(host.querySelector('[data-neighbours]')).toBe(num);
    expect(num!.textContent).toBe('3');
    expect(num!.getAttribute('data-neighbours')).toBe('3');
    expect(host.querySelectorAll('circle.pk-nbr')).toHaveLength(2);
    // the last tick draws the panel once more, with the final count and a polite live region
    vi.advanceTimersByTime(60 * base.neighbours[A].length);
    expect(text(host, '[data-neighbours]')).toBe(String(base.neighbours[A].length));
    expect(host.querySelector('.db-panel')!.getAttribute('aria-live')).toBe('polite');
    fin(scene, player);
  });

  it('the panel verdict follows a live eps change', () => {
    const { player, host, scene } = setup('lab');
    player.goto(3);
    player.setParam('eps', 0.05);
    const r = dbscan(d.points, 0.05, d.meta.minSamples);
    expect(attr(host, '[data-verdict]', 'data-verdict')).toBe(r.kind[A]);
    expect(text(host, '[data-verdict]')).toContain(verdictFor(r, A, d.meta.minSamples).text);
    expect(text(host, '[data-neighbours]')).toBe(String(r.neighbours[A].length));
    expect(Number(attr(host, 'circle.pk-eps', 'data-r'))).toBe(0.05);
    fin(scene, player);
  });

  it('no core point says so', () => {
    const { player, host, scene } = setup('lab');
    player.goto(6);
    player.setParams({ eps: 0.05, minSamples: 15 });
    expect(text(host, '.db-panel')).toContain('Çekirdek yok: bütün noktalar gürültü.');
    expect(count(host, 'noise')).toBe(d.points.length);
    fin(scene, player);
  });

  it('panel is a direct child of the scene and follows the plot', () => {
    const { player, host, scene } = setup('lab');
    const root = host.querySelector('.db-scene')!;
    expect(root.getAttribute('data-mode')).toBe('lab');
    expect([...root.children].map((c) => c.className)).toEqual(['db-plot-host', 'db-panel']);
    fin(scene, player);
  });

  it('step 3 counts the neighbours nearest-first, a param change shows the new state, destroy leaves no timers', () => {
    vi.useFakeTimers();
    const { player, host, scene } = setup('ders', false);
    player.goto(2);
    const total = base.neighbours[A].length;
    const shown = () => Number(attr(host, '[data-neighbours]', 'data-neighbours'));
    const rings = () => [...host.querySelectorAll('circle.pk-nbr')].map((c) => Number(c.getAttribute('data-i')));
    expect(shown()).toBe(0);
    expect(host.querySelector('.db-panel')!.getAttribute('aria-live')).toBe('off');
    vi.advanceTimersByTime(60 * 4);
    expect(shown()).toBe(4);
    const first = rings();
    vi.advanceTimersByTime(60 * 3);
    expect(shown()).toBe(7);
    expect(rings().slice(0, first.length)).toEqual(first);
    // nearest first: the rings drawn so far are never farther than the ones still to come
    const dist = (i: number) => Math.hypot(d.points[i][0] - d.points[A][0], d.points[i][1] - d.points[A][1]);
    const drawn = new Set(rings());
    const farthestDrawn = Math.max(...[...drawn].map(dist));
    for (const j of base.neighbours[A]) if (!drawn.has(j) && j !== A) expect(dist(j)).toBeGreaterThanOrEqual(farthestDrawn - 1e-12);
    // a param change mid-count shows the new state at once and stops the timer
    player.setParam('eps', 0.1);
    const r = dbscan(d.points, 0.1, d.meta.minSamples);
    expect(shown()).toBe(r.neighbours[A].length);
    expect(vi.getTimerCount()).toBe(0);
    expect(host.querySelector('.db-panel')!.getAttribute('aria-live')).toBe('polite');
    // a fresh visit counts all the way to the data's number
    player.goto(0);
    player.goto(2);
    vi.advanceTimersByTime(60 * (total + 2));
    expect(shown()).toBe(total);
    expect(vi.getTimerCount()).toBe(0);
    // destroy mid-count leaves nothing running
    player.goto(0);
    player.goto(2);
    vi.advanceTimersByTime(120);
    scene.destroy();
    player.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('step 8 end state also shows the counts line', () => {
    const { player, host, scene } = setup();
    player.goto(7);
    player.setParam('spread', 0.5);
    expect(host.querySelector('[data-counts]')).toBeNull();
    player.setParam('spread', 1);
    expect(text(host, '[data-counts]')).toBe(countsText(base));
    fin(scene, player);
  });

  it('destroy stops timers and removes listeners', () => {
    vi.useFakeTimers();
    const { player, host, scene } = setup();
    player.goto(7);
    vi.advanceTimersByTime(300);
    scene.destroy();
    expect(host.children).toHaveLength(0);
    const before = host.innerHTML;
    vi.advanceTimersByTime(150 * 40);
    expect(host.innerHTML).toBe(before);
    player.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });
});
