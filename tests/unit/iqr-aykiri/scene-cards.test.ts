// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { CardsLayer } from '../../../src/concepts/iqr-aykiri/scene-cards';
import { deriveIqrView } from '../../../src/concepts/iqr-aykiri/view';
import { iqrAykiriScenario, type IqrParams } from '../../../src/concepts/iqr-aykiri/scenario';

const D = iqrAykiriScenario.defaults;
const view = (i: number, over: Partial<IqrParams> = {}) =>
  deriveIqrView(i, { ...D, ...iqrAykiriScenario.steps[i].params, ...over });
let layers: CardsLayer[] = [];

function setup(w = 1200): { host: HTMLElement; layer: CardsLayer } {
  const host = document.createElement('div');
  document.body.append(host);
  const layer = new CardsLayer(host);
  layers.push(layer);
  layer.resize(w, 160, 'ders');
  return { host, layer };
}
const all = (el: Element, sel: string): HTMLElement[] => [...el.querySelectorAll<HTMLElement>(sel)];
const text = (el: Element | null): string => (el?.textContent ?? '').trim();
const cells = (host: HTMLElement) => all(host, '.iqr-cards .cell');
const bySlot = (host: HTMLElement) => cells(host).sort((a, b) => Number(a.dataset.slot) - Number(b.dataset.slot));
const x = (el: HTMLElement) => Number(el.dataset.x);

afterEach(() => {
  for (const l of layers) l.destroy();
  layers = [];
  document.body.replaceChildren();
});

describe('iqr-aykiri CardsLayer', () => {
  it('step 1: eight cells, two empty with "boş"', () => {
    const { host, layer } = setup();
    layer.update(view(0), 0);
    expect(cells(host)).toHaveLength(8);
    const empty = all(host, '.cell.empty');
    expect(empty).toHaveLength(2);
    expect(empty.map((c) => text(c.querySelector('.cell-value')))).toEqual(['boş', 'boş']);
  });

  it('step 3: cells sorted, mid pair highlighted, ranks 0–5', () => {
    const { host, layer } = setup();
    layer.update(view(2), 0);
    const v = view(2);
    for (const c of v.cells) {
      const el = host.querySelector<HTMLElement>(`.cell[data-key="${c.key}"]`)!;
      expect(el.dataset.slot).toBe(String(c.slot));
    }
    const xs = bySlot(host).map(x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    expect(all(host, '.cell.mid')).toHaveLength(2);
    expect(all(host, '.cell.mid').map((c) => text(c.querySelector('.cell-value'))).sort()).toEqual(['42,30', '45,00']);
    const ranks = all(host, '.cell .rank');
    expect(ranks.map((r) => text(r)).sort()).toEqual(['0', '1', '2', '3', '4', '5']);
  });

  it('step 4: two filled cells with ◆ and 68,77', () => {
    const { host, layer } = setup();
    layer.update(view(3), 0);
    const f = all(host, '.cell.filled');
    expect(f).toHaveLength(2);
    for (const c of f) {
      expect(text(c.querySelector('.cell-mark'))).toBe('◆');
      expect(text(c.querySelector('.cell-value'))).toBe('68,77');
    }
  });

  it('step 6: 003 values sorted, ranks 0–7', () => {
    const { host, layer } = setup();
    layer.update(view(5), 0);
    expect(bySlot(host).map((c) => text(c.querySelector('.rank')))).toEqual(['0', '1', '2', '3', '4', '5', '6', '7']);
    expect(all(host, '.cell.pair')).toHaveLength(0);
  });

  it('step 7: position marker between ranks 1 and 2, closer to 2', () => {
    const { host, layer } = setup();
    layer.update(view(6), 0);
    const s = bySlot(host);
    const w = s[0].getBoundingClientRect().width || Number(s[0].dataset.w);
    const c = (i: number) => x(s[i]) + w / 2;
    const m = host.querySelector<HTMLElement>('.pos-mark')!;
    expect(x(m)).toBeCloseTo(c(1) + 0.75 * (c(2) - c(1)), 3);
    expect(x(m)).toBeGreaterThan(c(1));
    expect(x(m)).toBeLessThan(c(2));
    expect(c(2) - x(m)).toBeLessThan(x(m) - c(1));
    expect(text(m.querySelector('.pos-label'))).toBe(view(6).posMark!.label);
    expect(all(host, '.cell.pair')).toHaveLength(2);
  });

  it('step 8: position marker at 5,25', () => {
    const { host, layer } = setup();
    layer.update(view(7), 0);
    const s = bySlot(host);
    const w = Number(s[0].dataset.w);
    const c = (i: number) => x(s[i]) + w / 2;
    const m = host.querySelector<HTMLElement>('.pos-mark')!;
    expect(x(m)).toBeCloseTo(c(5) + 0.25 * (c(6) - c(5)), 3);
  });

  it('step 9: the 480 cell is marked aykırı', () => {
    const { host, layer } = setup();
    layer.update(view(8), 0);
    const o = all(host, '.cell.outlier');
    expect(o).toHaveLength(1);
    expect(text(o[0])).toContain('480,00');
    expect(text(o[0])).toContain('aykırı');
    expect(host.querySelector<HTMLElement>('.pos-mark')!.hidden).toBe(true);
  });

  it('step 11: the clipped cell shows 82,38', () => {
    const { host, layer } = setup();
    layer.update(view(10, { action: 'kirp' }), 0);
    const c = all(host, '.cell.clipped');
    expect(c).toHaveLength(1);
    expect(text(c[0].querySelector('.cell-value'))).toBe('82,38');
  });

  it('sil: the deleted cell fades and ranks renumber 0–6', () => {
    const { host, layer } = setup();
    layer.update(view(10, { action: 'sil' }), 0);
    expect(all(host, '.cell.deleted')).toHaveLength(1);
    expect(all(host, '.cell.deleted .rank')).toHaveLength(0);
    expect(all(host, '.cell .rank').map((r) => text(r)).sort()).toEqual(['0', '1', '2', '3', '4', '5', '6']);
  });

  it('resize re-lays cells; ranks stay under their cells', () => {
    const { host, layer } = setup(1200);
    layer.update(view(6), 0);
    const before = bySlot(host).map(x);
    const mBefore = x(host.querySelector<HTMLElement>('.pos-mark')!);
    layer.resize(900, 160, 'ders');
    const after = bySlot(host).map(x);
    expect(after).not.toEqual(before);
    expect(Math.max(...after)).toBeLessThan(900);
    for (const c of cells(host)) {
      const r = c.querySelector<HTMLElement>('.rank');
      if (r) expect(r.parentElement).toBe(c);
      expect(c.style.transform).toBe(`translate(${x(c)}px, 0px)`);
      expect(x(c) + Number(c.dataset.w)).toBeLessThanOrEqual(900);
    }
    expect(x(host.querySelector<HTMLElement>('.pos-mark')!)).not.toBe(mBefore);
  });

  it('part change swaps the cells', () => {
    const { host, layer } = setup();
    layer.update(view(4), 0);
    expect(cells(host).every((c) => c.dataset.key!.startsWith('1-'))).toBe(true);
    layer.update(view(5), 0);
    const keys = cells(host).map((c) => c.dataset.key!);
    expect(keys).toHaveLength(8);
    expect(keys.every((k) => k.startsWith('2-'))).toBe(true);
  });
});
