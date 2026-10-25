import { select } from 'd3-selection';
import type { Mode } from '../../core/mode';
import { CodePanel } from '../../core/plot/code-panel';
import { TextMeasure } from '../../core/plot/text-measure';
import { el, NARROW, NS, type ViewScene } from './scene-base';
import type { CodeView, LimeView } from './view';

/** Vertical metrics (px) kept in step with the CSS: root padding (wide / narrow), gap between blocks, the panel's own padding. */
export const CODE_PAD_V = 16;
export const CODE_PAD_V_NARROW = 8;
export const CODE_GAP = 8;
/** `.code-scene` padding (10 + 10) and row gap (6) around its title and code box, `.code-pre` padding (8 + 8). */
export const PANEL_CHROME = 26;
export const PRE_PAD = 16;
/** Line height of the code text (CSS `line-height` of `.codeview-scene .code-pre`). */
export const CODE_LINE = 1.35;
/** The code box never shrinks below this many lines. */
export const MIN_LINES = 5;

/**
 * Step 10: the book's `HataAyiklama` code on the shared `CodePanel`, with the closing tip and the two page links
 * beside it (under it on a narrow stage). The panel's code box takes the height the stage has left and scrolls
 * inside itself (the latest bug line is brought into view), so the page never grows or scrolls sideways.
 */
export class CodeScene implements ViewScene {
  private readonly root: HTMLDivElement;
  private readonly panel: CodePanel;
  private readonly side: HTMLDivElement;
  private readonly tip: HTMLParagraphElement;
  private readonly links: HTMLElement;
  private readonly measure: TextMeasure;
  private w = 1;
  private h = 1;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'codeview-scene');
    this.panel = new CodePanel(this.root);
    this.side = el(doc, 'div', 'code-side');
    this.tip = el(doc, 'p', 'code-tip');
    this.links = el(doc, 'nav', 'code-links');
    this.side.append(this.tip, this.links);
    this.root.append(this.side);
    // a hidden SVG text probe measures real font sizes and text widths (the scene has no other SVG)
    const svg = doc.createElementNS(NS, 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    const probe = select(svg).append('text').attr('class', 'probe').attr('visibility', 'hidden');
    this.measure = new TextMeasure(probe.node()!);
    this.root.append(svg);
    host.append(this.root);
  }

  resize(w: number, h: number, mode: Mode): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.mode = mode;
  }

  interrupt(): void {}

  destroy(): void {
    this.panel.destroy();
    this.root.remove();
  }

  update(v: LimeView): void {
    const code = v.code;
    if (!code) {
      return;
    }
    this.panel.update({
      faulty: code.faulty,
      fixedLines: code.fixedLines,
      bugs: code.bugs,
      marked: code.marked,
      fixed: code.fixed,
    });
    this.root.dataset.fixed = String(code.fixed);
    this.fillSide(code);
    this.layout(code);
  }

  private fillSide(code: CodeView): void {
    const doc = this.root.ownerDocument;
    this.tip.replaceChildren(el(doc, 'strong', 'code-tip-lead', 'İpucu: '), code.tip);
    this.links.replaceChildren(
      ...code.links.map((l) => {
        const a = el(doc, 'a', 'code-link', l.text);
        a.setAttribute('href', l.href);
        return a;
      }),
    );
  }

  /** Gives the code box the height the stage has left, and brings the latest bug line into view. */
  private layout(code: CodeView): void {
    const narrow = this.w < NARROW;
    const fonts = this.measure.fonts(this.mode);
    const cellFs = this.measure.fontPx('pattern-cell', 12);
    const lh = cellFs * CODE_LINE;
    const padV = narrow ? CODE_PAD_V_NARROW : CODE_PAD_V;
    const inner = Math.max(240, this.w - (narrow ? 8 : 24));
    const sideW = narrow ? inner : Math.floor(inner * 0.34);
    // the side block: the tip wrapped at its width, the links on one line each when narrow
    const tipLines = Math.max(1, this.measure.wrap(`İpucu: ${code.tip}`, sideW - 8, 'tick', fonts.tick).length);
    const linkLines = narrow ? 1 : code.links.length;
    const sideH = Math.ceil(tipLines * fonts.tick * 1.35 + CODE_GAP + linkLines * fonts.tick * 1.6);
    const lines = code.fixed ? code.fixedLines.length : code.faulty.length;
    const natural = Math.ceil(lines * lh + PRE_PAD + (code.fixed ? 0 : code.marked * lh));
    const chrome = PANEL_CHROME + Math.ceil(fonts.axis * 1.4);
    const room = this.h - padV - chrome - (narrow ? sideH + CODE_GAP : 0);
    const preH = Math.max(Math.ceil(MIN_LINES * lh + PRE_PAD), Math.min(natural, Math.floor(room)));
    const pre = this.panel.root.querySelector<HTMLElement>('.code-pre')!;
    pre.style.maxHeight = `${preH}px`;
    this.root.dataset.used = String(Math.ceil(padV + chrome + preH + (narrow ? sideH + CODE_GAP : 0)));
    // keep the latest bug line in view inside the box
    const current = pre.querySelector<HTMLElement>('.is-current');
    pre.scrollTop = current ? Math.max(0, current.offsetTop - Math.floor(preH / 2)) : 0;
  }
}
