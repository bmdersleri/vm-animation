// @vitest-environment jsdom
import '../svg-stubs';
import { describe, it, expect, afterEach } from 'vitest';
import { RowsLayer } from '../../../src/concepts/ozellik-secimi/scene-rows';
import { deriveSecimView, type SecimView } from '../../../src/concepts/ozellik-secimi/view';
import { ozellikSecimiScenario, ROUNDS_ALL, type SecimParams } from '../../../src/concepts/ozellik-secimi/scenario';
import { COLUMNS } from '../../../src/concepts/ozellik-secimi/data';
import { countSubpaths } from '../../../src/core/plot/dots-path';

const SVGNS = 'http://www.w3.org/2000/svg';
const RECT = { left: 0, top: 0, width: 1200, height: 520 };
const V = (i: number, over: Partial<SecimParams> = {}): SecimView =>
  deriveSecimView(i, { ...ozellikSecimiScenario.defaults, ...ozellikSecimiScenario.steps[i].params, ...over });

let made: { svg: SVGSVGElement; layer: RowsLayer }[] = [];
function setup(ds = 0): { svg: SVGSVGElement; layer: RowsLayer } {
  const svg = document.createElementNS(SVGNS, 'svg') as SVGSVGElement;
  document.body.append(svg);
  const layer = new RowsLayer(svg, ds);
  layer.layout(RECT, 'ders');
  const m = { svg, layer };
  made.push(m);
  return m;
}
afterEach(() => { made.forEach((m) => { m.layer.destroy(); m.svg.remove(); }); made = []; });

const all = (svg: Element, sel: string): SVGElement[] => [...svg.querySelectorAll<SVGElement>(sel)];
const q = (svg: Element, sel: string): SVGElement => svg.querySelector<SVGElement>(sel)!;
const row = (svg: Element, name: string): SVGElement => q(svg, `g.row[data-col="${name}"]`);
const text = (el: Element, sel: string): string => q(el, sel).textContent ?? '';
const shown = (el: Element): boolean => el.getAttribute('display') !== 'none';
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const xsOf = (d: string): number[] => [...d.matchAll(/M(-?[\d.]+),/g)].map((m) => Number(m[1]));
const dOf = (r: Element, cls: string): string => r.querySelector(`path.dots.${cls}`)!.getAttribute('d')!;
const widths = (svg: Element): number[] => all(svg, 'rect.bar').map((b) => Number(b.getAttribute('width')));

describe('secim RowsLayer', () => {
  it('step 1: eight rows of 400 dots as two paths each', () => {
    const { svg, layer } = setup();
    layer.update(V(0), 0);
    expect(all(svg, 'g.row')).toHaveLength(8);
    expect(all(svg, 'g.row text.col-name').map((t) => t.textContent)).toEqual([...COLUMNS]);
    for (const r of all(svg, 'g.row')) {
      expect(countSubpaths(dOf(r, 'c0')) + countSubpaths(dOf(r, 'c1'))).toBe(400);
      expect(countSubpaths(dOf(r, 'c1'))).toBe(169);
      expect(dOf(r, 'c1')).toContain('L');
      expect(dOf(r, 'c0')).not.toContain('L');
    }
    expect(all(svg, 'g.legend text.legend-label').map((t) => t.textContent)).toEqual(['● churn etmeyen', '▲ churn eden']);
    expect(q(svg, 'g.legend').getAttribute('opacity')).not.toBe('0');
  });

  it('step 2: variance labels', () => {
    const { svg, layer } = setup();
    const v = V(1);
    layer.update(v, 0);
    for (const r of v.rows) expect(text(row(svg, r.name), 'text.row-value')).toBe(r.value);
    expect(text(row(svg, 'toplamUcret'), 'text.row-value')).toBe('629.688,34');
    expect(text(row(svg, 'sabitDeger'), 'text.row-value')).toBe('0,00');
  });

  it('step 2: sabitDeger row grey, struck and "elendi"; its dots share one x', () => {
    const { svg, layer } = setup();
    layer.update(V(1), 0);
    const r = row(svg, 'sabitDeger');
    expect(r.classList.contains('eliminated')).toBe(true);
    expect(text(r, 'text.elim-label')).toBe('elendi');
    // circles and triangles start at different offsets from the dot centre; within a class one x
    expect(new Set(xsOf(dOf(r, 'c0'))).size).toBe(1);
    expect(new Set(xsOf(dOf(r, 'c1'))).size).toBe(1);
    expect(all(svg, 'g.row.eliminated')).toHaveLength(1);
  });

  it('step 3: dots fade, bars sorted by F', () => {
    const { svg, layer } = setup();
    layer.update(V(2), 0);
    const bySlot = all(svg, 'g.row').sort((a, b) => Number(a.dataset.slot) - Number(b.dataset.slot)).map((r) => r.dataset.col);
    expect(bySlot).toEqual([
      'destekTaleplerinSayisi', 'musteriKidemAy', 'hizmetSayisi', 'odemeGecikmesi',
      'toplamUcret', 'aylikUcret', 'gurultuluOznitelik', 'sabitDeger',
    ]);
    for (const s of all(svg, 'g.strip')) expect(s.getAttribute('opacity')).toBe('0');
    const w = (n: string): number => Number(q(row(svg, n), 'rect.bar').getAttribute('width'));
    expect(w('destekTaleplerinSayisi')).toBeGreaterThan(w('musteriKidemAy'));
    expect(w('musteriKidemAy')).toBeGreaterThan(w('hizmetSayisi'));
    expect(w('sabitDeger')).toBe(0);
    const zero = row(svg, 'sabitDeger');
    expect(text(zero, 'text.row-value')).toBe('—');
    expect(text(zero, 'text.zero-note')).toBe('varyansı sıfır');
    expect(all(svg, 'text.zero-note').filter(shown)).toHaveLength(1);
    expect(q(svg, 'g.legend').getAttribute('opacity')).toBe('0');
  });

  it('step 4: four filled bars, four struck rows', () => {
    const { svg, layer } = setup();
    layer.update(V(3), 0);
    expect(all(svg, 'g.row.selected').map((r) => r.dataset.col).sort()).toEqual(
      ['destekTaleplerinSayisi', 'hizmetSayisi', 'musteriKidemAy', 'odemeGecikmesi']);
    expect(all(svg, 'g.row.eliminated')).toHaveLength(4);
    expect(all(svg, 'g.row.eliminated').every((r) => text(r, 'text.elim-label') === 'elendi')).toBe(true);
  });

  it('step 5: kıdem and gürültü split by churn', () => {
    const { svg, layer } = setup();
    layer.update(V(4), 0);
    expect(all(svg, 'g.row[data-split="1"]').map((r) => r.dataset.col)).toEqual(['musteriKidemAy', 'gurultuluOznitelik']);
    expect(all(svg, 'g.row.hidden')).toHaveLength(6);
    expect(all(svg, 'text.sub-label').filter(shown).map((t) => t.textContent))
      .toEqual(['churn etmeyen ●', 'churn eden ▲', 'churn etmeyen ●', 'churn eden ▲']);
    const kidem = row(svg, 'musteriKidemAy');
    expect(all(svg, 'line.cut')).toHaveLength(1);
    expect(kidem.querySelector('line.cut')).not.toBeNull();
    expect(text(kidem, 'text.cut-label')).toBe('12 ay');
    // the cut passes left of the non-churners, the first of whom sit at 12 months
    const c0 = dOf(kidem, 'c0');
    const r = Number(/a([\d.]+),/.exec(c0)![1]);
    const cutX = Number(q(kidem, 'line.cut').getAttribute('x1'));
    expect(Math.min(...xsOf(c0)) + r - cutX).toBeGreaterThan(1);
    expect(text(kidem, 'text.row-value')).toBe('F = 94,66');
    expect(countSubpaths(dOf(kidem, 'c0')) + countSubpaths(dOf(kidem, 'c1'))).toBe(400);
    // the sub-strips sit one above the other: the churners are lower than the stayers
    const ys = (cls: string): number[] => [...dOf(kidem, cls).matchAll(/M-?[\d.]+,(-?[\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.min(...ys('c1'))).toBeGreaterThan(Math.max(...ys('c0')));
  });

  it('step 6: round-1 bars and "tur 1"', () => {
    const { svg, layer } = setup();
    layer.update(V(5), 0);
    const r = row(svg, 'toplamUcret');
    expect(r.classList.contains('eliminated')).toBe(true);
    expect(text(r, 'text.elim-label')).toBe('tur 1');
    expect(text(r, 'text.row-value')).toBe('0,00004');
    expect(all(svg, 'text.elim-label').filter((t) => t.textContent)).toHaveLength(1);
    expect(all(svg, 'g.row.selected')).toHaveLength(0);
  });

  it('step 7: four rounds label four rows', () => {
    const { svg, layer } = setup();
    layer.update(V(6, { rounds: ROUNDS_ALL }), 0);
    expect(all(svg, 'text.elim-label').map((t) => t.textContent).filter(Boolean).sort())
      .toEqual(['tur 1', 'tur 2', 'tur 3', 'tur 4']);
    expect(all(svg, 'g.row.selected')).toHaveLength(4);
  });

  it('step 8: highlight on the noise row', () => {
    const { svg, layer } = setup();
    layer.update(V(7), 0);
    expect(all(svg, 'g.row.highlight').map((r) => r.dataset.col)).toEqual(['gurultuluOznitelik']);
    expect(row(svg, 'gurultuluOznitelik').classList.contains('selected')).toBe(true);
  });

  it('no NaN in the DOM at any step or k', () => {
    const { svg, layer } = setup();
    for (let i = 0; i < 10; i++) {
      layer.update(V(i), 0);
      expect(svg.innerHTML).not.toContain('NaN');
    }
    for (let k = 1; k <= 7; k++) {
      layer.update(V(3, { k }), 0);
      expect(svg.innerHTML).not.toContain('NaN');
    }
  });

  it('labels stay consistent while nSelect and scaling change mid-sweep', () => {
    const { svg, layer } = setup();
    const rounds = (): string[] => all(svg, 'text.elim-label').map((t) => t.textContent ?? '').filter((t) => t.startsWith('tur'));
    layer.update(V(6, { rounds: 2, nSelect: 7 }), 0);
    expect(rounds()).toEqual(['tur 1']);
    layer.update(V(6, { rounds: 2, nSelect: 1, scaling: 'standard' }), 0);
    expect(rounds().length).toBeLessThanOrEqual(7);
    expect(all(svg, 'g.row.selected')).toHaveLength(0);
  });

  it('layout keeps font sizes', () => {
    const { svg, layer } = setup();
    layer.update(V(2), 0);
    const names = all(svg, 'text.col-name');
    const size = (): (string | null)[] => names.map((t) => t.getAttribute('font-size') ?? t.style.fontSize);
    const before = size();
    layer.layout({ left: 0, top: 0, width: 860, height: 520 }, 'ders');
    expect(size()).toEqual(before);
    const barX = Number(q(svg, 'rect.bar').getAttribute('x'));
    for (const t of names) {
      // TextMeasure estimate where layout is unavailable: 0.62 em per character
      const px = parseFloat(getComputedStyle(t).fontSize) || 23;
      expect(Number(t.getAttribute('x')) + (t.textContent ?? '').length * px * 0.62).toBeLessThanOrEqual(barX);
    }
    for (const b of all(svg, 'rect.bar')) {
      expect(Number(b.getAttribute('x')) + Number(b.getAttribute('width'))).toBeLessThanOrEqual(860);
    }
  });

  it('a layout change rewrites the dots; a step change does not', () => {
    const { svg, layer } = setup();
    layer.update(V(0), 0);
    const d0 = dOf(q(svg, 'g.row'), 'c0');
    layer.update(V(1), 0);
    expect(dOf(q(svg, 'g.row'), 'c0')).toBe(d0);
    layer.layout({ left: 0, top: 0, width: 900, height: 480 }, 'ders');
    expect(dOf(q(svg, 'g.row'), 'c0')).not.toBe(d0);
  });

  it('durationScale 1: an RFE round tweens the bars and settles', async () => {
    const instant = setup(0);
    instant.layer.update(V(6, { rounds: 2 }), 0);
    const to = widths(instant.svg);

    const { svg, layer } = setup(1);
    layer.update(V(6, { rounds: 1 }), 0);
    const from = widths(svg);
    layer.update(V(6, { rounds: 2 }), 1);
    await sleep(250);
    const mid = widths(svg);
    const moving = to.map((_, i) => i).filter((i) => Math.abs(to[i] - from[i]) > 2);
    expect(moving.length).toBeGreaterThan(0);
    expect(moving.some((i) => Math.abs(mid[i] - from[i]) > 0.5 && Math.abs(mid[i] - to[i]) > 0.5)).toBe(true);
    await sleep(600);
    expect(widths(svg).every((w, i) => Math.abs(w - to[i]) < 0.01)).toBe(true);
  });

  it('interrupt snaps a running tween to its final state', async () => {
    const { svg, layer } = setup(1);
    layer.update(V(5), 0);
    layer.update(V(2), 1);
    await sleep(100);
    layer.interrupt();
    const settled = widths(svg);
    await sleep(100);
    expect(widths(svg)).toEqual(settled);
    expect(Number(q(row(svg, 'destekTaleplerinSayisi'), 'rect.bar').getAttribute('width'))).toBeGreaterThan(100);
  });
});
