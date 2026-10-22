// @vitest-environment jsdom
import '../svg-stubs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DendrogramLayer, type DendrogramSpec } from '../../../src/core/plot/dendrogram';
import { CLUSTER, NAVY, UNASSIGNED } from '../../../src/core/plot/marks';
import { dendrogramData as D } from '../../../src/concepts/dendrogram/data';
import { branches, cutForK, labelsAtHeight, leafX } from '../../../src/concepts/dendrogram/tree';
import { axisTopOf } from '../../../src/concepts/dendrogram/view';

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

  it('the cut label sits above the line, or below it when the axis top leaves no room', () => {
    const { svg, layer } = setup();
    layer.update(spec({ cut: cutForK(ld, 3) }), false);
    expect(num(svg.querySelector('text.dg-cut-label'), 'y')).toBeLessThan(num(svg.querySelector('line.dg-cut'), 'y1'));
    // a cut at the very top of the axis (maxHeight × 1,06)
    layer.update(spec({ cut: maxH * 1.06 }), false);
    const y = num(svg.querySelector('text.dg-cut-label'), 'y');
    expect(y).toBeGreaterThan(num(svg.querySelector('line.dg-cut'), 'y1'));
    expect(y - 13).toBeGreaterThanOrEqual(num(svg.querySelector('rect.dg-frame'), 'y'));
  });

  it('cut label keeps clear of horizontal bars', () => {
    const { svg, layer } = setup();
    // one wide bar; the cut is 10 px under it, so the default spot (just above the line) would touch the bar
    const bar = { id: 2, xl: 0, xr: 1, x: 0.5, yl: 0, yr: 0, height: 1, members: [0, 1] };
    const frame = svg.querySelector('rect.dg-frame')!;
    layer.resize(RECT, 1);
    layer.update({ branches: [bar], leafX: [0, 1], leafLabels: ['1', '2'], shown: 1, cut: 0.5 }, false);
    const plotH2 = Number(frame.getAttribute('height'));
    const c = 1 - 10 * (1.06 / plotH2);
    layer.update({ branches: [bar], leafX: [0, 1], leafLabels: ['1', '2'], shown: 1, cut: c }, false);
    const barY2 = barY(svg, 1);
    const lineY = num(svg.querySelector('line.dg-cut'), 'y1');
    expect(lineY - barY2).toBeGreaterThan(8);
    expect(lineY - barY2).toBeLessThan(12);
    const base = num(svg.querySelector('text.dg-cut-label'), 'y');
    // the label does not sit between the bar and the line: it moved below the line
    expect(base).toBeGreaterThan(lineY);
    // and with room above the bar the label stays above the line, 4 px clear of the bar
    layer.update({ branches: [bar], leafX: [0, 1], leafLabels: ['1', '2'], shown: 1, cut: 1 - 40 * (1.06 / plotH2) }, false);
    const base2 = num(svg.querySelector('text.dg-cut-label'), 'y');
    const line2 = num(svg.querySelector('line.dg-cut'), 'y1');
    expect(base2).toBeLessThan(line2);
    expect(barY(svg, 1) + 4).toBeLessThanOrEqual(base2 - 13);
  });

  it('at the Lab size the cut label crosses no branch, for every linkage and stored k', () => {
    // Lab tick font 13 px; 350x500 = the 1280x720 Lab tree before the stacked layout, 736x228 = after it
    let shortSeen = false;
    for (const [w, h] of [[350, 500], [736, 228]]) for (const l of ['ward', 'complete', 'average', 'single'] as const) {
      const { svg, layer } = setup();
      svg.style.fontSize = '13px';
      (svg.firstElementChild as SVGGElement).style.fontSize = '13px';
      layer.resize({ left: 0, top: 0, width: w, height: h }, axisTopOf(l));
      const lk = D.linkages[l];
      const bl = branches(lk, n);
      for (const { k } of lk.cuts) {
        layer.update({ branches: bl, leafX: leafX(lk), leafLabels: D.points.map((_p, i) => String(i + 1)), shown: bl.length, cut: cutForK(lk, k) }, false);
        const t = svg.querySelector('text.dg-cut-label')!;
        if (l === 'ward' && w === 350 && k === 5) shortSeen = t.getAttribute('data-short') === 'true';
        const x = num(t, 'x'); const y = num(t, 'y'); const tw = t.textContent!.length * 13 * 0.62;
        for (const p of svg.querySelectorAll('path.dg-branch')) {
          const [x1, y1, yb, x2, y2] = /M(-?[\d.]+),(-?[\d.]+)V(-?[\d.]+)H(-?[\d.]+)V(-?[\d.]+)/.exec(p.getAttribute('d')!)!.slice(1).map(Number);
          for (const [ax, ay, bx, by] of [[x1, y1, x1, yb], [x1, yb, x2, yb], [x2, yb, x2, y2]]) {
            const apart = Math.max(ax, bx) < x - 2 || Math.min(ax, bx) > x + tw + 2 || Math.max(ay, by) < y - 15 || Math.min(ay, by) > y + 2;
            expect(apart, `${l} ${w}x${h} k=${k} merge ${p.getAttribute('data-merge')}`).toBe(true);
          }
        }
      }
      layer.destroy();
    }
    // ward k = 5 at the narrow size fits only as the bare number (the panel names the cut height)
    expect(shortSeen).toBe(true);
  });

  it('each shown branch has a wide transparent hit path on its bar, above the branches, children over parents', () => {
    const { svg, layer } = setup();
    layer.update(spec({ shown: 6 }), false);
    expect(svg.querySelectorAll('path.dg-hit')).toHaveLength(6);
    layer.update(spec({ cut: cutForK(ld, 3) }), false);
    const hits = [...svg.querySelectorAll('path.dg-hit')];
    expect(hits).toHaveLength(n - 1);
    // drawn after (over) every visible branch and the cut line
    const last = [...svg.querySelectorAll('path.dg-branch, line.dg-cut')].pop()!;
    expect(last.compareDocumentPosition(hits[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const pos = new Map(hits.map((h, i) => [Number(h.getAttribute('data-merge')), i]));
    bs.forEach((b, i) => {
      const hit = hits[pos.get(i + 1)!];
      expect(hit.getAttribute('stroke')).toBe('transparent');
      expect(hit.getAttribute('pointer-events')).toBe('stroke');
      expect(num(hit, 'stroke-width')).toBeGreaterThanOrEqual(12);
      // the bar only: from the left child's x to the right child's x at the merge height
      const v = svg.querySelector(`path.dg-branch[data-merge="${i + 1}"]`)!.getAttribute('d')!;
      const [, x1, , yb, x2] = /M(-?[\d.]+),(-?[\d.]+)V(-?[\d.]+)H(-?[\d.]+)/.exec(v)!;
      expect(hit.getAttribute('d')).toBe(`M${x1},${yb}H${x2}`);
      // a child's hit path comes after (is drawn over) its parent's
      for (const c of [b.left, b.right]) if (c >= n) expect(pos.get(c - n + 1)!).toBeGreaterThan(pos.get(i + 1)!);
    });
    layer.update(spec({ shown: 2 }), false);
    expect(svg.querySelectorAll('path.dg-hit')).toHaveLength(2);
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

  describe('with motion on', () => {
    const live = () => {
      const r = setup();
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q }));
      return r;
    };

    it('a linkage change tweens a branch path through a shape between its start and end', async () => {
      // real clock, and placed before the fake-timer tests: d3-timer stays stuck once a fake clock has driven it
      const { svg, layer } = live();
      const sl = D.linkages.single;
      const d = (m: number): number[] => (svg.querySelector(`path.dg-branch[data-merge="${m}"]`)!.getAttribute('d')!.match(/-?[\d.]+/g) ?? []).map(Number);
      const all = (): number[][] => [...Array(n - 1).keys()].map((i) => d(i + 1));
      layer.update(spec(), false);
      const start = all();
      // same y scale (ward's top), so the single-linkage bars really move
      layer.update(spec({ branches: branches(sl, n), leafX: leafX(sl) }), true);
      await new Promise((r) => setTimeout(r, 200)); // inside the 450 ms tween
      const mid = all();
      await new Promise((r) => setTimeout(r, 700));
      const end = all();
      // the branch whose path travels furthest
      let m = 0;
      let best = -1;
      start.forEach((a, i) => { const t = a.reduce((acc, v, k) => acc + Math.abs(v - end[i][k]), 0); if (t > best) { best = t; m = i; } });
      expect(best).toBeGreaterThan(5);
      expect(mid[m]).not.toEqual(start[m]);
      expect(mid[m]).not.toEqual(end[m]);
      mid[m].forEach((v, k) => {
        expect(v).toBeGreaterThanOrEqual(Math.min(start[m][k], end[m][k]) - 0.5);
        expect(v).toBeLessThanOrEqual(Math.max(start[m][k], end[m][k]) + 0.5);
      });
      layer.destroy();
    });

    it('interrupts a running transition and settles on the last spec with stable counts', () => {
      vi.useFakeTimers();
      const { svg, layer } = live();
      layer.update(spec(), true);
      const count = () => svg.querySelectorAll('*').length;
      vi.advanceTimersByTime(100);
      const sl = D.linkages.single;
      layer.resize(RECT, sl.merges[sl.merges.length - 1].height);
      const before = svg.querySelector('path.dg-branch[data-merge="5"]');
      layer.update(spec({ branches: branches(sl, n), leafX: leafX(sl) }), true);
      console.log("DBG3", svg.querySelector(`path.dg-branch[data-merge="16"]`)!.getAttribute("d"));
      layer.update(spec({ branches: branches(sl, n), leafX: leafX(sl) }), true);
      console.log("DBG3", svg.querySelector(`path.dg-branch[data-merge="16"]`)!.getAttribute("d"));
      vi.advanceTimersByTime(2000);
      expect(svg.querySelector('path.dg-branch[data-merge="5"]')).toBe(before);
      expect(svg.querySelectorAll('path.dg-branch')).toHaveLength(n - 1);
      const settled = count();
      layer.update(spec({ branches: branches(sl, n), leafX: leafX(sl) }), true);
      console.log("DBG3", svg.querySelector(`path.dg-branch[data-merge="16"]`)!.getAttribute("d"));
      vi.advanceTimersByTime(2000);
      expect(count()).toBe(settled);
      expect(svg.innerHTML).not.toMatch(/NaN|Infinity|undefined/);
      layer.destroy();
      vi.useRealTimers();
    });

    it('destroy in the middle of a transition leaves nothing running', () => {
      vi.useFakeTimers();
      const { svg, layer } = live();
      layer.update(spec(), true);
      vi.advanceTimersByTime(150);
      expect(() => layer.destroy()).not.toThrow();
      expect(() => vi.advanceTimersByTime(3000)).not.toThrow();
      expect(svg.querySelectorAll('*')).toHaveLength(1);
      expect(vi.getTimerCount()).toBe(0);
      vi.useRealTimers();
    });
  });
});
