import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import type { Mode } from '../../core/mode';
import { AxesLayer } from '../../core/plot/axes';
import { circlesPath } from '../../core/plot/dots-path';
import { r1 } from '../../core/plot/marks';
import { TextMeasure } from '../../core/plot/text-measure';
import { tr, type AnySel } from '../../core/plot/transition';
import { fitViewport, type Domain, type Rect, type Scales } from '../../core/plot/viewport';
import { LEVERAGE } from './anscombe';
import type { PanelView } from './view';

/** Base duration of a step's moves, before `durationScale`. */
export const MS_STEP = 450;
const TN = 'kor-panels';
/** The draggable range of set IV's leverage point, the same as the range input's. */
const LEV_MIN = 6;
const LEV_MAX = 20;
const LEV_STEP = 0.5;
/** The quartet's shared axes, so the four patterns are the only thing that differs. */
const QUARTET: Domain = { x: [2, 20], y: [2, 14] };
/** Step 6 keeps room for the dragged point all the way up to y = 20. */
const LEVERAGE_DOMAIN: Domain = { x: [2, 20], y: [2, 21] };
/** One colour per Anscombe panel (the spec asks colour + panel number). */
const PANEL_COLORS = ['#0ea5a4', '#7c3aed', '#f08a00', '#14365c'];
const ANSCOMBE_IDS: readonly string[] = ['I', 'II', 'III', 'IV'];
/** Step 3's two claim cards: the observed relation against the missing proof. */
const CLAIMS: readonly { title: string; body: string }[] = [
  { title: 'gözlem', body: 'ilişki var: r = −0,993' },
  { title: 'kanıt', body: 'neden yok: üçüncü değişken · ters nedensellik · rastlantı' },
];
/** Step 9's two boxes: no numbers are invented, only the two EDA extents. */
const CARDS: readonly { title: string; body: string }[] = [
  { title: 'tüm veri üzerinde EDA', body: 'Test kümesinin dağılımı da görülür; keşif, modelin göreceği satırları ele verir.' },
  { title: 'yalnız eğitim kümesinde EDA', body: 'Keşif eğitimde yapılır; doğrulama ayrı kümede kalır ve temiz kalır.' },
];
/** Step 10's three in-scene links. */
const LINKS: readonly { href: string; label: string }[] = [
  { href: '../kutu-grafigi/', label: 'kutu grafiği · aykırı gözlem' },
  { href: '../iqr-aykiri/', label: 'IQR · aykırı karar' },
  { href: '../pca/', label: 'PCA · ilişkili sütunlar' },
];
const RULE = 'Özet istatistik yeterli değildir, grafik şart.';

type G = Selection<SVGGElement, unknown, null, undefined>;
type El<T extends Element> = Selection<T, unknown, null, undefined>;

export interface LeverageState {
  /** Data coordinates of the draggable point: x = 19, y = the live `noktaY`. */
  x: number;
  y: number;
  /** The Lab-only drop: scene-local, never a `KorelParams` key. */
  lab: boolean;
  dropped: boolean;
}

/** Everything the panel layer draws: a step's panels, or the cards / rule of steps 9–10. */
export interface PanelsState {
  stepId: string;
  /** The chosen Anscombe set: set IV has the leverage point, I–III keep the quartet's own domain. */
  set: number;
  panels: readonly PanelView[];
  leverage: LeverageState | null;
}

interface PanelDrawn {
  id: string;
  g: G;
  clip: El<SVGRectElement>;
  axes: AxesLayer;
  marks: G;
  pts: El<SVGPathElement>;
  /** Created only for a panel with a trend, removed when the view has none. */
  trend: El<SVGPathElement> | null;
  title: El<SVGTextElement>;
  stats: El<SVGTextElement>;
  /** The last scales, so the leverage point can sit on the same mapping. */
  sc: Scales;
  plot: Rect;
  dotR: number;
  tick: number;
}

interface CardD { title: string; body: string; x: number; y: number; w: number; h: number; pad: number; lines: string[] }
interface LinkD { href: string; label: string; x: number; y: number }
interface Inv { d0: number; d1: number; r0: number; r1: number }

const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));

/** The axis nouns of the 004 scatters; the quartet's axes stay the shared x / y. */
function axesOf(stepId: string): { x: string; y: string } {
  if (stepId === 'iki-degisken' || stepId === 'korelasyon') return { x: 'çalışma (saat)', y: 'not' };
  if (stepId === 'nedensellik') return { x: 'not', y: 'devamsızlık' };
  return { x: 'x', y: 'y' };
}

/** The quartet shares one domain; 004 computes its own from the step's points. */
function domainOf(stepId: string, set: number, pts: readonly { x: number; y: number }[]): Domain {
  if (stepId === 'anscombe' || stepId === 'dogrusal-degil') return QUARTET;
  // only set IV's leverage point at x = 19 and y up to 20 needs the wide axis
  if (stepId === 'kaldirac') return set === 4 ? LEVERAGE_DOMAIN : QUARTET;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  return { x: [x0, x1 || x0 + 1], y: [y0, y1 || y0 + 1] };
}

/**
 * The non-heat content of the `korelasyon-isi-haritasi` page: the 1 / 2 / 4
 * scatter panels of a step, set IV's draggable leverage point, the two leak
 * boxes of step 9 and the rule with its three links on step 10. The panels of
 * the quartet share one axes pair; 004's scatters compute their own domain from
 * the drawn points. Every node keeps its key, so a step that moves a point moves
 * the same node. The drop of the leverage point is scene-local: double-clicking
 * it in Lab hides the point and the scene writes "r tanımsız" without touching
 * `KorelParams`.
 */
export class PanelsLayer {
  private readonly svgEl: SVGSVGElement;
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly root: G;
  private readonly gGrid: G;
  private readonly gClaims: G;
  private readonly gCards: G;
  private readonly gRule: G;
  private readonly gLev: G;
  private readonly lever: El<SVGCircleElement>;
  private readonly hint: El<SVGTextElement>;
  private readonly dropNote: El<SVGTextElement>;
  private readonly ruleText: El<SVGTextElement>;
  private readonly measure: TextMeasure;
  private readonly panels = new Map<string, PanelDrawn>();
  private inv: Inv | null = null;
  private levY = 12.5;
  private dragOn = false;
  private lab = false;
  private dragging = false;
  private lastDrag: number | null = null;
  private onLeverageCb: ((y: number) => void) | null = null;
  private onDropCb: (() => void) | null = null;
  private static count = 0;
  private readonly uid = ++PanelsLayer.count;

  constructor(svgEl: SVGSVGElement) {
    this.svgEl = svgEl;
    this.svg = select(svgEl);
    this.root = this.svg.append('g').attr('class', 'kor-panels');
    this.gGrid = this.root.append('g').attr('class', 'panel-grid');
    this.gClaims = this.root.append('g').attr('class', 'claim-cards');
    this.gCards = this.root.append('g').attr('class', 'eda-cards');
    this.gRule = this.root.append('g').attr('class', 'rule-card');
    this.gLev = this.root.append('g').attr('class', 'leverage-layer');
    this.ruleText = this.gRule.append('text').attr('class', 'kor-rule').attr('text-anchor', 'middle');
    const probe = this.root.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);

    this.lever = this.gLev.append('circle')
      .attr('class', 'leverage')
      .attr('role', 'slider')
      .attr('aria-orientation', 'vertical')
      .attr('aria-label', 'kaldıraç noktası')
      .attr('aria-valuemin', LEV_MIN)
      .attr('aria-valuemax', LEV_MAX)
      .attr('tabindex', '0')
      .on('pointerdown', (ev: PointerEvent) => this.down(ev))
      .on('pointermove', (ev: PointerEvent) => this.move(ev))
      .on('pointerup', (ev: PointerEvent) => this.up(ev))
      .on('pointercancel', (ev: PointerEvent) => this.up(ev))
      .on('keydown', (ev: KeyboardEvent) => this.key(ev));
    // the whole plot takes the Lab double-click, so a dropped point can come
    // back even though its own circle is hidden
    this.svg.on('dblclick', () => { if (this.lab) this.onDropCb?.(); });
    this.hint = this.gLev.append('text').attr('class', 'leverage-hint').attr('text-anchor', 'end');
    this.dropNote = this.gLev.append('text').attr('class', 'drop-note').attr('text-anchor', 'end');
  }

  /** Registers the drag sink: the scene writes `player.setParam('noktaY', y)`. */
  onLeverage(cb: (y: number) => void): void {
    this.onLeverageCb = cb;
  }

  /** Registers the Lab-only drop: the scene keeps the `dropped` flag and the strip. */
  onDrop(cb: () => void): void {
    this.onDropCb = cb;
  }

  update(w: number, h: number, mode: Mode, state: PanelsState | null, ms: number): void {
    this.cancel();
    if (!state) {
      this.clear();
      return;
    }
    this.root.style('display', '');
    if (state.panels.length > 0) this.drawPanels(w, h, mode, state, ms);
    else this.removePanels();
    if (state.stepId === 'nedensellik') this.drawClaims(w, h, mode, ms);
    else this.gClaims.selectAll('g.claim').remove();
    if (state.stepId === 'sizinti') this.drawCards(w, h, mode, ms);
    else this.gCards.selectAll('g.eda-box').remove();
    if (state.stepId === 'kural') this.drawRule(w, h, mode);
    else {
      this.gRule.selectAll('a.kor-link').remove();
      this.ruleText.text('');
    }
    this.drawLeverage(state);
  }

  /** Cancels running transitions so the next draw starts from the settled state. */
  interrupt(): void {
    this.cancel();
  }

  destroy(): void {
    this.cancel();
    this.onLeverageCb = null;
    this.onDropCb = null;
    this.panels.clear();
    this.root.remove();
  }

  private cancel(): void {
    this.root.selectAll('*').interrupt(TN);
    this.root.selectAll('*').interrupt('axes');
  }

  private clear(): void {
    this.root.style('display', 'none');
    this.removePanels();
    this.gClaims.selectAll('g.claim').remove();
    this.gCards.selectAll('g.eda-box').remove();
    this.gRule.selectAll('a.kor-link').remove();
    this.ruleText.text('');
    this.inv = null;
    this.svg.attr('data-drag', null);
  }

  // ------------------------------------------------------------- panels
  private ensurePanel(id: string): PanelDrawn {
    const existing = this.panels.get(id);
    if (existing) return existing;
    const g = this.gGrid.append('g').attr('class', 'panel').attr('data-set', id);
    const clipId = `kor-clip-${this.uid}-${this.panels.size}`;
    const clip = g.append('defs').append('clipPath').attr('id', clipId).append('rect');
    const axes = new AxesLayer(g.append('g').attr('class', 'axes'));
    const marks = g.append('g').attr('class', 'marks').attr('clip-path', `url(#${clipId})`);
    const pts = marks.append('path').attr('class', 'pts');
    const title = g.append('text').attr('class', 'panel-title');
    const stats = g.append('text').attr('class', 'panel-stats').attr('text-anchor', 'middle');
    const empty = fitViewport({ x: [0, 1], y: [0, 1] }, { left: 0, top: 0, width: 1, height: 1 }, false);
    const drawn: PanelDrawn = {
      id, g, clip, axes, marks, pts, trend: null, title, stats,
      sc: empty, plot: { left: 0, top: 0, width: 1, height: 1 }, dotR: 4, tick: 18,
    };
    this.panels.set(id, drawn);
    return drawn;
  }

  private removePanels(): void {
    for (const p of this.panels.values()) p.g.remove();
    this.panels.clear();
  }

  private drawPanels(w: number, h: number, mode: Mode, state: PanelsState, ms: number): void {
    const f = this.measure.fonts(mode);
    const tick = f.tick;
    const axis = f.axis;
    const count = state.panels.length;
    const cols = count >= 3 ? 2 : count;
    const rows = Math.ceil(count / cols);
    const margin = Math.max(10, Math.round(tick * 0.5));
    const gapX = Math.round(tick * 1.2);
    const gapY = Math.round(axis * 1.6);
    const cellW = (w - 2 * margin - gapX * (cols - 1)) / cols;
    // step 3 reserves a bottom band for its two claim cards
    const claimBand = state.stepId === 'nedensellik' ? this.claimBand(w, mode) : 0;
    const cellH = (h - claimBand - 2 * margin - gapY * (rows - 1)) / rows;
    const titleH = Math.round(axis * 1.5);
    const statsH = Math.round(axis * 1.8);
    const yTickW = this.measure.width('−12,5', 'tick', tick);
    const yTitleW = Math.round(axis * 1.35);
    const xTickH = Math.round(tick * 1.1 + axis * 1.35);
    const titles = axesOf(state.stepId);
    const dotR = Math.max(3, Math.round(tick * 0.24));

    state.panels.forEach((panel, i) => {
      const p = this.ensurePanel(panel.id);
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cellLeft = margin + col * (cellW + gapX);
      const cellTop = margin + row * (cellH + gapY);
      const plot: Rect = {
        left: cellLeft + yTickW + gapX * 0.6 + yTitleW,
        top: cellTop + titleH,
        width: Math.max(40, cellW - (yTickW + gapX * 0.6 + yTitleW) - gapX * 0.4),
        height: Math.max(40, cellH - titleH - xTickH - statsH),
      };
      const dropped = state.leverage?.dropped === true && panel.id === 'IV';
      const pts = dropped ? panel.points.filter((_, k) => k !== LEVERAGE.index) : panel.points;
      const dom = domainOf(state.stepId, state.set, panel.points);
      const sc = fitViewport(dom, plot, false);
      p.sc = sc;
      p.plot = plot;
      p.dotR = dotR;
      p.tick = tick;
      p.g.attr('display', null);

      p.clip
        .attr('x', r1(plot.left)).attr('y', r1(plot.top))
        .attr('width', r1(plot.width)).attr('height', r1(plot.height));

      const gap = Math.max(4, Math.round(tick * 0.35));
      const xTickY = plot.top + plot.height + gap + tick * 0.9;
      p.axes.draw(sc, plot, {
        xTickCount: Math.max(2, Math.round(plot.width / (tick * 7))),
        yTickCount: Math.max(2, Math.round(plot.height / (tick * 3.4))),
        xTickY,
        yTickX: plot.left - gap,
        xTitle: {
          x: plot.left + plot.width / 2,
          y: xTickY + tick * 0.3 + gap + axis * 0.95,
          text: titles.x,
        },
        yTitle: {
          x: Math.max(axis * 0.6, plot.left - gap - yTickW - axis * 0.3),
          y: plot.top + plot.height / 2,
          lines: [titles.y],
        },
      }, ms, `${state.stepId}:${panel.id}`);

      // the colour belongs to the set, not to the slot: set IV is navy alone or in the quartet; 004 panels keep the first
      const color = PANEL_COLORS[Math.max(0, ANSCOMBE_IDS.indexOf(panel.id))];
      p.pts.style('fill', color).style('stroke', '#ffffff').style('stroke-width', 1.2);
      const dPts = circlesPath(pts.map((pt) => sc.x(pt.x)), pts.map((pt) => sc.y(pt.y)), dotR);
      if (ms > 0) tr(p.pts as AnySel, TN, ms).attr('d', dPts);
      else p.pts.attr('d', dPts);

      // step 1 has no trend: the node exists only while the view carries one
      const trend = dropped ? null : panel.trend;
      if (trend) {
        if (!p.trend) p.trend = p.marks.append('path').attr('class', 'trend');
        p.trend.style('stroke', color);
        const [x0, x1] = dom.x;
        const dTrend = `M${r1(sc.x(x0))},${r1(sc.y(trend.m * x0 + trend.b))}`
          + `L${r1(sc.x(x1))},${r1(sc.y(trend.m * x1 + trend.b))}`;
        if (ms > 0) tr(p.trend as AnySel, TN, ms).attr('d', dTrend).attr('opacity', 1);
        else p.trend.attr('d', dTrend).attr('opacity', 1);
      } else {
        p.trend?.remove();
        p.trend = null;
      }

      p.title
        .attr('x', r1(plot.left))
        .attr('y', r1(cellTop + axis * 0.95))
        .style('fill', color)
        .text(panel.id.length <= 4 ? panel.id : '');
      p.stats
        .attr('x', r1(plot.left + plot.width / 2))
        .attr('y', r1(Math.min(cellTop + cellH - axis * 0.4, plot.top + plot.height + tick * 3)))
        .text(panel.stats);
    });

    const keep = new Set(state.panels.map((p) => p.id));
    for (const [id, p] of this.panels) {
      if (!keep.has(id)) { p.g.remove(); this.panels.delete(id); }
    }
  }

  // ------------------------------------------------------------- leverage
  private drawLeverage(state: PanelsState): void {
    const lev = state.leverage;
    const p = this.panels.get('IV');
    if (!lev || !p) {
      this.inv = null;
      // a handle that is gone must ignore keyboard and pointer even if focus lingers
      this.dragOn = false;
      this.dragging = false;
      this.lever.attr('display', 'none').attr('tabindex', null);
      this.hint.text('');
      this.dropNote.text('');
      this.svg.attr('data-drag', null);
      return;
    }
    this.lab = lev.lab;
    this.dragOn = !lev.dropped;
    this.levY = lev.y;
    this.inv = {
      d0: LEVERAGE_DOMAIN.y[0],
      d1: LEVERAGE_DOMAIN.y[1],
      r0: p.plot.top + p.plot.height,
      r1: p.plot.top,
    };
    const px = p.sc.x(lev.x);
    const py = p.sc.y(lev.y);
    const r = p.dotR + Math.max(5, Math.round(p.tick * 0.3));
    this.lever
      .attr('display', lev.dropped ? 'none' : null)
      .attr('cx', r1(px))
      .attr('cy', r1(py))
      .attr('r', r1(r))
      .attr('aria-valuenow', lev.y)
      .attr('tabindex', lev.dropped ? null : '0');
    this.svg.attr('data-drag', lev.dropped ? null : String(lev.y));

    const right = p.plot.left + p.plot.width;
    const bottom = p.plot.top + p.plot.height;
    this.dropNote
      .attr('x', r1(right))
      .attr('y', r1(p.plot.top + p.tick * 1.1))
      .text(lev.dropped ? 'nokta çıkarıldı · r tanımsız (x sabit)' : '');
    this.hint
      .attr('x', r1(right))
      .attr('y', r1(bottom - p.tick * 0.5))
      .text(this.hintText(lev));
  }

  private hintText(lev: LeverageState): string {
    if (!lev.lab) return 'sürükle: r canlı değişir';
    return lev.dropped
      ? 'çift tıkla: nokta geri gelir'
      : 'noktayı sürükle · çift tıkla: nokta düşer, r tanımsız';
  }

  // ------------------------------------------------------------- step 3 claims
  /** Height of the claim band: title plus the wrapped body lines. */
  private claimBand(w: number, mode: Mode): number {
    const f = this.measure.fonts(mode);
    const tick = f.tick;
    const axis = f.axis;
    const margin = Math.max(12, Math.round(tick * 0.8));
    const gap = Math.round(tick * 1.2);
    const cardW = (w - 2 * margin - gap) / 2;
    const pad = Math.max(8, Math.round(tick * 0.7));
    const lines = Math.max(1, ...CLAIMS.map((c) => this.measure.wrap(c.body, cardW - 2 * pad, 'eda-body', tick).length));
    return Math.round(pad * 2 + axis * 1.7 + lines * tick * 1.35);
  }

  /** Step 3's two cards: the observed relation and the proof that is missing. */
  private drawClaims(w: number, h: number, mode: Mode, ms: number): void {
    const f = this.measure.fonts(mode);
    const tick = f.tick;
    const axis = f.axis;
    const margin = Math.max(12, Math.round(tick * 0.8));
    const gap = Math.round(tick * 1.2);
    const cardW = (w - 2 * margin - gap) / 2;
    const band = this.claimBand(w, mode);
    const top = h - band;
    const pad = Math.max(8, Math.round(tick * 0.7));
    const cards: CardD[] = CLAIMS.map((c, i) => ({
      ...c,
      x: margin + i * (cardW + gap),
      y: top,
      w: cardW,
      h: band,
      pad,
      lines: this.measure.wrap(c.body, cardW - 2 * pad, 'eda-body', tick),
    }));
    const sel = this.gClaims.selectAll<SVGGElement, CardD>('g.claim').data(cards, (d) => d.title);
    sel.exit().remove();
    const enter = sel.enter().append('g').attr('class', 'claim').attr('opacity', 0);
    enter.append('rect').attr('class', 'claim-bg').attr('rx', 10);
    enter.append('text').attr('class', 'claim-title');
    enter.append('text').attr('class', 'claim-body');
    const upd = enter.merge(sel);
    upd.select('rect.claim-bg')
      .attr('x', (d) => r1(d.x)).attr('y', (d) => r1(d.y))
      .attr('width', (d) => r1(d.w)).attr('height', (d) => r1(d.h));
    upd.select('text.claim-title')
      .attr('x', (d) => r1(d.x + d.pad))
      .attr('y', (d) => r1(d.y + d.pad + axis))
      .text((d) => d.title);
    upd.select<SVGTextElement>('text.claim-body')
      .attr('x', (d) => r1(d.x + d.pad))
      .attr('y', (d) => r1(d.y + d.pad + axis * 2.3))
      .each(function (this: SVGTextElement, d: CardD) {
        select(this).selectAll<SVGTSpanElement, string>('tspan').data(d.lines).join('tspan')
          .attr('x', r1(d.x + d.pad))
          .attr('dy', (_, i) => (i === 0 ? 0 : r1(tick * 1.35)))
          .text((line) => line);
      });
    if (ms > 0) tr(upd as AnySel, TN, ms).attr('opacity', 1);
    else upd.attr('opacity', 1);
  }

  // ------------------------------------------------------------- step 9 cards
  private drawCards(w: number, h: number, mode: Mode, ms: number): void {
    const f = this.measure.fonts(mode);
    const tick = f.tick;
    const axis = f.axis;
    const margin = Math.max(12, Math.round(tick * 0.8));
    const gap = Math.round(tick * 1.2);
    const cardW = (w - 2 * margin - gap) / 2;
    const cardH = Math.min(Math.round(h * 0.56), Math.round(cardW * 0.62));
    const top = Math.max(margin, (h - cardH) / 2);
    const pad = Math.round(tick * 0.9);
    const cards: CardD[] = CARDS.map((c, i) => ({
      title: c.title,
      body: c.body,
      x: margin + i * (cardW + gap),
      y: top,
      w: cardW,
      h: cardH,
      pad,
      lines: this.measure.wrap(c.body, cardW - 2 * pad, 'eda-body', tick),
    }));
    const sel = this.gCards.selectAll<SVGGElement, CardD>('g.eda-box').data(cards, (d) => d.title);
    sel.exit().remove();
    const enter = sel.enter().append('g').attr('class', 'eda-box').attr('opacity', 0);
    enter.append('rect').attr('class', 'eda-card-bg').attr('rx', 10);
    enter.append('text').attr('class', 'eda-title');
    enter.append('text').attr('class', 'eda-body');
    const upd = enter.merge(sel);
    upd.select('rect.eda-card-bg')
      .attr('x', (d) => r1(d.x)).attr('y', (d) => r1(d.y))
      .attr('width', (d) => r1(d.w)).attr('height', (d) => r1(d.h));
    upd.select('text.eda-title')
      .attr('x', (d) => r1(d.x + d.pad)).attr('y', (d) => r1(d.y + d.pad + axis * 2.6))
      .text((d) => d.title);
    upd.select<SVGTextElement>('text.eda-body')
      .attr('x', (d) => r1(d.x + d.pad)).attr('y', (d) => r1(d.y + d.pad + axis * 4.6))
      .each(function (this: SVGTextElement, d: CardD) {
        select(this).selectAll<SVGTSpanElement, string>('tspan').data(d.lines).join('tspan')
          .attr('x', r1(d.x + d.pad))
          .attr('dy', (_, i) => (i === 0 ? 0 : r1(tick * 1.35)))
          .text((line) => line);
      });
    if (ms > 0) tr(upd as AnySel, TN, ms).attr('opacity', 1);
    else upd.attr('opacity', 1);
  }

  // ------------------------------------------------------------- step 10 rule
  private drawRule(w: number, h: number, mode: Mode): void {
    const f = this.measure.fonts(mode);
    const axis = f.axis;
    const tick = f.tick;
    const cx = w / 2;
    const y = Math.max(axis * 2.4, h * 0.36);
    this.ruleText.attr('x', r1(cx)).attr('y', r1(y)).text(RULE);

    const gap = Math.round(tick * 1.8);
    const widths = LINKS.map((l) => this.measure.width(l.label, 'kor-link', axis));
    const total = widths.reduce((a, b) => a + b, 0) + gap * (LINKS.length - 1);
    let x = Math.max(0, (w - total) / 2);
    const links: LinkD[] = LINKS.map((l, i) => {
      const mid = x + widths[i] / 2;
      x += widths[i] + gap;
      return { ...l, x: mid, y: y + axis * 2.4 };
    });
    const sel = this.gRule.selectAll<SVGAElement, LinkD>('a.kor-link')
      .data(links, (d) => d.href)
      .join(
        (enter) => {
          const a = enter.append('a').attr('class', 'kor-link');
          a.append('text').attr('class', 'kor-link-text').attr('text-anchor', 'middle');
          return a;
        },
        (update) => update,
        (exit) => exit.remove(),
      );
    sel.attr('href', (d) => d.href);
    sel.select<SVGTextElement>('text.kor-link-text')
      .attr('x', (d) => r1(d.x))
      .attr('y', (d) => r1(d.y))
      .text((d) => d.label);
  }

  // ------------------------------------------------------------- pointer drag
  private down(ev: PointerEvent): void {
    if (ev.button > 0 || !this.dragOn) return;
    this.dragging = true;
    this.lastDrag = null;
    try { (ev.target as Element).setPointerCapture?.(ev.pointerId); } catch { /* synthetic or stale pointer */ }
  }

  /** Pointer y → set IV's y through the panel's own scale, snapped to 0,5 and clamped to 6–20. */
  private move(ev: PointerEvent): void {
    if (!this.dragging || !this.inv || !this.dragOn) return;
    const box = this.svgEl.getBoundingClientRect();
    const py = ev.clientY - box.top;
    const { d0, d1, r0, r1: r1px } = this.inv;
    const raw = d0 + ((py - r0) / (r1px - r0)) * (d1 - d0);
    const y = clamp(Math.round(raw / LEV_STEP) * LEV_STEP, LEV_MIN, LEV_MAX);
    if (y === this.lastDrag) return;
    this.lastDrag = y;
    this.onLeverageCb?.(y);
  }

  private up(ev: PointerEvent): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.lastDrag = null;
    try { (ev.target as Element).releasePointerCapture?.(ev.pointerId); } catch { /* already released */ }
  }

  /** Arrow keys move the focused point through the same clamp/set path as the pointer. */
  private key(ev: KeyboardEvent): void {
    if (!this.dragOn) return;
    const dir = ev.key === 'ArrowUp' ? 1 : ev.key === 'ArrowDown' ? -1 : 0;
    if (dir === 0) return;
    ev.preventDefault();
    // the focused point owns its arrows, whatever the shell binds on window
    ev.stopPropagation();
    const stepPx = ev.shiftKey ? LEV_STEP * 4 : LEV_STEP;
    const next = clamp(this.levY + dir * stepPx, LEV_MIN, LEV_MAX);
    if (next === this.levY) return;
    this.lastDrag = next;
    this.onLeverageCb?.(next);
  }
}
