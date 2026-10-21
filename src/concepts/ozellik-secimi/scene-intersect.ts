import type { SecimView } from './view';

const RULE = 'PCA sıkıştırır, özellik seçimi eler, t-SNE yalnızca gösterir. Seçim de yalnızca eğitim verisiyle fit edilir.';

/**
 * The last page: the columns SelectKBest and RFE each picked on the sides, the
 * ones both picked in the middle, and the chapter rule below. HTML lists, so
 * the text wraps and scales with the page; hidden on every other step.
 */
export class IntersectLayer {
  private readonly root: HTMLDivElement;
  private readonly kbestTitle: HTMLElement;
  private readonly rfeTitle: HTMLElement;
  private readonly lists: { kbest: HTMLUListElement; both: HTMLUListElement; rfe: HTMLUListElement };

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement): HTMLElementTagNameMap[K] => {
      const e = doc.createElement(tag);
      e.className = cls;
      parent.append(e);
      return e;
    };
    this.root = make('div', 'intersect', host);
    this.root.hidden = true;
    const columns = make('div', 'sel-columns', this.root);
    const section = (cls: string, list: string): { h3: HTMLElement; ul: HTMLUListElement } => {
      const s = make('section', cls, columns);
      return { h3: make('h3', '', s), ul: make('ul', list, s) };
    };
    const kbest = section('sel-kbest', 'kbest');
    const both = section('sel-both', 'both');
    const rfe = section('sel-rfe', 'rfe');
    both.h3.textContent = 'ortak';
    this.kbestTitle = kbest.h3;
    this.rfeTitle = rfe.h3;
    this.lists = { kbest: kbest.ul, both: both.ul, rfe: rfe.ul };
    make('p', 'rule', this.root).textContent = RULE;
  }

  update(v: SecimView): void {
    const x = v.intersect;
    this.root.hidden = x === null;
    if (!x) return;
    this.kbestTitle.textContent = x.kbestTitle;
    this.rfeTitle.textContent = x.rfeTitle;
    const doc = this.root.ownerDocument;
    for (const key of ['kbest', 'both', 'rfe'] as const) {
      this.lists[key].replaceChildren(...x[key].map((name) => {
        const li = doc.createElement('li');
        li.textContent = name;
        return li;
      }));
    }
  }

  destroy(): void {
    this.root.remove();
  }
}
