import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import type { Mode } from '../../core/mode';
import { r1 } from '../../core/plot/marks';
import { lineScale, NumberLineLayer, staggerRows } from '../../core/plot/number-line';
import { TextMeasure } from '../../core/plot/text-measure';
import { tr, type AnySel } from '../../core/plot/transition';
import { CUSTOMERS } from './data';
import type { OlcView, ScalerLine } from './view';

/** Transition name of every move/fade in this layer (interrupted on each update). */
const TN = 'olc-scalers';
const SVGNS = 'http://www.w3.org/2000/svg';
const KEYS = ['standard', 'minmax', 'robust'] as const;

type G = Selection<SVGGElement, unknown, null, undefined>;
interface Lay { w: number; h: number }
interface Lbl { j: number; text: string; cx: number; w: number; side: 1 | -1; row: number }
interface Row { g: G; line: NumberLineLayer; name: Selection<SVGTextElement, unknown, null, undefined>; pts: G; labels: G }

/**
 * The three-scalers view of the `olcekleme` page: the invoice column on three
 * number lines (StandardScaler, MinMaxScaler, RobustScaler) that share one
 * axis (−1 to 6), so the squeezed MinMax crowd and the open Robust crowd read
 * at a glance. Point labels alternate above and below the line and stagger
 * into rows, so no two value labels overlap.
 */
export class ScalersLayer {
  private readonly svgEl: SVGSVGElement;
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly measure: TextMeasure;
  private readonly rows: Row[];
  private lay: Lay | null = null;
  private mode: Mode = 'ders';
  private view: OlcView | null = null;

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.svgEl = doc.createElementNS(SVGNS, 'svg');
    this.svgEl.setAttribute('class', 'scalers-plot');
    this.svgEl.setAttribute('role', 'img');
    this.svgEl.setAttribute('aria-label', 'Aylık fatura sütunu üç ölçekleyiciyle üç sayı doğrusunda');
    host.append(this.svgEl);
    const svg = select(this.svgEl);
    this.svg = svg;
    this.rows = KEYS.map((k) => {
      const g = svg.append('g').attr('class', 'scaler-row');
      const line = new NumberLineLayer(g);
      g.select('g.number-line').attr('data-scaler', k);
      const nl = g.select<SVGGElement>('g.number-line');
      return {
        g, line,
        name: nl.append('text').attr('class', 'line-name').attr('text-anchor', 'start'),
        pts: nl.append('g').attr('class', 'pts'),
        labels: nl.append('g').attr('class', 'pt-labels'),
      };
    });
    const probe = svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
  }

  resize(w: number, h: number, mode: Mode): void {
    if (this.lay && this.lay.w === w && this.lay.h === h && this.mode === mode) return;
    this.mode = mode;
    this.svgEl.setAttribute('width', String(w));
    this.svgEl.setAttribute('height', String(h));
    this.lay = { w, h };
    if (this.view) {
      this.cancel();
      this.draw(this.view, 0);
    }
  }

  update(v: OlcView, ms: number, mode: Mode): void {
    this.cancel();
    this.view = v;
    if (mode !== this.mode) {
      this.mode = mode;
      if (this.lay) this.draw(v, 0);
      return;
    }
    if (this.lay) this.draw(v, ms);
  }

  /** Cancels running transitions and snaps every element to its final position. */
  interrupt(): void {
    this.cancel();
    if (this.view && this.lay) this.draw(this.view, 0);
  }

  destroy(): void {
    this.cancel();
    this.svgEl.remove();
  }

  private cancel(): void {
    this.svg.selectAll('*').interrupt(TN);
    this.svg.selectAll('*').interrupt('axes');
  }

  private draw(v: OlcView, ms: number): void {
    const L = this.lay!;
    const sv = v.scalers;
    this.svgEl.style.display = sv ? '' : 'none';
    if (!sv) return;

    const fonts = this.measure.fonts(this.mode);
    const tick = fonts.tick;
    const nameFs = this.measure.fontPx('line-name', this.mode === 'ders' ? 22 : 16);
    const R = this.mode === 'ders' ? 9 : 7;
    const pad = 6;
    const gap = Math.round(tick * 0.45);
    const last = KEYS.length - 1;
    const tw = (t: string): number => this.measure.width(t, 'pt-label', tick);
    const nameW = Math.max(...sv.lines.map((ln) => this.measure.width(ln.name, 'line-name', nameFs)));
    // text boxes: ascent 0.8 em above the baseline, descent 0.2 em below
    const nameH = nameFs * 1.0;
    const titleBelow = gap + tick * 0.9 + tick * 0.3 + gap + fonts.axis * 0.95 + fonts.axis * 0.25;

    // Fit the stack into the svg: spacing shrinks first (never a font), then the names move
    // left of their lines. Each level is tried in turn; the last one is used even if it is tight.
    const levels = [
      { lhK: 1.35, blockGap: 6, nameLeft: false },
      { lhK: 1.35, blockGap: 2, nameLeft: false },
      { lhK: 1.35, blockGap: 2, nameLeft: true },
    ];
    const dims = { w: L.w, nameW, tw, R, tick, nameH, titleBelow, last };
    let chosen = levels[0];
    let lay = this.stack(sv.lines, chosen, dims);
    for (const lv of levels.slice(1)) {
      if (lay.total + pad * 2 <= L.h) break;
      chosen = lv;
      lay = this.stack(sv.lines, lv, dims);
    }
    const { sc, plan, need } = lay;
    const lh = tick * chosen.lhK;
    const extra = Math.max(0, (L.h - pad * 2 - lay.total) / KEYS.length);
    let cursor = pad;
    
    sv.lines.forEach((ln, i) => {
      const row = this.rows[i];
      const n = need[i];
      const y0 = cursor;
      cursor += n.h + extra;
      const axisY = y0 + chosen.blockGap + (chosen.nameLeft ? 0 : nameH) + n.aboveH + extra / 2;
      const isLast = i === last;
      const tickY = axisY + gap + tick * 0.9;
      row.line.draw(sc, axisY, {
        tickCount: 7, tickY, title: isLast ? 'Ölçeklenmiş aylık fatura' : '',
        titleY: tickY + tick * 0.3 + gap + fonts.axis * 0.95,
      }, ms, 'scalers');
      // the shared axis needs tick numbers once, under the last line
      row.g.selectAll('g.tick text').style('display', isLast ? '' : 'none');

      if (chosen.nameLeft) row.name.attr('x', pad + 4).attr('y', r1(axisY + nameFs * 0.35));
      else row.name.attr('x', pad + 4).attr('y', r1(y0 + chosen.blockGap + nameFs * 0.8));
      row.name.text(ln.name);

      const pts = row.pts.selectAll<SVGCircleElement, number>('circle.pt').data(ln.values.map((_, j) => j), (d) => String(d));
      pts.exit().remove();
      const en = pts.enter().append('circle').attr('class', 'pt');
      const placeP = (t: AnySel): void => {
        t.attr('cx', (j: number) => r1(sc(ln.values[j]))).attr('cy', r1(axisY)).attr('r', R);
      };
      placeP(en);
      placeP(tr(pts as AnySel, TN, ms));
      en.merge(pts as never).attr('data-id', (j: number) => CUSTOMERS[j].id);

      const labelsAll = plan[i];
      const baseBelow = axisY + R + 4 + tick * 0.8;
      const ly = (l: Lbl): number => (l.side === -1 ? axisY - R - 4 - l.row * lh : baseBelow + l.row * lh);
      const ls = row.labels.selectAll<SVGTextElement, Lbl>('text.pt-label').data(labelsAll, (d) => String(d.j));
      ls.exit().remove();
      const le = ls.enter().append('text').attr('class', 'pt-label').attr('text-anchor', 'middle');
      const placeL = (t: AnySel): void => { t.attr('x', (l: Lbl) => r1(l.cx)).attr('y', (l: Lbl) => r1(ly(l))); };
      placeL(le);
      placeL(tr(ls as AnySel, TN, ms));
      le.merge(ls as never).text((l: Lbl) => l.text).attr('data-w', (l: Lbl) => r1(l.w))
        .attr('data-id', (l: Lbl) => CUSTOMERS[l.j].id);
    });
  }

  /** Scale, label plan and band heights of the three lines for one spacing level. */
  private stack(
    lines: ScalerLine[],
    lv: { lhK: number; blockGap: number; nameLeft: boolean },
    c: { w: number; nameW: number; tw: (t: string) => number; R: number; tick: number; nameH: number; titleBelow: number; last: number },
  ): {
    sc: ReturnType<typeof lineScale>; left: number;
    plan: Lbl[][]; need: { aboveH: number; h: number }[]; total: number;
  } {
    const left = 28 + (lv.nameLeft ? c.nameW + 12 : 0);
    const sc = lineScale({ min: -1, max: 6 }, [left, c.w - 28]);
    const lh = c.tick * lv.lhK;
    const plan = lines.map((ln, i) => this.plan(ln, sc, c.tw, i === c.last));
    const need = plan.map((p, i) => {
      const rowsOf = (side: 1 | -1): number => Math.max(0, ...p.filter((l) => l.side === side).map((l) => l.row + 1));
      const a = rowsOf(-1);
      const b = rowsOf(1);
      const aboveH = a > 0 ? c.R + 4 + (a - 1) * lh + c.tick * 0.8 : c.R;
      let belowH = b > 0 ? c.R + 4 + c.tick * 0.8 + (b - 1) * lh + c.tick * 0.2 : c.R;
      if (i === c.last) belowH = Math.max(belowH, c.titleBelow);
      return { aboveH, h: lv.blockGap + (lv.nameLeft ? 0 : c.nameH) + aboveH + belowH };
    });
    return { sc, left, plan, need, total: need.reduce((t, n) => t + n.h, 0) };
  }

  /** `aboveOnly`: the last line has its tick numbers below, so all its labels go above. */
  private plan(ln: ScalerLine, sc: (v: number) => number, tw: (t: string) => number, aboveOnly: boolean): Lbl[] {
    const order = ln.values.map((_, j) => j).sort((a, b) => ln.values[a] - ln.values[b] || a - b);
    const out: Lbl[] = order.map((j, k) => ({
      j, text: ln.labels[j], cx: sc(ln.values[j]), w: tw(ln.labels[j]), side: aboveOnly || k % 2 === 0 ? -1 : 1, row: 0,
    }));
    for (const side of [-1, 1] as const) {
      const mine = out.filter((l) => l.side === side);
      const rows = staggerRows(mine.map((l) => ({ x: l.cx, w: l.w })), 8);
      mine.forEach((l, i) => { l.row = rows[i]; });
    }
    return out.sort((a, b) => a.j - b.j);
  }
}
