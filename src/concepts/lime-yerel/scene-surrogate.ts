import { select, type Selection } from 'd3-selection';
import type { Mode } from '../../core/mode';
import { HBarsLayer } from '../../core/plot/hbars';
import { TextMeasure } from '../../core/plot/text-measure';
import { el, NS, type ViewScene } from './scene-base';
import type { FidelityView, LimeView, SurrogateView } from './view';

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

  resize(w: number, _h: number, mode: Mode): void {
    this.w = Math.max(1, w);
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
    const fs = this.measure.fonts(this.mode).tick;
    const width = Math.max(240, this.w - 24);
    // rule names above their bars; a name wider than the stage wraps (the same line count for every row)
    const nameFs = this.measure.fontPx('rule-name', fs);
    const lines = s.rules.map((rule) => this.measure.wrap(rule, width - 8, 'rule-name', nameFs));
    const nameLines = Math.max(...lines.map((l) => l.length));
    const nameH = nameLines * nameFs * 1.25;
    const groupH = nameH + fs * 1.5 + 22;
    const height = Math.ceil(groupH * s.bars.length);
    this.svg.attr('width', width).attr('height', height);
    const geo = this.layer.draw(s.bars, {
      rect: { x: 0, y: 0, w: width, h: height },
      tick: fs,
      rows: s.bars.length,
      slots: 1,
      max: s.max,
      itemCls: 'lime-bar',
      valueSample: '+0,000',
      ms,
    });
    this.nameG
      .selectAll<SVGTextElement, string[]>('text.rule-name')
      .data(lines)
      .join('text')
      .attr('class', 'rule-name')
      .attr('data-feature', (_d, i) => i)
      .each(function (rows, i) {
        const top = geo.yOf(i, 0) - 5 - (rows.length - 1) * nameFs * 1.25;
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
