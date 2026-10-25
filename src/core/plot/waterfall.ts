import { select, type Selection } from 'd3-selection';
import { formatNonZero, formatNumber } from './format';
import { r1 } from './marks';
import { TextMeasure } from './text-measure';
import { tr } from './transition';
import './waterfall.css';

type G = Selection<SVGGElement, unknown, null, undefined>;

/** One signed part: `id` keys the element, `label` is the name written beside it. */
export interface WaterfallPart {
  id: string;
  label: string;
  value: number;
}

/**
 * What to draw. `waterfall`: one row per part from the base value to the total (rows base, parts, total).
 * `force`: one bar on the shared axis, positive parts stacked leftward from the total and negative parts
 * stacked rightward from it (like shap's force plot), the base value marked by a line. `axis` (default true)
 * switches the value axis off for a bar that shares its axis with the bar below.
 */
export interface WaterfallSpec {
  base: number;
  parts: WaterfallPart[];
  total: number;
  domain: [number, number];
  mode: 'waterfall' | 'force';
  title?: string;
  baseLabel?: string;
  totalLabel?: string;
  axis?: boolean;
}

/** The rectangle the layer draws in (px). */
export interface WaterfallBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A part whose magnitude is below this is drawn as a thin line; its label stays beside it. */
export const TINY = 0.005;

interface SegGeom {
  id: string;
  sign: 'pos' | 'neg';
  start: number;
  end: number;
  lo: number;
  hi: number;
  path: string;
}

interface LabelGeom {
  id: string;
  text: string;
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  leader: { x: number; y1: number; y2: number } | null;
}

interface NameGeom {
  id: string;
  text: string;
  x: number;
  y: number;
}

interface TickGeom {
  v: number;
  x: number;
  y1: number;
  y2: number;
  textY: number;
  text: string;
}

interface Mark {
  x: number;
  y1: number;
  y2: number;
  bar: { x: number; y: number; w: number; h: number } | null;
}

interface Frame {
  segs: SegGeom[];
  labels: LabelGeom[];
  names: NameGeom[];
  ticks: TickGeom[];
  links: { id: string; x: number; y1: number; y2: number }[];
  base: Mark;
  total: Mark;
  title: { x: number; y: number } | null;
  axisY: number | null;
  axisX: [number, number];
  height: number;
}

const MS = 500;

/** "+0,567" / "−0,273": signed contribution with 3 decimals, never "0,000" for a nonzero value. */
function signed(v: number): string {
  return v > 0 ? `+${formatNonZero(v, 3)}` : formatNonZero(v, 3);
}

/** Tick step for an axis of `span` with about five ticks. */
function tickStep(span: number): number {
  const steps = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5];
  return steps.find((s) => span / s <= 6) ?? 10;
}

/** Arrow-ended bar from xa to xb (xa < xb); a positive part points right, a negative one left. */
function arrowPath(xa: number, xb: number, top: number, bot: number, sign: 'pos' | 'neg'): string {
  const mid = (top + bot) / 2;
  if (xb - xa < 3) {
    const c = (xa + xb) / 2;
    return `M${r1(c - 1.5)},${r1(top)}L${r1(c + 1.5)},${r1(top)}L${r1(c + 1.5)},${r1(bot)}L${r1(c - 1.5)},${r1(bot)}Z`;
  }
  const head = Math.min((bot - top) * 0.5, (xb - xa) * 0.45);
  if (sign === 'pos') {
    return `M${r1(xa)},${r1(top)}L${r1(xb - head)},${r1(top)}L${r1(xb)},${r1(mid)}L${r1(xb - head)},${r1(bot)}L${r1(xa)},${r1(bot)}Z`;
  }
  return `M${r1(xb)},${r1(top)}L${r1(xa + head)},${r1(top)}L${r1(xa)},${r1(mid)}L${r1(xa + head)},${r1(bot)}L${r1(xb)},${r1(bot)}Z`;
}

/**
 * Horizontal waterfall / force bar: base value, signed parts with arrow ends, total, value axis and labels.
 * `update` returns the height it used, so a host can size its SVG; in `waterfall` mode that is at least `box.h`.
 */
export class WaterfallLayer {
  private readonly measure: TextMeasure;
  private readonly gAxis: G;
  private readonly gLinks: G;
  private readonly gMarks: G;
  private readonly gSegs: G;
  private readonly gLabels: G;

  constructor(parent: SVGGElement) {
    const root = select(parent) as G;
    const probe = root.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
    this.gAxis = root.append('g').attr('class', 'wf-axis');
    this.gLinks = root.append('g').attr('class', 'wf-links');
    this.gMarks = root.append('g').attr('class', 'wf-marks');
    this.gSegs = root.append('g').attr('class', 'wf-segs');
    this.gLabels = root.append('g').attr('class', 'wf-labels');
  }

  private groups(): G[] {
    return [this.gAxis, this.gLinks, this.gMarks, this.gSegs, this.gLabels];
  }

  /** Stops running transitions (the host calls it before a redraw). */
  interrupt(): void {
    for (const g of this.groups()) {
      g.selectAll('*').interrupt('wf');
    }
  }

  /** Removes everything drawn. */
  clear(): void {
    this.interrupt();
    for (const g of this.groups()) {
      g.selectAll('*').remove();
    }
  }

  /** Draws `spec` in `box`; returns the height used. */
  update(spec: WaterfallSpec, box: WaterfallBox, animate: boolean): number {
    const fs = this.measure.fontPx('wf-label', 13);
    const frame = spec.mode === 'force' ? this.forceFrame(spec, box, fs) : this.waterfallFrame(spec, box, fs);
    this.draw(frame, animate ? MS : 0, spec);
    return frame.height;
  }

  private texts(spec: WaterfallSpec): { baseLabel: string; totalLabel: string; baseText: string; totalText: string } {
    return {
      baseLabel: spec.baseLabel ?? 'temel değer',
      totalLabel: spec.totalLabel ?? 'tahmin',
      baseText: formatNumber(spec.base, 3),
      totalText: formatNumber(spec.total, 3),
    };
  }

  private ticks(spec: WaterfallSpec, xOf: (v: number) => number, y1: number, y2: number, textY: number): TickGeom[] {
    const [d0, d1] = spec.domain;
    const step = tickStep(d1 - d0);
    const dec = Math.abs(step * 10 - Math.round(step * 10)) < 1e-9 ? 1 : 2;
    const out: TickGeom[] = [];
    for (let k = Math.ceil(d0 / step - 1e-9); k * step <= d1 + 1e-9; k++) {
      const v = Math.round(k * step * 1e6) / 1e6;
      out.push({ v, x: xOf(v), y1, y2, textY, text: formatNumber(v, dec) });
    }
    return out;
  }

  private waterfallFrame(spec: WaterfallSpec, box: WaterfallBox, fs: number): Frame {
    const t = this.texts(spec);
    const n = spec.parts.length + 2;
    const showAxis = spec.axis !== false;
    const axisH = showAxis ? fs * 1.9 : 0;
    const titleH = spec.title ? fs * 1.7 : 0;
    const rowsH = Math.max(n * fs * 1.5, box.h - axisH - titleH);
    const rowH = rowsH / n;
    const barH = Math.min(rowH * 0.66, fs * 1.8);
    const nameW = this.measure.maxWidth([...spec.parts.map((p) => p.label), t.baseLabel, t.totalLabel], 'wf-label', fs) + 10;
    const valueW = this.measure.maxWidth([...spec.parts.map((p) => signed(p.value)), t.baseText, t.totalText], 'wf-label', fs) + 10;
    const xa = box.x + nameW + 8;
    const xb = Math.max(xa + 40, box.x + box.w - valueW - 4);
    const [d0, d1] = spec.domain;
    const xOf = (v: number): number => xa + ((v - d0) / (d1 - d0 || 1)) * (xb - xa);
    const top = box.y + titleH;
    const rowTop = (r: number): number => top + r * rowH + (rowH - barH) / 2;
    const rowMid = (r: number): number => rowTop(r) + barH / 2;

    const names: NameGeom[] = [];
    const labels: LabelGeom[] = [];
    const segs: SegGeom[] = [];
    const links: Frame['links'] = [];
    names.push({ id: 'base', text: t.baseLabel, x: xa - 8, y: rowMid(0) });
    labels.push({ id: 'base', text: t.baseText, x: xOf(spec.base) + 6, y: rowMid(0), anchor: 'start', leader: null });
    let run = spec.base;
    spec.parts.forEach((p, i) => {
      const r = i + 1;
      const start = run;
      const end = run + p.value;
      run = end;
      const sign = p.value >= 0 ? 'pos' : 'neg';
      const lo = Math.min(start, end);
      const hi = Math.max(start, end);
      segs.push({ id: p.id, sign, start, end, lo, hi, path: arrowPath(xOf(lo), xOf(hi), rowTop(r), rowTop(r) + barH, sign) });
      names.push({ id: p.id, text: p.label, x: xa - 8, y: rowMid(r) });
      labels.push({ id: p.id, text: signed(p.value), x: xOf(hi) + 6, y: rowMid(r), anchor: 'start', leader: null });
      links.push({ id: `l${i}`, x: xOf(start), y1: rowTop(r - 1) + barH, y2: rowTop(r) });
    });
    const last = n - 1;
    links.push({ id: `l${spec.parts.length}`, x: xOf(spec.total), y1: rowTop(last - 1) + barH, y2: rowTop(last) });
    names.push({ id: 'total', text: t.totalLabel, x: xa - 8, y: rowMid(last) });
    labels.push({ id: 'total', text: t.totalText, x: xOf(spec.total) + 6, y: rowMid(last), anchor: 'start', leader: null });
    const axisY = top + rowsH;
    return {
      segs,
      labels,
      names,
      links,
      ticks: showAxis ? this.ticks(spec, xOf, top, axisY, axisY + fs * 1.3) : [],
      base: { x: xOf(spec.base), y1: top, y2: axisY, bar: { x: xOf(d0), y: rowTop(0), w: Math.max(1, xOf(spec.base) - xOf(d0)), h: barH } },
      total: { x: xOf(spec.total), y1: top, y2: axisY, bar: { x: xOf(d0), y: rowTop(last), w: Math.max(1, xOf(spec.total) - xOf(d0)), h: barH } },
      title: spec.title ? { x: box.x + 4, y: box.y + fs * 1.1 } : null,
      axisY: showAxis ? axisY : null,
      axisX: [xa, xb],
      height: titleH + rowsH + axisH,
    };
  }

  private forceFrame(spec: WaterfallSpec, box: WaterfallBox, fs: number): Frame {
    const t = this.texts(spec);
    const showAxis = spec.axis !== false;
    const pad = 8;
    const xa = box.x + pad;
    const xb = box.x + box.w - pad;
    const [d0, d1] = spec.domain;
    const xOf = (v: number): number => xa + ((v - d0) / (d1 - d0 || 1)) * (xb - xa);
    const lh = fs * 1.3;
    const bandH = Math.max(fs * 1.9, 24);
    const titleH = spec.title ? fs * 1.7 : 0;

    // value-space geometry: positive parts stack leftward from the total, negative ones rightward
    const segs: Omit<SegGeom, 'path'>[] = [];
    let left = spec.total;
    let right = spec.total;
    for (const p of spec.parts.filter((q) => q.value >= 0)) {
      segs.push({ id: p.id, sign: 'pos', start: left - p.value, end: left, lo: left - p.value, hi: left });
      left -= p.value;
    }
    for (const p of spec.parts.filter((q) => q.value < 0)) {
      segs.push({ id: p.id, sign: 'neg', start: right - p.value, end: right, lo: right, hi: right - p.value });
      right -= p.value;
    }

    // labels: base and positive parts above the bar, total and negative parts below it
    interface Item {
      id: string;
      text: string;
      cx: number;
      side: 'up' | 'down';
      l: number;
      r: number;
      anchor: 'start' | 'end';
      lane: number;
    }
    const items: Item[] = [];
    const add = (id: string, text: string, cx: number, side: 'up' | 'down'): void => {
      const w = this.measure.width(text, 'wf-label', fs);
      let anchor: 'start' | 'end' = 'start';
      let l = cx - 2;
      let r = cx + w + 2;
      if (r > box.x + box.w) {
        anchor = 'end';
        l = cx - w - 2;
        r = cx + 2;
      }
      if (l < box.x) {
        l = box.x;
        r = box.x + w + 4;
        anchor = 'start';
      }
      items.push({ id, text, cx, side, l, r, anchor, lane: 0 });
    };
    add('base', `${t.baseLabel} ${t.baseText}`, xOf(spec.base), 'up');
    add('total', `${t.totalLabel} ${t.totalText}`, xOf(spec.total), 'down');
    const byId = new Map(spec.parts.map((p) => [p.id, p]));
    for (const s of segs) {
      const p = byId.get(s.id)!;
      add(s.id, `${p.label} ${signed(p.value)}`, xOf((s.lo + s.hi) / 2), s.sign === 'pos' ? 'up' : 'down');
    }
    const lanes = { up: 0, down: 0 };
    for (const side of ['up', 'down'] as const) {
      const placed: Item[][] = [];
      for (const it of items.filter((q) => q.side === side).sort((a, b) => a.cx - b.cx)) {
        let k = 0;
        while (placed[k]?.some((o) => it.l < o.r + 8 && o.l < it.r + 8)) {
          k += 1;
        }
        (placed[k] ??= []).push(it);
        it.lane = k;
      }
      lanes[side] = placed.length;
    }

    const bandTop = box.y + titleH + lanes.up * lh + 6;
    const bandBot = bandTop + bandH;
    const axisY = bandBot + lanes.down * lh + 10;
    const labels: LabelGeom[] = items.map((it) => {
      const y = it.side === 'up' ? bandTop - 8 - it.lane * lh : bandBot + 6 + fs + it.lane * lh;
      const leader = it.side === 'up' ? { x: it.cx, y1: y + 3, y2: bandTop } : { x: it.cx, y1: bandBot, y2: y - fs };
      return { id: it.id, text: it.text, x: it.anchor === 'start' ? it.l + 2 : it.r - 2, y, anchor: it.anchor, leader };
    });
    return {
      segs: segs.map((s) => ({ ...s, path: arrowPath(xOf(s.lo), xOf(s.hi), bandTop, bandBot, s.sign) })),
      labels,
      names: [],
      links: [],
      ticks: showAxis ? this.ticks(spec, xOf, axisY, axisY + 5, axisY + 5 + fs * 1.2) : [],
      base: { x: xOf(spec.base), y1: bandTop - 3, y2: bandBot + 3, bar: null },
      total: { x: xOf(spec.total), y1: bandTop - 3, y2: bandBot + 3, bar: null },
      title: spec.title ? { x: box.x + 4, y: box.y + fs * 1.1 } : null,
      axisY: showAxis ? axisY : null,
      axisX: [xa, xb],
      height: axisY - box.y + (showAxis ? fs * 1.9 : 4),
    };
  }

  private draw(f: Frame, ms: number, spec: WaterfallSpec): void {
    const num = (v: number): string => String(Math.round(v * 1e6) / 1e6);

    // value axis
    const ticks = this.gAxis
      .selectAll<SVGGElement, TickGeom>('g.wf-tick-g')
      .data(f.ticks, (d) => String(d.v))
      .join((enter) => {
        const g = enter.append('g').attr('class', 'wf-tick-g');
        g.append('line').attr('class', 'wf-grid');
        g.append('text').attr('class', 'wf-tick').attr('text-anchor', 'middle');
        return g;
      });
    tr(ticks.select('line'), 'wf', ms)
      .attr('x1', (d) => r1((d as TickGeom).x))
      .attr('x2', (d) => r1((d as TickGeom).x))
      .attr('y1', (d) => r1((d as TickGeom).y1))
      .attr('y2', (d) => r1((d as TickGeom).y2));
    tr(ticks.select('text'), 'wf', ms)
      .attr('x', (d) => r1((d as TickGeom).x))
      .attr('y', (d) => r1((d as TickGeom).textY));
    ticks.select('text').text((d) => d.text);
    this.gAxis
      .selectAll<SVGLineElement, number>('line.wf-axis-line')
      .data(f.axisY === null ? [] : [f.axisY])
      .join('line')
      .attr('class', 'wf-axis-line')
      .attr('x1', r1(f.axisX[0]))
      .attr('x2', r1(f.axisX[1]))
      .attr('y1', (d) => r1(d))
      .attr('y2', (d) => r1(d));
    this.gAxis
      .selectAll<SVGTextElement, { x: number; y: number }>('text.wf-title')
      .data(f.title ? [f.title] : [])
      .join('text')
      .attr('class', 'wf-title')
      .attr('x', (d) => r1(d.x))
      .attr('y', (d) => r1(d.y))
      .text(spec.title ?? '');

    // connectors (waterfall mode)
    const links = this.gLinks
      .selectAll<SVGLineElement, Frame['links'][number]>('line.wf-link')
      .data(f.links, (d) => d.id)
      .join('line')
      .attr('class', 'wf-link');
    tr(links, 'wf', ms)
      .attr('x1', (d) => r1(d.x))
      .attr('x2', (d) => r1(d.x))
      .attr('y1', (d) => r1(d.y1))
      .attr('y2', (d) => r1(d.y2));

    // base and total marks
    const mark = (cls: string, m: Mark, barCls: string, lineCls: string): void => {
      const g = this.gMarks
        .selectAll<SVGGElement, Mark>(`g.${cls}`)
        .data([m])
        .join((enter) => {
          const e = enter.append('g').attr('class', cls);
          e.append('rect').attr('class', barCls).attr('rx', 3);
          e.append('line').attr('class', lineCls);
          return e;
        });
      tr(g.select('line'), 'wf', ms)
        .attr('x1', (d) => r1((d as Mark).x))
        .attr('x2', (d) => r1((d as Mark).x))
        .attr('y1', (d) => r1((d as Mark).y1))
        .attr('y2', (d) => r1((d as Mark).y2));
      g.select<SVGRectElement>('rect')
        .attr('display', (d) => (d.bar ? null : 'none'))
        .attr('x', (d) => r1(d.bar?.x ?? 0))
        .attr('y', (d) => r1(d.bar?.y ?? 0))
        .attr('width', (d) => r1(d.bar?.w ?? 0))
        .attr('height', (d) => r1(d.bar?.h ?? 0));
    };
    mark('wf-base', f.base, 'wf-start', 'wf-base-line');
    mark('wf-total', f.total, 'wf-total-bar', 'wf-total-line');

    // parts
    const segs = this.gSegs
      .selectAll<SVGPathElement, SegGeom>('path.wf-seg')
      .data(f.segs, (d) => d.id)
      .join((enter) => enter.append('path').attr('class', 'wf-seg').attr('d', (d) => d.path));
    segs
      .attr('data-id', (d) => d.id)
      .attr('data-sign', (d) => d.sign)
      .attr('data-start', (d) => num(d.start))
      .attr('data-end', (d) => num(d.end))
      .attr('data-tiny', (d) => (Math.abs(d.end - d.start) < TINY ? 'true' : 'false'));
    tr(segs, 'wf', ms).attr('d', (d) => (d as SegGeom).path);

    // value labels, leaders and row names
    const leaders = this.gLabels
      .selectAll<SVGLineElement, LabelGeom>('line.wf-leader')
      .data(
        f.labels.filter((l) => l.leader),
        (d) => d.id,
      )
      .join('line')
      .attr('class', 'wf-leader')
      .attr('x1', (d) => r1(d.leader!.x))
      .attr('x2', (d) => r1(d.leader!.x))
      .attr('y1', (d) => r1(d.leader!.y1))
      .attr('y2', (d) => r1(d.leader!.y2));
    leaders.lower();
    const labels = this.gLabels
      .selectAll<SVGTextElement, LabelGeom>('text.wf-label')
      .data(f.labels, (d) => d.id)
      .join('text')
      .attr('class', 'wf-label')
      .attr('data-id', (d) => d.id)
      .attr('text-anchor', (d) => d.anchor)
      .attr('dy', '0.35em')
      .text((d) => d.text);
    tr(labels, 'wf', ms)
      .attr('x', (d) => r1((d as LabelGeom).x))
      .attr('y', (d) => r1((d as LabelGeom).y));
    this.gLabels
      .selectAll<SVGTextElement, NameGeom>('text.wf-name')
      .data(f.names, (d) => d.id)
      .join('text')
      .attr('class', 'wf-name')
      .attr('data-id', (d) => d.id)
      .attr('text-anchor', 'end')
      .attr('dy', '0.35em')
      .attr('x', (d) => r1(d.x))
      .attr('y', (d) => r1(d.y))
      .text((d) => d.text);
  }
}
