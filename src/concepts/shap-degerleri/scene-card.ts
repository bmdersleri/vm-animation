import { select, type Selection } from 'd3-selection';
import type { Mode } from '../../core/mode';
import { HBarsLayer } from '../../core/plot/hbars';
import { TextMeasure } from '../../core/plot/text-measure';
import { el, NARROW, NS, type ViewScene } from './scene-base';
import type { BarGroup, CardView, ShapView } from './view';

interface Panel {
  box: HTMLElement;
  title: HTMLElement;
  svg: Selection<SVGSVGElement, unknown, null, undefined>;
  layer: HBarsLayer;
}

/**
 * Steps 1, 2 and 8. The customer card (`.customer-card`: three values in code font, `.prob-value`, the p bar) is
 * shown in steps 1 and 2; the bar steps draw one `HBarsLayer` per group: `.imp-bar` for the forest importances
 * and, in step 8, `.mean-shap-bar` for the mean |SHAP|, each group on its own scale (the two measures differ).
 */
export class CardScene implements ViewScene {
  private readonly root: HTMLDivElement;
  private readonly card: HTMLElement;
  private readonly values: HTMLElement;
  private readonly title: HTMLElement;
  private readonly probValue: HTMLElement;
  private readonly probFill: HTMLElement;
  private readonly acc: HTMLElement;
  private readonly bars: HTMLElement;
  private readonly panels = new Map<BarGroup['id'], Panel>();
  private readonly measure: TextMeasure;
  private w = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'card-scene');
    this.card = el(doc, 'section', 'customer-card');
    this.title = el(doc, 'h3', 'card-title');
    this.values = el(doc, 'dl', 'card-values');
    const prob = el(doc, 'div', 'prob-row');
    this.probValue = el(doc, 'strong', 'prob-value');
    this.probFill = el(doc, 'div', 'prob-fill');
    const track = el(doc, 'div', 'prob-track');
    track.append(this.probFill);
    prob.append(el(doc, 'span', 'prob-label', 'p(ayrılma)'), track, this.probValue);
    this.acc = el(doc, 'p', 'acc-note');
    this.card.append(this.title, this.values, prob, this.acc);
    this.bars = el(doc, 'div', 'bars-area');
    const probeSvg = doc.createElementNS(NS, 'svg');
    probeSvg.setAttribute('class', 'measure-svg');
    probeSvg.setAttribute('aria-hidden', 'true');
    const probe = select(probeSvg).append('text').attr('class', 'probe').attr('visibility', 'hidden');
    this.measure = new TextMeasure(probe.node()!);
    for (const id of ['imp', 'mean-shap'] as const) {
      const box = el(doc, 'section', 'bars-panel');
      box.dataset.group = id;
      const title = el(doc, 'h3', 'heat-title');
      const root = doc.createElementNS(NS, 'svg');
      box.append(title, root);
      const svg = select(root).attr('class', 'bars-plot').attr('role', 'img');
      const layer = new HBarsLayer(svg.append('g').attr('class', 'bars-g'), this.measure);
      this.panels.set(id, { box, title, svg, layer });
      this.bars.append(box);
    }
    this.root.append(this.card, this.bars, probeSvg);
    host.append(this.root);
  }

  resize(w: number, _h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.mode = mode;
    // the layout follows the stage's own width (the Lab stage is narrow in a wide window), so the CSS keys on this, not on the viewport
    this.root.toggleAttribute('data-narrow', this.w < NARROW);
  }

  interrupt(): void {
    for (const p of this.panels.values()) {
      p.svg.selectAll('*').interrupt('bars');
    }
  }

  destroy(): void {
    this.interrupt();
    this.root.remove();
  }

  update(v: ShapView, ms: number): void {
    this.root.dataset.kind = v.kind;
    if (v.kind === 'card' && v.card) {
      this.showCard(v.card);
      this.card.hidden = false;
      this.bars.hidden = true;
      return;
    }
    const bars = v.bars;
    if (!bars) {
      return;
    }
    if (bars.card) {
      this.showCard(bars.card);
    }
    this.card.hidden = bars.card === null;
    this.bars.hidden = false;
    this.root.dataset.groups = String(bars.groups.length);
    const shown = new Set(bars.groups.map((g) => g.id));
    for (const [id, p] of this.panels) {
      p.box.hidden = !shown.has(id);
    }
    for (const g of bars.groups) {
      this.drawGroup(g, bars.groups.length, ms);
    }
  }

  private showCard(c: CardView): void {
    const doc = this.root.ownerDocument;
    this.title.textContent = `Müşteri ${c.row}`;
    this.values.replaceChildren(
      ...c.features.map((fe) => {
        const row = el(doc, 'div', 'card-value');
        const term = el(doc, 'dt', 'feature-cell');
        term.append(el(doc, 'code', 'feature-name', fe.name));
        row.append(term, el(doc, 'dd', 'feature-value', fe.value));
        return row;
      }),
    );
    this.probValue.textContent = c.p;
    this.probFill.style.width = `${(c.ratio * 100).toFixed(1)}%`;
    this.probFill.dataset.ratio = String(c.ratio);
    this.acc.hidden = c.accuracy === null;
    this.acc.textContent = c.accuracy === null ? '' : `Test doğruluğu ${c.accuracy}`;
  }

  private drawGroup(g: BarGroup, groups: number, ms: number): void {
    const p = this.panels.get(g.id)!;
    p.title.textContent = g.title;
    const tick = this.measure.fonts(this.mode).tick;
    const wide = this.w >= NARROW;
    const sideBySide = wide && (groups > 1 || !this.card.hidden);
    const width = Math.max(200, sideBySide ? Math.floor(this.w * (groups > 1 ? 0.46 : 0.5)) : this.w - 24);
    const rowH = Math.round(tick * 2.1);
    const height = rowH * g.bars.length;
    p.svg.attr('width', width).attr('height', height).attr('aria-label', g.title);
    p.layer.draw(g.bars, {
      rect: { x: 0, y: 0, w: width, h: height },
      tick,
      rows: g.bars.length,
      slots: 1,
      max: g.max,
      itemCls: 'shap-bar',
      valueSample: '0,000',
      ms,
    });
  }
}
