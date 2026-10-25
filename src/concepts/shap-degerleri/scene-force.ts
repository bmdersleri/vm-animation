import { select, type Selection } from 'd3-selection';
import type { Mode } from '../../core/mode';
import { TextMeasure } from '../../core/plot/text-measure';
import { WaterfallLayer } from '../../core/plot/waterfall';
import { el, NS, type ViewScene } from './scene-base';
import type { ShapView } from './view';

type G = Selection<SVGGElement, unknown, null, undefined>;

/**
 * Steps 6 and 7 on the shared `WaterfallLayer`: step 6 one waterfall (base value → three parts → p) in `g.wf-wrap`,
 * step 7 two force bars (`g.force-bar[data-row]`) on one shared value axis. The SVG takes the height the layers
 * report, so the stage scrolls instead of clipping when a bar needs room for its labels.
 */
export class ForceScene implements ViewScene {
  private readonly root: HTMLDivElement;
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly wrapG: G;
  private readonly barG: G[];
  private readonly wrap: WaterfallLayer;
  private readonly bars: WaterfallLayer[];
  private readonly measure: TextMeasure;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'force-scene');
    const root = doc.createElementNS(NS, 'svg');
    this.root.append(root);
    this.svg = select(root).attr('class', 'force-plot').attr('role', 'img');
    this.wrapG = this.svg.append('g').attr('class', 'wf-wrap');
    this.barG = [0, 1].map((row) => this.svg.append('g').attr('class', 'force-bar').attr('data-row', row));
    const probe = this.svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
    this.wrap = new WaterfallLayer(this.wrapG.node()!);
    this.bars = this.barG.map((g) => new WaterfallLayer(g.node()!));
    host.append(this.root);
  }

  resize(w: number, h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.mode = mode;
  }

  interrupt(): void {
    this.wrap.interrupt();
    for (const b of this.bars) {
      b.interrupt();
    }
  }

  destroy(): void {
    this.interrupt();
    this.root.remove();
  }

  update(v: ShapView, ms: number): void {
    const width = Math.max(200, this.w - 24);
    const animate = ms > 0;
    if (v.kind === 'waterfall' && v.waterfall) {
      const tick = this.measure.fonts(this.mode).tick;
      this.wrapG.attr('display', null);
      this.barG.forEach((g) => g.attr('display', 'none'));
      this.bars.forEach((b) => b.clear());
      const used = this.wrap.update(v.waterfall.spec, { x: 0, y: 0, w: width, h: Math.max(this.h - 12, tick * 12) }, animate);
      this.size(width, used);
      this.svg.attr('aria-label', `Müşteri ${v.waterfall.customer}: temel değerden tahmine şelale`);
      return;
    }
    if (v.kind === 'force' && v.force) {
      this.wrapG.attr('display', 'none');
      this.wrap.clear();
      let y = 0;
      v.force.rows.forEach((row, i) => {
        this.barG[i].attr('display', null).attr('data-customer', row.customer);
        const used = this.bars[i].update(row.spec, { x: 0, y, w: width, h: 0 }, animate);
        y += used + 8;
      });
      this.size(width, y);
      this.svg.attr('aria-label', 'İki müşterinin kuvvet çubuğu, ortak değer ekseni');
    }
  }

  private size(width: number, height: number): void {
    this.svg.attr('width', width).attr('height', Math.ceil(height));
  }
}
