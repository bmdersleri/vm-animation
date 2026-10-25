import { CodePanel } from '../../core/plot/code-panel';
import { el } from './scene-base';
import type { CodeCard } from './view';

const LINKS = [
  { href: '../model-kaymasi/', text: 'Model kayması (Bölüm 14)' },
  { href: '../dagilim-carpiklik/', text: 'Dağılım ve çarpıklık (Bölüm 2)' },
];

/**
 * Step 10: the book's `KafeAnalizi` code in a `CodePanel` (bug badges up to the sweep position, or the corrected
 * code), the printed output and its note once corrected, and the links the lesson ends with.
 */
export class CodeSection {
  readonly root: HTMLDivElement;
  private readonly panel: CodePanel;
  private readonly extra: HTMLDivElement;

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'code-card');
    const panelHost = el(doc, 'div', 'code-host');
    this.panel = new CodePanel(panelHost);
    this.extra = el(doc, 'div', 'code-extra');
    const links = el(doc, 'div', 'code-links');
    for (const l of LINKS) {
      const a = doc.createElement('a');
      a.className = 'card-link';
      a.setAttribute('href', l.href);
      a.textContent = l.text;
      links.append(a);
    }
    this.root.append(panelHost, this.extra, links);
    host.append(this.root);
  }

  update(c: CodeCard): void {
    this.panel.update({ faulty: c.faulty, fixedLines: c.fixedLines, bugs: c.bugs, marked: c.marked, fixed: c.fixed });
    const doc = this.root.ownerDocument;
    if (!c.output) {
      this.extra.replaceChildren();
      return;
    }
    const output = el(doc, 'div', 'code-output');
    output.append(...c.output.map(l => el(doc, 'div', 'output-line', l)));
    this.extra.replaceChildren(output, el(doc, 'p', 'code-note', c.note));
  }

  destroy(): void {
    this.panel.destroy();
    this.root.remove();
  }
}
