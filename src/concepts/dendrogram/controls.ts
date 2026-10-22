import type { StepPlayer } from '../../core/player';
import { stepIndex } from '../../core/player';
import { formatNumber } from '../../core/plot/format';
import { dendrogramData as D, type Linkage } from './data';
import { dendrogramScenario, type DendrogramParams } from './scenario';
import { cutForK, kAtHeight } from './tree';
import { LINKAGE_NAME, maxHeightOf } from './view';

const N = D.points.length;
const MERGES = N - 1;
const K_MAX = 6;
const HEADROOM = 1.05;
const LINKAGES: readonly Linkage[] = ['ward', 'complete', 'average', 'single'];
/** Steps 1-5 (0-based 0..4) show the merge controls; from the cut step on, the cut controls. */
const CUT_FIRST = stepIndex(dendrogramScenario, 'kesim');

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
const clampMerges = (v: number): number => (Number.isFinite(v) ? clamp(Math.round(v), 0, MERGES) : 0);
/** The cluster count of a cut at height h, limited to the stored 1..6 cuts. */
export const kForHeight = (linkage: Linkage, h: number): number => clamp(kAtHeight(D.linkages[linkage], h), 1, K_MAX);

/**
 * Lab parameter panel: linkage select (always), merge slider with step buttons (steps 1-5),
 * cut slider with k buttons (steps 6-10) and a point picker. The cut is stored as k, so a linkage
 * change keeps the cluster count and the cut line is re-placed in the new tree. Any write to a
 * control during a merge or k sweep also writes the swept key, which ends the sweep.
 */
export function mountDendrogramParams(host: HTMLElement, player: StepPlayer<DendrogramParams>): void {
  const id = `dgp${++uid}`;

  const linkage = el('select', { id: `${id}-link`, 'data-param': 'linkage' });
  for (const l of LINKAGES) linkage.append(el('option', { value: l }, LINKAGE_NAME[l]));
  const linkGroup = el('div', { class: 'ctl dg-link', 'data-group': 'linkage' }, el('label', { for: linkage.id }, 'Bağlantı'), linkage);

  const merges = el('input', { type: 'range', id: `${id}-m`, 'data-param': 'merges', min: '0', max: String(MERGES), step: '1' });
  const prev = el('button', { type: 'button', 'data-act': 'prev-merge', 'aria-label': 'Önceki birleşme' }, '◀');
  const next = el('button', { type: 'button', 'data-act': 'next-merge', 'aria-label': 'Sonraki birleşme' }, '▶');
  const lastBtn = el('button', { type: 'button', 'data-act': 'last-merge' }, 'Sona git');
  const mergeOut = el('output', { class: 'dg-out', for: merges.id });
  const mergeGroup = el('div', { class: 'ctl dg-merge', 'data-group': 'merges' },
    el('label', { for: merges.id }, 'Birleşme'), merges, el('span', { class: 'dg-step-btns' }, prev, next, lastBtn), mergeOut);

  const cut = el('input', { type: 'range', id: `${id}-cut`, 'data-param': 'cut', min: '0', step: '0.01' });
  const cutOut = el('output', { class: 'dg-out', for: cut.id });
  const kBtns = Array.from({ length: K_MAX }, (_v, i) =>
    el('button', { type: 'button', 'data-k': String(i + 1), 'aria-pressed': 'false', 'aria-label': `${i + 1} küme` }, String(i + 1)));
  const cutGroup = el('div', { class: 'ctl dg-cut-ctl', 'data-group': 'cut' },
    el('label', { for: cut.id }, 'Kesim yüksekliği'), cut,
    el('span', { class: 'dg-k-btns', role: 'group', 'aria-label': 'Küme sayısı' }, ...kBtns), cutOut);

  const pt = el('input', { type: 'number', id: `${id}-pt`, 'data-param': 'point', min: '1', max: String(N), step: '1', inputmode: 'numeric' });
  const ptGroup = el('div', { class: 'ctl dg-pick', 'data-group': 'point' },
    el('label', { for: pt.id }, `Nokta (1–${N})`), pt,
    el('span', { class: 'dg-pick-hint', id: `${id}-hint` }, 'ya da saçılımda / dendrogramda tıkla'));
  pt.setAttribute('aria-describedby', `${id}-hint`);

  // Mouse clicks must not leave focus on a button: keyboard.ts ignores the step keys while one is focused.
  for (const b of [prev, next, lastBtn, ...kBtns]) b.addEventListener('mousedown', (e) => e.preventDefault());

  host.append(el('div', { class: 'dg-params' }, linkGroup, mergeGroup, cutGroup, ptGroup));

  /** Writing the swept key (to its current value) ends a running merge or k sweep. */
  const write = (patch: Partial<DendrogramParams>): void => {
    const sweep = player.state.step.sweep;
    if (sweep && (sweep.key === 'merges' || sweep.key === 'k') && !(sweep.key in patch)) {
      patch = { ...patch, [sweep.key]: player.state.params[sweep.key] };
    }
    player.setParams(patch);
  };
  const setMerges = (m: number): void => write({ merges: clampMerges(m) });
  const setK = (k: number): void => write({ k: clamp(Math.round(k), 1, K_MAX) });

  linkage.addEventListener('change', () => {
    if ((LINKAGES as readonly string[]).includes(linkage.value)) write({ linkage: linkage.value as Linkage });
  });
  merges.addEventListener('input', () => {
    const v = Number(merges.value);
    if (Number.isFinite(v)) setMerges(v);
  });
  prev.addEventListener('click', () => setMerges(player.state.params.merges - 1));
  next.addEventListener('click', () => setMerges(player.state.params.merges + 1));
  lastBtn.addEventListener('click', () => setMerges(MERGES));
  cut.addEventListener('input', () => {
    const v = Number(cut.value);
    if (Number.isFinite(v)) setK(kForHeight(player.state.params.linkage, v));
  });
  for (const b of kBtns) b.addEventListener('click', () => setK(Number(b.dataset.k)));
  pt.addEventListener('input', () => {
    const v = Math.trunc(Number(pt.value));
    if (pt.value.trim() === '' || !Number.isFinite(v) || v < 1 || v > N) return;
    write({ point: v - 1 });
  });

  // Only values that differ are written back, so focus and a slider mid-drag are left alone.
  const sync = (): void => {
    const { index, params } = player.state;
    const m = clampMerges(params.merges);
    const cutStep = index >= CUT_FIRST;
    mergeGroup.hidden = cutStep;
    cutGroup.hidden = !cutStep;
    if (merges.value !== String(m)) merges.value = String(m);
    prev.disabled = m <= 0;
    next.disabled = lastBtn.disabled = m >= MERGES;
    setText(mergeOut, `${m} / ${MERGES}`);

    const max = Math.round(maxHeightOf(params.linkage) * HEADROOM * 1e6) / 1e6;
    if (Number(cut.max) !== max) cut.max = String(max);
    const k = params.k !== null && Number.isInteger(params.k) ? clamp(params.k, 1, K_MAX) : null;
    if (k !== null && kForHeight(params.linkage, Number(cut.value)) !== k) cut.value = String(cutForK(D.linkages[params.linkage], k));
    kBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(k === i + 1)));
    const h = k === null ? '' : formatNumber(cutForK(D.linkages[params.linkage], k), 2);
    setText(cutOut, k === null ? '' : `${k} küme · yükseklik ${h}`);
    cut.setAttribute('aria-valuetext', cutOut.textContent ?? '');

    if (linkage.value !== params.linkage) linkage.value = params.linkage;
    const want = params.point === null ? '' : String(params.point + 1);
    if (pt.value !== want && document.activeElement !== pt) pt.value = want;
  };
  sync();
  player.subscribe(sync);
}
