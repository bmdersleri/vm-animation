import { select, type Selection } from 'd3-selection';
import type { Mode } from '../../core/mode';
import { HBarsLayer, type HBar } from '../../core/plot/hbars';
import { formatNumber as f, formatPercent } from '../../core/plot/format';
import { TextMeasure } from '../../core/plot/text-measure';
import { META } from './data';
import { el, NS } from './scene-base';
import type { GroupsCard, ResultColumn, ResultsCard } from './view';

/** The two group means as `HBarsLayer` bars (`.group-bar[data-group]`), the order rule and the orders of each group. */
export class GroupsPlot {
  readonly root: HTMLDivElement;
  private readonly svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly layer: HBarsLayer;
  private readonly measure: TextMeasure;
  private readonly rule: HTMLElement;
  private readonly orders: HTMLElement;
  private w = 300;
  private mode: Mode = 'ders';

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = el(doc, 'div', 'groups-card');
    const root = doc.createElementNS(NS, 'svg');
    this.svg = select(root).attr('class', 'group-plot').attr('role', 'img').attr('aria-label', 'Grup ortalamaları: normal gün ve sınav haftası');
    const probe = this.svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
    this.measure = new TextMeasure(probe.node()!);
    this.layer = new HBarsLayer(this.svg.append('g').attr('class', 'group-bars'), this.measure);
    this.rule = el(doc, 'p', 'order-rule');
    this.orders = el(doc, 'p', 'order-values');
    this.root.append(root, this.rule, this.orders);
    host.append(this.root);
  }

  resize(w: number, mode: Mode): void {
    this.w = Math.max(120, Math.floor(w));
    this.mode = mode;
  }

  interrupt(): void {
    this.svg.selectAll('*').interrupt('bars');
  }

  update(c: GroupsCard, ms: number): void {
    const tick = this.measure.fonts(this.mode).tick;
    const height = Math.ceil(tick * 2 * 2.6 + 12);
    this.svg.attr('width', this.w).attr('height', height);
    const data: HBar[] = c.bars.map((b, i) => ({
      id: b.id,
      row: i,
      slot: 0,
      cls: `bar-${b.id}${b.value === null ? ' is-empty' : ''}`,
      value: b.value ?? 0,
      text: b.text,
      label: b.label,
      attrs: { group: b.id },
    }));
    this.layer.draw(data, { rect: { x: 0, y: 0, w: this.w, h: height }, tick, rows: 2, slots: 1, max: c.max, itemCls: 'group-bar', valueSample: '00,00', ms });
    this.rule.textContent = `sipariş = ${f(META.margin, 2)} × grup ortalaması`;
    this.orders.textContent = c.rule;
  }

  destroy(): void {
    this.interrupt();
    this.root.remove();
  }
}

const mark = (ok: boolean): string => (ok ? '✓' : '✗');

function condition(doc: Document, kind: 'waste' | 'service', ok: boolean): HTMLElement {
  const text = kind === 'waste'
    ? `israf düşüşü en az ${formatPercent(META.criteria.waste, 0)}`
    : `kaçan talep en çok ${formatPercent(META.criteria.service, 0)}`;
  const c = el(doc, 'p', 'cond');
  c.dataset.cond = kind;
  c.dataset.ok = String(ok);
  c.append(el(doc, 'span', 'cond-mark', mark(ok)), el(doc, 'span', 'cond-text', ` ${text}: ${ok ? 'tutar' : 'tutmaz'}`));
  return c;
}

function column(doc: Document, c: ResultColumn): HTMLElement {
  const col = el(doc, 'div', 'result-col');
  col.dataset.col = c.id;
  col.append(el(doc, 'p', 'col-title', c.title));
  const rows: [string, string][] = [['israf oranı', c.wasteRate], ['kaçan talep', c.lostShare]];
  if (c.reduction !== null) {
    rows.push(['israf düşüşü', c.reduction]);
  }
  for (const [label, value] of rows) {
    const row = el(doc, 'p', 'col-row');
    row.append(el(doc, 'span', 'col-label', label), el(doc, 'span', 'col-value', value));
    col.append(row);
  }
  if (c.wasteOk !== null && c.serviceOk !== null) {
    col.append(condition(doc, 'waste', c.wasteOk), condition(doc, 'service', c.serviceOk));
  }
  return col;
}

/**
 * The result board: baseline, evaluation and (when shown) deployment columns with the two conditions as ✓ / ✗ and
 * "tutar" / "tutmaz"; `hypothetical` fades it (`.is-hypothetical`, the view's title says "yine de denenseydi").
 * The deployment rule and the link to the model drift page follow it on the deployment step.
 */
export function resultsCard(doc: Document, c: ResultsCard, hypothetical: boolean, driftLink: boolean): HTMLElement {
  const board = el(doc, 'div', `result-board${hypothetical ? ' is-hypothetical' : ''}`);
  board.append(el(doc, 'p', 'result-title', c.title));
  const cols = el(doc, 'div', 'result-cols');
  for (const col of c.columns) {
    cols.append(column(doc, col));
  }
  board.append(cols);
  if (c.note) {
    board.append(el(doc, 'p', 'result-note', c.note));
  }
  if (c.rule) {
    const rule = el(doc, 'p', 'deploy-rule', `${c.rule}. `);
    if (driftLink) {
      const a = doc.createElement('a');
      a.className = 'card-link';
      a.setAttribute('href', '../model-kaymasi/');
      a.textContent = 'Model kayması (Bölüm 14)';
      rule.append(a);
    }
    board.append(rule);
  }
  return board;
}
