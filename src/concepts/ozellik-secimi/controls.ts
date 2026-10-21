import type { StepPlayer } from '../../core/player';
import type { Scaling } from './data';
import { K_STEPS, RFE_STEPS, VT_STEPS, type SecimParams } from './scenario';
import { VT_OPTIONS } from './select';

let uid = 0;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...children);
  return e;
}

const VT_LABELS: Record<string, string> = { '0': '0', '0.01': '0,01', '1': '1', '10': '10' };
const SCALINGS: readonly [Scaling, string][] = [['yok', 'Yok'], ['standard', 'StandardScaler']];

/**
 * Parameter panel, two-way bound. Every group works only in its own steps;
 * elsewhere it is marked `data-off` (Lab hides it, Ders greys it) and disabled.
 */
export function mountSecimParams(host: HTMLElement, p: StepPlayer<SecimParams>): void {
  const id = `secimp${++uid}`;

  const choice = (name: string, label: string, options: readonly [string, string][], write: (value: string) => void) => {
    const inputs = options.map(([value], i) => el('input', { type: 'radio', name, id: `${id}-${name}-${i}`, value }));
    inputs.forEach((r) => r.addEventListener('change', () => {
      if (r.checked) write(r.value);
    }));
    const labels = options.map(([, text], i) => el('label', { class: 'opt', for: inputs[i].id }, inputs[i], text));
    return { inputs, group: el('fieldset', { class: 'ctl choice' }, el('legend', { class: 'ctl-label' }, label), ...labels) };
  };
  const range = (param: 'k' | 'nSelect', label: string) => {
    const input = el('input', { type: 'range', id: `${id}-${param}`, 'data-param': param, min: '1', max: '7', step: '1' });
    const out = el('output', { class: 'k-value', for: input.id });
    input.addEventListener('input', () => p.setParam(param, Number(input.value)));
    return { input, out, group: el('div', { class: 'ctl range' }, el('label', { for: input.id }, label), input, out) };
  };

  const vt = choice('vt', 'Varyans eşiği', VT_OPTIONS.map((v) => [String(v), VT_LABELS[String(v)]]), (value) => {
    const next = VT_OPTIONS.find((v) => String(v) === value);
    if (next !== undefined) p.setParam('vt', next);
  });
  const k = range('k', 'k (SelectKBest)');
  const n = range('nSelect', 'Seçilecek sütun sayısı');
  const scaling = choice('scaling', 'Ölçekleme', SCALINGS, (value) => {
    const next = SCALINGS.find(([s]) => s === value);
    if (next) p.setParam('scaling', next[0]);
  });

  host.append(el('div', { class: 'knn-params secim-params' }, vt.group, k.group, n.group, scaling.group));

  const setText = (e: HTMLElement, text: string): void => {
    if (e.textContent !== text) e.textContent = text;
  };
  const gate = (group: HTMLElement, steps: readonly number[], index: number): void => {
    const off = !steps.includes(index);
    // Lab hides a group that does not apply to this step (CSS); Ders keeps showing it greyed
    group.toggleAttribute('data-off', off);
    for (const c of group.querySelectorAll<HTMLInputElement>('input')) {
      if (c.disabled !== off) c.disabled = off;
    }
  };
  const check = (inputs: HTMLInputElement[], cur: string): void => {
    for (const r of inputs) {
      const on = r.value === cur;
      if (r.checked !== on) r.checked = on;
    }
  };

  const sync = (index: number, s: SecimParams): void => {
    check(vt.inputs, String(s.vt));
    check(scaling.inputs, s.scaling);
    for (const r of [k, n]) {
      const v = String(r === k ? s.k : s.nSelect);
      if (r.input.value !== v) r.input.value = v;
      setText(r.out, v);
    }
    gate(vt.group, VT_STEPS, index);
    gate(k.group, K_STEPS, index);
    gate(n.group, RFE_STEPS, index);
    gate(scaling.group, RFE_STEPS, index);
  };
  sync(p.state.index, p.state.params);
  p.subscribe((s) => sync(s.index, s.params));
}
