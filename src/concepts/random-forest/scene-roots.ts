import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import type { Mode } from '../../core/mode';
import { HBarsLayer, type HBar } from '../../core/plot/hbars';
import { LineChartLayer } from '../../core/plot/line-chart';
import { r1 } from '../../core/plot/marks';
import { TextMeasure } from '../../core/plot/text-measure';
import { tr } from '../../core/plot/transition';
import type { RfView, RootsView } from './view';

/** Duration of one authored reveal in milliseconds (scaled by the caller). */
export const MS_STEP = 450;

const NS = 'http://www.w3.org/2000/svg';
type G = Selection<SVGGElement, unknown, null, undefined>;
type Rect = { x: number; y: number; w: number; h: number };

/** Below this width the node card stacks under the bars instead of sitting beside them. */
const SIDE_BY_SIDE = 700;
const PAD = 12;

/**
 * Roots scene (steps 1-4): 8 horizontal bars of root counts (bagging navy, Random Forest green; step 2 adds the
 * node card with 8 chips), then the variance line chart (step 3) and the max_features sweep chart (step 4).
 */
export class RootsScene {
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly legendG: G;
  private readonly barsG: G;
  private readonly cardG: G;
  private readonly chartG: G;
  private readonly measure: TextMeasure;
  private readonly chart: LineChartLayer;
  private readonly bars: HBarsLayer;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const root = host.ownerDocument.createElementNS(NS, 'svg');
    host.append(root);
    this.svg = select(root)
      .attr('class', 'rf-plot')
      .attr('role', 'img')
      .attr('aria-label', 'Köklerde seçilen öznitelikler, topluluk varyansı ve max_features taraması');
    this.legendG = this.svg.append('g').attr('class', 'legend-layer');
    this.barsG = this.svg.append('g').attr('class', 'bars-layer');
    this.cardG = this.svg.append('g').attr('class', 'card-layer');
    this.chartG = this.svg.append('g').attr('class', 'chart-layer');
    const probe = this.svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
    this.chart = new LineChartLayer(this.chartG, this.measure);
    this.bars = new HBarsLayer(this.barsG, this.measure);
  }

  resize(w: number, h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.mode = mode;
    this.svg.attr('width', this.w).attr('height', this.h);
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('bars').interrupt('axes').interrupt('line');
  }

  destroy(): void {
    this.interrupt();
    this.svg.remove();
  }

  /** Draws the bars / card / chart of `v.roots` (`ms` > 0 animates the bar growth and the chart). */
  update(v: RfView, ms: number): void {
    const r = v.roots;
    if (!r) return;
    this.interrupt();
    const f = this.measure.fonts(this.mode);
    const top = this.drawLegend(r.legend, f.tick);
    const area: Rect = { x: 0, y: top, w: this.w, h: Math.max(60, this.h - top) };
    const bars = r.kind === 'bars';
    this.barsG.attr('display', bars ? null : 'none');
    this.cardG.attr('display', r.card ? null : 'none');
    this.chartG.attr('display', bars ? 'none' : null);
    if (bars) {
      const side = r.card !== null && this.w >= SIDE_BY_SIDE;
      const stacked = r.card !== null && !side;
      // stacked: the card keeps the height it needs (at most 60 %), the bars take the rest
      const cardH = r.card && stacked ? Math.min(this.cardHeight(r.card, area.w, f), Math.round(area.h * 0.6)) : 0;
      const barsRect: Rect = side
        ? { ...area, w: Math.round(area.w * 0.54) }
        : stacked
          ? { ...area, h: area.h - cardH }
          : area;
      this.drawBars(r, barsRect, f.tick, ms);
      if (r.card) {
        const cardRect: Rect = side
          ? { x: barsRect.w, y: area.y, w: area.w - barsRect.w, h: area.h }
          : { x: 0, y: area.y + barsRect.h, w: area.w, h: area.h - barsRect.h };
        this.drawCard(r.card, cardRect, f);
      }
    } else if (r.chart) {
      const plot = this.chart.plotRect(area.w, area.h, r.chart);
      this.chart.draw(r.chart, { ...plot, top: plot.top + area.y }, ms);
    }
  }

  /** Legend row(s) at the top; returns the y where the content starts. */
  private drawLegend(items: RootsView['legend'], tick: number): number {
    const row = Math.round(tick * 1.7);
    const key = Math.round(tick * 1.6);
    const gap = Math.round(tick * 1.2);
    let x = PAD;
    let line = 0;
    const placed = items.map((it) => {
      const w = key + 6 + this.measure.width(it.label, 'tick', tick);
      if (x > PAD && x + w > this.w - PAD) {
        x = PAD;
        line++;
      }
      const at = { it, x, line, w };
      x += w + gap;
      return at;
    });
    const g = this.legendG
      .selectAll<SVGGElement, (typeof placed)[number]>('g.legend-item')
      .data(placed, (d) => d.it.label)
      .join((enter) => {
        const e = enter.append('g');
        e.append('line');
        e.append('text').attr('class', 'tick');
        return e;
      })
      .attr('class', (d) => `legend-item ${d.it.cls}`)
      .attr('transform', (d) => `translate(${r1(d.x)},${r1(d.line * row + row / 2 + 4)})`);
    g.select('line')
      .attr('class', (d) => `legend-key ${d.it.cls}`)
      .attr('x1', 0)
      .attr('x2', key)
      .attr('y1', 0)
      .attr('y2', 0);
    g.select('text')
      .attr('x', key + 6)
      .attr('dy', '0.35em')
      .text((d) => d.it.label);
    const lines = placed.length === 0 ? 0 : placed[placed.length - 1].line + 1;
    return lines === 0 ? 0 : lines * row + 8;
  }

  private drawBars(r: RootsView, rect: Rect, tick: number, ms: number): void {
    const groups: ('bagging' | 'forest')[] = [];
    if (r.bagging) groups.push('bagging');
    if (r.forest) groups.push('forest');
    const data: HBar[] = [];
    r.names.forEach((name, feature) => {
      groups.forEach((group, k) => {
        const count = (group === 'bagging' ? r.bagging! : r.forest!)[feature];
        data.push({
          id: `${group}-${feature}`,
          row: feature,
          slot: k,
          cls: group,
          value: count,
          text: String(count),
          label: k === 0 ? name : '',
          attrs: { count, feature },
        });
      });
    });
    this.bars.draw(data, {
      rect,
      tick,
      rows: r.names.length,
      slots: groups.length,
      max: r.maxCount,
      itemCls: 'root-bar',
      valueSample: '000',
      ms,
    });
  }

  /** Height of the node card at its smallest chip size: title, 4 chip rows, note. */
  private cardHeight(card: NonNullable<RootsView['card']>, width: number, f: { tick: number; axis: number }): number {
    const w = width - 2 * PAD;
    const title = this.measure.wrap(card.title, w, 'axis-title', f.axis).length;
    const note = this.measure.wrap(card.note, w, 'tick', f.tick).length;
    const rows = Math.ceil(card.names.length / 2);
    return title * f.axis * 1.35 + 6 + rows * (f.tick * 1.7 + 8) + f.tick + note * f.tick * 1.35 + 8;
  }

  private drawCard(card: NonNullable<RootsView['card']>, rect: Rect, f: { tick: number; axis: number }): void {
    const x = rect.x + PAD;
    const w = rect.w - 2 * PAD;
    const title = this.measure.wrap(card.title, w, 'axis-title', f.axis);
    const noteLines = this.measure.wrap(card.note, w, 'tick', f.tick);
    const lineH = f.tick * 1.35;
    const chipGap = 8;
    const cols = 2;
    const chipW = (w - chipGap) / cols;
    const chips = card.names.length;
    const chipRows = Math.ceil(chips / cols);
    const head = title.length * f.axis * 1.35 + 6;
    const noteH = noteLines.length * lineH + 4;
    const chipH = Math.max(f.tick * 1.7, Math.min(f.tick * 2.3, (rect.h - head - noteH - 12 - (chipRows - 1) * chipGap) / chipRows));
    const chipsY = rect.y + head;

    this.cardG
      .selectAll<SVGTextElement, string[]>('text.node-title')
      .data([title])
      .join('text')
      .attr('class', 'node-title axis-title')
      .each(function (lines) {
        const t = select(this);
        t.selectAll('tspan')
          .data(lines)
          .join('tspan')
          .attr('x', r1(x))
          .attr('y', (_, i) => r1(rect.y + f.axis * 1.1 + i * f.axis * 1.35))
          .text((d) => d);
      });
    const chipsData = card.names.map((name, feature) => ({ name, feature }));
    const sel = this.cardG
      .selectAll<SVGGElement, (typeof chipsData)[number]>('g.node-chip')
      .data(chipsData, (d) => d.feature)
      .join((enter) => {
        const g = enter.append('g');
        g.append('rect').attr('rx', 8);
        g.append('text').attr('text-anchor', 'middle');
        return g;
      })
      .attr('class', (d) => `node-chip${card.drawn.includes(d.feature) ? ' drawn' : ''}${d.feature === card.winner ? ' winner' : ''}`)
      .attr('data-feature', (d) => d.feature)
      .attr('transform', (d) => `translate(${r1(x + (d.feature % cols) * (chipW + chipGap))},${r1(chipsY + Math.floor(d.feature / cols) * (chipH + chipGap))})`);
    sel.select('rect').attr('width', r1(chipW)).attr('height', r1(chipH));
    sel
      .select('text')
      .attr('x', r1(chipW / 2))
      .attr('y', r1(chipH / 2))
      .attr('dy', '0.35em')
      .text((d) => d.name);

    const noteY = chipsY + chipRows * (chipH + chipGap) + f.tick;
    this.cardG
      .selectAll<SVGTextElement, string[]>('text.node-note')
      .data([noteLines])
      .join('text')
      .attr('class', 'node-note tick')
      .each(function (lines) {
        select(this)
          .selectAll('tspan')
          .data(lines)
          .join('tspan')
          .attr('x', r1(x))
          .attr('y', (_, i) => r1(noteY + i * lineH))
          .text((d) => d);
      });
  }
}
