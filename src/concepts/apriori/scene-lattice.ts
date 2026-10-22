import { LATTICE, LEVELS, type NodeState, type PaintedNode } from './view';

export interface Box {
  readonly key: string;
  readonly k: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
export interface LevelRow {
  readonly k: number;
  readonly y: number;
  readonly h: number;
}
export interface LatticeLayout {
  readonly boxes: readonly Box[];
  readonly rows: readonly LevelRow[];
  /** Height the layout needs; more than the available height when rows had to wrap (narrow screens). */
  readonly height: number;
}
export interface LayoutOptions {
  /** Width reserved at the left for the level labels. */
  labelWidth: number;
  /** Gap between neighbouring boxes. */
  gap: number;
  /** Narrowest box a row may shrink to before it wraps into more lines. */
  minWidth: number;
  maxWidth: number;
  /** Tallest and shortest box. */
  maxHeight: number;
  minHeight: number;
}

export const DEFAULT_LAYOUT: LayoutOptions = { labelWidth: 72, gap: 3, minWidth: 34, maxWidth: 120, maxHeight: 54, minHeight: 36 };

/**
 * Boxes of the 63 nodes, one row per level, each row centred. A row shrinks its boxes to fit the width
 * (never below `minWidth`); a row that cannot fit wraps into several lines, so nothing ever overlaps.
 */
export function layoutLattice(width: number, height: number, o: LayoutOptions = DEFAULT_LAYOUT): LatticeLayout {
  const avail = Math.max(o.minWidth, width - o.labelWidth);
  const byLevel = Array.from({ length: LEVELS }, (_, i) => LATTICE.filter((n) => n.k === i + 1));
  const plans = byLevel.map((nodes) => {
    const fit = Math.floor((avail - (nodes.length - 1) * o.gap) / nodes.length);
    const w = Math.max(o.minWidth, Math.min(o.maxWidth, fit));
    const perLine = Math.max(1, Math.min(nodes.length, Math.floor((avail + o.gap) / (w + o.gap))));
    return { nodes, w, perLine, lines: Math.ceil(nodes.length / perLine) };
  });
  const totalLines = plans.reduce((s, p) => s + p.lines, 0);
  const slot = Math.max(o.minHeight + o.gap, height / totalLines);
  const boxH = Math.max(o.minHeight, Math.min(o.maxHeight, Math.floor(slot - o.gap)));
  const boxes: Box[] = [];
  const rows: LevelRow[] = [];
  let line = 0;
  plans.forEach((p, i) => {
    rows.push({ k: i + 1, y: line * slot, h: p.lines * slot });
    p.nodes.forEach((node, idx) => {
      const lineNo = Math.floor(idx / p.perLine);
      const inLine = Math.min(p.perLine, p.nodes.length - lineNo * p.perLine);
      const rowW = inLine * p.w + (inLine - 1) * o.gap;
      const x = o.labelWidth + Math.floor((avail - rowW) / 2) + (idx % p.perLine) * (p.w + o.gap);
      boxes.push({ key: node.key, k: node.k, x, y: Math.round((line + lineNo) * slot + (slot - boxH) / 2), w: p.w, h: boxH });
    });
    line += p.lines;
  });
  return { boxes, rows, height: totalLines * slot };
}

export const STATE_NAME: Record<NodeState, string> = {
  unseen: 'henüz bakılmadı',
  candidate: 'sayılıyor',
  frequent: 'sık',
  infrequent: 'sık değil',
  pruned: 'budandı',
};

export interface LatticeSpec {
  painted: readonly PaintedNode[];
  width: number;
  height: number;
  /** Compact level labels ("1") instead of "seviye 1". */
  compact: boolean;
  /** Set key of the node picked in the Lab; null = none. */
  selected?: string | null;
  /** Lab only: nodes are focusable buttons. In Ders they are plain boxes, so the step keys keep working. */
  interactive?: boolean;
  options?: Partial<LayoutOptions>;
}

export interface Lattice {
  update(spec: LatticeSpec): void;
  /** Height the last layout needed. */
  readonly needed: number;
  destroy(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
const setText = (e: HTMLElement, text: string): void => {
  if (e.textContent !== text) e.textContent = text;
};

interface NodeEls {
  box: HTMLElement;
  abbr: HTMLElement;
  sub: HTMLElement;
}

/** The 63 node boxes and level labels inside `host`; created once, repositioned and repainted by `update`. */
export function mountLattice(host: HTMLElement, onPick: (key: string) => void = () => {}): Lattice {
  const root = el('div', 'ap-lattice');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Öğe kümesi kafesi');
  const labels = Array.from({ length: LEVELS }, (_, i) => {
    const l = el('div', 'ap-level');
    l.dataset.level = String(i + 1);
    return l;
  });
  const nodes = new Map<string, NodeEls>();
  for (const n of LATTICE) {
    const box = el('div', 'ap-node');
    box.dataset.key = n.key;
    box.dataset.abbr = n.abbr;
    box.dataset.level = String(n.k);
    const abbr = el('span', 'ap-abbr', n.abbr);
    const sub = el('span', 'ap-sub');
    box.append(abbr, sub);
    nodes.set(n.key, { box, abbr, sub });
  }
  root.append(...labels, ...[...nodes.values()].map((e) => e.box));
  host.append(root);

  let interactive = false;
  let rover: string = LATTICE[0].key;
  const boxOf = (target: EventTarget | null): HTMLElement | null => (target instanceof Element ? target.closest<HTMLElement>('.ap-node') : null);
  const focusNode = (key: string): void => {
    rover = key;
    for (const [k, e] of nodes) e.box.tabIndex = k === key ? 0 : -1;
    nodes.get(key)?.box.focus();
  };
  root.addEventListener('click', (e) => {
    const b = boxOf(e.target);
    if (interactive && b?.dataset.key) onPick(b.dataset.key);
  });
  root.addEventListener('focusin', (e) => {
    const b = boxOf(e.target);
    if (interactive && b?.dataset.key) rover = b.dataset.key;
    if (interactive) for (const [k, n] of nodes) n.box.tabIndex = k === rover ? 0 : -1;
  });
  root.addEventListener('keydown', (e) => {
    const b = boxOf(e.target);
    if (!interactive || !b?.dataset.key) return;
    const k = Number(b.dataset.level);
    const row = LATTICE.filter((n) => n.k === k);
    const at = row.findIndex((n) => n.key === b.dataset.key);
    // The page's step keys (arrows, Space) must not also fire while a node is focused.
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      onPick(b.dataset.key);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      const to = row[Math.max(0, Math.min(row.length - 1, at + (e.key === 'ArrowRight' ? 1 : -1)))];
      focusNode(to.key);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      const other = LATTICE.filter((n) => n.k === k + (e.key === 'ArrowDown' ? 1 : -1));
      if (other.length === 0) return;
      const idx = row.length > 1 ? Math.round((at * (other.length - 1)) / (row.length - 1)) : Math.floor((other.length - 1) / 2);
      focusNode(other[idx].key);
    }
  });
  let needed = 0;

  return {
    update(spec: LatticeSpec): void {
      const opts: LayoutOptions = { ...DEFAULT_LAYOUT, labelWidth: spec.compact ? 20 : DEFAULT_LAYOUT.labelWidth, ...spec.options };
      interactive = spec.interactive === true;
      if (!interactive && root.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      const layout = layoutLattice(spec.width, spec.height, opts);
      needed = layout.height;
      root.style.height = `${Math.round(layout.height)}px`;
      for (const r of layout.rows) {
        const l = labels[r.k - 1];
        l.style.top = `${Math.round(r.y)}px`;
        l.style.height = `${Math.round(r.h)}px`;
        l.style.width = `${opts.labelWidth}px`;
        setText(l, spec.compact ? String(r.k) : `seviye ${r.k}`);
      }
      const at = new Map(layout.boxes.map((b) => [b.key, b]));
      for (const p of spec.painted) {
        const e = nodes.get(p.node.key) as NodeEls;
        const b = at.get(p.node.key) as Box;
        const s = e.box.style;
        s.left = `${b.x}px`;
        s.top = `${b.y}px`;
        s.width = `${b.w}px`;
        s.height = `${b.h}px`;
        e.box.dataset.state = p.state;
        if (p.prunedBy) e.box.dataset.prunedBy = p.prunedBy;
        else delete e.box.dataset.prunedBy;
        e.box.dataset.count = p.count === null ? '' : String(p.count);
        setText(e.sub, p.count !== null ? String(p.count) : p.prunedBy ? `⊘${p.prunedBy}` : p.state === 'candidate' ? '…' : '');
        e.box.title = `${p.node.abbr}: ${STATE_NAME[p.state]}`;
        e.box.setAttribute('aria-label', `${p.node.abbr}: ${STATE_NAME[p.state]}${p.count !== null ? `, ${p.count} fiş` : ''}`);
        const on = interactive && spec.selected === p.node.key;
        if (on) e.box.dataset.selected = 'true';
        else delete e.box.dataset.selected;
        if (interactive) {
          e.box.setAttribute('role', 'button');
          e.box.setAttribute('aria-pressed', String(on));
          e.box.tabIndex = p.node.key === rover ? 0 : -1;
        } else {
          e.box.removeAttribute('role');
          e.box.removeAttribute('aria-pressed');
          e.box.removeAttribute('tabindex');
        }
      }
    },
    get needed(): number {
      return needed;
    },
    destroy(): void {
      root.remove();
    },
  };
}
