import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import type { Mode } from '../../core/mode';
import { AxesLayer } from '../../core/plot/axes';
import { labelArea, labelBox, offsets, overlap, chooseOffset, type Box as LabelBox } from '../../core/plot/label-place';
import { r1 } from '../../core/plot/marks';
import { TextMeasure } from '../../core/plot/text-measure';
import { tr } from '../../core/plot/transition';
import { fitViewport, type Rect } from '../../core/plot/viewport';
import { COUNTS, MINORITY, X_DOMAIN, Y_DOMAIN } from './model';
import { NARROW, ScatterScene, type Box } from './scene-scatter';
import type { ImbDot, ImbView } from './view';

const NS = 'http://www.w3.org/2000/svg';
type G = Selection<SVGGElement, unknown, null, undefined>;

/** What the scene host drives: every view area's scene has this shape. */
export interface ViewScene {
  resize(w: number, h: number, mode: Mode): void;
  interrupt(): void;
  update(v: ImbView, ms: number): void;
  destroy(): void;
}

/** Outer padding (px) of a panel and gap (px) between the two panels. */
const PAD = 8;
const GAP = 14;

/** A point shows the copy badge from this many extra copies on. */
export const BADGE_MIN = 10;

/** The two panels' rectangles and the height the drawing needs. */
export interface PanelsLayout {
  panels: [Box, Box];
  height: number;
  narrow: boolean;
}

/** Two panels side by side, or (under NARROW px) one under the other. */
export function panelsLayout(w: number, h: number): PanelsLayout {
  if (w >= NARROW) {
    const pw = Math.floor((w - GAP) / 2);
    return {
      panels: [
        { x: 0, y: 0, w: pw, h },
        { x: w - pw, y: 0, w: pw, h },
      ],
      height: h,
      narrow: false,
    };
  }
  const ph = Math.max(260, Math.min(Math.round(w * 0.95), 420));
  return {
    panels: [
      { x: 0, y: 0, w, h: ph },
      { x: 0, y: ph + GAP, w, h: ph },
    ],
    height: Math.max(h, 2 * ph + GAP),
    narrow: true,
  };
}

/** One small panel: its title lines, axes, dots and (copy panel) badges. */
class Panel {
  readonly g: G;
  private readonly title: Selection<SVGTextElement, unknown, null, undefined>;
  private readonly sub: Selection<SVGTextElement, unknown, null, undefined>;
  private readonly axes: AxesLayer;
  private readonly dotsG: G;
  private readonly badgeG: G;

  constructor(parent: G, readonly name: 'kopya' | 'smote') {
    this.g = parent.append('g').attr('class', 'imb-panel').attr('data-panel', name);
    this.title = this.g.append('text').attr('class', 'panel-title axis-title');
    this.sub = this.g.append('text').attr('class', 'panel-sub');
    this.axes = new AxesLayer(this.g.append('g').attr('class', 'imb-axes'));
    this.dotsG = this.g.append('g').attr('class', 'imb-dots');
    this.badgeG = this.g.append('g').attr('class', 'imb-badges');
  }

  draw(
    box: Box,
    v: ImbView,
    o: { tick: number; axis: number; ms: number; measure: TextMeasure; titleText: string; subText: string },
  ): void {
    const { tick, axis, ms, measure } = o;
    this.title
      .attr('x', r1(box.x + PAD))
      .attr('y', r1(box.y + PAD + axis))
      .text(o.titleText);
    this.sub
      .attr('x', r1(box.x + PAD))
      .attr('y', r1(box.y + PAD + axis * 1.2 + tick * 1.25))
      .text(o.subText);
    const headH = PAD + axis * 1.2 + tick * 1.6;
    const gap = Math.round(tick * 0.45);
    const yTickW = measure.maxWidth(['120'], 'tick', tick);
    const left = box.x + PAD + axis * 1.2 + gap + yTickW + gap;
    const right = box.x + box.w - PAD - tick * 0.6;
    const top = box.y + headH;
    const bottom = box.y + box.h - (gap + tick * 1.2 + gap + axis * 1.25 + PAD);
    const rect: Rect = { left, top, width: Math.max(60, right - left), height: Math.max(60, bottom - top) };
    const sc = fitViewport({ x: X_DOMAIN, y: Y_DOMAIN }, rect, false);
    this.axes.draw(
      sc,
      rect,
      {
        xTickCount: 4,
        yTickCount: 3,
        xTicks: [0, 24, 48, 72],
        yTicks: [20, 60, 100],
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
      `imb-${this.name}`,
    );
    const dots = this.name === 'kopya' ? v.dots.filter((d) => !d.synthetic) : v.dots;
    const base = Math.max(1.8, tick * 0.11);
    this.dotsG
      .selectAll<SVGCircleElement, ImbDot>('circle.pt')
      .data(dots, (d) => d.id)
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
      .attr('class', (d) => `pt ${d.cls === 1 ? 'pos' : 'neg'}${d.synthetic ? ' synthetic' : ''}`)
      .attr('r', (d) => r1(d.cls === 1 ? base * 1.5 : base))
      .attr('cx', (d) => r1(sc.x(d.tenure)))
      .attr('cy', (d) => r1(sc.y(d.charge)));
    this.drawBadges(this.name === 'kopya' ? v.copies : null, sc, rect, tick, base * 1.5);
  }

  /**
   * Copy badges "xN" (N = the point's total count) on points with at least BADGE_MIN extra copies,
   * most copied first. A badge needs a free spot (not on a churner mark or another badge); the most
   * copied point always gets one.
   */
  private drawBadges(copies: number[] | null, sc: ReturnType<typeof fitViewport>, rect: Rect, tick: number, mark: number): void {
    const items: { index: number; text: string; x: number; y: number; anchor: string; box: LabelBox }[] = [];
    if (copies) {
      const area = labelArea(rect, 0);
      const px = (i: number): number => sc.x(MINORITY[i].tenure);
      const py = (i: number): number => sc.y(MINORITY[i].charge);
      const taken: LabelBox[] = MINORITY.map((_, i) => ({
        l: px(i) - mark - 1,
        t: py(i) - mark - 1,
        r: px(i) + mark + 1,
        b: py(i) + mark + 1,
      }));
      const order = copies.map((c, i) => i).sort((a, b) => copies[b] - copies[a] || a - b);
      order.forEach((i, rank) => {
        if (copies[i] < BADGE_MIN && rank > 0) {
          return;
        }
        const text = `×${copies[i] + 1}`;
        const cands = offsets(mark, 3, tick);
        const x = px(i);
        const y = py(i);
        const free = cands.find((c) => {
          const box = labelBox(x + c.dx, y + c.dy, text.length, c.anchor, tick);
          const inside = box.l >= area.l && box.r <= area.r && box.t >= area.t && box.b <= area.b;
          return inside && taken.every((t) => overlap(box, t) === 0);
        });
        let chosen = free;
        if (!chosen && rank === 0) {
          chosen = chooseOffset({ x, y, chars: text.length, cands, fs: tick, taken: [...taken], area });
        }
        if (!chosen) {
          return;
        }
        const box = labelBox(x + chosen.dx, y + chosen.dy, text.length, chosen.anchor, tick);
        taken.push(box);
        items.push({ index: i, text, x: x + chosen.dx, y: y + chosen.dy, anchor: chosen.anchor, box });
      });
    }
    const sel = this.badgeG
      .selectAll<SVGGElement, (typeof items)[number]>('g.copy-badge')
      .data(items, (d) => String(d.index))
      .join((enter) => {
        const g = enter.append('g');
        g.append('rect').attr('rx', 3);
        g.append('text');
        return g;
      })
      .attr('class', 'copy-badge')
      .attr('data-index', (d) => d.index);
    sel
      .select('rect')
      .attr('x', (d) => r1(d.box.l))
      .attr('y', (d) => r1(d.box.t))
      .attr('width', (d) => r1(d.box.r - d.box.l))
      .attr('height', (d) => r1(d.box.b - d.box.t));
    sel
      .select('text')
      .attr('x', (d) => r1(d.x))
      .attr('y', (d) => r1(d.y))
      .attr('text-anchor', (d) => d.anchor)
      .text((d) => d.text);
  }

  interrupt(): void {
    this.g.selectAll('*').interrupt('axes').interrupt('dots');
  }
}

/** Step 7: the random-copy panel and the SMOTE panel side by side (or stacked on a narrow screen). */
export class PanelsScene implements ViewScene {
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly measure: TextMeasure;
  private readonly panels: [Panel, Panel];
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const root = host.ownerDocument.createElementNS(NS, 'svg');
    host.append(root);
    this.svg = select(root)
      .attr('class', 'imb-plot imb-panels')
      .attr('role', 'img')
      .attr('aria-label', 'Rastgele kopyalama ve SMOTE, aynı eğitim kümesi için iki küçük saçılım');
    const probe = this.svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
    this.panels = [new Panel(this.svg.append('g'), 'kopya'), new Panel(this.svg.append('g'), 'smote')];
  }

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
    this.panels.forEach((p) => p.interrupt());
    this.svg.selectAll('.copy-badge').interrupt();
  }

  destroy(): void {
    this.interrupt();
    this.svg.remove();
  }

  update(v: ImbView, ms: number): void {
    this.interrupt();
    const { tick, axis } = this.measure.fonts(this.mode);
    const lay = panelsLayout(this.w, this.h);
    this.svg.attr('width', this.w).attr('height', lay.height);
    const added = v.counts.pos - COUNTS.train.pos;
    const texts: [string, string][] = [
      ['rastgele kopyalama', `${COUNTS.train.pos} özgün + ${added} kopya`],
      ['SMOTE', `${COUNTS.train.pos} özgün + ${added} sentetik`],
    ];
    this.panels.forEach((p, i) => {
      p.draw(lay.panels[i], v, { tick, axis, ms, measure: this.measure, titleText: texts[i][0], subText: texts[i][1] });
    });
  }
}

/**
 * The SMOTE view area: step 6 is the scatter with the side panel (the sweep fills the minority in),
 * step 7 the two small panels.
 */
export class SmoteScene implements ViewScene {
  private readonly single: ScatterScene;
  private readonly panels: PanelsScene;

  constructor(host: HTMLElement) {
    this.single = new ScatterScene(host);
    this.panels = new PanelsScene(host);
  }

  resize(w: number, h: number, mode: Mode): void {
    this.single.resize(w, h, mode);
    this.panels.resize(w, h, mode);
  }

  interrupt(): void {
    this.single.interrupt();
    this.panels.interrupt();
  }

  update(v: ImbView, ms: number): void {
    const two = v.copies !== null;
    this.single.setShown(!two);
    this.panels.setShown(two);
    if (two) {
      this.panels.update(v, ms);
    } else {
      this.single.update(v, ms);
    }
  }

  destroy(): void {
    this.single.destroy();
    this.panels.destroy();
  }
}
