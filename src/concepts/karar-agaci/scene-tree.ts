import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import { easeCubicInOut } from 'd3-ease';
import { tr } from '../../core/plot/transition';
import { formatNumber } from '../../core/plot/format';
import { MARK, NAVY, TEXT, WHITE, r1 } from '../../core/plot/marks';
import { TextMeasure } from '../../core/plot/text-measure';
import type { Mode } from '../../core/mode';
import { impurity, type Criterion } from './impurity';
import type { TreeNode } from './cart';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Transition name of the tree (interrupted by the scene before every render). */
export const TREE_T = 'tree';
/** Question wording per feature: "Sözleşme ≤ 11,5?". */
export const AXIS_NAMES = ['Sözleşme', 'Şikâyet'] as const;
/** Font px of `.tree-text` when computed styles are unavailable (jsdom): theme.css --fs-axis at 1280 px. */
const FALLBACK_PX: Record<Mode, number> = { ders: 19, lab: 14 };

const TRANSLATE = /translate\(([-\d.]+),([-\d.]+)\)/;

/** Threshold as shown in questions: whole numbers without decimals, else one decimal. */
export const fmtThreshold = (t: number): string => formatNumber(t, Number.isInteger(t) ? 0 : 1);

/** One text line of a node box; a part after the first starts `GAP_EM` further right. */
interface Line { parts: { text: string; cls: 0 | 1 | null }[] }
const GAP_EM = 0.8;
interface Placed {
  id: string;
  node: TreeNode;
  leaf: boolean;
  lines: [Line, Line];
  w: number;
  x: number; // centre
  y: number; // top
  parent: Placed | null;
  side: 0 | 1; // 0 = left child ("evet"), 1 = right child ("hayır")
}
interface Sub { items: { p: Placed; dx: number; depth: number }[]; left: number[]; right: number[] }


function nodeLines(n: TreeNode, k: Criterion): [Line, Line] {
  const name = k === 'gini' ? 'Gini' : 'Entropi';
  // a Lab threshold at the end of an axis leaves one branch without customers
  if (n.counts[0] + n.counts[1] === 0) {
    return [{ parts: [{ text: '0 müşteri', cls: null }] }, { parts: [{ text: `${name} —`, cls: null }] }];
  }
  const measure = { parts: [{ text: `${name} ${formatNumber(impurity(n.counts, k), 3)}`, cls: null }] } as Line;
  if (n.split && n.left && n.right) {
    return [{ parts: [{ text: `${AXIS_NAMES[n.split.feature]} ≤ ${fmtThreshold(n.split.threshold)}?`, cls: null }] }, measure];
  }
  return [{ parts: [{ text: `● ${n.counts[0]}`, cls: 0 }, { text: `▲ ${n.counts[1]}`, cls: 1 }] }, measure];
}

/**
 * The growing tree in the scene's right column: one box per node (the question
 * or the leaf's class counts, and its impurity), edges labelled "evet" (left,
 * ≤ threshold) and "hayır". Boxes keep their text size; a tree wider than the
 * column makes the column scroll (the svg is as wide as the tree). Layout is a
 * contour (Reingold–Tilford style) placement so leaves at different depths share
 * horizontal space. Nodes are keyed by their path ("r", "rL", "rLR", …): new
 * nodes grow out of their parent, removed ones fade away.
 */
export class TreeLayer {
  readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly gEdges: Selection<SVGGElement, unknown, null, undefined>;
  private readonly gNodes: Selection<SVGGElement, unknown, null, undefined>;
  private readonly measure: TextMeasure;
  /** Last drawn centre of each node id: new children grow from their parent's old place. */
  private at = new Map<string, { x: number; y: number }>();
  /**
   * Measured text widths by font px and text: scan ticks and drag frames reuse
   * them instead of forcing a layout per render. Bounded: cleared when large.
   */
  private widths = new Map<string, number>();

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    const el = doc.createElementNS(SVG_NS, 'svg');
    el.setAttribute('class', 'tree');
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', 'Karar ağacı');
    host.append(el);
    this.svg = select(el);
    this.gEdges = this.svg.append('g').attr('class', 'edges');
    this.gNodes = this.svg.append('g').attr('class', 'nodes');
    const probe = this.svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
  }

  /** Width in px the tree needs when drawn (column padding not included). */
  widthOf(tree: TreeNode, k: Criterion, mode: Mode): number {
    const m = this.metrics(mode);
    const sub = this.layout(tree, k, null, 0, 'r', m.hGap, m.padX, m.fs);
    return Math.max(...sub.right) - Math.min(...sub.left) + 2 * m.edge;
  }

  private metrics(mode: Mode): { fs: number; lineH: number; padX: number; padY: number; nodeH: number; vGap: number; hGap: number; edge: number } {
    const fs = this.measure.fontPx('tree-text', FALLBACK_PX[mode]);
    const lineH = Math.round(fs * 1.25);
    const padY = Math.round(fs * 0.3);
    return {
      fs,
      lineH,
      padX: Math.round(fs * 0.5),
      padY,
      nodeH: 2 * lineH + 2 * padY,
      vGap: Math.round(fs * 1.9), // room for the "evet"/"hayır" labels
      hGap: Math.round(fs * 0.8),
      edge: 6,
    };
  }

  /**
   * Draws `tree` (null clears) at least `minWidth` px wide; `ms` (already
   * scaled) animates, 0 jumps. Returns the drawn height in px.
   */
  update(tree: TreeNode | null, k: Criterion, mode: Mode, minWidth: number, ms: number): number {
    const { fs, lineH, padX, padY, nodeH, vGap, hGap, edge } = this.metrics(mode);

    const placed: Placed[] = [];
    let width = minWidth;
    let height = 0;
    if (tree) {
      const sub = this.layout(tree, k, null, 0, 'r', hGap, padX, fs);
      const minL = Math.min(...sub.left);
      const maxR = Math.max(...sub.right);
      const treeW = maxR - minL + 2 * edge;
      width = Math.max(minWidth, treeW);
      const ox = (width - treeW) / 2 + edge - minL;
      for (const it of sub.items) {
        it.p.x = ox + it.dx;
        it.p.y = edge + it.depth * (nodeH + vGap);
        placed.push(it.p);
      }
      height = Math.max(...placed.map((p) => p.y)) + nodeH + edge;
    }
    this.svg.attr('width', r1(width)).attr('height', r1(height));

    const old = this.at;
    const from = (p: Placed): { x: number; y: number } => {
      const o = old.get(p.id);
      if (o) return o;
      for (let q = p.parent; q; q = q.parent) {
        const po = old.get(q.id);
        if (po) return po;
      }
      return { x: p.x, y: p.y };
    };
    const pos = (q: { x: number; y: number }, w = 0): string => `translate(${r1(q.x - w / 2)},${r1(q.y)})`;

    // ---- nodes
    const nodes = this.gNodes.selectAll<SVGGElement, Placed>('g.node').data(placed, (d) => d.id).join(
      (enter) => {
        const g = enter.append('g').attr('opacity', 0).attr('transform', (d) => pos(from(d), d.w));
        g.append('rect').attr('rx', 6).attr('stroke-width', 2);
        g.append('text').attr('class', 'tree-text l0');
        g.append('text').attr('class', 'tree-text l1');
        return g;
      },
      (update) => update,
      (exit) => { tr(exit, TREE_T, ms).attr('opacity', 0).remove(); },
    );
    nodes.attr('class', (d) => `node ${d.leaf ? 'leaf' : 'internal'}`);
    nodes.select('rect')
      .attr('width', (d) => r1(d.w)).attr('height', nodeH)
      .attr('fill', (d) => (d.leaf ? tint(d.node) : WHITE))
      .attr('stroke', (d) => (d.leaf ? MARK[major(d.node)] : NAVY));
    for (const li of [0, 1] as const) {
      const t = nodes.select<SVGTextElement>(`text.l${li}`)
        .attr('x', (d) => r1(d.w / 2)).attr('y', r1(padY + li * lineH + lineH * 0.78))
        .attr('text-anchor', 'middle')
        .attr('font-weight', (d) => (li === 0 && !d.leaf ? 700 : null));
      t.selectAll<SVGTSpanElement, Line['parts'][number]>('tspan').data((d) => d.lines[li].parts).join('tspan')
        .attr('fill', (p) => (p.cls === null ? NAVY : TEXT[p.cls]))
        .attr('dx', (_p, i) => (i > 0 ? `${GAP_EM}em` : null))
        .text((p) => p.text);
    }
    if (ms <= 0) nodes.attr('transform', (d) => pos(d, d.w)).attr('opacity', 1);
    else {
      // tween the translate numbers directly (no SVG matrix parsing)
      nodes.transition(TREE_T).duration(ms).ease(easeCubicInOut).attr('opacity', 1)
        .attrTween('transform', function (d) {
          const m = TRANSLATE.exec(this.getAttribute('transform') ?? '');
          const a = m ? { x: Number(m[1]), y: Number(m[2]) } : { x: d.x - d.w / 2, y: d.y };
          const b = { x: d.x - d.w / 2, y: d.y };
          return (t) => `translate(${r1(a.x + (b.x - a.x) * t)},${r1(a.y + (b.y - a.y) * t)})`;
        });
    }

    // ---- edges: parent bottom centre → child top centre, labelled at the middle
    const kids = placed.filter((p) => p.parent);
    const path = (a: { x: number; y: number }, b: { x: number; y: number }): string => {
      const y0 = a.y + nodeH;
      const ym = (y0 + b.y) / 2;
      return `M${r1(a.x)},${r1(y0)}C${r1(a.x)},${r1(ym)} ${r1(b.x)},${r1(ym)} ${r1(b.x)},${r1(b.y)}`;
    };
    const edges = this.gEdges.selectAll<SVGGElement, Placed>('g.edge-g').data(kids, (d) => d.id).join(
      (enter) => {
        const g = enter.append('g').attr('class', 'edge-g').attr('opacity', 0);
        g.append('path').attr('class', 'edge').attr('fill', 'none').attr('stroke', NAVY).attr('stroke-width', 2)
          .attr('d', (d) => { const f = from(d.parent!); return path(f, f); });
        g.append('text').attr('class', 'tree-text edge-label')
          .attr('x', (d) => r1(from(d.parent!).x)).attr('y', (d) => r1(from(d.parent!).y + nodeH));
        return g;
      },
      (update) => update,
      (exit) => { tr(exit, TREE_T, ms).attr('opacity', 0).remove(); },
    );
    edges.select('text.edge-label')
      .attr('text-anchor', (d) => (d.side === 0 ? 'end' : 'start'))
      .text((d) => (d.side === 0 ? 'evet' : 'hayır'));
    tr(edges, TREE_T, ms).attr('opacity', 1);
    tr(edges.select<SVGPathElement>('path.edge'), TREE_T, ms).attr('d', (d) => path(d.parent!, d));
    // the label sits beside the edge's vertical end above the child, on the
    // outer side (the edge arrives from the inner side)
    tr(edges.select<SVGTextElement>('text.edge-label'), TREE_T, ms)
      .attr('x', (d) => r1(d.x + (d.side === 0 ? -1 : 1) * fs * 0.4))
      .attr('y', (d) => r1(d.y - vGap * 0.22));

    this.at = new Map(placed.map((p) => [p.id, { x: p.x, y: p.y }]));
    return height;
  }

  destroy(): void {
    this.svg.selectAll('*').interrupt(TREE_T);
    this.svg.remove();
  }

  private textWidth(text: string, fs: number): number {
    const key = `${fs}|${text}`;
    let w = this.widths.get(key);
    if (w === undefined) {
      if (this.widths.size >= 512) this.widths.clear();
      w = this.measure.width(text, 'tree-text', fs);
      this.widths.set(key, w);
    }
    return w;
  }

  private layout(
    n: TreeNode, k: Criterion, parent: Placed | null, side: 0 | 1, id: string, gap: number, padX: number, fs: number,
  ): Sub {
    const lines = nodeLines(n, k);
    const lineW = (l: Line): number =>
      l.parts.reduce((s, q) => s + this.textWidth(q.text, fs), 0) + (l.parts.length - 1) * GAP_EM * fs;
    const w = Math.max(...lines.map(lineW)) + 2 * padX;
    const leaf = !(n.split && n.left && n.right);
    const p: Placed = { id, node: n, leaf, lines, w, x: 0, y: 0, parent, side };
    if (leaf) return { items: [{ p, dx: 0, depth: 0 }], left: [-w / 2], right: [w / 2] };
    const L = this.layout(n.left!, k, p, 0, `${id}L`, gap, padX, fs);
    const R = this.layout(n.right!, k, p, 1, `${id}R`, gap, padX, fs);
    // smallest centre distance that keeps every shared level `gap` apart
    let s = 0;
    for (let i = 0; i < Math.min(L.right.length, R.left.length); i++) s = Math.max(s, L.right[i] + gap - R.left[i]);
    const h = s / 2;
    const levels = Math.max(L.left.length, R.left.length);
    const left = [-w / 2];
    const right = [w / 2];
    for (let i = 0; i < levels; i++) {
      left.push(Math.min(L.left[i] ?? Infinity, (R.left[i] ?? Infinity) + 2 * h) - h);
      right.push(Math.max((L.right[i] ?? -Infinity) - 2 * h, R.right[i] ?? -Infinity) + h);
    }
    return {
      items: [
        { p, dx: 0, depth: 0 },
        ...L.items.map((it) => ({ p: it.p, dx: it.dx - h, depth: it.depth + 1 })),
        ...R.items.map((it) => ({ p: it.p, dx: it.dx + h, depth: it.depth + 1 })),
      ],
      left,
      right,
    };
  }
}

/** Majority class of a node; ties go to class 0 (as `predict`). */
const major = (n: TreeNode): 0 | 1 => (n.counts[1] > n.counts[0] ? 1 : 0);
/** Light fill of a leaf in its predicted class colour. */
const tint = (n: TreeNode): string => (major(n) === 1 ? '#FDEBD3' : '#D7F1F1');
