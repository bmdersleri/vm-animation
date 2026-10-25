// @vitest-environment jsdom
import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
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
});
