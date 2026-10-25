import type { Mode } from '../../core/mode';
import { formatNumber as f } from '../../core/plot/format';
import { NEGATIVE, NAVY, r1, trianglePath } from '../../core/plot/marks';
import { NumberLineLayer, lineScale, stackLevels } from '../../core/plot/number-line';
import type { TextMeasure } from '../../core/plot/text-measure';
import { ESIK } from './scenario';
import { el, legend, makeSvg, TALL_BUDGET, type G, type Svg, type ViewScene } from './scene-base';
import type { KaymaView, LineView } from './view';

/** The fee axis of steps 2-3 and the axis of the mean difference (step 3). */
export const FEE_AXIS = { min: 40, max: 90 } as const;
const DIFF_AXIS = { min: ESIK.min, max: ESIK.max } as const;
const SIDE = 30;
const PAD = 8;

/**
 * Steps 2-3. The fee number line (`NumberLineLayer`, 40-90) carries the five reference dots (`.nl-dot[data-period="ref"]`,
 * navy) and the five current ones (orange), the two means (`.mean-mark`) and the bridge between them (`.diff-bridge`).
 * Step 3 adds the number line of the difference (0-20) with the difference mark, the dashed threshold (`.esik-line`)
 * and the badge (`.status-badge`: a triangle and UYARI, or a hollow circle and NORMAL).
 */
export class LineScene implements ViewScene {
  private readonly root: HTMLDivElement;
  private readonly svg: Svg;
  private readonly measure: TextMeasure;
  private readonly feeLine: NumberLineLayer;
  private readonly diffLine: NumberLineLayer;
  private readonly diffG: G;
  private readonly marks: G;
  private readonly diffMarks: G;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'line-scene');
    const { svg, measure } = makeSvg(doc, 'line-plot', 'İki dönemin aylık ücretleri sayı doğrusunda');
    this.svg = svg;
    this.measure = measure;
    this.feeLine = new NumberLineLayer(svg.append('g').attr('class', 'fee-line'));
    this.marks = svg.append('g').attr('class', 'fee-marks');
    this.diffG = svg.append('g').attr('class', 'diff-line');
    this.diffLine = new NumberLineLayer(this.diffG);
    this.diffMarks = this.diffG.append('g').attr('class', 'diff-marks');
    this.root.append(
      svg.node()!,
      legend(doc, 'line-legend', [
        { swatch: 'sw-ref', text: 'referans dönem' },
        { swatch: 'sw-cur', text: 'güncel dönem' },
      ]),
    );
    host.append(this.root);
  }

  resize(w: number, h: number, mode: Mode, tall: boolean): void {
    this.w = Math.max(1, Math.floor(w));
    this.h = Math.max(1, Math.floor(tall ? Math.min(h, TALL_BUDGET) : h));
    this.mode = mode;
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('axes');
  }

  destroy(): void {
    this.interrupt();
    this.root.remove();
  }

  update(v: KaymaView, ms: number): void {
    if (v.line) {
      this.draw(v.line, ms);
    }
  }

  private draw(lv: LineView, ms: number): void {
    const fs = this.measure.fonts(this.mode).tick;
    const r = Math.max(5, fs * 0.5);
    const legendH = fs * 2.2;
    const H = Math.max(120, this.h - legendH);
    this.svg.attr('width', this.w).attr('height', H);
    const left = SIDE;
    const right = Math.max(left + 60, this.w - SIDE);
    const sc = lineScale(FEE_AXIS, [left, right]);

    // dots of both periods share the stack levels, so a reference and a current dot never sit on each other
    const values = [...lv.ref.map((x) => ({ x, period: 'ref' })), ...(lv.showCurrent ? lv.cur.map((x) => ({ x, period: 'cur' })) : [])];
    const levels = stackLevels(values.map((d) => sc(d.x)), 2 * r + 1);
    const dotStep = 2 * r + 3;
    const dotsH = (Math.max(...levels) + 1) * dotStep;

    const hasEsik = lv.esik !== null;
    const topNeed = fs * 1.4 + fs * 1.5 + dotsH + 10 + fs * 1.5 + fs * 1.6;
    const botNeed = hasEsik ? fs * 2.6 + fs * 3.2 + fs * 1.5 + fs * 1.6 : 0;
    const gap = hasEsik ? fs * 1.2 : 0;
    const free = H - topNeed - botNeed - gap;
    const top0 = PAD + Math.max(0, free / 2);

    // ---- fee line and its marks ----
    const bridgeY = top0 + fs * 1.4;
    const meanLabelY = bridgeY + fs * 1.1;
    const axisY = bridgeY + fs * 1.5 + dotsH + 10;
    this.feeLine.draw(sc, axisY, { tickCount: 6, tickY: axisY + fs * 1.4, title: 'aylık ücret (para birimsiz)', titleY: axisY + fs * 2.9 }, ms, 'fee');
    this.marks.selectAll('*').remove();

    const means = [
      { period: 'ref', mean: lv.refMean, text: `X̄r = ${f(lv.refMean, 2)}`, anchor: 'end', dx: -6 },
      { period: 'cur', mean: lv.curMean, text: `X̄g = ${f(lv.curMean, 2)}`, anchor: 'start', dx: 6 },
    ].filter((m) => m.period === 'ref' || lv.showCurrent);
    for (const m of means) {
      const x = sc(m.mean);
      const g = this.marks.append('g').attr('class', 'mean-mark').attr('data-period', m.period).attr('data-mean', m.mean);
      g.append('line').attr('x1', r1(x)).attr('x2', r1(x)).attr('y1', r1(bridgeY)).attr('y2', r1(axisY));
      g.append('text')
        .attr('class', 'mean-label tick')
        .attr('text-anchor', m.anchor)
        .attr('x', r1(x + m.dx))
        .attr('y', r1(meanLabelY))
        .text(m.text);
    }
    if (lv.showCurrent) {
      const a = sc(lv.refMean);
      const b = sc(lv.curMean);
      const g = this.marks.append('g').attr('class', 'diff-bridge');
      g.append('line').attr('x1', r1(a)).attr('x2', r1(b)).attr('y1', r1(bridgeY)).attr('y2', r1(bridgeY));
      g.append('text')
        .attr('class', 'bridge-label tick')
        .attr('text-anchor', 'middle')
        .attr('x', r1((a + b) / 2))
        .attr('y', r1(bridgeY - 6))
        .text(`fark = ${f(lv.diff, 2)}`);
    }
    values.forEach((d, i) => {
      this.marks.append('circle')
        .attr('class', 'nl-dot')
        .attr('data-period', d.period)
        .attr('data-value', d.x)
        .attr('cx', r1(sc(d.x)))
        .attr('cy', r1(axisY - r - 2 - levels[i] * dotStep))
        .attr('r', r1(r));
    });

    // ---- the difference line (step 3) ----
    this.diffG.attr('display', hasEsik ? null : 'none');
    this.diffMarks.selectAll('*').remove();
    if (!hasEsik || lv.status === null || lv.esik === null) {
      return;
    }
    const sd = lineScale(DIFF_AXIS, [left, right]);
    const bTop = top0 + topNeed + gap;
    const badgeY = bTop + fs * 0.9;
    const esikTop = bTop + fs * 2.6;
    const axis2 = esikTop + fs * 3.2;
    this.diffLine.draw(sd, axis2, { tickCount: 5, tickY: axis2 + fs * 1.4, title: 'fark (mutlak, para birimsiz)', titleY: axis2 + fs * 2.9 }, ms, 'diff');

    const ex = sd(Math.max(DIFF_AXIS.min, Math.min(DIFF_AXIS.max, lv.esik)));
    const dx = sd(Math.max(DIFF_AXIS.min, Math.min(DIFF_AXIS.max, lv.diff)));
    const esikSide = dx >= ex ? 'end' : 'start';
    this.diffMarks.append('line')
      .attr('class', 'esik-line')
      .attr('x1', r1(ex)).attr('x2', r1(ex))
      .attr('y1', r1(esikTop)).attr('y2', r1(axis2));
    this.diffMarks.append('text')
      .attr('class', 'esik-label tick')
      .attr('text-anchor', esikSide)
      .attr('x', r1(ex + (esikSide === 'end' ? -6 : 6)))
      .attr('y', r1(esikTop + fs * 0.9))
      .text(`eşik ${f(lv.esik, 1)}`);
    const dm = this.diffMarks.append('g').attr('class', 'diff-mark').attr('transform', `translate(${r1(dx)},${r1(axis2)})`);
    const big = r * 1.3;
    dm.append('path').attr('d', `M0,${-big}L${big},0L0,${big}L${-big},0Z`).attr('fill', NAVY);
    const labelSide = dx >= ex ? 'start' : 'end';
    dm.append('text')
      .attr('class', 'diff-label tick')
      .attr('text-anchor', labelSide)
      .attr('x', labelSide === 'start' ? big + 4 : -big - 4)
      .attr('y', -big - 2)
      .text(f(lv.diff, 2));

    // ---- the badge: shape and text, so the verdict does not rest on colour ----
    const badge = this.diffMarks.append('g')
      .attr('class', 'status-badge')
      .attr('data-status', lv.status)
      .attr('transform', `translate(${r1(left + r * 1.2)},${r1(badgeY)})`);
    const br = r * 1.2;
    if (lv.status === 'UYARI') {
      badge.append('path').attr('d', trianglePath(br)).attr('fill', NEGATIVE);
    } else {
      badge.append('circle').attr('r', r1(br)).attr('fill', 'none').attr('stroke', NAVY).attr('stroke-width', 2.5);
    }
    badge.append('text')
      .attr('class', 'badge-text tick')
      .attr('x', r1(br + 8))
      .attr('dy', '0.35em')
      .text(lv.status);
  }
}
