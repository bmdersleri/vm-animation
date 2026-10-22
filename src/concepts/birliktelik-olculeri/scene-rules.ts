import { select, type Selection } from 'd3-selection';
import { formatNumber } from '../../core/plot/format';
import { AxesLayer } from '../../core/plot/axes';
import { chooseOffset, labelArea, labelBox, offsets, type Anchor, type Box } from '../../core/plot/label-place';
import { ACCENT, NAVY, WHITE, r1 } from '../../core/plot/marks';
import { fitViewport, type Rect } from '../../core/plot/viewport';
import type { Itemset } from '../birliktelik/data';
import { setKey } from '../birliktelik/format';
import type { Rule } from '../birliktelik/rules';
import { ratioText, ruleText, sameSpot } from './view';

const SVG_NS = 'http://www.w3.org/2000/svg';
type G = Selection<SVGGElement, unknown, null, undefined>;

export interface RuleScatterSpec {
  rules: readonly Rule[];
  minSupport: number;
  minConfidence: number;
  /** Lift filter: rules with lift at most this fade; 0 = filter off. */
  minLift: number;
  /** The chosen X -> Y; marked when it is one of the rules. */
  selected: { x: Itemset; y: Itemset };
  /** Fallback size (px) when the slot has no layout yet. */
  width: number;
  height: number;
  /** Lab only: points are focusable buttons that pick their rule. In Ders they are plain marks, so the step keys keep working. */
  interactive: boolean;
}

export interface RuleScatter {
  update(spec: RuleScatterSpec): void;
  destroy(): void;
}

const EPS = 1e-9;
export const ruleKey = (r: { x: Itemset; y: Itemset }): string => `${setKey(r.x)}>${setKey(r.y)}`;
/** Marker radius grows with lift. */
export const radiusOf = (lift: number): number => Math.min(17, 3 + 6 * lift);
/** The rule stays in colour: no filter, or its lift is above the filter. */
export const isKept = (r: Rule, minLift: number): boolean => minLift <= 0 || r.lift > minLift + EPS;
const hollow = (r: Rule): boolean => r.lift <= 1 + EPS;

const LEGEND_FILLED = '<svg class="bk-key-mark" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="#14365C"/></svg>';
const LEGEND_HOLLOW = '<svg class="bk-key-mark" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="#fff" stroke="#A85A00" stroke-width="2.5"/></svg>';

/** Rule scatter: support (x) against confidence (y); marker size and fill carry lift (hollow = lift at most 1). */
export function mountRuleScatter(host: HTMLElement, onPick: (rule: Rule) => void): RuleScatter {
  const legend = document.createElement('p');
  legend.className = 'bk-rule-legend';
  legend.innerHTML =
    `<span class="bk-key">${LEGEND_FILLED} dolu daire: kaldıraç 1'den büyük</span>` +
    `<span class="bk-key">${LEGEND_HOLLOW} içi boş daire: kaldıraç 1 ya da altı</span>` +
    '<span class="bk-key">daire boyu kaldıraçla büyür</span>';
  const plotHost = document.createElement('div');
  plotHost.className = 'bk-plot-host';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'bk-plot');
  svg.setAttribute('role', 'group');
  plotHost.append(svg);
  host.append(legend, plotHost);

  const root = select(svg);
  const gAxes = root.append('g').attr('class', 'bk-axes') as unknown as G;
  const gLines = root.append('g').attr('class', 'bk-lines') as unknown as G;
  const gPoints = root.append('g').attr('class', 'bk-points') as unknown as G;
  const gLabels = root.append('g').attr('class', 'bk-labels') as unknown as G;
  const axes = new AxesLayer(gAxes);
  const nodes = new Map<string, SVGGElement>();
  let current: readonly Rule[] = [];
  let interactive = false;
  /** Key of the rule marked as chosen at the last update. */
  let selKey = '';

  const ruleAt = (e: Event): Rule | undefined => {
    const g = (e.target as Element).closest<SVGGElement>('.bk-rule-pt');
    return g ? current.find((r) => ruleKey(r) === g.dataset.key) : undefined;
  };
  /**
   * A click picks the rule under the pointer. Rules with the same support and confidence share one point, and
   * only the top marker takes the click, so a click on the point of the chosen rule picks the next rule there.
   */
  const onClick = (e: Event): void => {
    const rule = interactive ? ruleAt(e) : undefined;
    if (!rule) return;
    const group = sameSpot(current, rule);
    const at = group.findIndex((r) => ruleKey(r) === selKey);
    onPick(at < 0 ? rule : group[(at + 1) % group.length]);
  };
  /** Every point is its own tab stop, so Enter / Space pick exactly the focused rule. */
  const onKey = (e: KeyboardEvent): void => {
    if (!interactive || (e.key !== 'Enter' && e.key !== ' ')) return;
    const rule = ruleAt(e);
    if (!rule) return;
    e.preventDefault();
    e.stopPropagation();
    onPick(rule);
  };
  svg.addEventListener('click', onClick);
  svg.addEventListener('keydown', onKey);

  function node(rule: Rule): SVGGElement {
    const key = ruleKey(rule);
    let g = nodes.get(key);
    if (!g) {
      g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', 'bk-rule-pt');
      g.dataset.key = key;
      const ring = document.createElementNS(SVG_NS, 'circle');
      ring.setAttribute('class', 'bk-rule-ring');
      ring.setAttribute('fill', 'none');
      ring.setAttribute('stroke', NAVY);
      ring.setAttribute('stroke-width', '3');
      ring.setAttribute('stroke-dasharray', '4 3');
      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('class', 'bk-rule-dot');
      g.append(ring, dot);
      nodes.set(key, g);
    }
    return g;
  }

  function update(spec: RuleScatterSpec): void {
    const fsRaw = parseFloat(getComputedStyle(svg).fontSize);
    const fs = Number.isFinite(fsRaw) && fsRaw > 0 ? fsRaw : 16;
    const hr = plotHost.getBoundingClientRect();
    const W = Math.floor(hr.width > 0 ? hr.width : spec.width);
    const H = Math.floor(hr.height > 0 ? hr.height : spec.height);
    svg.setAttribute('width', String(W));
    svg.setAttribute('height', String(H));
    current = spec.rules;
    interactive = spec.interactive;
    if (!interactive && svg.contains(document.activeElement)) (document.activeElement as SVGElement).blur();

    const left = Math.round(fs * 3.4);
    const top = Math.round(fs * 1.2);
    const plot: Rect = {
      left, top,
      width: Math.max(60, W - left - Math.round(fs * 1.6)),
      height: Math.max(60, H - top - Math.round(fs * 3.4)),
    };
    const maxSup = Math.max(spec.minSupport, ...spec.rules.map((r) => r.support));
    const xMax = Math.max(0.6, Math.ceil((maxSup + 0.02) * 10 - EPS) / 10);
    const sc = fitViewport({ x: [0, xMax], y: [0, 1.05] }, plot, false);
    const bottom = plot.top + plot.height;
    const right = plot.left + plot.width;
    svg.setAttribute('aria-label', `Kural saçılımı: ${spec.rules.length} kural; yatay eksen destek, dikey eksen güven`);

    axes.draw(sc, plot, {
      xTickCount: 6, yTickCount: 5, xTickY: bottom + fs * 1.3, yTickX: plot.left - 6,
      xTitle: { x: plot.left + plot.width / 2, y: bottom + fs * 2.8, text: 'destek (fişlerin oranı)' },
      yTitle: { x: fs * 1.1, y: plot.top + plot.height / 2, lines: ['güven'] },
    }, 0, 'rules');

    // threshold lines and their labels
    const taken: Box[] = [];
    gLines.selectAll('*').remove();
    const sx = r1(sc.x(spec.minSupport));
    const cy = r1(sc.y(spec.minConfidence));
    const line = (x1: number, y1: number, x2: number, y2: number, cls: string): void => {
      gLines.append('line').attr('class', cls).attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2)
        .attr('stroke', ACCENT).attr('stroke-width', 2).attr('stroke-dasharray', '6 4');
    };
    line(sx, plot.top, sx, bottom, 'bk-thr-support');
    line(plot.left, cy, right, cy, 'bk-thr-conf');
    const sAnchor: Anchor = sx > right - fs * 9 ? 'end' : 'start';
    const thresholds = [
      { text: `min_support ${formatNumber(spec.minSupport, 2)}`, x: sAnchor === 'end' ? sx - 5 : sx + 5, y: bottom - 6, anchor: sAnchor, cls: 'support' },
      { text: `min güven ${formatNumber(spec.minConfidence, 2)}`, x: right - 6, y: Math.max(plot.top + fs, cy - 6), anchor: 'end' as Anchor, cls: 'conf' },
    ];
    for (const t of thresholds) {
      gLines.append('text').attr('class', `bk-thr-label ${t.cls}`).attr('x', r1(t.x)).attr('y', r1(t.y)).attr('text-anchor', t.anchor)
        .attr('fill', ACCENT).attr('font-weight', 700).attr('stroke', WHITE).attr('stroke-width', 3).attr('paint-order', 'stroke').text(t.text);
      taken.push(labelBox(t.x, t.y, t.text.length, t.anchor, fs));
    }

    // points (keyed nodes keep keyboard focus across updates)
    const active = svg.contains(document.activeElement) ? (document.activeElement as SVGElement) : null;
    const keep = new Set(spec.rules.map(ruleKey));
    for (const [k, g] of nodes) if (!keep.has(k)) { g.remove(); nodes.delete(k); }
    selKey = ruleKey(spec.selected);
    const pos = new Map<string, { x: number; y: number; r: number }>();
    for (const rule of spec.rules) {
      const g = node(rule);
      const key = ruleKey(rule);
      const x = r1(sc.x(rule.support));
      const y = r1(sc.y(rule.confidence));
      const r = r1(radiusOf(rule.lift));
      pos.set(key, { x, y, r });
      g.setAttribute('transform', `translate(${x},${y})`);
      g.dataset.dim = String(!isKept(rule, spec.minLift));
      g.dataset.selected = String(key === selKey);
      g.dataset.hollow = String(hollow(rule));
      g.dataset.lift = String(rule.lift);
      g.dataset.support = String(rule.support);
      g.dataset.confidence = String(rule.confidence);
      if (interactive) {
        g.setAttribute('role', 'button');
        g.setAttribute('tabindex', '0');
      } else {
        g.removeAttribute('role');
        g.removeAttribute('tabindex');
      }
      g.setAttribute('aria-label', `${ruleText(rule)}: destek ${ratioText(rule.support)}, güven ${ratioText(rule.confidence)}, kaldıraç ${ratioText(rule.lift)}`);
      const [ring, dot] = [g.children[0], g.children[1]];
      ring.setAttribute('r', String(r1(r + 4)));
      ring.setAttribute('visibility', key === selKey ? 'visible' : 'hidden');
      dot.setAttribute('r', String(r));
      if (hollow(rule)) {
        dot.setAttribute('fill', WHITE);
        dot.setAttribute('stroke', ACCENT);
        dot.setAttribute('stroke-width', '2.5');
      } else {
        dot.setAttribute('fill', NAVY);
        dot.setAttribute('stroke', WHITE);
        dot.setAttribute('stroke-width', '1');
      }
    }
    // Draw order = rule order (big lift first, so small markers stay on top); re-append only when it changed.
    const order = spec.rules.map(ruleKey);
    const have = Array.from(gPoints.node()!.children, (c) => (c as SVGElement).dataset.key);
    if (order.length !== have.length || order.some((k, i) => k !== have[i])) {
      for (const k of order) gPoints.node()!.append(nodes.get(k)!);
      if (active && !svg.contains(document.activeElement)) active.focus();
    }

    // labels: the top kept rule (filter on) and the chosen rule
    gLabels.selectAll('*').remove();
    const topRule = spec.minLift > 0 ? spec.rules.find((r) => isKept(r, spec.minLift)) : undefined;
    const chosen = spec.rules.find((r) => ruleKey(r) === selKey);
    const labelled = [topRule, chosen && chosen !== topRule ? chosen : undefined].filter((r): r is Rule => r !== undefined);
    for (const [key, p] of pos) {
      if (labelled.some((r) => ruleKey(r) === key)) continue;
      taken.push({ l: p.x - p.r, t: p.y - p.r, r: p.x + p.r, b: p.y + p.r });
    }
    const area = labelArea(plot);
    for (const rule of labelled) {
      const p = pos.get(ruleKey(rule))!;
      const text = ruleText(rule);
      const o = chooseOffset({ x: p.x, y: p.y, chars: text.length, cands: offsets(p.r + 4, 4, fs), fs, taken, area });
      gLabels.append('text').attr('class', rule === topRule ? 'bk-rule-label top' : 'bk-rule-label')
        .attr('x', r1(p.x + o.dx)).attr('y', r1(p.y + o.dy)).attr('text-anchor', o.anchor)
        .attr('fill', NAVY).attr('font-weight', 700).attr('stroke', WHITE).attr('stroke-width', 3).attr('paint-order', 'stroke').text(text);
    }

    if (spec.rules.length === 0) {
      gLabels.append('text').attr('class', 'bk-rule-empty')
        .attr('x', r1(plot.left + plot.width / 2)).attr('y', r1(plot.top + plot.height / 2))
        .attr('text-anchor', 'middle').attr('fill', NAVY).text('Bu eşiklerde kural yok.');
    }
  }

  return {
    update,
    destroy(): void {
      svg.removeEventListener('click', onClick);
      svg.removeEventListener('keydown', onKey);
      legend.remove();
      plotHost.remove();
    },
  };
}
