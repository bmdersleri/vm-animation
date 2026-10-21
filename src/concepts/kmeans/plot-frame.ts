import { select } from 'd3-selection';
import type { Mode } from '../../core/mode';
import { AxesLayer } from '../../core/plot/axes';
import { ClusterScatterLayer } from '../../core/plot/cluster-scatter';
import { fitEqualAspect, type Domain, type Rect } from '../../core/plot/viewport';

/** Scaled sepal length × petal length, with room for every centre and label. */
export const PLOT_DOMAIN: Domain = { x: [-2.1, 2.7], y: [-1.8, 2.0] };
const FONT_FALLBACK: Record<Mode, { tick: number; axis: number }> = { ders: { tick: 18, axis: 19 }, lab: { tick: 13, axis: 14 } };

export interface PlotFonts { tick: number; axis: number }

/**
 * The Chapter 7 scatter frame shared by both pages: axes and a ClusterScatterLayer laid out with
 * equal aspect in the plot host. The axes are redrawn only when the size, mode or fonts change.
 */
export class ClusterPlotFrame {
  readonly layer: ClusterScatterLayer;
  private readonly axes: AxesLayer;
  private readonly probe: SVGTextElement;
  private lastPlot = '';

  /**
   * @param prefix page class prefix: the marks group is `${prefix}-marks`, the font probe `${prefix}-probe`.
   * @param widthShare share of the scene width the plot takes when the host cannot be measured.
   */
  constructor(
    private readonly svgEl: SVGSVGElement,
    private readonly plotHost: HTMLElement,
    private readonly prefix: string,
    private readonly widthShare: number,
  ) {
    const svg = select(svgEl);
    this.axes = new AxesLayer(svg.append('g').attr('class', 'axes'));
    this.layer = new ClusterScatterLayer(svg.append('g').attr('class', `${prefix}-marks`).node()!, PLOT_DOMAIN);
    this.probe = svg.append('text').attr('class', `${prefix}-probe`)
      .attr('visibility', 'hidden').attr('aria-hidden', 'true').node()!;
  }

  /** Tick and axis-title font sizes from CSS, or the mode's fallback. */
  fonts(mode: Mode): PlotFonts {
    const fb = FONT_FALLBACK[mode];
    const px = parseFloat(getComputedStyle(this.probe).fontSize);
    const axisPx = parseFloat(getComputedStyle(this.svgEl).getPropertyValue('--fs-axis'));
    return { tick: Number.isFinite(px) && px > 0 ? px : fb.tick, axis: Number.isFinite(axisPx) && axisPx > 0 ? axisPx : fb.axis };
  }

  /** Sizes the SVG to its host and lays out the axes and the scatter; returns the fonts it used. */
  layout(mode: Mode, size: { w: number; h: number } | null): PlotFonts {
    const f = this.fonts(mode);
    const { tick, axis } = f;
    const r = this.plotHost.getBoundingClientRect();
    const w = r.width > 0 ? Math.floor(r.width) : Math.max(200, Math.floor((size?.w ?? 900) * this.widthShare));
    const h = r.height > 0 ? Math.floor(r.height) : (size?.h ?? 600);
    this.svgEl.setAttribute('width', String(w));
    this.svgEl.setAttribute('height', String(h));
    const mL = Math.ceil(tick * 2.6 + 8 + axis * 1.4);
    const mB = Math.ceil(tick * 1.5 + 8 + axis * 1.5);
    const avail: Rect = { left: mL, top: 8, width: Math.max(40, w - mL - 10), height: Math.max(40, h - 8 - mB) };
    const key = `${mode} ${w} ${h} ${tick} ${axis}`;
    if (key === this.lastPlot) return f;
    this.lastPlot = key;
    const sc = fitEqualAspect(PLOT_DOMAIN, avail);
    const plot: Rect = {
      left: sc.x(PLOT_DOMAIN.x[0]), top: sc.y(PLOT_DOMAIN.y[1]),
      width: sc.x(PLOT_DOMAIN.x[1]) - sc.x(PLOT_DOMAIN.x[0]), height: sc.y(PLOT_DOMAIN.y[0]) - sc.y(PLOT_DOMAIN.y[1]),
    };
    const bottom = plot.top + plot.height;
    this.axes.draw(sc, plot, {
      xTickCount: 6, yTickCount: 6,
      xTickY: bottom + tick * 1.15, yTickX: plot.left - 8,
      xTitle: { x: plot.left + plot.width / 2, y: bottom + tick * 1.15 + axis * 1.45, text: 'sepal length (ölçeklenmiş)' },
      yTitle: { x: plot.left - 8 - tick * 2.6 - axis * 0.3, y: plot.top + plot.height / 2, lines: ['petal length (ölçeklenmiş)'] },
    }, 0, this.prefix);
    this.layer.resize(avail);
    return f;
  }

  /** Forces the next layout to redraw (after a resize or a mode change). */
  invalidate(): void {
    this.lastPlot = '';
  }

  destroy(): void {
    this.layer.destroy();
  }
}
