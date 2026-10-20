import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import type { Mode } from '../../core/mode';
import { GRID, MARK, NAVY, TEXT, WHITE, r1 } from '../../core/plot/marks';
import { TextMeasure, type Fonts } from '../../core/plot/text-measure';
import { tr } from '../../core/plot/transition';
import { pct, type NbView } from './view';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Transition name of the bar, trail and chips (interrupted on every update). */
const BAR_T = 'bar';
/** Body font px when computed styles are unavailable (theme.css at 1280 px). */
const BODY_FALLBACK: Record<Mode, number> = { ders: 23, lab: 16 };
const NULL_GREY = '#C9D5E3';
const GHOST = '#6B7F95';
/** The trail keeps room for the story's five points (prior + four words), so dots do not jump. */
const MIN_SLOTS = 5;

/** Class names in index order (0 = teal ●, 1 = orange ▲) per part. */
const CLASSES: Record<2 | 3, readonly [string, string]> = {
  2: ['Normal', 'Spam'],
  3: ['Kaldı', 'Ayrıldı'],
};

interface Pt { x: number; y: number; v: number | null; i: number }
type Sel<E extends Element> = Selection<E, unknown, null, undefined>;

/** Leading run of non-null trail values (the polyline stops where the posterior becomes undefined). */
function leadingRun(vals: (number | null)[]): number {
  let n = 0;
  while (n < vals.length && vals[n] !== null) n++;
  return n;
}

const pointsAttr = (pts: { x: number; y: number }[]): string => pts.map((p) => `${r1(p.x)},${r1(p.y)}`).join(' ');

/**
 * The sliding probability bar (one component for parts 2 and 3): word chips
 * on top (the newest `.now`), the class names and a big "P(spam) = %…" label,
 * the two-colour bar (`rect.bar-spam` = class 1 from the left, `rect.bar-normal`
 * the rest; a grey `rect.bar-null` at 50 % when the posterior is undefined),
 * and in part 2 the trail: one dot per prior/word, a polyline through them and
 * at the order step a faint ghost of the original order. Part 3 draws only the
 * labels and the bar. Pure SVG; text sizes come from the --fs-* tokens.
 */
export class BarLayer {
  readonly svgEl: SVGSVGElement;
  private readonly svg: Sel<SVGSVGElement>;
  private readonly gChips: Sel<SVGGElement>;
  private readonly cls: [Sel<SVGTextElement>, Sel<SVGTextElement>];
  private readonly pctText: Sel<SVGTextElement>;
  private readonly rSpam: Sel<SVGRectElement>;
  private readonly rNormal: Sel<SVGRectElement>;
  private readonly rNull: Sel<SVGRectElement>;
  private readonly mid: Sel<SVGLineElement>;
  private readonly frame: Sel<SVGRectElement>;
  private readonly gTrail: Sel<SVGGElement>;
  private readonly gGrid: Sel<SVGGElement>;
  private readonly gGhost: Sel<SVGGElement>;
  private readonly line: Sel<SVGPolylineElement>;
  private readonly gDots: Sel<SVGGElement>;
  private readonly gLabels: Sel<SVGGElement>;
  private readonly gX: Sel<SVGGElement>;
  private readonly measure: TextMeasure;
  private size: { w: number; h: number; mode: Mode } | null = null;
  private fonts: (Fonts & { body: number }) | null = null;
  private widths = new Map<string, number>();
  /** Trail drawn last: lets a one-word growth start its new segment at the old end. */
  private shown: { x: number; y: number }[] = [];

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.svgEl = doc.createElementNS(SVG_NS, 'svg');
    this.svgEl.setAttribute('class', 'bar-plot');
    this.svgEl.setAttribute('role', 'img');
    this.svgEl.setAttribute('aria-label', 'Olasılık çubuğu');
    host.append(this.svgEl);
    const svg = select(this.svgEl);
    this.svg = svg;
    this.gChips = svg.append('g').attr('class', 'chips');
    this.cls = [
      svg.append('text').attr('class', 'bar-class c0').attr('text-anchor', 'end').attr('fill', TEXT[0]),
      svg.append('text').attr('class', 'bar-class c1').attr('fill', TEXT[1]),
    ];
    this.pctText = svg.append('text').attr('class', 'prediction bar-pct').attr('text-anchor', 'middle').attr('fill', NAVY);
    this.rSpam = svg.append('rect').attr('class', 'bar-spam').attr('fill', MARK[1]);
    this.rNormal = svg.append('rect').attr('class', 'bar-normal').attr('fill', MARK[0]);
    this.rNull = svg.append('rect').attr('class', 'bar-null').attr('fill', NULL_GREY);
    this.mid = svg.append('line').attr('class', 'bar-mid').attr('stroke', NAVY).attr('stroke-width', 2)
      .attr('stroke-dasharray', '6 4');
    this.frame = svg.append('rect').attr('class', 'bar-frame').attr('fill', 'none').attr('stroke', NAVY)
      .attr('stroke-width', 2).attr('rx', 6);
    this.gTrail = svg.append('g').attr('class', 'trail-plot');
    this.gGrid = this.gTrail.append('g').attr('class', 'trail-grid');
    this.gGhost = this.gTrail.append('g').attr('class', 'ghosts');
    this.line = this.gTrail.append('polyline').attr('class', 'trail').attr('fill', 'none')
      .attr('stroke', MARK[1]).attr('stroke-width', 4).attr('stroke-linejoin', 'round');
    this.gDots = this.gTrail.append('g').attr('class', 'trail-dots');
    this.gLabels = this.gTrail.append('g').attr('class', 'trail-labels');
    this.gX = this.gTrail.append('g').attr('class', 'trail-x');
    const probe = svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
  }

  /** Area (CSS px) and mode; fonts are re-read when they change. */
  resize(w: number, h: number, mode: Mode): void {
    const s = this.size;
    if (s && s.w === w && s.h === h && s.mode === mode) return;
    if (!s || s.mode !== mode) {
      this.fonts = null;
      this.widths.clear();
    }
    this.size = { w, h, mode };
    this.svgEl.setAttribute('width', String(w));
    this.svgEl.setAttribute('height', String(h));
  }

  /** Cancels running transitions (the caller re-renders right after). */
  interrupt(): void {
    this.svg.selectAll('*').interrupt(BAR_T);
  }

  /** Renders `v` (part 2 or 3); `ms` (already scaled) animates, 0 jumps. */
  update(v: NbView, ms: number): void {
    if (!this.size || !v.bar) return;
    this.interrupt();
    const { w, h, mode } = this.size;
    if (!this.fonts) this.fonts = { ...this.measure.fonts(mode), body: this.measure.fontPx('chip-text', BODY_FALLBACK[mode]) };
    const F = this.fonts;
    const part = v.part === 3 ? 3 : 2;
    const padX = 16;
    const gapY = Math.round(F.body * 0.5);
    let y = 12;

    // ---- word chips (part 2): flow rows, the newest word is `.now`
    const words = part === 2 ? v.words : [];
    if (part === 2) y = this.drawChips(words, padX, y, w - padX, F.body, ms) + gapY;

    // ---- class names and the big percentage label on one baseline
    const base = y + Math.round(F.title * 0.85);
    const names = CLASSES[part];
    this.cls[1].attr('x', padX).attr('y', base).text(`▲ ${names[1]}`);
    this.cls[0].attr('x', w - padX).attr('y', base).text(`● ${names[0]}`);
    const p = v.bar.spam;
    this.pctText.attr('x', r1(w / 2)).attr('y', base).text(p === null ? `${v.bar.label} tanımsız` : `${v.bar.label} = ${pct(p)}`);

    // ---- the bar
    const barY = base + gapY;
    const barH = Math.round(F.body * 1.6);
    const barW = Math.max(1, w - 2 * padX);
    const spamW = p === null ? 0 : p * barW;
    for (const r of [this.rSpam, this.rNormal, this.rNull, this.frame]) r.attr('y', barY).attr('height', barH);
    this.frame.attr('x', padX).attr('width', barW);
    this.rNull.attr('x', padX).attr('width', barW).attr('display', p === null ? null : 'none');
    this.mid.attr('x1', r1(padX + barW / 2)).attr('x2', r1(padX + barW / 2))
      .attr('y1', barY - 4).attr('y2', barY + barH + 4).attr('display', p === null ? null : 'none');
    this.rSpam.attr('x', padX).attr('display', p === null ? 'none' : null);
    this.rNormal.attr('display', p === null ? 'none' : null);
    if (p !== null) {
      tr(this.rSpam, BAR_T, ms).attr('width', r1(spamW));
      tr(this.rNormal, BAR_T, ms).attr('x', r1(padX + spamW)).attr('width', r1(barW - spamW));
    }

    // ---- the trail (part 2 only)
    const top = barY + barH + gapY * 2;
    this.gTrail.attr('display', part === 2 ? null : 'none');
    if (part === 2) this.drawTrail(v, padX, top, w - padX, h - 12, ms);
    else this.clearTrail();
  }

  destroy(): void {
    this.interrupt();
    this.svgEl.remove();
  }

  private width(text: string, cls: string, px: number): number {
    const key = `${cls}|${text}`;
    let wd = this.widths.get(key);
    if (wd === undefined) {
      wd = this.measure.width(text, cls, px);
      this.widths.set(key, wd);
    }
    return wd;
  }

  /** Lays the chips out in rows from (x0, y0); returns the bottom of the chip area (one row at least). */
  private drawChips(words: string[], x0: number, y0: number, x1: number, fs: number, ms: number): number {
    const chipH = Math.round(fs * 1.6);
    const padIn = Math.round(fs * 0.6);
    const arrowW = this.width('→', 'chip-arrow', fs) + fs * 0.6;
    const rowGap = Math.round(fs * 0.35);
    let x = x0;
    let row = 0;
    const boxes = words.map((word, i) => {
      const cw = Math.ceil(this.width(word, 'chip-text', fs) + 2 * padIn);
      const lead = i === 0 ? 0 : arrowW;
      if (i > 0 && x + lead + cw > x1) {
        row++;
        x = x0;
      } else x += lead;
      const b = { word, i, x, y: y0 + row * (chipH + rowGap), w: cw, arrow: i > 0 && x !== x0 };
      x += cw;
      return b;
    });
    type B = (typeof boxes)[number];
    const now = words.length - 1;
    const chips = this.gChips.selectAll<SVGGElement, B>('g.chip').data(boxes, (b) => `${b.i}|${b.word}`).join(
      (enter) => {
        const g = enter.append('g').attr('class', 'chip').attr('opacity', ms > 0 ? 0 : 1);
        g.append('rect').attr('rx', chipH / 2).attr('stroke', NAVY).attr('stroke-width', 2);
        g.append('text').attr('class', 'chip-text').attr('text-anchor', 'middle');
        return g;
      },
      (update) => update,
      (exit) => exit.remove(),
    );
    chips.classed('now', (b) => b.i === now)
      .attr('transform', (b) => `translate(${r1(b.x)},${r1(b.y)})`);
    chips.select('rect').attr('width', (b) => b.w).attr('height', chipH)
      .attr('fill', (b) => (b.i === now ? NAVY : WHITE));
    chips.select('text').attr('x', (b) => r1(b.w / 2)).attr('y', r1(chipH / 2 + fs * 0.35))
      .attr('fill', (b) => (b.i === now ? WHITE : NAVY)).text((b) => b.word);
    tr(chips, BAR_T, ms).attr('opacity', 1);

    this.gChips.selectAll<SVGTextElement, B>('text.chip-arrow').data(boxes.filter((b) => b.arrow)).join('text')
      .attr('class', 'chip-arrow').attr('text-anchor', 'middle').attr('fill', NAVY)
      .attr('x', (b) => r1(b.x - arrowW / 2)).attr('y', (b) => r1(b.y + chipH / 2 + fs * 0.35)).text('→');

    const rows = boxes.length === 0 ? 1 : row + 1;
    return y0 + rows * chipH + (rows - 1) * rowGap;
  }

  private drawTrail(v: NbView, x0: number, y0: number, x1: number, y1: number, ms: number): void {
    const F = this.fonts!;
    const vals = v.trail;
    const ghost = v.ghost;
    const slots = Math.max(MIN_SLOTS, vals.length, ghost?.length ?? 0);
    const tickW = Math.max(...['%0', '%50', '%100'].map((t) => this.width(t, 'tick', F.tick)));
    const left = x0 + tickW + 10;
    const plotTop = y0 + Math.round(F.body * 1.3);
    const xLabelY = y1 - Math.round(F.tick * 0.3);
    const plotBottom = Math.max(plotTop + 20, xLabelY - Math.round(F.tick * 1.2) - Math.round(F.body * 1.6));
    const slotW = Math.max(1, (x1 - left) / slots);
    const X = (i: number): number => left + (i + 0.5) * slotW;
    const Y = (p: number): number => plotBottom - p * (plotBottom - plotTop);
    const r = Math.max(6, Math.round(F.body * 0.32));

    // grid: %0, %50, %100
    const ticks = [0, 0.5, 1];
    this.gGrid.selectAll('line').data(ticks).join('line')
      .attr('x1', left).attr('x2', x1).attr('y1', (t) => r1(Y(t))).attr('y2', (t) => r1(Y(t)))
      .attr('stroke', GRID).attr('stroke-width', (t) => (t === 0.5 ? 1 : 2));
    this.gGrid.selectAll('text').data(ticks).join('text')
      .attr('class', 'tick').attr('text-anchor', 'end').attr('x', left - 10)
      .attr('y', (t) => r1(Y(t) + F.tick * 0.35)).text((t) => (t === 0 ? '%0' : t === 1 ? '%100' : '%50'));

    const pts: Pt[] = vals.map((p, i) => ({ x: X(i), y: Y(p ?? 0.5), v: p, i }));
    const run = leadingRun(vals);
    const linePts = pts.slice(0, run);

    // ghost of the original order (step 8): faint, behind the trail
    const gp = ghost ? ghost.slice(0, leadingRun(ghost)).map((p, i) => ({ x: X(i), y: Y(p!) })) : [];
    this.gGhost.selectAll<SVGPolylineElement, string>('polyline.ghost').data(ghost ? [pointsAttr(gp)] : []).join(
      (enter) => enter.append('polyline').attr('class', 'ghost').attr('fill', 'none').attr('stroke', GHOST)
        .attr('stroke-width', 3).attr('stroke-dasharray', '8 6').attr('opacity', 0),
      (update) => update,
      (exit) => exit.remove(),
    ).attr('points', (d) => d).call((s) => { tr(s, BAR_T, ms).attr('opacity', 0.45); });

    // trail line: a one-word growth starts with the new point on the old end, then slides out
    const prev = this.shown;
    const grow = ms > 0 && linePts.length === prev.length + 1 && prev.length > 0
      && prev.every((q, i) => Math.abs(q.x - linePts[i].x) < 0.5 && Math.abs(q.y - linePts[i].y) < 0.5);
    const final = pointsAttr(linePts);
    if (grow) {
      this.line.attr('points', pointsAttr([...prev, prev[prev.length - 1]]));
      tr(this.line, BAR_T, ms).attr('points', final);
    } else if (ms > 0 && linePts.length === prev.length && prev.length > 1) {
      tr(this.line, BAR_T, ms).attr('points', final);
    } else this.line.attr('points', final);
    this.shown = linePts.map(({ x, y }) => ({ x, y }));

    // dots: a new dot rises from the previous one (cx/cy, not transforms: cheap to tween)
    const prevPt = (d: Pt): Pt => (d.i > 0 && ms > 0 ? pts[d.i - 1] : d);
    const dots = this.gDots.selectAll<SVGCircleElement, Pt>('circle.trail-dot').data(pts, (d) => d.i).join(
      (enter) => enter.append('circle').attr('cx', (d) => r1(prevPt(d).x)).attr('cy', (d) => r1(prevPt(d).y)),
      (update) => update,
      (exit) => exit.remove(),
    );
    dots.attr('class', (d) => (d.v === null ? 'trail-dot null' : 'trail-dot'))
      .attr('r', (d) => (d.i === pts.length - 1 ? r + 2 : r))
      .attr('fill', (d) => (d.v === null ? NULL_GREY : MARK[1]))
      .attr('stroke', WHITE).attr('stroke-width', 2);
    tr(dots, BAR_T, ms).attr('cx', (d) => r1(d.x)).attr('cy', (d) => r1(d.y));

    // value labels kept off the line: above the dot unless a segment rises steeply out
    // of it; below at a valley; beside it (on the free side) where the line passes through
    const place = (d: Pt): { x: number; y: number; side: boolean } => {
      const p = d.v ?? 0.5;
      const nb = (q: Pt | undefined): number | null => (q ? q.v ?? 0.5 : null);
      const [a, b] = [nb(pts[d.i - 1]), nb(pts[d.i + 1])];
      const steep = (q: number | null, dir: 1 | -1): boolean => q !== null && dir * (q - p) > 0.15;
      const above = d.y - r - F.body * 0.3;
      const under = d.y + r + F.body * 0.95;
      if (!steep(a, 1) && !steep(b, 1)) return { x: d.x, y: above, side: false };
      if (!steep(a, -1) && !steep(b, -1)) return { x: d.x, y: under, side: false };
      // rising through the dot: lower right is free; falling: upper right
      const rising = a !== null && a < p;
      return { x: d.x + r + 6, y: rising ? d.y + r + F.body * 0.6 : d.y - r, side: true };
    };
    const lx = (d: Pt): number => r1(place(d).x);
    const ly = (d: Pt): number => r1(place(d).y);
    const labels = this.gLabels.selectAll<SVGTextElement, Pt>('text.trail-label').data(pts, (d) => d.i).join(
      (enter) => enter.append('text').attr('class', 'trail-label')
        .attr('fill', NAVY).attr('x', lx).attr('y', ly).attr('opacity', ms > 0 ? 0 : 1),
      (update) => update,
      (exit) => exit.remove(),
    );
    labels.attr('text-anchor', (d) => (place(d).side ? 'start' : 'middle'))
      .text((d) => (d.v === null ? '—' : pct(d.v)));
    tr(labels, BAR_T, ms).attr('x', lx).attr('y', ly).attr('opacity', 1);

    // x labels: öncül, then the words in e-mail order
    this.gX.selectAll<SVGTextElement, Pt>('text').data(pts, (d) => d.i).join('text')
      .attr('class', 'tick trail-x').attr('text-anchor', 'middle')
      .attr('x', (d) => r1(d.x)).attr('y', xLabelY)
      .text((d) => (d.i === 0 ? 'öncül' : v.words[d.i - 1]));
  }

  private clearTrail(): void {
    this.line.attr('points', '');
    this.shown = [];
    for (const g of [this.gGhost, this.gDots, this.gLabels, this.gX]) g.selectAll('*').remove();
  }
}
