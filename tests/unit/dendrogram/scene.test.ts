// @vitest-environment jsdom
import '../svg-stubs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { dendrogramData as D } from '../../../src/concepts/dendrogram/data';
import { cutForK } from '../../../src/concepts/dendrogram/tree';
import { dendrogramScenario, type DendrogramParams } from '../../../src/concepts/dendrogram/scenario';
import { mountDendrogramScene } from '../../../src/concepts/dendrogram/scene';
import { cutSizes, linkageRows, mergeInfo } from '../../../src/concepts/dendrogram/view';
import { CLUSTER } from '../../../src/core/plot/marks';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

const n = D.points.length;
const setup = (mode: 'ders' | 'lab' = 'ders') => {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }));
  const player = new StepPlayer<DendrogramParams>(dendrogramScenario);
  const host = document.createElement('div');
  document.body.append(host);
  const scene = mountDendrogramScene(host, player, mode);
  scene.resize(1000, 600);
  return { player, host, scene };
};
const text = (host: HTMLElement, sel: string) => host.querySelector(sel)?.textContent ?? '';
const attr = (host: HTMLElement, sel: string, a: string) => host.querySelector(sel)?.getAttribute(a);
const fin = (scene: { destroy(): void }, player: StepPlayer<DendrogramParams>) => { scene.destroy(); player.destroy(); };
const clusterOf = (host: HTMLElement) => [...host.querySelectorAll('g.dg-point')].map((g) => g.getAttribute('data-cluster'));

describe('dendrogram scene', () => {
  it('step 1 shows 17 plain points, 17 leaves and no branches', () => {
    const { player, host, scene } = setup();
    expect(host.querySelectorAll('g.dg-point')).toHaveLength(n);
    expect(host.querySelectorAll('g.dg-leaf')).toHaveLength(n);
    expect(host.querySelectorAll('path.dg-branch')).toHaveLength(0);
    expect(attr(host, '[data-k]', 'data-k')).toBe('17');
    expect(attr(host, '[data-merges]', 'data-merges')).toBe('0');
    expect(host.querySelector('line.dg-cut')).toBeNull();
    expect(host.textContent).not.toMatch(/NaN|Infinity|undefined/);
    fin(scene, player);
  });

  it('step 2 shows the first merge in both views', () => {
    const { player, host, scene } = setup();
    player.goto(1);
    expect(host.querySelectorAll('path.dg-branch')).toHaveLength(1);
    expect(host.querySelector('path.dg-branch[data-merge="1"]')).not.toBeNull();
    expect(host.querySelector('path.dg-hull[data-merge="1"]')).not.toBeNull();
    expect(attr(host, '[data-k]', 'data-k')).toBe(String(n - 1));
    expect(text(host, '[data-merge-text]')).toBe(mergeInfo('ward', 1).text);
    const m = D.linkages.ward.merges[0];
    for (const p of [m.a, m.b]) expect(host.querySelector(`g.dg-point[data-i="${p}"]`)!.getAttribute('data-merged')).toBe('true');
    fin(scene, player);
  });

  it('step 3 sweeps merges 2..8 and the counters follow', () => {
    vi.useFakeTimers();
    const { player, host, scene } = setup();
    player.goto(2);
    expect(attr(host, '[data-merges]', 'data-merges')).toBe('2');
    vi.advanceTimersByTime(8000);
    expect(player.state.params.merges).toBe(8);
    expect(host.querySelectorAll('path.dg-branch')).toHaveLength(8);
    expect(attr(host, '[data-k]', 'data-k')).toBe(String(n - 8));
    fin(scene, player);
  });

  it('step 4 shows the ward SSE increase from the data', () => {
    const { player, host, scene } = setup();
    player.goto(3);
    expect(text(host, '[data-sse]')).toContain('0,085');
    expect(attr(host, '[data-sse]', 'data-sse')).toBe(String(D.wardExample.increase));
    expect(host.querySelectorAll('path.dg-branch')).toHaveLength(D.wardExample.merge + 1);
    expect(host.querySelector('path.dg-branch[data-state="highlight"]')!.getAttribute('data-merge')).toBe(String(D.wardExample.merge + 1));
    // another linkage has no Ward sum of squares
    player.setParam('linkage', 'single');
    expect(host.querySelector('[data-sse]')).toBeNull();
    fin(scene, player);
  });

  it('step 5 completes the tree: one cluster', () => {
    vi.useFakeTimers();
    const { player, host, scene } = setup();
    player.goto(4);
    vi.advanceTimersByTime(20000);
    expect(host.querySelectorAll('path.dg-branch')).toHaveLength(n - 1);
    expect(attr(host, '[data-k]', 'data-k')).toBe('1');
    fin(scene, player);
  });

  it('step 6 draws the cut, k and the coloured scatter', () => {
    const { player, host, scene } = setup();
    player.goto(5);
    const k = player.state.params.k!;
    expect(attr(host, 'line.dg-cut', 'data-cut')).toBe(String(cutForK(D.linkages.ward, k)));
    expect(attr(host, '[data-k]', 'data-k')).toBe(String(k));
    expect(clusterOf(host)).toEqual(D.linkages.ward.cuts[k - 1].labels.map(String));
    const sizes = [...host.querySelectorAll('[data-clusters] [data-size]')].map((e) => Number(e.getAttribute('data-size')));
    expect(sizes).toEqual(cutSizes('ward', k));
    const fill = host.querySelector('g.dg-point[data-i="0"] circle')!.getAttribute('fill');
    expect(fill).toBe(CLUSTER[D.linkages.ward.cuts[k - 1].labels[0]]);
    fin(scene, player);
  });

  it('step 7 sweeps k 1..6 and stays on 6', () => {
    vi.useFakeTimers();
    const { player, host, scene } = setup();
    player.goto(6);
    expect(attr(host, '[data-k]', 'data-k')).toBe('1');
    vi.advanceTimersByTime(1200 * 3 + 50);
    expect(Number(attr(host, '[data-k]', 'data-k'))).toBeGreaterThan(1);
    vi.advanceTimersByTime(1200 * 10);
    expect(attr(host, '[data-k]', 'data-k')).toBe('6');
    expect(host.querySelectorAll('[data-clusters] [data-size]')).toHaveLength(6);
    fin(scene, player);
  });

  it('step 8 puts the cut in the largest gap with k=3', () => {
    const { player, host, scene } = setup();
    player.goto(7);
    expect(attr(host, '[data-k]', 'data-k')).toBe('3');
    const cut = Number(attr(host, 'line.dg-cut', 'data-cut'));
    const c3 = D.linkages.ward.cuts[2];
    expect(cut).toBeGreaterThan(c3.low);
    expect(cut).toBeLessThan(c3.high);
    expect(host.querySelector('rect.dg-gap')).not.toBeNull();
    expect(text(host, '[data-gap]')).toContain('2,82');
    expect(text(host, '[data-gap]')).toContain('9,00');
    expect(clusterOf(host)).toEqual(c3.labels.map(String));
    fin(scene, player);
  });

  it('step 9 single linkage chains A and B', () => {
    const { player, host, scene } = setup();
    player.goto(8);
    expect(host.querySelectorAll('path.dg-branch')).toHaveLength(n - 1);
    expect(clusterOf(host)).toEqual(D.linkages.single.cuts[2].labels.map(String));
    expect(attr(host, '[data-linkage="single"]', 'data-sizes')).toBe(cutSizes('single', 3).join(' '));
    expect(attr(host, '[data-linkage="ward"]', 'data-sizes')).toBe(cutSizes('ward', 3).join(' '));
    const g = D.meta.groups;
    const lab = clusterOf(host);
    expect(new Set([...g.A, ...g.zincir, ...g.B].map((i) => lab[i])).size).toBe(1);
    expect(attr(host, 'line.dg-cut', 'data-cut')).toBe(String(cutForK(D.linkages.single, 3)));
    fin(scene, player);
  });

  it('step 10 lists ward, complete and single sizes and the book code', () => {
    const { player, host, scene } = setup();
    player.goto(9);
    const rows = [...host.querySelectorAll('tr[data-row]')];
    expect(rows.map((r) => r.getAttribute('data-row'))).toEqual(['ward', 'complete', 'single']);
    linkageRows().forEach((r, i) => expect(rows[i].getAttribute('data-sizes')).toBe(r.sizes.join(' ')));
    expect(text(host, '.dg-code')).toContain('linkage(X, method="ward")');
    expect(text(host, '.dg-code')).toContain('AgglomerativeClustering(n_clusters=3, linkage="ward")');
    fin(scene, player);
  });

  it('a linkage change keeps k and redraws the cut on the new axis', () => {
    const { player, host, scene } = setup('lab');
    player.goto(7);
    player.setParam('linkage', 'complete');
    expect(attr(host, '[data-k]', 'data-k')).toBe('3');
    expect(attr(host, 'line.dg-cut', 'data-cut')).toBe(String(cutForK(D.linkages.complete, 3)));
    expect(host.querySelectorAll('path.dg-branch')).toHaveLength(n - 1);
    fin(scene, player);
  });

  it('a selected point rings the scatter and marks the leaf', () => {
    const { player, host, scene } = setup('lab');
    player.goto(7);
    player.setParam('point', 4);
    expect(attr(host, 'g.dg-leaf[data-selected="true"]', 'data-i')).toBe('4');
    expect(host.querySelector('circle.dg-sel')).not.toBeNull();
    expect(text(host, 'text.dg-sel-label')).toBe('Nokta 5');
    player.setParam('point', null);
    expect(host.querySelector('circle.dg-sel')).toBeNull();
    fin(scene, player);
  });

  it('destroy stops timers and removes listeners', () => {
    vi.useFakeTimers();
    const { player, host, scene } = setup();
    player.goto(2);
    vi.advanceTimersByTime(900);
    scene.destroy();
    expect(host.children).toHaveLength(0);
    const before = host.innerHTML;
    vi.advanceTimersByTime(60000);
    expect(host.innerHTML).toBe(before);
    player.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });
});
