// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import '../svg-stubs';
import { bindKeys } from '../../../src/core/keyboard';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { formatNumber as f } from '../../../src/core/plot/format';
import { COMPARE, LEAK } from '../../../src/concepts/dengesiz/data';
import { mountLeakParams } from '../../../src/concepts/smote-sizinti/controls';
import { mountLeakExtra } from '../../../src/concepts/smote-sizinti/extra';
import { smoteSizintiScenario as sc } from '../../../src/concepts/smote-sizinti/scenario';
import { mountLeakScene } from '../../../src/concepts/smote-sizinti/scene';

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
  mountLeakParams(host, player);
  const scene = mountLeakScene(el, player, 'lab', { durationScale: 0 });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { host, el, player };
}

const step = (id: string) => stepIndex(sc, id);
const ctl = (host: HTMLElement, key: string) => host.querySelector<HTMLInputElement>(`[data-param=${key}]`)!;
const texts = (el: ParentNode, sel: string) => [...el.querySelectorAll(sel)].map((t) => t.textContent);

function slide(input: HTMLInputElement, value: number): void {
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function choose(input: HTMLElement, value: string): void {
  (input as HTMLSelectElement).value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function flip(input: HTMLInputElement, on: boolean): void {
  input.checked = on;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** The controls shown at a step, as `param` names. */
function visible(host: HTMLElement): string[] {
  return [...host.querySelectorAll<HTMLElement>('.ctl:not([data-off])')].map((c) => c.querySelector<HTMLElement>('[data-param]')!.dataset.param!);
}

describe('SMOTE-leakage Lab controls', () => {
  it('order switch changes the test counts', () => {
    const { host, el, player } = setup();
    player.goto(step('once-smote'));
    const synth = LEAK.bySeed[0].leaky;
    expect(texts(el, '.flow-bar-title, .bar-value').join(' ')).toContain(`${synth.pos} (${synth.synthPos} sentetik)`);
    choose(ctl(host, 'order'), 'dogru');
    expect(player.state.params.order).toBe('dogru');
    expect(el.querySelector('.formula')!.textContent).toContain('hepsi gerçek');
    expect(el.querySelectorAll('.flow-bar.bar-synth')).toHaveLength(0);
    choose(ctl(host, 'order'), 'yanlis');
    expect(el.querySelectorAll('.flow-bar.bar-synth').length).toBeGreaterThan(0);
  });

  it('seed choice changes both scores', () => {
    const { host, el, player } = setup();
    player.goto(step('iki-skor'));
    expect([...ctl(host, 'seed').querySelectorAll('option')].map((o) => o.value)).toEqual(['42', '0', '1', '2', '3', '4']);
    const big = () => texts(el, 'text.score-big');
    const first = big();
    for (const seed of [0, 3]) {
      choose(ctl(host, 'seed'), String(seed));
      const run = LEAK.bySeed.find((r) => r.seed === seed)!;
      expect(big()).toEqual([f(run.leaky.ap, 3), f(run.honest.ap, 3)]);
      expect(big()).not.toEqual(first);
    }
  });

  it('fold choice highlights one row', () => {
    const { host, el, player } = setup();
    player.goto(step('pipeline'));
    for (const k of [3, 1]) {
      choose(ctl(host, 'fold'), String(k));
      expect(player.state.params.fold).toBe(k);
      expect(el.querySelectorAll('.fold-row.is-selected')).toHaveLength(1);
      expect(el.querySelector('.fold-row.is-selected')!.getAttribute('data-fold')).toBe(String(k));
    }
    choose(ctl(host, 'fold'), '0');
    expect(el.querySelectorAll('.fold-row.is-selected')).toHaveLength(0);
  });

  it('curve switches hide curves', () => {
    const { host, el, player } = setup();
    player.goto(step('smote-agirlik'));
    flip(ctl(host, 'show-smote'), false);
    expect(el.querySelectorAll('path.lc-series')).toHaveLength(2);
    flip(ctl(host, 'show-base'), false);
    flip(ctl(host, 'show-weighted'), false);
    expect(el.querySelectorAll('path.lc-series')).toHaveLength(0);
    flip(ctl(host, 'show-smote'), true);
    expect(el.querySelectorAll('path.lc-series')).toHaveLength(1);
  });

  it('threshold slider moves the point and the matrix', () => {
    const { host, el, player } = setup();
    player.goto(step('esik'));
    expect([ctl(host, 'threshold').min, ctl(host, 'threshold').max, ctl(host, 'threshold').step]).toEqual(['0.01', '0.99', '0.01']);
    const at = () => {
      const c = el.querySelector('circle.op-point')!;
      return `${c.getAttribute('cx')}|${c.getAttribute('cy')}`;
    };
    const tp = () => el.querySelector('[data-cell="tp"] .cell-count')!.textContent;
    const start = at();
    expect(tp()).toBe('27');
    slide(ctl(host, 'threshold'), 0.3);
    expect(player.state.params.threshold).toBe(0.3);
    expect(at()).not.toBe(start);
    expect(Number(tp())).toBeGreaterThan(27);
    expect(el.querySelector('.formula')!.textContent).toContain('eşik 0,30');
    choose(ctl(host, 'model'), 'weighted');
    expect(el.querySelector('path.lc-series.is-weighted')).not.toBeNull();
    expect(el.querySelector('path.lc-series.is-smote')).toBeNull();
    expect(texts(el, 'text.panel-line')[0]).toContain('/ 37 yakalandı');
  });

  it('threshold at the slider ends stays finite', () => {
    const { host, el, player } = setup();
    player.goto(step('esik'));
    for (const model of ['base', 'smote', 'weighted']) {
      choose(ctl(host, 'model'), model);
      for (const t of [0.01, 0.99]) {
        slide(ctl(host, 'threshold'), t);
        expect(el.textContent).not.toMatch(/NaN|Infinity|undefined/);
        expect(el.querySelector('.formula')!.textContent).not.toMatch(/NaN|Infinity|undefined/);
        for (const c of el.querySelectorAll('circle, rect, line')) {
          for (const a of ['cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2', 'width', 'height']) {
            const v = c.getAttribute(a);
            if (v !== null) expect(Number.isFinite(Number(v))).toBe(true);
          }
        }
      }
    }
    expect(COMPARE.base.scores.length).toBe(600);
  });

  it('fixed switch shows and hides the corrected code', () => {
    const { host, el, player } = setup();
    player.goto(step('hata-ayiklama'));
    // the sweep may still be running; a manual choice stops it
    flip(ctl(host, 'fixed'), false);
    expect(el.querySelectorAll('.code-fixed')).toHaveLength(0);
    expect(el.querySelectorAll('.bug-badge')).toHaveLength(5);
    flip(ctl(host, 'fixed'), true);
    expect(el.querySelectorAll('.code-line.code-fixed').length).toBeGreaterThan(10);
    expect(ctl(host, 'fixed').checked).toBe(true);
  });

  it("only the step's controls are visible", () => {
    const { host, player } = setup();
    const expected: Record<string, string[]> = {
      'iki-sira': ['order', 'seed'],
      'once-smote': ['order', 'seed'],
      'testte-ne-var': ['order', 'seed'],
      'pr-taban': ['order', 'seed'],
      'iki-skor': ['order', 'seed'],
      pipeline: ['fold'],
      'smote-agirlik': ['show-base', 'show-smote', 'show-weighted'],
      esik: ['model', 'threshold'],
      'hata-ayiklama': ['fixed'],
      'baska-sizintilar': [],
    };
    for (const [id, names] of Object.entries(expected)) {
      player.goto(step(id));
      expect(visible(host).sort()).toEqual([...names].sort());
      for (const input of host.querySelectorAll<HTMLInputElement>('.ctl[data-off] [data-param]')) {
        expect(input.disabled).toBe(true);
      }
    }
    expect(host.querySelector('.leak-params')!.hasAttribute('data-off')).toBe(true);
  });

  it('arrow keys on a slider do not change the step', () => {
    const { host, player } = setup();
    clean.push(bindKeys(window, player, { toggleFullscreen() {}, toggleHelp() {} }, []));
    player.goto(step('esik'));
    for (const key of ['ArrowRight', 'ArrowLeft', ' ', 'Home', 'End', 'p']) {
      for (const target of [ctl(host, 'threshold'), ctl(host, 'model')]) {
        target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        expect(player.state.index).toBe(step('esik'));
      }
    }
    player.goto(step('hata-ayiklama'));
    ctl(host, 'fixed').dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(player.state.index).toBe(step('hata-ayiklama'));
  });

  it('the Lab note names RandomUnderSampler and SMOTENC in two sentences', () => {
    const host = document.createElement('div');
    document.body.append(host);
    mountLeakExtra(host, new StepPlayer(sc));
    const paragraphs = [...host.querySelectorAll('p')];
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].textContent).toContain('RandomUnderSampler');
    expect(paragraphs[1].textContent).toContain('SMOTENC');
  });
});
