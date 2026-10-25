import type { Mode } from '../../core/mode';
import type { ShapView } from './view';

/** Below this width (px) the page is one column: the table goes under the lattice, the bar groups stack. */
export const NARROW = 900;

/** The SVG namespace. */
export const NS = 'http://www.w3.org/2000/svg';

/** What the scene host needs from each view area. */
export interface ViewScene {
  resize(w: number, h: number, mode: Mode): void;
  update(v: ShapView, ms: number): void;
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
