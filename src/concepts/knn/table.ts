import type { PlayerState, StepPlayer } from '../../core/player';
import { customers } from './data';
import type { KnnParams } from './scenario';
import { formatNumber } from '../../core/plot/format';
import { deriveKnnView } from './view';

const CLASS_CELL = ['<td class="cls kaldi">● Kaldı</td>', '<td class="cls ayrildi">▲ Ayrıldı</td>'] as const;

let uid = 0;

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Lab-only distance table: all customers sorted by distance to the query. */
export function mountKnnTable(host: HTMLElement, p: StepPlayer<KnnParams>): void {
  const doc = host.ownerDocument;
  const wrap = doc.createElement('div');
  wrap.className = 'knn-table';
  const caption = doc.createElement('p');
  caption.className = 'knn-table-caption';
  caption.id = `knn-table-caption-${++uid}`;
  caption.textContent = 'Yeni müşteriye uzaklıklar (küçükten büyüğe)';
  const hint = doc.createElement('p');
  hint.className = 'knn-table-hint';
  hint.textContent = 'Uzaklıklar 3. adımda hesaplanır.';
  const scroll = doc.createElement('div');
  scroll.className = 'knn-table-scroll';
  scroll.tabIndex = 0; // a scrollable region must be keyboard reachable
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-labelledby', caption.id);
  const table = doc.createElement('table');
  table.setAttribute('aria-labelledby', caption.id);
  scroll.append(table);
  wrap.append(caption, hint, scroll);
  host.append(wrap);

  let shown = '';
  const render = (s: PlayerState<KnnParams>): void => {
    const view = deriveKnnView(s.index, s.params);
    const ready = view.phase >= 2;
    hint.hidden = ready;
    scroll.hidden = !ready;
    if (!ready) return;
    const marked = view.phase >= 3;
    // Weights belong to the selected neighbours, so they appear with them (step 4).
    const weighted = marked && view.weighting === 'agirlikli';
    let html = '<thead><tr><th scope="col">#</th><th scope="col">Müşteri</th><th scope="col">Sınıf</th>'
      + `<th scope="col">Uzaklık</th>${weighted ? '<th scope="col">Ağırlık</th>' : ''}</tr></thead><tbody>`;
    view.distances.forEach((n, i) => {
      const isNeighbor = i < view.neighbors.length;
      const cls = marked ? (isNeighbor ? ' class="neighbor"' : ' class="dim"') : '';
      // Only the k neighbours vote; their weights follow the sklearn rule in view.neighbors.
      const weight = weighted
        ? `<td class="num">${isNeighbor ? formatNumber(view.neighbors[i].weight, 3) : '—'}</td>`
        : '';
      html += `<tr${cls}><td class="num">${i + 1}</td><td>${escapeHtml(customers[n.index].id)}</td>`
        + `${CLASS_CELL[n.cls]}<td class="num">${formatNumber(n.distance, 2)}</td>${weight}</tr>`;
    });
    html += '</tbody>';
    if (html !== shown) {
      table.innerHTML = html;
      shown = html;
    }
  };
  // During a drag the player notifies every pointer move: render at most once
  // per animation frame, always from the latest state, and not at all while
  // the panel is hidden (Ders mode); catch up when it is shown again.
  const hidden = (): boolean => host.closest('[hidden]') !== null;
  let dirty = true;
  let frame = false;
  const flush = (): void => {
    frame = false;
    if (!dirty || hidden()) return;
    dirty = false;
    render(p.state);
  };
  const schedule = (): void => {
    dirty = true;
    if (frame || hidden()) return;
    if (typeof requestAnimationFrame !== 'function') return flush();
    frame = true;
    requestAnimationFrame(flush);
  };
  flush();
  p.subscribe(schedule);
  // The shell toggles `hidden` on this host on a mode switch, which is not a
  // player notification.
  if (typeof MutationObserver === 'function') {
    new MutationObserver(() => { if (dirty) schedule(); })
      .observe(host, { attributes: true, attributeFilter: ['hidden'] });
  }
}
