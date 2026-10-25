import { scaleLinear } from 'd3-scale';
import { select, type Selection } from 'd3-selection';
import type { Mode } from '../../core/mode';
import { AxesLayer } from '../../core/plot/axes';
import { r1 } from '../../core/plot/marks';
import { TextMeasure } from '../../core/plot/text-measure';
import { el, NS, type ViewScene } from './scene-base';
import type { ShapView, SwarmDot, SwarmView } from './view';

type G = Selection<SVGGElement, unknown, null, undefined>;

/** Low and high end of the value colour (the book's figure 13.1): blue to red-pink. */
export const LOW_RGB = [30, 136, 229] as const;
export const HIGH_RGB = [255, 13, 87] as const;

/** Colour of a value rank t in 0..1. */
export function dotColor(t: number): string {
  const c = LOW_RGB.map((lo, i) => Math.round(lo + (HIGH_RGB[i] - lo) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

interface PlacedDot extends SwarmDot {
  feature: number;
  cx: number;
  cy: number;
}

/**
 * The summary plot (step 9): one `.swarm-row[data-feature]` per feature with a `.swarm-dot` per test customer.
 * The dot x is the SHAP value on a shared axis (`AxesLayer`, `.swarm-zero` marks 0); dots that would land on top
 * of each other are stacked vertically (a beeswarm). The colour is the rank of the feature value inside the test set; the customer to highlight gets a ring.
 */
export class SwarmScene implements ViewScene {
  private readonly root: HTMLDivElement;
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly axes: AxesLayer;
  private readonly rowG: G;
  private readonly guideG: G;
  private readonly legend: HTMLDivElement;
  private readonly legendText: HTMLElement;
  private readonly note: HTMLElement;
  private readonly measure: TextMeasure;
  private w = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'swarm-scene');
    const root = doc.createElementNS(NS, 'svg');
    this.svg = select(root).attr('class', 'swarm-plot').attr('role', 'img').attr('aria-label', 'Özet grafiği: SHAP katkısı ve özellik değeri');
    this.axes = new AxesLayer(this.svg.append('g').attr('class', 'swarm-axes'));
    this.guideG = this.svg.append('g').attr('class', 'swarm-guides');
    this.rowG = this.svg.append('g').attr('class', 'swarm-rows');
    const probe = this.svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
    this.legend = el(doc, 'div', 'swarm-legend');
    const bar = el(doc, 'span', 'legend-bar');
    bar.style.background = `linear-gradient(to right, ${dotColor(0)}, ${dotColor(1)})`;
    this.legendText = el(doc, 'span', 'legend-text');
    this.legend.append(el(doc, 'span', 'legend-end', 'düşük'), bar, el(doc, 'span', 'legend-end', 'yüksek'), this.legendText);
    this.note = el(doc, 'p', 'swarm-note');
    this.root.append(root, this.legend, this.note);
    host.append(this.root);
  }

  resize(w: number, _h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.mode = mode;
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('axes');
  }

  destroy(): void {
    this.interrupt();
    this.root.remove();
  }

  update(v: ShapView, ms: number): void {
    const s = v.swarm;
    if (!s) {
      return;
    }
    this.legendText.textContent = `renk: ${s.colorName}`;
    this.note.textContent = s.note;
    this.draw(s, ms);
  }

  /**
   * Vertical offsets of the dots of a row (a beeswarm): dots are placed from left to right, each at the offset
   * nearest the row centre that keeps it one dot apart from every dot already placed.
   */
  private offsets(xs: number[], r: number): number[] {
    const gap = 2 * r + 0.5;
    const out = new Array<number>(xs.length).fill(0);
    const placed: number[] = [];
    const order = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b]);
    for (const i of order) {
      const near = placed.filter((j) => Math.abs(xs[j] - xs[i]) < gap);
      const candidates = [0];
      for (const j of near) {
        const d = Math.sqrt(gap * gap - (xs[j] - xs[i]) ** 2);
        candidates.push(out[j] + d, out[j] - d);
      }
      candidates.sort((a, b) => Math.abs(a) - Math.abs(b));
      out[i] = candidates.find((y) => near.every((j) => Math.hypot(xs[j] - xs[i], out[j] - y) >= gap - 1e-6)) ?? 0;
      placed.push(i);
    }
    return out;
  }

  private draw(s: SwarmView, ms: number): void {
    const fs = this.measure.fonts(this.mode).tick;
    const r = Math.max(3, Math.round(fs * 0.2 * 10) / 10);
    const labelW = this.measure.maxWidth(s.rows.map((row) => row.name), 'tick', fs) + 14;
    const width = Math.max(220, this.w - 24);
    const left = labelW;
    const right = width - 14;
    const x = scaleLinear().domain(s.xDomain).range([left + r, right - r]);
    const rowsLayout = s.rows.map((row) => {
      const xs = row.dots.map((d) => x(d.x));
      const off = this.offsets(xs, r);
      const half = Math.max(...off.map(Math.abs)) + r + 4;
      return { row, xs, off, h: Math.max(fs * 2.4, half * 2) };
    });
    const top = 6;
    const axisH = fs * 3.4;
    const plotH = rowsLayout.reduce((sum, l) => sum + l.h, 0);
    const height = Math.ceil(top + plotH + axisH);
    this.svg.attr('width', width).attr('height', height);

    const plot = { left, top, width: right - left, height: plotH };
    const ticks = this.ticks(s.xDomain);
    const y = scaleLinear().domain([0, 1]).range([top + plotH, top]);
    this.axes.draw(
      { x, y },
      plot,
      {
        xTickCount: ticks.length,
        yTickCount: 0,
        xTickY: top + plotH + fs * 1.3,
        yTickX: 0,
        xTicks: ticks,
        yTicks: [],
        xTitle: { x: left + plot.width / 2, y: top + plotH + fs * 2.7, text: 'SHAP katkısı (olasılık birimi): sağa ayrılmaya iter' },
        yTitle: { x: 0, y: 0, lines: [] },
      },
      ms,
      'swarm',
    );

    // zero line and row separators
    const rowTops: number[] = [];
    let acc = top;
    for (const l of rowsLayout) {
      rowTops.push(acc);
      acc += l.h;
    }
    this.guideG
      .selectAll<SVGLineElement, number>('line.swarm-zero')
      .data([0])
      .join('line')
      .attr('class', 'swarm-zero')
      .attr('x1', r1(x(0)))
      .attr('x2', r1(x(0)))
      .attr('y1', top)
      .attr('y2', top + plotH);
    this.guideG
      .selectAll<SVGLineElement, number>('line.swarm-sep')
      .data(rowTops.slice(1))
      .join('line')
      .attr('class', 'swarm-sep')
      .attr('x1', left)
      .attr('x2', right)
      .attr('y1', (d) => r1(d))
      .attr('y2', (d) => r1(d));

    // rows of dots
    const rowSel = this.rowG
      .selectAll<SVGGElement, (typeof rowsLayout)[number]>('g.swarm-row')
      .data(rowsLayout, (l) => l.row.feature)
      .join((enter) => {
        const g = enter.append('g');
        g.append('text').attr('class', 'swarm-label').attr('text-anchor', 'end').attr('dy', '0.35em');
        return g;
      })
      .attr('class', 'swarm-row')
      .attr('data-feature', (l) => l.row.feature);
    rowSel
      .select('text.swarm-label')
      .attr('x', r1(left - 10))
      .attr('y', (l, i) => r1(rowTops[i] + l.h / 2))
      .text((l) => l.row.name);
    rowSel.each(function (l, i) {
      const cy = rowTops[i] + l.h / 2;
      const placed: PlacedDot[] = l.row.dots.map((d, k) => ({ ...d, feature: l.row.feature, cx: l.xs[k], cy: cy + l.off[k] }));
      placed.sort((a, b) => Number(a.highlight) - Number(b.highlight));
      select(this)
        .selectAll<SVGCircleElement, PlacedDot>('circle.swarm-dot')
        .data(placed, (d) => d.row)
        .join('circle')
        .attr('class', (d) => `swarm-dot${d.highlight ? ' is-highlight' : ''}`)
        .attr('data-row', (d) => d.row)
        .attr('data-t', (d) => Math.round(d.t * 1000) / 1000)
        .attr('cx', (d) => r1(d.cx))
        .attr('cy', (d) => r1(d.cy))
        .attr('r', (d) => (d.highlight ? r * 1.7 : r))
        .attr('fill', (d) => dotColor(d.t))
        .order();
    });
  }

  private ticks(domain: [number, number]): number[] {
    const out: number[] = [];
    const step = domain[1] - domain[0] > 0.9 ? 0.2 : 0.1;
    for (let k = Math.ceil(domain[0] / step - 1e-9); k * step <= domain[1] + 1e-9; k++) {
      out.push(Math.round(k * step * 100) / 100);
    }
    return out;
  }
}
