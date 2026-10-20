// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { StepPlayer } from '../../src/core/player';
import { knnScenario, type KnnParams } from '../../src/concepts/knn/scenario';
import { mountKnnScene } from '../../src/concepts/knn/scene';
import { deriveKnnView } from '../../src/concepts/knn/view';
import { customers, type RawPoint } from '../../src/concepts/knn/data';

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

function setup(patch?: Partial<KnnParams>): { el: HTMLElement; player: StepPlayer<KnnParams>; scene: Handle } {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(knnScenario);
  if (patch) player.setParams(patch);
  const scene = mountKnnScene(el, player, 'lab', { durationScale: 0 });
  scene.resize(1000, 600);
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
});
