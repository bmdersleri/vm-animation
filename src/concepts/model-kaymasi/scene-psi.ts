import type { Mode } from '../../core/mode';
import { formatNumber as f } from '../../core/plot/format';
import { HBarsLayer, type HBar } from '../../core/plot/hbars';
import { r1 } from '../../core/plot/marks';
import type { TextMeasure } from '../../core/plot/text-measure';
import { META, REFERENCE } from './data';
import { el, legend, makeSvg, NARROW, setLegend, type G, type Svg, type ViewScene } from './scene-base';
import type { KaymaView, PsiView } from './view';

/** Smallest row height (px) for two bars and a name, in tick-font heights plus padding. */
const rowMin = (fs: number): number => Math.max(34, fs * 1.9 + 8);

/** The names of the ten PSI bins from the reference deciles: "< c₁", "c₁–c₂", …, "≥ c₉" (two decimals). */
export function binLabels(cuts: readonly number[] = REFERENCE.psiCuts): string[] {
  const c = cuts.map((x) => f(x, 2));
  return [`< ${c[0]}`, ...c.slice(0, -1).map((lo, i) => `${lo}–${c[i + 1]}`), `≥ ${c[c.length - 1]}`];
}

/**
 * Step 8: ten rows of two bars (`.psi-bar[data-bin][data-kind="p|q"]`: reference share and current share of the bin)
 * built with `HBarsLayer`, the term of each bin after its bars (`.psi-term`, three decimals; an empty bin reads
 * "q = 0" on its q bar and marks its term with `*`, the footnote `.psi-footnote` explains), and the total
 * (`.psi-total`). The reference bars are there from the start; the sweep adds a bin's q bar and term.
 */
export class PsiScene implements ViewScene {
  private readonly root: HTMLDivElement;
  private readonly svg: Svg;
  private readonly measure: TextMeasure;
  private readonly bars: HBarsLayer;
  private readonly termG: G;
  private readonly legend: HTMLElement;
  private readonly total: HTMLElement;
  private readonly footnote: HTMLElement;
  private readonly note: HTMLElement;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';
  private tall = false;

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'psi-scene');
    const { svg, measure } = makeSvg(doc, 'psi-plot', 'PSI: bölme başına referans payı, güncel pay ve terim');
    this.svg = svg;
    this.measure = measure;
    this.bars = new HBarsLayer(svg.append('g').attr('class', 'psi-bars'), measure);
    this.termG = svg.append('g').attr('class', 'psi-terms');
    this.legend = legend(doc, 'psi-legend', []);
    this.total = el(doc, 'p', 'psi-total');
    this.footnote = el(doc, 'p', 'psi-footnote');
    this.note = el(doc, 'p', 'scene-note');
    this.root.append(this.legend, svg.node()!, this.total, this.footnote, this.note);
    host.append(this.root);
  }

  resize(w: number, h: number, mode: Mode, tall: boolean): void {
    this.w = Math.max(1, Math.floor(w));
    this.h = Math.max(1, Math.floor(h));
    this.mode = mode;
    this.tall = tall;
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('bars');
  }

  destroy(): void {
    this.interrupt();
    this.root.remove();
  }

  update(v: KaymaView, ms: number): void {
    if (v.psi) {
      this.draw(v.psi, v.note, ms);
    }
  }

  private draw(p: PsiView, note: string | null, ms: number): void {
    const fs = this.measure.fonts(this.mode).tick;
    const rows = p.bars.length;
    const shownSum = p.bars.filter((b) => b.shown).reduce((a, b) => a + b.term, 0);
    setLegend(this.legend, [
      { swatch: 'sw-psi-p', text: `p: referans payı (ay 1–${META.refMonths})` },
      { swatch: 'sw-psi-q', text: `q: ay ${p.month} payı` },
    ]);
    this.total.textContent = `PSI toplamı = ${f(shownSum, 3)}${p.shown < rows ? ' (tarama sürüyor)' : ''}`;
    this.footnote.textContent = p.footnote ? `* ${p.footnote}` : '';
    this.footnote.hidden = !p.footnote;
    this.note.textContent = note ?? '';

    const headH = fs * 1.6;
    const termW = this.measure.width('−0,000*', 'tick', fs) + 12;
    // wide: the legend, total and notes stand in a column beside the bars; narrow: they stack around them
    const side = this.w >= NARROW;
    const sideW = side ? Math.min(340, Math.floor(this.w * 0.27)) : 0;
    const W = side ? this.w - sideW - 16 : this.w;
    this.root.toggleAttribute('data-side', side);
    this.root.style.setProperty('--side-w', `${sideW}px`);
    const chrome = side ? 8 : fs * 2.2 + fs * 1.8 + (p.footnote ? fs * 1.6 : 0) + fs * 3 + 24;
    const rowsH = Math.max(rows * rowMin(fs), this.tall ? 0 : this.h - chrome - headH);
    const H = Math.ceil(headH + rowsH + 4);
    this.svg.attr('width', W).attr('height', H);

    const binNames = binLabels();
    const max = Math.max(...p.bars.flatMap((b) => [b.p, b.q]));
    const data: HBar[] = [];
    for (const b of p.bars) {
      data.push({
        id: `p${b.bin}`, row: b.bin - 1, slot: 0, cls: 'bar-p', value: b.p, text: f(b.p, 3), label: binNames[b.bin - 1],
        attrs: { bin: b.bin, kind: 'p' },
      });
      if (b.shown) {
        data.push({
          id: `q${b.bin}`, row: b.bin - 1, slot: 1, cls: 'bar-q', value: b.q, text: b.empty ? 'q = 0' : f(b.q, 3), label: '',
          attrs: { bin: b.bin, kind: 'q' },
        });
      }
    }
    const rect = { x: 0, y: headH, w: W - termW - 6, h: rowsH };
    this.bars.draw(data, { rect, tick: fs, rows, slots: 2, max, itemCls: 'psi-bar', valueSample: 'q = 0', ms });

    const groupH = rowsH / rows;
    this.termG.selectAll('*').remove();
    this.termG.append('text')
      .attr('class', 'psi-head tick')
      .attr('x', r1(W - termW))
      .attr('y', r1(headH * 0.8))
      .text('terim');
    for (const b of p.bars) {
      if (!b.shown) {
        continue;
      }
      this.termG.append('text')
        .attr('class', `psi-term tick${b.empty ? ' is-empty' : ''}`)
        .attr('data-bin', b.bin)
        .attr('x', r1(W - termW))
        .attr('y', r1(headH + (b.bin - 0.5) * groupH))
        .attr('dy', '0.35em')
        .text(`${f(b.term, 3)}${b.empty ? '*' : ''}`);
    }
  }
}
