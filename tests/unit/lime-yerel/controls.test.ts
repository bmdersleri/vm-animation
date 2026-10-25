// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../svg-stubs';
import { bindKeys } from '../../../src/core/keyboard';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { formatNumber as f } from '../../../src/core/plot/format';
import { BINS, CLOUD, CUSTOMERS, KERNEL_WIDTH, LIME_ALL, PRESETS, SAMPLE_SIZES, limeRun } from '../../../src/concepts/xai/data';
import { limeFit } from '../../../src/concepts/xai/lime';
import { mountLimeParams } from '../../../src/concepts/lime-yerel/controls';
import { mountLimeExtra } from '../../../src/concepts/lime-yerel/extra';
import { limeYerelScenario as sc } from '../../../src/concepts/lime-yerel/scenario';
import { mountLimeScene } from '../../../src/concepts/lime-yerel/scene';
import { labTextTests } from '../lab-text';

const f3 = (v: number) => f(v, 3);
const signed = (v: number) => (v > 0 ? `+${f3(v)}` : f3(v));

const clean: (() => void)[] = [];
afterEach(() => {
  clean.splice(0).forEach((fn) => fn());
  document.body.replaceChildren();
});

function setup(w = 1280, h = 540) {
  const host = document.createElement('div');
  const el = document.createElement('div');
  document.body.append(host, el);
  const player = new StepPlayer(sc);
  mountLimeParams(host, player);
  const scene = mountLimeScene(el, player, 'lab', { durationScale: 0 });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { host, el, player };
}

const step = (id: string) => stepIndex(sc, id);
const ctl = <T extends HTMLElement = HTMLSelectElement>(host: HTMLElement, key: string) => host.querySelector<T>(`[data-param=${key}]`)!;
const texts = (root: ParentNode, sel: string) => [...root.querySelectorAll(sel)].map((e) => e.textContent ?? '');

function choose(input: HTMLSelectElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function slide(input: HTMLInputElement, value: number): void {
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** The controls shown at a step, as their `param` names. */
function visible(host: HTMLElement): string[] {
  return [...host.querySelectorAll<HTMLElement>('.ctl:not([data-off])')].map((c) => c.querySelector<HTMLElement>('[data-param]')!.dataset.param!);
}

labTextTests(sc.steps, [2, 3, 4, 5, 6, 7, 8, 9, 10]);

describe('lime-yerel Lab controls', () => {
  it('width slider refits live', () => {
    const { host, el, player } = setup();
    player.goto(step('vekil'));
    const slider = ctl<HTMLInputElement>(host, 'width');
    expect(slider.type).toBe('range');
    expect([slider.min, slider.max, slider.step]).toEqual(['0.3', '4', '0.01']);
    expect(host.querySelector('.width-value')!.textContent).toBe(f3(KERNEL_WIDTH));
    slide(slider, 0.5);
    expect(player.state.params.width).toBe(0.5);
    const fit = limeFit(limeRun(301, 42, 5000).patterns, 0.5);
    expect(texts(el, '.lime-bar .bar-value')).toEqual(fit.coef.map(signed));
    expect(el.querySelector('.intercept-value')!.textContent).toBe(f3(fit.intercept));
    expect(host.querySelector('.width-value')!.textContent).toBe('0,500');
    // step 5: the weights follow the width, step 7: the local prediction and R²
    player.goto(step('cekirdek'));
    expect(el.querySelector('.kernel-scene')!.textContent).toContain('0,500');
    player.goto(step('sadakat'));
    slide(slider, 2.5);
    const wide = limeFit(limeRun(301, 42, 5000).patterns, 2.5);
    expect(el.querySelector('.fidelity-local')!.textContent).toBe(f3(wide.localPred));
    expect(el.querySelector('.fidelity-r2')!.textContent).toBe(f3(wide.score!));
    // the narrowest kernel kills the weights: the numbers stay numbers
    slide(slider, 0.3);
    expect(el.querySelector('.surrogate-scene')!.textContent).not.toMatch(/NaN|Infinity/);
  });

  it('customer choice redraws bins and cloud', () => {
    const { host, el, player } = setup();
    player.goto(step('kartil'));
    choose(ctl(host, 'customer'), '77');
    expect(player.state.params.customer).toBe(77);
    const run = limeRun(77, 42, 5000);
    // the strip names the customer's three rules
    for (const j of [0, 1, 2]) {
      expect(el.querySelector('.formula')!.textContent).toContain(BINS.names[j][run.bins[j]]);
    }
    player.goto(step('komsuluk'));
    player.setParams({ scan: Number.POSITIVE_INFINITY });
    expect(el.querySelectorAll('.cloud-dot')).toHaveLength(CLOUD[77].p.length);
    expect(el.querySelector('.formula')!.textContent).toContain('müşteri 77');
    const star = el.querySelector('.cloud-star')!;
    expect(star).not.toBeNull();
    choose(ctl(host, 'customer'), '217');
    expect(el.querySelector('.formula')!.textContent).toContain('müşteri 217');
    // the cloud and the pattern table keep the book run: seed 42 and 5000 samples whatever the sample size says
    choose(ctl(host, 'customer'), '301');
    player.goto(step('ikili'));
    expect(texts(el, '.cloud-scene .pattern-n')).toContain(String(limeRun(301, 42, 5000).patterns[7].n));
  });

  it('sample size choice moves the highlighted row', () => {
    const { host, el, player } = setup();
    player.goto(step('kararlilik'));
    const select = ctl(host, 'samples');
    expect([...select.options].map((o) => o.value)).toEqual(SAMPLE_SIZES.map(String));
    for (const size of [100, 500, 1000]) {
      choose(select, String(size));
      expect(player.state.params.samples).toBe(size);
      const selected = [...el.querySelectorAll('.stab-row.is-selected')];
      expect(selected).toHaveLength(3);
      expect(selected.every((r) => r.getAttribute('data-samples') === String(size))).toBe(true);
    }
    // choosing 5000 highlights the book row; the comparison row falls back to 50
    choose(select, '5000');
    expect([...el.querySelectorAll('.stab-row.is-selected')].every((r) => r.getAttribute('data-samples') === '5000')).toBe(true);
    // step 5: the pattern table shows the chosen run
    player.goto(step('cekirdek'));
    choose(select, '100');
    const run = limeRun(301, 42, 100);
    const n = texts(el, '.kernel-scene .pattern-row[data-mask="7"] .pattern-n')[0];
    expect(n).toBe(String(run.patterns[7].n));
  });

  it('compare choice redraws both panels', () => {
    const { host, el, player } = setup();
    player.goto(step('shap-lime'));
    const select = ctl(host, 'compare');
    const opts = [...select.options];
    expect(opts).toHaveLength(CUSTOMERS.length);
    expect(opts.slice(0, 4).map((o) => o.value)).toEqual(PRESETS.map(String));
    expect(new Set(opts.map((o) => o.value)).size).toBe(CUSTOMERS.length);
    // a customer outside the four presets, picked while the Ders sweep is still on its first stage
    const other = CUSTOMERS.find((c) => !(PRESETS as readonly number[]).includes(c.row))!;
    choose(select, String(other.row));
    expect(player.state.params.compare).toBe(other.row);
    expect(el.querySelector('.compare-scene')!.getAttribute('data-stage')).toBe('pair');
    const fit = LIME_ALL.find((r) => r.row === other.row)!.fit;
    expect(texts(el, '.compare-bar .bar-value')).toEqual(fit.coef.map(signed));
    expect(texts(el, '.compare-shap-plot .wf-label').some((t) => t.endsWith(signed(other.shap[0])))).toBe(true);
    expect(el.querySelector('.compare-model')!.textContent).toBe(f3(other.p));
    expect(el.querySelector('.formula')!.textContent).toContain(`müşteri ${other.row}`);
    expect(el.querySelector('.compare-scene')!.innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it('fixed switch swaps the code', () => {
    const { host, el, player } = setup();
    player.goto(step('hata-ayiklama'));
    const toggle = ctl<HTMLInputElement>(host, 'fixed');
    expect(toggle.type).toBe('checkbox');
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    expect(player.state.params.fixed).toBe(true);
    expect(el.querySelectorAll('.code-fixed').length).toBeGreaterThan(0);
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    expect(el.querySelectorAll('.code-fixed')).toHaveLength(0);
    expect(el.querySelectorAll('.code-line.is-bug')).toHaveLength(5);
    // the sweep's last position shows the corrected code; the switch reads it, and switching off returns to five marks
    player.setParams({ scan: 6 });
    expect(toggle.checked).toBe(true);
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    expect(el.querySelectorAll('.code-fixed')).toHaveLength(0);
  });

  it('only the step\'s controls are visible', () => {
    const { host, player } = setup();
    const expected: Record<string, string[]> = {
      kartil: ['customer'],
      komsuluk: ['customer'],
      ikili: ['customer'],
      cekirdek: ['customer', 'width', 'samples'],
      vekil: ['customer', 'width', 'samples'],
      sadakat: ['customer', 'width', 'samples'],
      kararlilik: ['customer', 'samples'],
      'shap-lime': ['compare'],
      'hata-ayiklama': ['fixed'],
    };
    for (const [id, keys] of Object.entries(expected)) {
      player.goto(step(id));
      expect(visible(host).sort(), id).toEqual([...keys].sort());
      // a control that is off is disabled too
      for (const input of host.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-param]')) {
        const on = keys.includes(input.dataset.param!);
        expect(input.disabled, `${id} ${input.dataset.param}`).toBe(!on);
      }
    }
  });

  it('a step without controls hides the card', () => {
    const { host, player } = setup();
    expect(host.hasAttribute('data-off')).toBe(true);
    player.goto(step('kartil'));
    expect(host.hasAttribute('data-off')).toBe(false);
    player.goto(step('yerel-soru'));
    expect(host.hasAttribute('data-off')).toBe(true);
  });

  it('customer list holds the four presets, with notes', () => {
    const { host, player } = setup();
    player.goto(step('kartil'));
    const opts = [...ctl(host, 'customer').options];
    expect(opts.map((o) => o.value)).toEqual(PRESETS.map(String));
    expect(opts[0].textContent).toContain('kitabın müşterisi');
  });

  it('arrow keys on a control do not change the step', () => {
    const { host, player } = setup();
    player.goto(step('kartil'));
    clean.push(bindKeys(window, player, { toggleFullscreen: vi.fn(), toggleHelp: vi.fn() }, []));
    const box = ctl(host, 'customer');
    for (const key of ['ArrowRight', ' ', 'ArrowLeft']) {
      const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      box.dispatchEvent(ev);
      expect(ev.defaultPrevented, key).toBe(false);
    }
    expect(player.state.index).toBe(step('kartil'));
    // the same holds for the slider, which uses the arrow keys itself
    player.goto(step('vekil'));
    const slider = ctl<HTMLInputElement>(host, 'width');
    const ev = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    slider.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(player.state.index).toBe(step('vekil'));
  });

  it('the Lab note names KernelSHAP and the background set, one sentence each', () => {
    const host = document.createElement('div');
    mountLimeExtra(host, new StepPlayer(sc));
    const notes = [...host.querySelectorAll('p')].map((p) => p.textContent ?? '');
    expect(notes).toHaveLength(2);
    expect(notes[0]).toContain('KernelSHAP');
    expect(notes[1]).toContain('arka plan');
    for (const n of notes) {
      expect(n.match(/\./g)).toHaveLength(1);
    }
  });
});
