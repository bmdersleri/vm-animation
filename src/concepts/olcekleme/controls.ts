import type { StepPlayer } from '../../core/player';
import { FIT_STEPS, SCATTER_STEPS, type OlcParams } from './scenario';

let uid = 0;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...children);
  return e;
}

type RadioKey = 'unit' | 'scaling' | 'fit';

const GROUPS: readonly { key: RadioKey; label: string; steps: readonly number[]; options: readonly [string, string][] }[] = [
  { key: 'unit', label: 'Hizmet süresi birimi', steps: SCATTER_STEPS, options: [['ay', 'Ay'], ['yil', 'Yıl'], ['gun', 'Gün']] },
  { key: 'scaling', label: 'Ölçekleme', steps: SCATTER_STEPS, options: [['yok', 'Yok'], ['standard', 'StandardScaler']] },
  { key: 'fit', label: 'fit kapsamı', steps: FIT_STEPS, options: [['egitim', 'Yalnız eğitim'], ['tum', 'Tüm veri']] },
];

/**
 * Parameter panel: two-way bound radios. Birim and Ölçekleme work in the
 * scatter steps, fit kapsamı in the split steps; elsewhere they are disabled.
 * The intermediate scalings (mu, kaydir) show as "Yok".
 */
export function mountOlcParams(host: HTMLElement, p: StepPlayer<OlcParams>): void {
  const id = `olcp${++uid}`;
  const radios = new Map<RadioKey, HTMLInputElement[]>();
  const fieldsetOf = new Map<RadioKey, HTMLFieldSetElement>();
  const fieldsets = GROUPS.map((g) => {
    const inputs = g.options.map(([value], i) =>
      el('input', { type: 'radio', name: g.key, id: `${id}-${g.key}-${i}`, value }));
    radios.set(g.key, inputs);
    const labels = g.options.map(([, text], i) => el('label', { class: 'opt', for: inputs[i].id }, inputs[i], text));
    inputs.forEach((r) => {
      r.addEventListener('change', () => {
        if (r.checked) p.setParam(g.key, r.value as never);
      });
    });
    const fs = el('fieldset', { class: 'ctl choice' }, el('legend', { class: 'ctl-label' }, g.label), ...labels);
    fieldsetOf.set(g.key, fs);
    return fs;
  });
  host.append(el('div', { class: 'knn-params olc-params' }, ...fieldsets));

  const sync = (index: number, s: OlcParams): void => {
    for (const g of GROUPS) {
      const off = !g.steps.includes(index);
      const cur = g.key === 'scaling' ? (s.scaling === 'standard' ? 'standard' : 'yok') : String(s[g.key]);
      for (const r of radios.get(g.key)!) {
        const on = r.value === cur;
        if (r.checked !== on) r.checked = on;
        if (r.disabled !== off) r.disabled = off;
      }
      // Lab hides a group that does not apply to this step (CSS); Ders keeps showing it greyed
      const fs = fieldsetOf.get(g.key)!;
      if (fs.dataset.off !== String(off)) {
        if (off) fs.dataset.off = 'true';
        else delete fs.dataset.off;
      }
    }
  };
  sync(p.state.index, p.state.params);
  p.subscribe((s) => sync(s.index, s.params));
}
