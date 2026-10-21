import type { Selection } from 'd3-selection';
import { tickFormat } from './format';
import { FRAME, NAVY, r1 } from './marks';
import { tr } from './transition';
import { scaleLinear } from 'd3-scale';

export interface LineSpec {
  min: number; max: number;
  breakAt?: number;
  farMax?: number;
  farFrac?: number;
  gapPx?: number;
}
export interface LineScale {
  (v: number): number;
  readonly spec: LineSpec;
  readonly range: [number, number];
  readonly gap: [number, number] | null;
  isFar(v: number): boolean;
  ticks(count: number): number[];
}

const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));

export function lineScale(spec: LineSpec, range: [number, number]): LineScale {
  const [r0, r1_] = range;
  const broken = spec.breakAt !== undefined && spec.farMax !== undefined;
  const linMax = broken ? Math.min(spec.max, spec.breakAt!) : spec.max;
  const width = r1_ - r0;
  const gapPx = spec.gapPx ?? 20;
  const farFrac = spec.farFrac ?? 0.22;
  const linEnd = broken ? r0 + width * (1 - farFrac) - gapPx : r1_;
  const farStart = linEnd + gapPx;
  const lin = scaleLinear().domain([spec.min, linMax]).range([r0, linEnd]);
  const far = broken ? scaleLinear().domain([spec.breakAt!, spec.farMax!]).range([farStart, r1_]) : null;

  const sc = ((v: number): number => {
    if (far && v > spec.breakAt!) return far(clamp(v, spec.breakAt!, spec.farMax!));
    return lin(clamp(v, spec.min, linMax));
  }) as { -readonly [K in keyof LineScale]: LineScale[K] } & ((v: number) => number);
  sc.spec = spec;
  sc.range = range;
  sc.gap = broken ? [linEnd, farStart] : null;
  sc.isFar = (v) => broken && v > spec.breakAt!;
  sc.ticks = (count) => lin.ticks(count);
  return sc;
}

export function stackLevels(px: readonly number[], minGap: number): number[] {
  const order = px.map((_, i) => i).sort((a, b) => px[a] - px[b] || a - b);
  const levels: number[] = new Array(px.length).fill(0);
  const placed: { x: number; lv: number }[] = [];
  for (const i of order) {
    let lv = 0;
    while (placed.some((p) => p.lv === lv && Math.abs(p.x - px[i]) < minGap)) lv++;
    levels[i] = lv;
    placed.push({ x: px[i], lv });
  }
  return levels;
}

export function staggerRows(boxes: readonly { x: number; w: number }[], pad: number): number[] {
  const order = boxes.map((_, i) => i).sort((a, b) => boxes[a].x - boxes[b].x || a - b);
  const rows: number[] = new Array(boxes.length).fill(0);
  const placed: { b: { x: number; w: number }; row: number }[] = [];
  for (const i of order) {
    const b = boxes[i];
    let row = 0;
    while (placed.some((p) => p.row === row && Math.abs(p.b.x - b.x) < (p.b.w + b.w) / 2 + pad)) row++;
    rows[i] = row;
    placed.push({ b, row });
  }
  return rows;
}

export class NumberLineLayer {
  private readonly axis: Selection<SVGLineElement, unknown, null, undefined>;
  private readonly ticksG: Selection<SVGGElement, unknown, null, undefined>;
  private readonly brk: Selection<SVGGElement, unknown, null, undefined>;
  private readonly title: Selection<SVGTextElement, unknown, null, undefined>;

  constructor(parent: Selection<SVGGElement, unknown, null, undefined>) {
    const root = parent.append('g').attr('class', 'number-line');
    this.axis = root.append('line').attr('class', 'nl-axis').attr('stroke', NAVY);
    this.ticksG = root.append('g').attr('class', 'ticks');
    this.brk = root.append('g').attr('class', 'break-mark');
    this.title = root.append('text').attr('class', 'axis-title').attr('text-anchor', 'middle');
  }

  /** Ticks are re-keyed when `dataKey` changes. */
  draw(sc: LineScale, y: number, opts: { tickCount: number; tickY: number; title: string; titleY: number }, ms: number, dataKey: string): void {
    const [a, b] = sc.range;
    this.axis.attr('x1', r1(a)).attr('x2', r1(b)).attr('y1', r1(y)).attr('y2', r1(y));

    const tk = sc.ticks(opts.tickCount);
    const fmt = tickFormat(tk);
    const sel = this.ticksG.selectAll<SVGGElement, number>('g.tick').data(tk, (d) => `${dataKey}:${d}`).join(
      (enter) => {
        const g = enter.append('g').attr('class', 'tick').attr('opacity', 0)
          .attr('transform', (d) => `translate(${r1(sc(d))},0)`);
        g.append('line').attr('stroke', FRAME);
        g.append('text').attr('text-anchor', 'middle');
        return g;
      },
      (update) => update,
      (exit) => { tr(exit, 'axes', ms).attr('opacity', 0).remove(); },
    );
    sel.select('line').attr('y1', r1(y - 4)).attr('y2', r1(y + 4));
    sel.select<SVGTextElement>('text').attr('y', r1(opts.tickY)).text((d) => fmt(d));
    tr(sel, 'axes', ms).attr('transform', (d) => `translate(${r1(sc(d))},0)`).attr('opacity', 1);

    const slashes = sc.gap ? [sc.gap[0], sc.gap[1]] : [];
    this.brk.selectAll<SVGLineElement, number>('line.break-slash').data(slashes, (_, i) => String(i)).join(
      (enter) => enter.append('line').attr('class', 'break-slash').attr('stroke', NAVY),
      (update) => update,
      (exit) => exit.remove(),
    ).attr('x1', (d) => r1(d - 3)).attr('x2', (d) => r1(d + 3))
      .attr('y1', r1(y + 7)).attr('y2', r1(y - 7));

    this.title.attr('x', r1((a + b) / 2)).attr('y', r1(opts.titleY)).text(opts.title);
  }
}
