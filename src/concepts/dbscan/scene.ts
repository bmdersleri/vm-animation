import { select } from 'd3-selection';
import { stepIndex, type ChangeCause, type PlayerState, type StepPlayer } from '../../core/player';
import type { Mode } from '../../core/mode';
import type { SceneHandle } from '../../core/shell';
import { formatNumber } from '../../core/plot/format';
import { CLUSTER } from '../../core/plot/marks';
import { PointKindsLayer, type PointKindsSpec } from '../../core/plot/point-kinds';
import type { Domain } from '../../core/plot/viewport';
import { ClusterPlotFrame } from '../kmeans/plot-frame';
import { dbscanData } from './data';
import { dbscan, type DbscanResult, type Kind } from './dbscan';
import { KDistChart } from './kdist-chart';
import { dbscanScenario, type DbscanParams } from './scenario';
import { KIND_NAME, clusterSizes, countsText, epsText, kindCounts, reachedCount, verdictFor } from './view';

const SVG_NS = 'http://www.w3.org/2000/svg';
const STEP_KMEANS = stepIndex(dbscanScenario, 'kmeans');
const STEP_EPS = stepIndex(dbscanScenario, 'eps');
const STEP_CORE = stepIndex(dbscanScenario, 'cekirdek');
const STEP_KINDS = stepIndex(dbscanScenario, 'turler');
const STEP_SPREAD = stepIndex(dbscanScenario, 'yayilma');
const STEP_KDIST = stepIndex(dbscanScenario, 'k-uzaklik');
/** The scaled moons plus outliers span about ±1.9; room for the eps circle's label. */
const DOMAIN: Domain = { x: [-2.2, 2.2], y: [-2.2, 2.1] };
const COUNT_MS = 60;
const MAX_CHIPS = 12;
const GLYPH: Record<Kind, string> = { core: '●', border: '○', noise: '×' };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** A coloured, numbered cluster marker: colour is never the only carrier. */
function chip(c: number): HTMLSpanElement {
  const s = el('span', 'db-chip', `Küme ${c + 1}`);
  s.style.setProperty('--chip', CLUSTER[c % CLUSTER.length]);
  return s;
}

function row(label: string, value: string, attrs: Record<string, string> = {}): HTMLElement {
  const d = el('div', 'db-row');
  const v = el('strong', 'db-value', value);
  for (const [k, val] of Object.entries(attrs)) v.setAttribute(k, val);
  d.append(el('span', 'db-label', label), v);
  return d;
}

const cache = new Map<string, DbscanResult>();
function compute(eps: number, minSamples: number): DbscanResult {
  const key = `${eps}|${minSamples}`;
  let r = cache.get(key);
  if (!r) {
    if (cache.size > 40) cache.clear();
    r = dbscan(dbscanData.points, eps, minSamples);
    cache.set(key, r);
  }
  return r;
}

const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mountDbscanScene(host: HTMLElement, player: StepPlayer<DbscanParams>, initialMode: Mode): SceneHandle {
  let mode = initialMode;
  const n = dbscanData.points.length;
  const root = el('div', 'db-scene');
  root.dataset.mode = mode;
  const plotHost = el('div', 'db-plot-host');
  const svgEl = document.createElementNS(SVG_NS, 'svg');
  svgEl.setAttribute('class', 'db-plot');
  svgEl.setAttribute('role', 'img');
  svgEl.setAttribute('aria-label', `DBSCAN saçılım grafiği: ${n} nokta; çekirdek dolu daire, sınır halka, gürültü gri çarpı`);
  plotHost.append(svgEl);
  const panel = el('aside', 'db-panel');
  panel.setAttribute('aria-live', 'polite');
  root.append(plotHost, panel);
  host.append(root);

  const frame = new ClusterPlotFrame<PointKindsLayer>(svgEl, plotHost, 'db', 0.6, {
    domain: DOMAIN,
    xTitle: 'özellik 1 (ölçeklenmiş)',
    yTitle: { text: 'özellik 2 (ölçeklenmiş)', lines: ['özellik 2', '(ölçeklenmiş)'] },
    makeLayer: (parent, domain) => new PointKindsLayer(parent, domain),
  });
  const layer = frame.layer;

  // Step 10 pieces live on, detached, between steps: the chart is drawn into them once per change.
  const kd = el('section', 'db-kd');
  const kdTitle = el('h3', 'db-kd-title');
  const kdHost = el('div', 'db-kd-host');
  const kdSvg = document.createElementNS(SVG_NS, 'svg');
  kdSvg.setAttribute('class', 'kd-chart');
  kdHost.append(kdSvg);
  const kdCode = el('code', 'db-code');
  kd.append(kdTitle, kdHost, kdCode);
  const kdChart = new KDistChart(select(kdSvg).append('g').node() as SVGGElement, 'k-uzaklık grafiği: sıralı uzaklıklar, eps çizgisi ve bükülme');

  let size: { w: number; h: number } | null = null;
  let destroyed = false;
  let rendered = false;
  let lastKd = '';
  /** Step 3 count-up: how many neighbours have been counted so far (null = all). */
  let counted: number | null = null;
  /** Step index of the last emit; play/pause re-emit 'step' with the same index and must not restart the count-up. */
  let lastIndex = player.state.index;
  let countTimer: ReturnType<typeof setInterval> | null = null;

  const stopCount = (): void => {
    if (countTimer !== null) clearInterval(countTimer);
    countTimer = null;
    counted = null;
    panel.setAttribute('aria-live', 'polite');
  };

  /** Neighbours of the selected point, nearest first, so the count-up ripples outwards. */
  function ordered(r: DbscanResult, p: number): number[] {
    const c = dbscanData.points[p];
    const d2 = (i: number): number => (dbscanData.points[i][0] - c[0]) ** 2 + (dbscanData.points[i][1] - c[1]) ** 2;
    return [...r.neighbours[p]].sort((a, b) => d2(a) - d2(b) || a - b);
  }

  function specFor(s: PlayerState<DbscanParams>, r: DbscanResult): PointKindsSpec {
    const { index, params } = s;
    const p = params.point;
    const spec: PointKindsSpec = { points: dbscanData.points, kind: null, label: null };
    if (index === STEP_KMEANS) spec.label = dbscanData.kmeansLabels;
    if (index >= STEP_KINDS) {
      spec.kind = r.kind;
      spec.label = r.label;
    }
    if (index === STEP_SPREAD) {
      const noise = r.kind.flatMap((k, i) => (k === 'noise' ? [i] : []));
      spec.order = [...r.order, ...noise];
      spec.colouredUpTo = reachedCount(spec.order.length, params.spread);
    }
    if (index >= STEP_EPS && p !== null && p >= 0 && p < n) {
      const nb = ordered(r, p);
      spec.selected = p;
      spec.eps = { center: p, r: params.eps };
      spec.neighbours = index === STEP_EPS && counted !== null ? nb.slice(0, counted) : nb;
      if (index >= STEP_CORE && index < STEP_KINDS) {
        // steps 4-6 reveal only the chosen point's kind
        spec.kind = r.kind;
        spec.label = r.label;
        const v = verdictFor(r, p, params.minSamples);
        spec.via = v.viaCore;
        // the chosen point and, for a border point, the core it hangs on
        spec.order = v.viaCore === null ? [p] : [p, v.viaCore];
        spec.colouredUpTo = spec.order.length;
      }
    }
    return spec;
  }

  function kindLine(r: DbscanResult): HTMLElement {
    const k = kindCounts(r);
    const box = el('div', 'db-kinds');
    for (const kind of ['core', 'border', 'noise'] as const) {
      const c = el('span', 'db-kind');
      const num = el('strong', 'db-value', String(k[kind]));
      num.setAttribute(`data-kind-count`, kind);
      c.append(el('span', `db-glyph db-glyph-${kind}`, GLYPH[kind]), num, el('span', 'db-label', KIND_NAME[kind]));
      box.append(c);
    }
    return box;
  }

  function sizeList(sizes: readonly number[]): HTMLElement {
    const ul = el('ul', 'db-sizes');
    ul.setAttribute('data-clusters', '');
    // Lab only: free eps / min_samples values can give dozens of clusters; the fixed Ders values peak at 14, which fit.
    const cap = mode === 'lab' ? MAX_CHIPS : Infinity;
    sizes.slice(0, cap).forEach((c, i) => {
      const li = el('li', 'db-size');
      li.setAttribute('data-size', String(c));
      li.append(chip(i), el('strong', 'db-value', String(c)));
      ul.append(li);
    });
    if (sizes.length > cap) {
      const more = sizes.length - cap;
      const li = el('li', 'db-size-more', `… ${more} küme daha`);
      li.setAttribute('data-more', String(more));
      ul.append(li);
    }
    return ul;
  }

  function pointBlock(s: PlayerState<DbscanParams>, r: DbscanResult, p: number): HTMLElement {
    const { index, params } = s;
    const v = verdictFor(r, p, params.minSamples);
    const box = el('div', 'db-point');
    const shown = index === STEP_EPS && counted !== null ? counted : v.neighbours;
    box.append(el('h3', 'db-point-title', `Nokta ${p + 1}`));
    box.append(row('Daire içinde (kendisi dahil)', String(shown), { 'data-neighbours': String(shown) }));
    if (index !== STEP_EPS) {
      const verdict = el('p', `db-verdict db-verdict-${v.kind}`);
      verdict.setAttribute('data-verdict', v.kind);
      verdict.append(el('span', `db-glyph db-glyph-${v.kind}`, GLYPH[v.kind]), ` ${v.text}`);
      box.append(verdict);
    }
    return box;
  }

  function drawPanel(s: PlayerState<DbscanParams>, r: DbscanResult): void {
    const { index, params } = s;
    panel.replaceChildren();
    root.dataset.view = index === STEP_KDIST ? 'kdist' : 'scatter';
    if (index === STEP_KDIST) {
      panel.append(kd);
      return;
    }
    if (index < STEP_KMEANS) {
      panel.append(el('h3', 'db-panel-title', `${n} nokta`), el('p', 'db-note', 'Etiket yok. Kaç grup görüyorsun?'));
      return;
    }
    if (index === STEP_KMEANS) {
      panel.append(el('h3', 'db-panel-title', 'K-Means, k = 2'));
      const sizes = [0, 1].map((k) => dbscanData.kmeansLabels.filter((l) => l === k).length);
      panel.append(sizeList(sizes), el('p', 'db-note', 'K-Means küresel küme varsayar: hilalleri düz bir çizgiyle böler ve dağınık noktaları da bir kümeye atar.'));
      return;
    }
    const head = el('div', 'db-head');
    head.append(
      el('h3', 'db-panel-title', 'DBSCAN'),
      // Lab: the same two-decimal form as the slider output beside it; Ders: the short form of the step text
      row('eps', mode === 'lab' ? formatNumber(params.eps, 2) : epsText(params.eps), { 'data-eps': String(params.eps) }),
      row('min_samples', String(params.minSamples), { 'data-min-samples': String(params.minSamples) }),
    );
    panel.append(head);
    const p = params.point;
    if (p !== null && p >= 0 && p < n) panel.append(pointBlock(s, r, p));
    if (index >= STEP_KINDS) {
      const spreading = index === STEP_SPREAD;
      const reached = spreading ? Math.min(reachedCount(r.order.length + kindCounts(r).noise, params.spread), r.order.length) : r.order.length;
      if (spreading) {
        panel.append(row('Renklenen', `${reached} / ${r.order.length}`, { 'data-spread': String(params.spread) }));
      }
      if (!spreading || params.spread >= 1) {
        const counts = el('p', 'db-counts', countsText(r));
        counts.setAttribute('data-counts', '');
        panel.append(counts);
      }
      panel.append(kindLine(r));
      panel.append(sizeList(clusterSizes(r, reached)));
      if (kindCounts(r).core === 0) panel.append(el('p', 'db-note db-no-core', 'Çekirdek yok: bütün noktalar gürültü.'));
    } else if (p === null) {
      panel.append(el('p', 'db-note', 'Bir noktaya tıklayarak eps dairesini görebilirsin.'));
    }
  }

  function drawKd(params: DbscanParams): void {
    const m = Math.max(2, Math.min(dbscanData.kdist[dbscanData.kdist.length - 1].minSamples, Math.trunc(params.minSamples)));
    const curve = dbscanData.kdist.find((k) => k.minSamples === m) ?? dbscanData.kdist[0];
    kdTitle.textContent = `${curve.minSamples}. en yakın komşuya uzaklık (kendisi dahil)`;
    const code = `DBSCAN(eps=${params.eps}, min_samples=${params.minSamples})`;
    if (kdCode.textContent !== code) kdCode.textContent = code;
    kdChart.set({ sorted: curve.sorted, eps: params.eps, knee: curve.knee });
  }

  function layout(index: number): void {
    const { tick } = frame.layout(mode, size);
    if (index !== STEP_KDIST) return;
    const cr = kdHost.getBoundingClientRect();
    const w = cr.width > 0 ? Math.floor(cr.width) : Math.max(160, Math.floor((size?.w ?? 900) * 0.36));
    const h = cr.height > 0 ? Math.floor(cr.height) : Math.max(110, Math.floor((size?.h ?? 600) * 0.4));
    kdSvg.setAttribute('width', String(w));
    kdSvg.setAttribute('height', String(h));
    const key = `${w}x${h} ${tick}`;
    if (key !== lastKd) {
      lastKd = key;
      kdChart.resize({ left: 0, top: 0, width: w, height: h }, tick);
    }
  }

  function render(s: PlayerState<DbscanParams>, animate: boolean): void {
    if (destroyed) return;
    const r = compute(s.params.eps, s.params.minSamples);
    // Panel first: in the stacked layouts its height decides the plot host's, so the plot is measured after it.
    drawPanel(s, r);
    if (s.index === STEP_KDIST) drawKd(s.params);
    layout(s.index);
    layer.update(specFor(s, r), animate);
    rendered = true;
  }

  /** A count-up tick: the number and the rings change in place; the panel is rebuilt only when the count ends. */
  function tickCount(s: PlayerState<DbscanParams>): void {
    const num = panel.querySelector('[data-neighbours]');
    if (destroyed) return;
    if (!num) {
      render(s, false);
      return;
    }
    const shown = String(counted ?? 0);
    num.textContent = shown;
    num.setAttribute('data-neighbours', shown);
    layer.update(specFor(s, compute(s.params.eps, s.params.minSamples)), false);
  }

  const startCount = (s: PlayerState<DbscanParams>): void => {
    stopCount();
    const p = s.params.point;
    if (s.index !== STEP_EPS || p === null || reducedMotion()) return;
    const total = compute(s.params.eps, s.params.minSamples).neighbours[p].length;
    counted = 0;
    // The count-up is silent for screen readers; the panel announces once, with the final count.
    panel.setAttribute('aria-live', 'off');
    countTimer = setInterval(() => {
      counted = (counted ?? 0) + 1;
      if (counted >= total) {
        stopCount();
        render(player.state, false);
      } else tickCount(player.state);
    }, COUNT_MS);
  };

  // Steps 3-8: a click on a point selects it (the Lab number input does the same).
  const onClick = (e: Event): void => {
    const t = (e.target as Element | null)?.closest('g.pk-point');
    const s = player.state;
    if (!t || s.index < STEP_EPS || s.index > STEP_SPREAD) return;
    const i = Number(t.getAttribute('data-i'));
    if (Number.isInteger(i) && i >= 0 && i < n) player.setParams({ point: i });
  };
  svgEl.addEventListener('click', onClick);

  const unsubscribe = player.subscribe((s: PlayerState<DbscanParams>, cause: ChangeCause) => {
    if (cause === 'step') {
      if (s.index !== lastIndex) startCount(s);
    } else if (cause === 'param') stopCount();
    lastIndex = s.index;
    render(s, rendered && cause !== 'param');
  });
  startCount(player.state);
  render(player.state, false);

  return {
    resize(w: number, h: number): void {
      size = { w, h };
      frame.invalidate();
      lastKd = '';
      render(player.state, false);
    },
    setMode(m: Mode): void {
      mode = m;
      root.dataset.mode = m;
      frame.invalidate();
      lastKd = '';
      render(player.state, false);
    },
    destroy(): void {
      destroyed = true;
      stopCount();
      unsubscribe();
      svgEl.removeEventListener('click', onClick);
      frame.destroy();
      kdChart.destroy();
      root.remove();
    },
  };
}
