import { CodePanel } from '../../core/plot/code-panel';
import { el, type ViewScene } from './scene-base';
import type { KaymaView } from './view';

const LINKS = [
  { href: '../crisp-dm/', text: 'CRISP-DM döngüsü (Bölüm 1, yaygınlaştırma)' },
  { href: '../shap-degerleri/', text: 'SHAP değerleri (Bölüm 13)' },
];

/**
 * Step 10: the book's `HataAyiklama` code in a `CodePanel` (the bugs flagged up to the sweep position, or the
 * corrected code), the error the faulty program stops with (`.code-error`), the corrected output (`.code-output`) and
 * the links the lesson ends with.
 */
export class CodeScene implements ViewScene {
  private readonly root: HTMLDivElement;
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

  resize(): void {}

  interrupt(): void {}

  destroy(): void {
    this.panel.destroy();
    this.root.remove();
  }

  update(v: KaymaView): void {
    const c = v.code;
    if (!c) {
      return;
    }
    this.panel.update({ faulty: c.faulty, fixedLines: c.fixedLines, bugs: c.bugs, marked: c.marked, fixed: c.fixed });
    const doc = this.root.ownerDocument;
    if (c.output) {
      const output = el(doc, 'div', 'code-output');
      output.append(...c.output.map((l) => el(doc, 'div', 'output-line', l)));
      this.extra.replaceChildren(output);
    } else if (c.error) {
      const err = el(doc, 'div', 'code-error');
      err.append(el(doc, 'div', 'error-text', c.error), el(doc, 'div', 'error-note', '⏹ çalışma burada durur'));
      this.extra.replaceChildren(err);
    } else {
      this.extra.replaceChildren();
    }
  }
}
