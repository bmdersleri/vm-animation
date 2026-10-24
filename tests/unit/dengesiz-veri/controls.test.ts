// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import '../svg-stubs';
import { bindKeys } from '../../../src/core/keyboard';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { formatNumber as f } from '../../../src/core/plot/format';
import { UNDEFINED_TEXT } from '../../../src/concepts/degerlendirme/ui';
import { mountImbParams } from '../../../src/concepts/dengesiz-veri/controls';
import { mountImbExtra } from '../../../src/concepts/dengesiz-veri/extra';
import { exampleFor, syntheticFor } from '../../../src/concepts/dengesiz-veri/model';
import { dengesizVeriScenario as sc } from '../../../src/concepts/dengesiz-veri/scenario';
import { mountImbScene } from '../../../src/concepts/dengesiz-veri/scene';
import { labTextTests } from '../lab-text';

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
  mountImbParams(host, player);
  const scene = mountImbScene(el, player, 'lab', { durationScale: 0 });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { host, el, player };
}

const step = (id: string) => stepIndex(sc, id);
const ctl = (host: HTMLElement, key: string) => host.querySelector<HTMLInputElement>(`[data-param=${key}]`)!;
const count = (el: ParentNode, sel: string) => el.querySelectorAll(sel).length;

function slide(input: HTMLInputElement, value: number): void {
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function choose(input: HTMLSelectElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** The controls shown at a step, as `param` or `action` names. */
function visible(host: HTMLElement): string[] {
  return [...host.querySelectorAll<HTMLElement>('.ctl:not([data-off])')].map((c) => {
    const input = c.querySelector<HTMLElement>('[data-param], [data-action]')!;
    return input.dataset.param ?? input.dataset.action!;
  });
}

labTextTests(sc.steps, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

describe('imbalanced-data Lab controls', () => {
  it('k slider redraws the neighbour lines', () => {
    const { host, el, player } = setup();
    player.goto(step('sentetik'));
    expect([ctl(host, 'k').min, ctl(host, 'k').max]).toEqual(['1', '10']);
    for (const k of [3, 8, 1]) {
      slide(ctl(host, 'k'), k);
      expect(player.state.params.k).toBe(k);
      expect(count(el, 'line.neighbour-line')).toBe(k);
      expect(count(el, 'line.chosen-line')).toBe(1);
    }
    // the other-point button reseeds: lambda and x_new in the strip change with the example
    slide(ctl(host, 'k'), 5);
    const before = exampleFor(5, 42);
    host.querySelector<HTMLButtonElement>('[data-action=seed-point]')!.click();
    expect(player.state.params.seed).toBe(43);
    const after = exampleFor(5, 43);
    expect(after.lambda).not.toBe(before.lambda);
    expect(el.querySelector('.formula')!.textContent).toContain(f(after.lambda, 2));
  });

  it('ratio slider changes the synthetic count', () => {
    const { host, el, player } = setup();
    player.goto(step('smote-doldur'));
    expect([ctl(host, 'ratio').min, ctl(host, 'ratio').max, ctl(host, 'ratio').step]).toEqual(['0.1', '1', '0.05']);
    for (const r of [0.5, 0.1, 1]) {
      slide(ctl(host, 'ratio'), r);
      expect(player.state.params.ratio).toBe(r);
      expect(count(el, '.imb-smote-host circle.pt.synthetic')).toBe(syntheticFor(r));
      expect(el.querySelector('.imb-smote-host .note-line')!.textContent).toBe(`ayrılan 87 + ${syntheticFor(r)} sentetik`);
    }
    // step 7 shows the same count in both panels
    player.goto(step('kopyalama'));
    slide(ctl(host, 'ratio'), 0.5);
    expect(el.querySelector('[data-panel="smote"] .panel-sub')!.textContent).toBe(`87 özgün + ${syntheticFor(0.5)} sentetik`);
    expect(count(el, '[data-panel="smote"] circle.pt.synthetic')).toBe(syntheticFor(0.5));
    host.querySelector<HTMLButtonElement>('[data-action=seed]')!.click();
    expect(player.state.params.seed).toBe(43);
  });

  it('manual weight moves the boundary', () => {
    const { host, el, player } = setup();
    player.goto(step('sinir'));
    const line = () => {
      const l = el.querySelector('line.boundary-line[data-method="agirlik"]')!;
      return ['x1', 'y1', 'x2', 'y2'].map((a) => l.getAttribute(a)).join('|');
    };
    const balanced = line();
    slide(ctl(host, 'manualWeight'), 3);
    expect(player.state.params.weight).toBe('elle');
    expect(player.state.params.manualWeight).toBe(3);
    expect(ctl(host, 'weight').value).toBe('elle');
    const light = line();
    expect(light).not.toBe(balanced);
    slide(ctl(host, 'manualWeight'), 30);
    expect(line()).not.toBe(light);
    choose(ctl(host, 'weight') as unknown as HTMLSelectElement, 'dengeli');
    expect(line()).toBe(balanced);
  });

  it('method choice emphasises one line and threshold moves all of them', () => {
    const { host, el, player } = setup();
    player.goto(step('sinir'));
    expect(count(el, 'line.boundary-line.is-selected')).toBe(0);
    choose(ctl(host, 'method') as unknown as HTMLSelectElement, 'smote');
    expect(el.querySelector('line.boundary-line.is-selected')!.getAttribute('data-method')).toBe('smote');
    const y = () => el.querySelector('line.boundary-line[data-method="smote"]')!.getAttribute('y1');
    const at = y();
    slide(ctl(host, 'threshold'), 0.3);
    expect(y()).not.toBe(at);
    expect(el.querySelector('.formula')!.textContent).toContain('p = 0,30');
  });

  it('threshold 0.99 shows undefined precision', () => {
    const { host, el, player } = setup();
    player.goto(step('karsilastirma'));
    choose(ctl(host, 'method') as unknown as HTMLSelectElement, 'smote');
    // the slider stops at 0.95; the parameter itself accepts any probability
    player.setParam('threshold', 0.99);
    const row = el.querySelector('.imb-table tr.is-selection')!;
    expect(row.querySelector('td[data-col="precision"]')!.textContent).toBe(UNDEFINED_TEXT);
    expect(row.querySelector('td[data-col="caught"]')!.textContent).toBe('0 / 37');
    expect(row.querySelector('td')!.textContent).toBe('seçim: SMOTE, eşik 0,99');
    // 0.05 catches nearly everyone and the precision is a plain number
    slide(ctl(host, 'threshold'), 0.05);
    const again = el.querySelector('.imb-table tr.is-selection')!;
    expect(again.querySelector('td[data-col="precision"]')!.textContent).toMatch(/^0,\d{3}$/);
  });

  it('every strip stays finite at slider ends', () => {
    const { host, el, player } = setup();
    const ends: Record<string, number[]> = { k: [1, 10], ratio: [0.1, 1], manualWeight: [1, 30], threshold: [0.05, 0.95] };
    const finite = (): void => {
      expect(el.querySelector('.formula')!.textContent).not.toMatch(/NaN|undefined|Infinity/);
      expect(el.textContent).not.toMatch(/NaN|Infinity/);
      for (const c of [...el.querySelectorAll('line, rect'), ...[...el.querySelectorAll('circle')].filter((_, i) => i % 20 === 0)]) {
        for (const a of ['cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2', 'width', 'height']) {
          const v = c.getAttribute(a);
          if (v !== null) expect(Number.isFinite(Number(v))).toBe(true);
        }
      }
    };
    for (const s of sc.steps.map((_, i) => i)) {
      player.goto(s);
      finite();
      for (const [key, values] of Object.entries(ends)) {
        const input = ctl(host, key);
        if (input.disabled) continue;
        for (const v of values) {
          slide(input, v);
          finite();
        }
      }
    }
  }, 30000);

  it("only the step's controls are visible", () => {
    const { host, player } = setup();
    const expected: Record<string, string[]> = {
      veri: ['showTest'],
      dogruluk: ['showTest'],
      azinlik: ['showTest'],
      egitim: ['showTest'],
      sentetik: ['k', 'seed-point'],
      'smote-doldur': ['k', 'ratio', 'seed'],
      kopyalama: ['k', 'ratio', 'seed'],
      agirlik: ['weight', 'manualWeight'],
      sinir: ['method', 'k', 'ratio', 'weight', 'manualWeight', 'threshold'],
      karsilastirma: ['method', 'k', 'ratio', 'weight', 'manualWeight', 'threshold'],
    };
    for (const [id, names] of Object.entries(expected)) {
      player.goto(step(id));
      expect(visible(host).sort()).toEqual([...names].sort());
      // hidden controls are also disabled
      for (const input of host.querySelectorAll<HTMLInputElement>('.ctl[data-off] [data-param], .ctl[data-off] [data-action]')) {
        expect(input.disabled).toBe(true);
      }
    }
  });

  it('arrow keys on a slider do not change the step', () => {
    const { host, player } = setup();
    clean.push(bindKeys(window, player, { toggleFullscreen() {}, toggleHelp() {} }, []));
    player.goto(step('sinir'));
    for (const key of ['ArrowRight', 'ArrowLeft', ' ', 'Home', 'End', 'p']) {
      for (const target of [ctl(host, 'threshold'), ctl(host, 'method'), ctl(host, 'k')]) {
        target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        expect(player.state.index).toBe(step('sinir'));
      }
    }
    player.goto(step('veri'));
    ctl(host, 'showTest').dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(player.state.index).toBe(step('veri'));
  });

  it('test switch hides and shows the test points', () => {
    const { host, el, player } = setup();
    expect(count(el, 'circle.pt')).toBe(2000);
    ctl(host, 'showTest').checked = false;
    ctl(host, 'showTest').dispatchEvent(new Event('change', { bubbles: true }));
    expect(player.state.params.showTest).toBe(false);
    expect(count(el, 'circle.pt')).toBe(1400);
  });

  it('the Lab note names calibration, ADASYN and Borderline-SMOTE', () => {
    const host = document.createElement('div');
    document.body.append(host);
    mountImbExtra(host, new StepPlayer(sc));
    const text = host.textContent!;
    expect(text).toContain('kalibrasyon');
    expect(text).toContain('ADASYN');
    expect(text).toContain('Borderline-SMOTE');
  });
});
