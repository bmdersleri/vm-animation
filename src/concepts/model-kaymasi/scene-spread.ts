import type { Mode } from '../../core/mode';
import type { TextMeasure } from '../../core/plot/text-measure';
import { META } from './data';
import { HistPairLayer } from './hist-pair';
import { el, legend, makeSvg, NARROW, setLegend, type Svg, type ViewScene } from './scene-base';
import type { KaymaView } from './view';

const cap = (s: string): string => s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1);
const MIN_PLOT_H = 260;

/**
 * Step 7: the fee histogram pair (reference against the chosen month) and two number boxes
 * (`.stat-box[data-stat="diff"]`: the mean difference, `[data-stat="std"]`: reference std → month std). Wide: the
 * pair left, the boxes right; narrow: the boxes under the pair.
 */
export class SpreadScene implements ViewScene {
  private readonly root: HTMLDivElement;
  private readonly title: HTMLElement;
  private readonly svg: Svg;
  private readonly measure: TextMeasure;
  private readonly hist: HistPairLayer;
  private readonly legend: HTMLElement;
  private readonly boxes: HTMLElement;
  private readonly note: HTMLElement;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';
  private tall = false;

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'spread-scene');
    this.title = el(doc, 'h3', 'spread-title');
    const { svg, measure } = makeSvg(doc, 'spread-plot', 'Ücret histogramı: referans ve seçilen ay');
    this.svg = svg;
    this.measure = measure;
    this.hist = new HistPairLayer(svg.append('g').attr('class', 'spread-hist'), measure);
    const body = el(doc, 'div', 'spread-body');
    const plot = el(doc, 'div', 'spread-plot-wrap');
    this.legend = legend(doc, 'spread-legend', []);
    plot.append(svg.node()!, this.legend);
    this.boxes = el(doc, 'div', 'stat-boxes');
    body.append(plot, this.boxes);
    this.note = el(doc, 'p', 'scene-note');
    this.root.append(this.title, body, this.note);
    host.append(this.root);
  }

  resize(w: number, h: number, mode: Mode, tall: boolean): void {
    this.w = Math.max(1, Math.floor(w));
    this.h = Math.max(1, Math.floor(h));
    this.mode = mode;
    this.tall = tall;
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('axes');
    this.svg.selectAll('*').interrupt('hist');
  }

  destroy(): void {
    this.interrupt();
    this.root.remove();
  }

  update(v: KaymaView, ms: number): void {
    const s = v.spread;
    if (!s) {
      return;
    }
    const doc = this.root.ownerDocument;
    const fn = this.measure.fonts(this.mode);
    this.title.textContent = `${cap(s.name)}, ay ${s.month}`;
    this.note.textContent = v.note ?? '';
    setLegend(this.legend, [
      { swatch: 'sw-hist-ref', text: `referans (ay 1–${META.refMonths})` },
      { swatch: 'sw-hist-cur', text: `ay ${s.month}` },
    ]);
    this.boxes.replaceChildren(
      ...s.boxes.map((b, i) => {
        const box = el(doc, 'div', 'stat-box');
        box.dataset.stat = i === 0 ? 'diff' : 'std';
        box.append(el(doc, 'div', 'stat-label', b.label), el(doc, 'div', 'stat-value', b.value));
        return box;
      }),
    );
    const side = this.w >= NARROW;
    const boxesW = side ? Math.min(300, Math.floor(this.w * 0.28)) : 0;
    const pw = side ? this.w - boxesW - 16 : this.w;
    const chrome = fn.tick * 1.4 + fn.tick * 2 + fn.tick * 3.2 + 28;
    const free = this.h - chrome - (side ? 0 : fn.tick * 6);
    const ph = Math.floor(this.tall ? 320 : Math.max(MIN_PLOT_H, free));
    this.svg.attr('width', pw).attr('height', ph);
    this.hist.draw(s.refShare, s.curShare, { w: pw, h: ph }, fn.tick, fn.axis, ms);
  }
}
