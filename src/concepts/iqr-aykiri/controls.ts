import type { StepPlayer } from '../../core/player';
import { formatNumber } from '../../core/plot/format';
import { PART1_LAST, type IqrParams } from './scenario';

let uid = 0;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...children);
  return e;
}

const tl = (x: number): string => `${formatNumber(x, 2)} TL`;

type RadioKey = 'fill' | 'k' | 'action';

const GROUPS: readonly { key: RadioKey; label: string; part: 1 | 2; options: readonly [string, string][] }[] = [
  { key: 'fill', label: 'Doldurma', part: 1, options: [['yok', 'Yok'], ['ortalama', 'Ortalama'], ['medyan', 'Medyan']] },
  { key: 'k', label: 'IQR katsayısı', part: 2, options: [['1.5', '1,5'], ['3', '3,0']] },
  { key: 'action', label: 'Müdahale', part: 2, options: [['yok', 'Yok'], ['sil', 'Sil'], ['kirp', 'Kırp']] },
];

/**
 * Parameter panel. Every control writes a manual override; every player
 * notification writes the current params back, only where they differ.
 * Doldurma belongs to part 1, IQR katsayısı and Müdahale to part 2.
 */
export function mountIqrParams(host: HTMLElement, p: StepPlayer<IqrParams>): void {
  const id = `iqrp${++uid}`;

  const slider = el('input', {
    type: 'range', id: `${id}-extreme`, 'data-param': 'extreme', min: '50', max: '500', step: '1',
  });
  const out = el('output', { class: 'k-value', for: slider.id });
  const range = el('div', { class: 'ctl range' }, el('label', { for: slider.id }, 'Uç değer (TL)'), slider, out);

  const radios = new Map<RadioKey, HTMLInputElement[]>();
  const fieldsetOf = new Map<RadioKey, HTMLFieldSetElement>();
  const fieldsets = GROUPS.map((g) => {
    const inputs = g.options.map(([value], i) =>
      el('input', { type: 'radio', name: g.key, id: `${id}-${g.key}-${i}`, value }));
    radios.set(g.key, inputs);
    const labels = g.options.map(([, text], i) =>
      el('label', { class: 'opt', for: inputs[i].id }, inputs[i], text));
    inputs.forEach((r) => {
      r.addEventListener('change', () => {
        if (!r.checked) return;
        p.setParam(g.key, (g.key === 'k' ? Number(r.value) : r.value) as never);
      });
    });
    const fs = el('fieldset', { class: 'ctl choice', 'data-part': String(g.part) },
      el('legend', { class: 'ctl-label' }, g.label), ...labels);
    fieldsetOf.set(g.key, fs);
    return fs;
  });

  host.append(el('div', { class: 'knn-params iqr-params' }, range, ...fieldsets));

  slider.addEventListener('input', () => {
    const v = Number(slider.value);
    out.textContent = tl(v);
    p.setParam('extreme', v);
  });

  const sync = (index: number, s: IqrParams): void => {
    const pos = String(s.extreme);
    if (slider.value !== pos) slider.value = pos;
    const text = tl(s.extreme);
    if (out.textContent !== text) out.textContent = text;
    GROUPS.forEach((g) => {
      const off = g.part === 1 ? index > PART1_LAST : index <= PART1_LAST;
      const cur = String(s[g.key]);
      for (const r of radios.get(g.key)!) {
        const on = r.value === cur;
        if (r.checked !== on) r.checked = on;
        if (r.disabled !== off) r.disabled = off;
      }
      // Lab hides a group that does not apply to this step (CSS); Ders keeps showing it greyed
      const fs = fieldsetOf.get(g.key)!;
      fs.toggleAttribute('data-off', off);
    });
  };
  sync(p.state.index, p.state.params);
  p.subscribe((s) => sync(s.index, s.params));
}
