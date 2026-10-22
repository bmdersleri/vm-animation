import type { StepPlayer } from '../../core/player';
import { dbscanData } from './data';
import { dbscanScenario, type DbscanParams } from './scenario';
import { formatNumber } from '../../core/plot/format';
import { stepIndex } from '../../core/player';

const N = dbscanData.points.length;
const EPS_MIN = 0.05;
const EPS_MAX = 1;
const MS_MIN = 2;
const MS_MAX = 15;
/** Steps 3-8 (0-based 2..7) pick a point; step 9 shows eps, step 10 min_samples. */
const POINT_FIRST = stepIndex(dbscanScenario, 'eps');
const POINT_LAST = stepIndex(dbscanScenario, 'yayilma');
const STEP_EPS_SWEEP = stepIndex(dbscanScenario, 'eps-degisir');
const STEP_KDIST = stepIndex(dbscanScenario, 'k-uzaklik');

let uid = 0;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...children);
  return e;
}
const setText = (e: HTMLElement, text: string): void => {
  if (e.textContent !== text) e.textContent = text;
};
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
/** eps stays on the 0.01 grid: rounding removes floating error such as 0.30000000000000004. */
export const snapEps = (v: number): number => clamp(Math.round(v * 100) / 100, EPS_MIN, EPS_MAX);
export const snapMinSamples = (v: number): number => clamp(Math.round(v), MS_MIN, MS_MAX);

/**
 * Lab parameter panel: point picker (numbers 1..210, stored 0-based), eps and min_samples sliders.
 * Each step shows only its own controls. A slider write during the spread sweep ends the sweep.
 */
export function mountDbscanParams(host: HTMLElement, player: StepPlayer<DbscanParams>): void {
  const id = `dbp${++uid}`;

  const eps = el('input', { type: 'range', id: `${id}-eps`, 'data-param': 'eps', min: String(EPS_MIN), max: String(EPS_MAX), step: '0.01' });
  const epsOut = el('output', { class: 'db-out', for: eps.id });
  const epsGroup = el('div', { class: 'ctl range' }, el('label', { for: eps.id }, 'eps (yarıçap)'), eps, epsOut);

  const ms = el('input', { type: 'range', id: `${id}-ms`, 'data-param': 'minSamples', min: String(MS_MIN), max: String(MS_MAX), step: '1' });
  const msOut = el('output', { class: 'db-out', for: ms.id });
  const msGroup = el('div', { class: 'ctl range' }, el('label', { for: ms.id }, 'min_samples'), ms, msOut);

  const pt = el('input', { type: 'number', id: `${id}-pt`, 'data-param': 'point', min: '1', max: String(N), step: '1', inputmode: 'numeric' });
  const ptGroup = el('div', { class: 'ctl db-pick' },
    el('label', { for: pt.id }, `Nokta (1–${N})`), pt,
    el('span', { class: 'db-pick-hint', id: `${id}-hint` }, 'ya da saçılımda bir noktaya tıkla'));
  pt.setAttribute('aria-describedby', `${id}-hint`);

  host.append(el('div', { class: 'db-params' }, ptGroup, epsGroup, msGroup));

  /** Writing the swept value (spread) to its end value stops a running spread sweep. */
  const write = (patch: Partial<DbscanParams>): void => {
    const sweep = player.state.step.sweep;
    if (sweep && sweep.key === 'spread') patch = { ...patch, spread: 1 };
    player.setParams(patch);
  };
  eps.addEventListener('input', () => {
    const v = Number(eps.value);
    if (Number.isFinite(v)) write({ eps: snapEps(v) });
  });
  ms.addEventListener('input', () => {
    const v = Number(ms.value);
    if (Number.isFinite(v)) write({ minSamples: snapMinSamples(v) });
  });
  pt.addEventListener('input', () => {
    const v = Math.trunc(Number(pt.value));
    if (pt.value.trim() === '' || !Number.isFinite(v) || v < 1 || v > N) return;
    write({ point: v - 1 });
  });

  // Only values that differ are written back, so focus and a slider mid-drag are left alone.
  const sync = (): void => {
    const { index, params } = player.state;
    const e = snapEps(params.eps);
    const m = snapMinSamples(params.minSamples);
    if (Number(eps.value) !== e) eps.value = String(e);
    if (ms.value !== String(m)) ms.value = String(m);
    setText(epsOut, `eps = ${formatNumber(e, 2)}`);
    setText(msOut, `min_samples = ${m}`);
    eps.setAttribute('aria-valuetext', `eps = ${formatNumber(e, 2)}`);
    const pick = index >= POINT_FIRST && index <= POINT_LAST;
    ptGroup.hidden = !pick;
    epsGroup.hidden = !(pick || index === STEP_EPS_SWEEP);
    msGroup.hidden = !(pick || index === STEP_KDIST);
    const want = params.point === null ? '' : String(params.point + 1);
    if (pt.value !== want && document.activeElement !== pt) pt.value = want;
  };
  sync();
  player.subscribe(sync);
}
