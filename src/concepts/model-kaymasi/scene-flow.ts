import type { Mode } from '../../core/mode';
import { FlowGraphLayer, type FlowGraphSpec } from '../../core/plot/flow-graph';
import type { TextMeasure } from '../../core/plot/text-measure';
import { ALARM_IDS, ALARM_LABELS, ALARM_MARGIN, alarmLayout, alarmSizes, narrowBranchWidth, wrapBranchLabels, type AlarmId } from './flow';
import { el, makeSvg, NARROW, TALL_BUDGET, type Svg, type ViewScene } from './scene-base';
import type { KaymaView } from './view';

const ROW_GAP = 22;

/**
 * Step 9: the alarm flow (figure 14.4 of the book) on `alarmLayout`'s nodes, drawn by `FlowGraphLayer`; the token walks
 * the sweep's route. Wide: the chain left to right with the four causes stacked at its end; narrow: the chain
 * top to bottom with the causes in a 2 x 2 grid. The narrow flow is as tall as its rows need, whatever the area.
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
    this.svg.selectAll('*').interrupt('flow-token');
    this.svg.selectAll('*').interrupt('flow-token-end');
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
    // a narrow area wraps the long branch labels so two boxes fit side by side
    const labels = narrow ? wrapBranchLabels(this.measure, fontPx, narrowBranchWidth(this.w)) : ALARM_LABELS;
    const sizes = alarmSizes(this.measure, fontPx, labels);
    let h = this.tall ? Math.min(this.h, TALL_BUDGET) : this.h;
    if (narrow) {
      // the chain, then two rows of two causes: the height their boxes and gaps need
      const heights = (ids: AlarmId[]): number => Math.max(...ids.map((id) => sizes[id].h));
      const rows = [
        ...ALARM_IDS.slice(0, 5).map((id) => sizes[id].h),
        heights(['kalite', 'mevsim']),
        heights(['davranis', 'yonetisim']),
      ];
      h = Math.max(h, Math.ceil(rows.reduce((a, b) => a + b, 0) + (rows.length - 1) * ROW_GAP + 2 * ALARM_MARGIN));
    }
    this.svg.attr('width', this.w).attr('height', h);
    const placed = alarmLayout(this.w, h, narrow, sizes);
    const at = new Map(placed.map((n) => [n.id, n]));
    // the returns bow away from the chain: wide as the book set them; narrow the left column's go west, the right one's east,
    // far enough to clear the widest chain node (a positive bend is to the right of the travel direction, which is north here)
    const chainHalf = Math.max(...ALARM_IDS.slice(0, 5).map((id) => sizes[id].w)) / 2;
    const cx = this.w / 2;
    // the two edges to the lower row of causes would pass behind the upper row: they bow round its outer side when there is room
    const LOWER: Record<string, AlarmId> = { 'neden-davranis': 'kalite', 'neden-yonetisim': 'mevsim' };
    const edges = v.graph.edges.map((e) => {
      if (narrow && LOWER[e.id]) {
        const target = at.get(e.to)!;
        const upper = at.get(LOWER[e.id])!;
        const west = target.x < cx;
        const outer = west ? upper.x - upper.w / 2 : this.w - (upper.x + upper.w / 2);
        const midX = (at.get('neden')!.x + target.x) / 2;
        const need = west ? midX - (upper.x - upper.w / 2 - 18) : upper.x + upper.w / 2 + 18 - midX;
        return outer >= 40 ? { ...e, bend: west ? need : -need } : e;
      }
      if (!narrow || e.kind !== 'outer') {
        return e;
      }
      const from = at.get(e.from)!;
      const dx = Math.abs(from.x - cx);
      const bend = Math.max(36, Math.min(chainHalf + 14 - dx / 2, cx - dx / 2 - 6));
      return { ...e, bend: from.x < cx ? -bend : bend };
    });
    const spec: FlowGraphSpec = {
      ...v.graph,
      edges,
      nodes: v.graph.nodes.map((n) => {
        const p = at.get(n.id)!;
        return { ...n, label: labels[n.id as AlarmId], x: p.x, y: p.y, w: p.w, h: p.h };
      }),
    };
    this.layer.draw(spec, ms, fontPx);
  }
}
