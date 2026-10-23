import { scaleLinear } from 'd3-scale';
import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import type { Mode } from '../../core/mode';
import { formatNumber as f3, tickFormat } from '../../core/plot/format';
import { LineChartLayer } from '../../core/plot/line-chart';
import { FRAME, GRID, r1 } from '../../core/plot/marks';
import { stackLevels } from '../../core/plot/number-line';
import { TextMeasure } from '../../core/plot/text-measure';
import type { BaggingView, ChartsView } from './view';

const NS = 'http://www.w3.org/2000/svg';
type G = Selection<SVGGElement, unknown, null, undefined>;
type Strip = ChartsView['experiment'][number];

/**
 * Chart scene (steps 8-10): the majority-accuracy line chart (step 8), the two
 * dot strips of the book's 10-split experiment (step 9) and, at the end, the
 * same chart again with the closing question and links below it (step 10).
 */
export class ChartScene {
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly chartG: G;
  private readonly expG: G;
  private readonly limitG: G;
  private readonly measure: TextMeasure;
  private readonly chart: LineChartLayer;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const root = host.ownerDocument.createElementNS(NS, 'svg');
    host.append(root);
    this.svg = select(root)
      .attr('class', 'bagging-plot')
      .attr('role', 'img')
      .attr('aria-label', 'Çoğunluk doğruluğu eğrisi ve kitabın 10 bölünmelik deneyi');
    this.chartG = this.svg.append('g').attr('class', 'chart-layer');
    this.expG = this.svg.append('g').attr('class', 'exp-layer');
    this.limitG = this.svg.append('g').attr('class', 'limit-layer');
    const probe = this.svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
    this.chart = new LineChartLayer(this.chartG, this.measure);
  }

  resize(w: number, h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.mode = mode;
    this.svg.attr('width', this.w).attr('height', this.h);
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('axes').interrupt('line');
  }

  destroy(): void {
    this.interrupt();
    this.svg.remove();
  }

  /** Draws the chart for `v.charts` (`ms` > 0 animates the chart axes and lines). */
  update(v: BaggingView, ms: number): void {
    const c = v.charts;
    if (!c) return;
    this.interrupt();
    const f = this.measure.fonts(this.mode);
    const limit = c.kind === 'limit';
    this.chartG.attr('display', c.kind === 'experiment' ? 'none' : null);
    this.expG.attr('display', c.kind === 'experiment' ? null : 'none');
    this.limitG.attr('display', limit ? null : 'none');
    if (c.kind === 'experiment') {
      this.drawExperiment(c.experiment, f);
      return;
    }
    const lane = limit ? this.limitLane(v, f.tick) : 0;
    const spec = limit ? { ...c.majority, marker: null } : c.majority;
    const plot = this.chart.plotRect(this.w, Math.max(80, this.h - lane), spec);
    this.chart.draw(spec, plot, ms);
    if (limit) this.drawLimit(v, c.question, f.tick, this.h - lane);
    else this.limitG.selectAll('*').remove();
  }

  /** Height of the closing question and link rows under the chart. */
  private limitLane(v: BaggingView, tick: number): number {
    return tick * 1.7 * (1 + v.links.length) + 14;
  }

  private drawLimit(v: BaggingView, question: string, tick: number, top: number): void {
    const x = 12;
    const row = tick * 1.7;
    this.limitG
      .selectAll<SVGTextElement, string>('text.limit-question')
      .data([question])
      .join('text')
      .attr('class', 'limit-question axis-title')
      .attr('x', x)
      .attr('y', r1(top + row))
      .text((d) => d);
    const links = this.limitG
      .selectAll<SVGAElement, { href: string; label: string }>('a.scene-link')
      .data(v.links, (d) => d.href)
      .join((enter) => {
        const a = enter.append('a').attr('class', 'scene-link');
        a.append('text');
        return a;
      })
      .attr('href', (d) => d.href)
      .attr('aria-label', (d) => d.label);
    links
      .select('text')
      .attr('x', x)
      .attr('y', (_, i) => r1(top + row * (i + 2)))
      .text((d) => d.label);
  }

  private drawExperiment(strips: Strip[], f: { tick: number; axis: number }): void {
    const pad = 12;
    const all = strips.flatMap((s) => s.values);
    const lo = Math.floor((Math.min(...all) - 0.01) * 20) / 20;
    const hi = Math.ceil((Math.max(...all) + 0.01) * 20) / 20;
    const labelW = this.measure.maxWidth(strips.map((s) => s.label), 'axis-title', f.axis) + pad;
    const left = pad + labelW;
    const right = this.w - pad - f.tick * 1.5;
    const sc = scaleLinear().domain([lo, hi]).range([left, Math.max(left + 40, right)]);
    const axisH = f.tick * 1.2 + f.axis * 1.6 + 16;
    const rowH = Math.max(60, (this.h - axisH - pad) / strips.length);
    const bottom = pad + rowH * strips.length;
    const ticks = sc.ticks(Math.max(2, Math.round((right - left) / (f.tick * 5))));
    const fmt = tickFormat(ticks);
    const r = Math.max(4.5, f.tick * 0.42);

    this.expG
      .selectAll<SVGGElement, number>('g.exp-tick')
      .data(ticks)
      .join((enter) => {
        const g = enter.append('g').attr('class', 'exp-tick');
        g.append('line').attr('stroke', GRID);
        g.append('text').attr('class', 'tick').attr('text-anchor', 'middle');
        return g;
      })
      .attr('transform', (d) => `translate(${r1(sc(d))},0)`)
      .each(function (d) {
        const g = select(this);
        g.select('line').attr('y1', pad).attr('y2', r1(bottom));
        g.select('text')
          .attr('y', r1(bottom + f.tick * 1.1))
          .text(fmt(d));
      });
    this.expG
      .selectAll<SVGTextElement, string>('text.exp-axis-title')
      .data(['10 bölünmenin test doğruluğu'])
      .join('text')
      .attr('class', 'exp-axis-title axis-title')
      .attr('text-anchor', 'middle')
      .attr('x', r1((left + right) / 2))
      .attr('y', r1(bottom + f.tick * 1.1 + f.axis * 1.5))
      .text((d) => d);

    const self = this;
    this.expG
      .selectAll<SVGGElement, Strip>('g.exp-strip')
      .data(strips, (d) => d.id)
      .join((enter) => {
        const g = enter.append('g');
        g.append('line').attr('class', 'exp-base').attr('stroke', FRAME).attr('stroke-width', 2);
        g.append('line').attr('class', 'exp-mean-line').attr('stroke-dasharray', '7 4');
        g.append('text').attr('class', 'exp-label axis-title').attr('text-anchor', 'end');
        g.append('text').attr('class', 'exp-mean').attr('text-anchor', 'middle');
        return g;
      })
      .attr('class', (d) => `exp-strip ${d.id}`)
      .each(function (d, i) {
        const g = select(this);
        const top = pad + i * rowH;
        const base = top + rowH * 0.78;
        const meanX = sc(d.mean);
        g.select('line.exp-base').attr('x1', r1(left)).attr('x2', r1(right)).attr('y1', r1(base)).attr('y2', r1(base));
        g.select('line.exp-mean-line')
          .attr('x1', r1(meanX))
          .attr('x2', r1(meanX))
          .attr('y1', r1(top + f.tick * 1.9))
          .attr('y2', r1(base));
        g.select('text.exp-label')
          .attr('x', r1(left - pad))
          .attr('y', r1(base - rowH * 0.18))
          .text(d.label);
        const label = `ortalama ${f3(d.mean, 3)} · std ${f3(d.std, 3)}`;
        const half = self.measure.width(label, 'tick', f.tick) / 2;
        g.select('text.exp-mean')
          .attr('x', r1(Math.max(left + half, Math.min(self.w - pad - half, meanX))))
          .attr('y', r1(top + f.tick * 1.2))
          .text(label);
        const px = d.values.map((x) => sc(x));
        const levels = stackLevels(px, r * 2 + 1);
        g.selectAll<SVGCircleElement, number>('circle.exp-dot')
          .data(d.values)
          .join('circle')
          .attr('class', 'exp-dot')
          .attr('r', r)
          .attr('cx', (_, k) => r1(px[k]))
          .attr('cy', (_, k) => r1(base - r - 2 - levels[k] * (r * 2 + 1)));
      });
  }
}
