import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import type { Mode } from '../../core/mode';
import { HBarsLayer, type HBar } from '../../core/plot/hbars';
import { formatNumber } from '../../core/plot/format';
import { r1 } from '../../core/plot/marks';
import { TextMeasure } from '../../core/plot/text-measure';
import type { ImportanceColumn, ImportanceView, RfView } from './view';

const NS = 'http://www.w3.org/2000/svg';
type G = Selection<SVGGElement, unknown, null, undefined>;

const PAD = 12;
/** Below this width the two columns stack. */
const SIDE_BY_SIDE = 700;

/**
 * Importance scene (steps 9-10): horizontal importance bars, largest on top. Step 9 draws one MDI column; step 10
 * draws the MDI and permutation columns of the split model (each sorted by itself, the meaningless id column
 * highlighted), the causality sentence and the links to the neighbouring pages.
 */
export class ImportanceScene {
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly cols: Record<'mdi' | 'perm', { g: G; bars: HBarsLayer }>;
  private readonly footG: G;
  private readonly measure: TextMeasure;
  private w = 1;
  private h = 1;
  /** Height the host gives; the drawing may be taller (the host then scrolls). */
  private baseH = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const root = host.ownerDocument.createElementNS(NS, 'svg');
    host.append(root);
    this.svg = select(root)
      .attr('class', 'rf-plot')
      .attr('role', 'img')
      .attr('aria-label', 'Öznitelik önemi: MDI ve permütasyon');
    const mdi = this.svg.append('g').attr('class', 'imp-col').attr('data-method', 'mdi');
    const perm = this.svg.append('g').attr('class', 'imp-col').attr('data-method', 'perm');
    this.footG = this.svg.append('g').attr('class', 'foot-layer');
    const probe = this.svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
    this.cols = {
      mdi: { g: mdi, bars: new HBarsLayer(mdi.append('g').attr('class', 'bars'), this.measure) },
      perm: { g: perm, bars: new HBarsLayer(perm.append('g').attr('class', 'bars'), this.measure) },
    };
  }

  resize(w: number, h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.baseH = Math.max(1, h);
    this.h = this.baseH;
    this.mode = mode;
    this.svg.attr('width', this.w).attr('height', this.h);
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('bars');
  }

  destroy(): void {
    this.interrupt();
    this.svg.remove();
  }

  /** Draws the columns, the causality sentence and the links of `v.importance`. */
  update(v: RfView, ms: number): void {
    const imp = v.importance;
    if (!imp) return;
    this.interrupt();
    const f = this.measure.fonts(this.mode);
    // stacked columns need a readable row height; when the host is shorter than that it scrolls
    const stacked = imp.columns.length > 1 && this.w < SIDE_BY_SIDE;
    const rowsNeeded = imp.columns.reduce((s, c) => s + c.rows.length, 0);
    const minRow = f.tick * 2.1;
    const footNeed = this.footHeight(imp, f);
    const need = stacked ? rowsNeeded * minRow + imp.columns.length * f.axis * 1.7 + footNeed : 0;
    this.h = Math.max(this.baseH, Math.ceil(need));
    this.svg.attr('height', this.h);
    const foot = this.drawFoot(imp, f);
    const areaH = Math.max(80, this.h - foot);
    const n = imp.columns.length;
    const side = n > 1 && this.w >= SIDE_BY_SIDE;
    for (const id of ['mdi', 'perm'] as const) {
      const k = imp.columns.findIndex((c) => c.id === id);
      const col = this.cols[id];
      if (k < 0) {
        // an unused column leaves nothing behind in the DOM
        col.g.attr('display', 'none');
        col.g.select('g.bars').selectAll('*').remove();
        col.g.selectAll('text.imp-title, text.imp-total').remove();
        continue;
      }
      col.g.attr('display', null);
      const rect = side
        ? { x: (this.w / n) * k, y: 0, w: this.w / n, h: areaH }
        : { x: 0, y: (areaH / n) * k, w: this.w, h: areaH / n };
      this.drawColumn(id, imp.columns[k], imp.max, rect, f, ms);
    }
  }

  private drawColumn(
    id: 'mdi' | 'perm',
    c: ImportanceColumn,
    max: number,
    rect: { x: number; y: number; w: number; h: number },
    f: { tick: number; axis: number },
    ms: number,
  ): void {
    const col = this.cols[id];
    const head = f.axis * 1.7;
    // Ders has no toggle and both columns carry the lesson, so only the Lab's explicit choice mutes one
    col.g.classed('muted', !c.active && this.mode === 'lab');
    col.g
      .selectAll<SVGTextElement, string>('text.imp-title')
      .data([c.title])
      .join('text')
      .attr('class', 'imp-title axis-title')
      .attr('x', r1(rect.x + PAD))
      .attr('y', r1(rect.y + f.axis * 1.2))
      .text((d) => d);
    col.g
      .selectAll<SVGTextElement, string>('text.imp-total')
      .data(c.total ? [c.total] : [])
      .join('text')
      .attr('class', 'imp-total tick')
      .attr('text-anchor', 'end')
      .attr('x', r1(rect.x + rect.w - PAD))
      .attr('y', r1(rect.y + f.axis * 1.2))
      .text((d) => d);
    const data: HBar[] = c.rows.map((r, row) => ({
      id: r.name,
      row,
      slot: 0,
      cls: r.isId ? 'hl' : 'plain',
      value: r.value,
      text: formatNumber(r.value, 3),
      label: r.name,
      attrs: { value: r.value, name: r.name },
    }));
    col.bars.draw(data, {
      rect: { x: rect.x, y: rect.y + head, w: rect.w, h: Math.max(40, rect.h - head) },
      tick: f.tick,
      rows: c.rows.length,
      slots: 1,
      max,
      itemCls: 'imp-bar',
      valueSample: '0,000',
      ms,
    });
  }

  /** Height of the causality sentence and the links. */
  private footHeight(imp: ImportanceView, f: { axis: number }): number {
    const lines = imp.causal ? this.measure.wrap(imp.causal, this.w - 2 * PAD, 'axis-title', f.axis) : [];
    const causalH = lines.length === 0 ? 0 : lines.length * f.axis * 1.4 + PAD;
    const linksH = imp.links.length === 0 ? 0 : imp.links.length * f.axis * 1.5 + PAD / 2;
    return causalH + linksH;
  }

  /** Causality sentence and links at the bottom (step 10); returns the height they take. */
  private drawFoot(imp: ImportanceView, f: { tick: number; axis: number }): number {
    const lines = imp.causal ? this.measure.wrap(imp.causal, this.w - 2 * PAD, 'axis-title', f.axis) : [];
    const row = f.axis * 1.5;
    const causalH = lines.length === 0 ? 0 : lines.length * f.axis * 1.4 + PAD;
    const linksH = imp.links.length === 0 ? 0 : imp.links.length * row + PAD / 2;
    const top = this.h - causalH - linksH;
    this.footG
      .selectAll<SVGTextElement, string[]>('text.causal')
      .data(lines.length ? [lines] : [])
      .join('text')
      .attr('class', 'causal axis-title')
      .each(function (ls) {
        select(this)
          .selectAll('tspan')
          .data(ls)
          .join('tspan')
          .attr('x', PAD)
          .attr('y', (_, i) => r1(top + PAD / 2 + f.axis + i * f.axis * 1.4))
          .text((d) => d);
      });
    const links = this.footG
      .selectAll<SVGAElement, { href: string; label: string }>('a.scene-link')
      .data(imp.links, (d) => d.href)
      .join((enter) => {
        const a = enter.append('a').attr('class', 'scene-link');
        a.append('text');
        return a;
      })
      .attr('href', (d) => d.href)
      .attr('aria-label', (d) => d.label);
    links
      .select('text')
      .attr('x', PAD)
      .attr('y', (_, i) => r1(top + causalH + row * (i + 0.8)))
      .text((d) => d.label);
    return causalH + linksH;
  }
}
