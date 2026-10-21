import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import { easeCubicInOut } from 'd3-ease';
import { scaleLinear } from 'd3-scale';
import type { Mode } from '../../core/mode';
import { tickFormat } from '../../core/plot/format';
import { FRAME, GRID, NAVY, r1 } from '../../core/plot/marks';
import { staggerRows } from '../../core/plot/number-line';
import { TextMeasure } from '../../core/plot/text-measure';
import { tr } from '../../core/plot/transition';
import type { Rect } from '../../core/plot/viewport';
import type { SideView } from './view';

/** Duration before `durationScale` of the ×1 <-> ×1000 rescale. */
const RESCALE_MS = 900;
const NAMES = ['pca-gauge', 'pca-gaxes'];
const X_TICKS = [0, 45, 90, 135, 180];
/** Share of the rect height taken by the gauge; the curve gets the rest. */
const GAUGE_SHARE = 0.38;

type G = Selection<SVGGElement, unknown, null, undefined>;
type El<T extends Element> = Selection<T, unknown, null, undefined>;

interface Lay { rect: Rect; fonts: { tick: number; axis: number }; gap: number }
interface Plot { left: number; top: number; width: number; height: number }

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * The right-hand side of the `pca` page: a vertical variance gauge (top 38 %) and
 * the projected-variance-by-angle curve (bottom 62 %). A change of θ is instant;
 * only the ×1 <-> ×1000 rescale animates (fixed duration × `ds`, `ms > 0` is just
 * the animate flag). Text sizes come from the CSS tokens only.
 */
export class GaugeLayer {
  private readonly root: G;
  private readonly measure: TextMeasure;
  private readonly track: El<SVGRectElement>;
  private readonly bar: El<SVGRectElement>;
  private readonly gLabel: El<SVGTextElement>;
  private readonly frame: El<SVGRectElement>;
  private readonly gx: G;
  private readonly gy: G;
  private readonly xTitle: El<SVGTextElement>;
  private readonly yTitle: El<SVGTextElement>;
  private readonly curve: El<SVGPathElement>;
  private readonly marker: El<SVGCircleElement>;
  private readonly markerLabel: El<SVGTextElement>;
  private readonly peak: El<SVGTextElement>;

  private lay: Lay | null = null;
  private view: SideView | null = null;
  private plot: Plot | null = null;
  private trackBox = { x: 0, y: 0, w: 0, h: 0 };
  /** Animated scalars: the scale maximum and the gauge value now shown. */
  private st = { max: 1, value: 0 };
  private scaleKey = '';

  constructor(svgEl: SVGSVGElement, private readonly ds: number) {
    this.root = select(svgEl).append('g').attr('class', 'pca-gauge');
    this.track = this.root.append('rect').attr('class', 'gauge-track');
    this.bar = this.root.append('rect').attr('class', 'gauge-bar');
    this.gLabel = this.root.append('text').attr('class', 'gauge-label');
    this.frame = this.root.append('rect').attr('class', 'var-frame').attr('fill', 'none').attr('stroke', FRAME);
    this.gx = this.root.append('g').attr('class', 'var-axis x');
    this.gy = this.root.append('g').attr('class', 'var-axis y');
    this.xTitle = this.root.append('text').attr('class', 'axis-title var-axis-title x').attr('text-anchor', 'middle');
    this.yTitle = this.root.append('text').attr('class', 'axis-title var-axis-title y').attr('text-anchor', 'middle');
    this.curve = this.root.append('path').attr('class', 'var-curve').attr('fill', 'none').attr('stroke', NAVY);
    this.marker = this.root.append('circle').attr('class', 'var-marker');
    this.markerLabel = this.root.append('text').attr('class', 'var-marker-label').attr('text-anchor', 'middle');
    this.peak = this.root.append('text').attr('class', 'var-peak').attr('text-anchor', 'middle');
    const probe = this.root.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
    this.xTitle.text('θ (derece)');
    this.yTitle.text('izdüşüm varyansı');
  }

  layout(rect: Rect, mode: Mode): void {
    const fonts = this.measure.fonts(mode);
    this.lay = { rect, fonts, gap: Math.round(fonts.tick * 0.45) };
    if (this.view) {
      this.cancel();
      this.draw(this.view, false);
    }
  }

  update(side: SideView | null, ms: number): void {
    this.cancel();
    const prev = this.view;
    this.view = side;
    if (!side) {
      this.root.style('display', 'none');
      this.scaleKey = '';
      return;
    }
    if (!this.lay) return;
    this.draw(side, ms > 0 && this.ds > 0 && prev !== null);
  }

  /** Cancels running transitions and snaps every element to its final state. */
  interrupt(): void {
    this.cancel();
    if (this.view && this.lay) this.draw(this.view, false);
  }

  destroy(): void {
    this.cancel();
    this.root.remove();
  }

  private cancel(): void {
    for (const n of NAMES) this.root.selectAll('*').interrupt(n);
    for (const n of NAMES) this.root.interrupt(n);
  }

  // ------------------------------------------------------------- draw
  private draw(v: SideView, animate: boolean): void {
    const { rect, fonts, gap } = this.lay!;
    const lh = fonts.tick * 1.2; // room above the plot for the labels of the curve
    this.root.style('display', '');

    // ---- layout: gauge above, chart below
    const gaugeH = rect.height * GAUGE_SHARE;
    const trackW = Math.max(24, Math.round(fonts.tick * 1.6));
    const trackH = Math.max(10, gaugeH - 2 * gap);
    this.trackBox = { x: rect.left + gap, y: rect.top + gap, w: trackW, h: trackH };

    const yKey = v.gauge.max >= 100 ? 'k' : 'u';
    const rescale = animate && this.scaleKey !== '' && this.scaleKey !== yKey;
    const maxNow = v.gauge.max;
    const ticks = scaleLinear().domain([0, maxNow]).ticks(Math.max(2, Math.round((rect.height * (1 - GAUGE_SHARE)) / (fonts.tick * 5))));
    const fy = tickFormat(ticks);
    const yTickW = this.measure.maxWidth(ticks.map((t) => fy(t)), 'tick', fonts.tick);
    const chartTop = rect.top + gaugeH;
    const plot: Plot = {
      left: Math.round(rect.left + fonts.axis * 1.3 + 2 * gap + yTickW),
      top: Math.round(chartTop + 2.4 * lh),
      width: 0,
      height: 0,
    };
    plot.width = Math.max(40, rect.left + rect.width - gap - fonts.tick - plot.left);
    plot.height = Math.max(40, rect.top + rect.height - (fonts.tick * 1.5 + 2 * gap + fonts.axis * 1.5) - plot.top);
    this.plot = plot;

    // ---- axes (y ticks cross-fade when the scale changes)
    const bottom = plot.top + plot.height;
    const right = plot.left + plot.width;
    const sx = scaleLinear().domain([0, 180]).range([plot.left, right]);
    const sy = scaleLinear().domain([0, maxNow]).range([bottom, plot.top]);
    this.frame.attr('x', plot.left).attr('y', plot.top).attr('width', plot.width).attr('height', plot.height);
    const fadeMs = rescale ? RESCALE_MS * this.ds : 0;
    const xs = this.gx.selectAll<SVGGElement, number>('g.tick').data(X_TICKS, (d) => `x:${d}`).join((enter) => {
      const g = enter.append('g').attr('class', 'tick');
      g.append('line').attr('stroke', GRID);
      g.append('text').attr('text-anchor', 'middle');
      return g;
    });
    xs.attr('transform', (d) => `translate(${r1(sx(d))},0)`);
    xs.select('line').attr('y1', plot.top).attr('y2', bottom);
    xs.select<SVGTextElement>('text').attr('y', r1(bottom + gap + fonts.tick * 0.9)).text((d) => `${d}°`);
    const ys = this.gy.selectAll<SVGGElement, number>('g.tick').data(ticks, (d) => `${yKey}:${d}`).join(
      (enter) => {
        const g = enter.append('g').attr('class', 'tick').attr('opacity', fadeMs > 0 ? 0 : 1);
        g.append('line').attr('stroke', GRID);
        g.append('text').attr('text-anchor', 'end').attr('dy', '0.35em');
        return g;
      },
      (update) => update,
      (exit) => { tr(exit, 'pca-gaxes', fadeMs).attr('opacity', 0).remove(); },
    );
    ys.attr('transform', (d) => `translate(0,${r1(sy(d))})`);
    ys.select('line').attr('x1', plot.left).attr('x2', right);
    ys.select<SVGTextElement>('text').attr('x', r1(plot.left - gap)).text((d) => fy(d));
    tr(ys, 'pca-gaxes', fadeMs).attr('opacity', 1);
    this.xTitle.attr('x', r1(plot.left + plot.width / 2)).attr('y', r1(bottom + 2 * gap + fonts.tick * 0.9 + fonts.axis * 1.1));
    this.yTitle.attr('transform', `translate(${r1(rect.left + fonts.axis * 0.8)},${r1(plot.top + plot.height / 2)}) rotate(-90)`);

    // ---- state that follows the data
    this.root.attr('data-scale', yKey);
    this.bar.attr('data-value', v.gauge.value);
    this.gLabel.text(v.gauge.label);
    this.curve.attr('data-upto', v.curve.upTo ?? '');
    this.marker.attr('data-theta', v.curve.marker);
    this.markerLabel.text(`${Math.round(v.curve.marker)}°`);
    this.peak.text(v.curve.peak?.label ?? '').attr('data-peak', v.curve.peak?.deg ?? '');

    // ---- the scalars (max, value) tween on a rescale, else snap
    const from = { ...this.st };
    this.scaleKey = yKey;
    if (rescale) {
      const to = { max: maxNow, value: v.gauge.value };
      this.root.transition('pca-gauge').duration(RESCALE_MS * this.ds).ease(easeCubicInOut).tween('scale', () => (t: number) => {
        this.st = { max: lerp(from.max, to.max, t), value: lerp(from.value, to.value, t) };
        this.paint();
      });
    } else {
      this.st = { max: maxNow, value: v.gauge.value };
    }
    this.paint();
  }

  /** Bar, curve, marker and the labels above the curve, from the current scalars. */
  private paint(): void {
    const v = this.view;
    const L = this.lay;
    const plot = this.plot;
    if (!v || !L || !plot) return;
    const { fonts, gap } = L;
    const lh = fonts.tick * 1.2;
    const { max, value } = this.st;

    // gauge
    const tb = this.trackBox;
    const h = Math.max(0, Math.min(tb.h, (value / max) * tb.h));
    this.track.attr('x', tb.x).attr('y', tb.y).attr('width', tb.w).attr('height', tb.h).attr('rx', 4);
    this.bar.attr('x', tb.x).attr('y', r1(tb.y + tb.h - h)).attr('width', tb.w).attr('height', r1(h)).attr('rx', 4);
    this.gLabel.attr('x', tb.x + tb.w + 2 * gap).attr('y', r1(tb.y + tb.h - h)).attr('dominant-baseline', 'middle');

    // curve
    const bottom = plot.top + plot.height;
    const sx = (d: number): number => plot.left + (d / 180) * plot.width;
    const sy = (y: number): number => bottom - (y / max) * plot.height;
    const upTo = v.curve.upTo;
    const on = upTo !== null;
    let d = '';
    if (on) {
      const last = Math.min(Math.floor(upTo), v.curve.values.length - 1);
      for (let i = 0; i <= last; i++) d += `${i === 0 ? 'M' : 'L'}${r1(sx(i))},${r1(sy(v.curve.values[i]))}`;
    }
    this.curve.attr('d', d).attr('display', on ? null : 'none');
    this.marker.attr('display', on ? null : 'none').attr('r', 6)
      .attr('cx', r1(sx(v.curve.marker))).attr('cy', r1(sy(value)));

    // labels above the points; the peak label and the marker label are separated by staggerRows
    const peak = v.curve.peak;
    const items: { el: El<SVGTextElement>; x: number; y: number; cls: string }[] = [];
    if (peak) items.push({ el: this.peak, x: sx(peak.deg), y: sy(v.curve.values[Math.round(peak.deg)]), cls: 'var-peak' });
    if (on) items.push({ el: this.markerLabel, x: sx(v.curve.marker), y: sy(value), cls: 'var-marker-label' });
    const boxes = items.map((it) => ({ x: it.x, w: this.measure.width(it.el.text(), it.cls, fonts.tick) }));
    const rows = staggerRows(boxes, 8);
    items.forEach((it, i) => {
      const half = boxes[i].w / 2;
      const x = Math.min(plot.left + plot.width + fonts.tick - half, Math.max(plot.left + half, it.x));
      it.el.attr('x', r1(x)).attr('y', r1(it.y - gap * 1.6 - rows[i] * lh));
    });
    this.peak.attr('display', peak ? null : 'none');
    this.markerLabel.attr('display', on ? null : 'none');
  }
}
