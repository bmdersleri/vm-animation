import type { Mode } from '../../core/mode';
import { LineChartLayer, type LineChartSpec } from '../../core/plot/line-chart';
import type { TextMeasure } from '../../core/plot/text-measure';
import { logistic } from './calc';
import { META } from './data';
import { cap } from './scenario';
import { HistPairLayer } from './hist-pair';
import { el, legend, makeSvg, NARROW, setLegend, type G, type Svg, type ViewScene } from './scene-base';
import type { DriftPanel, KaymaView } from './view';

const CURVE_POINTS = 45;
/** Smallest svg height (px) of a panel: the histogram and the curve one above the other. */
const MIN_PLOT_H = 300;
/** The svg height (px) of a panel in a tall stage, where the area's own height means nothing. */
const TALL_PLOT_H = 360;

/** What the panel title says about the kind of change. */
export function verdictText(verdict: string): string {
  if (verdict === 'veri kayması') {
    return 'veri kayması: P(X) değişti';
  }
  if (verdict === 'kavram kayması') {
    return 'kavram kayması: P(Y | X) değişti';
  }
  return 'kayma yok: P(X) ve P(Y | X) aynı';
}

/** One panel: title, the histogram pair above the curves, the legend. */
class Panel {
  readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly svg: Svg;
  private readonly measure: TextMeasure;
  private readonly hist: HistPairLayer;
  private readonly curves: LineChartLayer;
  private readonly histG: G;
  private readonly curveG: G;
  private readonly legend: HTMLElement;

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'section', 'drift-panel');
    this.title = el(doc, 'h3', 'drift-title');
    const { svg, measure } = makeSvg(doc, 'drift-plot', 'Ücret histogramı ve ayrılma olasılığı eğrisi');
    this.svg = svg;
    this.measure = measure;
    this.histG = svg.append('g').attr('class', 'drift-hist');
    this.curveG = svg.append('g').attr('class', 'drift-curves');
    this.hist = new HistPairLayer(this.histG, measure);
    this.curves = new LineChartLayer(this.curveG, measure);
    this.legend = legend(doc, 'drift-legend', []);
    this.root.append(this.title, svg.node()!, this.legend);
    host.append(this.root);
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('axes');
    this.svg.selectAll('*').interrupt('hist');
    this.svg.selectAll('*').interrupt('line');
  }

  fonts(mode: Mode): { tick: number; axis: number } {
    return this.measure.fonts(mode);
  }

  update(p: DriftPanel, window: { from: number; to: number }, w: number, h: number, mode: Mode, ms: number): void {
    const fn = this.measure.fonts(mode);
    this.root.dataset.scenario = p.scenario;
    // "Kavram kayması" would read twice: the scenario's name already is the verdict
    const verdict = verdictText(p.verdict);
    this.title.textContent = cap(p.name === p.verdict ? verdict : `${p.name} · ${verdict}`);
    setLegend(this.legend, [
      { swatch: 'sw-hist-ref', text: `ücret, referans (ay 1–${META.refMonths})` },
      { swatch: 'sw-hist-cur', text: `ücret, ay ${window.from}–${window.to}` },
      { swatch: 'sw-curve-ref', text: `eğri, referans (katsayı ${p.coefText.ref})` },
      { swatch: 'sw-curve-refit', text: `eğri, yeniden uydurulan (katsayı ${p.coefText.cur})` },
    ]);
    this.svg.attr('width', w).attr('height', h);
    const half = Math.floor(h / 2);
    this.histG.attr('transform', 'translate(0,0)');
    this.hist.draw(p.refShare, p.curShare, { w, h: half }, fn.tick, fn.axis, ms);
    this.curveG.attr('transform', `translate(0,${half})`);
    const pts = (c: { coef: number; intercept: number }): [number, number][] =>
      Array.from({ length: CURVE_POINTS }, (_v, i) => {
        const x = META.hist.lo + ((META.hist.hi - META.hist.lo) * i) / (CURVE_POINTS - 1);
        return [x, logistic(x, c.coef, c.intercept)];
      });
    const spec: LineChartSpec = {
      x: [META.hist.lo, META.hist.hi],
      y: [0, 1],
      xTitle: 'aylık ücret',
      yTitle: 'P(ayrılma | ücret)',
      yTicks: [0, 0.5, 1],
      series: [
        { id: 'ref', cls: 'curve-ref', pts: pts(p.refCurve) },
        { id: 'refit', cls: 'curve-refit', pts: pts(p.curCurve), dash: '9 6' },
      ],
    };
    this.curves.draw(spec, this.curves.plotRect(w, h - half, spec), ms);
    this.svg.select('.curve-ref').attr('data-coef', p.refCurve.coef);
    this.svg.select('.curve-refit').attr('data-coef', p.curCurve.coef);
  }

  destroy(): void {
    this.interrupt();
    this.root.remove();
  }
}

/**
 * Step 4: one `.drift-panel[data-scenario]` per scenario of the view (the Lab: one). Each holds the fee histogram pair
 * (`HistPairLayer`: `.hist-ref`, `.hist-cur`) above the two churn curves (`.curve-ref`, dashed `.curve-refit`) and a
 * legend that names the coefficients. Two panels side by side; a narrow area stacks them.
 */
export class DriftScene implements ViewScene {
  private readonly root: HTMLDivElement;
  private readonly panels: Panel[] = [];
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';
  private tall = false;

  constructor(private readonly host: HTMLElement) {
    this.root = el(host.ownerDocument, 'div', 'drift-scene');
    host.append(this.root);
  }

  resize(w: number, h: number, mode: Mode, tall: boolean): void {
    this.w = Math.max(1, Math.floor(w));
    this.h = Math.max(1, Math.floor(h));
    this.mode = mode;
    this.tall = tall;
  }

  interrupt(): void {
    this.panels.forEach((p) => p.interrupt());
  }

  destroy(): void {
    this.panels.forEach((p) => p.destroy());
    this.root.remove();
  }

  update(v: KaymaView, ms: number): void {
    const d = v.drift;
    if (!d) {
      return;
    }
    while (this.panels.length < d.panels.length) {
      this.panels.push(new Panel(this.root));
    }
    while (this.panels.length > d.panels.length) {
      this.panels.pop()!.destroy();
    }
    const side = d.panels.length > 1 && this.w >= NARROW;
    const gap = 16;
    const pw = side ? Math.floor((this.w - gap) / 2) : this.w;
    const fs = this.panels[0].fonts(this.mode).tick;
    // title (one or two lines), legend (two to four lines) and paddings around the plot
    const chrome = fs * 1.8 + fs * 1.5 * (side ? 2.4 : 3.2) + 16;
    const stacked = side ? 1 : d.panels.length;
    const free = (this.h - (stacked - 1) * gap) / stacked - chrome;
    const ph = Math.floor(this.tall ? TALL_PLOT_H : Math.max(MIN_PLOT_H, free));
    d.panels.forEach((p, i) => this.panels[i].update(p, d.window, pw, ph, this.mode, ms));
  }
}
