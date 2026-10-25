// @vitest-environment jsdom
import fs from 'node:fs';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { formatNumber as f } from '../../../src/core/plot/format';
import { MODEL, customerByRow } from '../../../src/concepts/xai/data';
import { go, num, setup, texts } from './harness';

const css = fs.readFileSync('src/concepts/shap-degerleri/shap-degerleri.css', 'utf8');
const f3 = (v: number) => f(v, 3);
const c = customerByRow(301);
const node = (el: Element, mask: number) => el.querySelector<SVGGElement>(`.lattice-node[data-mask="${mask}"]`)!;

describe('lattice scene', () => {
  it('step 3 fills eight coalition values', () => {
    const { el, player } = setup();
    go(player, 'koalisyon');
    expect(el.querySelector('.shap-stage')!.getAttribute('data-view')).toBe('lattice');
    const nodes = [...el.querySelectorAll('.lattice-node')];
    expect(nodes).toHaveLength(8);
    expect(nodes.map((n) => n.querySelector('.node-v')!.textContent)).toEqual(c.v.map(f3));
    // full feature names, no abbreviations
    expect(texts(node(el, 7), '.node-name')).toEqual(['tenure', 'MonthlyCharges', 'TotalCharges']);
    expect(node(el, 0).querySelector('.node-name')!.textContent).toBe('∅');
    expect(el.querySelectorAll('.lattice-edge')).toHaveLength(12);
    expect(el.querySelectorAll('.lattice-edge.is-path')).toHaveLength(0);
    expect(node(el, 0).querySelector('.node-v')!.textContent).toBe(f3(MODEL.base));
  });

  it('step 3 sweep fills layer by layer', () => {
    const { el, player } = setup();
    go(player, 'koalisyon', false);
    player.setParams({ scan: 1 });
    const filled = () => [...el.querySelectorAll('.lattice-node')].filter((n) => n.querySelector('.node-v')!.textContent !== '').length;
    expect(filled()).toBe(1);
    player.setParams({ scan: 4 });
    expect(filled()).toBe(4);
    expect(el.querySelectorAll('.lattice-edge')).toHaveLength(3);
  });

  it('step 4 highlights one ordering path', () => {
    const { el, player } = setup();
    go(player, 'marjinal');
    const path = [...el.querySelectorAll('.lattice-edge.is-path')];
    expect(path).toHaveLength(3);
    expect(path.map((e) => `${e.getAttribute('data-from')}>${e.getAttribute('data-to')}`)).toEqual(['0>1', '1>3', '3>7']);
    expect(texts(el, '.edge-label')).toEqual([f3(c.v[1] - c.v[0]), f3(c.v[3] - c.v[1]), f3(c.v[7] - c.v[3])].map((t) => `+${t}`));
    expect(el.querySelectorAll('.lattice-node.is-path')).toHaveLength(4);
    player.setParam('order', 5);
    expect(path.length).toBe(3);
    expect([...el.querySelectorAll('.lattice-edge.is-path')].map((e) => e.getAttribute('data-from'))).toEqual(['0', '4', '6']);
    expect(texts(el, '.edge-label')[2]).toBe(`+${f3(c.v[7] - c.v[6])}`);
  });

  it('step 5 averages six orderings to the book values', () => {
    const { el, player } = setup();
    go(player, 'alti-siralama');
    const rows = [...el.querySelectorAll('.order-row')];
    expect(rows).toHaveLength(6);
    expect(rows[0].textContent).toContain('tenure → MonthlyCharges → TotalCharges');
    expect(texts(el, '.order-mean')).toEqual(c.shap.map(f3));
    expect(texts(el, '.order-mean')).toEqual(['0,567', '0,093', '0,040']);
    expect(el.querySelector('.formula')!.textContent).toContain('⅓');
    expect(el.querySelector('.formula')!.textContent).toContain('φ(tenure)');
    // a half-filled table averages the rows so far
    player.setParams({ scan: 2 });
    expect([...el.querySelectorAll('.order-row')].filter((r) => r.classList.contains('is-empty'))).toHaveLength(4);
    player.setParam('customer', 77);
    player.setParams({ scan: Number.POSITIVE_INFINITY });
    expect(texts(el, '.order-mean')).toEqual(customerByRow(77).shap.map(f3));
  });

  it('lattice and table fit 390 px', () => {
    const { el, player } = setup(390, 520, 'lab');
    go(player, 'alti-siralama');
    const svg = el.querySelector<SVGSVGElement>('.lattice-plot')!;
    // every node sits inside the SVG, whatever width the Lab font needs (jsdom measures 16 px text)
    const width = num(svg, 'width');
    for (const rect of el.querySelectorAll('.lattice-node rect.node-box')) {
      expect(num(rect, 'x')).toBeGreaterThanOrEqual(0);
      expect(num(rect, 'x') + num(rect, 'width')).toBeLessThanOrEqual(width + 0.5);
    }
    expect(el.querySelectorAll('.order-table .order-row')).toHaveLength(6);
    // jsdom has no layout: a table or lattice that would not fit scrolls inside its own wrapper, and the
    // narrow layout stacks lattice and table; the real width is checked in the browser pass
    expect(/\.lattice-wrap\s*\{[^}]*overflow-x:\s*auto/.test(css)).toBe(true);
    expect(/\.orders-wrap\s*\{[^}]*overflow-x:\s*auto/.test(css)).toBe(true);
    expect(/@media \(max-width:900px\) \{[^@]*\.lattice-scene\[data-part='orders'\] \{ grid-template-columns:minmax\(0,1fr\)/.test(css)).toBe(true);
  });

  it('the whole lattice fits the stage height in steps 3 to 5', () => {
    for (const id of ['koalisyon', 'marjinal', 'alti-siralama']) {
      const { el, player } = setup(1280, 540);
      go(player, id);
      const svg = el.querySelector<SVGSVGElement>('.lattice-plot')!;
      const bottom = node(el, 7).querySelector('rect.node-box')!;
      expect(num(bottom, 'y') + num(bottom, 'height'), id).toBeLessThanOrEqual(num(svg, 'height'));
      // 540 px minus the three-line strip estimate (jsdom has no layout) leaves about 425 px for the stage
      expect(num(svg, 'height'), id).toBeLessThanOrEqual(425 - 20);
    }
  });

  it('node boxes are as wide as their measured text', () => {
    const { el, player } = setup();
    go(player, 'koalisyon');
    const box = node(el, 7).querySelector('rect.node-box')!;
    const names = [...node(el, 7).querySelectorAll('.node-name')];
    expect(names).toHaveLength(3);
    // jsdom estimates 0.62 em per character at its 16 px default: the node must exceed the longest name estimate
    expect(num(box, 'width')).toBeGreaterThan('MonthlyCharges'.length * 16 * 0.62);
  });

  describe('with realistic text widths', () => {
    // jsdom has no text layout: give every probe 9 px per character, wider than the 390 px stage can hold in one row
    const proto = SVGElement.prototype as unknown as { getComputedTextLength?: () => number };
    const saved = proto.getComputedTextLength;
    beforeEach(() => {
      proto.getComputedTextLength = function (this: Element) {
        return (this.textContent ?? '').length * 9;
      };
    });
    afterEach(() => {
      proto.getComputedTextLength = saved;
    });

    it('the lattice fits the 390 px stage, strokes included, wrapping long names', () => {
      for (const id of ['koalisyon', 'marjinal', 'alti-siralama']) {
        const { el, player } = setup(390, 520, 'lab');
        go(player, id);
        const svg = el.querySelector<SVGSVGElement>('.lattice-plot')!;
        const width = num(svg, 'width');
        expect(width, id).toBeLessThanOrEqual(390);
        expect(el.querySelectorAll('.lattice-node'), id).toHaveLength(8);
        for (const rect of el.querySelectorAll('.lattice-node rect.node-box')) {
          expect(num(rect, 'x'), id).toBeGreaterThanOrEqual(3);
          expect(num(rect, 'x') + num(rect, 'width') + 3, id).toBeLessThanOrEqual(width);
        }
        // the long name wraps into two lines but keeps its full text
        const name = [...node(el, 7).querySelectorAll('.node-name')].find((n) => n.textContent === 'MonthlyCharges')!;
        expect(name.querySelectorAll('tspan')).toHaveLength(2);
        // wrapped text stays within its node
        const box = node(el, 7).querySelector('rect.node-box')!;
        expect(num(box, 'y') + num(box, 'height')).toBeLessThanOrEqual(num(svg, 'height'));
      }
    });

    it('a very short stage keeps the whole lattice in the SVG and lets the host scroll', () => {
      const { el, player } = setup(1280, 150);
      go(player, 'marjinal');
      const svg = el.querySelector<SVGSVGElement>('.lattice-plot')!;
      const bottom = node(el, 7).querySelector('rect.node-box')!;
      expect(num(bottom, 'y') + num(bottom, 'height')).toBeLessThanOrEqual(num(svg, 'height'));
      expect(num(svg, 'height')).toBeGreaterThan(150);
      expect(/\.shap-host\s*\{[^}]*overflow-y:\s*auto/.test(css)).toBe(true);
    });
  });
});
