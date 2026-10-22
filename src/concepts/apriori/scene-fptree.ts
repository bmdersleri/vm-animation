import type { Node } from '../birliktelik/fptree';
import { sepetData } from '../birliktelik/data';
import { fpGrowth } from '../birliktelik/fptree';
import { itemName, keyToSet, setAbbr } from '../birliktelik/format';
import { count } from '../birliktelik/metrics';
import { formatNumber } from '../../core/plot/format';
import { LATTICE, analyse, conditionalSummary, fpFor, itemCountText, setCountText } from './view';

const tx = sepetData.transactions;

export type FpView = 'order' | 'build' | 'base' | 'compare';

// ---- layout ----

export interface FpBox {
  readonly id: string;
  readonly item: string | null;
  readonly parent: string | null;
  readonly depth: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
export interface FpLayout {
  readonly boxes: readonly FpBox[];
  /** Width the tree needs; more than the available width means the canvas scrolls. */
  readonly width: number;
  readonly height: number;
}
export interface FpLayoutOptions {
  minSlot: number;
  maxSlot: number;
  minPitch: number;
  maxPitch: number;
  /** Space between neighbouring boxes of a row. */
  gap: number;
}
export const DEFAULT_FP_LAYOUT: FpLayoutOptions = { minSlot: 54, maxSlot: 120, minPitch: 48, maxPitch: 76, gap: 8 };

const leavesOf = (n: Node): number => (n.children.length === 0 ? 1 : n.children.reduce((s, c) => s + leavesOf(c), 0));
const depthOf = (n: Node): number => (n.children.length === 0 ? 0 : 1 + Math.max(...n.children.map(depthOf)));

/**
 * Layered layout of the finished tree: one row per depth, leaves take consecutive slots and a parent is
 * centred over its children. Two nodes of a row therefore never sit closer than one slot, so with boxes
 * narrower than a slot nothing overlaps. Partial trees (baskets inserted so far) reuse these positions.
 */
export function layoutFpTree(root: Node, width: number, height: number, o: FpLayoutOptions = DEFAULT_FP_LAYOUT): FpLayout {
  const leaves = leavesOf(root);
  const rows = depthOf(root) + 1;
  const slot = Math.max(o.minSlot, Math.min(o.maxSlot, Math.floor(width / leaves)));
  const pitch = Math.max(o.minPitch, Math.min(o.maxPitch, Math.floor(height / rows)));
  const w = slot - o.gap;
  const h = Math.max(34, pitch - 14);
  const total = leaves * slot;
  const left = Math.max(0, Math.floor((width - total) / 2));
  const boxes: FpBox[] = [];
  let next = 0;
  const place = (n: Node, depth: number, parent: string | null): number => {
    const index = boxes.length;
    boxes.push({ id: n.id, item: n.item, parent, depth, x: 0, y: depth * pitch, w, h });
    let center: number;
    if (n.children.length === 0) center = (next++ + 0.5) * slot;
    else {
      const cs = n.children.map((c) => place(c, depth + 1, n.id));
      center = (cs[0] + cs[cs.length - 1]) / 2;
    }
    boxes[index] = { ...boxes[index], x: left + Math.round(center - w / 2) };
    return center;
  };
  place(root, 0, null);
  return { boxes, width: Math.max(width, total), height: rows * pitch };
}

// ---- text parts ----

const ALL_DROPPED = '(hepsi atıldı)';
const names = (items: readonly string[], sep: string): string => items.map(itemName).join(sep);
export const BOOK_LINES = [
  'apriori(islemMatrisi, min_support=0.2, use_colnames=True)',
  'fpgrowth(islemMatrisi, min_support=0.2, use_colnames=True)',
] as const;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
const setText = (e: HTMLElement, text: string): void => {
  if (e.textContent !== text) e.textContent = text;
};
const SVG = 'http://www.w3.org/2000/svg';

function countsOf(root: Node): Map<string, number> {
  const out = new Map<string, number>();
  const walk = (n: Node): void => {
    out.set(n.id, n.count);
    n.children.forEach(walk);
  };
  walk(root);
  return out;
}

export interface FpSpec {
  view: FpView;
  minCount: number;
  /** Baskets inserted so far, 0..n (build view; the other views draw the finished tree). */
  inserted: number;
  baseItem: string | null;
  /** Size of the slot beside the aside. */
  width: number;
  height: number;
}
export interface FpScene {
  update(spec: FpSpec): void;
  /** Width/height the last layout needed. */
  readonly needed: { width: number; height: number };
  destroy(): void;
}

interface NodeEls {
  box: HTMLElement;
  name: HTMLElement;
  num: HTMLElement;
  edge: SVGLineElement | null;
}

const HEADER_WIDTH = 168;

/** FP-tree scene: header table + tree in `main`, notes and the conditional base in `side`; the comparison replaces the tree at its step. */
export function mountFpTree(main: HTMLElement, side: HTMLElement): FpScene {
  // header table
  const table = el('table', 'ap-fp-header');
  table.createCaption().textContent = 'Başlık tablosu';
  const hr = table.createTHead().insertRow();
  for (const t of ['Ürün', 'Toplam']) hr.append(el('th', '', t));
  const tbody = table.createTBody();

  // tree canvas
  const canvas = el('div', 'ap-fp-canvas');
  canvas.setAttribute('role', 'group');
  canvas.setAttribute('aria-label', 'FP-ağacı');
  const plane = el('div', 'ap-fp-plane');
  const edges = document.createElementNS(SVG, 'svg');
  edges.setAttribute('class', 'ap-fp-edges');
  edges.setAttribute('aria-hidden', 'true');
  plane.append(edges);
  canvas.append(plane);
  const tree = el('div', 'ap-fp');
  tree.append(table, canvas);

  // comparison
  const compare = el('div', 'ap-compare');
  const compareTable = el('table', 'ap-compare-table');
  const verdict = el('p', 'ap-compare-verdict');
  const lists = el('div', 'ap-compare-lists');
  compare.append(compareTable, verdict, lists);

  main.append(tree, compare);

  // aside
  const note = el('p', 'ap-fp-note');
  const countLine = el('p', 'ap-fp-count');
  const baseBox = el('div', 'ap-base');
  const code = el('div', 'ap-code');
  for (const line of BOOK_LINES) code.append(el('code', 'ap-code-line', line));
  side.append(note, countLine, baseBox, code);

  let nodes = new Map<string, NodeEls>();
  let builtFor = -1;
  let needed = { width: 0, height: 0 };

  function build(minCount: number): void {
    const t = fpFor(minCount);
    const final = t.snapshots[t.snapshots.length - 1];
    nodes = new Map();
    const els: HTMLElement[] = [];
    edges.replaceChildren();
    const walk = (n: Node): void => {
      const box = el('div', 'ap-fp-node');
      box.dataset.id = n.id;
      const name = el('span', 'ap-fp-name');
      const num = el('span', 'ap-fp-num');
      box.append(name, num);
      let edge: SVGLineElement | null = null;
      if (n.item !== null) {
        edge = document.createElementNS(SVG, 'line');
        edge.setAttribute('class', 'ap-fp-edge');
        edge.dataset.id = n.id;
        edges.append(edge);
      }
      nodes.set(n.id, { box, name, num, edge });
      els.push(box);
      n.children.forEach(walk);
    };
    walk(final);
    plane.replaceChildren(edges, ...els);
    builtFor = minCount;
  }

  function updateHeader(minCount: number, baseItem: string | null): void {
    const t = fpFor(minCount);
    const dropped = sepetData.items.filter((i) => !t.order.includes(i));
    const rows = [
      ...t.header.map((h) => ({ item: h.item, total: h.total, dropped: false })),
      ...dropped.map((i) => ({ item: i, total: count(tx, [i]), dropped: true })),
    ];
    tbody.replaceChildren(
      ...rows.map((r) => {
        const tr = tbody.insertRow();
        tr.dataset.item = r.item;
        tr.dataset.dropped = String(r.dropped);
        if (r.item === baseItem) tr.dataset.base = 'true';
        tr.append(el('th', '', itemName(r.item)), el('td', '', r.dropped ? `${r.total} (atıldı)` : String(r.total)));
        return tr;
      }),
    );
  }

  function updateTree(spec: FpSpec): void {
    const { minCount, view } = spec;
    const t = fpFor(minCount);
    if (builtFor !== minCount) build(minCount);
    const final = t.snapshots[t.snapshots.length - 1];
    const inserted = view === 'build' || view === 'order' ? Math.max(0, Math.min(t.snapshots.length - 1, spec.inserted)) : t.snapshots.length - 1;
    const counts = countsOf(t.snapshots[inserted]);
    const w = Math.max(160, spec.width - HEADER_WIDTH - 24);
    const layout = layoutFpTree(final, w, Math.max(200, spec.height - 8));
    needed = { width: layout.width, height: layout.height };
    plane.style.width = `${layout.width}px`;
    plane.style.height = `${layout.height}px`;
    edges.setAttribute('width', String(layout.width));
    edges.setAttribute('height', String(layout.height));
    canvas.style.height = `${layout.height + 12}px`;

    const hl = new Set<string>();
    if (view === 'build' && inserted >= 1) {
      let id = 'root';
      for (const item of t.filtered[inserted - 1]) hl.add((id = `${id}>${item}`));
    }
    const at = new Map(layout.boxes.map((b) => [b.id, b]));
    for (const [id, e] of nodes) {
      const b = at.get(id) as FpBox;
      const present = counts.has(id);
      const s = e.box.style;
      s.left = `${b.x}px`;
      s.top = `${b.y}px`;
      s.width = `${b.w}px`;
      s.height = `${b.h}px`;
      e.box.dataset.present = String(present);
      e.box.dataset.hl = String(hl.has(id));
      e.box.dataset.base = String(view === 'base' && b.item !== null && b.item === spec.baseItem);
      e.box.hidden = !present;
      setText(e.name, b.item === null ? '∅' : itemName(b.item));
      setText(e.num, b.item === null ? '' : `:${counts.get(id) ?? 0}`);
      if (e.edge) {
        const parent = at.get(b.parent as string) as FpBox;
        e.edge.setAttribute('x1', String(parent.x + parent.w / 2));
        e.edge.setAttribute('y1', String(parent.y + parent.h));
        e.edge.setAttribute('x2', String(b.x + b.w / 2));
        e.edge.setAttribute('y2', String(b.y));
        e.edge.dataset.hl = String(hl.has(id));
        e.edge.style.display = present ? '' : 'none';
      }
    }

    // aside notes
    const nodeCount = counts.size - 1;
    note.hidden = false;
    countLine.hidden = view !== 'build';
    if (view === 'order') {
      const lines = t.filtered.slice(0, 3).map((f, i) => `Fiş ${i + 1}: ${names(tx[i], ', ')} → ${f.length ? names(f, ' › ') : ALL_DROPPED}`);
      setText(note, [`Sıklık sırası: ${names(t.order, ' › ') || '—'}`, ...lines].join('\n'));
    } else if (view === 'build') {
      if (inserted === 0) setText(note, 'Henüz fiş eklenmedi; ağaçta yalnız kök var.');
      else {
        const f = t.filtered[inserted - 1];
        setText(note, `Fiş ${inserted}: ${names(tx[inserted - 1], ', ')} → ${f.length ? names(f, ' › ') : `${ALL_DROPPED}: fişteki ürünlerin hiçbiri eşiği geçmiyor, ağaç değişmez.`}`);
      }
      setText(countLine, `${inserted} fiş, ${nodeCount} düğüm`);
    } else setText(note, '');
    note.hidden = note.textContent === '';
    updateHeader(minCount, view === 'base' ? spec.baseItem : null);
  }

  function updateBase(spec: FpSpec): void {
    const { minCount, baseItem, view } = spec;
    baseBox.hidden = view !== 'base';
    if (view !== 'base') return;
    const t = fpFor(minCount);
    if (baseItem === null) {
      baseBox.replaceChildren(el('p', 'ap-base-none', 'Bir ürün seç.'));
      return;
    }
    if (!t.order.includes(baseItem)) {
      baseBox.replaceChildren(el('p', 'ap-base-none', `${itemName(baseItem)} bu eşikte sık değil, ağaçta yok.`));
      return;
    }
    const c = conditionalSummary(minCount, baseItem);
    const title = el('p', 'ap-base-title', `${itemName(baseItem)} için koşullu taban`);
    if (c.paths.length === 0) {
      baseBox.replaceChildren(title, el('p', 'ap-base-none', `${itemName(baseItem)} kökün hemen altında; önek yolu yok.`));
      return;
    }
    const paths = el('ul', 'ap-base-paths');
    for (const p of c.paths) paths.append(el('li', 'ap-base-path', `${names(p.path, ' › ')}: ${p.count}`));
    const local = el('p', 'ap-base-local', `Yollarda: ${c.local.map(itemCountText).join(', ')}`);
    const sets = el('ul', 'ap-base-sets');
    for (const s of c.sets) {
      const li = el('li', 'ap-base-set', setCountText(s, minCount));
      li.dataset.frequent = String(s.frequent);
      sets.append(li);
    }
    baseBox.replaceChildren(title, paths, local, sets);
  }

  let compareSig = '';
  function updateCompare(spec: FpSpec): void {
    const { minCount } = spec;
    const sig = String(minCount);
    if (sig === compareSig) return;
    compareSig = sig;
    const a = analyse(minCount).trace;
    const fp = fpGrowth(tx, minCount);
    const same = a.frequent.size === fp.size && [...fp].every(([k, v]) => a.frequent.get(k) === v);
    const rows: [string, string, string][] = [
      ['Sık küme', String(a.frequent.size), String(fp.size)],
      // FP-Growth always reads the data twice (count, then build); with no frequent item the Apriori scan count is the only one that varies.
      ['Veri tarama sayısı', String(a.levels.length), '2'],
      ['Aday üretimi', 'var', 'yok'],
      ['Süre (kitap)', `${formatNumber(0.75, 2)} ms`, `${formatNumber(0.49, 2)} ms`],
    ];
    compareTable.replaceChildren();
    const head = compareTable.createTHead().insertRow();
    for (const t of ['', 'Apriori', 'FP-Growth']) head.append(el('th', '', t));
    const body = compareTable.createTBody();
    for (const r of rows) {
      const tr = body.insertRow();
      tr.append(el('th', '', r[0]), el('td', '', r[1]), el('td', '', r[2]));
    }
    setText(verdict, same ? `Aynı ${a.frequent.size} sık küme.` : 'Sık kümeler farklı.');
    verdict.dataset.same = String(same);
    const order = new Map(LATTICE.map((n, i) => [n.key, i]));
    const listOf = (title: string, m: ReadonlyMap<string, number>): HTMLElement => {
      const box = el('div', 'ap-compare-list');
      box.append(el('h4', 'ap-compare-list-title', title));
      const ul = el('ul', 'ap-sets');
      for (const k of [...m.keys()].sort((x, y) => (order.get(x) ?? 0) - (order.get(y) ?? 0))) {
        ul.append(el('li', 'ap-set', `${setAbbr(keyToSet(k))} ${m.get(k)}`));
      }
      box.append(ul);
      return box;
    };
    lists.replaceChildren(listOf('Apriori', a.frequent), listOf('FP-Growth', fp));
  }

  return {
    update(spec: FpSpec): void {
      const cmp = spec.view === 'compare';
      tree.hidden = cmp;
      compare.hidden = !cmp;
      code.hidden = !cmp;
      if (cmp) {
        updateCompare(spec);
        note.hidden = true;
        countLine.hidden = true;
        baseBox.hidden = true;
        return;
      }
      updateTree(spec);
      updateBase(spec);
    },
    get needed(): { width: number; height: number } {
      return needed;
    },
    destroy(): void {
      tree.remove();
      compare.remove();
      side.replaceChildren();
    },
  };
}
