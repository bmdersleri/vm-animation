import { select, type Selection } from 'd3-selection';
import type { Mode } from '../../core/mode';
import { HBarsLayer } from '../../core/plot/hbars';
import { HeatTable } from '../../core/plot/heat-table';
import { TextMeasure } from '../../core/plot/text-measure';
import { el, NS, type ViewScene } from './scene-base';
import type { TableSpec, TableView, TfidfView } from './view';

/** Below this width (px) the page is one column and the IDF bars go under the table. */
const NARROW = 900;

/**
 * The heat tables (steps 4-7): one or two `HeatTable`s (rows documents, columns terms), and in step 5 the IDF
 * bars (`HBarsLayer`, `.idf-bar` per term). Tables keep their cells between steps, so colours fade instead of
 * jumping; a table wider than the stage scrolls inside its own wrapper, never the page.
 */
export class TableScene implements ViewScene {
  private readonly root: HTMLDivElement;
  private readonly area: HTMLDivElement;
  private readonly tables = new Map<TableSpec['id'], { block: HTMLElement; title: HTMLElement; table: HeatTable }>();
  private readonly barsBox: HTMLDivElement;
  private readonly barsTitle: HTMLElement;
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly bars: HBarsLayer;
  private readonly measure: TextMeasure;
  private w = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'table-scene');
    this.area = el(doc, 'div', 'table-area');
    this.barsBox = el(doc, 'div', 'idf-panel');
    this.barsTitle = el(doc, 'h3', 'heat-title idf-title');
    const root = doc.createElementNS(NS, 'svg');
    this.barsBox.append(this.barsTitle, root);
    this.svg = select(root).attr('class', 'idf-plot').attr('role', 'img').attr('aria-label', 'Terimlerin IDF değerleri');
    const probe = this.svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
    this.bars = new HBarsLayer(this.svg.append('g').attr('class', 'idf-bars'), this.measure);
    this.root.append(this.area, this.barsBox);
    host.append(this.root);
  }

  resize(w: number, _h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.mode = mode;
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('bars');
  }

  destroy(): void {
    this.interrupt();
    for (const t of this.tables.values()) t.table.destroy();
    this.root.remove();
  }

  update(v: TfidfView, ms: number): void {
    const view = v.table;
    if (!view) return;
    this.root.dataset.part = view.part;
    this.showTables(view);
    this.drawBars(view, ms);
  }

  private showTables(view: TableView): void {
    const doc = this.root.ownerDocument;
    const wanted = new Set(view.tables.map((t) => t.id));
    for (const [id, t] of this.tables) {
      t.block.hidden = !wanted.has(id);
    }
    const order: HTMLElement[] = [];
    for (const spec of view.tables) {
      let t = this.tables.get(spec.id);
      if (!t) {
        const block = el(doc, 'section', 'heat-block');
        block.dataset.table = spec.id;
        const title = el(doc, 'h3', 'heat-title');
        const table = new HeatTable(doc);
        block.append(title, table.el);
        t = { block, title, table };
        this.tables.set(spec.id, t);
      }
      t.block.hidden = false;
      t.title.textContent = spec.title;
      t.table.update(spec.spec);
      order.push(t.block);
    }
    const hidden = [...this.tables.values()].filter((t) => t.block.hidden).map((t) => t.block);
    this.area.replaceChildren(...order, ...hidden);
  }

  private drawBars(view: TableView, ms: number): void {
    const show = view.bars !== null;
    this.barsBox.hidden = !show;
    if (!view.bars) {
      this.svg.select('g.idf-bars').selectAll('*').remove();
      return;
    }
    this.barsTitle.textContent = view.barTitle;
    const tick = this.measure.fonts(this.mode).tick;
    const wide = this.w >= NARROW;
    const width = Math.max(180, wide ? Math.floor(this.w * 0.4) : this.w - 24);
    const rowH = Math.round(tick * 1.9);
    const height = Math.max(rowH * view.bars.length, 40);
    this.svg.attr('width', width).attr('height', height);
    this.bars.draw(view.bars, {
      rect: { x: 0, y: 0, w: width, h: height },
      tick,
      rows: view.bars.length,
      slots: 1,
      max: view.barMax,
      itemCls: 'idf-bar',
      valueSample: 'df 0 · 0,000',
      ms,
    });
  }
}
