// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { dagilimScenario, type DagilimParams } from '../../../src/concepts/dagilim-carpiklik/scenario';
import { mountDagilimScene } from '../../../src/concepts/dagilim-carpiklik/scene';
import { HistLayer, MS_STEP } from '../../../src/concepts/dagilim-carpiklik/scene-hist';
import { mountDagilimParams } from '../../../src/concepts/dagilim-carpiklik/controls';
import { deriveDagilimView } from '../../../src/concepts/dagilim-carpiklik/view';
import { countSubpaths } from '../../../src/core/plot/dots-path';
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

const view = (i: number, over: Partial<DagilimParams> = {}) =>
  deriveDagilimView(i, { ...dagilimScenario.defaults, ...dagilimScenario.steps[i].params, ...over });
const frame = (ms = 60) => new Promise((r) => setTimeout(r, ms));

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
  const player = new StepPlayer(dagilimScenario);
  const scene = mountDagilimScene(el, player, mode, { durationScale });
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
const lines = (el: Element): string[] => all(el, 'p.formula span.line').map(text);
const labels = (el: Element): string[] => all(el, 'text.mark-label').map(text);
const tickNumbers = (el: Element): number[] =>
  all(el, 'svg.dag-plot g.tick text').map((t) => Number(text(t).replace('−', '-').replace(',', '.')));
const barPath = (el: Element): string => one(el, 'path.hist-bar').getAttribute('d') ?? '';
const Ev = (): typeof MouseEvent => (window.PointerEvent ?? MouseEvent) as typeof MouseEvent;
const fire = (target: Element, kind: string, x: number): void => {
  const C = Ev();
  target.dispatchEvent(new C(kind, { clientX: x, clientY: 60, bubbles: true }));
};
/** x of the tick whose label is `label`, read from the number line's own transform. */
const tickX = (el: Element, label: string): number => {
  const g = all(el, 'svg.dag-plot g.tick').find((t) => text(t.querySelector('text')) === label);
  if (!g) throw new Error(`missing tick ${label}`);
  const m = /translate\(\s*(-?[\d.]+)/.exec(g.getAttribute('transform') ?? '');
  return Number(m![1]);
};

describe('dagilim scene', () => {
  it('mounts .dag-scene with svg.dag-plot, one dots path and the formula strip', () => {
    const { el, player } = setup();
    expect(el.querySelector('.dag-scene')).not.toBeNull();
    one(el, '.dag-scene svg.dag-plot');
    expect(countSubpaths(one(el, 'svg.dag-plot path.dots').getAttribute('d') ?? '')).toBe(10);
    one(el, 'p.formula');
    // the strip text is the view's strip at every step
    for (let i = 0; i < dagilimScenario.steps.length; i++) {
      player.goto(i);
      const v = deriveDagilimView(i, player.state.params);
      expect(lines(el)).toEqual(v.strip.split('\n'));
    }
  });

  it('step 2: one path.hist-bar with five closed bars', () => {
    const { el, player } = setup();
    player.goto(1);
    expect(all(el, 'path.hist-bar')).toHaveLength(1);
    const d = barPath(el);
    expect(countSubpaths(d)).toBe(5);
    // every subpath is closed: one "Z" per bar
    expect((d.match(/Z/g) ?? []).length).toBe(5);
    expect(view(1).bins.map((b) => b.count)).toEqual([4, 2, 2, 1, 1]);
    // the tallest bar belongs to the first bin
    expect(all(el, 'text.bar-count').map(text)).toEqual(['4', '2', '2', '1', '1']);
  });

  it('keeps exactly one hist-bar while the bin count is swept', () => {
    const { el, player } = setup();
    player.goto(1);
    for (const b of [10, 3, 5] as const) {
      player.setParam('bins', b);
      expect(all(el, 'path.hist-bar')).toHaveLength(1);
      expect(countSubpaths(barPath(el))).toBe(b);
      expect(all(el, 'text.bar-count')).toHaveLength(b);
    }
  });

  it('step 5: three bins give three bars', () => {
    const { el, player } = setup();
    player.goto(4);
    expect(countSubpaths(barPath(el))).toBe(3);
  });

  it('step 3: the marks read 16,4 (mean) and 14,5 (median)', () => {
    const { el, player } = setup();
    player.goto(2);
    expect(labels(el)).toEqual(['16,4', '14,5']);
    one(el, 'line.mark-mean');
    one(el, 'line.mark-median');
    // mean sits right of the median
    expect(Number(one(el, 'line.mark-mean').getAttribute('x1')))
      .toBeGreaterThan(Number(one(el, 'line.mark-median').getAttribute('x1')));
  });

  it('step 1: the marks exist but are hidden', () => {
    const { el, player } = setup();
    player.goto(0);
    expect(labels(el)).toEqual(['16,4', '14,5']);
    for (const g of all(el, 'g.mark')) expect(g.getAttribute('opacity')).toBe('0');
    player.goto(2);
    for (const g of all(el, 'g.mark')) expect(g.getAttribute('opacity')).toBe('1');
  });

  it('step 4: a right tail shade and no left one', () => {
    const { el, player } = setup();
    player.goto(3);
    one(el, 'rect.tail-shade.right');
    expect(el.querySelector('rect.tail-shade.left')).toBeNull();
    // the shade starts at the median and runs to the right edge
    const shade = one(el, 'rect.tail-shade.right');
    expect(Number(shade.getAttribute('x'))).toBeCloseTo(Number(one(el, 'line.mark-median').getAttribute('x1')), 0);
    expect(Number(shade.getAttribute('width'))).toBeGreaterThan(0);
  });

  it('step 8 with the left-skewed series: a left tail shade', () => {
    const { el, player } = setup();
    player.goto(7);
    player.setParam('seri', 'sol');
    one(el, 'rect.tail-shade.left');
    expect(el.querySelector('rect.tail-shade.right')).toBeNull();
  });

  it('step 7: dragging 003 to 60 moves the mean to 13,6 and leaves the median at 8,5', () => {
    const { el, player } = setup();
    player.goto(6);
    player.setParam('extreme', 60);
    expect(labels(el)).toEqual(['13,6', '8,5']);
  });

  it('step 7: pointer-dragging the outlier along the number line writes the extreme', () => {
    const { el, player } = setup();
    const paramsHost = document.createElement('div');
    document.body.append(paramsHost);
    mountDagilimParams(paramsHost, player);
    player.goto(6);
    const handle = one(el, 'circle.drag-handle');
    const x60 = tickX(el, '60');
    fire(handle, 'pointerdown', tickX(el, '30'));
    fire(handle, 'pointermove', tickX(el, '40'));
    expect(player.state.params.extreme).toBe(40);
    fire(handle, 'pointermove', x60);
    fire(handle, 'pointerup', x60);
    expect(player.state.params.extreme).toBe(60);
    expect(labels(el)).toEqual(['13,6', '8,5']);
    // the live value is published for the e2e and the range input follows the player state
    expect(one(el, 'svg.dag-plot').getAttribute('data-drag')).toBe('60');
    expect(paramsHost.querySelector<HTMLInputElement>('input[data-param=extreme]')!.value).toBe('60');
    // step 8 has no draggable outlier
    player.goto(7);
    expect(el.querySelector('circle.drag-handle')).toBeNull();
    expect(one(el, 'svg.dag-plot').hasAttribute('data-drag')).toBe(false);
  });

  it('step 7: the outlier handle is a focusable slider that the arrow keys move', () => {
    const { el, player } = setup();
    cleanup.push(bindKeys(window, player, { toggleFullscreen() {}, toggleHelp() {} }, []));
    player.goto(6);
    const handle = one(el, 'circle.drag-handle');
    expect(handle.getAttribute('tabindex')).toBe('0');
    expect(handle.getAttribute('aria-orientation')).toBe('horizontal');
    const press = (key: string, shift = false): void => {
      one(el, 'circle.drag-handle').dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey: shift, bubbles: true, cancelable: true }));
    };
    press('ArrowRight');
    expect(player.state.params.extreme).toBe(29);
    press('ArrowRight', true);
    expect(player.state.params.extreme).toBe(34);
    // the same clamp as the pointer drag: never below 28 or past 60
    for (let i = 0; i < 3; i++) press('ArrowLeft', true);
    expect(player.state.params.extreme).toBe(28);
    for (let i = 0; i < 8; i++) press('ArrowRight', true);
    expect(player.state.params.extreme).toBe(60);
    // the handle owns its arrows: the step never moved
    expect(player.state.index).toBe(6);
  });

  it('log step: the marks read two decimals (2,79 / 2,74); raw marks trim to one', () => {
    const { el, player } = setup();
    player.goto(5);
    expect(labels(el)).toEqual(['2,79', '2,74']);
    player.goto(7);
    player.setParam('seri', 'simetrik');
    expect(labels(el)).toEqual(['16', '16']);
  });

  it('bin ranges stay under the bars with ten bins and on the log axis', () => {
    const { el, player } = setup();
    player.goto(1);
    player.setParam('bins', 10);
    const ranges = all(el, 'text.bin-range').map(text);
    expect(ranges).toHaveLength(10);
    expect(ranges[0]).toBe('8–10,2');
    player.goto(5);
    player.setParam('bins', 5);
    const logRanges = all(el, 'text.bin-range').map(text);
    expect(logRanges).toHaveLength(5);
    expect(logRanges[0]).toBe('2,2–2,44');
  });

  it('a step change stops an in-flight drag', () => {
    const { el, player } = setup();
    player.goto(6);
    const handle = one(el, 'circle.drag-handle');
    fire(handle, 'pointerdown', tickX(el, '30'));
    player.goto(7);
    fire(handle, 'pointermove', 1200);
    expect(player.state.params.extreme).toBe(28);
  });

  it('step 9: three rule cards and the two in-scene links, absent on step 8', () => {
    const { el, player } = setup();
    player.goto(8);
    expect(all(el, 'g.rule')).toHaveLength(3);
    expect(all(el, 'g.rule text.rule-title').map(text)).toHaveLength(3);
    expect(all(el, 'g.rule text.rule-body').map(text).every((t) => t.length > 10)).toBe(true);
    expect(all(el, 'a').map((a) => a.getAttribute('href'))).toEqual(['../kutu-grafigi/', '../iqr-aykiri/']);
    player.goto(7);
    expect(all(el, 'g.rule')).toHaveLength(0);
    expect(all(el, 'a')).toHaveLength(0);
  });

  it('every step names n in the number line title', () => {
    const { el, player } = setup();
    for (let i = 0; i < dagilimScenario.steps.length; i++) {
      player.goto(i);
      expect(text(one(el, 'svg.dag-plot text.axis-title')), `step ${i + 1}`).toMatch(/· n = 10$/);
    }
    player.goto(0);
    expect(text(one(el, 'svg.dag-plot text.axis-title'))).toBe('Haftalık çalışma saati (saat) · n = 10');
    player.goto(5);
    expect(text(one(el, 'svg.dag-plot text.axis-title'))).toBe('log1p (saat + 1) · n = 10');
  });

  it('log step: ticks are log1p values and the axis carries the 1p note', () => {
    const { el, player } = setup();
    player.goto(5);
    const ticks = tickNumbers(el);
    expect(ticks.length).toBeGreaterThan(1);
    for (const t of ticks) {
      expect(t).toBeGreaterThan(2);
      expect(t).toBeLessThan(4);
    }
    expect(text(one(el, 'svg.dag-plot text.axis-title'))).toContain('log1p');
    expect(text(one(el, 'svg.dag-plot text.log-note'))).toBe('1p · log1p');
    // raw step: hourly ticks, no note
    player.goto(1);
    expect(Math.max(...tickNumbers(el))).toBeGreaterThan(10);
    expect(text(one(el, 'svg.dag-plot text.log-note'))).toBe('');
  });

  it('a step change animates the bars over MS_STEP x durationScale; a param change is instant', async () => {
    const spy = vi.spyOn(HistLayer.prototype, 'update');
    const { player } = setup(0.5);
    await frame();
    player.goto(1);
    await frame(80);
    expect(spy.mock.calls.at(-1)![1]).toBe(MS_STEP * 0.5);
    spy.mockClear();
    player.setParam('bins', 10);
    await frame(80);
    expect(spy.mock.calls.at(-1)![1]).toBe(0);
    spy.mockClear();
    const z = setup(0);
    z.player.goto(1);
    expect(spy.mock.calls.at(-1)![1]).toBe(0);
  });

  it('destroy() empties the host', () => {
    const { el, scene } = setup();
    scene.destroy();
    expect(el.children.length).toBe(0);
  });
});
