import { select, type Selection } from 'd3-selection';
import type { Mode } from '../../core/mode';
import { FlowGraphLayer, edgeGeometry, naturalSize, type FlowGraphSpec, type FlowNode } from '../../core/plot/flow-graph';
import { overlap, type Box } from '../../core/plot/label-place';
import { TextMeasure } from '../../core/plot/text-measure';
import { cycleLayout, type CycleLayout } from './calc';
import { el, NARROW, NS } from './scene-base';
import type { CrispView, RouteReason } from './view';

/** The reason box's padding plus border (px, as crisp-dm.css gives it), its line height (em) and a few px of slack for the measuring. */
const REASON_PAD_X = 10;
const REASON_PAD_Y = 6;
const REASON_LH = 1.3;
const REASON_SLACK = 6;
/** Space the reason box keeps from a node and from the area's edge (px), its preferred top below the ellipse's centre. */
const REASON_CLEAR = 6;
const REASON_BELOW = 6;
/** Widest reason box (px), and the narrowest worth trying inside the ellipse; the width steps down by `REASON_STEP`. */
const REASON_MAX_W = 280;
const REASON_MIN_W = 120;
const REASON_STEP = 20;

type Pt = readonly [number, number];
const inside = (b: Box, p: Pt): boolean => p[0] >= b.l && p[0] <= b.r && p[1] >= b.t && p[1] <= b.b;
const grow = (b: Box, m: number): Box => ({ l: b.l - m, t: b.t - m, r: b.r + m, b: b.b + m });

/** A spot for the reason box; `clear` is true when it keeps `REASON_CLEAR` px from every node. */
export interface ReasonSpot {
  box: Box;
  clear: boolean;
}

/**
 * Where a `size` reason box goes inside the cycle: centred on the ellipse's vertical axis, at the height between the
 * top and bottom phases that keeps clear of every node (first) and covers the fewest edge `points` (then), as close
 * as possible to just below the centre, where no back edge runs.
 */
export function reasonSpot(lay: CycleLayout, size: { w: number; h: number }, points: readonly Pt[]): ReasonSpot {
  const boxes = lay.nodes.map(n => grow({ l: n.x - n.w / 2, t: n.y - n.h / 2, r: n.x + n.w / 2, b: n.y + n.h / 2 }, REASON_CLEAR));
  const top = lay.nodes.find(n => n.id === 'ia')!;
  const bottom = lay.nodes.find(n => n.id === 'mo')!;
  const lo = top.y + top.h / 2 + REASON_CLEAR;
  const hi = bottom.y - bottom.h / 2 - REASON_CLEAR - size.h;
  const at = (t: number): Box => ({ l: lay.cx - size.w / 2, t, r: lay.cx + size.w / 2, b: t + size.h });
  const prefer = Math.min(hi, Math.max(lo, lay.cy + REASON_BELOW));
  let best = at(lay.cy - size.h / 2);
  let bestKey = [Infinity, Infinity, Infinity];
  for (let t = lo; t <= hi; t += 2) {
    const b = at(t);
    const key = [
      boxes.reduce((sum, n) => sum + overlap(b, n), 0),
      points.filter(p => inside(b, p)).length,
      Math.abs(t - prefer),
    ];
    const better = key[0] < bestKey[0]
      || (key[0] === bestKey[0] && (key[1] < bestKey[1] || (key[1] === bestKey[1] && key[2] < bestKey[2])));
    if (better) {
      best = b;
      bestKey = key;
    }
  }
  return { box: best, clear: bestKey[0] === 0 };
}

/** Sample points along every edge of `graph` on the laid-out `nodes` (what the reason box should not cover). */
function edgePoints(graph: FlowGraphSpec, nodes: FlowNode[]): Pt[] {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const points: Pt[] = [];
  for (const e of graph.edges) {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) {
      continue;
    }
    const geo = edgeGeometry(a, b, e.bend ?? 0);
    for (let t = 0; t <= 1.001; t += 0.05) {
      points.push(geo.at(t));
    }
  }
  return points;
}

/**
 * The cycle (left; narrow: on top): the `FlowGraphLayer` on the nodes `cycleLayout` places, the token on the current
 * phase and, in the Lab, the route's reason line (`.path-reason`) inside the circle. The reason box is placed first
 * (`reasonSpot`) and handed to the layer as an `avoid` box, so the edge labels keep clear of it.
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
  private grows = false;

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

  /** `grows`: the stage takes its height from the content (a phone), so a reason band may add to `h`. */
  resize(w: number, h: number, mode: Mode, grows = false): void {
    this.w = Math.max(1, Math.floor(w));
    this.h = Math.max(1, Math.floor(h));
    this.mode = mode;
    this.grows = grows;
  }

  interrupt(): void {
    this.layer.interrupt();
  }

  destroy(): void {
    this.interrupt();
    this.root.remove();
  }

  /** The nodes of `graph` on the ellipse that fits the scene's width and `h`. */
  private place(graph: FlowGraphSpec, h: number, narrow: boolean, sizes: Record<string, { w: number; h: number }>): { lay: CycleLayout; nodes: FlowNode[] } {
    const lay = cycleLayout(this.w, h, narrow, sizes);
    const at = new Map(lay.nodes.map(n => [n.id as string, n]));
    const nodes: FlowNode[] = graph.nodes.map(n => {
      const p = at.get(n.id)!;
      return { ...n, x: p.x, y: p.y, w: p.w, h: p.h };
    });
    return { lay, nodes };
  }

  /** The reason wrapped to a box at most `maxW` px wide: its lines and the box size. */
  private wrapReason(text: string, maxW: number, tickPx: number): { lines: string[]; w: number; h: number } {
    const lines = this.measure.wrap(text, maxW - 2 * REASON_PAD_X - REASON_SLACK, 'tick', tickPx);
    const w = Math.min(maxW, this.measure.maxWidth(lines, 'tick', tickPx) + 2 * REASON_PAD_X + REASON_SLACK);
    return { lines, w, h: lines.length * tickPx * REASON_LH + 2 * REASON_PAD_Y };
  }

  /**
   * Draws the view's graph on the laid-out nodes, with the route's reason line in the Lab (`v.route.reason`). The
   * reason box goes inside the ellipse, as wide as the room between the two decisions allows and narrower (taller)
   * until it keeps clear of every node; where no width fits (a phone), the box takes a band under the ellipse: the
   * cycle grows by the band where the stage grows (`grows`), else the ellipse moves up. The box is then an `avoid`
   * box for the edge labels. Returns the height the cycle uses (more than `h` only with a band on a growing stage).
   */
  update(v: CrispView, ms: number): number {
    let height = this.h;
    const narrow = this.w < NARROW;
    // the label size the CSS gives (smaller in a narrow stage), not the theme token itself
    const fonts = this.measure.fonts(this.mode);
    const fontPx = this.measure.fontPx('flow-label', fonts.tick);
    // every box is sized from its label, then the ellipse is fitted to the area
    // rhombi are flat where the width allows it (a stacked stage that cannot grow), steeper on a phone
    const wide = this.w >= 600 && narrow ? 2.2 : 1.6;
    const sizes = Object.fromEntries(v.graph.nodes.map(n => [n.id, naturalSize(n, this.measure, fontPx, wide)]));
    let { lay, nodes } = this.place(v.graph, this.h, narrow, sizes);
    const reason = v.route?.reason ?? null;
    let spot: Box | null = null;
    if (reason) {
      let lines: string[] = [];
      // inside the ellipse: centred on its axis, clear of the nearer decision's inner corner
      const d1 = nodes.find(n => n.id === 'd1')!;
      const d2 = nodes.find(n => n.id === 'd2')!;
      const room = Math.min(REASON_MAX_W, 2 * (Math.min(d1.x - d1.w / 2 - lay.cx, lay.cx - d2.x - d2.w / 2) - REASON_CLEAR));
      const points = edgePoints(v.graph, nodes);
      for (let maxW = room; maxW >= REASON_MIN_W && !spot; maxW -= REASON_STEP) {
        const r = this.wrapReason(reason.text, maxW, fonts.tick);
        const found = reasonSpot(lay, r, points);
        if (found.clear) {
          spot = found.box;
          lines = r.lines;
        }
      }
      if (!spot) {
        // a band under the ellipse, as wide as the area allows
        const r = this.wrapReason(reason.text, Math.min(1.5 * REASON_MAX_W, this.w - 2 * REASON_CLEAR), fonts.tick);
        let t = this.h;
        if (this.grows) {
          height = this.h + r.h + REASON_CLEAR;
        } else {
          t = this.h - r.h - REASON_CLEAR;
          ({ lay, nodes } = this.place(v.graph, t, narrow, sizes));
        }
        spot = { l: this.w / 2 - r.w / 2, t, r: this.w / 2 + r.w / 2, b: t + r.h };
        lines = r.lines;
      }
      spot = this.showReason(reason, lines, spot);
    } else if (this.reason) {
      this.reason.remove();
      this.reason = null;
    }
    this.svg.attr('width', this.w).attr('height', height);
    const spec: FlowGraphSpec = { ...v.graph, nodes, ...(spot ? { avoid: [spot] } : {}) };
    this.layer.draw(spec, ms, fontPx);
    return height;
  }

  /** Writes the reason's lines into its box at `spot` (whole px); returns the box as drawn. */
  private showReason(reason: RouteReason, lines: string[], spot: Box): Box {
    const doc = this.root.ownerDocument;
    if (!this.reason) {
      this.reason = el(doc, 'div', 'path-reason');
      this.root.append(this.reason);
    }
    const box = this.reason;
    box.dataset.node = reason.node;
    // one span per line, each ending in the space the wrap took out, so the text reads whole
    box.replaceChildren(...lines.map((line, i) => el(doc, 'span', 'reason-line', i < lines.length - 1 ? `${line} ` : line)));
    // `left` / `top` are the centre (the CSS translates the box back by half its size)
    const bw = Math.ceil(spot.r - spot.l);
    const bh = Math.ceil(spot.b - spot.t);
    const cx = Math.round((spot.l + spot.r) / 2);
    const cy = Math.round((spot.t + spot.b) / 2);
    box.style.left = `${cx}px`;
    box.style.top = `${cy}px`;
    box.style.width = `${bw}px`;
    box.style.height = `${bh}px`;
    return { l: cx - bw / 2, t: cy - bh / 2, r: cx + bw / 2, b: cy + bh / 2 };
  }
}
