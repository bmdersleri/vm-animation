import type { StepPlayer } from '../../core/player';
import {
  DOTS_STEPS, K_STEPS, SIXTH_STEPS, THIRD_STEPS,
  type KutuParams,
} from './scenario';

let uid = 0;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...children);
  return e;
}

/** The k pair: the book rule and the wide comparison of the last step. */
const K_OPTIONS: readonly [KutuParams['k'], string][] = [
  [1.5, 'k = 1,5'],
  [3, 'k = 3,0'],
];

/**
 * Parameter panel of the `kutu-grafigi` page: the IQR coefficient as a radio
 * pair, the sixth student, the third group and the raw dots as switches. Every
 * player notification writes the current params back, only where they differ.
 * A control outside its steps is disabled and marked `data-off`, which Lab
 * hides (Ders keeps it greyed), so the Lab card never shows a dead group.
 */
export function mountKutuParams(host: HTMLElement, p: StepPlayer<KutuParams>): void {
  const id = `kutup${++uid}`;

  const radios = K_OPTIONS.map(([value], i) =>
    el('input', {
      type: 'radio', name: `${id}-k`, id: `${id}-k-${i}`, value: String(value), 'data-param': 'k',
    }));
  const radioLabels = K_OPTIONS.map(([, text], i) =>
    el('label', { class: 'opt', for: radios[i].id }, radios[i], text));
  const kBox = el('fieldset', { class: 'ctl choice' },
    el('legend', { class: 'ctl-label' }, 'IQR katsayısı k'), ...radioLabels);

  const check = (param: 'sixth' | 'third' | 'dots', label: string): { input: HTMLInputElement; box: HTMLElement } => {
    const input = el('input', { type: 'checkbox', id: `${id}-${param}`, 'data-param': param });
    const box = el('div', { class: 'ctl check' }, el('label', { class: 'opt', for: input.id }, input, label));
    return { input, box };
  };
  const sixth = check('sixth', '6. öğrenci');
  const third = check('third', 'üçüncü grup');
  const dots = check('dots', 'noktalar');

  host.append(el('div', { class: 'knn-params kutu-params' },
    kBox, sixth.box, third.box, dots.box));

  radios.forEach((r) => {
    r.addEventListener('change', () => {
      if (r.checked) p.setParam('k', Number(r.value) as KutuParams['k']);
    });
  });
  sixth.input.addEventListener('change', () => p.setParam('sixth', sixth.input.checked));
  third.input.addEventListener('change', () => p.setParam('third', third.input.checked));
  dots.input.addEventListener('change', () => p.setParam('dots', dots.input.checked));

  const rows: readonly {
    steps: readonly number[];
    box: HTMLElement;
    controls: readonly HTMLInputElement[];
  }[] = [
    { steps: K_STEPS, box: kBox, controls: radios },
    { steps: SIXTH_STEPS, box: sixth.box, controls: [sixth.input] },
    { steps: THIRD_STEPS, box: third.box, controls: [third.input] },
    { steps: DOTS_STEPS, box: dots.box, controls: [dots.input] },
  ];

  const sync = (index: number, s: KutuParams): void => {
    for (const r of radios) {
      const on = r.value === String(s.k);
      if (r.checked !== on) r.checked = on;
    }
    if (sixth.input.checked !== s.sixth) sixth.input.checked = s.sixth;
    if (third.input.checked !== s.third) third.input.checked = s.third;
    if (dots.input.checked !== s.dots) dots.input.checked = s.dots;
    for (const r of rows) {
      const off = !r.steps.includes(index);
      for (const c of r.controls) {
        if (c.disabled !== off) c.disabled = off;
      }
      r.box.toggleAttribute('data-off', off);
    }
    // every step owns at least the dots switch, so the card itself never hides
    host.toggleAttribute('data-off', rows.every((r) => !r.steps.includes(index)));
  };
  sync(p.state.index, p.state.params);
  p.subscribe((s) => sync(s.index, s.params));
}
