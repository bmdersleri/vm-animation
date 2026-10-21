// @vitest-environment jsdom
import '../svg-stubs';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { countSubpaths } from '../../../src/core/plot/dots-path';
import { pcaScenario, type PcaParams } from '../../../src/concepts/pca/scenario';
import { mountPcaScene } from '../../../src/concepts/pca/scene';
import { derivePcaView } from '../../../src/concepts/pca/view';

let cleanup: (() => void)[] = [];
afterEach(() => {
  for (const f of cleanup) f();
  cleanup = [];
  document.body.replaceChildren();
  vi.useRealTimers();
});

function setup(durationScale = 0) {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(pcaScenario);
  const scene = mountPcaScene(el, player, 'ders', { durationScale });
  scene.resize(1280, 540);
  cleanup.push(() => { scene.destroy(); player.destroy(); });
  return { el, player };
}
const view = (player: StepPlayer<PcaParams>) => derivePcaView(player.state.index, player.state.params);
const all = (el: Element, sel: string): Element[] => [...el.querySelectorAll(sel)];
const one = (el: Element, sel: string): Element => {
  const e = el.querySelector(sel);
  if (!e) throw new Error(`missing ${sel}`);
  return e;
};
const d = (el: Element, sel: string): string => one(el, sel).getAttribute('d')!;
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const hidden = (e: Element): boolean => {
  for (let n: Element | null = e; n; n = n.parentElement) {
    if ((n as HTMLElement).style?.display === 'none' || n.getAttribute('display') === 'none') return true;
  }
  return false;
};

describe('pca scene', () => {
  it('step 11: two panels with circles and triangles', () => {
    const { el, player } = setup();
    player.goto(10);
    for (const panel of ['pca', 'tsne']) {
      expect(countSubpaths(d(el, `g.panel.${panel} path.pts.c0`))).toBe(150);
      expect(countSubpaths(d(el, `g.panel.${panel} path.pts.c1`))).toBe(150);
      expect(one(el, `g.panel.${panel} path.pts.c1`).getAttribute('d')).toContain('L');
    }
    expect(all(el, 'g.panel.tsne .tick')).toHaveLength(0);
    expect(all(el, 'g.panel.pca .tick').length).toBeGreaterThan(0);
    expect(all(el, 'text.panel-title').map((t) => t.textContent)).toEqual(view(player).panels!.titles);
    expect(all(el, 'text.legend-label').map((t) => t.textContent)).toEqual(['● churn etmeyen', '▲ churn eden']);
    expect(all(el, 'g.panel.pca text.axis-title').map((t) => t.textContent)).toEqual(['PC1', 'PC2']);
    expect(all(el, 'g.panel.tsne text.axis-title').map((t) => t.textContent)).toEqual(['t-SNE 1', 't-SNE 2']);
    expect(all(el, 'path.newcust')).toHaveLength(0);
    expect(hidden(one(el, 'g.panel.pca'))).toBe(false);
  });

  it('step 12: new customer in the PCA panel, other points unchanged', () => {
    const { el, player } = setup();
    player.goto(10);
    const c0 = d(el, 'g.panel.pca path.pts.c0');
    const c1 = d(el, 'g.panel.pca path.pts.c1');
    expect(all(el, 'g.panel.pca path.newcust')).toHaveLength(0);
    player.goto(11);
    expect(d(el, 'g.panel.pca path.pts.c0')).toBe(c0);
    expect(d(el, 'g.panel.pca path.pts.c1')).toBe(c1);
    expect(all(el, 'g.panel.pca path.newcust')).toHaveLength(1);
    expect(one(el, 'g.panel.pca text.newcust-label').textContent).toBe('yeni müşteri');
  });

  it('step 12: t-SNE switches to the re-run embedding', () => {
    const { el, player } = setup();
    player.goto(10);
    const t = one(el, 'g.panel.tsne');
    expect(t.getAttribute('data-embed')).toBe('p30');
    const first = t.getAttribute('data-first');
    expect(first).toMatch(/^-?[\d.]+,-?[\d.]+$/);
    player.goto(11);
    expect(t.getAttribute('data-embed')).toBe('p30-new');
    expect(t.getAttribute('data-first')).not.toBe(first);
    expect(all(el, 'g.panel.tsne path.newcust')).toHaveLength(1);
    expect(one(el, 'g.panel.tsne text.newcust-label').textContent).toBe('yeni müşteri');
  });

  it('perplexity change morphs the t-SNE panel only', () => {
    const { el, player } = setup();
    player.goto(10);
    const pca = d(el, 'g.panel.pca path.pts.c0');
    const tsne = d(el, 'g.panel.tsne path.pts.c0');
    player.setParam('perplexity', 5);
    expect(one(el, 'g.panel.tsne').getAttribute('data-embed')).toBe('p5');
    expect(d(el, 'g.panel.pca path.pts.c0')).toBe(pca);
    expect(d(el, 'g.panel.tsne path.pts.c0')).not.toBe(tsne);
  });

  it('step 13: three rule boxes, link to ozellik-secimi', () => {
    const { el, player } = setup();
    player.goto(12);
    const boxes = all(el, '.rule .rule-box');
    expect(boxes).toHaveLength(3);
    expect(boxes.map((b) => one(b, '.rule-title').textContent)).toEqual(['PCA sıkıştırır', 'özellik seçimi eler', 't-SNE yalnızca gösterir']);
    expect(hidden(one(el, '.rule'))).toBe(false);
    expect(one(el, 'a[href="../ozellik-secimi/"]').textContent).toBe('özellik seçimi sayfası');
    for (const p of all(el, 'g.panel')) expect(hidden(p)).toBe(true);
    player.goto(10);
    expect(hidden(one(el, '.rule'))).toBe(true);
    expect(hidden(one(el, 'g.panel.pca'))).toBe(false);
  });

  it('theta sweep re-renders the projections each tick', () => {
    vi.useFakeTimers();
    const { el, player } = setup();
    player.goto(2);
    expect(one(el, 'line.dir').getAttribute('data-theta')).toBe('0');
    const first = d(el, 'path.proj-lines');
    vi.advanceTimersByTime(50);
    expect(one(el, 'line.dir').getAttribute('data-theta')).toBe('3');
    expect(d(el, 'path.proj-lines')).not.toBe(first);
  });

  it('strip text equals view.strip', () => {
    const { el, player } = setup();
    for (let i = 0; i < pcaScenario.steps.length; i++) {
      player.goto(i);
      const lines = view(player).strip.split('\n');
      const got = all(one(el, 'p.formula'), '.line');
      expect(got.map((l) => l.textContent), `step ${i + 1}`).toEqual(lines);
    }
  });

  it('only the layer of view.kind is shown', () => {
    const { el, player } = setup();
    const layers = ['g.pca-scatter', 'g.pca-gauge', 'g.scree', 'g.pca-panels'];
    for (let i = 0; i < pcaScenario.steps.length; i++) {
      player.goto(i);
      const v = view(player);
      expect(one(el, '.pca-scene').getAttribute('data-kind')).toBe(v.kind);
      const want = v.kind === 'scatter' ? ['g.pca-scatter', ...(v.scatter!.side ? ['g.pca-gauge'] : [])]
        : v.kind === 'scree' ? ['g.scree'] : v.panels!.rule ? [] : ['g.pca-panels'];
      const shown = layers.filter((s) => !hidden(one(el, s)));
      expect(shown, `step ${i + 1}`).toEqual(want);
    }
  });

  it('rapid step changes end in the final state', async () => {
    const { el, player } = setup(1);
    player.goto(2);
    await sleep(30);
    player.goto(5);
    await sleep(30);
    player.goto(11);
    await sleep(30);
    player.goto(10);
    await sleep(1600);
    expect(one(el, '.pca-scene').getAttribute('data-kind')).toBe('panels');
    expect(one(el, 'g.panel.tsne').getAttribute('data-embed')).toBe('p30');
    expect(all(el, 'path.newcust')).toHaveLength(0);
    expect(['0', '-45']).toContain(one(el, 'g.cloud').getAttribute('data-rot'));
    expect(one(el, 'path.drop-lines').getAttribute('opacity')).toBe('0');
  }, 8000);

  it('no NaN in the DOM', () => {
    const { el, player } = setup();
    for (let i = 0; i < pcaScenario.steps.length; i++) {
      player.goto(i);
      expect(el.textContent, `step ${i + 1}`).not.toContain('NaN');
      expect(el.innerHTML, `step ${i + 1} attributes`).not.toContain('NaN');
    }
    player.goto(7);
    player.setParam('birim', 1000);
    expect(el.textContent).not.toContain('NaN');
    expect(el.innerHTML).not.toContain('NaN');
  });

  it('render is measured', () => {
    const { player } = setup();
    const n = performance.getEntriesByName('pca-render').length;
    player.goto(3);
    expect(performance.getEntriesByName('pca-render').length).toBeGreaterThan(n);
  });
});
