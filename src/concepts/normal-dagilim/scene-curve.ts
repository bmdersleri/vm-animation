import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import type { Mode } from '../../core/mode';
import { NumberLineLayer, lineScale, staggerRows } from '../../core/plot/number-line';
import { TextMeasure } from '../../core/plot/text-measure';
import { curvePath, areaPath } from '../../core/plot/density';
import { trianglePath, r1 } from '../../core/plot/marks';
import { diamondPath } from '../../core/plot/dots-path';
import { formatTrim, formatPercent } from '../../core/plot/format';
import { normPdf } from '../../core/stats';
import type { NormalView } from './view';

/** Duration of one authored reveal in milliseconds (scaled by the caller). */
export const MS_STEP = 450;
// SVG namespace for createElementNS
const NS = 'http://www.w3.org/2000/svg';

type G = Selection<SVGGElement, unknown, null, undefined>;

/** Density geometry stays in data coordinates until each layout; labels use measured rows. */
export class CurveLayer {
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly plot: G;
  private readonly axes: G;
  private readonly labels: G;
  private readonly measure: TextMeasure;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const root = host.ownerDocument.createElementNS(NS, 'svg');
    host.append(root);
    this.svg = select(root)
      .attr('class', 'normal-plot')
      .attr('role', 'img')
      .attr('aria-label', 'Yoğunluk histogramı ve normal dağılım eğrisi');
    this.plot = this.svg.append('g').attr('class', 'density-layer');
    this.axes = this.svg.append('g').attr('class', 'axes');
    this.labels = this.svg.append('g').attr('class', 'labels');
    const probe = this.svg
      .append('text')
      .attr('class', 'probe')
      .attr('visibility', 'hidden')
      .attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
  }

  resize(w: number, h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.mode = mode;
    this.svg.attr('width', this.w).attr('height', this.h);
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('normal').interrupt('axes');
  }

  destroy(): void {
    this.interrupt();
    this.svg.remove();
  }

  update(v: NormalView, ms: number, k = 1): void {
    this.interrupt();
    this.svg.attr('data-view', v.stepId);
    const f = this.measure.fonts(this.mode),
      tick = f.tick;
    const margin = Math.max(24, tick * 2),
      top = tick * 2.5;
    const secondary = v.zAxis && !v.scaled;
    let linkRows = 0,
      fitsOneRow = true,
      linkWidths: number[] = [];
    if (v.links.length) {
      linkWidths = v.links.map((l) => this.measure.width(l.label, 'scene-link', tick));
      const total = linkWidths.reduce((a, b) => a + b, 0) + tick * 3 * (v.links.length - 1);
      fitsOneRow = total <= this.w - margin * 2;
      if (fitsOneRow) {
        linkRows = 1;
      } else {
        let curX = margin,
          curRows = 1;
        v.links.forEach((l, i) => {
          const w = linkWidths[i];
          const lines = this.measure.wrap(l.label, this.w - margin * 2, 'scene-link', tick);
          if (i > 0 && curX + w > this.w - margin) {
            curX = margin;
            curRows += 1;
          }
          curX += w + tick * 3;
          curRows += lines.length - 1;
        });
        linkRows = curRows;
      }
    }
    // Reserve a separate title lane: SVG text boxes exceed their nominal font size.
    const footerTicks = secondary ? 7.6 : v.links.length ? 4.8 + linkRows * 1.5 : 4.4;
    const base = Math.max(top + 45, this.h - tick * footerTicks);
    const sx = lineScale({ min: v.domain[0], max: v.domain[1] }, [margin, Math.max(margin + 40, this.w - margin)]);
    const curves = v.curve ? [v.curve, ...v.ghosts.map((g) => ({ mu: v.curve!.mu, sigma: g.sigma }))] : [];
    const peak =
      Math.max(...v.bins.map((b) => b.density), ...curves.map((c) => normPdf(c.mu, c.mu, c.sigma)), 0.001) * 1.08;
    const sy = (y: number) => base - (y / peak) * (base - top);
    const pdf = (x: number) => normPdf(x, v.curve!.mu, v.curve!.sigma);
    const hist = v.bins
      .map((b) => {
        const x = r1(sx(b.lo) + 1),
          right = r1(Math.max(x, sx(b.hi) - 1)),
          y = r1(sy(b.density));
        return `M${x},${r1(base)}L${x},${y}L${right},${y}L${right},${r1(base)}Z`;
      })
      .join('');
    this.plot
      .selectAll<SVGPathElement, string>('path.hist-bar')
      .data([hist])
      .join('path')
      .attr('class', 'hist-bar')
      .attr('d', (d) => d);
    const visibleBands = v.stepId === 'carpik' || this.mode === 'lab' ? v.bands.filter((b) => b.k === k) : v.bands;
    const bands = [...visibleBands].reverse();
    this.plot
      .selectAll<SVGPathElement, NormalView['bands'][number]>('path.band')
      .data(bands, (d) => d.k)
      .join('path')
      .attr('class', (d) => `band k${d.k}${d.k === k ? ' selected' : ''}`)
      .attr('d', (d) => areaPath(pdf, Math.max(v.domain[0], d.lo), Math.min(v.domain[1], d.hi), 101, sx, sy, base));
    this.plot
      .selectAll<SVGPathElement, NonNullable<NormalView['area']>>('path.area')
      .data(v.area ? [v.area] : [])
      .join('path')
      .attr('class', 'area')
      .attr('d', (d) => areaPath(pdf, d.a, d.b, 101, sx, sy, base));
    this.plot
      .selectAll<SVGPathElement, NonNullable<NormalView['curve']>>('path.curve')
      .data(v.curve ? [v.curve] : [])
      .join('path')
      .attr('class', 'curve')
      .attr('d', (c) => curvePath((x) => normPdf(x, c.mu, c.sigma), v.domain[0], v.domain[1], 201, sx, sy));
    this.plot
      .selectAll<SVGPathElement, NormalView['ghosts'][number]>('path.ghost')
      .data(v.ghosts, (d) => d.sigma)
      .join('path')
      .attr('class', 'ghost')
      .attr('d', (c) => curvePath((x) => normPdf(x, v.curve!.mu, c.sigma), v.domain[0], v.domain[1], 201, sx, sy));
    // Core number lines own all ticks and numeric formatting, including aligned integer z ticks.
    this.axes.selectAll('*').remove();
    const axis = this.axes.append('g').attr('class', v.scaled ? 'z-axis' : 'x-axis');
    new NumberLineLayer(axis).draw(
      sx,
      base,
      {
        tickCount: this.w > 700 ? 8 : 5,
        tickY: base + tick * 1.4,
        title: v.scaled
          ? `z · n = ${v.values.length}`
          : `${v.seri === 'sinav' ? 'Sınav notu (puan)' : 'Çağrı süresi (dakika)'} · n = ${v.values.length}`,
        titleY: base + tick * 2.8,
      },
      0,
      v.stepId,
    );
    if (secondary) {
      const z = lineScale({ min: (v.domain[0] - v.mean) / v.std, max: (v.domain[1] - v.mean) / v.std }, sx.range);
      z.ticks = () => [-3, -2, -1, 0, 1, 2, 3].filter((d) => d >= z.spec.min && d <= z.spec.max);
      new NumberLineLayer(this.axes.append('g').attr('class', 'z-axis')).draw(
        z,
        base + tick * 3.7,
        { tickCount: 7, tickY: base + tick * 5.1, title: 'z', titleY: base + tick * 6.9 },
        0,
        `${v.stepId}-z`,
      );
    }
    this.labels.selectAll('*').remove();
    const labels: { x: number; y: number; text: string; cls: string }[] = [];
    for (const b of visibleBands)
      labels.push({
        x: sx(v.mean),
        y: top,
        text: `±${b.k}σ: ${formatPercent(b.theory)} (örneklem ${formatPercent(b.sample)})`,
        cls: `band-label k${b.k}`,
      });
    const showMedian = ['histogram', 'carpik'].includes(v.stepId);
    const rawMean = v.curve?.mu ?? v.mean;
    const cleanMean = Math.abs(rawMean) < 1e-12 ? 0 : rawMean;
    const markItems: { kind: 'mean' | 'median' | 'marker'; x: number; text: string; cls: string }[] = [
      { kind: 'mean', x: cleanMean, text: `ortalama ${formatTrim(cleanMean, 1)}`, cls: 'mark-label' },
      ...(showMedian
        ? [{ kind: 'median' as const, x: v.median, text: `medyan ${formatTrim(v.median, 1)}`, cls: 'mark-label' }]
        : []),
      ...(v.marker
        ? [
            {
              kind: 'marker' as const,
              x: v.marker.x,
              text: `x = ${formatTrim(v.marker.x, 1)} · z = ${formatTrim(v.marker.z, 2)}`,
              cls: 'marker-label',
            },
          ]
        : []),
    ];
    const pad = 6;
    const markBoxes = markItems.map((m) => {
      const w = this.measure.width(m.text, m.cls, tick);
      const targetX = sx(m.x);
      const minX = pad + w / 2;
      const maxX = Math.max(minX, this.w - pad - w / 2);
      const clampedX = Math.max(minX, Math.min(maxX, targetX));
      return { w, x: clampedX, targetX };
    });
    const rows = staggerRows(markBoxes, 10);
    markItems.forEach((m, i) => {
      const b = markBoxes[i];
      const y = top + (rows[i] + 1) * tick * 1.5;
      if (m.kind === 'marker') {
        this.labels
          .append('line')
          .attr('class', 'marker')
          .attr('x1', b.targetX)
          .attr('x2', b.targetX)
          .attr('y1', top)
          .attr('y2', base);
        this.labels
          .append('text')
          .attr('class', 'marker-label')
          .attr('text-anchor', 'middle')
          .attr('x', r1(b.x))
          .attr('y', y)
          .text(m.text);
      } else {
        const g = this.labels
          .append('g')
          .attr('class', `mark ${m.kind}`)
          .attr('transform', `translate(${r1(b.targetX)},0)`);
        g.append('line').attr('class', `mark-${m.kind}`).attr('y1', top).attr('y2', base);
        g.append('path')
          .attr('class', 'mark-cap')
          .attr('d', m.kind === 'mean' ? trianglePath(5) : diamondPath(0, 0, 5))
          .attr('transform', `translate(0,${r1(base)})`);
        g.append('text')
          .attr('class', 'mark-label')
          .attr('text-anchor', 'middle')
          .attr('x', r1(b.x - b.targetX))
          .attr('y', y)
          .text(m.text);
      }
    });
    // Band rows reserve their own header lane, away from mean/median/marker labels.
    const headerOffset = Math.max(...rows) + 3;
    const labelRows = staggerRows(
      labels.map((l) => ({ x: l.x, w: this.measure.width(l.text, l.cls, tick) })),
      10,
    );
    labels.forEach((l, i) => {
      const lines = this.measure.wrap(l.text, this.w - margin * 2, l.cls, tick);
      const width = Math.min(this.w - margin * 2, this.measure.width(l.text, l.cls, tick));
      const minX = pad + width / 2;
      const maxX = Math.max(minX, this.w - pad - width / 2);
      const x = Math.max(minX, Math.min(maxX, l.x));
      const text = this.labels.append('text').attr('class', l.cls).attr('text-anchor', 'middle');
      lines.forEach((line, j) =>
        text
          .append('tspan')
          .attr('x', x)
          .attr('y', top + (labelRows[i] * lines.length + j + headerOffset) * tick * 1.35)
          .text(line),
      );
    });
    // Each ghost label sits on its own curve, text just outside it: at the inflection point (mu ± sigma), or further
    // down the flank where that point is above the mean / median / marker lane. Right flank first, the mirrored left
    // flank when the right one has no room; only a label with room on neither side is clamped to the SVG.
    const ghostTop = top + (Math.max(...rows) + 1) * tick * 1.5 + tick;
    // Density at the lane floor; a curve point below it on screen leaves room for the text above it.
    const floor = ((base - ghostTop - 4) / (base - top)) * peak;
    for (const g of v.ghosts) {
      const mu = v.curve!.mu;
      const text = `σ = ${formatTrim(g.sigma, 0)}`;
      const width = this.measure.width(text, 'ghost-label', tick);
      // Anchor distance in sigmas: where the curve falls to the floor density, never inside the inflection point.
      const ratio = floor * g.sigma * Math.sqrt(2 * Math.PI);
      const d = ratio < 1 ? Math.max(1, Math.sqrt(-2 * Math.log(ratio))) : 1;
      const right = sx(mu + d * g.sigma) + 6;
      const left = sx(mu - d * g.sigma) - 6;
      const onRight = right + width <= this.w - pad || left - width < pad;
      const x = onRight ? Math.max(pad, Math.min(this.w - pad - width, right)) : left;
      const y = Math.max(ghostTop, sy(normPdf(mu + d * g.sigma, mu, g.sigma)) - 4);
      this.labels
        .append('text')
        .attr('class', 'ghost-label')
        .attr('text-anchor', onRight ? 'start' : 'end')
        .append('tspan')
        .attr('x', r1(x))
        .attr('y', r1(y))
        .text(text);
    }
    if (v.links.length) {
      let y = base + tick * 4.2;
      const total = linkWidths.reduce((a, b) => a + b, 0) + tick * 3 * (v.links.length - 1);
      let x = fitsOneRow ? Math.max(margin, (this.w - total) / 2) : margin;
      v.links.forEach((l, i) => {
        if (!fitsOneRow && i > 0 && x + linkWidths[i] > this.w - margin) {
          x = margin;
          y += tick * 1.5;
        }
        const a = this.labels.append('a').attr('class', 'scene-link').attr('href', l.href).attr('aria-label', l.label);
        const text = a.append('text');
        const lines = this.measure.wrap(l.label, this.w - margin * 2, 'scene-link', tick);
        lines.forEach((line, j) =>
          text
            .append('tspan')
            .attr('x', x)
            .attr('y', y + j * tick * 1.5)
            .text(line),
        );
        x += linkWidths[i] + tick * 3;
        y += (lines.length - 1) * tick * 1.5;
      });
    }
    // One authored reveal; parameters and reduced-motion renders always receive ms=0.
    if (ms > 0)
      this.plot
        .attr('opacity', 0.7)
        .transition('normal')
        .duration(ms)
        .ease((t) => 1 - Math.pow(1 - t, 3))
        .attr('opacity', 1);
    else this.plot.attr('opacity', 1);
  }
}
