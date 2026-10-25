import { select, type Selection } from 'd3-selection';
import type { Mode } from '../../core/mode';
import { HBarsLayer } from '../../core/plot/hbars';
import { TextMeasure } from '../../core/plot/text-measure';
import { tr } from '../../core/plot/transition';
import { el, NARROW, NS, type ViewScene } from './scene-base';
import type { FidelityView, LimeView, SurrogateView } from './view';

/** Vertical metrics (px) of the scene, kept in step with the CSS: root padding, gap between parts, panel padding and border. */
export const SURR_PAD_V = 16;
export const SURR_PAD_V_NARROW = 8;
export const SURR_GAP = 8;
export const PANEL_PAD = 16;
export const PANEL_ROW_GAP = 6;
export const PANEL_LINE = 1.25;
/** Smallest bar row: bar height plus the name above it. */
export const BAR_MIN = 6;

/**
 * Steps 6-7: the three rule coefficients as `.lime-bar`s on the shared `HBarsLayer` (orange `.is-pos` pushes towards
 * "ayrılır", blue `.is-neg` towards "kalır"; the rule name sits above its bar and wraps when the stage is narrow),
 * the intercept line `.lime-intercept` and, in step 7, the fidelity panel: the model's p (`.fidelity-model`), the
 * surrogate's local prediction (`.fidelity-local`) and the weighted R² (`.fidelity-r2`).
 */
export class SurrogateScene implements ViewScene {
  private readonly root: HTMLDivElement;
  private readonly intercept: HTMLParagraphElement;
  private readonly interceptValue: HTMLElement;
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly barG: Selection<SVGGElement, unknown, null, undefined>;
  private readonly zeroG: Selection<SVGGElement, unknown, null, undefined>;
  private readonly nameG: Selection<SVGGElement, unknown, null, undefined>;
  private readonly layer: HBarsLayer;
  private readonly panel: HTMLElement;
  private readonly modelValue: HTMLElement;
  private readonly localValue: HTMLElement;
  private readonly r2Value: HTMLElement;
  private readonly modelFill: HTMLElement;
  private readonly localFill: HTMLElement;
  private readonly measure: TextMeasure;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'surrogate-scene');
    this.intercept = el(doc, 'p', 'lime-intercept');
    this.interceptValue = el(doc, 'strong', 'intercept-value');
    this.intercept.append('kesişim ', this.interceptValue);
    const root = doc.createElementNS(NS, 'svg');
    this.svg = select(root).attr('class', 'lime-plot').attr('role', 'img').attr('aria-label', 'Vekil modelin üç kuralının katsayıları');
    this.barG = this.svg.append('g').attr('class', 'lime-bars');
    this.zeroG = this.svg.append('g').attr('class', 'lime-zeros');
    this.nameG = this.svg.append('g').attr('class', 'lime-names');
    const probe = this.svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
    this.layer = new HBarsLayer(this.barG, this.measure);

    this.panel = el(doc, 'section', 'fidelity-panel');
    const row = (label: string, cls: string, fillCls: string) => {
      const r = el(doc, 'div', 'fidelity-row');
      const value = el(doc, 'strong', cls);
      const track = el(doc, 'div', 'fidelity-track');
      const fill = el(doc, 'div', `fidelity-fill ${fillCls}`);
      track.append(fill);
      r.append(el(doc, 'span', 'fidelity-label', label), track, value);
      return { r, value, fill };
    };
    const model = row('model p(ayrılma)', 'fidelity-model', 'is-model');
    const local = row('vekil tahmini', 'fidelity-local', 'is-local');
    const r2 = el(doc, 'div', 'fidelity-row fidelity-r2-row');
    this.r2Value = el(doc, 'strong', 'fidelity-r2');
    r2.append(el(doc, 'span', 'fidelity-label', 'yerel uyum (ağırlıklı R²)'), this.r2Value);
    this.modelValue = model.value;
    this.localValue = local.value;
    this.modelFill = model.fill;
    this.localFill = local.fill;
    this.panel.append(model.r, local.r, r2);
    this.root.append(this.intercept, root, this.panel);
    host.append(this.root);
  }

  resize(w: number, h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.mode = mode;
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('bars');
  }

  destroy(): void {
    this.interrupt();
    this.root.remove();
  }

  update(v: LimeView, ms: number): void {
    const s = v.surrogate;
    if (!s) {
      return;
    }
    this.root.dataset.part = s.part;
    this.interceptValue.textContent = s.interceptText;
    this.panel.hidden = s.fidelity === null;
    if (s.fidelity) {
      this.fill(s.fidelity);
    }
    this.draw(s, ms);
  }

  private fill(fid: FidelityView): void {
    this.modelValue.textContent = fid.modelText;
    this.localValue.textContent = fid.localText;
    this.r2Value.textContent = fid.r2Text;
    this.modelFill.style.width = `${Math.round(fid.modelRatio * 100)}%`;
    this.localFill.style.width = `${Math.round(fid.localRatio * 100)}%`;
  }

  private draw(s: SurrogateView, ms: number): void {
    const fonts = this.measure.fonts(this.mode);
    const fs = fonts.tick;
    const width = Math.max(240, this.w - 24);
    // rule names above their bars; a name wider than the stage wraps (the same line count for every row)
    const nameFs = this.measure.fontPx('rule-name', fs);
    const lines = s.rules.map((rule) => this.measure.wrap(rule, width - 8, 'rule-name', nameFs));
    const nameLines = Math.max(...lines.map((l) => l.length));
    const nameH = nameLines * nameFs * 1.25;
    // what the stage holds besides the bars: the intercept line and, in step 7, the fidelity panel
    const interceptH = Math.ceil(fs * 1.3);
    this.intercept.style.height = `${interceptH}px`;
    const panelH = s.fidelity ? Math.ceil(3 * fonts.axis * PANEL_LINE + 2 * PANEL_ROW_GAP + PANEL_PAD + 4) : 0;
    const around = (this.w < NARROW ? SURR_PAD_V_NARROW : SURR_PAD_V) + interceptH + SURR_GAP + (panelH > 0 ? panelH + SURR_GAP : 0);
    const natural = nameH + fs * 1.5 + 14;
    const groupH = Math.max(nameH + BAR_MIN + 8, Math.min(natural, (this.h - around) / s.bars.length));
    const height = Math.ceil(groupH * s.bars.length);
    this.root.dataset.used = String(Math.ceil(height + around));
    this.svg.attr('width', width).attr('height', height);

    // diverging bars: zero sits where the longest negative bar and the longest positive bar leave room for their labels
    const valueW = this.measure.width('+0,000', 'tick', fs) + 8;
    const maxPos = Math.max(0, ...s.bars.filter((b) => b.attrs?.sign === 'pos').map((b) => b.value));
    const maxNeg = Math.max(0, ...s.bars.filter((b) => b.attrs?.sign === 'neg').map((b) => b.value));
    const edge = 8;
    const labels = (maxPos > 0 ? valueW : 0) + (maxNeg > 0 ? valueW : 0);
    const scale = (width - 2 * edge - labels) / Math.max(1e-9, maxPos + maxNeg);
    const zero = edge + maxNeg * scale + (maxNeg > 0 ? valueW : 0);
    const draw = (x: number, w: number, max: number) =>
      this.layer.draw(s.bars, {
        rect: { x, y: 0, w, h: height },
        tick: fs,
        rows: s.bars.length,
        slots: 1,
        max,
        itemCls: 'lime-bar',
        valueSample: '+0,000',
        ms,
      });
    // the layer starts its bars `lead` px right of rect.x; a first draw tells how far
    const lead = draw(0, width, 1).x0;
    const ref = Math.max(maxPos, maxNeg, 1e-9);
    // the full-length bar ends `12 + valueW` px before the rect's right edge: the rect is sized so its length is ref * scale
    const geo = draw(zero - lead, lead + ref * scale + 12 + valueW, ref);
    // negative bars grow left from zero, their label sits left of the bar end
    this.barG.selectAll<SVGGElement, { value: number; attrs?: Record<string, string | number> }>('g.lime-bar').each(function (d) {
      if (d.attrs?.sign !== 'neg') {
        return;
      }
      const g = select(this);
      const len = d.value * scale;
      // a negative bar grows leftward: it starts at zero with no width, then x and width move together
      const rect = g.select<SVGRectElement>('rect.bar');
      if (ms > 0) {
        rect.attr('x', Math.round(zero * 10) / 10).attr('width', 0);
      }
      tr(rect, 'bars', ms)
        .attr('x', Math.round((zero - len) * 10) / 10)
        .attr('width', Math.round(len * 10) / 10);
      g.select('text.bar-value').attr('text-anchor', 'end').attr('x', Math.round((zero - len - 6) * 10) / 10);
    });
    // the zero line is drawn per bar, only across the bar bands, so it never crosses a rule name or a label
    const barH = geo.barH;
    this.zeroG
      .selectAll<SVGLineElement, number>('line.lime-zero')
      .data(s.bars.map((_b, i) => geo.yOf(i, 0)))
      .join('line')
      .attr('class', 'lime-zero')
      .attr('x1', Math.round(zero * 10) / 10)
      .attr('x2', Math.round(zero * 10) / 10)
      .attr('y1', (y) => Math.round(y * 10) / 10)
      .attr('y2', (y) => Math.round((y + barH + 1) * 10) / 10);
    this.nameG
      .selectAll<SVGTextElement, string[]>('text.rule-name')
      .data(lines)
      .join('text')
      .attr('class', 'rule-name')
      .attr('data-feature', (_d, i) => i)
      .each(function (rows, i) {
        const top = geo.yOf(i, 0) - 7 - (rows.length - 1) * nameFs * 1.25;
        select(this)
          .selectAll<SVGTSpanElement, string>('tspan')
          .data(rows)
          .join('tspan')
          .attr('x', 6)
          .attr('y', (_r, k) => Math.round((top + k * nameFs * 1.25) * 10) / 10)
          .text((r) => r);
      });
  }
}
