import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import { scaleLinear, type ScaleLinear } from 'd3-scale';
import { tr } from '../../core/plot/transition';
import { formatNumber, tickFormat } from '../../core/plot/format';
import { FRAME, GRID, NAVY, WHITE, r1 } from '../../core/plot/marks';
import type { Rect, Scales } from '../../core/plot/viewport';
import { sweep, toSamples, type Split, type SweepPoint, type TreeNode } from './cart';
import { DOMAIN, train } from './data';
import { impurity, type Criterion } from './impurity';
import type { TreeParams } from './scenario';
import type { TreeView } from './view';
import { AXIS_NAMES, fmtThreshold } from './scene-tree';

/** Transition names of the threshold lines and the curve panel. */
export const LINES_T = 'lines';
export const CURVE_T = 'curve';

const trainSamples = toSamples(train);
const AXIS_LOWER = ['sözleşme', 'şikâyet'] as const;
const measureName = (k: Criterion): string => (k === 'gini' ? 'Gini' : 'Entropi');
const imp = (x: number): string => formatNumber(x, 3);

const ranges = new Map<Criterion, [number, number]>();
/**
 * Vertical range of the curve panel, the same for both axes' scans: from 0,1
 * below the lowest candidate to the root impurity rounded up to 0,1 (a split
 * never raises the weighted impurity above the root's).
 */
function curveRange(k: Criterion): [number, number] {
  let r = ranges.get(k);
  if (!r) {
    const all = [...sweep(trainSamples, 0, k), ...sweep(trainSamples, 1, k)].map((q) => q.impurity);
    const n1 = trainSamples.filter((q) => q.y === 1).length;
    const root = impurity([trainSamples.length - n1, n1], k);
    r = [Math.max(0, Math.floor(Math.min(...all) * 10) / 10 - 0.1), Math.ceil(root * 10 - 1e-9) / 10];
    ranges.set(k, r);
  }
  return r;
}
const tickText = (v: number): string => (v === 0 ? '0' : formatNumber(v, 1));

type Threshold = { feature: 0 | 1; threshold: number };

// ------------------------------------------------------------------ lines on the scatter

export interface LinesModel {
  /** Scan line (step 8) or the Lab line (userSplit). */
  scan: Threshold | null;
  /** The tree's own root split; faint while a Lab line replaces it. */
  chosen: Threshold | null;
  faintChosen: boolean;
  /** Splits of the deeper internal nodes, clipped to their node's box. */
  splits: { id: string; feature: 0 | 1; threshold: number; box: TreeNode['box'] }[];
}

export function linesModel(v: TreeView, p: TreeParams): LinesModel {
  const user = p.userSplit;
  const root = v.tree?.split ?? null;
  const splits: LinesModel['splits'] = [];
  if (!user && v.tree) {
    const walk = (n: TreeNode, id: string): void => {
      if (!n.split || !n.left || !n.right) return;
      if (id !== 'r') splits.push({ id, feature: n.split.feature, threshold: n.split.threshold, box: n.box });
      walk(n.left, `${id}L`);
      walk(n.right, `${id}R`);
    };
    walk(v.tree, 'r');
  }
  const chosen: Split | null = user ? v.chosen : root;
  return {
    scan: user ? { feature: user.feature, threshold: user.threshold } : v.scanLine,
    chosen: chosen ? { feature: chosen.feature, threshold: chosen.threshold } : null,
    faintChosen: user !== null,
    splits,
  };
}

/** End points of a threshold line across `box` (data space) in px. */
function ends(t: Threshold, box: TreeNode['box'], sc: Scales): [number, number, number, number] {
  if (t.feature === 0) {
    const x = r1(sc.x(t.threshold));
    return [x, r1(sc.y(box.y[0])), x, r1(sc.y(box.y[1]))];
  }
  const y = r1(sc.y(t.threshold));
  return [r1(sc.x(box.x[0])), y, r1(sc.x(box.x[1])), y];
}

const FULL: TreeNode['box'] = { x: [DOMAIN.x[0], DOMAIN.x[1]], y: [DOMAIN.y[0], DOMAIN.y[1]] };

export function drawLines(
  g: Selection<SVGGElement, unknown, null, undefined>, m: LinesModel, sc: Scales, ms: number,
): void {
  const one = (cls: string, t: Threshold | null, width: number, dash: string | null, opacity: number): void => {
    // keyed by axis: switching from the contract to the complaint axis swaps the line
    const [x1, y1, x2, y2] = t ? ends(t, FULL, sc) : [0, 0, 0, 0];
    const sel = g.selectAll<SVGLineElement, Threshold>(`line.${cls}`).data(t ? [t] : [], (d) => `f${d.feature}`).join(
      (enter) => enter.append('line').attr('class', cls).attr('stroke', NAVY).attr('opacity', 0)
        .attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2),
      (update) => update,
      (exit) => { tr(exit, LINES_T, ms).attr('opacity', 0).remove(); },
    );
    sel.attr('stroke-width', width).attr('stroke-dasharray', dash);
    // one transition per element: a second one with the same name would cancel the first
    tr(sel, LINES_T, ms).attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2).attr('opacity', opacity);
  };
  one('chosen', m.chosen, m.faintChosen ? 2 : 3, m.faintChosen ? '6 6' : null, m.faintChosen ? 0.4 : 1);
  one('scan', m.scan, 3, null, 1);

  const splits = g.selectAll<SVGLineElement, LinesModel['splits'][number]>('line.split').data(m.splits, (d) => d.id).join(
    (enter) => enter.append('line').attr('class', 'split').attr('stroke', NAVY).attr('stroke-width', 2).attr('opacity', 0)
      .each(function (d) {
        const [x1, y1, x2, y2] = ends(d, d.box, sc);
        select(this).attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2);
      }),
    (update) => update,
    (exit) => { tr(exit, LINES_T, ms).attr('opacity', 0).remove(); },
  );
  splits.each(function (d) {
    const [x1, y1, x2, y2] = ends(d, d.box, sc);
    tr(select(this), LINES_T, ms).attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2).attr('opacity', 0.8);
  });
}

// ------------------------------------------------------------------ curve panel

export interface CurveModel {
  feature: 0 | 1;
  points: SweepPoint[];
  /** Index of the last point drawn. */
  upTo: number;
  dot: SweepPoint;
  /** The tree's own threshold on this curve (Lab line moved away from it). */
  mark: SweepPoint | null;
  /** Corner note: the contract curve's best during the complaint scan, or the tree's choice. */
  note: string | null;
}

export function curveModel(v: TreeView, p: TreeParams): CurveModel | null {
  const k = v.criterion;
  const user = p.userSplit;
  if (user && v.tree?.split) {
    const points = sweep(trainSamples, user.feature, k);
    const c = v.chosen;
    const same = c !== null && c.feature === user.feature;
    return {
      feature: user.feature,
      points,
      upTo: points.length - 1,
      dot: { threshold: user.threshold, impurity: v.tree.split.impurity },
      mark: same ? { threshold: c.threshold, impurity: c.impurity } : null,
      note: c && !same ? `Ağacın seçimi: ${AXIS_NAMES[c.feature]} ≤ ${fmtThreshold(c.threshold)} → ${imp(c.impurity)}` : null,
    };
  }
  if (!v.curve) return null;
  const { feature, points, upTo, otherBest } = v.curve;
  return {
    feature,
    points,
    upTo,
    dot: points[upTo],
    mark: null,
    note: otherBest ? `Sözleşme en iyisi: ≤ ${fmtThreshold(otherBest.threshold)} → ${imp(otherBest.impurity)}` : null,
  };
}

export interface CurveLayout {
  width: number;
  height: number;
  /** Curve area inside the panel svg. */
  plot: Rect;
  tickPx: number;
  axisPx: number;
  gap: number;
  ptR: number;
}

/**
 * The impurity curve under the scatter (`svg.curve`). Its horizontal axis is the
 * scatter's: contract thresholds line up with the vertical scan line above;
 * during the complaint scan the same width shows complaint thresholds and the
 * title says so. The y axis spans the candidates' impurities (curveRange).
 */
export class CurvePanel {
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly frame: Selection<SVGRectElement, unknown, null, undefined>;
  private readonly gx: Selection<SVGGElement, unknown, null, undefined>;
  private readonly gy: Selection<SVGGElement, unknown, null, undefined>;
  private readonly title: Selection<SVGTextElement, unknown, null, undefined>;
  private readonly best: Selection<SVGTextElement, unknown, null, undefined>;
  private readonly gCurve: Selection<SVGGElement, unknown, null, undefined>;

  constructor(svgEl: SVGSVGElement) {
    this.svg = select(svgEl);
    this.frame = this.svg.append('rect').attr('class', 'frame').attr('fill', 'none').attr('stroke', FRAME);
    this.gy = this.svg.append('g').attr('class', 'axis y');
    this.gx = this.svg.append('g').attr('class', 'axis x');
    this.title = this.svg.append('text').attr('class', 'axis-title curve-title');
    this.best = this.svg.append('text').attr('class', 'curve-best').attr('text-anchor', 'end');
    this.gCurve = this.svg.append('g').attr('class', 'curve-g');
  }

  update(m: CurveModel | null, k: Criterion, L: CurveLayout, xScatter: ScaleLinear<number, number>, ms: number): void {
    const { plot } = L;
    const bottom = plot.top + plot.height;
    const right = plot.left + plot.width;
    const show = m !== null;
    this.svg.attr('width', L.width).attr('height', L.height);
    this.frame.attr('x', plot.left).attr('y', plot.top).attr('width', plot.width).attr('height', plot.height)
      .attr('opacity', show ? 1 : 0);

    const [ylo, yhi] = curveRange(k);
    const y = scaleLinear().domain([ylo, yhi]).range([bottom, plot.top]);
    const x = m?.feature === 1
      ? scaleLinear().domain(DOMAIN.y).range([plot.left, right])
      : xScatter;

    // y ticks: the two ends of the range
    const yt = show ? [ylo, yhi] : [];
    const ys = this.gy.selectAll<SVGGElement, number>('g.tick').data(yt).join((enter) => {
      const g = enter.append('g').attr('class', 'tick');
      g.append('line').attr('stroke', GRID);
      g.append('text').attr('text-anchor', 'end').attr('dy', '0.35em');
      return g;
    });
    ys.attr('transform', (d) => `translate(0,${r1(y(d))})`);
    ys.select('line').attr('x1', plot.left).attr('x2', right);
    ys.select('text').attr('x', r1(plot.left - L.gap)).text((d) => tickText(d));

    // x ticks: the scatter's contract ticks, or complaint counts 0-5
    const xt = !show ? [] : m.feature === 1 ? [0, 1, 2, 3, 4, 5] : x.ticks(Math.max(2, Math.round(plot.width / (L.tickPx * 6))));
    const fx = tickFormat(xt);
    const xs = this.gx.selectAll<SVGGElement, number>('g.tick').data(xt, (d) => `${m?.feature}:${d}`).join((enter) => {
      const g = enter.append('g').attr('class', 'tick');
      g.append('text').attr('text-anchor', 'middle');
      return g;
    });
    xs.attr('transform', (d) => `translate(${r1(x(d))},0)`);
    xs.select('text').attr('y', r1(bottom + L.gap * 0.6 + L.tickPx * 0.9)).text((d) => fx(d));

    this.title.attr('x', r1(plot.left)).attr('y', r1(plot.top - L.gap * 0.6))
      .text(show ? `${measureName(k)} — ${AXIS_LOWER[m.feature]} eşikleri` : '');
    this.best.attr('x', r1(right)).attr('y', r1(plot.top - L.gap * 0.6)).text(m?.note ?? '');

    // the curve up to the scanned point, its dot and (Lab) the tree's own mark
    const pts = show ? m.points.slice(0, m.upTo + 1) : [];
    const d = pts.map((q, i) => `${i ? 'L' : 'M'}${r1(x(q.threshold))},${r1(y(q.impurity))}`).join('');
    const line = this.gCurve.selectAll<SVGPathElement, string>('path.curve-line').data(show ? [d] : []).join(
      (enter) => enter.append('path').attr('class', 'curve-line').attr('fill', 'none')
        .attr('stroke', NAVY).attr('stroke-width', 3).attr('stroke-linejoin', 'round'),
    );
    line.attr('d', (s) => s);

    const mark = this.gCurve.selectAll<SVGCircleElement, SweepPoint>('circle.curve-chosen').data(m?.mark ? [m.mark] : []).join(
      (enter) => enter.append('circle').attr('class', 'curve-chosen').attr('fill', WHITE)
        .attr('stroke', NAVY).attr('stroke-width', 2).attr('stroke-dasharray', '3 3'),
    );
    mark.attr('r', r1(L.ptR * 1.1)).attr('cx', (q) => r1(x(q.threshold))).attr('cy', (q) => r1(y(q.impurity)));

    // keyed by axis: the dot starts afresh on the complaint curve instead of gliding over
    const dot = this.gCurve.selectAll<SVGCircleElement, SweepPoint & { f: 0 | 1 }>('circle.curve-dot')
      .data(show ? [{ ...m.dot, f: m.feature }] : [], (q) => q.f).join(
      (enter) => enter.append('circle').attr('class', 'curve-dot').attr('fill', NAVY).attr('stroke', WHITE).attr('stroke-width', 2)
        .attr('cx', (q) => r1(x(q.threshold))).attr('cy', (q) => r1(y(q.impurity))),
    );
    dot.attr('r', r1(L.ptR * 0.8));
    tr(dot, CURVE_T, ms).attr('cx', (q) => r1(x(q.threshold))).attr('cy', (q) => r1(y(q.impurity)));
  }
}
