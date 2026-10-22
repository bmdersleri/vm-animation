// @vitest-environment jsdom
import '../svg-stubs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DendrogramLayer, type DendrogramSpec } from '../../../src/core/plot/dendrogram';
import { CLUSTER, NAVY, UNASSIGNED } from '../../../src/core/plot/marks';
import { dendrogramData as D } from '../../../src/concepts/dendrogram/data';
import { branches, cutForK, labelsAtHeight, leafX } from '../../../src/concepts/dendrogram/tree';

const NS = 'http://www.w3.org/2000/svg';
const ld = D.linkages.ward;
const n = D.points.length;
const bs = branches(ld, n);
const maxH = ld.merges[ld.merges.length - 1].height;
const RECT = { left: 0, top: 0, width: 520, height: 320 };

afterEach(() => { vi.unstubAllGlobals(); document.body.replaceChildren(); });

function setup() {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }));
  const svg = document.createElementNS(NS, 'svg');
  const g = document.createElementNS(NS, 'g');
  svg.append(g);
  document.body.append(svg);
  const layer = new DendrogramLayer(g);
  layer.resize(RECT, maxH);
  return { svg, layer };
}
const spec = (o: Partial<DendrogramSpec> = {}): DendrogramSpec => ({
  branches: bs,
  leafX: leafX(ld),
  leafLabels: D.points.map((_p, i) => String(i + 1)),
  shown: bs.length,
  ...o,
});
const num = (e: Element | null, a: string): number => Number(e!.getAttribute(a));
/** y of a branch's bar: the first V after M in its path. */
const barY = (svg: Element, merge: number): number => {
  const d = svg.querySelector(`path.dg-branch[data-merge="${merge}"]`)!.getAttribute('d')!;
  return Number(/V(-?[\d.]+)H/.exec(d)![1]);
};

describe('DendrogramLayer', () => {
  it('draws one ⊓ per shown merge at its height', () => {
    const { svg, layer } = setup();
    layer.update(spec({ shown: 5 }), false);
    expect(svg.querySelectorAll('path.dg-branch')).toHaveLength(5);
    layer.update(spec(), false);
    expect(svg.querySelectorAll('path.dg-branch')).toHaveLength(n - 1);
    const ys = bs.map((_b, i) => barY(svg, i + 1));
    // taller merges sit higher on screen (smaller y)
    bs.forEach((b, i) => bs.forEach((c, j) => {
      if (b.height < c.height) expect(ys[i]).toBeGreaterThan(ys[j]);
    }));
    expect(Math.min(...ys)).toBe(ys[n - 2]);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(svg.querySelectorAll('g.dg-leaf')).toHaveLength(n);
    expect([...svg.querySelectorAll('g.dg-leaf text')].map((t) => t.textContent)).toEqual(D.points.map((_p, i) => String(i + 1)));
  });

  it('cut line spans the plot at the cut height', () => {
    const { svg, layer } = setup();
    const cut = cutForK(ld, 3);
    layer.update(spec({ cut }), false);
    const line = svg.querySelector('line.dg-cut')!;
    expect(line.getAttribute('data-cut')).toBe(String(cut));
    const frame = svg.querySelector('rect.dg-frame')!;
    expect(num(line, 'x1')).toBe(num(frame, 'x'));
    expect(num(line, 'x2')).toBeCloseTo(num(frame, 'x') + num(frame, 'width'), 5);
    expect(num(line, 'y1')).toBe(num(line, 'y2'));
    // between the last merge of k=3 and the first merge above it
    const lowY = barY(svg, n - 3);
    const highY = barY(svg, n - 2);
    expect(num(line, 'y1')).toBeLessThan(lowY);
    expect(num(line, 'y1')).toBeGreaterThan(highY);
    layer.update(spec({ cut: null }), false);
    expect(svg.querySelector('line.dg-cut')).toBeNull();
  });

  it('branches above the cut are muted, clusters below take their colour', () => {
    const { svg, layer } = setup();
    const cut = cutForK(ld, 3);
    const labels = labelsAtHeight(ld, n, cut);
    layer.update(spec({ cut, colourOf: (p) => CLUSTER[labels[p]] }), false);
    bs.forEach((b, i) => {
      const p = svg.querySelector(`path.dg-branch[data-merge="${i + 1}"]`)!;
      if (b.height > cut) {
        expect(p.getAttribute('stroke')).toBe(UNASSIGNED);
        expect(p.getAttribute('data-state')).toBe('muted');
      } else {
        expect(p.getAttribute('stroke')).toBe(CLUSTER[labels[b.members[0]]]);
        expect(p.getAttribute('data-state')).toBe('cluster');
      }
    });
    layer.update(spec(), false);
    expect(svg.querySelector('path.dg-branch[data-merge="1"]')!.getAttribute('stroke')).toBe(NAVY);
  });

  it('highlights a merge, the selected leaf and the gap', () => {
    const { svg, layer } = setup();
    layer.update(spec({ highlight: 3, selectedLeaf: 7, gap: { low: 2.8, high: 9 } }), false);
    expect(svg.querySelectorAll('path.dg-branch[data-state="highlight"]')).toHaveLength(1);
    expect(svg.querySelector('path.dg-branch[data-state="highlight"]')!.getAttribute('data-merge')).toBe('4');
    expect(svg.querySelectorAll('g.dg-leaf[data-selected="true"]')).toHaveLength(1);
    expect(svg.querySelector('g.dg-leaf[data-selected="true"]')!.getAttribute('data-i')).toBe('7');
    expect(num(svg.querySelector('rect.dg-gap'), 'height')).toBeGreaterThan(0);
  });

  it('repeated update keeps element counts', () => {
    const { svg, layer } = setup();
    const cut = cutForK(ld, 4);
    const s = (): DendrogramSpec => spec({ cut, gap: { low: 2.8, high: 9 }, highlight: 2, selectedLeaf: 1 });
    const count = () => svg.querySelectorAll('*').length;
    layer.update(s(), false);
    const first = count();
    for (let i = 0; i < 4; i++) layer.update(s(), false);
    expect(count()).toBe(first);
    layer.resize({ ...RECT, width: 400 }, maxH);
    layer.update(s(), false);
    expect(count()).toBe(first);
    expect(svg.innerHTML).not.toMatch(/NaN|Infinity|undefined/);
  });

  it('morphs to another linkage on the same elements and destroy removes everything', () => {
    const { svg, layer } = setup();
    layer.update(spec(), false);
    const before = svg.querySelector('path.dg-branch[data-merge="5"]');
    const sl = D.linkages.single;
    layer.resize(RECT, sl.merges[sl.merges.length - 1].height);
    layer.update(spec({ branches: branches(sl, n), leafX: leafX(sl) }), false);
    expect(svg.querySelector('path.dg-branch[data-merge="5"]')).toBe(before);
    expect(svg.querySelectorAll('path.dg-branch')).toHaveLength(n - 1);
    layer.destroy();
    expect(svg.querySelectorAll('*')).toHaveLength(1);
  });
});
