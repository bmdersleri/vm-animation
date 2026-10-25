import type { Mode } from '../../core/mode';
import { FlowGraphLayer, type FlowGraphSpec } from '../../core/plot/flow-graph';
import type { TextMeasure } from '../../core/plot/text-measure';
import { ALARM_LABELS, alarmEdges, alarmLayout, alarmSizes, narrowFlowHeight, narrowLabels, type AlarmId } from './flow';
import { el, makeSvg, NARROW, TALL_BUDGET, type Svg, type ViewScene } from './scene-base';
import type { KaymaView } from './view';

/**
 * Step 9: the alarm flow (figure 14.4 of the book) on `alarmLayout`'s nodes, drawn by `FlowGraphLayer`; the token walks
 * the sweep's route. Wide: the chain left to right with the four causes stacked at its end; narrow: the chain
 * top to bottom on the left, the four causes in a column on the right. The narrow flow is as tall as its rows need, whatever the area.
 */
export class FlowScene implements ViewScene {
  private readonly root: HTMLDivElement;
  private readonly svg: Svg;
  private readonly measure: TextMeasure;
  private readonly layer: FlowGraphLayer;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';
  private tall = false;

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'flow-scene');
    const { svg, measure } = makeSvg(doc, 'alarm-flow', 'Alarm akışı: izleme, eşik, alarm, inceleme ve dört neden');
    this.svg = svg;
    this.measure = measure;
    this.layer = new FlowGraphLayer(svg.append('g').attr('class', 'alarm-graph'), measure);
    this.root.append(svg.node()!);
    host.append(this.root);
  }

  resize(w: number, h: number, mode: Mode, tall: boolean): void {
    this.w = Math.max(1, Math.floor(w));
    this.h = Math.max(1, Math.floor(h));
    this.mode = mode;
    this.tall = tall;
  }

  interrupt(): void {
    this.layer.interrupt();
  }

  destroy(): void {
    this.interrupt();
    this.root.remove();
  }

  update(v: KaymaView, ms: number): void {
    if (!v.graph) {
      return;
    }
    const narrow = this.w < NARROW;
    const fontPx = this.measure.fontPx('flow-label', this.measure.fonts(this.mode).tick);
    // a narrow area wraps the labels so the chain and the column of causes fit side by side
    const labels = narrow ? narrowLabels(this.measure, fontPx, this.w) : ALARM_LABELS;
    const sizes = alarmSizes(this.measure, fontPx, labels);
    let h = this.tall ? Math.min(this.h, TALL_BUDGET) : this.h;
    if (narrow) {
      h = Math.max(h, narrowFlowHeight(sizes));
    }
    this.svg.attr('width', this.w).attr('height', h);
    const placed = alarmLayout(this.w, h, narrow, sizes);
    const at = new Map(placed.map((n) => [n.id, n]));
    const spec: FlowGraphSpec = {
      ...v.graph,
      edges: alarmEdges(placed, this.w, narrow),
      nodes: v.graph.nodes.map((n) => {
        const p = at.get(n.id)!;
        return { ...n, label: labels[n.id as AlarmId], x: p.x, y: p.y, w: p.w, h: p.h };
      }),
    };
    this.layer.draw(spec, ms, fontPx);
  }
}
