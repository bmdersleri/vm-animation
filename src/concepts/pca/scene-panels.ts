import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import { easeCubicInOut } from 'd3-ease';
import type { Mode } from '../../core/mode';
import { AxesLayer } from '../../core/plot/axes';
import { circlesPath, diamondPath, trianglesPath } from '../../core/plot/dots-path';
import { r1 } from '../../core/plot/marks';
import { TextMeasure } from '../../core/plot/text-measure';
import { tr } from '../../core/plot/transition';
import { fitAspect, type Rect, type Scales } from '../../core/plot/viewport';
import { TSNE, type Pt } from './data';
import type { PanelsView } from './view';

/** Durations before `durationScale`. */
const MORPH_MS = 900;
const NEW_FADE_MS = 350;
/** Gap between the two panels and the margin around each embedding, as a share of its extent. */
const PANEL_GAP = 32;
const EDGE = 0.08;
const NAMES = ['pca-morph', 'pca-newcust'];

type G = Selection<SVGGElement, unknown, null, undefined>;
type El<T extends Element> = Selection<T, unknown, null, undefined>;

interface Lay { rect: Rect; fonts: { tick: number; axis: number }; gap: number; yTickW: number }
interface Drawn { key: string; newCustomer: boolean }
interface Panel {
  g: G;
  axes: AxesLayer;
  title: El<SVGTextElement>;
  circles: El<SVGPathElement>;
  triangles: El<SVGPathElement>;
  /** Current dot positions in px, point order of the embedding. */
  curX: Float64Array;
  curY: Float64Array;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const N = TSNE.labels.length;
/** Point indices of the two classes (0: stayed, 1: churned). */
const CLASS_IDX: number[][] = [0, 1].map((c) => TSNE.labels.flatMap((l, i) => (l === c ? [i] : [])));

/** Scales that show `pts` with an 8 % margin on each side and equal px per unit. */
function fitPoints(pts: readonly Pt[], plot: Rect): Scales {
  let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  const px = (x1 - x0) * EDGE;
  const py = (y1 - y0) * EDGE;
  return fitAspect({ x: [x0 - px, x1 + px], y: [y0 - py, y1 + py] }, plot, 1);
}

/**
 * Part 3 of `pca`: the PCA and the t-SNE panel side by side (300 customers as one
 * circle path and one triangle path each), the new customer as a diamond, the
 * legend, and the three rule boxes of the last step (HTML in `ruleHost`). A change
 * of the t-SNE embedding glides every dot in px space (fixed duration × `ds`,
 * `ms > 0` is just the animate flag); the new customer appears at the end.
 */
export class PanelsLayer {
  private readonly root: G;
  private readonly measure: TextMeasure;
  private readonly legend: G;
  private readonly panels: [Panel, Panel];
  private readonly rule: HTMLDivElement;

  private lay: Lay | null = null;
  private mode: Mode = 'ders';
  private view: PanelsView | null = null;
  private drawn: Drawn | null = null;

  constructor(svgEl: SVGSVGElement, ruleHost: HTMLElement, private readonly ds: number) {
    this.root = select(svgEl).append('g').attr('class', 'pca-panels');
    this.legend = this.root.append('g').attr('class', 'legend');
    this.legend.append('text').attr('class', 'legend-label c0').text('● churn etmeyen');
    this.legend.append('text').attr('class', 'legend-label c1').text('▲ churn eden');
    const make = (cls: string): Panel => {
      const g = this.root.append('g').attr('class', `panel ${cls}`);
      return {
        g,
        axes: new AxesLayer(g.append('g').attr('class', 'axes')),
        title: g.append('text').attr('class', 'panel-title').attr('text-anchor', 'middle'),
        circles: g.append('path').attr('class', 'pts c0').attr('data-n', CLASS_IDX[0].length),
        triangles: g.append('path').attr('class', 'pts c1').attr('data-n', CLASS_IDX[1].length),
        curX: new Float64Array(N),
        curY: new Float64Array(N),
      };
    };
    this.panels = [make('pca'), make('tsne')];
    const probe = this.root.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);

    const doc = ruleHost.ownerDocument;
    this.rule = doc.createElement('div');
    this.rule.className = 'rule';
    this.rule.style.display = 'none';
    const box = (title: string, body: string): HTMLDivElement => {
      const b = doc.createElement('div');
      b.className = 'rule-box';
      const h = doc.createElement('strong');
      h.className = 'rule-title';
      h.textContent = title;
      const p = doc.createElement('p');
      p.innerHTML = body;
      b.append(h, p);
      return b;
    };
    this.rule.append(
      box('PCA sıkıştırır', '<code>fit</code> yalnızca eğitim verisinde çalışır, <code>transform</code> her yerde: eğitimde, testte ve yeni müşteride.'),
      box('özellik seçimi eler', 'Hangi sütunun atılacağı ayrı bir iştir: <a href="../ozellik-secimi/">özellik seçimi sayfası</a>.'),
      box('t-SNE yalnızca gösterir', 'Harita bakmak içindir, model girdisi değildir. Yeni veriyi dönüştüremez; yeniden çalıştırınca harita değişir.'),
    );
    ruleHost.append(this.rule);
  }

  layout(rect: Rect, mode: Mode): void {
    this.mode = mode;
    const fonts = this.measure.fonts(mode);
    const gap = Math.round(fonts.tick * 0.45);
    this.lay = { rect, fonts, gap, yTickW: this.measure.width('−12,5', 'tick', fonts.tick) };
    if (this.view) {
      this.cancel();
      this.draw(this.view, false);
    }
  }

  update(v: PanelsView | null, ms: number): void {
    this.cancel();
    const prev = this.drawn;
    this.view = v;
    if (!v) {
      this.root.style('display', 'none');
      this.rule.style.display = 'none';
      this.drawn = null;
      return;
    }
    if (!this.lay) return;
    this.draw(v, ms > 0 && this.ds > 0 && prev !== null, prev);
  }

  /** Cancels running transitions and snaps every element to its final state. */
  interrupt(): void {
    this.cancel();
    if (this.view && this.lay) this.draw(this.view, false);
  }

  destroy(): void {
    this.cancel();
    this.root.remove();
    this.rule.remove();
  }

  private cancel(): void {
    for (const n of NAMES) this.root.selectAll('*').interrupt(n);
    for (const n of NAMES) this.root.interrupt(n);
  }

  // ------------------------------------------------------------- draw
  private draw(v: PanelsView, animate: boolean, prev: Drawn | null = this.drawn): void {
    const L = this.lay!;
    const { rect, fonts, gap } = L;
    this.rule.style.display = v.rule ? '' : 'none';
    this.root.style('display', v.rule ? 'none' : '');
    if (v.rule) {
      this.drawn = null;
      return;
    }

    // ---- geometry: legend row, title row, then two equal panels
    const lh = fonts.tick * 1.2;
    const legendH = Math.round(lh * 1.5);
    const titleH = Math.round(fonts.axis * 1.7);
    const pw = (rect.width - PANEL_GAP) / 2;
    const plotTop = Math.round(rect.top + legendH + titleH);
    const plotH = Math.max(40, rect.top + rect.height - (fonts.tick * 1.5 + 2 * gap + fonts.axis * 1.5) - plotTop);
    const plotOf = (i: number): Rect => {
      const left = Math.round(rect.left + i * (pw + PANEL_GAP) + fonts.axis * 1.3 + 2 * gap + L.yTickW);
      return {
        left, top: plotTop, height: plotH,
        width: Math.max(40, rect.left + i * (pw + PANEL_GAP) + pw - gap - fonts.tick - left),
      };
    };

    const [c0, c1] = this.legend.selectAll<SVGTextElement, unknown>('text.legend-label').nodes();
    const w0 = this.measure.width(c0.textContent ?? '', 'legend-label', fonts.tick);
    const lx = plotOf(0).left;
    select(c0).attr('x', r1(lx)).attr('y', r1(rect.top + lh));
    select(c1).attr('x', r1(lx + w0 + 2 * PANEL_GAP)).attr('y', r1(rect.top + lh));

    // ---- the two embeddings: PCA coordinates, and the t-SNE embedding picked by the key
    const perp = v.perplexity;
    const withNew = v.embedKey.endsWith('-new');
    const tsne = withNew ? TSNE.embedNew[perp] : TSNE.embed[perp];
    const sets: [readonly Pt[], readonly Pt[], Pt | null][] = [
      [TSNE.pca, TSNE.pca, TSNE.newPca],
      [tsne, tsne.slice(0, N), withNew ? tsne[N] : null],
    ];
    const morphing = animate && prev !== null && prev.key !== v.embedKey;
    // The PCA panel never changes with perplexity: its new customer fades in only when it first
    // appears. The t-SNE one is re-placed by every new embedding, so it waits for the glide.
    const firstNew = prev === null || !prev.newCustomer;
    const appearOf = (pca: boolean): boolean => animate && (firstNew || (morphing && !pca));
    const newDelay = morphing ? MORPH_MS * this.ds : 0;

    this.panels.forEach((p, i) => {
      const plot = plotOf(i);
      const [scaleOf, dots, newPt] = sets[i];
      const sc = fitPoints(scaleOf, plot);
      const bottom = plot.top + plot.height;
      const xTickY = bottom + gap + fonts.tick * 0.9;
      const pca = i === 0;
      p.axes.draw(sc, plot, {
        xTickCount: Math.max(2, Math.round(plot.width / (fonts.tick * 7))),
        yTickCount: Math.max(2, Math.round(plot.height / (fonts.tick * 3.2))),
        xTickY, yTickX: plot.left - gap,
        ...(pca ? {} : { xTicks: [], yTicks: [] }),
        xTitle: { x: plot.left + plot.width / 2, y: xTickY + fonts.tick * 0.3 + gap + fonts.axis * 0.95, text: pca ? 'PC1' : 't-SNE 1' },
        yTitle: { x: Math.max(fonts.axis * 0.6, plot.left - 2 * gap - L.yTickW - fonts.axis * 0.25), y: plot.top + plot.height / 2, lines: [pca ? 'PC2' : 't-SNE 2'] },
      }, 0, 'panel');
      p.title.attr('x', r1(plot.left + plot.width / 2)).attr('y', r1(rect.top + legendH + fonts.axis * 1.1)).text(v.titles[i]);

      const tx = Float64Array.from(dots, (d) => sc.x(d[0]));
      const ty = Float64Array.from(dots, (d) => sc.y(d[1]));
      const glide = morphing && !pca;
      p.g.attr('data-embed', pca ? null : v.embedKey);
      if (glide) {
        const x0 = Float64Array.from(p.curX);
        const y0 = Float64Array.from(p.curY);
        this.root.transition('pca-morph').duration(MORPH_MS * this.ds).ease(easeCubicInOut).tween('morph', () => (t: number) => {
          for (let k = 0; k < N; k++) { p.curX[k] = lerp(x0[k], tx[k], t); p.curY[k] = lerp(y0[k], ty[k], t); }
          this.paint(p);
          if (t >= 1) this.stamp(p);
        });
      } else {
        p.curX.set(tx);
        p.curY.set(ty);
        this.paint(p);
        this.stamp(p);
      }

      // ---- the new customer: a diamond and its label, only while `newCustomer`
      const on = v.newCustomer && newPt !== null;
      const r = this.mode === 'ders' ? 7 : 6;
      const nx = on ? sc.x(newPt![0]) : 0;
      const ny = on ? sc.y(newPt![1]) : 0;
      const diamond = p.g.selectAll<SVGPathElement, number>('path.newcust').data(on ? [1] : []).join('path')
        .attr('class', 'newcust').attr('d', diamondPath(nx, ny, r));
      const label = p.g.selectAll<SVGTextElement, number>('text.newcust-label').data(on ? [1] : []).join('text')
        .attr('class', 'newcust-label').attr('text-anchor', 'middle').text('yeni müşteri');
      if (on) {
        const w = this.measure.width('yeni müşteri', 'newcust-label', fonts.tick);
        const half = r * Math.SQRT2;
        const above = ny - half - gap >= plot.top + lh;
        label.attr('x', r1(Math.min(plot.left + plot.width - w / 2, Math.max(plot.left + w / 2, nx))))
          .attr('y', r1(above ? ny - half - gap : ny + half + gap + fonts.tick * 0.8));
      }
      const appear = appearOf(pca);
      for (const s of [diamond, label]) {
        s.attr('opacity', appear ? 0 : 1);
        tr(s, 'pca-newcust', appear ? NEW_FADE_MS * this.ds : 0, () => newDelay).attr('opacity', 1);
      }
    });
    this.drawn = { key: v.embedKey, newCustomer: v.newCustomer };
  }

  /** One circle path and one triangle path from the current px positions. */
  private paint(p: Panel): void {
    const ders = this.mode === 'ders';
    const pick = (k: number, a: Float64Array): Float64Array => Float64Array.from(CLASS_IDX[k], (i) => a[i]);
    p.circles.attr('d', circlesPath(pick(0, p.curX), pick(0, p.curY), ders ? 3.5 : 3));
    p.triangles.attr('d', trianglesPath(pick(1, p.curX), pick(1, p.curY), ders ? 4.5 : 4));
  }

  /** `data-first`: px of the first point, written when the dots have arrived. */
  private stamp(p: Panel): void {
    p.g.attr('data-first', `${r1(p.curX[0])},${r1(p.curY[0])}`);
  }
}
