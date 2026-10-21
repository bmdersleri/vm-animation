import { select } from 'd3-selection';
import type { ChangeCause, PlayerState, StepPlayer } from '../../core/player';
import type { Mode } from '../../core/mode';
import type { SceneHandle } from '../../core/shell';
import { AxesLayer } from '../../core/plot/axes';
import { ClusterScatterLayer, type ClusterScatterSpec } from '../../core/plot/cluster-scatter';
import { CLUSTER } from '../../core/plot/marks';
import { fitEqualAspect, type Domain, type Rect } from '../../core/plot/viewport';
import { kmeansData } from '../kmeans/data';
import { frameCount, type KMeansParams } from './scenario';
import { deriveView, inertiaText, type KMeansView } from './view';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DOMAIN: Domain = { x: [-2.1, 2.7], y: [-1.8, 2.0] };
const FONT_FALLBACK: Record<Mode, { tick: number; axis: number }> = { ders: { tick: 18, axis: 19 }, lab: { tick: 13, axis: 14 } };
const STEP_ATA = 2;
const STEP_KOTU = 6;
const STEP_NINIT = 7;
const PHASE_TEXT = { baslangic: 'başlangıç', ata: 'ata', tasi: 'taşı' } as const;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** A coloured, numbered cluster marker: colour is never the only carrier. */
function chip(c: number): HTMLSpanElement {
  const s = el('span', 'km-chip', `M${c + 1}`);
  s.style.setProperty('--chip', CLUSTER[c % CLUSTER.length]);
  return s;
}

export function mountKMeansScene(host: HTMLElement, player: StepPlayer<KMeansParams>, initialMode: Mode): SceneHandle {
  let mode = initialMode;
  const root = el('div', 'km-scene');
  root.dataset.mode = mode;
  const plotHost = el('div', 'km-plot-host');
  const svgEl = document.createElementNS(SVG_NS, 'svg');
  svgEl.setAttribute('class', 'km-plot');
  svgEl.setAttribute('role', 'img');
  svgEl.setAttribute('aria-label', `K-Means saçılım grafiği: ${kmeansData.points.length} çiçek, ${kmeansData.runs[0].start.length} küme merkezi`);
  plotHost.append(svgEl);
  const panel = el('aside', 'km-panel');
  panel.setAttribute('aria-live', 'polite');
  root.append(plotHost, panel);
  host.append(root);

  const svg = select(svgEl);
  const gAxes = svg.append('g').attr('class', 'axes');
  const axes = new AxesLayer(gAxes as never);
  const gPlot = svg.append('g').attr('class', 'km-marks');
  const layer = new ClusterScatterLayer(gPlot.node() as SVGGElement, DOMAIN);
  const probe = svg.append('text').attr('class', 'km-probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');

  let size: { w: number; h: number } | null = null;
  let rendered = false;
  let destroyed = false;
  let lastPlot = '';

  const fonts = (): { tick: number; axis: number } => {
    const fb = FONT_FALLBACK[mode];
    const px = parseFloat(getComputedStyle(probe.node() as Element).fontSize);
    const axisPx = parseFloat(getComputedStyle(svgEl).getPropertyValue('--fs-axis'));
    const tick = Number.isFinite(px) && px > 0 ? px : fb.tick;
    return { tick, axis: Number.isFinite(axisPx) && axisPx > 0 ? axisPx : fb.axis };
  };

  /** Lays the axes and the scatter out in the plot host; returns the animation-free redraw. */
  function layout(): void {
    const r = plotHost.getBoundingClientRect();
    const w = r.width > 0 ? Math.floor(r.width) : Math.max(200, Math.floor((size?.w ?? 900) * 0.62));
    const h = r.height > 0 ? Math.floor(r.height) : (size?.h ?? 600);
    svgEl.setAttribute('width', String(w));
    svgEl.setAttribute('height', String(h));
    const { tick, axis } = fonts();
    const mL = Math.ceil(tick * 2.6 + 8 + axis * 1.4);
    const mB = Math.ceil(tick * 1.5 + 8 + axis * 1.5);
    const avail: Rect = { left: mL, top: 8, width: Math.max(40, w - mL - 10), height: Math.max(40, h - 8 - mB) };
    const key = `${mode} ${w} ${h} ${tick} ${axis}`;
    if (key === lastPlot) return;
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
    }, 0, 'km');
    layer.resize(avail);
  }

  function specFor(v: KMeansView, index: number, p: KMeansParams): ClusterScatterSpec {
    const points = kmeansData.points;
    if (index === STEP_NINIT) {
      const pick = kmeansData.nInit[Math.max(0, Math.min(kmeansData.nInit.length - 1, Math.trunc(p.pick)))];
      return { points, labels: pick.labels, centers: pick.centers };
    }
    return {
      points,
      labels: v.labels,
      centers: v.frame === 0 && index === 0 ? null : v.centers,
      trails: v.trails,
      lines: index === STEP_ATA && v.labels
        ? kmeansData.distancePoints.map((point) => ({ point, nearest: v.labels![point] }))
        : [],
      changed: v.phase === 'ata' ? v.changedIdx : [],
    };
  }

  function stat(label: string, value: string, attrs: Record<string, string>): HTMLElement {
    const d = el('div', 'km-stat');
    const v = el('strong', 'km-stat-value', value);
    for (const [k, val] of Object.entries(attrs)) v.setAttribute(k, val);
    d.append(el('span', 'km-stat-label', label), v);
    return d;
  }

  function drawPanel(v: KMeansView, index: number, p: KMeansParams): void {
    panel.replaceChildren();
    root.dataset.step = String(index);
    root.dataset.frame = String(v.frame);
    if (index === STEP_NINIT) {
      const best = kmeansData.nInitBest;
      const max = Math.max(...kmeansData.nInit.map((r) => r.inertia));
      const list = el('ol', 'km-ninit');
      kmeansData.nInit.forEach((r, i) => {
        const row = el('li', 'km-ninit-row');
        row.setAttribute('data-ninit-row', String(i));
        if (i === best) { row.setAttribute('data-best', ''); row.classList.add('is-best'); }
        if (i === Math.trunc(p.pick)) row.setAttribute('data-picked', '');
        const bar = el('span', 'km-ninit-bar');
        bar.style.setProperty('--w', `${Math.round((r.inertia / max) * 100)}%`);
        row.append(el('span', 'km-ninit-seed', `${i === best ? '✓ ' : ''}Başlangıç ${i + 1}`), bar, el('strong', 'km-ninit-value', inertiaText(r.inertia)));
        list.append(row);
      });
      const code = el('p', 'km-code', 'KMeans(n_clusters=3, n_init=10, random_state=42)');
      code.setAttribute('data-ninit-code', '');
      const pickNote = el('p', 'km-note', `✓ En düşük inertia seçilir: ${inertiaText(kmeansData.nInit[best].inertia)}`);
      panel.append(el('h3', 'km-panel-title', 'On başlangıcın son inertia değeri'), list, pickNote, code);
      return;
    }
    if (v.frame === 0) {
      panel.append(el('h3', 'km-panel-title', `${kmeansData.points.length} çiçek · k = ${v.centers.length}`));
      panel.append(el('p', 'km-note', index === 0 ? 'Henüz merkez ve grup yok.' : 'Üç başlangıç merkezi, henüz atama yok.'));
      return;
    }
    const title = el('h3', 'km-panel-title');
    title.append(`Tur ${v.turn} · `);
    const ph = el('span', 'km-phase', PHASE_TEXT[v.phase]);
    ph.setAttribute('data-phase', v.phase);
    title.append(ph);
    const turnEl = el('span', 'km-visually-hidden', String(v.turn));
    turnEl.setAttribute('data-turn', String(v.turn));
    title.append(turnEl);
    const stats = el('div', 'km-stats');
    stats.append(
      stat('Renk değiştiren', v.changed === null ? 'ilk atama' : `${v.changed} nokta`, { 'data-changed': v.changed === null ? 'ilk' : String(v.changed) }),
      stat('Inertia', inertiaText(v.inertia!), { 'data-inertia': String(v.inertia) }),
    );
    const sizes = el('ul', 'km-sizes');
    v.sizes!.forEach((n, c) => {
      const li = el('li', 'km-size');
      li.setAttribute('data-size', String(n));
      li.append(chip(c), el('strong', 'km-size-n', String(n)));
      sizes.append(li);
    });
    panel.append(title, stats, el('p', 'km-sizes-label', 'Küme boyları'), sizes);
    if (v.changed === 0) {
      const stop = el('p', 'km-stop', 'Hiçbir nokta renk değiştirmedi: döngü durur.');
      stop.setAttribute('data-stop', '');
      panel.append(stop);
    }
    if (index === STEP_KOTU && v.frame === frameCount(v.run) - 1) {
      const good = kmeansData.runs[0];
      const max = Math.max(v.run.inertia, good.inertia);
      const cmp = el('div', 'km-compare');
      cmp.setAttribute('data-compare', '');
      const row = (name: string, run: { inertia: number }, which: 'bad' | 'good'): HTMLElement => {
        const r = el('div', `km-compare-row is-${which}`);
        const bar = el('span', 'km-compare-bar');
        bar.style.setProperty('--w', `${Math.round((run.inertia / max) * 100)}%`);
        const val = el('strong', 'km-compare-value', inertiaText(run.inertia));
        val.setAttribute(`data-value-${which}`, String(run.inertia));
        r.append(el('span', 'km-compare-name', name), bar, val);
        return r;
      };
      cmp.append(el('p', 'km-sizes-label', 'Yan yana inertia'), row('Rastgele', v.run, 'bad'), row('k-means++', good, 'good'));
      panel.append(cmp);
    }
  }

  function render(s: PlayerState<KMeansParams>, animate: boolean): void {
    if (destroyed) return;
    layout();
    const v = deriveView(s.params);
    layer.update(specFor(v, s.index, s.params), animate);
    drawPanel(v, s.index, s.params);
    rendered = true;
  }

  const unsubscribe = player.subscribe((s: PlayerState<KMeansParams>, cause: ChangeCause) => render(s, rendered && cause !== 'param'));
  render(player.state, false);

  return {
    resize(w: number, h: number): void {
      size = { w, h };
      lastPlot = '';
      render(player.state, false);
    },
    setMode(m: Mode): void {
      mode = m;
      root.dataset.mode = m;
      lastPlot = '';
      render(player.state, false);
    },
    destroy(): void {
      destroyed = true;
      unsubscribe();
      layer.destroy();
      root.remove();
    },
  };
}
