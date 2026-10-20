import { select } from 'd3-selection';
import 'd3-transition';
import type { ChangeCause, PlayerState, StepPlayer } from '../../core/player';
import type { SceneHandle } from '../../core/shell';
import type { Mode } from '../../core/mode';
import { fitViewport, type Rect, type Scales } from '../../core/plot/viewport';
import { AxesLayer, type AxesSpec } from '../../core/plot/axes';
import { GridLayer, type GridSize } from '../../core/plot/grid-layer';
import { TextMeasure, type Fonts } from '../../core/plot/text-measure';
import { tr, type AnySel } from '../../core/plot/transition';
import { MARK, NAVY, TEXT, WHITE, r1, trianglePath } from '../../core/plot/marks';
import { buildTree, predict, toSamples, type TreeNode } from './cart';
import type { Criterion } from './impurity';
import { DOMAIN, FEATURES, test, train, type Row } from './data';
import type { TreeParams } from './scenario';
import { deriveTreeView, pct, type TreeView } from './view';
import { CardsLayer } from './scene-cards';
import { TreeLayer, TREE_T } from './scene-tree';
import {
  CURVE_T, CurvePanel, LINES_T, curveModel, drawLines, linesModel, type CurveLayout, type LinesModel,
} from './scene-scan';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MS_STEP = 450;
/** Scan sweep frames come every 70 ms (80 ms at step 10): the line glides for less than that. */
const MS_SCAN = 60;
const NAMES = ['axes', 'pts', LINES_T, CURVE_T, TREE_T] as const;
/** Tint opacity per mode: a projector washes light tints out, so Ders is stronger (as k-NN). */
const REGION_ALPHA: Record<Mode, number> = { lab: 0.12, ders: 0.22 };
/** A press this close (px) to a threshold line grabs it. */
const GRAB_PX = 12;
/** Horizontal padding + border of div.tree-col (karar-agaci.css). */
const COL_PAD = 21;
/** Step index of the root's best-threshold race (the cards sit in the tree column). */
const ESIK_STEP = 8;

export type PointerKind = 'down' | 'move' | 'up';
export type TreeSceneHandle = SceneHandle & {
  onPointer(cb: (at: { x: number; y: number }, kind: PointerKind, near: 0 | 1 | null) => void): void;
};

interface Layout extends AxesSpec {
  fonts: Fonts;
  /** Baseline of the class legend above the plot's right end. */
  legendY: number;
  /** Left column (scatter + curve) width; the tree column takes the rest. */
  leftW: number;
  colW: number;
  scatterH: number;
  plot: Rect;
  curve: CurveLayout;
  ptR: number;
}

/**
 * Part 2 (steps 7-11), draft A at 1280×720 Ders: the scatter on top of the left
 * column with the impurity curve (≈ 24 % of the height) under it sharing its
 * horizontal extent; the right ≈ 34 % is the tree column (wider only when the
 * unlimited-depth tree needs it).
 */
function computeLayout(w: number, h: number, mode: Mode, m: TextMeasure, treeW: number): Layout {
  const fonts = m.fonts(mode);
  const pad = 10;
  const gap = Math.round(fonts.tick * 0.45);
  const ptR = mode === 'ders' ? 9 : 7;
  // wide enough for the unlimited-depth tree (no sideways scrolling), within 34-50 %
  const colW = Math.min(Math.round(w * 0.5), Math.max(Math.round(w * 0.34), Math.ceil(treeW) + COL_PAD));
  const leftW = w - colW;
  const curveH = Math.max(Math.round(h * 0.24), Math.round(fonts.axis * 1.3 + fonts.tick * 1.5 + 40));
  const scatterH = h - curveH;

  const yTickW = m.maxWidth(['0', '5'], 'tick', fonts.tick);
  const left = pad + fonts.axis * 1.2 + gap + yTickW + gap;
  const right = 18;
  const top = pad + Math.round(fonts.axis * 1.4); // the class legend sits above the plot
  const axisBelow = gap + fonts.tick * 1.2 + gap + fonts.axis * 1.25 + 4;
  const plot: Rect = {
    left, top, width: Math.max(40, leftW - left - right), height: Math.max(40, scatterH - top - axisBelow),
  };
  const xTickY = top + plot.height + gap + fonts.tick * 0.9;
  const xTitleY = xTickY + fonts.tick * 0.3 + gap + fonts.axis * 0.95;

  const cTop = Math.round(fonts.axis * 1.2 + gap);
  const cBelow = Math.round(gap + fonts.tick * 1.3 + 4);
  return {
    fonts, leftW, colW, scatterH, plot, ptR,
    legendY: top - gap,
    xTickCount: Math.max(2, Math.round(plot.width / (fonts.tick * 6))),
    yTickCount: 6,
    yTicks: [0, 1, 2, 3, 4, 5],
    xTickY,
    yTickX: left - gap,
    xTitle: { x: left + plot.width / 2, y: xTitleY, text: FEATURES[0] },
    yTitle: { x: pad + fonts.axis * 0.95, y: top + plot.height / 2, lines: [FEATURES[1]] },
    curve: {
      width: leftW,
      height: curveH,
      plot: { left, top: cTop, width: plot.width, height: Math.max(20, curveH - cTop - cBelow) },
      tickPx: fonts.tick,
      axisPx: fonts.axis,
      gap,
      ptR,
    },
  };
}

/** Structure of a tree as a short string: the region tint is recomputed only when it changes. */
export function treeKey(n: TreeNode): string {
  if (!n.split || !n.left || !n.right) return n.counts[1] > n.counts[0] ? '1' : '0';
  return `${n.split.feature}:${n.split.threshold}(${treeKey(n.left)})(${treeKey(n.right)})`;
}

/**
 * GridLayer fill for the tree's regions: each cell gets `predict` at its centre
 * in data space (x over the scale's x domain, row 0 = the top of the plot).
 */
export function regionFill(tree: TreeNode, sc: Scales): (g: GridSize, out: Uint8Array) => void {
  const [x0, x1] = sc.x.domain();
  const [y0, y1] = sc.y.domain();
  return (g, out) => {
    const xs = new Float64Array(g.cols);
    for (let c = 0; c < g.cols; c++) xs[c] = x0 + ((c + 0.5) / g.cols) * (x1 - x0);
    const at: [number, number] = [0, 0];
    for (let r = 0, i = 0; r < g.rows; r++) {
      at[1] = y1 - ((r + 0.5) / g.rows) * (y1 - y0); // row 0 = top
      for (let c = 0; c < g.cols; c++, i++) {
        at[0] = xs[c];
        out[i] = predict(tree, at);
      }
    }
  };
}

const fullTrees = new Map<Criterion, TreeNode>();
/** The unlimited-depth tree: the widest the tree column has to show. */
function fullTree(k: Criterion): TreeNode {
  let t = fullTrees.get(k);
  if (!t) {
    t = buildTree(toSamples(train), Infinity, k, DOMAIN);
    fullTrees.set(k, t);
  }
  return t;
}

function onlyUserSplitChanged(a: TreeParams, b: TreeParams): boolean {
  for (const k of Object.keys(b) as (keyof TreeParams)[]) if (k !== 'userSplit' && a[k] !== b[k]) return false;
  return true;
}

interface Pt { i: number; row: Row }

const causeRank: Record<ChangeCause, number> = { param: 0, sweep: 1, step: 2 };

/**
 * Decision-tree scene. Part 1 and 3 (tennis, book example) show only the
 * candidate cards; part 2 shows the churn scatter (Canvas region tint under an
 * SVG), the threshold scan and its impurity curve, and the growing tree. At the
 * best-threshold step the two candidate cards move into the tree column under
 * the tree, so they never cover the scatter. Every render interrupts all
 * running transitions first, so rapid step changes end in the final state.
 */
export function mountTreeScene(
  el: HTMLElement, player: StepPlayer<TreeParams>, initialMode: Mode, opts: { durationScale?: number } = {},
): TreeSceneHandle {
  const ds = opts.durationScale ?? 1;
  const doc = el.ownerDocument;
  const div = (cls: string): HTMLDivElement => {
    const d = doc.createElement('div');
    d.className = cls;
    return d;
  };

  // ---- DOM: part-2 layers in one wrapper, the cards host beside it
  const scene = div('tree-scene');
  const canvas = doc.createElement('canvas');
  canvas.className = 'regions';
  const svgEl = doc.createElementNS(SVG_NS, 'svg');
  svgEl.setAttribute('class', 'plot tree-plot');
  svgEl.setAttribute('role', 'img');
  svgEl.setAttribute('aria-label', 'Müşteri dağılım grafiği');
  const curveEl = doc.createElementNS(SVG_NS, 'svg');
  curveEl.setAttribute('class', 'curve');
  curveEl.setAttribute('aria-hidden', 'true');
  const col = div('tree-col');
  const treeLayer = new TreeLayer(col);
  const acc = doc.createElement('p');
  acc.className = 'tree-acc';
  col.append(acc);
  scene.append(canvas, svgEl, curveEl, col);
  const cardsHost = div('cards-host');
  el.append(scene, cardsHost);
  const cards = new CardsLayer(cardsHost);

  const grid = new GridLayer(canvas, MARK, REGION_ALPHA[initialMode], { measure: 'regions' });
  const svg = select(svgEl);
  const gAxes = svg.append('g').attr('class', 'axes');
  const axes = new AxesLayer(gAxes);
  const hit = svg.append('rect').attr('class', 'hit').attr('fill', 'transparent').attr('pointer-events', 'all');
  const gLines = svg.append('g').attr('class', 'lines').attr('pointer-events', 'none');
  const gHandles = svg.append('g').attr('class', 'handle-hits');
  const gPts = svg.append('g').attr('class', 'points').attr('pointer-events', 'none');
  // class key above the plot; "○ test" joins it while the test customers show
  const legend = svg.append('text').attr('class', 'legend').attr('text-anchor', 'end');
  const keys = ([['● Kaldı', TEXT[0]], ['▲ Ayrıldı', TEXT[1]], ['○ test', NAVY]] as const)
    .map(([t, c], i) => legend.append('tspan').attr('fill', c).attr('dx', i ? '0.9em' : null).text(t));
  const probe = svg.append('text').attr('class', 'probe').attr('visibility', 'hidden').attr('aria-hidden', 'true');
  const measure = new TextMeasure(probe.node()!);
  const curve = new CurvePanel(curveEl);

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  let layout: Layout | null = null;
  let layoutKey = '';
  let scales: Scales | null = null;
  let lines: LinesModel | null = null;
  let lastParams: TreeParams | null = null;
  let lastIndex = -1;
  let regionsOn = false;
  let rendered = false;
  let pending: { s: PlayerState<TreeParams>; cause: ChangeCause } | null = null;
  let rafId: number | null = null;

  function interruptAll(): void {
    for (const n of NAMES) {
      svg.selectAll('*').interrupt(n);
      select(curveEl).selectAll('*').interrupt(n);
      treeLayer.svg.selectAll('*').interrupt(n);
    }
    select(canvas).interrupt('regions');
  }

  // ---------------------------------------------------------------- render
  function render(state: PlayerState<TreeParams>, cause: ChangeCause, instant: boolean): void {
    if (!size) return;
    interruptAll();
    const p = state.params;
    const v = deriveTreeView(state.index, p);
    const dragOnly = cause === 'param' && lastParams !== null && state.index === lastIndex && onlyUserSplitChanged(lastParams, p);
    let ms = 0;
    // scan frames (the root scan, step 10's sub-branch search) glide briefly
    const scanFrame = cause === 'sweep' && (v.stepId === 'tarama' || p.subScan >= 0);
    if (ds > 0 && !instant && !dragOnly) ms = (scanFrame ? MS_SCAN : MS_STEP) * ds;

    const part2 = v.part === 2;
    scene.hidden = !part2;
    // the cards fill the stage in parts 1 and 3, and sit under the tree in part 2
    const cardsParent = part2 ? col : el;
    if (cardsHost.parentElement !== cardsParent) {
      if (part2) col.insertBefore(cardsHost, acc);
      else el.append(cardsHost);
    }
    if (part2) renderPart2(v, p, state.index, ms);
    cards.update(v, ms);

    lastParams = p;
    lastIndex = state.index;
    rendered = true;
  }

  function renderPart2(v: TreeView, p: TreeParams, index: number, ms: number): void {
    const { w, h } = size!;
    const key = `${w}x${h}|${mode}|${v.criterion}`;
    if (key !== layoutKey || !layout) {
      layout = computeLayout(w, h, mode, measure, treeLayer.widthOf(fullTree(v.criterion), v.criterion, mode));
      layoutKey = key;
      svg.attr('width', layout.leftW).attr('height', layout.scatterH);
      grid.resize(layout.leftW, layout.scatterH);
      curveEl.style.top = `${layout.scatterH}px`;
      Object.assign(col.style, { left: `${layout.leftW}px`, width: `${layout.colW}px`, height: `${h}px` });
    }
    const L = layout;
    const sc = fitViewport({ x: [DOMAIN.x[0], DOMAIN.x[1]], y: [DOMAIN.y[0], DOMAIN.y[1]] }, L.plot, false);
    const { plot } = L;
    hit.attr('x', plot.left).attr('y', plot.top).attr('width', plot.width).attr('height', plot.height);
    axes.draw(sc, plot, L, ms, 'churn');
    legend.attr('x', r1(plot.left + plot.width)).attr('y', r1(L.legendY));
    keys[2].attr('display', v.showTest ? null : 'none');

    drawRegions(v, sc, plot, ms);
    lines = linesModel(v, p, index, mode === 'lab');
    drawLines(gLines, gHandles, lines, sc, ms);
    drawPoints(v, sc, L, ms);
    curve.update(curveModel(v, p), v.criterion, L.curve, sc.x, ms);

    // the tree column: tree, (cards at step 9), accuracies
    const innerW = L.colW - COL_PAD;
    treeLayer.update(v.tree, v.criterion, mode, innerW, ms);
    const showAcc = v.acc !== null && !!v.tree?.split && index !== ESIK_STEP && p.userSplit === null;
    acc.hidden = !showAcc;
    if (showAcc && v.acc) {
      const rows = [`Eğitim doğruluğu ${pct(v.acc.train)}`];
      if (v.acc.test !== null) rows.push(`Test doğruluğu ${pct(v.acc.test)}`);
      acc.replaceChildren(...rows.map((t) => {
        const s = doc.createElement('span');
        s.textContent = t;
        return s;
      }));
    }
    scales = sc;
  }

  function drawRegions(v: TreeView, sc: Scales, plot: Rect, ms: number): void {
    const tree = v.tree;
    const on = !!tree?.split;
    if (!on || !tree) {
      grid.update(null, plot, () => {});
      regionsOn = false;
      return;
    }
    const [x0, x1] = sc.x.domain();
    const [y0, y1] = sc.y.domain();
    grid.update(`${treeKey(tree)}|${x0}|${x1}|${y0}|${y1}`, plot, regionFill(tree, sc));
    const c = select(canvas);
    if (!regionsOn && ms > 0) c.style('opacity', '0').transition('regions').duration(ms).style('opacity', '1');
    else c.style('opacity', '1');
    regionsOn = true;
  }

  function drawPoints(v: TreeView, sc: Scales, L: Layout, ms: number): void {
    const pos = (d: Pt): string => `translate(${r1(sc.x(d.row.t))},${r1(sc.y(d.row.c + d.row.jy))})`;
    const join = (tag: 'circle' | 'path', cls: string, data: Pt[]): AnySel =>
      gPts.selectAll<SVGElement, Pt>(`${tag}.${cls.split(' ').join('.')}`).data(data, (d) => d.i).join(
        (enter) => enter.append(tag).attr('class', cls).attr('data-i', (d) => d.i)
          .attr('transform', pos).attr('opacity', 0),
        (update) => update,
        (exit) => { tr(exit, 'pts', ms).attr('opacity', 0).remove(); },
      );
    const tr0 = train.map((row, i) => ({ i, row }));
    const te = v.showTest ? test.map((row, i) => ({ i, row })) : [];
    const filled: AnySel[] = [
      join('circle', 'pt kaldi', tr0.filter((d) => d.row.y === 0)).attr('r', L.ptR).attr('fill', MARK[0]),
      join('path', 'pt ayrildi', tr0.filter((d) => d.row.y === 1)).attr('d', trianglePath(L.ptR)).attr('fill', MARK[1]),
    ];
    for (const s of filled) s.attr('stroke', WHITE).attr('stroke-width', 1);
    // test customers: hollow marks in the class colour
    const hollow: AnySel[] = [
      join('circle', 'pt test', te.filter((d) => d.row.y === 0)).attr('r', L.ptR).attr('stroke', MARK[0]),
      join('path', 'pt test', te.filter((d) => d.row.y === 1)).attr('d', trianglePath(L.ptR)).attr('stroke', MARK[1]),
    ];
    for (const s of hollow) s.attr('fill', 'none').attr('stroke-width', 2.5);
    for (const s of [...filled, ...hollow]) tr(s, 'pts', ms).attr('transform', pos).attr('opacity', 1);
  }

  // ---------------------------------------------------------------- player → render
  function flush(): void {
    rafId = null;
    const p = pending;
    pending = null;
    if (p) render(p.s, p.cause, false);
  }
  const raf = (cb: () => void): number =>
    typeof requestAnimationFrame === 'function' ? requestAnimationFrame(cb) : (setTimeout(cb, 16) as unknown as number);
  const cancelRaf = (id: number): void => {
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
    else clearTimeout(id);
  };
  const unsubscribe = player.subscribe((s, cause) => {
    const merged = pending && causeRank[pending.cause] > causeRank[cause] ? pending.cause : cause;
    pending = { s, cause: merged };
    if (ds === 0) flush();
    else if (rafId === null) rafId = raf(flush);
  });

  // ---------------------------------------------------------------- pointer
  type Cb = (at: { x: number; y: number }, kind: PointerKind, near: 0 | 1 | null) => void;
  const pointerCbs = new Set<Cb>();
  let captured: number | null = null;

  function locate(ev: PointerEvent): { at: { x: number; y: number }; near: 0 | 1 | null; inside: boolean } | null {
    if (!scales || !layout || scene.hidden) return null;
    const box = svgEl.getBoundingClientRect();
    const px = ev.clientX - box.left;
    const py = ev.clientY - box.top;
    const { plot } = layout;
    const inside = px >= plot.left && px <= plot.left + plot.width && py >= plot.top && py <= plot.top + plot.height;
    const sc = scales;
    const dist = (t: { feature: 0 | 1; threshold: number }): number =>
      (t.feature === 0 ? Math.abs(px - sc.x(t.threshold)) : Math.abs(py - sc.y(t.threshold)));
    // the active line (scan or Lab line) wins when within reach; else the nearest handle / tree line
    let near: 0 | 1 | null = lines?.scan && dist(lines.scan) <= GRAB_PX ? lines.scan.feature : null;
    let best = GRAB_PX;
    for (const t of near === null ? [lines?.chosen, ...(lines?.handles ?? [])] : []) {
      if (!t) continue;
      const d = dist(t);
      if (d <= GRAB_PX && (near === null || d < best)) { // ties keep the earlier line
        best = d;
        near = t.feature;
      }
    }
    return { at: { x: scales.x.invert(px), y: scales.y.invert(py) }, near, inside };
  }
  const emit = (l: { at: { x: number; y: number }; near: 0 | 1 | null }, kind: PointerKind): void => {
    for (const cb of [...pointerCbs]) cb(l.at, kind, l.near);
  };
  const onDown = (ev: PointerEvent): void => {
    if (ev.button > 0) return;
    const l = locate(ev);
    if (!l || !l.inside) return;
    captured = ev.pointerId ?? 0;
    try { svgEl.setPointerCapture?.(ev.pointerId); } catch { /* synthetic or stale pointer */ }
    emit(l, 'down');
  };
  const onMove = (ev: PointerEvent): void => {
    const l = locate(ev);
    if (l && (captured !== null || l.inside)) emit(l, 'move');
  };
  const onUp = (ev: PointerEvent): void => {
    const l = locate(ev);
    const was = captured !== null;
    if (was) {
      try { svgEl.releasePointerCapture?.(ev.pointerId); } catch { /* already released */ }
      captured = null;
    }
    if (l && (was || l.inside)) emit(l, 'up');
  };
  const onLost = (): void => { captured = null; };
  svgEl.addEventListener('pointerdown', onDown);
  svgEl.addEventListener('pointermove', onMove);
  svgEl.addEventListener('pointerup', onUp);
  svgEl.addEventListener('pointercancel', onUp);
  svgEl.addEventListener('lostpointercapture', onLost);

  // ---------------------------------------------------------------- handle
  return {
    resize(w: number, h: number): void {
      size = { w, h };
      layoutKey = '';
      if (rafId !== null) cancelRaf(rafId);
      rafId = null;
      pending = null;
      // the first draw animates in; later resizes are instant
      render(player.state, 'step', rendered);
    },
    setMode(m: Mode): void {
      if (m === mode) return;
      mode = m;
      layoutKey = '';
      grid.setAlpha(REGION_ALPHA[m]);
      if (size) render(player.state, 'step', true);
    },
    destroy(): void {
      unsubscribe();
      if (rafId !== null) cancelRaf(rafId);
      rafId = null;
      pending = null;
      interruptAll();
      svgEl.removeEventListener('pointerdown', onDown);
      svgEl.removeEventListener('pointermove', onMove);
      svgEl.removeEventListener('pointerup', onUp);
      svgEl.removeEventListener('pointercancel', onUp);
      svgEl.removeEventListener('lostpointercapture', onLost);
      pointerCbs.clear();
      cards.destroy();
      treeLayer.destroy();
      scene.remove();
      cardsHost.remove();
    },
    onPointer(cb): void {
      pointerCbs.add(cb);
    },
  };
}
