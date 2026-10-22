// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { korelasyonScenario, type KorelParams } from '../../../src/concepts/korelasyon-isi-haritasi/scenario';
import { mountKorelasyonScene } from '../../../src/concepts/korelasyon-isi-haritasi/scene';
import { deriveKorelView } from '../../../src/concepts/korelasyon-isi-haritasi/view';
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

function setup(durationScale = 0, size: [number, number] = [1280, 720], mode: Mode = 'ders') {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer<KorelParams>(korelasyonScenario);
  const scene = mountKorelasyonScene(el, player, mode, { durationScale });
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
const Ev = (): typeof MouseEvent => (window.PointerEvent ?? MouseEvent) as typeof MouseEvent;
const fire = (target: Element, kind: string, x: number, y: number): void => {
  const C = Ev();
  target.dispatchEvent(new C(kind, { clientX: x, clientY: y, bubbles: true }));
};

/** The y-axis ticks of one panel as (value, px) pairs, read from the axes layer's own transforms. */
function yTicks(el: Element, panel = 'g.panel[data-set=IV]'): { v: number; y: number }[] {
  return all(el, `${panel} g.axis.y g.tick`)
    .map((g) => {
      const m = /translate\(\s*[-\d.]+,\s*(-?[\d.]+)/.exec(g.getAttribute('transform') ?? '');
      const v = Number(text(g.querySelector('text')).replace('−', '-').replace(',', '.'));
      return { v, y: m ? Number(m[1]) : NaN };
    })
    .filter((t) => Number.isFinite(t.v) && Number.isFinite(t.y))
    .sort((a, b) => a.v - b.v);
}

/** Data value → plot y, through the same two ticks the y axis draws. */
function yOf(el: Element, value: number): number {
  const t = yTicks(el);
  const a = t[0];
  const b = t[t.length - 1];
  return a.y + ((value - a.v) * (b.y - a.y)) / (b.v - a.v);
}

describe('korelasyon scene', () => {
  it('mounts .kor-scene, svg.kor-plot, the strip and one panel with points and a trend', () => {
    const { el, player } = setup();
    expect(el.querySelector('.kor-scene')).not.toBeNull();
    one(el, '.kor-scene svg.kor-plot');
    one(el, 'p.formula');
    expect(all(el, 'g.panel')).toHaveLength(1);
    expect(all(el, 'g.panel[data-set=calisma-not] path.pts')).toHaveLength(1);
    expect(all(el, 'g.panel[data-set=calisma-not] path.trend')).toHaveLength(1);
    for (let i = 0; i < korelasyonScenario.steps.length; i++) {
      player.goto(i);
      expect(text(one(el, 'p.formula')), `adım ${i + 1}`).toBe(deriveKorelView(i, player.state.params).strip);
    }
    player.goto(1);
    expect(text(one(el, 'p.formula'))).toContain('0,995');
  });

  it('step 5: four g.panel I–IV and the same "r = 0,816" summary in every text.panel-stats', () => {
    const { el, player } = setup();
    player.goto(4);
    const panels = all(el, 'g.panel');
    expect(panels).toHaveLength(4);
    expect(panels.map((p) => p.getAttribute('data-set'))).toEqual(['I', 'II', 'III', 'IV']);
    const stats = all(el, 'text.panel-stats');
    expect(stats).toHaveLength(4);
    for (const s of stats) {
      expect(text(s)).toContain('r = 0,816');
      expect(text(s)).toContain('7,5009');
    }
    // the four panels share one axes pair: every y axis starts at the same tick value
    expect(new Set(panels.map((p) => text(p.querySelector('g.axis.y g.tick text')))).size).toBe(1);
    expect(all(el, 'g.panel path.pts')).toHaveLength(4);
    expect(all(el, 'g.panel path.trend')).toHaveLength(4);
  });

  it('step 4: 16 rect.cell and a 1,000 diagonal', () => {
    const { el, player } = setup();
    player.goto(3);
    expect(all(el, 'rect.cell')).toHaveLength(16);
    expect(all(el, 'text.cell-text')).toHaveLength(16);
    for (let i = 0; i < 4; i++) {
      expect(text(one(el, `text.cell-text[data-row="${i}"][data-col="${i}"]`))).toBe('1,000');
    }
    expect(text(one(el, 'text.cell-text[data-row="0"][data-col="2"]'))).toBe('0,999');
    expect(text(one(el, 'text.cell-text[data-row="0"][data-col="1"]'))).toBe('−0,991');
    // no panels stay behind the heatmap
    expect(all(el, 'g.panel')).toHaveLength(0);
  });

  it('step 8: 25 cells and a churn row/column label', () => {
    const { el, player } = setup();
    player.goto(7);
    expect(all(el, 'rect.cell')).toHaveLength(25);
    for (const axis of ['row', 'col']) {
      const label = one(el, `text.${axis}-label[data-var="churn"]`);
      expect(text(label)).toBe('churn');
    }
    expect(text(one(el, 'text.cell-text[data-row="4"][data-col="2"]'))).toBe('−0,363');
  });

  it('step 6: circle.leverage, and dragging the point to y = 20 makes r 0,958', () => {
    const { el, player } = setup();
    player.goto(5);
    const lever = one(el, 'circle.leverage');
    expect(lever.getAttribute('tabindex')).toBe('0');
    expect(one(el, 'svg.kor-plot').getAttribute('data-drag')).toBe('12.5');
    const startY = Number(lever.getAttribute('cy'));
    expect(startY).toBeCloseTo(yOf(el, 12.5), 0);

    fire(lever, 'pointerdown', Number(lever.getAttribute('cx')), startY);
    const target = yOf(el, 20);
    fire(lever, 'pointermove', Number(lever.getAttribute('cx')), target);
    fire(lever, 'pointerup', Number(lever.getAttribute('cx')), target);

    expect(player.state.params.noktaY).toBe(20);
    expect(text(one(el, 'p.formula'))).toContain('r = 0,958');
    expect(one(el, 'svg.kor-plot').getAttribute('data-drag')).toBe('20');
  });

  it('step 6 keyboard: ArrowDown moves the point half a unit, Shift a whole two', () => {
    const { el, player } = setup();
    player.goto(5);
    const lever = one(el, 'circle.leverage');
    const press = (key: string, shift = false): void => {
      lever.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey: shift, bubbles: true }));
    };
    press('ArrowDown');
    expect(player.state.params.noktaY).toBe(12);
    press('ArrowUp', true);
    expect(player.state.params.noktaY).toBe(14);
    // the same clamp as the pointer: never past 6 or 20
    for (let i = 0; i < 8; i++) press('ArrowDown', true);
    expect(player.state.params.noktaY).toBe(6);
  });

  it('step 9: two g.eda-box cards with the two EDA sentences', () => {
    const { el, player } = setup();
    player.goto(8);
    const boxes = all(el, 'g.eda-box');
    expect(boxes).toHaveLength(2);
    const bodies = boxes.map(text);
    expect(bodies[0]).toContain('tüm veri üzerinde EDA');
    expect(bodies[1]).toContain('yalnız eğitim kümesinde EDA');
    expect(all(el, 'g.panel')).toHaveLength(0);
  });

  it('step 10: the one-sentence rule and three in-scene links', () => {
    const { el, player } = setup();
    player.goto(9);
    expect(text(one(el, 'text.kor-rule'))).toBe('Özet istatistik yeterli değildir, grafik şart.');
    const links = all(el, 'a.kor-link');
    expect(links).toHaveLength(3);
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '../kutu-grafigi/', '../iqr-aykiri/', '../pca/',
    ]);
  });

  it('destroy() empties the host', () => {
    const { el, scene } = setup();
    scene.destroy();
    expect(el.children.length).toBe(0);
  });
});
