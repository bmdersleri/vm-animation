// @vitest-environment jsdom
import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../svg-stubs';
import { bindKeys } from '../../../src/core/keyboard';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { formatNumber as f } from '../../../src/core/plot/format';
import { CUSTOMERS, PRESETS, customerByRow } from '../../../src/concepts/xai/data';
import { mountShapParams } from '../../../src/concepts/shap-degerleri/controls';
import { mountShapExtra } from '../../../src/concepts/shap-degerleri/extra';
import { shapDegerleriScenario as sc } from '../../../src/concepts/shap-degerleri/scenario';
import { mountShapScene } from '../../../src/concepts/shap-degerleri/scene';
import { labTextTests } from '../lab-text';

const css = fs.readFileSync('src/concepts/shap-degerleri/shap-degerleri.css', 'utf8');
const f3 = (v: number) => f(v, 3);

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
  mountShapParams(host, player);
  const scene = mountShapScene(el, player, 'lab', { durationScale: 0 });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { host, el, player };
}

const step = (id: string) => stepIndex(sc, id);
const ctl = (host: HTMLElement, key: string) => host.querySelector<HTMLSelectElement>(`[data-param=${key}]`)!;
const texts = (root: ParentNode, sel: string) => [...root.querySelectorAll(sel)].map((e) => e.textContent ?? '');

function choose(input: HTMLSelectElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** The controls shown at a step, as their `param` names. */
function visible(host: HTMLElement): string[] {
  return [...host.querySelectorAll<HTMLElement>('.ctl:not([data-off])')].map((c) => c.querySelector<HTMLElement>('[data-param]')!.dataset.param!);
}

labTextTests(sc.steps, [1, 3, 4, 5, 6, 7, 9]);

describe('shap-degerleri Lab controls', () => {
  it('customer choice redraws the lattice and waterfall', () => {
    const { host, el, player } = setup();
    player.goto(step('koalisyon'));
    player.setParams({ scan: Number.POSITIVE_INFINITY });
    const c77 = customerByRow(77);
    choose(ctl(host, 'customer'), '77');
    expect(player.state.params.customer).toBe(77);
    expect(el.querySelector('.lattice-node[data-mask="7"] .node-v')!.textContent).toBe(f3(c77.v[7]));
    player.goto(step('toplam'));
    expect(texts(el, '.wf-label').pop()).toBe(f3(c77.p));
    // customer 59 dips below zero: the waterfall still keeps every segment on the axis
    choose(ctl(host, 'customer'), '59');
    const c59 = customerByRow(59);
    expect(texts(el, '.wf-label').pop()).toBe(f3(c59.p));
    const axis = el.querySelector('.wf-axis-line')!;
    for (const s of el.querySelectorAll('.wf-seg')) {
      const xs = (s.getAttribute('d') ?? '').match(/-?\d+(?:\.\d+)?(?=,)/g)!.map(Number);
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(Number(axis.getAttribute('x1')) - 0.5);
    }
  });

  it('customer list starts with the four presets and lists everyone once', () => {
    const { host } = setup();
    const opts = [...ctl(host, 'customer').options];
    expect(opts.slice(0, 4).map((o) => o.value)).toEqual(PRESETS.map(String));
    expect(opts.slice(0, 4).map((o) => o.textContent)).toEqual([
      'müşteri 301 · kitabın müşterisi',
      'müşteri 77 · SHAP ile LIME ayrışır',
      'müşteri 217 · MonthlyCharges baskın',
      'müşteri 176 · düşük risk',
    ]);
    expect(opts).toHaveLength(CUSTOMERS.length);
    expect(new Set(opts.map((o) => o.value)).size).toBe(CUSTOMERS.length);
    const other = CUSTOMERS.find((c) => !(PRESETS as readonly number[]).includes(c.row))!;
    expect(opts.find((o) => o.value === String(other.row))!.textContent).toBe(`müşteri ${other.row} · p ${f3(other.p)}`);
  });

  it('order choice moves the path', () => {
    const { host, el, player } = setup();
    player.goto(step('marjinal'));
    expect(texts(ctl(host, 'order'), 'option')[0]).toBe('tenure → MonthlyCharges → TotalCharges');
    expect(ctl(host, 'order').options).toHaveLength(6);
    choose(ctl(host, 'order'), '5');
    expect(player.state.params.order).toBe(5);
    expect([...el.querySelectorAll('.lattice-edge.is-path')].map((e) => e.getAttribute('data-from'))).toEqual(['0', '4', '6']);
  });

  it('second customer changes the second force bar', () => {
    const { host, el, player } = setup();
    player.goto(step('kuvvet'));
    expect(texts(el, '.force-bar')[1]).toContain('Müşteri 77');
    choose(ctl(host, 'second'), '217');
    expect(texts(el, '.force-bar')[1]).toContain('Müşteri 217');
    expect(el.querySelectorAll('.force-bar')).toHaveLength(2);
  });

  it('highlight rings one dot per row', () => {
    const { host, el, player } = setup();
    player.goto(step('ozet-grafik'));
    choose(ctl(host, 'highlight'), '77');
    const ringed = [...el.querySelectorAll('.swarm-dot.is-highlight')];
    expect(ringed).toHaveLength(3);
    expect(ringed.every((d) => d.getAttribute('data-row') === '77')).toBe(true);
    expect(new Set(ringed.map((d) => d.closest('.swarm-row')!.getAttribute('data-feature'))).size).toBe(3);
  });

  it('colour by another feature recolours the dots', () => {
    const { host, el, player } = setup();
    player.goto(step('ozet-grafik'));
    const fills = () => [...el.querySelectorAll('.swarm-row[data-feature="0"] .swarm-dot')].map((d) => d.getAttribute('fill'));
    const before = fills();
    expect(texts(ctl(host, 'colorBy'), 'option')).toEqual(['her satırın kendi özelliği', 'tenure', 'MonthlyCharges', 'TotalCharges']);
    choose(ctl(host, 'colorBy'), '1');
    expect(player.state.params.colorBy).toBe(1);
    expect(fills()).not.toEqual(before);
    choose(ctl(host, 'colorBy'), '-1');
    expect(fills()).toEqual(before);
  });

  it('only the step controls are visible', () => {
    const { host, player } = setup();
    const expected: Record<string, string[]> = {
      'kara-kutu': ['customer'],
      koalisyon: ['customer'],
      marjinal: ['customer', 'order'],
      'alti-siralama': ['customer'],
      toplam: ['customer'],
      kuvvet: ['customer', 'second'],
      'ozet-grafik': ['highlight', 'colorBy'],
    };
    for (const [id, keys] of Object.entries(expected)) {
      player.goto(step(id));
      expect(visible(host), id).toEqual(keys);
    }
    // a control outside its steps is disabled
    player.goto(step('kara-kutu'));
    const off = [...host.querySelectorAll<HTMLSelectElement>('.ctl[data-off] select')];
    expect(off.length).toBeGreaterThan(0);
    expect(off.every((s) => s.disabled)).toBe(true);
  });

  it('a step without controls hides the card', () => {
    const { host, player } = setup();
    for (const id of ['genel-onem', 'global', 'sinirlar']) {
      player.goto(step(id));
      expect(host.hasAttribute('data-off'), id).toBe(true);
      expect(visible(host), id).toEqual([]);
    }
    player.goto(step('kuvvet'));
    expect(host.hasAttribute('data-off')).toBe(false);
    expect(css).toMatch(/\[data-mode='lab'\] \.params\[data-off\]\s*\{\s*display:\s*none/);
  });

  it('choices survive step changes and keys on the controls do not step', () => {
    const { host, player } = setup();
    clean.push(bindKeys(window, player, { toggleFullscreen: vi.fn(), toggleHelp: vi.fn() }, []));
    choose(ctl(host, 'customer'), '77');
    player.goto(step('kuvvet'));
    expect(player.state.params.customer).toBe(77);
    const box = ctl(host, 'customer');
    for (const key of ['ArrowRight', ' ', 'ArrowLeft']) {
      const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      box.dispatchEvent(ev);
      expect(ev.defaultPrevented, key).toBe(false);
    }
    expect(player.state.index).toBe(step('kuvvet'));
  });

  it('extra note names KernelSHAP and interaction values', () => {
    const host = document.createElement('div');
    mountShapExtra(host, new StepPlayer(sc));
    expect(host.textContent).toContain('KernelSHAP');
    expect(host.textContent).toContain('etkileşim değerleri');
  });
});
