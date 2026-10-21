import type { StepPlayer } from '../../core/player';
import type { Mode } from '../../core/mode';
import type { SceneHandle } from '../../core/shell';
import { allNegative, cost, metrics, type Confusion } from '../degerlendirme/metrics';
import type { MatrixParams } from './scenario';
import { html, number, percent, svg } from './ui';

type Cell = keyof Confusion;
const KEYS: Cell[] = ['tn', 'fp', 'fn', 'tp'];
const LABELS: Record<Cell, string> = { tn: 'TN · Doğru kaldı', fp: 'FP · Gereksiz teklif', fn: 'FN · Kaçırılan', tp: 'TP · Doğru ayrıldı' };
const HIGHLIGHTS: Cell[][] = [[], [], ['tn', 'tp'], ['fp', 'tp'], ['fn', 'tp'], ['fp', 'fn', 'tp'], ['fn'], ['fp', 'fn']];
const METRICS = ['accuracy', 'precision', 'recall', 'f1'] as const;
const NAMES = ['Accuracy', 'Precision', 'Recall', 'F1'];
/** Customer marks: 14 px rings, 15 px apart in a row; rows at least one ring (14 px) apart. */
const MARK_STEP = 15, RING = 14;
/** The first row is 47 px below the cell top, the last at most 9 px above its bottom. */
const ROW_SPAN = (ch: number): number => ch - 56;
function cellGrid(cw: number, ch: number): { cols: number; rows: number } {
  return { cols: Math.max(1, Math.floor((cw - 30) / MARK_STEP)), rows: ROW_SPAN(ch) < 0 ? 0 : Math.floor(ROW_SPAN(ch) / RING) + 1 };
}
interface Customer { id: string; actual: 0 | 1; predicted: 0 | 1; cell: Cell; }
function customers(source: Confusion, dummy: boolean): Customer[] {
  const result: Customer[] = [];
  for (const actual of [0, 1] as const) {
    const n = actual === 0 ? source.tn + source.fp : source.fn + source.tp;
    for (let i = 0; i < n; i++) {
      const predicted = dummy ? 0 : Number(i >= (actual === 0 ? source.tn : source.fn)) as 0 | 1;
      result.push({ id: `${actual ? 'P' : 'N'}${i + 1}`, actual, predicted, cell: actual ? (predicted ? 'tp' : 'fn') : (predicted ? 'fp' : 'tn') });
    }
  }
  return result;
}
function liveFormula(index: number, c: Confusion): string {
  const m = metrics(c);
  const total = c.tn + c.fp + c.fn + c.tp;
  if (index === 2) return `Accuracy = (TN + TP) / N = (${c.tn} + ${c.tp}) / ${total} = ${percent(m.accuracy)}`;
  if (index === 3) return `Precision = TP / (TP + FP) = ${c.tp} / (${c.tp} + ${c.fp}) = ${percent(m.precision)}`;
  if (index === 4) return `Recall = TP / (TP + FN) = ${c.tp} / (${c.tp} + ${c.fn}) = ${percent(m.recall)}`;
  if (index === 5) return `F1 = 2TP / (2TP + FP + FN) = ${2 * c.tp} / (${2 * c.tp} + ${c.fp} + ${c.fn}) = ${percent(m.f1)}`;
  return '';
}

export function mountMatrixScene(host: HTMLElement, player: StepPlayer<MatrixParams>, initialMode: Mode): SceneHandle {
  let mode = initialMode;
  let width = 1100, height = 540;
  let destroyed = false;
  const legend = html('div', { class: 'matrix-key' },
    html('strong', {}, '◆ Pozitif: Ayrılan müşteri (churn=1)'),
    html('span', {}, '● Kaldı (0) · İç şekil: gerçek · Dış çerçeve: tahmin'));
  const cohort = html('p', { class: 'matrix-cohort' });
  const plot = svg('svg', { class: 'matrix-plot', role: 'img', 'aria-label': 'Gerçek sınıf satırda, tahmin sütunda; müşteri sonuçları' });
  const matrix = svg('g', { class: 'matrix-cells' });
  const cellNodes = new Map<Cell, { group: SVGGElement; rect: SVGRectElement; label: SVGTextElement; count: SVGTextElement }>();
  for (const key of KEYS) {
    const group = svg('g', { 'data-cell': key });
    const rect = svg('rect', { rx: '8', class: 'matrix-cell-bg' });
    const label = svg('text', { class: 'matrix-cell-label' }, LABELS[key]);
    const count = svg('text', { class: 'matrix-count', 'text-anchor': 'end' });
    group.append(rect, label, count); matrix.append(group);
    cellNodes.set(key, { group, rect, label, count });
  }
  const axes = svg('g', { class: 'matrix-axes' });
  const axesNodes = [
    svg('text', { class: 'matrix-axis', 'text-anchor': 'middle' }, 'Tahmin'),
    svg('text', { class: 'matrix-axis', 'text-anchor': 'middle' }, 'Kaldı (0)'),
    svg('text', { class: 'matrix-axis', 'text-anchor': 'middle' }, 'Ayrıldı (1)'),
    svg('text', { class: 'matrix-axis' }, 'Gerçek'),
    svg('text', { class: 'matrix-axis' }, 'Kaldı (0)'),
    svg('text', { class: 'matrix-axis' }, 'Ayrıldı (1)'),
  ];
  axes.append(...axesNodes);
  const marks = svg('g', { class: 'matrix-customers', 'aria-hidden': 'true' });
  plot.append(matrix, axes, marks);
  const markNodes = new Map<string, SVGGElement>();
  const formula = html('p', { class: 'matrix-formula', 'aria-live': 'polite' });
  const statValues = METRICS.map((key, i) => html('div', { 'data-metric': key }, html('span', {}, NAMES[i]), html('strong')));
  const stats = html('div', { class: 'matrix-metrics' }, ...statValues);
  const comparison = html('div', { class: 'matrix-comparison' });
  const costs = html('div', { class: 'matrix-costs' });
  const sourceCost = html('p', { 'data-cost': 'model' });
  const dummyCost = html('p', { 'data-cost': 'dummy' });
  costs.append(sourceCost, dummyCost);
  const note = html('p', { class: 'matrix-note', role: 'status' });
  const summary = html('p', { class: 'matrix-sr-summary' });
  const footer = html('div', { class: 'matrix-footer' }, formula, stats, comparison, costs, note, summary);
  const root = html('div', { class: 'matrix-scene' }, legend, cohort, plot, footer);
  host.append(root);

  const render = (): void => {
    if (destroyed) return;
    const { index, params: p } = player.state;
    const source: Confusion = { tn: p.tn, fp: p.fp, fn: p.fn, tp: p.tp };
    const dummy = allNegative(source);
    const c = p.model === 'dummy' ? dummy : source;
    const total = c.tn + c.fp + c.fn + c.tp;
    const m = metrics(c);
    root.dataset.step = String(index);
    root.dataset.activeMetric = index >= 2 && index <= 5 ? METRICS[index - 2] : '';
    cohort.textContent = index === 0
      ? `Gerçek: ${c.tn + c.fp} kaldı, ${c.fn + c.tp} ayrıldı. Tahmin: ${c.tn + c.fn} kalır, ${c.fp + c.tp} ayrılır.`
      : `${total} müşteri · ${p.model === 'dummy' ? 'Herkese kalır' : 'Kaynak model'} · Satır: gerçek / Sütun: tahmin`;
    formula.hidden = index < 2 || index > 5;
    formula.textContent = liveFormula(index, c);
    stats.hidden = index < 2 || index === 7;
    for (const [i, key] of METRICS.entries()) {
      statValues[i].querySelector('strong')!.textContent = percent(m[key]);
      statValues[i].toggleAttribute('data-selected', index === i + 2);
    }
    comparison.hidden = index !== 6;
    const sm = metrics(source), dm = metrics(dummy);
    comparison.textContent = `Aynı grup: kaynak accuracy ${percent(sm.accuracy)}, recall ${percent(sm.recall)}; herkese kalır accuracy ${percent(dm.accuracy)}, recall ${percent(dm.recall)}.`;
    costs.hidden = index !== 7;
    sourceCost.textContent = `Kaynak model: ${cCost(source, p)} = ${number(cost(source, p.fpCost, p.fnCost))}`;
    dummyCost.textContent = `Herkese kalır: ${cCost(dummy, p)} = ${number(cost(dummy, p.fpCost, p.fnCost))}`;
    const stepNote = index === 0 ? 'Her işaret bir müşteri. Turuncu elmas ayrılanı, turkuaz daire kalanı gösterir.'
      : index === 1 ? 'TN ve TP doğru; FP ve FN hata. Müşteri kimlikleri korunur.'
      : index === 3 ? 'Pozitif tahmin sütunu: teklif verdiklerimizin içindeki doğru tahminler.'
      : index === 4 ? 'Gerçek pozitif satırı: ayrılanların içindeki yakaladıklarımız.'
      : index === 5 ? 'F1 harmonik ortalamadır; precision ve recall’un aritmetik ortalaması değildir.'
      : index === 6 ? `${dummy.fn} ayrılanın hiçbiri yakalanmıyor. Yüksek accuracy tek başına yeterli değil.`
      : index === 7 ? 'Maliyet = FP × birim maliyet + FN × birim maliyet. Tercih iş hedefine bağlıdır.'
      : 'Doğru hücreler: TN + TP. Payda bütün müşterilerdir.';
    note.textContent = total === 0 ? 'Müşteri yok. Paydası sıfır olan oranlar tanımsızdır.'
      : total > 100 ? `Toplu gösterim: ${total} müşteri; her hücrede tam sayım gösterilir.`
      : stepNote;
    summary.textContent = `Gerçek satırlar, tahmin sütunlar: TN ${c.tn}, FP ${c.fp}, FN ${c.fn}, TP ${c.tp}. ${total} müşteri.`;

    // Use measured pixels so SVG text retains the shared projector font sizes; measure after the footer text is set.
    const measure = () => {
      const w = plot.clientWidth || Math.max(280, width - 24);
      const h = plot.clientHeight || Math.max(160, height - (index >= 6 ? 245 : index >= 2 ? 220 : 160));
      const cw = (w - left - 12 - gap) / 2, ch = (h - top - 10 - gap) / 2;
      const grid = cellGrid(cw, ch);
      // One mark per customer only while every cell holds its marks without overlap; otherwise counts only.
      return { w, h, cw, ch, grid, aggregate: total > 100 || (index > 0 && KEYS.some(key => c[key] > grid.cols * grid.rows)) };
    };
    const left = mode === 'ders' ? 132 : 104;
    const top = mode === 'ders' ? 64 : 54;
    const gap = 10;
    let layout = measure();
    if (layout.aggregate && total > 0 && total <= 100) {
      note.textContent = `Dar görünüm: işaretler sığmadığı için her hücrede tam sayım gösterilir. ${stepNote}`;
      layout = { ...measure(), aggregate: true };
    }
    const { w, h, cw, ch, grid, aggregate } = layout;
    root.dataset.aggregate = String(aggregate);
    plot.setAttribute('viewBox', `0 0 ${w} ${h}`);

    matrix.style.visibility = axes.style.visibility = index === 0 ? 'hidden' : 'visible';
    const positions = new Map<Cell, { x: number; y: number }>();
    KEYS.forEach((key, i) => {
      const x = left + (i % 2) * (cw + gap), y = top + Math.floor(i / 2) * (ch + gap);
      positions.set(key, { x, y });
      const node = cellNodes.get(key)!;
      node.group.dataset.highlight = String(HIGHLIGHTS[index].includes(key));
      for (const [attr, value] of Object.entries({ x, y, width: cw, height: ch })) node.rect.setAttribute(attr, String(value));
      node.label.textContent = w < 600 ? key.toUpperCase() : LABELS[key];
      node.label.setAttribute('x', String(x + 10)); node.label.setAttribute('y', String(y + 25));
      node.count.setAttribute('x', String(x + cw - 12)); node.count.setAttribute('y', String(y + 30));
      node.count.textContent = String(c[key]);
    });
    const ax = (i: number, x: number, y: number): void => { axesNodes[i].setAttribute('x', String(x)); axesNodes[i].setAttribute('y', String(y)); };
    ax(0, left + cw + gap / 2, 21); ax(1, left + cw / 2, top - 11); ax(2, left + cw * 1.5 + gap, top - 11);
    ax(3, 4, top - 11); ax(4, 4, top + ch / 2); ax(5, 4, top + ch * 1.5 + gap);

    const list = aggregate ? [] : customers(source, p.model === 'dummy');
    const keep = new Set(list.map(s => s.id));
    for (const [id, node] of markNodes) if (!keep.has(id)) { node.remove(); markNodes.delete(id); }
    const assigned: Record<Cell, number> = { tn: 0, fp: 0, fn: 0, tp: 0 };
    list.forEach((customer, i) => {
      let node = markNodes.get(customer.id);
      if (!node) {
        node = svg('g', { 'data-customer': customer.id, class: 'matrix-customer' });
        node.append(svg('title', {}, customer.id), svg('circle', { r: '7', class: 'prediction-ring' }), svg('path', { class: 'actual-shape' }));
        markNodes.set(customer.id, node); marks.append(node);
      }
      node.dataset.outcome = customer.cell;
      node.dataset.actual = String(customer.actual);
      node.dataset.predicted = String(customer.predicted);
      node.querySelector('path')!.setAttribute('d', customer.actual ? 'M0,-4 L4,0 L0,4 L-4,0 Z' : 'M-3.5,0 a3.5,3.5 0 1,0 7,0 a3.5,3.5 0 1,0 -7,0');
      let x: number, y: number;
      if (index === 0) {
        const cols = w < 600 ? 10 : 20;
        x = 20 + (i % cols) * (w - 40) / (cols - 1);
        y = 20 + Math.floor(i / cols) * (h - 40) / Math.max(1, Math.ceil(total / cols) - 1);
      } else {
        const at = positions.get(customer.cell)!;
        const n = assigned[customer.cell]++;
        const rows = Math.ceil(c[customer.cell] / grid.cols);
        x = at.x + 15 + (n % grid.cols) * MARK_STEP;
        y = at.y + 47 + Math.floor(n / grid.cols) * Math.min(16, ROW_SPAN(ch) / Math.max(1, rows - 1));
      }
      node.setAttribute('transform', `translate(${x},${y})`);
      node.style.transform = `translate(${x}px, ${y}px)`;
    });
  };
  render();
  const unsubscribe = player.subscribe(render);
  return {
    resize(w, h) { width = w; height = h; render(); },
    setMode(value) { mode = value; render(); },
    destroy() { if (destroyed) return; destroyed = true; unsubscribe(); root.remove(); markNodes.clear(); },
  };
}
function cCost(c: Confusion, p: MatrixParams): string { return `${c.fp} × ${number(p.fpCost)} + ${c.fn} × ${number(p.fnCost)}`; }
