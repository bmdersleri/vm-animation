import { select } from 'd3-selection';
import { stepIndex, type PlayerState, type StepPlayer } from '../../core/player';
import type { Mode } from '../../core/mode';
import type { SceneHandle } from '../../core/shell';
import { DendrogramLayer, type DendrogramSpec } from '../../core/plot/dendrogram';
import { formatNumber } from '../../core/plot/format';
import { ACCENT, CLUSTER, NAVY } from '../../core/plot/marks';
import type { Domain } from '../../core/plot/viewport';
import { ClusterPlotFrame } from '../kmeans/plot-frame';
import { dendrogramData as D } from './data';
import { ScatterLayer, type Hull, type ScatterSpec } from './scatter-layer';
import { dendrogramScenario, type DendrogramParams } from './scenario';
import { clustersAfter, cutForK, leafX, largestGap } from './tree';
import {
  LINKAGE_NAME, cutSizes, gapText, heightText, linkageRows, maxHeightOf, mergeInfo, sizesText, treeOf,
} from './view';

const SVG_NS = 'http://www.w3.org/2000/svg';
const STEP_START = stepIndex(dendrogramScenario, 'yapraklar');
const STEP_WARD = stepIndex(dendrogramScenario, 'ward');
const STEP_NATURAL = stepIndex(dendrogramScenario, 'dogal-kesim');
const STEP_SINGLE = stepIndex(dendrogramScenario, 'single');
const STEP_TABLE = stepIndex(dendrogramScenario, 'tablo');
/** Points span x 0.9..6.7 and y 0.7..5.6; room for the number labels. */
const DOMAIN: Domain = { x: [0, 7.6], y: [0, 6.3] };
const N = D.points.length;
const LEAF_LABELS = D.points.map((_p, i) => String(i + 1));
const POINT_LABEL = LEAF_LABELS.map((l) => `Nokta ${l}`);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** A coloured, numbered cluster marker: colour is never the only carrier. */
function chip(c: number): HTMLSpanElement {
  const s = el('span', 'dg-chip', `Küme ${c + 1}`);
  s.style.setProperty('--chip', CLUSTER[c % CLUSTER.length]);
  return s;
}

function row(label: string, value: string, attrs: Record<string, string> = {}): HTMLElement {
  const d = el('div', 'dg-row');
  const v = el('strong', 'dg-value', value);
  for (const [k, val] of Object.entries(attrs)) v.setAttribute(k, val);
  d.append(el('span', 'dg-label', label), v);
  return d;
}

const clampInt = (v: number, lo: number, hi: number): number => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.trunc(v))) : lo);

export function mountDendrogramScene(host: HTMLElement, player: StepPlayer<DendrogramParams>, initialMode: Mode): SceneHandle {
  let mode = initialMode;
  const root = el('div', 'dg-scene');
  root.dataset.mode = mode;
  const scatterHost = el('div', 'dg-scatter-host');
  const scatterSvg = document.createElementNS(SVG_NS, 'svg');
  scatterSvg.setAttribute('class', 'dg-scatter');
  scatterSvg.setAttribute('role', 'img');
  scatterSvg.setAttribute('aria-label', `Saçılım grafiği: ${N} numaralı nokta; birleşen kümeler yuvarlatılmış bir kapsayıcıyla gösterilir`);
  scatterHost.append(scatterSvg);
  const treeHost = el('div', 'dg-tree-host');
  const treeSvg = document.createElementNS(SVG_NS, 'svg');
  treeSvg.setAttribute('class', 'dg-tree');
  treeSvg.setAttribute('role', 'img');
  treeSvg.setAttribute('aria-label', 'Dendrogram: yapraklar nokta numaraları, yükseklik birleşme uzaklığı');
  treeHost.append(treeSvg);
  const panel = el('aside', 'dg-panel');
  panel.setAttribute('aria-live', 'polite');
  root.append(scatterHost, treeHost, panel);
  host.append(root);

  const frame = new ClusterPlotFrame<ScatterLayer>(scatterSvg, scatterHost, 'dg', 0.4, {
    domain: DOMAIN,
    xTitle: 'özellik 1',
    yTitle: { text: 'özellik 2', lines: ['özellik 2'] },
    makeLayer: (parent, domain) => new ScatterLayer(parent, domain),
  });
  const scatter = frame.layer;
  const tree = new DendrogramLayer(select(treeSvg).append('g').node() as SVGGElement);

  let size: { w: number; h: number } | null = null;
  let destroyed = false;
  let rendered = false;
  let lastTree = '';

  function pointBlock(p: number, cluster: readonly number[] | null): HTMLElement {
    const box = el('div', 'dg-picked');
    box.append(el('h3', 'dg-picked-title', POINT_LABEL[p]));
    if (cluster) box.append(el('p', 'dg-note', `Şu an ${cluster.length} noktalı bir kümede.`));
    return box;
  }

  function table(): HTMLElement {
    const t = el('table', 'dg-table');
    const head = t.createTHead().insertRow();
    for (const h of ['Bağlantı', 'İki kümenin uzaklığı ve ne zaman', '3 kümede boylar']) head.append(el('th', 'dg-th', h));
    const body = t.createTBody();
    for (const r of linkageRows()) {
      const tr = body.insertRow();
      tr.setAttribute('data-row', r.linkage);
      tr.setAttribute('data-sizes', r.sizes.join(' '));
      const name = el('th', 'dg-rowname', LINKAGE_NAME[r.linkage]);
      name.scope = 'row';
      const info = el('td', 'dg-def');
      info.append(el('span', 'dg-definition', r.definition), el('span', 'dg-when', r.when));
      tr.append(name, info, el('td', 'dg-sizes-cell', sizesText(r.sizes)));
    }
    return t;
  }

  function drawPanel(s: PlayerState<DendrogramParams>, merges: number, k: number | null, cut: number | null): void {
    const { index, params } = s;
    panel.replaceChildren();
    const ld = D.linkages[params.linkage];
    if (index === STEP_TABLE) {
      // the table and the book code fill the panel; the counters would only crowd it
      panel.append(table());
      const code = el('code', 'dg-code');
      code.textContent = ['linkage(X, method="ward")', 'AgglomerativeClustering(n_clusters=3, linkage="ward")'].join('\n');
      panel.append(code);
      return;
    }
    const head = el('div', 'dg-head');
    head.append(
      el('h3', 'dg-panel-title', `${LINKAGE_NAME[params.linkage]} bağlantısı`),
      row('Birleşme', `${merges} / ${N - 1}`, { 'data-merges': String(merges) }),
      row('Küme sayısı', String(k ?? N - merges), { 'data-k': String(k ?? N - merges) }),
    );
    if (cut !== null) head.append(row('Kesim yüksekliği', heightText(cut), { 'data-cut-height': String(cut) }));
    panel.append(head);

    if (index === STEP_START && merges === 0) {
      panel.append(el('p', 'dg-note', 'Ölçekleme yok: iki özellik de aynı birimde, uzaklıklar doğrudan karşılaştırılır.'));
    }
    if (k === null && merges >= 1) {
      const m = el('p', 'dg-merge-text', mergeInfo(params.linkage, merges).text);
      m.setAttribute('data-merge-text', '');
      panel.append(m);
    }
    if (index === STEP_WARD && params.linkage === 'ward') {
      const inc = D.wardExample.increase;
      const sse = el('p', 'dg-sse', `Kareler toplamı artışı: ${formatNumber(inc, 3)} (birleşme ${D.wardExample.merge + 1})`);
      sse.setAttribute('data-sse', String(inc));
      panel.append(sse);
    }
    if (k !== null) {
      const ul = el('ul', 'dg-sizes');
      ul.setAttribute('data-clusters', '');
      cutSizes(params.linkage, k).forEach((c, i) => {
        const li = el('li', 'dg-size');
        li.setAttribute('data-size', String(c));
        li.append(chip(i), el('strong', 'dg-value', String(c)));
        ul.append(li);
      });
      panel.append(ul);
    }
    if (index === STEP_NATURAL) {
      const g = el('p', 'dg-gap-text', gapText(params.linkage));
      g.setAttribute('data-gap', `${largestGap(ld).low}-${largestGap(ld).high}`);
      panel.append(g);
    }
    if (index === STEP_SINGLE) {
      const ul = el('ul', 'dg-compare');
      for (const l of ['ward', 'single'] as const) {
        const li = el('li', 'dg-compare-item');
        const sizes = cutSizes(l, D.naturalK);
        li.setAttribute('data-linkage', l);
        li.setAttribute('data-sizes', sizes.join(' '));
        if (params.linkage === l) li.setAttribute('aria-current', 'true');
        li.append(el('span', 'dg-label', `${LINKAGE_NAME[l]}, 3 küme`), el('strong', 'dg-value', sizesText(sizes)));
        ul.append(li);
      }
      panel.append(ul);
    }
    const p = params.point;
    if (p !== null && p >= 0 && p < N) {
      const labels = k !== null ? ld.cuts[k - 1].labels : null;
      const cluster = labels
        ? labels.flatMap((l, i) => (l === labels[p] ? [i] : []))
        : clustersAfter(ld, N, merges).find((c) => c.includes(p)) ?? null;
      panel.append(pointBlock(p, cluster));
    }
  }

  function layoutTree(maxHeight: number): void {
    const r = treeHost.getBoundingClientRect();
    const w = r.width > 0 ? Math.floor(r.width) : Math.max(200, Math.floor((size?.w ?? 900) * 0.55));
    const h = r.height > 0 ? Math.floor(r.height) : Math.max(160, Math.floor((size?.h ?? 600) * 0.6));
    treeSvg.setAttribute('width', String(w));
    treeSvg.setAttribute('height', String(h));
    const key = `${mode} ${w}x${h} ${maxHeight}`;
    if (key === lastTree) return;
    lastTree = key;
    tree.resize({ left: 0, top: 0, width: w, height: h }, maxHeight);
  }

  function render(s: PlayerState<DendrogramParams>, animate: boolean): void {
    if (destroyed) return;
    const { index, params } = s;
    const ld = D.linkages[params.linkage];
    const bs = treeOf(params.linkage);
    const merges = clampInt(params.merges, 0, N - 1);
    const k = params.k !== null && Number.isInteger(params.k) && params.k >= 1 && params.k <= ld.cuts.length ? params.k : null;
    const cut = k === null ? null : cutForK(ld, k);
    const labels = k === null ? null : ld.cuts[k - 1].labels;
    root.dataset.step = String(index);
    // Panel first: in the stacked layouts its height decides the plots' hosts, so they are measured after it.
    drawPanel(s, merges, k, cut);
    frame.layout(mode, size);
    layoutTree(maxHeightOf(params.linkage));

    const newest = k === null && merges > 0 ? bs[merges - 1] : null;
    const hulls: Hull[] = [];
    if (labels) {
      const groups = new Map<number, number[]>();
      labels.forEach((l, i) => groups.set(l, [...(groups.get(l) ?? []), i]));
      for (const [l, members] of groups) if (members.length > 1) hulls.push({ members, kind: 'cluster', colour: CLUSTER[l % CLUSTER.length] });
    } else {
      for (const c of clustersAfter(ld, N, merges)) {
        if (c.length > 1 && !(newest && c.length === newest.members.length && c[0] === newest.members[0])) hulls.push({ members: c, kind: 'group', colour: NAVY });
      }
      if (newest) hulls.push({ members: newest.members, kind: 'merge', colour: ACCENT, merge: merges });
    }
    const point = params.point !== null && params.point >= 0 && params.point < N ? params.point : null;
    const scatterSpec: ScatterSpec = { points: D.points, label: labels, hulls, merged: newest ? newest.members : [], selected: point };
    const treeSpec: DendrogramSpec = {
      branches: bs,
      leafX: leafX(ld),
      leafLabels: LEAF_LABELS,
      shown: merges,
      highlight: newest ? merges - 1 : null,
      cut,
      colourOf: labels ? (p) => CLUSTER[labels[p] % CLUSTER.length] : undefined,
      selectedLeaf: point,
      gap: index === STEP_NATURAL ? largestGap(ld) : null,
    };
    scatter.update(scatterSpec, animate);
    tree.update(treeSpec, animate);
    rendered = true;
  }

  const unsubscribe = player.subscribe((s, cause) => render(s, rendered && cause !== 'param'));
  render(player.state, false);

  return {
    resize(w: number, h: number): void {
      size = { w, h };
      frame.invalidate();
      lastTree = '';
      render(player.state, false);
    },
    setMode(m: Mode): void {
      mode = m;
      root.dataset.mode = m;
      frame.invalidate();
      lastTree = '';
      render(player.state, false);
    },
    destroy(): void {
      destroyed = true;
      unsubscribe();
      frame.destroy();
      tree.destroy();
      root.remove();
    },
  };
}
