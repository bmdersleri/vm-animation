import { select } from 'd3-selection';
import type { Mode } from '../../core/mode';
import { AxesLayer } from '../../core/plot/axes';
import { TextMeasure } from '../../core/plot/text-measure';
import { ClusterScatterLayer } from '../../core/plot/cluster-scatter';
import { fitEqualAspect, type Domain, type Rect } from '../../core/plot/viewport';

/** Scaled sepal length × petal length, with room for every centre and label. */
export const PLOT_DOMAIN: Domain = { x: [-2.1, 2.7], y: [-1.8, 2.0] };
const X_TITLE = 'sepal length (ölçeklenmiş)';
const Y_TITLE = 'petal length (ölçeklenmiş)';
/** The y title on two lines, for a plot too short to hold it on one. */
const Y_TITLE_LINES = ['petal length', '(ölçeklenmiş)'];
const FONT_FALLBACK: Record<Mode, { tick: number; axis: number }> = { ders: { tick: 18, axis: 19 }, lab: { tick: 13, axis: 14 } };

export interface PlotFonts { tick: number; axis: number }

/** The marks layer a frame hosts: it only has to follow the plot rect and clean up. */
export interface FrameLayer { resize(r: Rect): void; destroy(): void }

/** What differs between pages; every default is the Chapter 7 K-Means value. */
export interface FrameOptions<L extends FrameLayer> {
  domain?: Domain;
  xTitle?: string;
  /** The y title, and the same text on two lines for a plot too short to hold it on one. */
  yTitle?: { text: string; lines: readonly string[] };
  makeLayer?: (parent: SVGGElement, domain: Domain) => L;
}

/**
 * The Chapter 7 scatter frame shared by both pages: axes and a ClusterScatterLayer laid out with
 * equal aspect in the plot host. The axes are redrawn only when the size, mode or fonts change.
 */
export class ClusterPlotFrame<L extends FrameLayer = ClusterScatterLayer> {
  readonly layer: L;
  private readonly domain: Domain;
  private readonly xTitle: string;
  private readonly yTitle: { text: string; lines: readonly string[] };
  private readonly axes: AxesLayer;
  private readonly probe: SVGTextElement;
  /** Measures the y title; kept apart from `probe`, whose class carries the tick font. */
  private readonly measure: TextMeasure;
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
    opts: FrameOptions<L> = {},
  ) {
    this.domain = opts.domain ?? PLOT_DOMAIN;
    this.xTitle = opts.xTitle ?? X_TITLE;
    this.yTitle = opts.yTitle ?? { text: Y_TITLE, lines: Y_TITLE_LINES };
    const svg = select(svgEl);
    this.axes = new AxesLayer(svg.append('g').attr('class', 'axes'));
    const marks = svg.append('g').attr('class', `${prefix}-marks`).node()!;
    // Without makeLayer the layer is a ClusterScatterLayer: the default only holds for L = ClusterScatterLayer.
    this.layer = opts.makeLayer ? opts.makeLayer(marks, this.domain) : (new ClusterScatterLayer(marks, this.domain) as unknown as L);
    this.probe = svg.append('text').attr('class', `${prefix}-probe`)
      .attr('visibility', 'hidden').attr('aria-hidden', 'true').node()!;
    this.measure = new TextMeasure(svg.append('text').attr('class', 'probe')
      .attr('visibility', 'hidden').attr('aria-hidden', 'true').node()!);
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
    const sc = fitEqualAspect(this.domain, avail);
    const plot: Rect = {
      left: sc.x(this.domain.x[0]), top: sc.y(this.domain.y[1]),
      width: sc.x(this.domain.x[1]) - sc.x(this.domain.x[0]), height: sc.y(this.domain.y[0]) - sc.y(this.domain.y[1]),
    };
    const bottom = plot.top + plot.height;
    // A short plot (the narrow single-column layout) gets sparser ticks once they would sit closer
    // than 1.6 tick fonts, and a y title that stays inside the SVG: on two lines when one line is taller
    // than the SVG (and the second line has room on the left), and moved off the plot centre if needed.
    const unit = plot.height / (this.domain.y[1] - this.domain.y[0]);
    const gap = tick * 1.6;
    const titleX = plot.left - 8 - tick * 2.6 - axis * 0.3;
    const titleLen = (text: string): number => this.measure.width(text, 'axis-title', axis);
    const split = titleLen(this.yTitle.text) > h - 4 && titleX - axis * 2 >= 0;
    const lines = split ? [...this.yTitle.lines] : [this.yTitle.text];
    const half = Math.max(...lines.map(titleLen)) / 2 + 2;
    const titleY = Math.min(Math.max(plot.top + plot.height / 2, half), h - half);
    this.axes.draw(sc, plot, {
      xTickCount: unit >= gap ? 6 : 2, yTickCount: unit / 2 >= gap ? 6 : unit >= gap ? 4 : 2,
      xTickY: bottom + tick * 1.15, yTickX: plot.left - 8,
      xTitle: { x: plot.left + plot.width / 2, y: bottom + tick * 1.15 + axis * 1.45, text: this.xTitle },
      yTitle: { x: split ? titleX - axis * 0.6 : titleX, y: titleY, lines },
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
