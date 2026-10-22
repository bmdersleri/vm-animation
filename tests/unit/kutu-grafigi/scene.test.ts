// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { kutuScenario, type KutuParams } from '../../../src/concepts/kutu-grafigi/scenario';
import { mountKutuScene } from '../../../src/concepts/kutu-grafigi/scene';
import { deriveKutuView } from '../../../src/concepts/kutu-grafigi/view';
import type { Mode } from '../../../src/core/mode';

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

let cleanup: (() => void)[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const f of cleanup) f();
  cleanup = [];
  document.body.replaceChildren();
});

function setup(durationScale = 0, size: [number, number] = [1280, 540], mode: Mode = 'ders') {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer<KutuParams>(kutuScenario);
  const scene = mountKutuScene(el, player, mode, { durationScale });
  scene.resize(...size);
  cleanup.push(() => { scene.destroy(); player.destroy(); });
  return { el, player, scene };
}

const all = (el: Element, sel: string): SVGElement[] => [...el.querySelectorAll<SVGElement>(sel)];
const one = (el: Element, sel: string): SVGElement => {
  const e = el.querySelector<SVGElement>(sel);
  if (!e) throw new Error(`missing ${sel}`);
  return e;
};
const text = (e: Element | null): string => (e?.textContent ?? '').trim();
const opacity = (e: Element): string => e.getAttribute('opacity') ?? '';
const Ev = (): typeof MouseEvent => (window.PointerEvent ?? MouseEvent) as typeof MouseEvent;
const fire = (target: Element, kind: string, x: number): void => {
  const C = Ev();
  target.dispatchEvent(new C(kind, { clientX: x, clientY: 60, bubbles: true }));
};

/** The axis ticks as (value, x) pairs, read from the number line's own transforms. */
function ticks(el: Element): { v: number; x: number }[] {
  return all(el, 'svg.kutu-plot g.tick')
    .map((g) => {
      const m = /translate\(\s*(-?[\d.]+)/.exec(g.getAttribute('transform') ?? '');
      const v = Number(text(g.querySelector('text')).replace('−', '-').replace(',', '.'));
      return { v, x: m ? Number(m[1]) : NaN };
    })
    .filter((t) => Number.isFinite(t.v) && Number.isFinite(t.x))
    .sort((a, b) => a.v - b.v);
}

/** Data value → plot x, through the same two ticks the number line draws. */
function xOf(el: Element, value: number): number {
  const t = ticks(el);
  const a = t[0];
  const b = t[t.length - 1];
  return a.x + ((value - a.v) * (b.x - a.x)) / (b.v - a.v);
}

/** Plot x → data value (inverse of `xOf`). */
function valueAt(el: Element, x: number): number {
  const t = ticks(el);
  const a = t[0];
  const b = t[t.length - 1];
  return a.v + ((x - a.x) * (b.v - a.v)) / (b.x - a.x);
}
const attrValue = (el: Element, sel: string, attr = 'x1'): number =>
  valueAt(el, Number(one(el, sel).getAttribute(attr)));

describe('kutu scene', () => {
  it('mounts .kutu-scene, svg.kutu-plot, one dot per observation and the formula strip', () => {
    const { el, player } = setup();
    expect(el.querySelector('.kutu-scene')).not.toBeNull();
    one(el, '.kutu-scene svg.kutu-plot');
    expect(all(el, 'circle.dot')).toHaveLength(10);
    one(el, 'p.formula');
    for (let i = 0; i < kutuScenario.steps.length; i++) {
      player.goto(i);
      const v = deriveKutuView(i, player.state.params);
      expect(text(one(el, 'p.formula')), `adım ${i + 1}`).toBe(v.strip);
    }
  });

  it('keeps two rect.box in the DOM before step 4, hidden, and shows them on step 4', () => {
    const { el, player } = setup();
    expect(all(el, 'rect.box')).toHaveLength(2);
    for (const b of all(el, 'rect.box')) expect(opacity(b)).toBe('0');
    player.goto(3);
    const boxes = all(el, 'rect.box');
    expect(boxes).toHaveLength(2);
    for (const b of boxes) expect(opacity(b)).toBe('1');
    const bil = one(el, 'rect.box[data-group=bilgisayar]');
    expect(attrValue(el, 'rect.box[data-group=bilgisayar]', 'x')).toBeCloseTo(74, 1);
    expect(valueAt(el, Number(bil.getAttribute('x')) + Number(bil.getAttribute('width')))).toBeCloseTo(82, 1);
  });

  it('step 5: four dashed fences and the whiskers end on 70/82 and 68/80', () => {
    const { el, player } = setup();
    player.goto(4);
    const fences = all(el, 'line.fence:not(.alt)');
    expect(fences).toHaveLength(4);
    for (const f of fences) expect(f.getAttribute('x1')).toBe(f.getAttribute('x2'));
    expect(attrValue(el, 'line.fence[data-group=bilgisayar][data-side=lo]')).toBeCloseTo(62, 1);
    expect(attrValue(el, 'line.fence[data-group=bilgisayar][data-side=hi]')).toBeCloseTo(94, 1);
    expect(attrValue(el, 'line.fence[data-group=elektrik][data-side=lo]')).toBeCloseTo(56, 1);
    expect(attrValue(el, 'line.fence[data-group=elektrik][data-side=hi]')).toBeCloseTo(88, 1);
    // matplotlib rule: the whisker ends on the outermost observation inside the fence
    const end = (g: string, side: string): number =>
      attrValue(el, `line.whisker[data-group=${g}][data-side=${side}]`, 'x2');
    expect(end('bilgisayar', 'lo')).toBeCloseTo(70, 1);
    expect(end('bilgisayar', 'hi')).toBeCloseTo(82, 1);
    expect(end('elektrik', 'lo')).toBeCloseTo(68, 1);
    expect(end('elektrik', 'hi')).toBeCloseTo(80, 1);
  });

  it('step 6: one hollow diamond per outlier, 98 and 55', () => {
    const { el, player } = setup();
    player.goto(5);
    const out = all(el, 'path.outlier[data-group]');
    expect(out).toHaveLength(2);
    expect(out.map((p) => p.getAttribute('data-value')).sort()).toEqual(['55', '98']);
    expect(Number(one(el, 'path.outlier[data-group=bilgisayar]').getAttribute('data-value'))).toBe(98);
    expect(Number(one(el, 'path.outlier[data-group=elektrik]').getAttribute('data-value'))).toBe(55);
    // the diamond sits on the observation, not on the fence
    expect(valueAt(el, Number(one(el, 'path.outlier[data-group=elektrik]').getAttribute('data-x')))).toBeCloseTo(55, 1);
  });

  it('step 7: three groups, three boxes and no machine outlier', () => {
    const { el, player } = setup();
    player.goto(6);
    const boxes = all(el, 'rect.box');
    expect(boxes).toHaveLength(3);
    for (const b of boxes) expect(opacity(b)).toBe('1');
    expect(el.querySelectorAll('path.outlier[data-group=makine]')).toHaveLength(0);
    expect(all(el, 'circle.dot')).toHaveLength(15);
  });

  it('the sixth student removes the Elektrik outlier but keeps the Bilgisayar one', () => {
    const { el, player } = setup();
    player.goto(5);
    player.setParam('sixth', true);
    expect(el.querySelector('path.outlier[data-group=elektrik]')).toBeNull();
    expect(all(el, 'path.outlier[data-group=bilgisayar]')).toHaveLength(1);
    expect(Number(one(el, 'path.outlier[data-group=bilgisayar]').getAttribute('data-value'))).toBe(98);
  });

  it('dots: false hides the circles but keeps the outlier diamonds', () => {
    const { el, player } = setup();
    player.goto(5);
    player.setParam('dots', false);
    for (const d of all(el, 'circle.dot')) expect(opacity(d)).toBe('0');
    expect(all(el, 'path.outlier[data-group]')).toHaveLength(2);
  });

  it('step 8: a violin per group, the k = 3 fences as a dashed comparison, and the weak-density strip', () => {
    const { el, player } = setup();
    player.goto(7);
    expect(all(el, 'path.violin')).toHaveLength(3);
    expect(text(one(el, 'p.formula'))).toContain('n = 5');
    expect(text(one(el, 'p.formula'))).toContain('yoğunluk tahmini zayıf');
    // the active fence stays on k = 1,5; the secondary pair is the other k
    expect(attrValue(el, 'line.fence[data-group=bilgisayar][data-side=lo]')).toBeCloseTo(62, 1);
    const alt = all(el, 'line.fence.alt');
    expect(alt).toHaveLength(6);
    expect(attrValue(el, 'line.fence.alt[data-group=bilgisayar][data-side=lo]')).toBeCloseTo(50, 1);
    // k = 3 puts the upper fence at 106, past the 100 mark: it clips to the axis edge
    expect(attrValue(el, 'line.fence.alt[data-group=bilgisayar][data-side=hi]')).toBeCloseTo(100, 1);
    expect(all(el, 'text.fence-alt-label').map(text)).toEqual(['k = 3,0', 'k = 3,0', 'k = 3,0']);
    // the violin only belongs to this step
    player.goto(6);
    expect(all(el, 'path.violin')).toHaveLength(0);
    expect(all(el, 'line.fence.alt')).toHaveLength(0);
  });

  it('lab, step 6: dragging the Elektrik extreme to 90 updates data-drag, fences and whiskers without touching the params', () => {
    const { el, player } = setup(0, [1280, 540], 'lab');
    player.goto(5);
    const handle = one(el, 'circle.drag-handle[data-group=elektrik]');
    fire(handle, 'pointerdown', xOf(el, 55));
    fire(handle, 'pointermove', xOf(el, 90));
    fire(handle, 'pointerup', xOf(el, 90));
    const published = JSON.parse(one(el, 'svg.kutu-plot').getAttribute('data-drag') ?? '{}') as Record<string, number>;
    expect(published).toEqual({ bilgisayar: 98, elektrik: 90 });
    expect(attrValue(el, 'line.fence[data-group=elektrik][data-side=hi]')).toBeCloseTo(92, 1);
    expect(attrValue(el, 'line.whisker[data-group=elektrik][data-side=hi]', 'x2')).toBeCloseTo(90, 1);
    // scene-local state: the drag never becomes a KutuParams key
    expect(player.state.params).toEqual({ k: 1.5, sixth: false, third: false, dots: true });
    // a step change resets the drag
    player.goto(6);
    expect(attrValue(el, 'line.fence[data-group=elektrik][data-side=hi]')).toBeCloseTo(88, 1);
    const reset = JSON.parse(one(el, 'svg.kutu-plot').getAttribute('data-drag') ?? '{}') as Record<string, number>;
    expect(reset).toEqual({ bilgisayar: 98, elektrik: 55 });
  });

  it('the drag handle exists only in Lab from step 6 on', () => {
    const ders = setup();
    ders.player.goto(5);
    expect(ders.el.querySelector('circle.drag-handle')).toBeNull();
    expect(one(ders.el, 'svg.kutu-plot').hasAttribute('data-drag')).toBe(false);
    const lab = setup(0, [1280, 540], 'lab');
    lab.player.goto(4);
    expect(lab.el.querySelector('circle.drag-handle')).toBeNull();
    lab.player.goto(5);
    expect(all(lab.el, 'circle.drag-handle[data-group]')).toHaveLength(2);
    expect(one(lab.el, 'circle.drag-handle[data-group=bilgisayar]').getAttribute('aria-valuemax')).toBe('100');
    expect(one(lab.el, 'circle.drag-handle[data-group=elektrik]').getAttribute('aria-valuemin')).toBe('40');
  });

  it('destroy() empties the host', () => {
    const { el, scene } = setup();
    scene.destroy();
    expect(el.children.length).toBe(0);
  });
});
