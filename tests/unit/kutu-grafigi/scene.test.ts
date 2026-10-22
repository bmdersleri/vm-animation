// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { kutuScenario, type KutuParams } from '../../../src/concepts/kutu-grafigi/scenario';
import { mountKutuScene } from '../../../src/concepts/kutu-grafigi/scene';
import { deriveKutuView } from '../../../src/concepts/kutu-grafigi/view';
import { bindKeys } from '../../../src/core/keyboard';
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

  it('step 6: the outlier is an orange hollow diamond with no filled dot under it', () => {
    const { el, player } = setup();
    player.goto(5);
    for (const d of all(el, 'path.outlier[data-group]')) expect(d.style.stroke).toBe('var(--orange)');
    const dot = (g: string, v: number): SVGElement => one(el, `circle.dot[data-group=${g}][data-value="${v}"]`);
    expect(opacity(dot('bilgisayar', 98))).toBe('0');
    expect(opacity(dot('elektrik', 55))).toBe('0');
    expect(opacity(dot('bilgisayar', 82))).toBe('1');
    // before step 6 the same observation is an ordinary dot
    player.goto(4);
    expect(opacity(dot('bilgisayar', 98))).toBe('1');
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
    expect(all(el, 'text.fence-alt-label').map(text)).toEqual(['k = 3,0', 'k = 3,0', 'k = 3,0']);
    // the violin only belongs to this step
    player.goto(6);
    expect(all(el, 'path.violin')).toHaveLength(0);
    expect(all(el, 'line.fence.alt')).toHaveLength(0);
  });

  it('step 8 links to the iqr-aykiri page inside the scene', () => {
    const { el, player } = setup();
    player.goto(7);
    const links = all(el, 'a.kutu-link');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('../iqr-aykiri/');
    expect(text(links[0])).toContain('IQR');
    player.goto(6);
    expect(all(el, 'a.kutu-link')).toHaveLength(0);
  });

  it('a fence outside the 40–100 axis gets a caret and its own value', () => {
    const { el, player } = setup();
    player.goto(4);
    player.setParam('k', 3);
    // Bilgisayar hi = 106 leaves the axis; Elektrik hi = 100 sits exactly on it
    const active = all(el, 'path.fence-clip:not(.alt)');
    expect(active).toHaveLength(1);
    expect(active[0].getAttribute('data-side')).toBe('hi');
    expect(active[0].getAttribute('data-group')).toBe('bilgisayar');
    expect(active[0].getAttribute('data-value')).toBe('106');
    expect(all(el, 'text.fence-clip-label:not(.alt)').map(text)).toEqual(['106']);
    expect(el.querySelector('path.fence-clip[data-group=elektrik]')).toBeNull();
    // the caret sits on the right edge, not on a made-up 100 fence
    expect(Number(active[0].getAttribute('d')?.match(/^M([\d.]+)/)?.[1]))
      .toBeCloseTo(Number(one(el, 'line.fence[data-group=elektrik][data-side=hi]').getAttribute('x1')), 0);

    player.goto(7);
    const altClips = all(el, 'path.fence-clip.alt');
    const makine = altClips.filter((p) => p.getAttribute('data-group') === 'makine');
    expect(makine.map((p) => p.getAttribute('data-value')).sort()).toEqual(['114', '30']);
    expect(all(el, 'text.fence-clip-label.alt[data-group=makine]').map(text).sort()).toEqual(['114', '30']);
  });

  it('lab, step 6: the strip follows the drag and a step change restores the view strip', () => {
    const { el, player } = setup(0, [1280, 540], 'lab');
    player.goto(5);
    expect(text(one(el, 'p.formula'))).toContain('55 < 56');
    const handle = one(el, 'circle.drag-handle[data-group=elektrik]');
    fire(handle, 'pointerdown', xOf(el, 55));
    fire(handle, 'pointermove', xOf(el, 90));
    fire(handle, 'pointerup', xOf(el, 90));
    const drawn = attrValue(el, 'line.fence[data-group=elektrik][data-side=hi]');
    expect(drawn).toBeCloseTo(92, 1);
    const stripText = text(one(el, 'p.formula'));
    // the old 55 < 56 verdict is gone; only the Bilgisayar 98 > 94 remains
    expect(stripText).not.toContain('55 < 56');
    expect(stripText).toContain('98 > 94');
    player.goto(6);
    expect(text(one(el, 'p.formula'))).toBe(deriveKutuView(6, player.state.params).strip);
  });

  it('lab, step 1: the handles are live on every Lab step and the arrow keys move them', () => {
    const { el, player } = setup(0, [1280, 540], 'lab');
    player.goto(0);
    const handle = one(el, 'circle.drag-handle[data-group=elektrik]');
    expect(all(el, 'circle.drag-handle[data-group]')).toHaveLength(2);
    expect(handle.getAttribute('tabindex')).toBe('0');
    const press = (key: string, shift = false): void => {
      handle.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey: shift, bubbles: true }));
    };
    const live = (): number => {
      const o = JSON.parse(one(el, 'svg.kutu-plot').getAttribute('data-drag') ?? '{}') as Record<string, number>;
      return o.elektrik;
    };
    press('ArrowRight');
    expect(live()).toBe(56);
    for (let i = 0; i < 3; i++) press('ArrowRight');
    expect(live()).toBe(59);
    press('ArrowRight', true);
    expect(live()).toBe(64);
    press('ArrowLeft', true);
    expect(live()).toBe(59);
    // the same clamp as a pointer drag: never past the group's 90 limit
    for (let i = 0; i < 8; i++) press('ArrowRight', true);
    expect(live()).toBe(90);
    expect(player.state.params).toEqual({ k: 1.5, sixth: false, third: false, dots: true });
  });

  it('lab, step 3: an arrow key on a focused handle moves the handle, not the step', () => {
    const { el, player } = setup(0, [1280, 540], 'lab');
    const unbind = bindKeys(window, player, { toggleFullscreen() {}, toggleHelp() {} }, []);
    cleanup.push(unbind);
    player.goto(2);
    const handle = one(el, 'circle.drag-handle[data-group=bilgisayar]');
    const before = one(el, 'svg.kutu-plot').getAttribute('data-drag');
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    expect(player.state.index).toBe(2);
    const after = one(el, 'svg.kutu-plot').getAttribute('data-drag');
    expect(after).not.toBe(before);
    expect((JSON.parse(after ?? '{}') as Record<string, number>).bilgisayar).toBe(97);
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

  it('the drag handles are live on every Lab step and only from step 6 in Ders', () => {
    const ders = setup();
    ders.player.goto(4);
    expect(ders.el.querySelector('circle.drag-handle')).toBeNull();
    expect(one(ders.el, 'svg.kutu-plot').hasAttribute('data-drag')).toBe(false);
    ders.player.goto(5);
    expect(all(ders.el, 'circle.drag-handle[data-group]')).toHaveLength(2);
    const lab = setup(0, [1280, 540], 'lab');
    lab.player.goto(0);
    expect(all(lab.el, 'circle.drag-handle[data-group]')).toHaveLength(2);
    lab.player.goto(3);
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
