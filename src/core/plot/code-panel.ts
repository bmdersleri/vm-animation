import './code-panel.css';

/** One numbered code line; `bugs` are the numbers of the bugs found on it. */
export interface CodeLine {
  text: string;
  bugs: number[];
  /** True in the corrected code for the lines that changed. */
  fix?: boolean;
}

/** A bug of a debugging exercise: its number, kind and one-line description (shown as a badge on its line). */
export interface CodeBug {
  n: number;
  kind: string;
  what: string;
}

/** What the panel shows: the faulty lines with the first `marked` bugs flagged, or the corrected lines. */
export interface CodePanelSpec {
  faulty: readonly CodeLine[];
  fixedLines: readonly CodeLine[];
  bugs: readonly CodeBug[];
  /** How many bugs are marked (the sweep position). */
  marked: number;
  /** True: the corrected code replaces the faulty one. */
  fixed: boolean;
  titles?: { faulty: string; fixed: string };
}

/**
 * A numbered code panel (`.code-scene` > `.code-title` + `pre.code-pre` of `.code-line`s). Bug lines up to
 * `marked` get `.is-bug` and a `.bug-badge` per bug (`data-bug`); the line of the latest bug is `.is-current`.
 * The corrected code has `.code-fixed` lines, the changed ones also `.is-fix`.
 */
export class CodePanel {
  readonly root: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly pre: HTMLPreElement;
  private lastKey = '';

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = doc.createElement('div');
    this.root.className = 'code-scene';
    this.title = doc.createElement('div');
    this.title.className = 'code-title';
    this.pre = doc.createElement('pre');
    this.pre.className = 'code-pre';
    this.root.append(this.title, this.pre);
    host.append(this.root);
  }

  destroy(): void {
    this.root.remove();
  }

  update(spec: CodePanelSpec): void {
    const key = `${spec.fixed}|${spec.marked}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    const doc = this.root.ownerDocument;
    const titles = spec.titles ?? { faulty: 'Hatalı kod', fixed: 'Düzeltilmiş kod' };
    this.title.textContent = spec.fixed ? titles.fixed : titles.faulty;
    this.pre.classList.toggle('code-fixed-pre', spec.fixed);
    const lines = spec.fixed ? spec.fixedLines : spec.faulty;
    this.pre.replaceChildren(
      ...lines.map((line, i) => {
        const shown = line.bugs.filter((n) => n <= spec.marked);
        const row = doc.createElement('span');
        const cls = ['code-line'];
        if (spec.fixed) {
          cls.push('code-fixed');
          if (line.fix) cls.push('is-fix');
        } else if (shown.length > 0) {
          cls.push('is-bug');
          if (shown.includes(spec.marked)) cls.push('is-current');
        }
        row.className = cls.join(' ');
        const no = doc.createElement('span');
        no.className = 'code-no';
        no.textContent = String(i + 1);
        const text = doc.createElement('span');
        text.className = 'code-text';
        text.textContent = line.text;
        row.append(no, text);
        if (!spec.fixed) {
          for (const n of shown) {
            const b = spec.bugs[n - 1];
            const badge = doc.createElement('span');
            badge.className = 'bug-badge';
            badge.dataset.bug = String(n);
            badge.textContent = `${n} · ${b.kind}: ${b.what}`;
            row.append(badge);
          }
        }
        return row;
      }),
    );
  }
}
