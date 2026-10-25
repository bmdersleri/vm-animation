import { select, type Selection } from 'd3-selection';
import type { Mode } from '../../core/mode';
import { TextMeasure } from '../../core/plot/text-measure';
import type { KaymaView } from './view';

/** Below this width (px) the stage is one column. */
export const NARROW = 900;
/** Below this stage width (px) the stage is tall: it grows to its content and the page scrolls. */
export const TALL = 600;
/** The height budget (px) a scene gets in a tall stage, where the area's own height means nothing. */
export const TALL_BUDGET = 460;

/** The SVG namespace. */
export const NS = 'http://www.w3.org/2000/svg';

export type Svg = Selection<SVGSVGElement, unknown, null, undefined>;
export type G = Selection<SVGGElement, unknown, null, undefined>;

/** What the scene host needs from each view area. */
export interface ViewScene {
  /** `tall`: the stage grows to its content, so `h` is only a budget. */
  resize(w: number, h: number, mode: Mode, tall: boolean): void;
  update(v: KaymaView, ms: number): void;
  interrupt(): void;
  destroy(): void;
}

/** A new element with a class (and optional text). */
export function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  cls: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  e.className = cls;
  if (text !== undefined) {
    e.textContent = text;
  }
  return e;
}

/** An svg with the given class and a hidden probe text that sizes the labels (`TextMeasure`). */
export function makeSvg(doc: Document, cls: string, label: string): { svg: Svg; measure: TextMeasure } {
  const root = doc.createElementNS(NS, 'svg');
  const svg = select(root).attr('class', cls).attr('role', 'img').attr('aria-label', label);
  const probe = svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
  return { svg, measure: new TextMeasure(probe.node()!) };
}

/** A legend row: a swatch (styled by `swatch` in the page CSS) and a text per item. */
export function legend(doc: Document, cls: string, items: readonly { swatch: string; text: string }[]): HTMLElement {
  const box = el(doc, 'div', cls);
  for (const it of items) {
    const item = el(doc, 'span', 'legend-item');
    item.append(el(doc, 'span', `legend-swatch ${it.swatch}`), el(doc, 'span', 'legend-text', it.text));
    box.append(item);
  }
  return box;
}

/** Replaces the children of a legend row. */
export function setLegend(box: HTMLElement, items: readonly { swatch: string; text: string }[]): void {
  const fresh = legend(box.ownerDocument, box.className, items);
  box.replaceChildren(...fresh.childNodes);
}
