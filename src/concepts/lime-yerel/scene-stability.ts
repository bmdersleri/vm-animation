import { scaleLinear } from 'd3-scale';
import { select, type Selection } from 'd3-selection';
import type { Mode } from '../../core/mode';
import { tickFormat } from '../../core/plot/format';
import { r1 } from '../../core/plot/marks';
import { TextMeasure } from '../../core/plot/text-measure';
import { tr } from '../../core/plot/transition';
import { el, NARROW, NS, type ViewScene } from './scene-base';
import type { LimeView, StabGroup, StabRow } from './view';

/** Vertical room (px) the scene keeps: root padding (wide / narrow) and the gap between two feature groups. */
export const STAB_PAD_V = 16;
export const STAB_PAD_V_NARROW = 8;
export const STAB_GAP = 10;
export const STAB_GAP_NARROW = 6;

type G = Selection<SVGGElement, unknown, null, undefined>;

/** Geometry of the strip for one stage size: fonts, row pitch and the x range the dots may take. */
interface Geometry {
  narrow: boolean;
  fs: number;
  lh: number;
  r: number;
  rowH: number;
  groupH: number;
  gap: number;
  padV: number;
  width: number;
  xa: number;
  xb: number;
  labelW: number;
  rangeW: number;
}

/**
 * Step 8: for each of the three features two rows of eleven dots, one dot per seed. The first row is the 5000-sample
 * run, the second the other sample size (50 in the Ders, the Lab's choice otherwise); both rows of a feature share one
 * coefficient axis, so a wide spread of the 50-sample row is visible against the narrow 5000-sample one. Each row
 * writes its range (`.stab-range`); the seed-42 dot, the book run, carries a ring (`.stab-ring`). Dots are navy: the
 * orange / blue pair is kept for the sign of a coefficient, which the position on the axis already shows.
 */
export class StabilityScene implements ViewScene {
  private readonly root: HTMLDivElement;
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly gGroups: G;
  private readonly measure: TextMeasure;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'stability-scene');
    const svg = doc.createElementNS(NS, 'svg');
    this.svg = select(svg)
      .attr('class', 'stab-plot')
      .attr('role', 'img')
      .attr('aria-label', 'Her özellik için on bir tohumun katsayısı, iki örnek sayısında');
    this.gGroups = this.svg.append('g').attr('class', 'stab-groups');
    const probe = this.svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
    this.root.append(svg);
    host.append(this.root);
  }

  resize(w: number, h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.mode = mode;
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('stab');
  }

  destroy(): void {
    this.interrupt();
    this.root.remove();
  }

  update(v: LimeView, ms: number): void {
    const s = v.stability;
    if (!s) {
      return;
    }
    const geo = this.geometry(s.groups);
    this.root.dataset.used = String(Math.ceil(geo.padV + s.groups.length * geo.groupH + (s.groups.length - 1) * geo.gap));
    this.svg.attr('width', geo.width).attr('height', Math.ceil(Number(this.root.dataset.used) - geo.padV));
    this.draw(s.groups, geo, ms);
  }

  private geometry(groups: StabGroup[]): Geometry {
    const narrow = this.w < NARROW;
    const fs = this.measure.fonts(this.mode).tick;
    const lh = fs * 1.3;
    const r = Math.max(4, fs * 0.28);
    const width = Math.max(240, this.w - (narrow ? 8 : 24));
    const labels = groups.flatMap((g) => g.rows.map((row) => row.label));
    const ranges = groups.flatMap((g) => g.rows.map((row) => row.rangeText));
    const labelW = this.measure.maxWidth(labels, 'tick', fs);
    const rangeW = this.measure.maxWidth(ranges, 'tick', fs);
    // wide: label | dots | range on one line; narrow: label and range on a line above the dots
    const rowH = narrow ? lh + 2 * r + 8 : Math.max(lh * 1.4, 2 * r + 10);
    const groupH = lh + 2 * rowH + lh * 1.15;
    const xa = narrow ? 14 : labelW + 24;
    const xb = narrow ? width - 14 : width - rangeW - 20;
    return {
      narrow,
      fs,
      lh,
      r,
      rowH,
      groupH,
      gap: narrow ? STAB_GAP_NARROW : STAB_GAP,
      padV: narrow ? STAB_PAD_V_NARROW : STAB_PAD_V,
      width,
      xa,
      xb,
      labelW,
      rangeW,
    };
  }

  private draw(groups: StabGroup[], geo: Geometry, ms: number): void {
    const sel = this.gGroups
      .selectAll<SVGGElement, StabGroup>('g.stab-group')
      .data(groups, (d) => String(d.feature))
      .join((enter) => enter.append('g').attr('class', 'stab-group'))
      .attr('data-feature', (d) => d.feature)
      .attr('transform', (_d, i) => `translate(0,${r1(i * (geo.groupH + geo.gap))})`);
    const self = this;
    sel.each(function (g) {
      self.drawGroup(select(this) as G, g, geo, ms);
    });
  }

  private drawGroup(group: G, g: StabGroup, geo: Geometry, ms: number): void {
    const { fs, lh, r, rowH, xa, xb, width, narrow } = geo;
    const x = scaleLinear().domain(g.domain).range([xa, xb]);
    // feature name
    group
      .selectAll<SVGTextElement, string>('text.stab-name')
      .data([g.name])
      .join('text')
      .attr('class', 'stab-name')
      .attr('x', narrow ? 4 : 0)
      .attr('y', r1(fs))
      .text((d) => d);

    // rows
    const rows = group
      .selectAll<SVGGElement, StabRow>('g.stab-row')
      .data(g.rows, (_d, i) => String(i))
      .join((enter) => {
        const row = enter.append('g').attr('class', 'stab-row');
        row.append('rect').attr('class', 'stab-band');
        row.append('line').attr('class', 'stab-span');
        row.append('text').attr('class', 'stab-label');
        row.append('text').attr('class', 'stab-range').attr('text-anchor', 'end');
        return row;
      })
      .attr('class', (d) => `stab-row${d.selected ? ' is-selected' : ''}`)
      .attr('data-samples', (d) => d.samples)
      .attr('transform', (_d, i) => `translate(0,${r1(lh + i * rowH)})`);
    const dotY = narrow ? lh + r + 2 : rowH / 2;
    const textY = narrow ? lh * 0.8 : rowH / 2;
    rows
      .select('rect.stab-band')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', width)
      .attr('height', r1(rowH - 2))
      .attr('rx', 4);
    rows
      .select('text.stab-label')
      .attr('x', 4)
      .attr('y', r1(textY))
      .attr('dy', '0.35em')
      .text((d) => d.label);
    rows
      .select('text.stab-range')
      .attr('x', r1(width - 4))
      .attr('y', r1(textY))
      .attr('dy', '0.35em')
      .text((d) => d.rangeText);
    rows
      .select('line.stab-span')
      .attr('y1', r1(dotY))
      .attr('y2', r1(dotY))
      .attr('x1', (d) => r1(x(d.min)))
      .attr('x2', (d) => r1(x(d.max)));

    // dots: one per seed, keyed by the seed
    rows.each(function (row) {
      const dots = select(this)
        .selectAll<SVGCircleElement, StabRow['dots'][number]>('circle.stab-dot')
        .data(row.dots, (d) => String(d.seed))
        .join((enter) => enter.append('circle').attr('cx', (d) => r1(x(d.value))))
        .attr('class', (d) => `stab-dot${d.book ? ' is-book' : ''}`)
        .attr('data-seed', (d) => d.seed)
        .attr('data-value', (d) => d.value)
        .attr('cy', r1(dotY))
        .attr('r', r1(r));
      tr(dots, 'stab', ms).attr('cx', (d) => r1(x((d as { value: number }).value)));
      const book = row.dots.filter((d) => d.book);
      const ring = select(this)
        .selectAll<SVGCircleElement, StabRow['dots'][number]>('circle.stab-ring')
        .data(book, (d) => String(d.seed))
        .join((enter) => enter.append('circle').attr('cx', (d) => r1(x(d.value))))
        .attr('class', 'stab-ring')
        .attr('cy', r1(dotY))
        .attr('r', r1(r + 4));
      tr(ring, 'stab', ms).attr('cx', (d) => r1(x((d as { value: number }).value)));
    });

    // shared coefficient axis under the two rows
    const ticks = x.ticks(narrow ? 4 : 6);
    const fmt = tickFormat(ticks);
    const axisY = lh + 2 * rowH + 2;
    group
      .selectAll<SVGLineElement, number>('line.stab-axis')
      .data([axisY])
      .join('line')
      .attr('class', 'stab-axis')
      .attr('x1', r1(xa))
      .attr('x2', r1(xb))
      .attr('y1', (d) => r1(d))
      .attr('y2', (d) => r1(d));
    group
      .selectAll<SVGTextElement, number>('text.stab-tick')
      .data(ticks, (d) => String(d))
      .join('text')
      .attr('class', 'stab-tick')
      .attr('text-anchor', 'middle')
      .attr('x', (d) => r1(x(d)))
      .attr('y', r1(axisY + lh * 0.95))
      .text((d) => fmt(d));
  }
}
