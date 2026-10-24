import type { Selection } from 'd3-selection';
import type { Mode } from '../../core/mode';
import { AxesLayer } from '../../core/plot/axes';
import { HBarsLayer } from '../../core/plot/hbars';
import { chooseOffset, labelArea, offsets, type Box } from '../../core/plot/label-place';
import { r1 } from '../../core/plot/marks';
import type { TextMeasure } from '../../core/plot/text-measure';
import { fitViewport, type Rect } from '../../core/plot/viewport';
import { CUSTOMERS } from '../dengesiz/data';
import { mountSvg, PAD, type G, type ViewScene } from './scene-base';
import type { ExampleView, FlowView, LeakView, Order, Spot } from './view';

/** Plane of the example scatter: tenure in months, monthly charge. */
const X_DOMAIN: [number, number] = [0, 72];
const Y_DOMAIN: [number, number] = [15, 125];

/**
 * Domain of the step-3 scatter: the whole plane, or (with an example) a window around the point and its parents,
 * because the parents of the example lie a few charge units apart.
 */
export function exampleDomain(e: ExampleView | null): { x: [number, number]; y: [number, number] } {
  if (!e) {
    return { x: X_DOMAIN, y: Y_DOMAIN };
  }
  const spots = [e.point, ...e.parents];
  const tenure = spots.map((p) => p.tenure);
  const charge = spots.map((p) => p.charge);
  return {
    x: [Math.max(0, Math.min(...tenure) - 10), Math.max(...tenure) + 14],
    y: [Math.min(...charge) - 8, Math.max(...charge) + 8],
  };
}

type Kind = 'veri' | 'smote' | 'bol' | 'egit' | 'test';

const LABELS: Record<Kind, string> = { veri: 'veri', smote: 'SMOTE', bol: 'böl', egit: 'eğit', test: 'test' };

/** Boxes of each order, grouped: a group of two sits inside the training frame and never splits across lines. */
const GROUPS: Record<Order, { kinds: Kind[]; framed: boolean }[]> = {
  yanlis: ['veri', 'smote', 'bol', 'egit', 'test'].map((k) => ({ kinds: [k as Kind], framed: false })),
  dogru: [
    { kinds: ['veri'], framed: false },
    { kinds: ['bol'], framed: false },
    { kinds: ['smote', 'egit'], framed: true },
    { kinds: ['test'], framed: false },
  ],
};

const TITLES: Record<Order, string> = { yanlis: 'yanlış sıra: önce SMOTE', dogru: 'doğru sıra: yalnız eğitimde' };

/** One placed box of a row. */
export interface PlacedBox {
  kind: Kind;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A connector from one box to the next; `wrap` is an elbow down to the next line. */
export interface PlacedArrow {
  from: PlacedBox;
  to: PlacedBox;
  wrap: boolean;
}

/** One laid-out row: boxes, the training frame, the arrows and the height it needs (title included). */
export interface RowLayout {
  boxes: PlacedBox[];
  frame: { x: number; y: number; w: number; h: number } | null;
  arrows: PlacedArrow[];
  titleY: number;
  height: number;
}

/** Font sizes (px) a row uses: `box` for the text in the boxes, `title` for the row title. */
export interface RowFonts {
  box: number;
  title: number;
}

/** Lays a row out inside `width` px: boxes sized to their text, lines wrapped between groups. */
export function layoutRow(order: Order, width: number, fonts: RowFonts, measure: TextMeasure): RowLayout {
  const fs = fonts.box;
  const boxH = Math.round(fs * 1.9);
  const padX = fs * 0.4;
  const gap = fs * 0.9;
  const framePad = fs * 0.22;
  const lineGap = fs * 0.9;
  const titleH = fonts.title * 1.3 + framePad + 6;
  const boxes: PlacedBox[] = [];
  const arrows: PlacedArrow[] = [];
  let frame: RowLayout['frame'] = null;
  let x = PAD;
  let line = 0;
  let prev: PlacedBox | null = null;
  for (const group of GROUPS[order]) {
    const widths = group.kinds.map((k) => measure.width(LABELS[k], 'prediction', fs) + padX * 2);
    const inner = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
    const extra = group.framed ? framePad : 0;
    const gw = inner + extra * 2;
    let wrap = false;
    if (prev && x + gap + gw > width - PAD) {
      wrap = true;
      line += 1;
      x = PAD;
    } else if (prev) {
      x += gap;
    }
    const y = titleH + line * (boxH + lineGap);
    let bx = x + extra;
    group.kinds.forEach((kind, i) => {
      const box: PlacedBox = { kind, x: bx, y, w: widths[i], h: boxH };
      if (prev) {
        arrows.push({ from: prev, to: box, wrap: wrap && i === 0 });
      }
      boxes.push(box);
      prev = box;
      bx += widths[i] + gap;
    });
    if (group.framed) {
      frame = { x, y: y - framePad, w: gw, h: boxH + framePad * 2 };
    }
    x += gw;
  }
  return { boxes, frame, arrows, titleY: fonts.title * 1.05, height: titleH + (line + 1) * boxH + line * lineGap + framePad };
}

/**
 * The flow area (Ders steps 1-3): two rows of boxes and arrows, the count bars under the chosen row, and the
 * example scatter of a synthetic test point with its two parents.
 */
export class FlowScene implements ViewScene {
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly measure: TextMeasure;
  private readonly rowsG: G;
  private readonly barsG: G;
  private readonly axesG: G;
  private readonly bgG: G;
  private readonly exampleG: G;
  private readonly axes: AxesLayer;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const m = mountSvg(host, 'Yanlış ve doğru işlem sırası, sayımlar ve sentetik test noktasının ebeveynleri');
    this.svg = m.svg;
    this.measure = m.measure;
    this.rowsG = this.svg.append('g').attr('class', 'flow-rows');
    this.barsG = this.svg.append('g').attr('class', 'flow-bars');
    this.axesG = this.svg.append('g').attr('class', 'flow-axes');
    this.bgG = this.svg.append('g').attr('class', 'flow-bg');
    this.exampleG = this.svg.append('g').attr('class', 'flow-example');
    this.axes = new AxesLayer(this.axesG);
  }

  resize(w: number, h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.mode = mode;
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('axes').interrupt('bars');
  }

  destroy(): void {
    this.interrupt();
    this.svg.remove();
  }

  update(v: LeakView, ms: number): void {
    const flow = v.flow;
    if (!flow) {
      return;
    }
    this.interrupt();
    const { tick, axis, title } = this.measure.fonts(this.mode);
    this.rowsG.selectAll('*').remove();
    this.barsG.selectAll('*').remove();
    this.bgG.selectAll('*').remove();
    this.exampleG.selectAll('*').remove();
    this.axesG.attr('display', flow.part === 'example' ? null : 'none');
    this.svg.attr('width', this.w).attr('data-rows', flow.rows.length).attr('data-part', flow.part);
    if (flow.part === 'example') {
      this.svg.attr('height', this.h);
      this.drawExample(flow, tick, axis);
      return;
    }
    const rowsH = this.drawRows(flow, { box: title, title: axis }, tick);
    if (flow.part === 'counts') {
      const top = rowsH + PAD;
      const titleH = tick * 1.6;
      const groupMin = titleH + tick * 1.5 * 2 + 12;
      const total = Math.max(groupMin * 3, this.h - top - PAD);
      const groupH = total / 3;
      const max = Math.max(...flow.bars.map((b) => b.value));
      const sample = flow.bars.reduce((a, b) => (b.text.length > a.length ? b.text : a), '');
      for (let r = 0; r < 3; r++) {
        const y = top + r * groupH;
        this.barsG.append('text').attr('class', 'flow-bar-title').attr('x', PAD).attr('y', r1(y + tick * 1.1)).text(flow.barTitles[r] ?? '');
        const g = this.barsG.append('g').attr('class', 'flow-bar-row').attr('data-row', r);
        new HBarsLayer(g, this.measure).draw(
          flow.bars.filter((b) => b.row === r).map((b) => ({ ...b, row: 0 })),
          {
            rect: { x: 0, y: y + titleH, w: this.w, h: groupH - titleH },
            tick,
            rows: 1,
            slots: 2,
            max,
            itemCls: 'flow-bar',
            valueSample: sample,
            ms,
          },
        );
      }
      const rect = { y: top, h: total };
      this.svg.attr('height', Math.max(this.h, rect.y + rect.h + PAD));
      return;
    }
    this.svg.attr('height', Math.max(this.h, rowsH + PAD));
  }

  /** Draws the rows from the top (centred vertically when there is room); returns the bottom edge. */
  private drawRows(flow: FlowView, fonts: RowFonts, tick: number): number {
    const layouts = flow.rows.map((order) => ({ order, lay: layoutRow(order, this.w, fonts, this.measure) }));
    const rowGap = tick * 1.2;
    const total = layouts.reduce((s, l) => s + l.lay.height, 0) + rowGap * (layouts.length - 1);
    const free = this.h - total;
    let y = flow.part === 'rows' ? Math.max(PAD, free / 2) : PAD;
    for (const { order, lay } of layouts) {
      this.drawRow(order, lay, y, order === flow.selected);
      y += lay.height + rowGap;
    }
    return y - rowGap;
  }

  private drawRow(order: Order, lay: RowLayout, top: number, selected: boolean): void {
    const g = this.rowsG
      .append('g')
      .attr('class', selected ? 'flow-row is-selected' : 'flow-row')
      .attr('data-order', order)
      .attr('transform', `translate(0,${r1(top)})`);
    g.append('text').attr('class', 'flow-title').attr('x', PAD).attr('y', r1(lay.titleY)).text(TITLES[order]);
    if (lay.frame) {
      g.append('rect')
        .attr('class', 'train-only')
        .attr('rx', 8)
        .attr('x', r1(lay.frame.x))
        .attr('y', r1(lay.frame.y))
        .attr('width', r1(lay.frame.w))
        .attr('height', r1(lay.frame.h));
    }
    const head = Math.max(5, lay.boxes[0].h * 0.17);
    for (const a of lay.arrows) {
      const y1 = a.from.y + a.from.h / 2;
      const y2 = a.to.y + a.to.h / 2;
      if (!a.wrap) {
        const x1 = a.from.x + a.from.w + 2;
        const x2 = a.to.x - 2;
        g.append('path').attr('class', 'flow-arrow').attr('d', `M${r1(x1)},${r1(y1)}H${r1(x2 - head)}`);
        g.append('path')
          .attr('class', 'flow-head')
          .attr('d', `M${r1(x2)},${r1(y1)}l${r1(-head)},${r1(-head * 0.6)}v${r1(head * 1.2)}z`);
        continue;
      }
      const x1 = a.from.x + a.from.w / 2;
      const x2 = a.to.x + a.to.w / 2;
      const ym = a.from.y + a.from.h + (a.to.y - a.from.y - a.from.h) / 2;
      const yTop = a.to.y - 2;
      g.append('path').attr('class', 'flow-arrow').attr('d', `M${r1(x1)},${r1(a.from.y + a.from.h + 2)}V${r1(ym)}H${r1(x2)}V${r1(yTop - head)}`);
      g.append('path')
        .attr('class', 'flow-head')
        .attr('d', `M${r1(x2)},${r1(yTop)}l${r1(-head * 0.6)},${r1(-head)}h${r1(head * 1.2)}z`);
    }
    for (const b of lay.boxes) {
      g.append('rect')
        .attr('class', 'flow-box')
        .attr('data-kind', b.kind)
        .attr('rx', 8)
        .attr('x', r1(b.x))
        .attr('y', r1(b.y))
        .attr('width', r1(b.w))
        .attr('height', r1(b.h));
      g.append('text')
        .attr('class', 'flow-text')
        .attr('data-kind', b.kind)
        .attr('text-anchor', 'middle')
        .attr('x', r1(b.x + b.w / 2))
        .attr('y', r1(b.y + b.h / 2))
        .attr('dy', '0.35em')
        .text(LABELS[b.kind]);
    }
  }

  /** Step 3: every customer faint, the synthetic point (hollow), its two parents (filled) and the segment between them. */
  private drawExample(flow: FlowView, tick: number, axis: number): void {
    const gap = Math.round(tick * 0.45);
    const yTickW = this.measure.maxWidth(['120'], 'tick', tick);
    const left = PAD + axis * 1.2 + gap + yTickW + gap;
    const right = this.w - PAD - tick * 0.6;
    const top = PAD + tick;
    const bottom = this.h - (gap + tick * 1.2 + gap + axis * 1.25 + PAD);
    const rect: Rect = { left, top, width: Math.max(60, right - left), height: Math.max(60, bottom - top) };
    const sc = fitViewport(exampleDomain(flow.example), rect, false);
    this.axes.draw(
      sc,
      rect,
      {
        xTickCount: 6,
        yTickCount: 6,
        xTickY: rect.top + rect.height + gap + tick * 0.9,
        yTickX: rect.left - gap,
        xTitle: { x: rect.left + rect.width / 2, y: rect.top + rect.height + gap + tick * 1.2 + gap + axis * 0.95, text: 'kıdem (ay)' },
        yTitle: { x: rect.left - gap - yTickW - gap - axis * 0.3, y: rect.top + rect.height / 2, lines: ['aylık ücret'] },
      },
      0,
      'leak',
    );
    const r = Math.max(2, tick * 0.12);
    const dom = exampleDomain(flow.example);
    const visible = CUSTOMERS.filter(
      (c) => c.tenure >= dom.x[0] && c.tenure <= dom.x[1] && c.charge >= dom.y[0] && c.charge <= dom.y[1],
    );
    this.bgG
      .selectAll<SVGCircleElement, (typeof CUSTOMERS)[number]>('circle.bg-pt')
      .data(visible)
      .join('circle')
      .attr('class', 'bg-pt')
      .attr('r', r1(r))
      .attr('cx', (d) => r1(sc.x(d.tenure)))
      .attr('cy', (d) => r1(sc.y(d.charge)));
    const e = flow.example;
    if (!e) {
      this.drawNote(flow.note, rect, tick);
      return;
    }
    const px = (p: Spot): number => r1(sc.x(p.tenure));
    const py = (p: Spot): number => r1(sc.y(p.charge));
    const [a, b] = e.parents;
    const g = this.exampleG;
    g.append('line')
      .attr('class', 'parent-segment')
      .attr('x1', px(a))
      .attr('y1', py(a))
      .attr('x2', px(b))
      .attr('y2', py(b));
    const half = tick * 0.4;
    for (const p of e.parents) {
      g.append('circle').attr('class', 'parent').attr('r', r1(half)).attr('cx', px(p)).attr('cy', py(p));
    }
    g.append('circle').attr('class', 'synth-point').attr('r', r1(half)).attr('cx', px(e.point)).attr('cy', py(e.point));
    const marks = [
      { name: 'sentetik nokta', cls: 'is-synth', at: e.point },
      { name: 'ebeveyn 1', cls: 'is-parent', at: a },
      { name: 'ebeveyn 2', cls: 'is-parent', at: b },
    ];
    // the segment is an obstacle too: small boxes along it
    const taken: Box[] = [];
    for (let t = 0; t <= 16; t++) {
      const x = px(a) + ((px(b) - px(a)) * t) / 16;
      const y = py(a) + ((py(b) - py(a)) * t) / 16;
      taken.push({ l: x - 2, t: y - 2, r: x + 2, b: y + 2 });
    }
    for (const m of marks) {
      taken.push({ l: px(m.at) - half, t: py(m.at) - half, r: px(m.at) + half, b: py(m.at) + half });
    }
    for (const m of marks) {
      const x = px(m.at);
      const y = py(m.at);
      const chars = this.measure.width(m.name, 'tick', tick) / (tick * 0.7);
      const o = chooseOffset({ x, y, chars, cands: offsets(half, 3, tick), fs: tick, taken, area: labelArea(rect) });
      const w = this.measure.width(m.name, 'tick', tick);
      const lo = o.anchor === 'end' ? rect.left + w : o.anchor === 'middle' ? rect.left + w / 2 : rect.left;
      const hi = o.anchor === 'end' ? right : o.anchor === 'middle' ? right - w / 2 : right - w;
      g.append('text')
        .attr('class', `leak-label ${m.cls}`)
        .attr('text-anchor', o.anchor)
        .attr('x', r1(Math.max(lo, Math.min(hi, x + o.dx))))
        .attr('y', r1(y + o.dy))
        .text(m.name);
    }
  }

  /** The "no example" sentence on a plate in the plot's upper left. */
  private drawNote(note: string | null, rect: Rect, tick: number): void {
    if (!note) {
      return;
    }
    const lines = this.measure.wrap(note, rect.width - tick * 2, 'tick', tick);
    const lineH = tick * 1.35;
    const widest = this.measure.maxWidth(lines, 'tick', tick);
    const g = this.exampleG.append('g').attr('class', 'leak-note');
    g.append('rect')
      .attr('class', 'note-plate')
      .attr('rx', 6)
      .attr('x', r1(rect.left + tick * 0.5))
      .attr('y', r1(rect.top + tick * 0.5))
      .attr('width', r1(widest + tick))
      .attr('height', r1(lines.length * lineH + tick * 0.5));
    lines.forEach((l, i) => {
      g.append('text')
        .attr('class', 'note-line')
        .attr('x', r1(rect.left + tick))
        .attr('y', r1(rect.top + tick * 0.5 + tick * 0.4 + (i + 1) * lineH - tick * 0.3))
        .text(l);
    });
  }
}
