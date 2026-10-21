import type { ChangeCause, PlayerState, StepPlayer } from '../../core/player';
import type { Mode } from '../../core/mode';
import type { SceneHandle } from '../../core/shell';
import type { ClusterScatterSpec } from '../../core/plot/cluster-scatter';
import { CLUSTER } from '../../core/plot/marks';
import { kmeansData } from '../kmeans/data';
import { ClusterPlotFrame } from '../kmeans/plot-frame';
import { stepIndex } from '../kmeans/steps';
import { frameCount, kMeansScenario, type KMeansParams } from './scenario';
import { deriveView, inertiaText, type KMeansView } from './view';

const SVG_NS = 'http://www.w3.org/2000/svg';
const STEP_ATA = stepIndex(kMeansScenario, 'ata');
const STEP_KOTU = stepIndex(kMeansScenario, 'kotu');
const STEP_NINIT = stepIndex(kMeansScenario, 'ninit');
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

  const frame = new ClusterPlotFrame(svgEl, plotHost, 'km', 0.62);
  const layer = frame.layer;

  let size: { w: number; h: number } | null = null;
  let rendered = false;
  let destroyed = false;

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
      lines: index === STEP_ATA && v.phase === 'ata' && v.labels
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
      stat(v.phase === 'ata' ? 'Inertia (eski merkezlerle)' : 'Inertia', inertiaText(v.inertia!), { 'data-inertia': String(v.inertia) }),
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
    frame.layout(mode, size);
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
      frame.invalidate();
      render(player.state, false);
    },
    setMode(m: Mode): void {
      mode = m;
      root.dataset.mode = m;
      frame.invalidate();
      render(player.state, false);
    },
    destroy(): void {
      destroyed = true;
      unsubscribe();
      frame.destroy();
      root.remove();
    },
  };
}
