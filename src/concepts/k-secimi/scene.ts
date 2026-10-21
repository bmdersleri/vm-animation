import { select } from 'd3-selection';
import type { ChangeCause, PlayerState, StepPlayer } from '../../core/player';
import type { Mode } from '../../core/mode';
import type { SceneHandle } from '../../core/shell';
import { AxesLayer } from '../../core/plot/axes';
import { ClusterScatterLayer, type ClusterScatterSpec } from '../../core/plot/cluster-scatter';
import { CLUSTER } from '../../core/plot/marks';
import { fitEqualAspect, type Domain, type Rect } from '../../core/plot/viewport';
import { kmeansData } from '../kmeans/data';
import { drops } from '../kmeans/geometry';
import { KLineChart } from './charts';
import { ELBOW_K, type KSecimiParams } from './scenario';
import {
  changedBetween, changedFrom, clampK, deriveKView, dropText, inertiaText, peakK, pointStats, pointText, silhouetteText, type KView,
} from './view';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DOMAIN: Domain = { x: [-2.1, 2.7], y: [-1.8, 2.0] };
const FONT_FALLBACK: Record<Mode, { tick: number; axis: number }> = { ders: { tick: 18, axis: 19 }, lab: { tick: 13, axis: 14 } };
const STEP_CHANGED = 2;
const STEP_ELBOW = 4;
const STEP_CURVE = 6;
const STEP_COMPARE = 7;
/** Silhouette steps (0-based 5..8): clicking a point picks it. */
const STEP_PICK_FIRST = 5;
const FLASH_MS = 1000;
const STEP_DECISION = 8;
const KMAX = kmeansData.ks.length;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function svgIn(parent: HTMLElement, cls: string): SVGSVGElement {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('class', cls);
  parent.append(s);
  return s;
}

/** A coloured, numbered cluster marker: colour is never the only carrier. */
function chip(c: number): HTMLSpanElement {
  const s = el('span', 'ks-chip', `M${c + 1}`);
  s.style.setProperty('--chip', CLUSTER[c % CLUSTER.length]);
  return s;
}

function row(label: string, value: string, attrs: Record<string, string> = {}): HTMLElement {
  const d = el('div', 'ks-row');
  const v = el('strong', 'ks-value', value);
  for (const [k, val] of Object.entries(attrs)) v.setAttribute(k, val);
  d.append(el('span', 'ks-label', label), v);
  return d;
}

function sizeList(sizes: readonly number[]): HTMLElement {
  const ul = el('ul', 'ks-sizes');
  sizes.forEach((n, c) => {
    const li = el('li', 'ks-size');
    li.setAttribute('data-size', String(n));
    li.append(chip(c), el('strong', 'ks-size-n', String(n)));
    ul.append(li);
  });
  return ul;
}

export function mountKSecimiScene(host: HTMLElement, player: StepPlayer<KSecimiParams>, initialMode: Mode): SceneHandle {
  let mode = initialMode;
  const root = el('div', 'ks-scene');
  root.dataset.mode = mode;
  const plotHost = el('div', 'ks-plot-host');
  const svgEl = svgIn(plotHost, 'ks-plot');
  svgEl.setAttribute('role', 'img');
  svgEl.setAttribute('aria-label', `k-means saçılım grafiği: ${kmeansData.points.length} çiçek, k kadar küme merkezi`);
  const side = el('div', 'ks-side');
  const card = (title: string, cls: string): { host: HTMLElement; svg: SVGSVGElement } => {
    const sec = el('section', 'ks-chart');
    sec.append(el('h3', 'ks-chart-title', title));
    const h = el('div', 'ks-chart-host');
    sec.append(h);
    side.append(sec);
    return { host: h, svg: svgIn(h, cls) };
  };
  const elCard = card('Dirsek · inertia (küme içi kareler toplamı)', 'ks-chart-svg kc-chart-el');
  const silCard = card('Silhouette · ayrışma netliği', 'ks-chart-svg kc-chart-sil');
  const panel = el('aside', 'ks-panel');
  panel.setAttribute('aria-live', 'polite');
  side.append(panel);
  root.append(plotHost, side);
  host.append(root);

  const svg = select(svgEl);
  const axes = new AxesLayer(svg.append('g').attr('class', 'axes') as never);
  const layer = new ClusterScatterLayer(svg.append('g').attr('class', 'ks-marks').node() as SVGGElement, DOMAIN);
  const probe = svg.append('text').attr('class', 'ks-probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');

  const ks = kmeansData.ks.map((r) => r.k);
  const elChart = new KLineChart(select(elCard.svg).append('g').node() as SVGGElement, {
    ks, values: kmeansData.ks.map((r) => r.inertia), label: 'Dirsek grafiği: k ve inertia', yDomain: [0, 330],
  });
  const silChart = new KLineChart(select(silCard.svg).append('g').node() as SVGGElement, {
    ks, values: kmeansData.ks.map((r) => r.silhouette), label: 'Silhouette grafiği: k ve ortalama silhouette', yDomain: [0.4, 0.7],
  });
  const peak = peakK();

  let size: { w: number; h: number } | null = null;
  let rendered = false;
  let destroyed = false;
  let lastPlot = '';
  let lastCharts = '';
  /** Points that changed number on the last slider move; shown for FLASH_MS. */
  let flash: number[] | null = null;
  let flashTimer: ReturnType<typeof setTimeout> | null = null;
  let shownK: number | null = null;

  const fonts = (): { tick: number; axis: number } => {
    const fb = FONT_FALLBACK[mode];
    const px = parseFloat(getComputedStyle(probe.node() as Element).fontSize);
    const axisPx = parseFloat(getComputedStyle(svgEl).getPropertyValue('--fs-axis'));
    return { tick: Number.isFinite(px) && px > 0 ? px : fb.tick, axis: Number.isFinite(axisPx) && axisPx > 0 ? axisPx : fb.axis };
  };

  function layout(): void {
    const { tick, axis } = fonts();
    // scatter
    const r = plotHost.getBoundingClientRect();
    const w = r.width > 0 ? Math.floor(r.width) : Math.max(200, Math.floor((size?.w ?? 900) * 0.55));
    const h = r.height > 0 ? Math.floor(r.height) : (size?.h ?? 600);
    svgEl.setAttribute('width', String(w));
    svgEl.setAttribute('height', String(h));
    const mL = Math.ceil(tick * 2.6 + 8 + axis * 1.4);
    const mB = Math.ceil(tick * 1.5 + 8 + axis * 1.5);
    const avail: Rect = { left: mL, top: 8, width: Math.max(40, w - mL - 10), height: Math.max(40, h - 8 - mB) };
    const key = `${mode} ${w} ${h} ${tick} ${axis}`;
    if (key !== lastPlot) {
      lastPlot = key;
      const sc = fitEqualAspect(DOMAIN, avail);
      const plot: Rect = {
        left: sc.x(DOMAIN.x[0]), top: sc.y(DOMAIN.y[1]),
        width: sc.x(DOMAIN.x[1]) - sc.x(DOMAIN.x[0]), height: sc.y(DOMAIN.y[0]) - sc.y(DOMAIN.y[1]),
      };
      const bottom = plot.top + plot.height;
      axes.draw(sc, plot, {
        xTickCount: 6, yTickCount: 6,
        xTickY: bottom + tick * 1.15, yTickX: plot.left - 8,
        xTitle: { x: plot.left + plot.width / 2, y: bottom + tick * 1.15 + axis * 1.45, text: 'sepal length (ölçeklenmiş)' },
        yTitle: { x: plot.left - 8 - tick * 2.6 - axis * 0.3, y: plot.top + plot.height / 2, lines: ['petal length (ölçeklenmiş)'] },
      }, 0, 'ks');
      layer.resize(avail);
    }
    // charts
    const boxes = [elCard, silCard].map((c) => {
      const cr = c.host.getBoundingClientRect();
      const cw = cr.width > 0 ? Math.floor(cr.width) : Math.max(120, Math.floor((size?.w ?? 900) * 0.4));
      const ch = cr.height > 0 ? Math.floor(cr.height) : Math.max(70, Math.floor((size?.h ?? 600) * 0.28));
      c.svg.setAttribute('width', String(cw));
      c.svg.setAttribute('height', String(ch));
      return { cw, ch };
    });
    const ck = `${boxes.map((b) => `${b.cw}x${b.ch}`).join(' ')} ${tick}`;
    if (ck !== lastCharts) {
      lastCharts = ck;
      elChart.resize({ left: 0, top: 0, width: boxes[0].cw, height: boxes[0].ch }, tick);
      silChart.resize({ left: 0, top: 0, width: boxes[1].cw, height: boxes[1].ch }, tick);
    }
  }

  function specFor(v: KView, index: number, p: KSecimiParams): ClusterScatterSpec {
    return {
      points: kmeansData.points,
      labels: v.result.labels,
      centers: v.result.centers,
      changed: flash ?? (index === STEP_CHANGED ? changedBetween(v.k) : []),
      negative: v.negatives,
      selected: v.k >= 2 && p.point !== null ? p.point : null,
    };
  }

  function updateCharts(v: KView, index: number): void {
    // The elbow curve grows with k until the elbow step; the silhouette curve until the curve step ends.
    elChart.revealUpTo(index < STEP_ELBOW ? v.k : KMAX);
    const silReveal = index < STEP_COMPARE && !(index === STEP_CURVE && v.k >= KMAX) ? v.k : KMAX;
    silChart.revealUpTo(silReveal);
    elChart.select(v.k);
    silChart.select(v.k);
    elChart.clearMarks();
    silChart.clearMarks();
    if (index >= STEP_ELBOW) elChart.mark(ELBOW_K, 'elbow');
    if (index >= STEP_CURVE && silReveal >= KMAX) silChart.mark(peak, 'peak');
  }

  function kHeader(v: KView): HTMLElement {
    const title = el('h3', 'ks-panel-title');
    title.append('k = ');
    const kv = el('span', 'ks-k', String(v.k));
    kv.setAttribute('data-k', String(v.k));
    title.append(kv);
    const head = el('div', 'ks-head');
    head.append(title, sizeList(v.sizes));
    return head;
  }

  function readingRows(v: KView): HTMLElement {
    const rows = el('div', 'ks-rows');
    rows.append(row('Inertia', inertiaText(v.inertia), { 'data-inertia': String(v.inertia) }));
    if (v.dropFromPrev !== null) {
      rows.append(row(`Düşüş (k=${v.k - 1}→${v.k})`, `−${dropText(v.dropFromPrev)}`, { 'data-drop-prev': String(v.dropFromPrev) }));
    }
    rows.append(row('Silhouette', silhouetteText(v.silhouette), { 'data-silhouette': String(v.silhouette) }));
    if (v.silhouette !== null) {
      rows.append(row('Negatif skorlu', v.negatives.length === 0 ? 'yok' : `${v.negatives.length} nokta`, { 'data-negatives': String(v.negatives.length) }));
    }
    return rows;
  }

  function pointBlock(v: KView, i: number): HTMLElement | null {
    const st = pointStats(v.k, i);
    if (!st) return null;
    const box = el('div', 'ks-point-box');
    const grid = el('div', 'ks-abs');
    grid.append(el('strong', 'ks-abs-name', `Nokta ${i + 1}`));
    for (const [name, val, attr] of [['a', st.a, 'data-a'], ['b', st.b, 'data-b'], ['s', st.s, 'data-s']] as const) {
      const c = el('span', 'ks-abs-cell');
      const num = el('strong', 'ks-value', pointText(val));
      num.setAttribute(attr, String(val));
      c.append(el('span', 'ks-label', `${name} =`), num);
      grid.append(c);
    }
    const f = el('p', 'ks-formula', `s = (b − a) / max(a, b) = (${pointText(st.b)} − ${pointText(st.a)}) / ${pointText(Math.max(st.a, st.b))}`);
    f.setAttribute('data-formula', '');
    box.append(grid, f);
    return box;
  }

  function compareBlock(): HTMLElement {
    const box = el('div', 'ks-compare');
    for (const k of [3, 4]) {
      const v = deriveKView(k);
      const col = el('div', 'ks-compare-col');
      col.setAttribute('data-compare-k', String(k));
      col.append(el('h4', 'ks-compare-title', `k=${k}`));
      col.append(row('Silhouette', silhouetteText(v.silhouette), { 'data-silhouette': String(v.silhouette) }));
      col.append(row('Negatif', v.negatives.length === 0 ? 'yok' : `${v.negatives.length} nokta`));
      col.append(row('En küçük küme', `${Math.min(...v.sizes)}`));
      col.append(sizeList(v.sizes));
      box.append(col);
    }
    return box;
  }

  function dropsBlock(): HTMLElement {
    const d = drops(kmeansData.ks).slice(0, 4);
    const box = el('div', 'ks-drops');
    box.setAttribute('aria-label', 'Ardışık düşüşler');
    const ul = el('ul', 'ks-drop-list');
    d.forEach((val, i) => {
      const li = el('li', 'ks-drop');
      const num = el('strong', 'ks-value', dropText(val));
      num.setAttribute('data-drop', String(i + 2));
      li.append(el('span', 'ks-label', `${i + 1}→${i + 2}`), num);
      ul.append(li);
    });
    box.append(ul);
    return box;
  }

  function decisionBlock(): HTMLElement {
    const box = el('div', 'ks-decision');
    box.setAttribute('data-decision', '');
    box.append(
      el('p', 'ks-decision-line', `Dirsek: k=${ELBOW_K} (kazanç azalıyor mu?)`),
      el('p', 'ks-decision-line', `Silhouette: k=${peak} (kümeler ne kadar net?)`),
      el('p', 'ks-decision-line', "Bağlam: Iris'te 3 tür biliniyor."),
    );
    return box;
  }

  function drawPanel(v: KView, index: number, p: KSecimiParams): void {
    panel.replaceChildren();
    root.dataset.step = String(index);
    if (index === STEP_COMPARE) {
      const head = el('div', 'ks-head');
      const title = el('h3', 'ks-panel-title', 'k=3 ve k=4 yan yana');
      const k = el('span', 'ks-visually-hidden', String(v.k));
      k.setAttribute('data-k', String(v.k));
      title.append(k);
      head.append(title);
      panel.append(head, compareBlock());
      return;
    }
    panel.append(kHeader(v), readingRows(v));
    if (v.silhouette === null) panel.append(el('p', 'ks-note', 'Karşılaştırılacak komşu küme yok.'));
    if (v.k >= 2 && p.point !== null) {
      const pb = pointBlock(v, p.point);
      if (pb) panel.append(pb);
    }
    if (index === STEP_ELBOW) panel.append(dropsBlock());
    if (index === STEP_DECISION) panel.append(decisionBlock());
  }

  function render(s: PlayerState<KSecimiParams>, animate: boolean): void {
    if (destroyed) return;
    const v = deriveKView(clampK(s.params.k));
    layout();
    layer.update(specFor(v, s.index, s.params), animate);
    updateCharts(v, s.index);
    drawPanel(v, s.index, s.params);
    rendered = true;
  }

  const clearFlash = (): void => {
    if (flashTimer !== null) clearTimeout(flashTimer);
    flashTimer = null;
    flash = null;
  };
  const unsubscribe = player.subscribe((s: PlayerState<KSecimiParams>, cause: ChangeCause) => {
    const k = clampK(s.params.k);
    if (cause === 'param' && shownK !== null && k !== shownK) {
      clearFlash();
      flash = changedFrom(shownK, k);
      flashTimer = setTimeout(() => {
        flashTimer = null;
        flash = null;
        render(player.state, false);
      }, FLASH_MS);
    } else if (cause !== 'param') {
      clearFlash();
    }
    shownK = k;
    render(s, rendered && cause !== 'param');
  });
  shownK = clampK(player.state.params.k);
  render(player.state, false);

  // Silhouette steps: a click on a point picks it (the Lab number input does the same).
  svgEl.addEventListener('click', (e) => {
    const t = (e.target as Element | null)?.closest('circle.cs-point');
    const s = player.state;
    if (!t || s.index < STEP_PICK_FIRST || clampK(s.params.k) < 2) return;
    const i = Number(t.getAttribute('data-i'));
    if (Number.isInteger(i)) player.setParam('point', i);
  });

  return {
    resize(w: number, h: number): void {
      size = { w, h };
      lastPlot = '';
      lastCharts = '';
      render(player.state, false);
    },
    setMode(m: Mode): void {
      mode = m;
      root.dataset.mode = m;
      lastPlot = '';
      lastCharts = '';
      render(player.state, false);
    },
    destroy(): void {
      destroyed = true;
      clearFlash();
      unsubscribe();
      layer.destroy();
      elChart.destroy();
      silChart.destroy();
      root.remove();
    },
  };
}
