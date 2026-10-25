import { select, type Selection } from 'd3-selection';
import type { Mode } from '../../core/mode';
import { AxesLayer } from '../../core/plot/axes';
import { chooseOffset, labelArea, offsets, type Box } from '../../core/plot/label-place';
import { r1 } from '../../core/plot/marks';
import { TextMeasure } from '../../core/plot/text-measure';
import { tr } from '../../core/plot/transition';
import { fitAspect, type Rect } from '../../core/plot/viewport';
import { el, NS, type ViewScene } from './scene-base';
import type { Arrow, TfidfView, VectorsView } from './view';

/** Below this width (px) the plane sits above the list. */
const NARROW = 900;

type G = Selection<SVGGElement, unknown, null, undefined>;

/**
 * The vector plane (steps 8-9): two term axes (`AxesLayer`), one `.vec-arrow` per vector from the origin, the
 * `.angle-arc` between them with its degree label, and beside it the ranked `.sim-row` list. Arrows grow from the
 * origin when `ms` > 0. Labels are placed with the shared label placer so they never sit on an arrow tip or on
 * each other.
 */
export class VectorsScene implements ViewScene {
  private readonly root: HTMLDivElement;
  private readonly list: HTMLUListElement;
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly axes: AxesLayer;
  private readonly arcG: G;
  private readonly arrowG: G;
  private readonly labelG: G;
  private readonly measure: TextMeasure;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'vectors-scene');
    const plane = el(doc, 'div', 'plane-box');
    const root = doc.createElementNS(NS, 'svg');
    plane.append(root);
    this.svg = select(root)
      .attr('class', 'plane-plot')
      .attr('role', 'img')
      .attr('aria-label', 'İki terim ekseninde iki vektör ve aralarındaki açı');
    this.axes = new AxesLayer(this.svg.append('g').attr('class', 'plane-axes'));
    this.arcG = this.svg.append('g').attr('class', 'plane-arc');
    this.arrowG = this.svg.append('g').attr('class', 'plane-arrows');
    this.labelG = this.svg.append('g').attr('class', 'plane-labels');
    const probe = this.svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
    this.list = doc.createElement('ul');
    this.list.className = 'sim-list';
    this.root.append(plane, this.list);
    host.append(this.root);
  }

  resize(w: number, h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.mode = mode;
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('arrows').interrupt('axes');
  }

  destroy(): void {
    this.interrupt();
    this.root.remove();
  }

  update(v: TfidfView, ms: number): void {
    const vec = v.vectors;
    if (!vec) return;
    this.root.dataset.scale = vec.scale;
    this.drawList(vec);
    this.drawPlane(vec, ms);
  }

  private drawList(vec: VectorsView): void {
    const doc = this.root.ownerDocument;
    this.list.replaceChildren(
      ...vec.list.map((r, i) => {
        const li = el(doc, 'li', 'sim-row');
        li.dataset.id = r.id;
        li.classList.toggle('is-query', r.query);
        const head = el(doc, 'div', 'sim-head');
        head.append(el(doc, 'span', 'sim-rank', `${i + 1}.`), el(doc, 'span', 'sim-label', r.label), el(doc, 'strong', 'sim-score', r.score));
        li.append(head, el(doc, 'span', 'sim-note', r.note));
        return li;
      }),
    );
  }

  private drawPlane(vec: VectorsView, ms: number): void {
    const f = this.measure.fonts(this.mode);
    const { tick, axis } = f;
    const wide = this.w >= NARROW;
    const width = wide ? Math.floor(this.w * 0.52) : this.w - 24;
    const height = wide ? Math.max(220, Math.min(this.h - 8, width)) : Math.min(Math.round(width * 0.9), 340);
    this.svg.attr('width', width).attr('height', height);
    const gap = Math.round(tick * 0.4);
    const yTickW = this.measure.maxWidth(['0,00'], 'tick', tick);
    const left = axis * 1.3 + gap + yTickW + gap + 4;
    const right = width - tick * 1.2;
    const top = tick * 0.8;
    const bottom = height - (gap + tick * 1.2 + gap + axis * 1.3 + 4);
    const rect: Rect = { left, top, width: Math.max(60, right - left), height: Math.max(60, bottom - top) };
    const hi = vec.extent * 1.18;
    const sc = fitAspect({ x: [0, hi], y: [0, hi] }, rect, 1, 'min');
    this.axes.draw(
      sc,
      rect,
      {
        xTickCount: 4,
        yTickCount: 4,
        xTickY: rect.top + rect.height + gap + tick * 0.9,
        yTickX: rect.left - gap,
        xTitle: { x: rect.left + rect.width / 2, y: rect.top + rect.height + gap + tick * 1.2 + gap + axis * 0.95, text: vec.terms[0] },
        yTitle: { x: axis * 0.7, y: rect.top + rect.height / 2, lines: [vec.terms[1]] },
      },
      0,
      `plane-${vec.scale}`,
    );
    const ox = sc.x(0);
    const oy = sc.y(0);
    const tips = vec.arrows.map((a) => ({ a, x: sc.x(a.x), y: sc.y(a.y) }));
    // the query is drawn last, so its short arrow stays visible on top of a longer one in the same direction
    this.drawArrows([...tips].reverse(), ox, oy, tick, ms);
    const taken: Box[] = [];
    const area = labelArea(rect, 10);
    this.drawArc(vec, tips, ox, oy, tick, taken, area);
    this.drawLabels(tips, tick, taken, area);
  }

  private drawArrows(tips: { a: Arrow; x: number; y: number }[], ox: number, oy: number, tick: number, ms: number): void {
    const head = Math.max(9, tick * 0.7);
    const g = this.arrowG
      .selectAll<SVGGElement, { a: Arrow; x: number; y: number }>('g.vec-arrow')
      .data(tips, (d) => d.a.id)
      .join((enter) => {
        const e = enter.append('g');
        e.append('line').attr('class', 'vec-shaft').attr('x1', r1(ox)).attr('y1', r1(oy)).attr('x2', r1(ox)).attr('y2', r1(oy));
        e.append('path').attr('class', 'vec-head');
        return e;
      })
      .attr('class', (d) => `vec-arrow is-${d.a.id}`)
      .attr('data-id', (d) => d.a.id)
      .attr('data-x', (d) => d.a.x)
      .attr('data-y', (d) => d.a.y);
    g.select<SVGLineElement>('line.vec-shaft')
      .attr('x1', r1(ox))
      .attr('y1', r1(oy))
      .call((s) => tr(s, 'arrows', ms).attr('x2', (d) => r1(shaftEnd(d, ox, oy, head)[0])).attr('y2', (d) => r1(shaftEnd(d, ox, oy, head)[1])));
    g.select<SVGPathElement>('path.vec-head').attr('d', (d) => headPath(d, ox, oy, head));
  }

  private drawArc(
    vec: VectorsView,
    tips: { a: Arrow; x: number; y: number }[],
    ox: number,
    oy: number,
    tick: number,
    taken: Box[],
    area: Box,
  ): void {
    this.arcG.selectAll('*').remove();
    if (!vec.angle || tips.length < 2) return;
    const [a, b] = tips;
    const t1 = Math.atan2(oy - a.y, a.x - ox);
    const t2 = Math.atan2(oy - b.y, b.x - ox);
    const lo = Math.min(t1, t2);
    const hi = Math.max(t1, t2);
    const len = Math.min(Math.hypot(a.x - ox, a.y - oy), Math.hypot(b.x - ox, b.y - oy));
    const r = Math.max(14, Math.min(len * 0.55, tick * 4));
    const pt = (t: number, rad: number): [number, number] => [ox + rad * Math.cos(t), oy - rad * Math.sin(t)];
    if (hi - lo > 0.02) {
      const [x1, y1] = pt(lo, r);
      const [x2, y2] = pt(hi, r);
      this.arcG.append('path').attr('class', 'angle-arc').attr('d', `M${r1(x1)},${r1(y1)}A${r1(r)},${r1(r)} 0 0 0 ${r1(x2)},${r1(y2)}`);
    }
    // a zero angle has no wedge to write into: the label sits just below the common direction
    const mid = hi - lo > 0.02 ? (lo + hi) / 2 : lo - 0.5;
    const [lx, ly] = pt(mid, r + tick * 1.5);
    const cand = offsets(2, 4, tick);
    const o = chooseOffset({ x: lx, y: ly, chars: vec.angle.text.length + 3, cands: [{ dx: 0, dy: 0, anchor: 'middle' }, ...cand], fs: tick, taken, area });
    this.arcG
      .append('text')
      .attr('class', 'angle-label')
      .attr('x', r1(lx + o.dx))
      .attr('y', r1(ly + o.dy))
      .attr('text-anchor', o.anchor)
      .text(`açı ${vec.angle.text}`);
  }

  private drawLabels(
    tips: { a: Arrow; x: number; y: number }[],
    tick: number,
    taken: Box[],
    area: Box,
  ): void {
    this.labelG.selectAll('*').remove();
    for (const { a, x, y } of tips) {
      const o = chooseOffset({ x, y, chars: a.label.length, cands: offsets(4, 6, tick), fs: tick, taken, area });
      this.labelG
        .append('text')
        .attr('class', `vec-label is-${a.id}`)
        .attr('x', r1(x + o.dx))
        .attr('y', r1(y + o.dy))
        .attr('text-anchor', o.anchor)
        .text(a.label);
    }
  }
}

/** Where the shaft ends so the head's tip is at the vector's end. */
function shaftEnd(d: { x: number; y: number }, ox: number, oy: number, head: number): [number, number] {
  const len = Math.hypot(d.x - ox, d.y - oy);
  if (len <= head) return [ox, oy];
  const k = (len - head * 0.8) / len;
  return [ox + (d.x - ox) * k, oy + (d.y - oy) * k];
}

/** The head: a triangle at the tip pointing away from the origin (nothing for a zero vector). */
function headPath(d: { x: number; y: number }, ox: number, oy: number, head: number): string {
  const len = Math.hypot(d.x - ox, d.y - oy);
  if (len < 1) return '';
  const ux = (d.x - ox) / len;
  const uy = (d.y - oy) / len;
  const bx = d.x - ux * head;
  const by = d.y - uy * head;
  const wx = -uy * head * 0.45;
  const wy = ux * head * 0.45;
  return `M${r1(d.x)},${r1(d.y)}L${r1(bx + wx)},${r1(by + wy)}L${r1(bx - wx)},${r1(by - wy)}Z`;
}
