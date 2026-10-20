import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import type { Mode } from '../../core/mode';
import { MARK, NAVY, TEXT, r1 } from '../../core/plot/marks';
import { TextMeasure } from '../../core/plot/text-measure';
import { tr } from '../../core/plot/transition';
import type { Natural } from './bayes';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Transition name of the negatives' fade (interrupted on every update). */
const ICONS_T = 'icons';
const COLS = 50;
const ROWS = 20;
/** Opacity of the negatives once only the positives count (reveal 2). */
const FADED = 0.15;
/** Body font px when computed styles are unavailable (theme.css at 1280 px). */
const BODY_FALLBACK: Record<Mode, number> = { ders: 23, lab: 16 };
const SOFT_ORANGE = '#F4AA4F';
const GREY = '#93A3B5';
const MUTED = '#3F526A';

/** Grid order: sick-positive, sick-negative, healthy-positive, healthy-negative. */
type Kind = 'tp' | 'fn' | 'fp' | 'tn';
const KINDS: readonly Kind[] = ['tp', 'fn', 'fp', 'tn'];
const NEGATIVE: Record<Kind, boolean> = { tp: false, fn: true, fp: false, tn: true };

/** Sick = ▲, healthy = ●; positive = filled, negative = outline. Before the test only sick/healthy shows. */
interface Look { tri: boolean; fill: string | null; stroke: string | null; text: string }
function look(k: Kind, tested: boolean): Look {
  if (!tested) {
    return k === 'tp' || k === 'fn'
      ? { tri: true, fill: MARK[1], stroke: null, text: TEXT[1] }
      : { tri: false, fill: null, stroke: GREY, text: MUTED };
  }
  switch (k) {
    case 'tp': return { tri: true, fill: MARK[1], stroke: null, text: TEXT[1] };
    case 'fn': return { tri: true, fill: null, stroke: SOFT_ORANGE, text: TEXT[1] };
    case 'fp': return { tri: false, fill: NAVY, stroke: null, text: NAVY };
    default: return { tri: false, fill: null, stroke: GREY, text: MUTED };
  }
}

/** Legend wording per slot; before the test, slot 0 is every sick person and slot 2 every healthy one. */
function legendText(k: Kind, tested: boolean): string | null {
  if (!tested) return k === 'tp' ? 'hasta' : k === 'fp' ? 'sağlıklı' : null;
  return { tp: 'hasta, pozitif', fn: 'hasta, negatif', fp: 'sağlıklı, pozitif', tn: 'sağlıklı, negatif' }[k];
}

interface Layout {
  cell: number;
  grid: { left: number; top: number };
  /** Top-left of each legend slot (KINDS order). */
  slots: { x: number; y: number }[];
  itemH: number;
  swatch: number;
  fs: number;
}

/**
 * Icon shape inside a cell of size `c` centred at (x, y): circle diameter and
 * triangle width ≈ 0.84 c, so a 12 px cell still gives a ≥ 10 px mark and a
 * 17 px cell (1280×720 Ders) a ≈ 14 px one.
 */
function tracePath(ctx: CanvasRenderingContext2D, tri: boolean, x: number, y: number, c: number, inset: number): void {
  if (tri) {
    const hw = c * 0.46 - inset;
    const hh = c * 0.4 - inset;
    ctx.moveTo(x, y - hh);
    ctx.lineTo(x + hw, y + hh);
    ctx.lineTo(x - hw, y + hh);
    ctx.closePath();
  } else {
    const r = c * 0.42 - inset;
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
}

/** SVG path of the same icon, centred on 0,0 (legend swatches). */
function swatchPath(tri: boolean, c: number, inset: number): string {
  if (tri) {
    const hw = c * 0.46 - inset;
    const hh = c * 0.4 - inset;
    return `M0,${r1(-hh)}L${r1(hw)},${r1(hh)}L${r1(-hw)},${r1(hh)}Z`;
  }
  const r = r1(c * 0.42 - inset);
  return `M${r},0A${r},${r} 0 1 1 ${-r},0A${r},${r} 0 1 1 ${r},0Z`;
}

/**
 * The 1.000-person table: 50 × 20 icons on two canvases (positives and
 * negatives, so the reveal-2 fade is a CSS opacity transition with no repaint)
 * and an SVG legend whose `text.icon-count` lines carry the counts. Icons are
 * repainted only when the counts, the tested/untested look, the cell size or
 * the device pixel ratio change; every repaint is one `icons` measure.
 * `canvas.icons` carries `data-cell-px`, the CSS px of one grid cell.
 */
export class IconsLayer {
  readonly pos: HTMLCanvasElement;
  readonly neg: HTMLCanvasElement;
  private readonly ctxPos: CanvasRenderingContext2D | null;
  private readonly ctxNeg: CanvasRenderingContext2D | null;
  private readonly svgEl: SVGSVGElement;
  private readonly items: {
    g: Selection<SVGGElement, unknown, null, undefined>;
    sw: Selection<SVGPathElement, unknown, null, undefined>;
    text: Selection<SVGTextElement, unknown, null, undefined>;
    n: Selection<SVGTSpanElement, unknown, null, undefined>;
    label: Selection<SVGTSpanElement, unknown, null, undefined>;
  }[];
  private readonly measure: TextMeasure;
  private size: { w: number; h: number; mode: Mode } | null = null;
  private layout: Layout | null = null;
  private paintKey = '';
  private faded: boolean | null = null;

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    const canvas = (cls: string): HTMLCanvasElement => {
      const c = doc.createElement('canvas');
      c.className = cls;
      c.setAttribute('aria-hidden', 'true');
      return c;
    };
    this.neg = canvas('icons-neg');
    this.pos = canvas('icons');
    this.ctxNeg = this.neg.getContext('2d');
    this.ctxPos = this.pos.getContext('2d');
    this.svgEl = doc.createElementNS(SVG_NS, 'svg');
    this.svgEl.setAttribute('class', 'icon-legend');
    this.svgEl.setAttribute('role', 'img');
    this.svgEl.setAttribute('aria-label', '1.000 kişilik tablo');
    host.append(this.neg, this.pos, this.svgEl);

    const svg = select(this.svgEl);
    this.items = KINDS.map((k) => {
      const g = svg.append('g').attr('class', `legend-item ${k}`);
      const sw = g.append('path').attr('class', 'swatch');
      const text = g.append('text').attr('class', 'icon-count');
      const n = text.append('tspan').attr('class', 'n');
      const label = text.append('tspan');
      return { g, sw, text, n, label };
    });
    const probe = svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
  }

  /** Area (CSS px) and mode; the layout is recomputed on the next update when they change. */
  resize(w: number, h: number, mode: Mode): void {
    const s = this.size;
    if (s && s.w === w && s.h === h && s.mode === mode) return;
    this.size = { w, h, mode };
    this.layout = null;
  }

  /** Cancels the running negatives fade (the caller re-renders right after). */
  interrupt(): void {
    select(this.neg).interrupt(ICONS_T);
    for (const it of this.items) it.sw.interrupt(ICONS_T);
  }

  /** Renders the counts; `ms` (already scaled) animates the reveal-2 fade, 0 jumps. */
  update(v: { natural: Natural; reveal: 0 | 1 | 2 }, ms: number): void {
    if (!this.size) return;
    const { natural: n, reveal } = v;
    this.interrupt();
    if (!this.layout) this.layout = this.computeLayout();
    const L = this.layout;
    const tested = reveal > 0;
    const counts: Record<Kind, number> = { tp: n.tp, fn: n.fn, fp: n.fp, tn: n.tn };

    // ---- legend
    const swInset = 1;
    KINDS.forEach((k, i) => {
      const it = this.items[i];
      const text = legendText(k, tested);
      it.g.attr('display', text === null ? 'none' : null);
      if (text === null) return;
      const lk = look(k, tested);
      const slot = L.slots[i];
      it.g.attr('transform', `translate(${r1(slot.x)},${r1(slot.y)})`);
      it.sw
        .attr('d', swatchPath(lk.tri, L.swatch, lk.stroke ? swInset : 0))
        .attr('transform', `translate(${r1(L.swatch / 2)},${r1(L.itemH / 2)})`)
        .attr('fill', lk.fill ?? 'none')
        .attr('stroke', lk.stroke)
        .attr('stroke-width', lk.stroke ? 2 : null);
      const count = tested ? counts[k] : k === 'tp' ? n.sick : n.healthy;
      it.text
        .attr('x', r1(L.swatch + L.fs * 0.45))
        .attr('y', r1(L.itemH / 2 + L.fs * 0.35))
        .attr('fill', lk.text);
      it.n.text(String(count));
      it.label.text(` ${text}`);
    });

    // ---- icons (repaint only when something visible changed)
    const dpr = globalThis.devicePixelRatio || 1;
    const key = [L.cell, dpr, n.tp, n.fn, n.fp, n.tn, tested].join('|');
    if (key !== this.paintKey) {
      this.paintKey = key;
      this.paint(L, counts, tested, dpr);
    }

    // ---- reveal 2: negatives fade (CSS opacity: no repaint per frame)
    const faded = reveal === 2;
    const target = String(faded ? FADED : 1);
    const negItems = this.items.filter((_, i) => NEGATIVE[KINDS[i]]).map((it) => it.sw);
    if (faded !== this.faded && ms > 0 && this.faded !== null) {
      tr(select(this.neg), ICONS_T, ms).style('opacity', target);
      for (const sw of negItems) tr(sw, ICONS_T, ms).attr('opacity', target);
    } else {
      this.neg.style.opacity = target;
      for (const sw of negItems) sw.attr('opacity', target);
    }
    this.faded = faded;
  }

  destroy(): void {
    this.interrupt();
    this.pos.remove();
    this.neg.remove();
    this.svgEl.remove();
  }

  private computeLayout(): Layout {
    const { w, h, mode } = this.size!;
    const fs = this.measure.fontPx('icon-count', BODY_FALLBACK[mode]);
    const pad = 12;
    const itemH = Math.round(fs * 1.35);
    const swatch = Math.round(fs * 0.85);
    // widest possible entry, so the layout does not move while counts change
    const textW = this.measure.width('0000 sağlıklı, negatif', 'icon-count', fs);
    const iw = Math.ceil(swatch + fs * 0.45 + textW);
    const colGap = Math.round(fs * 1.2);
    const gap = Math.round(fs * 0.6);
    const aw = Math.max(1, w - 2 * pad);
    const ah = Math.max(1, h - 2 * pad);

    // option A: legend rows above the grid (4, 2 or 1 per row)
    let cols = 1;
    for (const c of [4, 2]) if (c * iw + (c - 1) * colGap <= aw) { cols = c; break; }
    const legendH = (KINDS.length / cols) * itemH;
    const cellTop = Math.min(aw / COLS, (ah - legendH - gap) / ROWS);
    // option B: one legend column beside the grid
    const cellSide = Math.min((aw - iw - colGap) / COLS, ah / ROWS);
    const side = cellSide > cellTop;
    const cell = Math.max(1, Math.floor(side ? cellSide : cellTop));
    const gw = COLS * cell;
    const gh = ROWS * cell;

    let grid: { left: number; top: number };
    let slots: { x: number; y: number }[];
    if (side) {
      const bw = gw + colGap + iw;
      grid = { left: Math.round((w - bw) / 2), top: Math.round((h - gh) / 2) };
      const ly = grid.top + (gh - KINDS.length * itemH) / 2;
      slots = KINDS.map((_, i) => ({ x: grid.left + gw + colGap, y: ly + i * itemH }));
    } else {
      const bh = legendH + gap + gh;
      const top = Math.round((h - bh) / 2);
      grid = { left: Math.round((w - gw) / 2), top: top + legendH + gap };
      const lw = cols * iw + (cols - 1) * colGap;
      const lx = Math.round((w - lw) / 2);
      slots = KINDS.map((_, i) => ({ x: lx + (i % cols) * (iw + colGap), y: top + Math.floor(i / cols) * itemH }));
    }

    this.svgEl.setAttribute('width', String(w));
    this.svgEl.setAttribute('height', String(h));
    for (const c of [this.pos, this.neg]) {
      Object.assign(c.style, { left: `${grid.left}px`, top: `${grid.top}px`, width: `${gw}px`, height: `${gh}px` });
    }
    this.pos.dataset.cellPx = String(Math.round(cell));
    this.paintKey = ''; // new cell size: repaint
    return { cell, grid, slots, itemH, swatch, fs };
  }

  private paint(L: Layout, counts: Record<Kind, number>, tested: boolean, dpr: number): void {
    const ctxPos = this.ctxPos;
    const ctxNeg = this.ctxNeg;
    if (!ctxPos || !ctxNeg) return;
    const perf = typeof performance !== 'undefined' && typeof performance.mark === 'function' ? performance : null;
    perf?.mark('icons-start');

    const c = L.cell;
    const bw = Math.max(1, Math.round(COLS * c * dpr));
    const bh = Math.max(1, Math.round(ROWS * c * dpr));
    for (const [cv, ctx] of [[this.pos, ctxPos], [this.neg, ctxNeg]] as const) {
      if (cv.width !== bw || cv.height !== bh) {
        cv.width = bw;
        cv.height = bh;
      } else {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, bw, bh);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const lw = Math.max(1.5, c * 0.1);
    let i = 0;
    for (const k of KINDS) {
      const lk = look(k, tested);
      const ctx = NEGATIVE[k] ? ctxNeg : ctxPos;
      const inset = lk.stroke ? lw / 2 : 0;
      ctx.beginPath();
      for (let end = i + counts[k]; i < end; i++) {
        const x = (i % COLS) * c + c / 2;
        const y = Math.floor(i / COLS) * c + c / 2;
        tracePath(ctx, lk.tri, x, y, c, inset);
      }
      if (lk.fill) {
        ctx.fillStyle = lk.fill;
        ctx.fill();
      } else if (lk.stroke) {
        ctx.strokeStyle = lk.stroke;
        ctx.lineWidth = lw;
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
    }

    if (perf) {
      perf.measure('icons', 'icons-start');
      perf.clearMarks('icons-start');
    }
  }
}
