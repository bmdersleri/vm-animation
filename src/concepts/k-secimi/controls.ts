import type { StepPlayer } from '../../core/player';
import { kmeansData } from '../kmeans/data';
import type { KSecimiParams } from './scenario';
import { clampK } from './view';

/** Silhouette steps (0-based 5..8) are where a point can be picked. */
const PICK_FIRST = 5;
const PICK_LAST = 8;
const KMAX = kmeansData.ks.length;
const N = kmeansData.points.length;

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

/**
 * Lab parameter panel: the k slider (1..10) and, on the silhouette steps, the point picker.
 * The picker shows point numbers 1..150 (as the scene labels them); params hold the 0-based index.
 * Both controls write through setParam, which cancels a running sweep on k.
 */
export function mountKSecimiParams(host: HTMLElement, player: StepPlayer<KSecimiParams>): void {
  const id = `ksp${++uid}`;

  const k = el('input', { type: 'range', id: `${id}-k`, 'data-param': 'k', min: '1', max: String(KMAX), step: '1' });
  const kOut = el('output', { class: 'ks-k-out', for: k.id });
  const kGroup = el('div', { class: 'ctl range' }, el('label', { for: k.id }, 'k (küme sayısı)'), k, kOut);

  const pt = el('input', { type: 'number', id: `${id}-pt`, 'data-param': 'point', min: '1', max: String(N), step: '1', inputmode: 'numeric' });
  const ptGroup = el('div', { class: 'ctl ks-pick' },
    el('label', { for: pt.id }, `Nokta (1–${N})`), pt,
    el('span', { class: 'ks-pick-hint', id: `${id}-hint` }, 'ya da saçılımda bir noktaya tıkla'));
  pt.setAttribute('aria-describedby', `${id}-hint`);

  host.append(el('div', { class: 'ks-params' }, kGroup, ptGroup));

  k.addEventListener('input', () => player.setParam('k', clampK(Number(k.value))));
  pt.addEventListener('input', () => {
    const v = Math.trunc(Number(pt.value));
    if (pt.value.trim() === '' || !Number.isFinite(v) || v < 1 || v > N) return;
    player.setParam('point', v - 1);
  });

  // Only values that differ are written back, so focus and a slider mid-drag are left alone.
  const sync = (): void => {
    const { index, params } = player.state;
    const kv = clampK(params.k);
    if (k.value !== String(kv)) k.value = String(kv);
    k.setAttribute('aria-valuetext', `k = ${kv}`);
    setText(kOut, `k = ${kv}`);
    ptGroup.hidden = !(index >= PICK_FIRST && index <= PICK_LAST && kv >= 2);
    const want = params.point === null ? '' : String(params.point + 1);
    if (pt.value !== want && document.activeElement !== pt) pt.value = want;
  };
  sync();
  player.subscribe(sync);
}
