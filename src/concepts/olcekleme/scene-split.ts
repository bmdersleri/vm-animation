import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import type { Mode } from '../../core/mode';
import { formatNonZero } from '../../core/plot/format';
import { r1 } from '../../core/plot/marks';
import { lineScale, NumberLineLayer, staggerRows } from '../../core/plot/number-line';
import { TextMeasure } from '../../core/plot/text-measure';
import { tr, type AnySel } from '../../core/plot/transition';
import type { OlcView } from './view';

/** Transition name of every move/fade in this layer (interrupted on each update). */
const TN = 'olc-split';
const SVGNS = 'http://www.w3.org/2000/svg';
const FLOW_TEXT = ['train_test_split', 'fit (yalnızca eğitim)', 'transform (eğitim ve test)'];
/** Height reserved under the plot for the flow boxes (Ders / Lab). */
/** Tallest split plot in Lab (px); taller stages centre it instead of stretching the gaps. */
const LAB_PLOT_MAX_H = 340;
const FLOW_H: Record<Mode, number> = { ders: 110, lab: 64 };

type G = Selection<SVGGElement, unknown, null, undefined>;
interface Lay { w: number; h: number }
interface Pt { i: number; v: number; kind: 'train' | 'test' }
interface Lbl { k: string; cx: number; ly: number; text: string; w: number; cls: string }

const f2 = (x: number): string => formatNonZero(x, 2);

/**
 * The train / test split of the `olcekleme` page: ten invoices on one number
 * line (20 to 100 TL) in two rows, the fitted mean with its ±σ band, the
 * ghost of the training mean while the leaky fit is shown, the test z labels
 * and the three-box golden-rule flow. `update(v, ms, mode)` moves what
 * changed over `ms` (0 = instantly).
 */
export class SplitLayer {
  private readonly wrap: HTMLDivElement;
  private readonly svgEl: SVGSVGElement;
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly flowEl: HTMLDivElement;
  private readonly line: NumberLineLayer;
  private readonly measure: TextMeasure;
  private readonly gBand: G;
  private readonly gMu: G;
  private readonly gPts: G;
  private readonly gText: G;
  private lay: Lay | null = null;
  private mode: Mode = 'ders';
  private view: OlcView | null = null;

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.wrap = doc.createElement('div');
    this.wrap.className = 'split-wrap';
    this.svgEl = doc.createElementNS(SVGNS, 'svg');
    this.svgEl.setAttribute('class', 'split-plot');
    this.svgEl.setAttribute('role', 'img');
    this.svgEl.setAttribute('aria-label', 'Eğitim ve test faturaları tek sayı doğrusunda');
    this.flowEl = doc.createElement('div');
    this.flowEl.className = 'flow';
    FLOW_TEXT.forEach((t, i) => {
      if (i > 0) {
        const a = doc.createElement('span');
        a.className = 'flow-arrow';
        a.textContent = '→';
        a.setAttribute('aria-hidden', 'true');
        this.flowEl.append(a);
      }
      const b = doc.createElement('div');
      b.className = 'flow-box';
      b.textContent = t;
      this.flowEl.append(b);
    });
    this.flowEl.style.display = 'none';
    this.wrap.append(this.svgEl, this.flowEl);
    host.append(this.wrap);

    const svg = select(this.svgEl);
    this.svg = svg;
    this.line = new NumberLineLayer(svg.append('g').attr('class', 'axis-g'));
    this.gBand = svg.append('g').attr('class', 'bands').attr('pointer-events', 'none');
    this.gMu = svg.append('g').attr('class', 'mus').attr('pointer-events', 'none');
    this.gPts = svg.append('g').attr('class', 'pts').attr('pointer-events', 'none');
    this.gText = svg.append('g').attr('class', 'texts').attr('pointer-events', 'none');
    const probe = svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
  }

  resize(w: number, h: number, mode: Mode): void {
    if (this.lay && this.lay.w === w && this.lay.h === h && this.mode === mode) return;
    this.mode = mode;
    this.lay = { w, h };
    this.wrap.style.width = `${w}px`;
    this.wrap.style.height = `${h}px`;
    if (this.view) {
      this.cancel();
      this.draw(this.view, 0);
    }
  }

  update(v: OlcView, ms: number, mode: Mode): void {
    this.cancel();
    this.view = v;
    if (mode !== this.mode) {
      this.mode = mode;
      if (this.lay) this.draw(v, 0);
      return;
    }
    if (this.lay) this.draw(v, ms);
  }

  /** Cancels running transitions and snaps every element to its final position. */
  interrupt(): void {
    this.cancel();
    if (this.view && this.lay) this.draw(this.view, 0);
  }

  destroy(): void {
    this.cancel();
    this.wrap.remove();
  }

  private cancel(): void {
    this.svg.selectAll('*').interrupt(TN);
    this.svg.selectAll('*').interrupt('axes');
  }

  private draw(v: OlcView, ms: number): void {
    const L = this.lay!;
    const s = v.split;
    this.wrap.style.display = s ? '' : 'none';
    this.svgEl.style.display = s ? '' : 'none';
    this.flowEl.style.display = s?.flow ? 'flex' : 'none';
    if (!s) return;

    const flowH = s.flow ? FLOW_H[this.mode] : 0;
    // Lab: the plot keeps a compact height; the wrapper centres plot and flow in the free space
    const H = Math.max(120, Math.min(L.h - flowH, this.mode === 'lab' ? LAB_PLOT_MAX_H : Infinity));
    this.svgEl.setAttribute('width', String(L.w));
    this.svgEl.setAttribute('height', String(H));
    this.flowEl.style.height = `${flowH}px`;

    const fonts = this.measure.fonts(this.mode);
    const tick = fonts.tick;
    const rowFs = this.measure.fontPx('row-label', this.mode === 'ders' ? 22 : 16);
    const R = this.mode === 'ders' ? 9 : 7;
    const pad = 10;
    const gap = Math.round(tick * 0.45);
    const lh = tick * 1.4; // a text box is about 1.33 em tall, so stacked rows must be at least that far apart
    const rowLabelW = Math.max(
      this.measure.width('eğitim', 'row-label', rowFs), this.measure.width('test', 'row-label', rowFs),
    );
    const left = pad + rowLabelW + 18;
    const right = L.w - pad - 24;
    const sc = lineScale({ min: 20, max: 100 }, [left, right]);

    // vertical layout: μ labels, train row, test row, z labels, axis, ticks, title
    const muZone = lh * 2 + 6;
    const rowGap0 = R * 2 + Math.round(tick * 1.2);
    const zZone = lh + 6;
    const below = gap + tick * 1.2 + gap + fonts.axis * 1.25 + pad;
    const content = muZone + R + 4 + rowGap0 + R + 8 + zZone + 14 + below;
    const spare = Math.max(0, H - content);
    const rowGap = rowGap0 + Math.min(40, spare * 0.4);
    const lead = Math.min(70, (spare - (rowGap - rowGap0)) / 2);
    const top = 6 + lead;
    const yTrain = top + muZone + R + 4;
    const yTest = s.separated ? yTrain + rowGap : yTrain;
    const yAxis = yTrain + rowGap + R + 8 + zZone + 14;
    const tickY = yAxis + gap + tick * 0.9;

    this.line.draw(sc, yAxis, {
      tickCount: Math.max(2, Math.round((right - left) / (tick * 5))),
      tickY, title: 'Aylık fatura (TL)', titleY: tickY + tick * 0.3 + gap + fonts.axis * 0.95,
    }, ms, 'split');

    const upsert = <D,>(
      g: G, selector: string, data: D[], key: (d: D) => string, tag: string, cls: string,
      place: (sel: AnySel) => void, opacity: (d: D) => number, enterOpacity?: (d: D) => number,
      placeEnter?: (sel: AnySel) => void,
    ): AnySel => {
      const sel = g.selectAll<SVGElement, D>(selector).data(data, key as (d: unknown) => string);
      sel.exit().remove();
      const enter = sel.enter().append<SVGElement>(tag).attr('class', cls);
      (placeEnter ?? place)(enter);
      enter.attr('opacity', (d) => (enterOpacity ?? opacity)(d));
      const t = tr(sel as AnySel, TN, ms);
      place(t);
      t.attr('opacity', (d: D) => opacity(d));
      if (placeEnter || enterOpacity) {
        const fresh = tr(enter as AnySel, TN, ms);
        if (placeEnter) place(fresh);
        if (enterOpacity) fresh.attr('opacity', (d: D) => opacity(d));
      }
      return enter.merge(sel as never) as AnySel;
    };

    const px = (x: number): number => sc(x);
    const yBand0 = top + muZone - 6;

    // ---- ±σ band and the mean lines
    const fit = s.fit;
    upsert(this.gBand, 'rect.sigma', [0], () => 'b', 'rect', 'sigma', (t) => {
      t.attr('x', r1(fit ? px(fit.mu - fit.sigma) : left))
        .attr('width', r1(fit ? Math.abs(px(fit.mu + fit.sigma) - px(fit.mu - fit.sigma)) : 0))
        .attr('y', r1(yBand0)).attr('height', r1(yAxis - yBand0));
    }, () => (fit ? 1 : 0));
    interface MuD { k: 'live' | 'ghost'; mu: number; on: boolean; scope: string }
    const muData: MuD[] = [
      { k: 'live', mu: fit ? fit.mu : 0, on: !!fit, scope: fit ? fit.scope : 'egitim' },
      { k: 'ghost', mu: s.ghostMu ?? 0, on: s.ghostMu !== null, scope: 'egitim' },
    ];
    upsert(this.gMu, 'line.mu', muData, (d) => d.k, 'line', 'mu', (t) => {
      t.attr('x1', (d: MuD) => r1(px(d.mu))).attr('x2', (d: MuD) => r1(px(d.mu)))
        .attr('y1', r1(yBand0)).attr('y2', r1(yAxis));
    }, (d) => (d.on ? 1 : 0)).each(function (d: MuD) {
      select(this as SVGElement).classed('ghost', d.k === 'ghost').attr('data-fit', d.scope);
    });

    // ---- points: train row and test row
    const pts: Pt[] = s.values.map((val, i) => ({ i, v: val, kind: s.train.includes(i) ? 'train' : 'test' }));
    const ptPlace = (testY: number) => (t: AnySel): void => {
      t.attr('cx', (d: Pt) => r1(px(d.v))).attr('cy', (d: Pt) => r1(d.kind === 'test' ? testY : yTrain)).attr('r', R);
    };
    // a fresh test point starts on the train row and drops to its own row
    upsert(this.gPts, 'circle.pt', pts, (d) => String(d.i), 'circle', 'pt', ptPlace(yTest),
      (d) => (d.kind === 'test' && s.fadeTest ? 0.3 : 1), undefined, ms > 0 ? ptPlace(yTrain) : undefined,
    ).each(function (d: Pt) {
      select(this as SVGElement).classed('train', d.kind === 'train').classed('test', d.kind === 'test')
        .classed('faded', d.kind === 'test' && s.fadeTest).attr('data-index', d.i);
    });

    // ---- text: row labels, mean labels, z labels (all boxes kept off each other)
    const tw = (t: string, cls: string): number => this.measure.width(t, cls, tick);
    const rowLbls = [
      { k: 'egitim', text: 'eğitim', y: yTrain, on: 1 },
      { k: 'test', text: 'test', y: yTest, on: s.separated ? 1 : 0 },
    ];
    upsert(this.gText, 'text.row-label', rowLbls, (d) => d.k, 'text', 'row-label', (t) => {
      t.attr('x', pad).attr('y', (d: { y: number }) => r1(d.y + rowFs * 0.35)).attr('text-anchor', 'start');
    }, (d) => d.on).text((d: { text: string }) => d.text);

    const muTexts: Lbl[] = [];
    if (fit) {
      const t = `μ = ${f2(fit.mu)}, σ = ${f2(fit.sigma)}`;
      muTexts.push({ k: 'live', text: t, w: tw(t, 'mu-label'), cx: px(fit.mu), ly: 0, cls: 'mu-label' });
    }
    if (s.ghostMu !== null) {
      const t = `eğitim μ = ${f2(s.ghostMu)}`;
      muTexts.push({ k: 'ghost', text: t, w: tw(t, 'mu-label ghost'), cx: px(s.ghostMu), ly: 0, cls: 'mu-label ghost' });
    }
    const rows = staggerRows(muTexts.map((m) => ({ x: m.cx, w: m.w })), 8);
    muTexts.forEach((m, i) => {
      m.cx = Math.min(right - m.w / 2, Math.max(left + m.w / 2 - 20, m.cx));
      m.ly = top + lh * 0.9 + rows[i] * lh;
    });
    upsert(this.gText, 'text.mu-label', muTexts, (d) => d.k, 'text', 'mu-label', (t) => {
      t.attr('x', (d: Lbl) => r1(d.cx)).attr('y', (d: Lbl) => r1(d.ly)).attr('text-anchor', 'middle');
    }, () => 1, () => 0).text((d: Lbl) => d.text).attr('class', (d: Lbl) => d.cls)
      .attr('data-w', (d: Lbl) => r1(d.w));

    const zTexts: Lbl[] = (s.testZ ?? []).map((z, k) => ({
      k: String(k), text: z, w: tw(z, 'z-label'), cx: px(s.values[s.test[k]]), ly: yTest + R + lh * 0.95, cls: 'z-label',
    }));
    const zr = staggerRows(zTexts.map((z) => ({ x: z.cx, w: z.w })), 8);
    zTexts.forEach((z, i) => { z.ly += zr[i] * lh; });
    upsert(this.gText, 'text.z-label', zTexts, (d) => d.k, 'text', 'z-label', (t) => {
      t.attr('x', (d: Lbl) => r1(d.cx)).attr('y', (d: Lbl) => r1(d.ly)).attr('text-anchor', 'middle');
    }, () => 1, () => 0).text((d: Lbl) => d.text).attr('data-w', (d: Lbl) => r1(d.w));
  }
}
