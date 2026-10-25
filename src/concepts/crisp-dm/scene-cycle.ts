import { select, type Selection } from 'd3-selection';
import type { Mode } from '../../core/mode';
import { FlowGraphLayer, naturalSize, type FlowGraphSpec } from '../../core/plot/flow-graph';
import { formatPercent } from '../../core/plot/format';
import { TextMeasure } from '../../core/plot/text-measure';
import { cycleLayout, projectPath } from './calc';
import { META, type Cell, type Outcome } from './data';
import { el, NARROW, NS } from './scene-base';
import type { CrispView } from './view';

const pct = (v: number | null): string => (v === null ? '—' : formatPercent(v));

/** The failed conditions of an outcome as "kaçan talep %6,5 > %3" / "israf düşüşü %12,0 < %15". */
function conditions(o: Outcome, failed: readonly ('waste' | 'service')[]): string {
  return failed
    .map(k => (k === 'waste'
      ? `israf düşüşü ${pct(o.reduction)} < ${formatPercent(META.criteria.waste, 0)}`
      : `kaçan talep ${pct(o.lostShare)} > ${formatPercent(META.criteria.service, 0)}`))
    .join('; ');
}

/**
 * The one-line reason written beside the node that sends the Lab project back (numbers from the data and `META`),
 * with the node it belongs to; null when the project is deployed and stays.
 */
export function pathReason(cell: Cell): { node: string; text: string } | null {
  const path = projectPath(cell);
  if (path.end === 'yetersiz') {
    const exam = cell.usable.sinav <= cell.usable.normal;
    return {
      node: 'd1',
      text: `Veri yeterli mi? Hayır: ${exam ? 'sınav günü' : 'normal gün'} ${exam ? cell.usable.sinav : cell.usable.normal} < ${META.minGroup}`,
    };
  }
  if (path.end === 'uygun-degil') {
    return { node: 'd2', text: `Sonuç uygun mu? Hayır: ${conditions(cell.eval, path.failed)}` };
  }
  if (path.end === 'sahada-dustu') {
    return { node: 'ya', text: `Sahada tutmadı: ${conditions(cell.deploy, path.failed)}` };
  }
  return null;
}

/**
 * The cycle (left; narrow: on top): the `FlowGraphLayer` on the nodes `cycleLayout` places, the token on the current
 * phase and, in the Lab, the reason line (`.path-reason`) inside the circle.
 */
export class CycleScene {
  readonly root: HTMLDivElement;
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly layer: FlowGraphLayer;
  private readonly measure: TextMeasure;
  private reason: HTMLDivElement | null = null;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'cycle-area');
    const root = doc.createElementNS(NS, 'svg');
    this.svg = select(root)
      .attr('class', 'crisp-cycle')
      .attr('role', 'img')
      .attr('aria-label', 'CRISP-DM döngüsü: altı evre, iki karar ve geri dönüşler');
    const probe = this.svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
    this.layer = new FlowGraphLayer(this.svg.append('g').attr('class', 'cycle-graph'), this.measure);
    this.root.append(root);
    host.append(this.root);
  }

  resize(w: number, h: number, mode: Mode): void {
    this.w = Math.max(1, Math.floor(w));
    this.h = Math.max(1, Math.floor(h));
    this.mode = mode;
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('flow-token');
    this.svg.selectAll('*').interrupt('flow-token-end');
  }

  destroy(): void {
    this.interrupt();
    this.root.remove();
  }

  /** Draws the view's graph on the laid-out nodes; `reason` is the Lab's line (null in the Ders). */
  update(v: CrispView, ms: number, reason: { node: string; text: string } | null): void {
    this.svg.attr('width', this.w).attr('height', this.h);
    const narrow = this.w < NARROW;
    // the label size the CSS gives (smaller in a narrow stage), not the theme token itself
    const fontPx = this.measure.fontPx('flow-label', this.measure.fonts(this.mode).tick);
    // every box is sized from its label, then the ellipse is fitted to the area
    // rhombi are flat where the width allows it (a stacked stage that cannot grow), steeper on a phone
    const wide = this.w >= 600 && narrow ? 2.2 : 1.6;
    const sizes = Object.fromEntries(v.graph.nodes.map(n => [n.id, naturalSize(n, this.measure, fontPx, wide)]));
    const lay = cycleLayout(this.w, this.h, narrow, sizes);
    const at = new Map(lay.nodes.map(n => [n.id as string, n]));
    const spec: FlowGraphSpec = {
      ...v.graph,
      nodes: v.graph.nodes.map(n => {
        const p = at.get(n.id)!;
        return { ...n, x: p.x, y: p.y, w: p.w, h: p.h };
      }),
    };
    this.layer.draw(spec, ms, fontPx);
    if (reason) {
      const box = this.reason ?? el(this.root.ownerDocument, 'div', 'path-reason');
      if (!this.reason) {
        this.reason = box;
        this.root.append(box);
      }
      box.textContent = reason.text;
      box.dataset.node = reason.node;
      // inside the ellipse, between the two decisions: the room is the gap between their inner corners
      const d1 = at.get('d1')!;
      const d2 = at.get('d2')!;
      const inner = Math.max(80, Math.min(280, d1.x - d1.w / 2 - (d2.x + d2.w / 2) - 8));
      box.style.left = `${Math.round(lay.cx)}px`;
      box.style.top = `${Math.round(lay.cy)}px`;
      box.style.width = `${Math.round(inner)}px`;
    } else if (this.reason) {
      this.reason.remove();
      this.reason = null;
    }
  }
}
