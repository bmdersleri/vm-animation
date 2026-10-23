import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import type { Mode } from '../../core/mode';
import { LineChartLayer } from '../../core/plot/line-chart';
import { r1 } from '../../core/plot/marks';
import { TextMeasure } from '../../core/plot/text-measure';
import { tr } from '../../core/plot/transition';
import type { BagView, BaggingView } from './view';

/** Duration of one authored reveal in milliseconds (scaled by the caller). */
export const MS_STEP = 450;
/** A card landing in its slot glides for less than the sweep interval (700 ms). */
const MS_DROP = 420;

const NS = 'http://www.w3.org/2000/svg';
type G = Selection<SVGGElement, unknown, null, undefined>;

/** Where the cards and slots sit for one size and mode. */
interface BagLayout {
  cw: number;
  ch: number;
  gap: number;
  x0: number;
  cardY: number;
  slotY: number;
  captionY: [number, number];
  badgeY: number;
  oobY: number;
  tick: number;
  axis: number;
}

/**
 * Bag scene (steps 1-4): n numbered cards form the bag, n slots below form the
 * bootstrap strip; a drawn card lands in the next slot while its bag card stays
 * (draws are with replacement). Repeat badges and dashed OOB cards come at the
 * OOB step. Step 4 replaces the bag with the (1 − 1/n)ⁿ line chart.
 */
export class BagScene {
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly bagG: G;
  private readonly curveG: G;
  private readonly measure: TextMeasure;
  private readonly chart: LineChartLayer;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const root = host.ownerDocument.createElementNS(NS, 'svg');
    host.append(root);
    this.svg = select(root)
      .attr('class', 'bagging-plot')
      .attr('role', 'img')
      .attr('aria-label', 'Torba, bootstrap şeridi ve hiç seçilmeme olasılığı eğrisi');
    this.bagG = this.svg.append('g').attr('class', 'bag-layer');
    this.curveG = this.svg.append('g').attr('class', 'curve-layer');
    const probe = this.svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
    this.chart = new LineChartLayer(this.curveG, this.measure);
  }

  resize(w: number, h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.mode = mode;
    this.svg.attr('width', this.w).attr('height', this.h);
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('bag').interrupt('axes').interrupt('line');
  }

  destroy(): void {
    this.interrupt();
    this.svg.remove();
  }

  /** Draws the bag (steps 1-3) or the curve (step 4) for `v`; `ms` > 0 animates. */
  update(v: BaggingView, ms: number): void {
    this.interrupt();
    this.svg.attr('data-view', v.curve ? 'curve' : 'bag');
    this.bagG.attr('display', v.bag ? null : 'none');
    this.curveG.attr('display', v.curve ? null : 'none');
    if (v.bag) this.drawBag(v.bag, v.stepId, ms);
    if (v.curve) {
      const plot = this.chart.plotRect(this.w, this.h, v.curve);
      this.chart.draw(v.curve, plot, ms);
    }
  }

  private layout(n: number): BagLayout {
    const f = this.measure.fonts(this.mode);
    const pad = 12;
    const gap = Math.max(6, Math.round(f.tick * 0.5));
    const cw = Math.max(24, Math.min(110, (this.w - 2 * pad - (n - 1) * gap) / n));
    const ch = Math.round(f.axis * 2.4);
    const x0 = (this.w - (n * cw + (n - 1) * gap)) / 2;
    const lane = f.tick * 1.5;
    const total = f.axis * 1.4 + lane + ch + lane + f.axis * 1.4 + ch + pad;
    const spare = Math.max(0, this.h - 2 * pad - total);
    const top = pad + spare * 0.2;
    const between = spare * 0.3;
    const cap1 = top + f.axis;
    const badgeY = cap1 + f.axis * 0.4 + lane;
    const cardY = badgeY + f.tick * 0.2;
    const oobY = cardY + ch + f.tick * 1.15;
    const cap2 = oobY + between + f.axis * 1.5;
    return {
      cw,
      ch,
      gap,
      x0,
      cardY,
      slotY: cap2 + f.axis * 0.5,
      captionY: [cap1, cap2],
      badgeY,
      oobY,
      tick: f.tick,
      axis: f.axis,
    };
  }

  private drawBag(b: BagView, stepId: string, ms: number): void {
    const L = this.layout(b.n);
    const colX = (i: number): number => L.x0 + i * (L.cw + L.gap);
    const last = stepId === 'cekilis' && b.shown > 0 ? b.sample[b.shown - 1] : -1;

    this.bagG
      .selectAll<SVGTextElement, string>('text.bag-caption')
      .data([`Torba: ${b.n} müşteri kartı (yerine konur)`, `Bootstrap örneği: ${b.n} çekiliş, soldan sağa yuvalara`])
      .join('text')
      .attr('class', 'bag-caption axis-title')
      .attr('x', r1(L.x0))
      .attr('y', (_, i) => r1(L.captionY[i]))
      .text((d) => d);

    const cards = this.bagG
      .selectAll<SVGGElement, number>('g.bag-card')
      .data(b.ids, (d) => d)
      .join((enter) => {
        const g = enter.append('g');
        g.append('rect').attr('rx', 6);
        g.append('text').attr('text-anchor', 'middle');
        return g;
      })
      .attr('class', (d) => `bag-card${b.oob.includes(d) ? ' oob' : ''}${d === last ? ' active' : ''}`)
      .attr('data-id', (d) => d)
      .attr('transform', (d) => `translate(${r1(colX(d))},${r1(L.cardY)})`);
    cards.select('rect').attr('width', r1(L.cw)).attr('height', L.ch);
    cards
      .select('text')
      .attr('x', r1(L.cw / 2))
      .attr('y', r1(L.ch / 2))
      .attr('dy', '0.35em')
      .text((d) => String(d));

    this.bagG
      .selectAll<SVGGElement, { id: number; count: number }>('g.bag-badge')
      .data(b.badges, (d) => d.id)
      .join((enter) => {
        const g = enter.append('g').attr('class', 'bag-badge');
        g.append('rect').attr('rx', 8);
        g.append('text').attr('text-anchor', 'middle');
        return g;
      })
      .each(function (d) {
        const g = select(this);
        const w = Math.max(L.tick * 2.4, 28);
        g.attr('transform', `translate(${r1(colX(d.id) + L.cw / 2)},${r1(L.badgeY - L.tick * 0.6)})`);
        g.select('rect')
          .attr('x', r1(-w / 2))
          .attr('y', r1(-L.tick * 0.8))
          .attr('width', r1(w))
          .attr('height', r1(L.tick * 1.45));
        g.select('text').attr('y', r1(L.tick * 0.05)).attr('dy', '0.35em').text(`×${d.count}`);
      });

    this.bagG
      .selectAll<SVGTextElement, number>('text.bag-oob-label')
      .data(b.oob, (d) => d)
      .join('text')
      .attr('class', 'bag-oob-label tick')
      .attr('text-anchor', 'middle')
      .attr('x', (d) => r1(colX(d) + L.cw / 2))
      .attr('y', r1(L.oobY))
      .text('OOB');

    const slots = this.bagG
      .selectAll<SVGGElement, number>('g.bag-slot')
      .data(b.ids, (d) => d)
      .join((enter) => {
        const g = enter.append('g');
        g.append('rect').attr('class', 'slot-box').attr('rx', 6);
        return g;
      })
      .attr('transform', (j) => `translate(${r1(colX(j))},${r1(L.slotY)})`)
      .attr('class', (j) => `bag-slot${j < b.shown ? ' filled' : ''}`)
      .attr('data-slot', (j) => j);
    slots.select('rect.slot-box').attr('width', r1(L.cw)).attr('height', L.ch);

    // the card in a filled slot: a copy that glides in from its bag card the first time it appears
    slots.each(function (j) {
      const slot = select<SVGGElement, number>(this);
      const id = j < b.shown ? b.sample[j] : null;
      const had = slot.select<SVGGElement>('g.slot-card').node()?.getAttribute('data-id') ?? null;
      slot
        .selectAll<SVGGElement, number>('g.slot-card')
        .data(id === null ? [] : [id])
        .join((enter) => {
          const g = enter.append('g').attr('class', 'slot-card');
          g.append('rect').attr('rx', 6);
          g.append('text').attr('text-anchor', 'middle');
          return g;
        })
        .each(function (d) {
          const g = select<SVGGElement, number>(this);
          g.attr('data-id', d);
          g.select('rect').attr('width', r1(L.cw)).attr('height', L.ch);
          g.select('text').attr('x', r1(L.cw / 2)).attr('y', r1(L.ch / 2)).attr('dy', '0.35em').text(String(d));
          if (ms > 0 && String(d) !== had) {
            const dx = colX(d) - colX(j);
            const dy = L.cardY - L.slotY;
            g.attr('transform', `translate(${r1(dx)},${r1(dy)})`);
            tr(g, 'bag', Math.min(ms, MS_DROP)).attr('transform', 'translate(0,0)');
          } else {
            g.attr('transform', 'translate(0,0)');
          }
        });
    });
  }
}
