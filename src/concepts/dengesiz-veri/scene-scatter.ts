import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import type { Mode } from '../../core/mode';
import { AxesLayer } from '../../core/plot/axes';
import { chooseOffset, labelArea, offsets, type Box as LabelBox } from '../../core/plot/label-place';
import { r1 } from '../../core/plot/marks';
import { TextMeasure } from '../../core/plot/text-measure';
import { tr } from '../../core/plot/transition';
import { fitViewport, type Rect } from '../../core/plot/viewport';
import { X_DOMAIN, Y_DOMAIN } from './model';
import { SidePanel } from './side-panel';
import type { ImbDot, ImbView } from './view';

const NS = 'http://www.w3.org/2000/svg';
type G = Selection<SVGGElement, unknown, null, undefined>;

/** Largest radius factor of a weighted dot (the Lab's heaviest manual weight, 30, is its square root). */
export const MAX_WEIGHT_SCALE = Math.sqrt(30);

/** Outer padding (px) around the drawing. */
const PAD = 8;
/** Gap (px) between the scatter and the side panel. */
const GAP = 12;
/** Below this width the side panel flows under the scatter. */
export const NARROW = 700;

export { X_DOMAIN, Y_DOMAIN };

/** A rectangle in px. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The two areas of the scene and the height the whole drawing needs. */
export interface SplitLayout {
  scatter: Box;
  side: Box;
  height: number;
  narrow: boolean;
}

/**
 * Splits a `w` x `h` stage: the side panel beside the scatter, or (under NARROW px) below it.
 * `sideNeed` is the height the side panel wants and `sideMin` the least it can do with; a narrow
 * drawing (or a wide one on a very short stage) may be taller than the stage.
 */
export function splitLayout(w: number, h: number, sideNeed: number, sideMin = 0): SplitLayout {
  if (w >= NARROW) {
    const sideW = Math.max(300, Math.min(560, Math.round(w * 0.4)));
    // a stage too short for the side panel's least height grows the drawing; the host scrolls
    const tall = Math.max(h, sideMin);
    return {
      scatter: { x: 0, y: 0, w: w - sideW - GAP, h: tall },
      side: { x: w - sideW, y: 0, w: sideW, h: tall },
      height: tall,
      narrow: false,
    };
  }
  const scatterH = Math.max(240, Math.min(Math.round(w * 0.85), Math.round(h * 0.75)));
  return {
    scatter: { x: 0, y: 0, w, h: scatterH },
    side: { x: 0, y: scatterH + GAP, w, h: sideNeed },
    height: Math.max(h, scatterH + GAP + sideNeed),
    narrow: true,
  };
}

/** What the scatter needs from the panel beside it. */
export interface SideLike {
  heightFor(v: ImbView, w: number, tick: number, axis: number): number;
  /** The least height the panel can be drawn in (cells at their shortest); default 0. */
  minHeightFor?(v: ImbView, w: number, tick: number, axis: number): number;
  draw(v: ImbView, o: { rect: Box; tick: number; axis: number; ms: number }): void;
}

/** Builds the panel beside the scatter inside the group `g`. */
export type SideFactory = (g: G, measure: TextMeasure) => SideLike;

/** The rectangle, scales and font sizes of one drawn scatter plot (hooks for subclasses). */
export interface PlotFrame {
  rect: Rect;
  sc: ReturnType<typeof fitViewport>;
  tick: number;
  axis: number;
  ms: number;
}

/**
 * The scatter and side panel of the imbalanced-data page (Ders steps 1-5): customers by tenure and
 * monthly charge, the step-5 SMOTE example on top, and the count bars / matrix / metrics beside it.
 */
export class ScatterScene {
  protected readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  protected readonly plotG: G;
  private readonly dotsG: G;
  private readonly exampleG: G;
  private readonly axes: AxesLayer;
  private readonly side: SideLike;
  protected readonly measure: TextMeasure;
  protected w = 1;
  protected h = 1;
  protected mode: Mode = 'ders';

  constructor(host: HTMLElement, makeSide: SideFactory = (g, m) => new SidePanel(g, m)) {
    const root = host.ownerDocument.createElementNS(NS, 'svg');
    host.append(root);
    this.svg = select(root)
      .attr('class', 'imb-plot')
      .attr('role', 'img')
      .attr('aria-label', 'Müşteriler kıdem ve aylık ücret düzleminde; yanda sınıf sayıları, karışıklık matrisi ve metrikler');
    this.plotG = this.svg.append('g').attr('class', 'imb-scatter');
    this.axes = new AxesLayer(this.plotG.append('g').attr('class', 'imb-axes'));
    this.dotsG = this.plotG.append('g').attr('class', 'imb-dots');
    this.exampleG = this.plotG.append('g').attr('class', 'imb-example');
    const probe = this.svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
    this.overG = this.svg.append('g').attr('class', 'imb-over');
    this.side = makeSide(this.svg.append('g').attr('class', 'imb-side'), this.measure);
  }

  /** Layer above the dots for subclasses (boundary lines, labels, notes). */
  protected readonly overG: G;

  /** Height (px) a subclass wants above the plot rectangle (notes). */
  protected reserveTop(_v: ImbView, _width: number, _tick: number): number {
    return 0;
  }

  /** Called after the dots are drawn; subclasses draw their layer over the plot. */
  protected drawOver(_v: ImbView, _f: PlotFrame, _scatter: Box): void {}

  /** Shows or hides the whole drawing. */
  setShown(shown: boolean): void {
    this.svg.node()!.style.display = shown ? '' : 'none';
  }

  resize(w: number, h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.mode = mode;
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('axes').interrupt('dots').interrupt('bars').interrupt('cellbg');
  }

  destroy(): void {
    this.interrupt();
    this.svg.remove();
  }

  /** Draws `v`; `ms` > 0 fades points in and out and grows the bars. */
  update(v: ImbView, ms: number): void {
    this.interrupt();
    const fonts = this.measure.fonts(this.mode);
    const { tick, axis } = fonts;
    const need = this.side.heightFor(v, this.w, tick, axis);
    const lay = splitLayout(this.w, this.h, need, this.side.minHeightFor?.(v, this.w, tick, axis) ?? 0);
    this.svg.attr('width', this.w).attr('height', lay.height);

    const gap = Math.round(tick * 0.45);
    const yTickW = this.measure.maxWidth(['120'], 'tick', tick);
    const left = lay.scatter.x + PAD + axis * 1.2 + gap + yTickW + gap;
    const right = lay.scatter.x + lay.scatter.w - PAD - tick * 0.6;
    const top = lay.scatter.y + PAD + this.reserveTop(v, lay.scatter.w, tick);
    const below = gap + tick * 1.2 + gap + axis * 1.25 + PAD;
    const bottom = lay.scatter.y + lay.scatter.h - below;
    const rect: Rect = { left, top, width: Math.max(60, right - left), height: Math.max(60, bottom - top) };
    const sc = fitViewport({ x: X_DOMAIN, y: Y_DOMAIN }, rect, false);
    this.axes.draw(
      sc,
      rect,
      {
        xTickCount: 7,
        yTickCount: 6,
        xTicks: [0, 12, 24, 36, 48, 60, 72],
        yTicks: [20, 40, 60, 80, 100, 120],
        xTickY: rect.top + rect.height + gap + tick * 0.9,
        yTickX: rect.left - gap,
        xTitle: {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height + gap + tick * 1.2 + gap + axis * 0.95,
          text: 'kıdem (ay)',
        },
        yTitle: { x: rect.left - gap - yTickW - gap - axis * 0.3, y: rect.top + rect.height / 2, lines: ['aylık ücret'] },
      },
      0,
      'imb',
    );
    this.drawDots(v, sc, tick, ms);
    this.drawExample(v, sc, tick, rect);
    this.drawOver(v, { rect, sc, tick, axis, ms }, lay.scatter);
    this.side.draw(v, { rect: lay.side, tick, axis, ms });
  }

  private drawDots(v: ImbView, sc: ReturnType<typeof fitViewport>, tick: number, ms: number): void {
    const r = Math.max(2.4, tick * 0.17);
    // a dot's area is proportional to its class weight
    const radius = (d: ImbDot): number => r1(r * Math.min(MAX_WEIGHT_SCALE, Math.sqrt(d.weight)));
    const cls = (d: ImbDot): string => {
      const parts = ['pt', d.cls === 1 ? 'pos' : 'neg'];
      if (d.synthetic) {
        parts.push('synthetic');
      }
      if (d.test && v.fadeTest) {
        parts.push('is-test');
      }
      return parts.join(' ');
    };
    this.dotsG
      .selectAll<SVGCircleElement, ImbDot>('circle.pt')
      .data(v.dots, (d) => d.id)
      .join(
        (enter) => {
          const c = enter.append('circle').attr('opacity', ms > 0 ? 0 : 1);
          tr(c, 'dots', ms).attr('opacity', 1);
          return c;
        },
        (update) => update.attr('opacity', 1),
        (exit) => {
          tr(exit, 'dots', ms).attr('opacity', 0).remove();
        },
      )
      .attr('class', cls)
      .attr('r', radius)
      .attr('cx', (d) => r1(sc.x(d.tenure)))
      .attr('cy', (d) => r1(sc.y(d.charge)));
  }

  /** Step 5: five neighbour lines, the chosen one thicker, x_i, x_zi and x_new. */
  private drawExample(v: ImbView, sc: ReturnType<typeof fitViewport>, tick: number, rect: Rect): void {
    const e = v.example;
    const g = this.exampleG;
    const px = (p: { tenure: number }): number => r1(sc.x(p.tenure));
    const py = (p: { charge: number }): number => r1(sc.y(p.charge));
    const line = (cls: string, to: { tenure: number; charge: number }[]): void => {
      g.selectAll<SVGLineElement, { tenure: number; charge: number }>(`line.${cls}`)
        .data(e ? to : [])
        .join('line')
        .attr('class', cls)
        .attr('x1', e ? px(e.xi) : 0)
        .attr('y1', e ? py(e.xi) : 0)
        .attr('x2', px)
        .attr('y2', py);
    };
    line('neighbour-line', e ? e.neighbours : []);
    line('chosen-line', e ? [e.xz] : []);
    const ring = (cls: string, at: { tenure: number; charge: number }[], rad: number): void => {
      g.selectAll<SVGCircleElement, { tenure: number; charge: number }>(`circle.${cls}`)
        .data(e ? at : [])
        .join('circle')
        .attr('class', cls)
        .attr('r', r1(rad))
        .attr('cx', px)
        .attr('cy', py);
    };
    const half = tick * 0.32;
    ring('x-i', e ? [e.xi] : [], half);
    ring('x-zi', e ? [e.xz] : [], half);
    ring('x-new', e ? [e.xnew] : [], tick * 0.24);
    this.drawLabels(e, px, py, half, tick, rect);
  }

  /** The names x_i, x_zi and x_new beside their marks, placed so no label covers a mark or another label. */
  private drawLabels(
    e: ImbView['example'],
    px: (p: { tenure: number }) => number,
    py: (p: { charge: number }) => number,
    half: number,
    tick: number,
    rect: Rect,
  ): void {
    const marks = e
      ? [
          { name: 'x_i', at: e.xi },
          { name: 'x_zi', at: e.xz },
          { name: 'x_new', at: e.xnew },
        ]
      : [];
    // the chosen segment x_i - x_zi is an obstacle too: small boxes along it
    const segment: LabelBox[] = [];
    if (e) {
      for (let t = 0; t <= 12; t++) {
        const x = px(e.xi) + ((px(e.xz) - px(e.xi)) * t) / 12;
        const y = py(e.xi) + ((py(e.xz) - py(e.xi)) * t) / 12;
        segment.push({ l: x - 2, t: y - 2, r: x + 2, b: y + 2 });
      }
    }
    const taken: LabelBox[] = segment.concat(marks.map((m) => ({ l: px(m.at) - half, t: py(m.at) - half, r: px(m.at) + half, b: py(m.at) + half })));
    const placed = marks.map((m) => {
      const x = px(m.at);
      const y = py(m.at);
      const o = chooseOffset({ x, y, chars: m.name.length, cands: offsets(half, 3, tick), fs: tick, taken, area: labelArea(rect) });
      return { name: m.name, x: r1(x + o.dx), y: r1(y + o.dy), anchor: o.anchor };
    });
    this.exampleG
      .selectAll<SVGTextElement, (typeof placed)[number]>('text.x-label')
      .data(placed, (d) => d.name)
      .join('text')
      .attr('class', (d) => `x-label is-${d.name.replace('_', '')}`)
      .attr('data-chars', (d) => d.name.length)
      .attr('text-anchor', (d) => d.anchor)
      .attr('x', (d) => d.x)
      .attr('y', (d) => d.y)
      .text((d) => d.name);
  }
}
