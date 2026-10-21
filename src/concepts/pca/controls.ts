import type { StepPlayer } from '../../core/player';
import { animateTheta, BIRIM_STEPS, PERPLEXITY_STEPS, THETA_STEPS, THRESHOLD_STEPS, type PcaParams } from './scenario';
import { normDeg, pairFit } from './pca2';
import { derivePcaView } from './view';

let uid = 0;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...children);
  return e;
}

type RadioKey = 'birim' | 'perplexity';

const GROUPS: readonly { key: RadioKey; label: string; options: readonly [string, string][] }[] = [
  { key: 'birim', label: '9. öznitelik birimi', options: [['1', '×1'], ['1000', '×1000']] },
  { key: 'perplexity', label: 'perplexity', options: [['5', '5'], ['30', '30'], ['50', '50']] },
];

/**
 * Parameter panel, two-way bound. Every group works only in its own steps;
 * elsewhere it is marked `data-off` (Lab hides it, Ders greys it) and disabled.
 */
export function mountPcaParams(host: HTMLElement, p: StepPlayer<PcaParams>): void {
  const id = `pcap${++uid}`;

  const theta = el('input', { type: 'range', id: `${id}-theta`, 'data-param': 'theta', min: '0', max: '179', step: '1' });
  const thetaOut = el('output', { class: 'k-value', for: theta.id });
  const thetaGroup = el('div', { class: 'ctl range' }, el('label', { for: theta.id }, 'Yön açısı θ'), theta, thetaOut);

  const find = el('button', { type: 'button', class: 'find-pc1' }, 'PC1’i bul');
  const findGroup = el('div', { class: 'ctl action' }, find);

  const thr = el('input', { type: 'range', id: `${id}-threshold`, 'data-param': 'threshold', min: '50', max: '99', step: '1' });
  const thrOut = el('output', { class: 'k-value', for: thr.id });
  const thrGroup = el('div', { class: 'ctl range' }, el('label', { for: thr.id }, 'Varyans eşiği'), thr, thrOut);

  const radios = new Map<RadioKey, HTMLInputElement[]>();
  const [birimSet, perpSet] = GROUPS.map((g) => {
    const inputs = g.options.map(([value], i) =>
      el('input', { type: 'radio', name: g.key, id: `${id}-${g.key}-${i}`, value }));
    radios.set(g.key, inputs);
    const labels = g.options.map(([, text], i) => el('label', { class: 'opt', for: inputs[i].id }, inputs[i], text));
    inputs.forEach((r) => {
      r.addEventListener('change', () => {
        if (r.checked) p.setParam(g.key, Number(r.value) as never);
      });
    });
    return el('fieldset', { class: 'ctl choice' }, el('legend', { class: 'ctl-label' }, g.label), ...labels);
  });

  host.append(el('div', { class: 'knn-params pca-params' }, thetaGroup, findGroup, birimSet, thrGroup, perpSet));

  let stop: () => void = () => {};
  theta.addEventListener('input', () => {
    stop();
    p.setParam('theta', Number(theta.value));
  });
  thr.addEventListener('input', () => p.setParam('threshold', Number(thr.value)));
  find.addEventListener('click', () => {
    stop();
    stop = animateTheta(p, Math.round(pairFit(p.state.params.birim).pc1Deg));
  });

  const setText = (e: HTMLElement, text: string): void => {
    if (e.textContent !== text) e.textContent = text;
  };
  const gate = (group: HTMLElement, steps: readonly number[], index: number): void => {
    const off = !steps.includes(index);
    // Lab hides a group that does not apply to this step (CSS); Ders keeps showing it greyed
    group.toggleAttribute('data-off', off);
    for (const c of group.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button')) {
      if (c.disabled !== off) c.disabled = off;
    }
  };

  const sync = (index: number, s: PcaParams): void => {
    const pos = String(Math.round(normDeg(s.theta)));
    if (theta.value !== pos) theta.value = pos;
    setText(thetaOut, `${pos}°`);
    if (thr.value !== String(s.threshold)) thr.value = String(s.threshold);
    setText(thrOut, `%${s.threshold} → ${derivePcaView(9, s).scree!.k} bileşen`);
    for (const g of GROUPS) {
      const cur = String(s[g.key]);
      for (const r of radios.get(g.key)!) {
        const on = r.value === cur;
        if (r.checked !== on) r.checked = on;
      }
    }
    gate(thetaGroup, THETA_STEPS, index);
    gate(findGroup, THETA_STEPS, index);
    gate(birimSet, BIRIM_STEPS, index);
    gate(thrGroup, THRESHOLD_STEPS, index);
    gate(perpSet, PERPLEXITY_STEPS, index);
  };
  sync(p.state.index, p.state.params);
  p.subscribe((s) => sync(s.index, s.params));
}
