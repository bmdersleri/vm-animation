import type { Mode } from '../../core/mode';
import { el, type ViewScene } from './scene-base';
import type { LimeView } from './view';

/**
 * Step 1: the four LIME steps as `.flow-box` boxes joined by `.flow-arrow`s. The arrows point right on a wide
 * stage and down on a narrow one (CSS decides); the numbers in the boxes come from the view.
 */
export class FlowScene implements ViewScene {
  private readonly root: HTMLDivElement;

  constructor(host: HTMLElement) {
    this.root = el(host.ownerDocument, 'div', 'flow-scene');
    host.append(this.root);
  }

  resize(_w: number, _h: number, _mode: Mode): void {}

  interrupt(): void {}

  destroy(): void {
    this.root.remove();
  }

  update(v: LimeView): void {
    const boxes = v.flow;
    if (!boxes) {
      return;
    }
    const doc = this.root.ownerDocument;
    const parts: HTMLElement[] = [];
    boxes.forEach((b, i) => {
      if (i > 0) {
        const arrow = el(doc, 'span', 'flow-arrow', '→');
        arrow.setAttribute('aria-hidden', 'true');
        parts.push(arrow);
      }
      const box = el(doc, 'section', 'flow-box');
      box.dataset.box = b.id;
      box.append(el(doc, 'span', 'flow-num', String(i + 1)), el(doc, 'h3', 'flow-title', b.title));
      b.lines.forEach((line) => box.append(el(doc, 'p', 'flow-line', line)));
      parts.push(box);
    });
    this.root.replaceChildren(...parts);
  }
}
