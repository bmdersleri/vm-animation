// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { matrixScenario } from '../../../src/concepts/karmasiklik-matrisi/scenario';
import { mountMatrixScene } from '../../../src/concepts/karmasiklik-matrisi/scene';
import { mountMatrixParams } from '../../../src/concepts/karmasiklik-matrisi/controls';

const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach(f => f()); document.body.replaceChildren(); });
function setup() {
  const host = document.createElement('div');
  const params = document.createElement('div');
  document.body.append(host, params);
  const player = new StepPlayer(matrixScenario);
  const scene = mountMatrixScene(host, player, 'ders');
  const controls = mountMatrixParams(params, player);
  scene.resize(1100, 540);
  cleanups.push(() => { controls.destroy(); scene.destroy(); player.destroy(); });
  return { host, params, player, scene, controls };
}

describe('matrix lesson', () => {
  it('resets each teaching moment and uses the same source cohort for the dummy', () => {
    const { host, player } = setup();
    expect(matrixScenario.steps.map(s => s.id)).toEqual(['gercek-tahmin', 'dort-sonuc', 'accuracy', 'precision', 'recall', 'f1', 'accuracy-tuzagi', 'maliyet']);
    expect(player.state.params).toEqual({ tn: 80, fp: 10, fn: 4, tp: 6, model: 'model', fpCost: 1, fnCost: 5 });
    for (let i = 0; i < 8; i++) {
      player.setParams({ tn: 0, fp: 0, fn: 0, tp: 0, model: 'dummy', fpCost: 99, fnCost: 99 });
      player.goto(i);
      expect(player.state.params).toEqual({ tn: 80, fp: 10, fn: 4, tp: 6, model: i === 6 ? 'dummy' : 'model', fpCost: 1, fnCost: 5 });
    }
    player.goto(6);
    expect(host.querySelector('[data-cell="tn"] .matrix-count')?.textContent).toBe('90');
    expect(host.querySelector('[data-cell="fn"] .matrix-count')?.textContent).toBe('10');
    expect(host.querySelector('[data-metric="precision"]')?.textContent).toContain('— (tanımsız)');
    expect(host.querySelector('[data-metric="recall"]')?.textContent).toContain('%0');
    expect(host.querySelector('[data-metric="f1"]')?.textContent).toContain('%0');
  });

  it('moves the same identified customers from actual/predicted marks into four labeled cells', () => {
    const { host, player } = setup();
    expect(host.textContent).toContain('Pozitif: Ayrılan müşteri (churn=1)');
    expect(host.textContent).toContain('Gerçek');
    expect(host.textContent).toContain('Tahmin');
    const initial = host.querySelector('[data-customer="N1"]')!;
    const transform = initial.getAttribute('transform');
    expect(host.querySelectorAll('[data-customer]')).toHaveLength(100);
    player.goto(1);
    expect(host.querySelector('[data-customer="N1"]')).toBe(initial);
    expect(initial.getAttribute('transform')).not.toBe(transform);
    for (const [key, count] of [['tn', 80], ['fp', 10], ['fn', 4], ['tp', 6]] as const) {
      expect(host.querySelectorAll(`[data-customer][data-outcome="${key}"]`)).toHaveLength(count);
      expect(host.querySelector(`[data-cell="${key}"] .matrix-count`)?.textContent).toBe(String(count));
    }
  });

  it.each([
    [2, 'accuracy', ['tn', 'tp'], '(80 + 6) / 100', '%86'],
    [3, 'precision', ['fp', 'tp'], '6 / (6 + 10)', '%37,5'],
    [4, 'recall', ['fn', 'tp'], '6 / (6 + 4)', '%60'],
    [5, 'f1', ['fp', 'fn', 'tp'], '12 / (12 + 10 + 4)', '%46,15'],
  ])('links moment %i to its live metric, formula and cells', (index, metric, cells, formula, result) => {
    const { host, player } = setup();
    player.goto(index as number);
    expect(host.querySelector('[data-active-metric]')?.getAttribute('data-active-metric')).toBe(metric);
    expect([...host.querySelectorAll('[data-cell][data-highlight="true"]')].map(e => e.getAttribute('data-cell'))).toEqual(cells);
    expect(host.querySelector('.matrix-formula')?.textContent).toContain(formula);
    expect(host.querySelector('.matrix-formula')?.textContent).toContain(result);
  });

  it('recomputes the dummy and both costs from manually edited counts', () => {
    const { host, params, player } = setup();
    player.goto(7);
    const change = (name: string, value: string) => {
      const input = params.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
      input.value = value; input.dispatchEvent(new Event('input'));
    };
    change('tn', '20'); change('fp', '3'); change('fn', '2'); change('tp', '5');
    change('fpCost', '2'); change('fnCost', '7');
    expect(host.querySelector('[data-cost="model"]')?.textContent).toContain('3 × 2 + 2 × 7 = 20');
    expect(host.querySelector('[data-cost="dummy"]')?.textContent).toContain('0 × 2 + 7 × 7 = 49');
    const select = params.querySelector<HTMLSelectElement>('select[name="model"]')!;
    select.value = 'dummy'; select.dispatchEvent(new Event('change'));
    expect(host.querySelector('[data-cell="tn"] .matrix-count')?.textContent).toBe('23');
    expect(host.querySelector('[data-cell="fn"] .matrix-count')?.textContent).toBe('7');
    expect(host.querySelectorAll('[data-customer]')).toHaveLength(30);
    change('tp', '1.5'); change('fnCost', '-1');
    expect(player.state.params.tp).toBe(5);
    expect(player.state.params.fnCost).toBe(7);
    player.goto(7);
    expect(params.querySelector('[name="tp"]')?.getAttribute('aria-invalid')).toBe('false');
  });

  it('uses edited counts in all four live ratios', () => {
    const { host, player } = setup();
    player.goto(3);
    player.setParams({ tn: 20, fp: 3, fn: 2, tp: 5 });
    expect(host.querySelector('.matrix-formula')?.textContent).toContain('5 / (5 + 3) = %62,5');
    for (const [key, value] of [['accuracy', '%83,33'], ['precision', '%62,5'], ['recall', '%71,43'], ['f1', '%66,67']]) {
      expect(host.querySelector(`[data-metric="${key}"] strong`)?.textContent).toBe(value);
    }
  });

  it('explains empty and aggregated cohorts without invalid ratios or excess marks', () => {
    const { host, player } = setup();
    player.goto(5);
    player.setParams({ tn: 0, fp: 0, fn: 0, tp: 0 });
    expect(host.textContent).toContain('Müşteri yok');
    expect(host.querySelector('.matrix-formula')?.textContent).toContain('— (tanımsız)');
    expect(host.textContent).not.toMatch(/NaN|Infinity/);
    expect(host.querySelectorAll('[data-customer]')).toHaveLength(0);
    player.setParams({ tn: 100, fp: 100, fn: 100, tp: 100 });
    expect(host.textContent).toContain('400 müşteri');
    expect(host.textContent).toContain('Toplu gösterim');
    expect(host.querySelectorAll('[data-customer]')).toHaveLength(0);
  });

  it('shows only relevant controls and detaches subscriptions/listeners on destroy', () => {
    const { host, params, player, scene, controls } = setup();
    expect(params.querySelector('[data-control="counts"]')?.hasAttribute('hidden')).toBe(true);
    player.goto(3);
    expect(params.querySelector('[data-control="counts"]')?.hasAttribute('hidden')).toBe(false);
    expect(params.querySelector('[data-control="costs"]')?.hasAttribute('hidden')).toBe(true);
    player.goto(7);
    expect(params.querySelector('[data-control="costs"]')?.hasAttribute('hidden')).toBe(false);
    const detachedInput = params.querySelector<HTMLInputElement>('[name="tp"]')!;
    controls.destroy(); scene.destroy();
    detachedInput.value = '99'; detachedInput.dispatchEvent(new Event('input'));
    expect(player.state.params.tp).toBe(6);
    player.goto(2);
    expect(host.children).toHaveLength(0);
    expect(params.children).toHaveLength(0);
  });
  it('keeps cell marks at least one ring apart, or shows count-only cells when they do not fit', () => {
    const { host, player, scene } = setup();
    const marks = () => [...host.querySelectorAll<SVGGElement>('.matrix-customer')].map(n => {
      const m = /translate\(([-\d.]+),([-\d.]+)\)/.exec(n.getAttribute('transform')!)!; return { cell: n.dataset.outcome, x: +m[1], y: +m[2] }; });
    const closest = () => { let d = Infinity; const list = marks();
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (list[i].cell === list[j].cell) d = Math.min(d, Math.hypot(list[i].x - list[j].x, list[i].y - list[j].y));
      return d; };
    player.goto(1);
    expect(host.querySelector<HTMLElement>('.matrix-scene')?.dataset.aggregate).toBe('false');
    expect(marks()).toHaveLength(100); expect(closest()).toBeGreaterThanOrEqual(14);
    scene.resize(374, 560);
    expect(host.querySelector<HTMLElement>('.matrix-scene')?.dataset.aggregate).toBe('true');
    expect(marks()).toHaveLength(0);
    expect([...host.querySelectorAll('[data-cell] .matrix-count')].map(n => n.textContent)).toEqual(['80', '10', '4', '6']);
    expect(host.querySelector('.matrix-note')?.textContent).toContain('her hücrede tam sayım');
    scene.resize(1100, 540);
    expect(marks()).toHaveLength(100); expect(closest()).toBeGreaterThanOrEqual(14);
  });
});
