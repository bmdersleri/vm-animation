import type { Mode } from '../../core/mode';
import { el, type ViewScene } from './scene-base';
import type { ShapView } from './view';

/** Step 10: four limit cards (`.text-card[data-kind]`) and the closing links to the LIME and random forest pages. */
export class CardsScene implements ViewScene {
  private readonly root: HTMLDivElement;

  constructor(host: HTMLElement) {
    this.root = el(host.ownerDocument, 'div', 'cards-scene');
    host.append(this.root);
  }

  resize(_w: number, _h: number, _mode: Mode): void {}

  interrupt(): void {}

  destroy(): void {
    this.root.remove();
  }

  update(v: ShapView, _ms: number): void {
    const c = v.cards;
    if (!c) {
      return;
    }
    const doc = this.root.ownerDocument;
    const cards = el(doc, 'div', 'text-cards');
    c.cards.forEach((card, i) => {
      const section = el(doc, 'section', 'text-card');
      section.dataset.kind = card.kind;
      section.append(el(doc, 'span', 'card-letter', String.fromCharCode(97 + i)), el(doc, 'h3', 'card-title', card.title), el(doc, 'p', 'card-text', card.text));
      cards.append(section);
    });
    const links = el(doc, 'nav', 'card-links');
    for (const l of c.links) {
      const a = el(doc, 'a', 'card-link', l.text);
      a.href = l.href;
      links.append(a);
    }
    this.root.replaceChildren(cards, links);
  }
}
