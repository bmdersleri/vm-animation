import { FEATURES } from '../xai/data';
import { el } from './scene-base';
import type { LatticeView } from './view';

/**
 * The ordering table of step 5: one `.order-row` per ordering (the order, then the marginal contribution of each
 * feature in feature order) and the `.order-mean` row under it, whose cells are the Shapley values. Rows the sweep
 * has not reached are `.is-empty` and blank.
 */
export class OrdersTable {
  readonly root: HTMLDivElement;
  private readonly table: HTMLTableElement;
  private readonly body: HTMLTableSectionElement;
  private readonly foot: HTMLTableSectionElement;

  constructor(doc: Document) {
    this.root = el(doc, 'div', 'orders-wrap');
    this.table = el(doc, 'table', 'order-table');
    const head = this.table.createTHead().insertRow();
    head.append(el(doc, 'th', 'order-head', 'sıralama'));
    for (const name of FEATURES) {
      const th = el(doc, 'th', 'order-head');
      th.append(el(doc, 'code', 'feature-name', name));
      head.append(th);
    }
    this.body = this.table.createTBody();
    this.foot = this.table.createTFoot();
    this.root.append(this.table);
  }

  update(v: LatticeView): void {
    const doc = this.root.ownerDocument;
    const orders = v.orders ?? [];
    this.body.replaceChildren(
      ...orders.map((o) => {
        const tr = el(doc, 'tr', `order-row${o.filled ? '' : ' is-empty'}`);
        tr.dataset.order = String(o.index);
        tr.append(el(doc, 'th', 'order-name', o.text));
        o.marginals.forEach((m, i) => {
          const td = el(doc, 'td', 'order-cell', o.filled ? m : '');
          td.dataset.feature = String(i);
          tr.append(td);
        });
        return tr;
      }),
    );
    const mean = el(doc, 'tr', 'order-means');
    mean.append(el(doc, 'th', 'order-name', 'ortalama (φ)'));
    (v.means ?? []).forEach((m, i) => {
      const td = el(doc, 'td', 'order-mean', m);
      td.dataset.feature = String(i);
      mean.append(td);
    });
    this.foot.replaceChildren(mean);
  }

  destroy(): void {
    this.root.remove();
  }
}
