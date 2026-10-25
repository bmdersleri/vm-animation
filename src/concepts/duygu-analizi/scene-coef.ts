import type { Selection } from 'd3-selection';
import type { Mode } from '../../core/mode';
import { HBarsLayer, type HBar } from '../../core/plot/hbars';
import type { TextMeasure } from '../../core/plot/text-measure';
import { el, mountSvg, NARROW, type ViewScene } from './scene-base';
import type { SentimentView } from './view';

/** One side of the coefficient bars: a heading and an svg with its own `HBarsLayer`. */
class Side {
  readonly box: HTMLDivElement;
  readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  readonly measure: TextMeasure;
  readonly layer: HBarsLayer;

  constructor(doc: Document, sign: 'pos' | 'neg', heading: string) {
    this.box = el(doc, 'div', 'coef-group');
    this.box.dataset.sign = sign;
    this.box.append(el(doc, 'h3', `panel-heading is-${sign}`, heading));
    const m = mountSvg(this.box, 'coef-plot', `${heading}: katsayı çubukları`);
    this.svg = m.svg;
    this.measure = m.measure;
    this.layer = new HBarsLayer(this.svg.append('g').attr('class', 'coef-bars'), this.measure);
  }

  draw(bars: HBar[], max: number, w: number, tick: number, ms: number): void {
    const rowH = Math.round(tick * 1.75);
    const height = rowH * Math.max(1, bars.length);
    this.svg.attr('width', w).attr('height', height);
    this.layer.draw(bars, {
      rect: { x: 0, y: 0, w, h: height },
      tick,
      rows: Math.max(1, bars.length),
      slots: 1,
      max,
      itemCls: 'coef-bar',
      valueSample: '+0,00',
      ms,
    });
  }
}

/**
 * Step 3: the strongest positive and negative terms as two bar groups (`HBarsLayer`, `.coef-bar` with
 * `data-sign` pos or neg), each sorted by |coefficient| with the strongest on top. Bar length is |coefficient|,
 * the value text carries the sign; term names are in the code font. The groups sit side by side on a wide stage
 * and one above the other on a narrow one.
 */
export class CoefScene implements ViewScene {
  private readonly root: HTMLDivElement;
  private readonly pos: Side;
  private readonly neg: Side;
  private w = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'coef-scene');
    this.pos = new Side(doc, 'pos', 'olumluya çeken');
    this.neg = new Side(doc, 'neg', 'olumsuza çeken');
    this.root.append(this.pos.box, this.neg.box);
    host.append(this.root);
  }

  resize(w: number, _h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.mode = mode;
  }

  interrupt(): void {
    this.pos.svg.selectAll('*').interrupt('bars');
    this.neg.svg.selectAll('*').interrupt('bars');
  }

  destroy(): void {
    this.interrupt();
    this.root.remove();
  }

  update(v: SentimentView, ms: number): void {
    const c = v.coef;
    if (!c) return;
    this.root.dataset.model = c.model;
    const tick = this.pos.measure.fonts(this.mode).tick;
    const width = Math.max(180, this.w >= NARROW ? Math.floor((this.w - 36) / 2) : this.w - 24);
    this.pos.draw(c.pos, c.max, width, tick, ms);
    this.neg.draw(c.neg, c.max, width, tick, ms);
  }
}
