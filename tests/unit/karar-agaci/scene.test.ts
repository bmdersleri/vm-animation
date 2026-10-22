// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { SCAN_N, treeScenario, type TreeParams } from '../../../src/concepts/karar-agaci/scenario';
import { mountTreeScene, regionFill, treeKey } from '../../../src/concepts/karar-agaci/scene';
import { buildTree, childSweeps, sweep, toSamples } from '../../../src/concepts/karar-agaci/cart';
import { DOMAIN, train, test } from '../../../src/concepts/karar-agaci/data';
import { fitViewport } from '../../../src/core/plot/viewport';
import fixture from '../../fixtures/karar-agaci_sklearn.json';

type Handle = ReturnType<typeof mountTreeScene>;
interface FxNode { feature: number; left?: FxNode; right?: FxNode }

let cleanup: (() => void)[] = [];

beforeEach(() => {
  // jsdom has no canvas backend; make the "no 2D context" path explicit and quiet
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  for (const f of cleanup) f();
  cleanup = [];
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function setup(
  mode: 'lab' | 'ders' = 'ders', size: [number, number] = [1280, 541], durationScale = 0,
): { el: HTMLElement; player: StepPlayer<TreeParams>; scene: Handle } {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(treeScenario);
  const scene = mountTreeScene(el, player, mode, { durationScale });
  scene.resize(...size);
  cleanup.push(() => { scene.destroy(); player.destroy(); });
  return { el, player, scene };
}

const all = (el: Element, sel: string): Element[] => [...el.querySelectorAll(sel)];
const num = (e: Element, a: string): number => Number(e.getAttribute(a));
const translate = (e: Element): [number, number] => {
  const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(e.getAttribute('transform') ?? '')!;
  return [Number(m[1]), Number(m[2])];
};
/** Number of vertices of an SVG polyline path ("M…L…L…"). */
const vertices = (d: string): number => (d.match(/[ML]/g) ?? []).length;
const internalNodes = (n: FxNode): number =>
  (n.feature === -1 ? 0 : 1 + (n.left ? internalNodes(n.left) : 0) + (n.right ? internalNodes(n.right) : 0));
const n0 = sweep(toSamples(train), 0, 'gini').length;

describe('mountTreeScene', () => {
  it('part 2 draws all train points with class shapes', () => {
    const { el, player } = setup();
    // part 1: the cards fill the stage, the plot layers are hidden
    expect(el.querySelector<HTMLElement>('.tree-scene')!.hidden).toBe(true);
    expect(el.querySelector<HTMLElement>('.cards-layer')!.hidden).toBe(false);

    player.goto(6);
    expect(el.querySelector<HTMLElement>('.tree-scene')!.hidden).toBe(false);
    expect(el.querySelector<HTMLElement>('.cards-layer')!.hidden).toBe(true);
    const stayed = train.filter((r) => r.y === 0).length;
    expect(all(el, 'circle.pt.kaldi')).toHaveLength(stayed);
    expect(all(el, 'path.pt.ayrildi')).toHaveLength(train.length - stayed);
    expect(all(el, '.pt.test')).toHaveLength(0);
    expect(el.querySelector('canvas.regions')).not.toBeNull();
    expect(el.querySelector('svg.curve')).not.toBeNull();
    expect(el.querySelector('div.tree-col')).not.toBeNull();

    // points with the same complaint count are shifted vertically by their jitter
    const y = new Map(all(el, '.pt').map((p) => [Number(p.getAttribute('data-i')), translate(p)[1]]));
    const pairs = train.flatMap((a, i) => train.map((b, j) => [a, b, i, j] as const))
      .filter(([a, b]) => a.c === b.c && a.jy > b.jy + 0.02);
    expect(pairs.length).toBeGreaterThan(0);
    for (const [, , i, j] of pairs) expect(y.get(i)!).toBeLessThan(y.get(j)!);
  });

  it('scan line moves with params.scan and the curve has scan+1 points', () => {
    const { el, player } = setup();
    player.goto(7);
    player.setParam('scan', 3);
    const line = () => el.querySelector('line.scan')!;
    expect(all(el, 'line.scan')).toHaveLength(1);
    expect(num(line(), 'x1')).toBe(num(line(), 'x2')); // vertical: contract axis
    const x3 = num(line(), 'x1');
    expect(vertices(el.querySelector('path.curve-line')!.getAttribute('d')!)).toBe(4);
    expect(all(el, 'circle.curve-dot')).toHaveLength(1);
    expect(el.querySelector('text.curve-title')!.textContent).toContain('sözleşme');

    player.setParam('scan', 5);
    expect(num(line(), 'x1')).toBeGreaterThan(x3);
    expect(vertices(el.querySelector('path.curve-line')!.getAttribute('d')!)).toBe(6);

    // second half: the complaint axis, a horizontal line, the panel switches axis
    player.setParam('scan', n0 + 1);
    expect(num(line(), 'y1')).toBe(num(line(), 'y2'));
    expect(vertices(el.querySelector('path.curve-line')!.getAttribute('d')!)).toBe(2);
    expect(el.querySelector('text.curve-title')!.textContent).toContain('şikâyet');
    expect(el.querySelector('text.curve-best')!.textContent).toMatch(/Sözleşme/);
  });

  it('step 8 shows root question and two leaves in the tree column', () => {
    const { el, player } = setup();
    player.goto(8);
    const col = el.querySelector('div.tree-col')!;
    expect(all(col, 'g.node')).toHaveLength(3);
    expect(all(col, 'g.node.leaf')).toHaveLength(2);
    expect(col.querySelector('g.node.internal')!.textContent).toContain('Şikâyet ≤ 2,5?');
    expect(all(col, 'path.edge')).toHaveLength(2);
    expect(all(col, 'text.edge-label').map((t) => t.textContent)).toEqual(['evet', 'hayır']);
    // the two candidate cards sit in the tree column, not over the scatter
    const cards = col.querySelector<HTMLElement>('.cards-layer')!;
    expect(cards.hidden).toBe(false);
    expect(all(cards, '.card')).toHaveLength(2);
    expect(all(el, 'line.chosen')).toHaveLength(1);
    expect(all(el, 'line.scan')).toHaveLength(0);
  });

  it('depth 2 draws as many internal nodes as the fixture tree, after the sub-branch search', () => {
    vi.useFakeTimers();
    try {
      const { el, player } = setup();
      player.goto(9);
      // the search replays first: the depth-1 tree and a scan line inside the right child
      expect(all(el, 'div.tree-col g.node.internal')).toHaveLength(1);
      expect(all(el, 'line.scan')).toHaveLength(1);
      vi.advanceTimersByTime(2000);
      const want = internalNodes(fixture.trees.gini['2'] as FxNode);
      expect(all(el, 'div.tree-col g.node.internal')).toHaveLength(want);
      expect(all(el, 'div.tree-col g.node.leaf')).toHaveLength(want + 1);
      expect(all(el, 'line.split')).toHaveLength(want - 1); // root split is line.chosen
      expect(all(el, 'line.scan')).toHaveLength(0);
      expect(all(el, 'path.curve-line')).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('the sub-branch scan line stays inside its child and the curve panel says so', () => {
    const { el, player } = setup();
    player.goto(9);
    const sub = childSweeps(toSamples(train), 'gini', DOMAIN)[0];
    player.setParam('subScan', 2);
    const line = el.querySelector('line.scan')!;
    const hit = el.querySelector('rect.hit')!;
    const [T, H] = [num(hit, 'y'), num(hit, 'height')];
    const yOf = (c: number): number => T + (H * (DOMAIN.y[1] - c)) / (DOMAIN.y[1] - DOMAIN.y[0]);
    if (sub.feature === 0) {
      expect(num(line, 'x1')).toBe(num(line, 'x2'));
      const ys = [num(line, 'y1'), num(line, 'y2')].sort((a, b) => a - b);
      expect(ys[0]).toBeCloseTo(yOf(sub.box.y[1]), 0);
      expect(ys[1]).toBeCloseTo(yOf(sub.box.y[0]), 0);
    }
    expect(vertices(el.querySelector('path.curve-line')!.getAttribute('d')!)).toBe(3);
    expect(el.querySelector('text.curve-title')!.textContent).toContain('alt dal');
  });

  it('test points appear only when showTest', () => {
    const { el, player } = setup();
    player.goto(9);
    expect(all(el, '.pt.test')).toHaveLength(0);
    player.goto(10);
    const pts = [...all(el, 'circle.pt.test'), ...all(el, 'path.pt.test')];
    expect(pts).toHaveLength(test.length);
    expect(pts.every((p) => p.getAttribute('fill') === 'none')).toBe(true);
    player.setParam('showTest', false);
    expect(all(el, '.pt.test')).toHaveLength(0);
  });

  it('rapid step changes during the scan end in the final state', () => {
    const { el, player } = setup();
    player.goto(7);
    player.goto(9);
    player.goto(6);
    expect(all(el, 'line.scan')).toHaveLength(0);
    expect(all(el, 'div.tree-col g.node')).toHaveLength(1);
    expect(all(el, 'div.tree-col g.node.leaf')).toHaveLength(1);
  });

  it('with real transitions, rapid changes still converge to the final state', async () => {
    const { el, player } = setup('ders', [1280, 541], 0.2);
    player.goto(7);
    await new Promise((r) => setTimeout(r, 30));
    player.goto(9);
    await new Promise((r) => setTimeout(r, 30));
    player.goto(6);
    await new Promise((r) => setTimeout(r, 600));
    expect(all(el, 'line.scan')).toHaveLength(0);
    expect(all(el, 'line.chosen')).toHaveLength(0);
    expect(all(el, 'div.tree-col g.node')).toHaveLength(1);
    expect(all(el, 'div.tree-col path.edge')).toHaveLength(0);
  });

  it('resize keeps tree text size', () => {
    const { el, player, scene } = setup();
    player.goto(9);
    const heights = () => all(el, 'g.node rect').map((r) => num(r, 'height'));
    const before = heights();
    scene.resize(900, 500);
    expect(heights()).toEqual(before);
    const svg = el.querySelector('div.tree-col svg')!;
    expect(svg.hasAttribute('viewBox')).toBe(false);
    for (const t of all(el, '.node text')) {
      expect(t.hasAttribute('font-size')).toBe(false);
      expect(t.getAttribute('transform') ?? '').not.toMatch(/scale/);
    }
    for (const g of all(el, 'g.node')) expect(g.getAttribute('transform')).not.toMatch(/scale/);
  });

  it('onPointer reports data coordinates and the line within 12 px', () => {
    const { el, player, scene } = setup('lab', [1000, 600]);
    player.goto(8); // the tree's root split: complaints ≤ 2,5 (horizontal)
    const got: [{ x: number; y: number }, string, 0 | 1 | null][] = [];
    scene.onPointer((at, kind, near) => got.push([at, kind, near]));
    const svg = el.querySelector('svg.plot')!;
    const hit = el.querySelector('rect.hit')!;
    const lineY = num(el.querySelector('line.chosen')!, 'y1');
    const x = num(hit, 'x') + num(hit, 'width') / 2;
    const Ev = (window.PointerEvent ?? MouseEvent) as typeof MouseEvent;
    svg.dispatchEvent(new Ev('pointerdown', { clientX: x, clientY: lineY + 5, bubbles: true }));
    svg.dispatchEvent(new Ev('pointermove', { clientX: x, clientY: lineY + 40, bubbles: true }));
    svg.dispatchEvent(new Ev('pointerup', { clientX: x, clientY: lineY + 40, bubbles: true }));
    svg.dispatchEvent(new Ev('pointerdown', { clientX: 1, clientY: 1, bubbles: true })); // outside the plot
    expect(got.map((g) => g[1])).toEqual(['down', 'move', 'up']);
    expect(got[0][2]).toBe(1);
    expect(got[1][2]).toBeNull();
    expect(got[0][0].y).toBeLessThan(2.5);
    expect(got[0][0].y).toBeGreaterThan(2);
    expect(got[0][0].x).toBeGreaterThan(0);
    expect(got[0][0].x).toBeLessThan(60);
  });
});

describe('lab threshold handles', () => {
  const S = toSamples(train);
  /** First point with the lowest impurity (the per-feature best threshold). */
  const best = (f: 0 | 1): number => sweep(S, f, 'gini')
    .reduce((m, q) => (q.impurity < m.impurity - 1e-12 ? q : m)).threshold;
  const Ev = (window.PointerEvent ?? MouseEvent) as typeof MouseEvent;

  it('both handles exist only in Lab at indices 6-8 and sit at the per-feature best thresholds', () => {
    const { el, player } = setup('lab', [1000, 600]);
    const handles = () => [all(el, 'line.handle.x').length, all(el, 'line.handle.y').length];
    player.goto(5);
    expect(handles()).toEqual([0, 0]);
    for (const i of [6, 8]) {
      player.goto(i);
      expect(handles(), `index ${i}`).toEqual([1, 1]);
      const hit = el.querySelector('rect.hit')!;
      const [L, T, W, H] = ['x', 'y', 'width', 'height'].map((a) => num(hit, a));
      const hx = el.querySelector('line.handle.x')!;
      const hy = el.querySelector('line.handle.y')!;
      expect(num(hx, 'x1')).toBe(num(hx, 'x2'));
      expect(num(hx, 'x1')).toBeCloseTo(L + (W * (best(0) - DOMAIN.x[0])) / (DOMAIN.x[1] - DOMAIN.x[0]), 0);
      expect(num(hy, 'y1')).toBe(num(hy, 'y2'));
      expect(num(hy, 'y1')).toBeCloseTo(T + (H * (DOMAIN.y[1] - best(1))) / (DOMAIN.y[1] - DOMAIN.y[0]), 0);
    }
    player.goto(7); // the scan line is moving: no handles
    expect(player.state.params.scan).toBeGreaterThanOrEqual(0);
    expect(handles()).toEqual([0, 0]);
    player.goto(9);
    expect(handles()).toEqual([0, 0]);

    // a user split moves the handle of its own feature only
    player.goto(6);
    player.setParams({ userSplit: { feature: 0, threshold: 30 }, scan: -1 });
    const x30 = num(el.querySelector('line.scan')!, 'x1');
    expect(num(el.querySelector('line.handle.x')!, 'x1')).toBe(x30);
    expect(all(el, 'line.handle.y')).toHaveLength(1);
  });

  it('once the step-8 scan is over, both handles are back in Lab and the scan line is gone', () => {
    vi.useFakeTimers();
    try {
      const { el, player } = setup('lab', [1000, 600]);
      const handles = () => [all(el, 'line.handle.x').length, all(el, 'line.handle.y').length];
      player.goto(7);
      expect(handles()).toEqual([0, 0]); // moving
      vi.advanceTimersByTime(70 * (SCAN_N + 2));
      expect(player.state.params.scan).toBe(SCAN_N - 1);
      expect(handles()).toEqual([1, 1]);
      expect(all(el, 'line.scan')).toHaveLength(0);
      // the contract handle can be grabbed now
      const hx = el.querySelector('line.handle.x')!;
      expect(num(hx, 'x1')).toBe(num(hx, 'x2'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('in Ders the finished scan line stays on the plot', () => {
    vi.useFakeTimers();
    try {
      const { el, player } = setup('ders');
      player.goto(7);
      vi.advanceTimersByTime(70 * (SCAN_N + 2));
      expect(all(el, 'line.scan')).toHaveLength(1);
      expect(all(el, 'line.handle')).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a user split shows its card and the tree\'s choice under the tree, live', () => {
    const { el, player } = setup('lab', [1000, 600]);
    player.goto(6);
    const col = el.querySelector('div.tree-col')!;
    const layer = () => col.querySelector<HTMLElement>('.cards-layer');
    expect(layer()?.hidden ?? true).toBe(true);
    player.setParams({ userSplit: { feature: 0, threshold: 20 }, scan: -1 });
    expect(layer()!.hidden).toBe(false);
    const titles = () => all(col, '.card h3.card-title').map((t) => t.textContent);
    expect(titles()).toEqual(['Senin eşiğin: Sözleşme ≤ 20', 'Ağacın seçimi: Şikâyet ≤ 2,5']);
    const score = () => col.querySelector('.card p.card-score')!.textContent;
    const before = score();
    player.setParams({ userSplit: { feature: 0, threshold: 12 } });
    expect(titles()[0]).toBe('Senin eşiğin: Sözleşme ≤ 12');
    expect(score()).not.toBe(before);
    // an empty branch reads "0 müşteri" in the tree as well
    const max = Math.max(...train.map((r) => r.t));
    player.setParams({ userSplit: { feature: 0, threshold: max } });
    const leaves = all(col, 'g.node.leaf').map((n) => n.textContent ?? '');
    expect(leaves.some((t) => t.includes('0 müşteri'))).toBe(true);
    expect(leaves.join('|')).not.toContain('NaN');
  });

  it('drag cards are built at step entry and reused on pointer down', () => {
    for (const i of [6, 7, 8]) {
      const { el, player } = setup('lab', [1000, 600]);
      player.goto(i);
      const nodes = (): Element[] => all(el, '.cards-layer .card, .cards-layer .branch, .cards-layer .card-score, .cards-layer .fill');
      const before = nodes();
      expect(before.length, `step ${i + 1}`).toBeGreaterThanOrEqual(2);
      if (i !== 8) expect(el.querySelector<HTMLElement>('.cards-layer')!.hidden).toBe(true);
      player.setParams({ userSplit: { feature: 0, threshold: 20 }, scan: -1 });
      const after = nodes();
      expect(el.querySelector<HTMLElement>('.cards-layer')!.hidden).toBe(false);
      expect(all(el, '.cards-layer .card h3.card-title').map((t) => t.textContent?.slice(0, 6))).toEqual(['Senin ', 'Ağacın']);
      expect(after).toHaveLength(before.length);
      after.forEach((n, k) => expect(n).toBe(before[k]));
    }
  });

  it('no handles in Ders', () => {
    const { el, player } = setup('ders');
    for (const i of [6, 7, 8]) {
      player.goto(i);
      expect(all(el, 'line.handle'), `index ${i}`).toHaveLength(0);
    }
  });

  it('near reports the feature of the handle under the pointer', () => {
    const { el, player, scene } = setup('lab', [1000, 600]);
    player.goto(6); // depth 0: only the handles can be grabbed
    const got: (0 | 1 | null)[] = [];
    scene.onPointer((_at, kind, near) => { if (kind === 'down') got.push(near); });
    const svg = el.querySelector('svg.plot')!;
    const hit = el.querySelector('rect.hit')!;
    const hx = num(el.querySelector('line.handle.x')!, 'x1');
    const hy = num(el.querySelector('line.handle.y')!, 'y1');
    const down = (x: number, y: number): void => {
      svg.dispatchEvent(new Ev('pointerdown', { clientX: x, clientY: y, bubbles: true }));
      svg.dispatchEvent(new Ev('pointerup', { clientX: x, clientY: y, bubbles: true }));
    };
    const midY = num(hit, 'y') + num(hit, 'height') * 0.9; // far from the complaint handle
    const midX = num(hit, 'x') + num(hit, 'width') * 0.8; // far from the contract handle
    down(hx + 8, midY);
    down(midX, hy - 8);
    down(midX, midY);
    expect(got).toEqual([0, 1, null]);

    // the active (dragged) line wins over a handle within reach
    player.setParams({ userSplit: { feature: 1, threshold: 2.6 }, scan: -1 });
    const uy = num(el.querySelector('line.scan')!, 'y1');
    down(hx + 4, uy);
    expect(got[3]).toBe(1);
  });
});

describe('regionFill', () => {
  // plot rect 600×300 px at (50, 20); 100 × 60 cells of 0,6 months × 0,1 complaints
  const sc = fitViewport({ x: [DOMAIN.x[0], DOMAIN.x[1]], y: [DOMAIN.y[0], DOMAIN.y[1]] },
    { left: 50, top: 20, width: 600, height: 300 }, false);
  const g = { cols: 100, rows: 60 };
  const S = toSamples(train);
  const fill = (depth: number): Uint8Array => {
    const out = new Uint8Array(g.cols * g.rows);
    regionFill(buildTree(S, depth, 'gini', DOMAIN), sc)(g, out);
    return out;
  };
  /** Cell whose centre is nearest to (t months, c complaints); row 0 is the top of the plot. */
  const cell = (t: number, c: number): number => {
    const col = Math.round(((t - DOMAIN.x[0]) / (DOMAIN.x[1] - DOMAIN.x[0])) * g.cols - 0.5);
    const row = Math.round(((DOMAIN.y[1] - c) / (DOMAIN.y[1] - DOMAIN.y[0])) * g.rows - 0.5);
    return row * g.cols + col;
  };

  it('depth 1 (complaints <= 2,5): top cells are ayrıldı, bottom cells kaldı', () => {
    const out = fill(1);
    expect([...out.subarray(0, g.cols)].every((v) => v === 1)).toBe(true); // top row, about 5,45 complaints
    expect([...out.subarray((g.rows - 1) * g.cols)].every((v) => v === 0)).toBe(true); // bottom row
    expect(out[cell(30, 3.5)]).toBe(1);
    expect(out[cell(30, 1.5)]).toBe(0);
  });

  it('depth 2 splits the high-complaint side along x at 11,5 months', () => {
    const out = fill(2);
    expect(out[cell(5, 3.5)]).toBe(1);
    expect(out[cell(11, 4.5)]).toBe(1);
    expect(out[cell(12, 4.5)]).toBe(0);
    expect(out[cell(30, 3.5)]).toBe(0);
    expect(out[cell(5, 1.5)]).toBe(0); // low complaints stay kaldı whatever the contract
    expect(out[0]).toBe(1); // top-left corner
    expect(out[g.cols - 1]).toBe(0); // top-right corner
  });

  it('treeKey changes with the tree structure only', () => {
    expect(treeKey(buildTree(S, 1, 'gini', DOMAIN))).toBe(treeKey(buildTree(S, 1, 'gini', DOMAIN)));
    expect(treeKey(buildTree(S, 2, 'gini', DOMAIN))).not.toBe(treeKey(buildTree(S, 1, 'gini', DOMAIN)));
    expect(treeKey(buildTree(S, Infinity, 'gini', DOMAIN))).not.toBe(treeKey(buildTree(S, 2, 'gini', DOMAIN)));
  });
});
