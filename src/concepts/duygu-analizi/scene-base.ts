import { select, type Selection } from 'd3-selection';
import type { Mode } from '../../core/mode';
import { TextMeasure } from '../../core/plot/text-measure';
import type { SentimentView } from './view';

/** The SVG namespace. */
export const NS = 'http://www.w3.org/2000/svg';

/** A `g` element selection. */
export type G = Selection<SVGGElement, unknown, null, undefined>;

/** What the scene host needs from each view area. */
export interface ViewScene {
  resize(w: number, h: number, mode: Mode): void;
  update(v: SentimentView, ms: number): void;
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
  if (text !== undefined) e.textContent = text;
  return e;
}

/** An `svg` inside `parent` with the hidden probe text the measurer reads. */
export function mountSvg(
  parent: HTMLElement,
  cls: string,
  label: string,
): { svg: Selection<SVGSVGElement, unknown, null, undefined>; measure: TextMeasure } {
  const root = parent.ownerDocument.createElementNS(NS, 'svg');
  parent.append(root);
  const svg = select(root).attr('class', cls).attr('role', 'img').attr('aria-label', label);
  const probe = svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
  return { svg, measure: new TextMeasure(probe.node()!) };
}

/** Below this stage width (px) the page is one column. */
export const NARROW = 900;
