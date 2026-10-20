import type { StepPlayer } from '../../core/player';
import type { Criterion } from './impurity';
import { DEPTH_MAX, type TreeParams } from './scenario';

let uid = 0;

/** Slider position that stands for "unlimited depth". */
const UNLIMITED = DEPTH_MAX + 1;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...children);
  return e;
}

const toDepth = (v: number): number => (v >= UNLIMITED ? Infinity : v);
const toSlider = (d: number): number => (d === Infinity ? UNLIMITED : d);
const depthText = (d: number): string => (d === Infinity ? 'sınırsız' : String(d));

/**
 * Parameter panel. Every control writes a manual override; every player
 * notification writes the current params back, but only values that differ,
 * so focus and a slider mid-drag are left alone.
 */
export function mountTreeParams(host: HTMLElement, p: StepPlayer<TreeParams>): void {
  const id = `treep${++uid}`;

  const criterion = el('select', { id: `${id}-criterion`, 'data-param': 'criterion' },
    el('option', { value: 'gini' }, 'Gini'), el('option', { value: 'entropi' }, 'Entropi'));
  const depth = el('input', {
    type: 'range', id: `${id}-depth`, 'data-param': 'depth', min: '0', max: String(UNLIMITED), step: '1',
  });
  const depthValue = el('output', { class: 'k-value', for: depth.id });
  const showTest = el('input', { type: 'checkbox', id: `${id}-test`, 'data-param': 'showTest' });

  host.append(el(
    'div', { class: 'knn-params tree-params' },
    el('div', { class: 'ctl' }, el('label', { for: criterion.id }, 'Ölçüt'), criterion),
    el('div', { class: 'ctl range' }, el('label', { for: depth.id }, 'En fazla derinlik'), depth, depthValue),
    el('div', { class: 'ctl check' }, showTest, el('label', { for: showTest.id }, 'Test noktaları')),
  ));

  criterion.addEventListener('change', () => p.setParam('criterion', criterion.value as Criterion));
  depth.addEventListener('input', () => {
    const d = toDepth(Number(depth.value));
    depthValue.textContent = depthText(d);
    p.setParam('depth', d);
  });
  showTest.addEventListener('change', () => p.setParam('showTest', showTest.checked));

  const sync = (s: TreeParams): void => {
    if (criterion.value !== s.criterion) criterion.value = s.criterion;
    const pos = String(toSlider(s.depth));
    if (depth.value !== pos) depth.value = pos;
    const text = depthText(s.depth);
    if (depthValue.textContent !== text) depthValue.textContent = text;
    if (showTest.checked !== s.showTest) showTest.checked = s.showTest;
  };
  sync(p.state.params);
  p.subscribe((s) => sync(s.params));
}
