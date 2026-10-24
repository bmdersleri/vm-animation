// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { BLUE_SCALE, HeatTable, ORANGE_SCALE, heatFill, heatInk, type HeatTableSpec } from '../../../src/core/plot/heat-table';

afterEach(() => {
  document.body.replaceChildren();
});

const spec = (over: Partial<HeatTableSpec> = {}): HeatTableSpec => ({
  rows: ['Belge 0', 'Belge 1'],
  cols: ['a', 'b', 'c'],
  cells: [
    [{ value: 0, text: '0' }, { value: 1, text: '1' }, { value: 2, text: '2' }],
    [{ value: 2, text: '2' }, { value: 0, text: '0' }, { value: 1, text: '1' }],
  ],
  scale: BLUE_SCALE,
  max: 2,
  ...over,
});

const mount = (s: HeatTableSpec): HeatTable => {
  const t = new HeatTable(document);
  document.body.append(t.el);
  t.update(s);
  return t;
};

describe('heat table', () => {
  it('cells carry row and column', () => {
    const t = mount(spec());
    const cells = [...t.el.querySelectorAll<HTMLElement>('.heat-cell')];
    expect(cells).toHaveLength(6);
    const at = t.el.querySelector<HTMLElement>('.heat-cell[data-row="1"][data-col="2"]')!;
    expect(at.textContent).toBe('1');
    expect([...t.el.querySelectorAll('.heat-col')].map((c) => c.textContent)).toEqual(['a', 'b', 'c']);
    expect([...t.el.querySelectorAll('.heat-row')].map((c) => c.textContent)).toEqual(['Belge 0', 'Belge 1']);
  });

  it('colour scale follows the value', () => {
    const t = mount(spec());
    const fill = (r: number, c: number): string => t.el.querySelector<HTMLElement>(`.heat-cell[data-row="${r}"][data-col="${c}"]`)!.style.backgroundColor;
    expect(fill(0, 0)).toBe(heatFill(BLUE_SCALE, 0, 2));
    expect(fill(0, 2)).toBe(heatFill(BLUE_SCALE, 2, 2));
    expect(fill(0, 1)).not.toBe(fill(0, 2));
    expect(heatFill(BLUE_SCALE, 1, 2)).not.toBe(heatFill(ORANGE_SCALE, 1, 2));
    // the strongest cell is dark enough for white text, the empty one keeps the ink
    expect(heatInk(BLUE_SCALE, 2, 2)).toBe('#ffffff');
    expect(heatInk(BLUE_SCALE, 0, 2)).not.toBe('#ffffff');
    // values above the max are clamped, a zero max never gives NaN
    expect(heatFill(BLUE_SCALE, 5, 2)).toBe(heatFill(BLUE_SCALE, 2, 2));
    expect(heatFill(BLUE_SCALE, 1, 0)).toBe(heatFill(BLUE_SCALE, 0, 1));
  });

  it('keeps the cells when the values change and marks focus and zero', () => {
    const t = mount(spec({ focusRow: 0 }));
    const before = t.el.querySelector('.heat-cell[data-row="0"][data-col="1"]');
    expect(t.el.querySelectorAll('.heat-cell.is-focus')).toHaveLength(3);
    expect(t.el.querySelectorAll('.heat-cell.is-zero')).toHaveLength(2);
    t.update(spec({ focusRow: 1, cells: spec().cells.map((r) => r.map((c) => ({ ...c, text: 'x' }))) }));
    expect(t.el.querySelector('.heat-cell[data-row="0"][data-col="1"]')).toBe(before);
    expect(before!.textContent).toBe('x');
    expect([...t.el.querySelectorAll('.heat-cell.is-focus')].every((c) => c.getAttribute('data-row') === '1')).toBe(true);
  });
});
