import type { Selection } from 'd3-selection';
import type { Mode } from '../../core/mode';
import { HBarsLayer } from '../../core/plot/hbars';
import type { TextMeasure } from '../../core/plot/text-measure';
import { el, mountSvg, NARROW, type ViewScene } from './scene-base';
import type { FlowView, SentimentView } from './view';

/**
 * The flow strip and the corpus counts (steps 1-2): a row of boxes joined by arrows (`.flow-stage`, the active
 * ones outlined), count bars (`HBarsLayer`, one `.count-bar` per class and part) and, beside them, sample
 * comments with their labels (step 1) or the book's pipeline lines (step 2).
 */
export class FlowScene implements ViewScene {
  private readonly root: HTMLDivElement;
  private readonly stages: HTMLOListElement;
  private readonly body: HTMLDivElement;
  private readonly barBox: HTMLDivElement;
  private readonly barTitle: HTMLElement;
  private readonly side: HTMLDivElement;
  private readonly warning: HTMLParagraphElement;
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly measure: TextMeasure;
  private readonly bars: HBarsLayer;
  private w = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'flow-scene');
    this.stages = el(doc, 'ol', 'flow-stages');
    this.body = el(doc, 'div', 'flow-body');
    this.barBox = el(doc, 'div', 'count-panel');
    this.barTitle = el(doc, 'h3', 'panel-heading');
    this.side = el(doc, 'div', 'flow-side');
    this.warning = el(doc, 'p', 'flow-warning');
    this.barBox.append(this.barTitle);
    const m = mountSvg(this.barBox, 'count-plot', 'Yorum sayıları: olumlu ve olumsuz');
    this.svg = m.svg;
    this.measure = m.measure;
    this.bars = new HBarsLayer(this.svg.append('g').attr('class', 'count-bars'), this.measure);
    this.body.append(this.barBox, this.side);
    this.root.append(this.stages, this.body, this.warning);
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
    this.root.remove();
  }

  update(v: SentimentView, ms: number): void {
    const flow = v.flow;
    if (!flow) return;
    this.root.dataset.part = flow.part;
    this.drawStages(flow);
    this.drawBars(flow, ms);
    this.drawSide(flow);
    this.warning.textContent = flow.warning ?? '';
    this.warning.hidden = flow.warning === null;
  }

  private drawStages(flow: FlowView): void {
    const doc = this.root.ownerDocument;
    const nodes: HTMLElement[] = [];
    flow.stages.forEach((s, i) => {
      if (i > 0) nodes.push(el(doc, 'li', 'flow-arrow', '→'));
      const li = el(doc, 'li', s.active ? 'flow-stage is-active' : 'flow-stage', s.label);
      li.dataset.stage = s.id;
      nodes.push(li);
    });
    this.stages.replaceChildren(...nodes);
  }

  private drawBars(flow: FlowView, ms: number): void {
    this.barTitle.textContent = flow.barTitle;
    const tick = this.measure.fonts(this.mode).tick;
    const wide = this.w >= NARROW;
    const width = Math.max(200, wide ? Math.floor(this.w * 0.46) : this.w - 24);
    const rowH = Math.round(tick * 1.9);
    const height = rowH * flow.bars.length;
    this.svg.attr('width', width).attr('height', height);
    this.bars.draw(flow.bars, {
      rect: { x: 0, y: 0, w: width, h: height },
      tick,
      rows: flow.bars.length,
      slots: 1,
      max: flow.barMax,
      itemCls: 'count-bar',
      valueSample: String(flow.barMax),
      ms,
    });
  }

  private drawSide(flow: FlowView): void {
    const doc = this.root.ownerDocument;
    if (flow.samples) {
      const list = el(doc, 'ul', 'sample-list');
      for (const s of flow.samples) {
        const li = el(doc, 'li', 'sample');
        li.dataset.label = s.label;
        li.append(el(doc, 'span', `label-tag is-${s.label === 'olumlu' ? 'pos' : 'neg'}`, s.label), el(doc, 'q', 'sample-text', s.text));
        list.append(li);
      }
      this.side.replaceChildren(list);
    } else if (flow.code) {
      const pre = el(doc, 'pre', 'code-lines');
      pre.append(el(doc, 'code', 'code-text', flow.code.join('\n')));
      this.side.replaceChildren(pre);
    } else {
      this.side.replaceChildren();
    }
  }
}
