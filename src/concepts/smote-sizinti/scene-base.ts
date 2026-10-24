import { select, type Selection } from 'd3-selection';
import 'd3-transition';
import type { Mode } from '../../core/mode';
import { TextMeasure } from '../../core/plot/text-measure';
import type { LeakView } from './view';

/** The SVG namespace. */
export const NS = 'http://www.w3.org/2000/svg';

/** A `g` element selection. */
export type G = Selection<SVGGElement, unknown, null, undefined>;

/** Outer padding (px) around a drawing. */
export const PAD = 8;

/** What the scene host needs from each view area. */
export interface ViewScene {
  resize(w: number, h: number, mode: Mode): void;
  update(v: LeakView, ms: number): void;
  interrupt(): void;
  destroy(): void;
}

/** Creates the page's SVG inside `host`, with the hidden probe text the measurer reads. */
export function mountSvg(host: HTMLElement, label: string): {
  svg: Selection<SVGSVGElement, unknown, null, undefined>;
  measure: TextMeasure;
} {
  const root = host.ownerDocument.createElementNS(NS, 'svg');
  host.append(root);
  const svg = select(root).attr('class', 'leak-plot').attr('role', 'img').attr('aria-label', label);
  const probe = svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
  return { svg, measure: new TextMeasure(probe.node()!) };
}
