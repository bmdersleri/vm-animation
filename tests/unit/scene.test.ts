// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { StepPlayer } from '../../src/core/player';
import { knnScenario, type KnnParams } from '../../src/concepts/knn/scenario';
import { mountKnnScene } from '../../src/concepts/knn/scene';
import { deriveKnnView } from '../../src/concepts/knn/view';
import { customers, type RawPoint } from '../../src/concepts/knn/data';
import { featureSpace } from '../../src/concepts/knn/space';
import { RegionsLayer, REGION_ALPHA } from '../../src/concepts/knn/scene-regions';

type Handle = ReturnType<typeof mountKnnScene>;
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
  patch?: Partial<KnnParams>, mode: 'lab' | 'ders' = 'lab', size: [number, number] = [1000, 600],
): { el: HTMLElement; player: StepPlayer<KnnParams>; scene: Handle } {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(knnScenario);
  if (patch) player.setParams(patch);
  const scene = mountKnnScene(el, player, mode, { durationScale: 0 });
  scene.resize(...size);
  cleanup.push(() => { scene.destroy(); player.destroy(); });
  return { el, player, scene };
}

const all = (el: Element, sel: string) => [...el.querySelectorAll(sel)];

describe('mountKnnScene', () => {
  it('layers: canvas.regions under svg.plot without viewBox', () => {
    const { el } = setup();
    const [canvas, svg] = [...el.children];
    expect(canvas.tagName.toLowerCase()).toBe('canvas');
    expect(canvas.classList.contains('regions')).toBe(true);
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg.classList.contains('plot')).toBe(true);
    expect(svg.hasAttribute('viewBox')).toBe(false);
    expect(svg.getAttribute('width')).toBe('1000');
    expect(svg.getAttribute('height')).toBe('600');
  });

  it('48 points, 36 circles + 12 triangles', () => {
    const { el } = setup();
    const churned = customers.filter((c) => c.churn === 1).length;
    expect(all(el, '.pt')).toHaveLength(48);
    expect(all(el, 'circle.pt.kaldi')).toHaveLength(48 - churned);
    expect(all(el, 'path.pt.ayrildi')).toHaveLength(churned);
    expect(all(el, 'circle.pt.kaldi')).toHaveLength(36);
    expect(all(el, 'path.pt.ayrildi')).toHaveLength(12);
  });

  it('phase 2 draws 48 lines, phase 3 draws k lines and k rank badges', () => {
    const { el, player } = setup();
    expect(all(el, 'line.dist')).toHaveLength(0);
    expect(el.querySelector('rect.query')).toBeNull();
    player.goto(1);
    expect(el.querySelector('rect.query')).not.toBeNull();
    player.goto(2);
    expect(all(el, 'line.dist')).toHaveLength(48);
    expect(all(el, 'g.rank')).toHaveLength(0);
    player.goto(3);
    const k = player.state.params.k;
    expect(all(el, 'line.dist')).toHaveLength(k);
    expect(all(el, 'g.rank')).toHaveLength(k);
    expect(all(el, 'g.rank').map((g) => g.textContent)).toEqual(['1', '2', '3', '4', '5']);
    player.setParam('k', 7);
    expect(all(el, 'line.dist')).toHaveLength(7);
    expect(all(el, 'g.rank')).toHaveLength(7);
  });

  it('phase 3 dims non-neighbours and outlines neighbours', () => {
    const { el, player } = setup();
    player.goto(3);
    const v = deriveKnnView(3, player.state.params);
    const nb = new Set(v.neighbors.map((n) => n.index));
    const pts = all(el, '.pt') as SVGElement[];
    for (const p of pts) {
      const i = Number(p.getAttribute('data-i'));
      if (nb.has(i)) {
        expect(p.getAttribute('opacity')).toBe('1');
        expect(p.getAttribute('stroke-width')).toBe('2.5');
      } else {
        expect(p.getAttribute('opacity')).toBe('0.35');
      }
    }
  });

  it('boundary is circle for oklid and 4-vertex path for manhattan', () => {
    const { el, player } = setup();
    player.goto(2);
    expect(el.querySelector('path.boundary')).toBeNull();
    player.goto(3);
    const d1 = el.querySelector('path.boundary')!.getAttribute('d')!;
    expect(d1.match(/A/g)).toHaveLength(2);
    player.setParam('metric', 'manhattan');
    const d2 = el.querySelector('path.boundary')!.getAttribute('d')!;
    expect(d2).not.toMatch(/A/);
    expect(d2.match(/[ML]/g)).toHaveLength(4);
    expect(d2.trim().endsWith('Z')).toBe(true);
  });

  it('prediction text at step 4 matches view.prediction', () => {
    const { el, player } = setup();
    player.goto(3);
    expect(el.querySelector('g.vote')).toBeNull();
    player.goto(4);
    const v = deriveKnnView(4, player.state.params);
    const pred = el.querySelector('.prediction')!;
    expect(pred.textContent).toBe(`Tahmin: ${v.prediction!.label} (${v.prediction!.detail})`);
    expect(el.querySelector('g.vote .vote-label.kaldi')!.textContent).toBe(`● Kaldı: ${v.vote!.scores[0]}`);
    expect(el.querySelector('g.vote .vote-label.ayrildi')!.textContent).toBe(`▲ Ayrıldı: ${v.vote!.scores[1]}`);
    expect(all(el, 'g.vote rect.seg')).toHaveLength(2);
    // the query takes the winning class colour
    const fill = el.querySelector('rect.query')!.getAttribute('fill')!.toLowerCase();
    expect(fill).toBe(v.prediction!.cls === 1 ? '#f08a00' : '#0ea5a4');
  });

  it('weighted vote labels show scores with 2 decimals', () => {
    const { el, player } = setup({ weighting: 'agirlikli' });
    player.goto(4);
    const v = deriveKnnView(4, player.state.params);
    const two = (n: number) => n.toFixed(2).replace('.', ',');
    expect(el.querySelector('.vote-label.kaldi')!.textContent).toBe(`● Kaldı: ${two(v.vote!.scores[0])}`);
    expect(el.querySelector('.vote-label.ayrildi')!.textContent).toBe(`▲ Ayrıldı: ${two(v.vote!.scores[1])}`);
    expect(el.querySelector('.prediction')!.textContent).toBe(`Tahmin: ${v.prediction!.label} (${v.prediction!.detail})`);
  });

  it('rapid step changes end in final state', () => {
    const { el, player } = setup();
    player.goto(2);
    player.goto(3);
    player.goto(4);
    player.goto(1);
    expect(all(el, 'line.dist')).toHaveLength(0);
    expect(all(el, 'g.rank')).toHaveLength(0);
    expect(el.querySelector('.prediction')).toBeNull();
    expect(el.querySelector('path.boundary')).toBeNull();
    expect(el.querySelector('rect.query')!.getAttribute('fill')!.toLowerCase()).toBe('#ffffff');
    expect(all(el, '.pt').every((p) => p.getAttribute('opacity') === '1')).toBe(true);
  });

  it('resize keeps text px size', () => {
    const { el, scene } = setup();
    scene.resize(1280, 600);
    scene.resize(800, 400);
    const svg = el.querySelector('svg')!;
    expect(svg.hasAttribute('viewBox')).toBe(false);
    expect(svg.getAttribute('width')).toBe('800');
    const titles = all(el, '.axis-title') as SVGElement[];
    expect(titles).toHaveLength(2);
    for (const t of titles) {
      expect(t.style.transform).not.toMatch(/scale/);
      expect(t.getAttribute('transform') ?? '').not.toMatch(/scale/);
    }
    expect(all(el, '.tick').length).toBeGreaterThan(3);
  });

  it('axis titles follow dataset and scaling', () => {
    const { el, player } = setup();
    const titles = () => all(el, '.axis-title').map((t) => t.textContent);
    expect(titles()).toEqual([
      'Sözleşme süresi (ay) — standartlaştırılmış (z)',
      'Aylık fatura (TL) — standartlaştırılmış (z)',
    ]);
    player.goto(11); // toplam, unscaled
    expect(titles()).toEqual(['Sözleşme süresi (ay)', 'Toplam fatura (TL)']);
  });

  it('boundary and lines are clipped to the plot rect', () => {
    const { el, player } = setup();
    player.goto(3);
    const g = el.querySelector('path.boundary')!.parentElement!;
    const ref = g.getAttribute('clip-path')!;
    const id = /url\(#(.+)\)/.exec(ref)![1];
    expect(el.querySelector(`clipPath#${id} rect`)).not.toBeNull();
    expect(el.querySelector('line.dist')!.closest('[clip-path]')).toBe(g);
  });

  it('onPointer reports raw points inside the plot', () => {
    const { el, player, scene } = setup();
    const got: [RawPoint, string][] = [];
    scene.onPointer((raw, kind) => got.push([raw, kind]));
    const svg = el.querySelector('svg')!;
    const hit = el.querySelector('rect.hit')!;
    const x = Number(hit.getAttribute('x')) + Number(hit.getAttribute('width')) / 2;
    const y = Number(hit.getAttribute('y')) + Number(hit.getAttribute('height')) / 2;
    const Ev = (window.PointerEvent ?? MouseEvent) as typeof MouseEvent;
    svg.dispatchEvent(new Ev('pointerdown', { clientX: x, clientY: y, bubbles: true }));
    svg.dispatchEvent(new Ev('pointermove', { clientX: x + 5, clientY: y, bubbles: true }));
    svg.dispatchEvent(new Ev('pointerup', { clientX: x + 5, clientY: y, bubbles: true }));
    svg.dispatchEvent(new Ev('pointerdown', { clientX: 1, clientY: 1, bubbles: true })); // outside the plot
    expect(got.map((g) => g[1])).toEqual(['down', 'move', 'up']);
    const s = deriveKnnView(0, player.state.params).space;
    const v = s.toSpace(got[0][0]);
    expect(v.x).toBeGreaterThan(s.domain.x[0]);
    expect(v.x).toBeLessThan(s.domain.x[1]);
    expect(v.y).toBeGreaterThan(s.domain.y[0]);
    expect(v.y).toBeLessThan(s.domain.y[1]);
    expect(s.toSpace(got[1][0]).x).toBeGreaterThan(v.x);
  });

  it('with real transitions, rapid changes still converge to the final state', async () => {
    const el = document.createElement('div');
    document.body.append(el);
    const player = new StepPlayer(knnScenario);
    const scene = mountKnnScene(el, player, 'lab', { durationScale: 0.2 });
    cleanup.push(() => { scene.destroy(); player.destroy(); });
    scene.resize(1000, 600);
    player.goto(2);
    await new Promise((r) => setTimeout(r, 40));
    player.goto(3);
    await new Promise((r) => setTimeout(r, 40));
    player.goto(4);
    await new Promise((r) => setTimeout(r, 40));
    player.goto(1);
    await new Promise((r) => setTimeout(r, 900));
    expect(all(el, 'line.dist')).toHaveLength(0);
    expect(all(el, 'g.rank')).toHaveLength(0);
    expect(el.querySelector('.prediction')).toBeNull();
    expect(el.querySelector('path.boundary')).toBeNull();
    expect(all(el, '.pt').every((p) => p.getAttribute('opacity') === '1')).toBe(true);
  });

  it('dragging the query (query-only param change) renders without transitions', async () => {
    const el = document.createElement('div');
    document.body.append(el);
    const player = new StepPlayer(knnScenario);
    const scene = mountKnnScene(el, player, 'lab', { durationScale: 1 });
    cleanup.push(() => { scene.destroy(); player.destroy(); });
    scene.resize(1000, 600);
    player.goto(4);
    await new Promise((r) => setTimeout(r, 60)); // step transition in flight
    const q = { tenure: 40, value: 60 };
    player.setParam('query', q);
    player.setParam('query', { tenure: 41, value: 61 }); // coalesced into one frame
    await new Promise((r) => setTimeout(r, 50));
    const v = deriveKnnView(4, player.state.params);
    const nb = v.neighbors.map((n) => String(n.index));
    const lines = all(el, 'line.dist');
    expect(lines.map((l) => (l as unknown as { __data__: { index: number } }).__data__.index).map(String).sort())
      .toEqual([...nb].sort());
    for (const l of lines) expect(l.getAttribute('opacity')).toBe('1');
    expect(el.querySelector('.prediction')!.textContent).toBe(`Tahmin: ${v.prediction!.label} (${v.prediction!.detail})`);
    // the query is already exactly where the current x scale puts it (no transition in flight);
    // derive that scale from two point marks
    const tx = (sel: string): number => Number(/translate\(([-\d.]+),/.exec(el.querySelector(sel)!.getAttribute('transform')!)![1]);
    const s = v.space;
    const [a, b] = [0, 1].map((i) => ({ px: tx(`.pt[data-i="${i}"]`), x: s.points[i].x }));
    const toPx = (x: number): number => a.px + ((x - a.x) * (b.px - a.px)) / (b.x - a.x);
    expect(tx('g.q')).toBeCloseTo(toPx(s.toSpace({ tenure: 41, value: 61 }).x), 0);
    player.setParam('query', { tenure: 70, value: 61 });
    await new Promise((r) => setTimeout(r, 50));
    expect(tx('g.q')).toBeCloseTo(toPx(s.toSpace({ tenure: 70, value: 61 }).x), 0);
  });

  it('regions redraw only when the region inputs change', () => {
    vi.restoreAllMocks();
    let draws = 0;
    const ctx = {
      imageSmoothingEnabled: true,
      setTransform: () => {}, clearRect: () => {}, putImageData: () => {},
      drawImage: () => { draws++; },
      createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    const measures = () => performance.getEntriesByName('regions').length;
    const m0 = measures();
    const { player } = setup();
    expect(draws).toBe(0); // regions off at step 0
    player.goto(5); // regions on
    expect(draws).toBe(1);
    expect(measures()).toBe(m0 + 1);
    player.setParam('query', { tenure: 30, value: 70 });
    player.goto(5);
    expect(draws).toBe(1);
    player.setParam('k', 3);
    expect(draws).toBe(2);
    player.setParam('regions', false);
    player.setParam('regions', true);
    expect(draws).toBe(3);
  });

  // ---------------------------------------------------------------- layout (final review fix 2)
  const num = (e: Element, a: string): number => Number(e.getAttribute(a));
  const hitRect = (el: Element) => {
    const r = el.querySelector('rect.hit')!;
    return { left: num(r, 'x'), top: num(r, 'y'), width: num(r, 'width'), height: num(r, 'height') };
  };
  const translate = (e: Element): [number, number] => {
    const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(e.getAttribute('transform')!)!;
    return [Number(m[1]), Number(m[2])];
  };
  // Ders stage at 1280×720 (top bar, title band and player bar taken off)
  const DERS: [number, number] = [1280, 540];

  it('ders, wide stage: scaled plot is sized to the data, vote and prediction sit beside it', () => {
    const { el, player, scene } = setup(undefined, 'ders', DERS);
    player.goto(4);
    const plot = hitRect(el);
    const d = featureSpace('aylik', true).domain;
    // the data fills the plot height and (equal px per unit) nearly its width
    expect(plot.width / plot.height).toBeCloseTo((d.x[1] - d.x[0]) / (d.y[1] - d.y[0]), 2);
    expect(plot.height).toBeGreaterThan(DERS[1] * 0.8);
    const vis = scene.visibleDomain()!;
    expect((vis.x[1] - vis.x[0]) / (d.x[1] - d.x[0])).toBeLessThan(1.02);
    expect((vis.y[1] - vis.y[0]) / (d.y[1] - d.y[0])).toBeLessThan(1.02);
    // equal px per unit: a circle stays a circle
    const sx = plot.width / (vis.x[1] - vis.x[0]);
    const sy = plot.height / (vis.y[1] - vis.y[0]);
    expect(sx).toBeCloseTo(sy, 6);
    // vote bar and prediction to the right of the plot, vertically inside it
    const right = plot.left + plot.width;
    const track = el.querySelector('g.vote rect.track')!;
    expect(num(track, 'x')).toBeGreaterThan(right + 20);
    expect(num(track, 'y')).toBeGreaterThan(plot.top);
    expect(num(track, 'y') + num(track, 'height')).toBeLessThan(plot.top + plot.height);
    const pred = el.querySelector('.prediction')!;
    expect(pred.getAttribute('text-anchor')).toBe('middle');
    expect(num(pred, 'x')).toBeGreaterThan(right);
    expect(num(pred, 'y')).toBeLessThan(plot.top + plot.height);
    expect(num(el.querySelector('.vote-label.kaldi')!, 'x')).toBeGreaterThan(right);
  });

  it('ders, wide stage: unscaled view keeps the scaled frame and fills it with independent axes', () => {
    const { el, player, scene } = setup(undefined, 'ders', DERS);
    player.goto(10); // toplam, scaled
    const a = hitRect(el);
    player.goto(11); // toplam, unscaled
    const b = hitRect(el);
    // same frame size (only the y tick labels' width moves it sideways)
    expect([b.top, b.width, b.height]).toEqual([a.top, a.width, a.height]);
    expect(scene.visibleDomain()).toEqual(featureSpace('toplam', false).domain);
    expect(num(el.querySelector('g.vote rect.track')!, 'x')).toBeGreaterThan(b.left + b.width);
  });

  it('lab and narrow stages keep the vote row under a full-width plot', () => {
    for (const [mode, size] of [['lab', [756, 585]], ['ders', [700, 540]]] as const) {
      const { el, player, scene } = setup(undefined, mode, [size[0], size[1]]);
      player.goto(4);
      const plot = hitRect(el);
      expect(plot.left + plot.width).toBeGreaterThan(size[0] - 40);
      const track = el.querySelector('g.vote rect.track')!;
      expect(num(track, 'y')).toBeGreaterThan(plot.top + plot.height);
      scene.destroy();
    }
  });

  it('query diamond: half-diagonal 1.6 point radii, 2.5 px stroke', () => {
    const { el, player } = setup(undefined, 'ders', DERS);
    player.goto(1);
    const q = el.querySelector('rect.query')!;
    const ptR = Number(el.querySelector('circle.pt')!.getAttribute('r'));
    const half = (num(q, 'width') * Math.SQRT2) / 2;
    expect(half).toBeCloseTo(1.6 * ptR, 0);
    expect(q.getAttribute('stroke-width')).toBe('2.5');
  });

  it('rank badges sit on the side of their point away from the query', () => {
    for (const step of [3, 7, 8, 9, 10]) {
      const { el, player, scene } = setup(undefined, 'ders', DERS);
      player.goto(step);
      const [qx, qy] = translate(el.querySelector('g.q')!);
      const ranks = all(el, 'g.rank');
      expect(ranks.length).toBe(player.state.params.k);
      const nbs = deriveKnnView(step, player.state.params).neighbors;
      for (const g of ranks) {
        const r = Number(g.textContent) - 1;
        const [px, py] = translate(el.querySelector(`.pt[data-i="${nbs[r].index}"]`)!);
        const [bx, by] = translate(g);
        expect(Math.hypot(bx - qx, by - qy)).toBeGreaterThan(Math.hypot(px - qx, py - qy));
        if (r === 0) {
          // the nearest badge clears the query diamond (half-diagonal 1.6 r)
          const badgeR = Number(g.querySelector('circle')!.getAttribute('r'));
          expect(Math.hypot(bx - qx, by - qy) - badgeR).toBeGreaterThan(1.6 * 9 - 2);
        }
      }
      scene.destroy();
    }
  });

  /** Badge offset (px) from its own point, keyed by point index. */
  const badgeOffsets = (el: Element): Map<number, [number, number]> => {
    const out = new Map<number, [number, number]>();
    for (const g of all(el, 'g.rank')) {
      const i = (g as unknown as { __data__: { i: number } }).__data__.i;
      const [px, py] = translate(el.querySelector(`.pt[data-i="${i}"]`)!);
      const [bx, by] = translate(g);
      out.set(i, [bx - px, by - py]);
    }
    return out;
  };

  it('rank badges stay on their points when the neighbour order swaps', () => {
    const { el, player } = setup({ k: 3 }, 'lab');
    player.goto(3);
    const q0 = { ...player.state.params.query };
    const nodes = new Map(all(el, 'g.rank').map((g) => [(g as unknown as { __data__: { i: number } }).__data__.i, g]));
    const order = (): number[] => deriveKnnView(3, player.state.params).neighbors.map((n) => n.index);
    const first = order();
    // sweep the query along a line until the neighbour order changes
    let swapped = false;
    for (let step = 1; step <= 200 && !swapped; step++) {
      player.setParam('query', { tenure: q0.tenure + step * 0.5, value: q0.value + step * 0.5 });
      swapped = order().join() !== first.join() && new Set(order()).size === new Set(first).size
        && order().every((i) => first.includes(i));
    }
    expect(swapped).toBe(true);
    // the same badge nodes sit on the same points, only their number changed
    for (const g of all(el, 'g.rank')) {
      const i = (g as unknown as { __data__: { i: number } }).__data__.i;
      if (nodes.has(i)) expect(g).toBe(nodes.get(i));
    }
    expect(all(el, 'g.rank').map((g) => Number(g.textContent)).sort()).toEqual([1, 2, 3]);
  });

  it('a 1 px query move keeps every badge offset', () => {
    const { el, player } = setup({ k: 5 }, 'lab');
    player.goto(3);
    const before = badgeOffsets(el);
    const tx = (): number => translate(el.querySelector('g.q')!)[0];
    const x0 = tx();
    const q = player.state.params.query;
    player.setParam('query', { tenure: q.tenure + 0.2, value: q.value });
    expect(Math.abs(tx() - x0)).toBeLessThan(3);
    const after = badgeOffsets(el);
    expect([...after.keys()].sort()).toEqual([...before.keys()].sort());
    for (const [i, [dx, dy]] of before) {
      expect(Math.abs(after.get(i)![0] - dx), `badge ${i}`).toBeLessThan(0.51);
      expect(Math.abs(after.get(i)![1] - dy), `badge ${i}`).toBeLessThan(0.51);
    }
  });

  it('visibleDomain is null before the first draw and covers the data domain after', () => {
    const el = document.createElement('div');
    document.body.append(el);
    const player = new StepPlayer(knnScenario);
    const scene = mountKnnScene(el, player, 'lab', { durationScale: 0 });
    cleanup.push(() => { scene.destroy(); player.destroy(); });
    expect(scene.visibleDomain()).toBeNull();
    scene.resize(1000, 600);
    const v = scene.visibleDomain()!;
    const d = featureSpace('aylik', true).domain;
    expect(v.x[0]).toBeLessThanOrEqual(d.x[0]);
    expect(v.x[1]).toBeGreaterThanOrEqual(d.x[1]);
    expect(v.y[0]).toBeLessThanOrEqual(d.y[0]);
    expect(v.y[1]).toBeGreaterThanOrEqual(d.y[1]);
  });
});

describe('RegionsLayer alpha', () => {
  it('ders tint is stronger; an alpha change repaints the cached grid without recomputing', () => {
    vi.restoreAllMocks();
    const calls = { draws: 0, alpha: [] as number[] };
    const ctx = {
      imageSmoothingEnabled: true,
      setTransform: () => {}, clearRect: () => {},
      putImageData: (img: ImageData) => { calls.alpha.push(img.data[3]); },
      drawImage: () => { calls.draws++; },
      createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    expect(REGION_ALPHA.ders).toBeGreaterThanOrEqual(0.2);
    expect(REGION_ALPHA.lab).toBe(0.12);
    const layer = new RegionsLayer(document.createElement('canvas'), REGION_ALPHA.lab);
    layer.resize(400, 300);
    const player = new StepPlayer(knnScenario);
    player.goto(5);
    const v = deriveKnnView(5, player.state.params);
    const plot = { left: 10, top: 10, width: 300, height: 200 };
    const scales = {
      x: { domain: () => v.space.domain.x }, y: { domain: () => v.space.domain.y },
    } as unknown as Parameters<RegionsLayer['update']>[1];
    const measures = () => performance.getEntriesByName('regions').length;
    const m0 = measures();
    layer.update(v, scales, plot);
    expect(calls.draws).toBe(1);
    expect(measures()).toBe(m0 + 1);
    expect(calls.alpha.at(-1)).toBe(Math.round(REGION_ALPHA.lab * 255));
    layer.update(v, scales, plot); // same inputs: nothing to do
    expect(calls.draws).toBe(1);
    layer.setAlpha(REGION_ALPHA.ders);
    layer.update(v, scales, plot); // repaint from the cached grid only
    expect(calls.draws).toBe(2);
    expect(measures()).toBe(m0 + 1);
    expect(calls.alpha.at(-1)).toBe(Math.round(REGION_ALPHA.ders * 255));
    layer.update(v, scales, plot);
    expect(calls.draws).toBe(2);
    player.destroy();
  });
});
