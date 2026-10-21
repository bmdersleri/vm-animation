// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import { StepPlayer } from '../../../src/core/player';
import { iqrAykiriScenario, type IqrParams } from '../../../src/concepts/iqr-aykiri/scenario';
import { mountIqrScene } from '../../../src/concepts/iqr-aykiri/scene';
import { LineLayer } from '../../../src/concepts/iqr-aykiri/scene-line';
import { deriveIqrView } from '../../../src/concepts/iqr-aykiri/view';

// jsdom has no DOMMatrix, which d3-transition needs to tween CSS transforms
class FakeMatrix {
  a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
  constructor(s = '') {
    const t = /translate\(\s*(-?[\d.]+)(?:px)?\s*,\s*(-?[\d.]+)/.exec(s);
    const m = /matrix\(([^)]+)\)/.exec(s);
    if (t) { this.e = Number(t[1]); this.f = Number(t[2]); }
    else if (m) [this.a, this.b, this.c, this.d, this.e, this.f] = m[1].split(',').map(Number);
  }
  get isIdentity(): boolean { return this.e === 0 && this.f === 0 && this.a === 1 && this.d === 1; }
}
(globalThis as { DOMMatrix?: unknown }).DOMMatrix ??= FakeMatrix;

const D = iqrAykiriScenario.defaults;
const view = (i: number, over: Partial<IqrParams> = {}) =>
  deriveIqrView(i, { ...D, ...iqrAykiriScenario.steps[i].params, ...over });
let cleanup: (() => void)[] = [];
afterEach(() => {
  for (const f of cleanup) f();
  cleanup = [];
  document.body.replaceChildren();
});

function setup(durationScale = 0, size: [number, number] = [1280, 540]) {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(iqrAykiriScenario);
  const scene = mountIqrScene(el, player, 'ders', { durationScale });
  scene.resize(...size);
  cleanup.push(() => { scene.destroy(); player.destroy(); });
  return { el, player };
}
function layer(w = 1100, h = 300) {
  const host = document.createElement('div');
  document.body.append(host);
  const l = new LineLayer(host, 1);
  l.resize(w, h, 'ders');
  cleanup.push(() => l.destroy());
  return { host, l };
}
const all = (el: Element, sel: string): HTMLElement[] => [...el.querySelectorAll<HTMLElement>(sel)];
const one = (el: Element, sel: string): HTMLElement => {
  const e = el.querySelector<HTMLElement>(sel);
  if (!e) throw new Error(`missing ${sel}`);
  return e;
};
const text = (el: Element | null): string => (el?.textContent ?? '').trim();
const num = (e: Element, a: string): number => Number(e.getAttribute(a));
const frame = (ms = 60) => new Promise((r) => setTimeout(r, ms));
/** x of the tick labelled `t` (ticks are translate(x,0)). */
function tickX(root: Element, t: string): number {
  const g = all(root, 'g.tick').find((k) => text(k.querySelector('text')) === t);
  if (!g) throw new Error(`no tick ${t}`);
  return Number(/translate\(([-\d.]+)/.exec(g.getAttribute('transform') ?? '')![1]);
}
const between = (root: Element, v: number): number => {
  const lo = Math.floor(v / 10) * 10;
  const a = tickX(root, String(lo));
  const b = tickX(root, String(lo + 10));
  return a + ((v - lo) / 10) * (b - a);
};

describe('iqr-aykiri LineLayer', () => {
  it('step 1: six dots, 200 beyond the break with its label', () => {
    const { host, l } = layer();
    l.update(view(0), 0);
    expect(all(host, 'circle.pt.normal')).toHaveLength(6);
    expect(all(host, '[data-far="1"]')).toHaveLength(1);
    expect(all(host, 'text.pt-label').map(text)).toEqual(['200,00']);
    expect(host.querySelector('g.break-mark line')).not.toBeNull();
    expect(text(one(host, '.axis-title'))).toBe('Aylık fatura (TL)');
    const ticks = all(host, 'g.tick text').map(text);
    expect(ticks[0]).toBe('0');
    expect(ticks[ticks.length - 1]).toBe('100');
    const far = one(host, '[data-far="1"]');
    expect(num(far, 'data-x')).toBeGreaterThan(tickX(host, '100'));
  });

  it('step 2: mean triangle starts at the axis start and ends at 68,77', () => {
    const { host, l } = layer();
    l.update(view(1), 900);
    const g = one(host, 'g.mark.mean');
    const start = Number(/translate\(([-\d.]+)px/.exec(g.style.transform)![1]);
    expect(start).toBeCloseTo(num(one(host, '.nl-axis'), 'x1'), 0);
    expect(g.querySelector('path.mean-tri')).not.toBeNull();
    expect(text(g.querySelector('text.mark-label'))).toBe('ortalama 68,77');
    l.update(view(1), 0);
    expect(Number(g.dataset.x)).toBeCloseTo(between(host, 68.7667), 0);
    expect(Number(/translate\(([-\d.]+)px/.exec(g.style.transform)![1])).toBeCloseTo(Number(g.dataset.x), 1);
  });

  it('step 3: median line at 43,65, mid dots highlighted', () => {
    const { host, l } = layer();
    l.update(view(2), 0);
    const g = one(host, 'g.mark.median');
    expect(g.querySelector('line')).not.toBeNull();
    expect(text(g.querySelector('text.mark-label'))).toBe('medyan 43,65');
    expect(Number(g.dataset.x)).toBeCloseTo(between(host, 43.65), 0);
    expect(all(host, 'circle.pt.mid')).toHaveLength(2);
  });

  it('step 4: two filled diamonds at 68,77, stacked', () => {
    const { host, l } = layer();
    l.update(view(3), 0);
    const f = all(host, 'path.pt.filled');
    expect(f).toHaveLength(2);
    expect(num(f[0], 'data-x')).toBeCloseTo(num(f[1], 'data-x'), 1);
    expect(num(f[0], 'data-x')).toBeCloseTo(between(host, 68.7667), 0);
    expect(num(f[0], 'data-y')).not.toBe(num(f[1], 'data-y'));
  });

  it('step 5: the same diamonds move to 43,65', () => {
    const { host, l } = layer();
    l.update(view(3), 0);
    const before = all(host, 'path.pt.filled');
    l.update(view(4), 0);
    const after = all(host, 'path.pt.filled');
    expect(after).toHaveLength(2);
    expect(after.every((n) => before.includes(n))).toBe(true);
    expect(num(after[0], 'data-x')).toBeCloseTo(between(host, 43.65), 0);
  });

  it('steps 7–8: Q1 line, then Q3 and the box', () => {
    const { host, l } = layer();
    l.update(view(6), 0);
    expect(host.querySelector('g.mark.q1')).not.toBeNull();
    expect(host.querySelector('g.mark.q3')).toBeNull();
    expect(host.querySelector('rect.box')).toBeNull();
    l.update(view(7), 0);
    expect(host.querySelector('g.mark.q3')).not.toBeNull();
    const box = one(host, 'rect.box');
    expect(num(box, 'x')).toBeCloseTo(between(host, 41.35), 0);
    expect(num(box, 'x') + num(box, 'width')).toBeCloseTo(between(host, 57.7625), 0);
  });

  it('step 9: arms, dashed fences, ▲ outlier, whiskers at 29,85 and 60,20', () => {
    const { host, l } = layer();
    l.update(view(8), 0);
    expect(all(host, 'line.arm')).toHaveLength(2);
    expect(all(host, 'text.arm-label').map(text)).toContain('1,5 · IQR = 24,62');
    const fences = all(host, 'line.fence');
    expect(fences).toHaveLength(2);
    expect(fences.every((f) => (f.getAttribute('stroke-dasharray') ?? '') !== '')).toBe(true);
    expect(all(host, 'path.pt.outlier')).toHaveLength(1);
    expect(all(host, 'text.pt-label').map(text)).toEqual(['480,00 · aykırı']);
    const w = all(host, 'line.whisker').map((e) => num(e, 'data-v')).sort((a, b) => a - b);
    expect(w[0]).toBeCloseTo(29.85, 6);
    expect(w[1]).toBeCloseTo(60.2, 6);
  });

  it('step 10: ±3σ band with clipped lower end and true-value labels; mean in the far zone', () => {
    const { host, l } = layer();
    l.update(view(9), 0);
    const band = one(host, 'rect.zband');
    expect(num(band, 'x')).toBeCloseTo(num(one(host, '.nl-axis'), 'x1'), 0);
    expect(all(host, 'text.zband-label').map(text).sort()).toEqual(['μ + 3σ = 531,70', 'μ − 3σ = −330,73'].sort());
    const slashes = all(host, 'line.break-slash');
    const farStart = Math.max(...slashes.map((s) => num(s, 'x1'))) + 3;
    expect(Number(one(host, 'g.mark.mean').dataset.x)).toBeGreaterThanOrEqual(farStart - 0.5);
  });

  it('step 11: clipped point moves into the linear zone at 82,38', () => {
    const { host, l } = layer();
    l.update(view(9), 0);
    const node = one(host, 'path.pt.outlier');
    l.update(view(10), 0);
    const after = one(host, 'path.pt.outlier');
    expect(after).toBe(node);
    expect(after.dataset.far).toBe('0');
    expect(num(after, 'data-x')).toBeCloseTo(between(host, 82.38125), 0);
    expect(all(host, 'text.pt-label').map(text)).toEqual(['82,38']);
  });

  it('lab slider across 100 animates the point into the linear zone', async () => {
    const { host, l } = layer();
    l.update(view(0, { extreme: 150 }), 0);
    const dot = one(host, '[data-far="1"]');
    l.update(view(0, { extreme: 90 }), 0);
    expect(one(host, `[data-key="${dot.dataset.key}"]`)).toBe(dot);
    expect(dot.dataset.far).toBe('0');
    expect(dot.dataset.cross).toBe('1');
    await frame(400);
    expect(host.querySelector('[data-cross]')).toBeNull();
    expect(dot.dataset.far).toBe('0');
  });

  it('sil: the deleted dot fades out', async () => {
    const { host, l } = layer();
    l.update(view(8, { action: 'yok' }), 0);
    expect(all(host, '.pt')).toHaveLength(8);
    l.update(view(8, { action: 'sil' }), 300);
    expect(all(host, '.pt.deleted')).toHaveLength(1);
    await frame(450);
    expect(all(host, '.pt')).toHaveLength(7);
    expect(host.querySelector('.pt.deleted')).toBeNull();
  });
});

describe('iqr-aykiri scene', () => {
  it('strip text equals view.strip', () => {
    const { el, player } = setup();
    for (let i = 0; i < iqrAykiriScenario.steps.length; i++) {
      player.goto(i);
      const v = deriveIqrView(i, player.state.params);
      const lines = all(el, 'p.formula .line');
      expect(lines.map((l) => text(l).replace(/\s+/g, ' '))).toEqual(v.strip.split('\n'));
      expect(one(el, '.iqr-scene').dataset.part).toBe(String(v.part));
    }
  });

  it('rapid step changes end in the final state', async () => {
    const { el, player } = setup(1);
    await frame(50);
    player.goto(2);
    player.goto(10);
    player.goto(4);
    await frame(80);
    expect(all(el, '.cell.filled')).toHaveLength(2);
    expect(all(el, '.cell.filled').map((c) => text(c.querySelector('.cell-value')))).toEqual(['43,65', '43,65']);
    expect(all(el, 'path.pt.filled')).toHaveLength(2);
    expect(el.querySelector('rect.box')).toBeNull();
    expect(el.querySelector('rect.zband')).toBeNull();
    expect(el.querySelector('[data-cross]')).toBeNull();
  });

  it('rapid change during the mean glide leaves one mean mark at the final spot', async () => {
    const { el, player } = setup(1);
    await frame(50);
    player.goto(1);
    await frame(40);
    player.goto(3);
    await frame(60);
    const means = all(el, 'g.mark.mean');
    expect(means).toHaveLength(1);
    expect(Number(/translate\(([-\d.]+)px/.exec(means[0].style.transform)![1])).toBeCloseTo(Number(means[0].dataset.x), 1);
    expect(el.querySelector('.leaving')).toBeNull();
    expect(el.querySelector('[data-cross]')).toBeNull();
    expect(el.querySelector('path.pt.outlier')).toBeNull();
  });

  it('rapid change from the outlier step leaves no ▲', async () => {
    const { el, player } = setup(1);
    await frame(50);
    player.goto(8);
    await frame(60);
    expect(el.querySelector('path.pt.outlier')).not.toBeNull();
    player.goto(4);
    await frame(80);
    // the old ▲ may still be fading out, but only as a leaving node
    expect(el.querySelector('path.pt.outlier:not(.leaving)')).toBeNull();
    await frame(450);
    expect(el.querySelector('path.pt.outlier')).toBeNull();
    expect(el.querySelector('.leaving')).toBeNull();
  });

  it('sil through the player fades the dot even as a live change', async () => {
    const { el, player } = setup(1);
    await frame(50);
    player.goto(10);
    await frame(400);
    const n = all(el, '.pt').length;
    player.setParams({ action: 'sil' });
    await frame(40);
    const dying = all(el, '.pt.deleted');
    expect(dying).toHaveLength(1);
    expect(all(el, '.pt')).toHaveLength(n);
    await frame(450);
    expect(all(el, '.pt')).toHaveLength(n - 1);
    expect(el.querySelector('.pt.deleted')).toBeNull();
  });

  it('labels never overlap', () => {
    const { el, player } = setup();
    for (let i = 0; i < iqrAykiriScenario.steps.length; i++) {
      player.goto(i);
      const rows = new Map<string, { l: number; r: number; t: string }[]>();
      for (const t of all(el, 'text.mark-label, text.pt-label, text.arm-label, text.zband-label')) {
        const cx = num(t, 'data-lx');
        const w = num(t, 'data-w');
        const k = t.getAttribute('data-ly')!;
        const arr = rows.get(k) ?? [];
        arr.push({ l: cx - w / 2, r: cx + w / 2, t: text(t) });
        rows.set(k, arr);
      }
      for (const arr of rows.values()) {
        arr.sort((a, b) => a.l - b.l);
        for (let j = 1; j < arr.length; j++) {
          expect(arr[j].l, `step ${i + 1}: ${arr[j - 1].t} vs ${arr[j].t}`).toBeGreaterThanOrEqual(arr[j - 1].r);
        }
      }
    }
  });

  it('no outlier: no ▲, no NaN in the DOM', () => {
    const { el, player } = setup();
    player.goto(8);
    player.setParams({ extreme: 75 });
    expect(el.querySelector('path.pt.outlier')).toBeNull();
    expect(el.textContent).not.toContain('NaN');
    for (const i of [5, 9, 10]) {
      player.goto(i);
      expect(el.innerHTML).not.toContain('NaN');
    }
  });

  it('render is measured', () => {
    const { player } = setup();
    const n = performance.getEntriesByName('iqr-render').length;
    player.goto(3);
    expect(performance.getEntriesByName('iqr-render').length).toBe(n + 1);
  });

  it('label classes take their size from the theme tokens', () => {
    const css = fs.readFileSync('src/concepts/iqr-aykiri/iqr-aykiri.css', 'utf8');
    for (const c of ['mark-label', 'pt-label', 'arm-label', 'zband-label']) {
      expect(css).toMatch(new RegExp(`\\.${c}[^{]*\\{[^}]*var\\(--fs-(tick|body)\\)`));
    }
  });
});
