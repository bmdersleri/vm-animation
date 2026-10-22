// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { mountBirliktelikOlculeriScene } from '../../../src/concepts/birliktelik-olculeri/scene';
import { birliktelikOlculeriScenario, type BirliktelikOlculeriParams } from '../../../src/concepts/birliktelik-olculeri/scenario';
import { sepetData } from '../../../src/concepts/birliktelik/data';
import { count } from '../../../src/concepts/birliktelik/metrics';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

const n = sepetData.transactions.length;
const setup = (reduce = true) => {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: reduce && q.includes('reduce'), media: q }));
  const player = new StepPlayer<BirliktelikOlculeriParams>(birliktelikOlculeriScenario);
  const host = document.createElement('div');
  document.body.append(host);
  const scene = mountBirliktelikOlculeriScene(host, player, 'ders');
  scene.resize(1000, 600);
  return { player, host, scene };
};
const fin = (scene: { destroy(): void }, player: StepPlayer<BirliktelikOlculeriParams>) => { scene.destroy(); player.destroy(); };
const attr = (host: HTMLElement, sel: string, a: string) => host.querySelector(sel)?.getAttribute(a);
const rowsWith = (host: HTMLElement, a: string) => host.querySelectorAll(`tr.bk-row[${a}="true"]`).length;
const key = (k: string) => new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });

describe('birliktelik-olculeri scene', () => {
  it('step 1 lists the receipts and step 2 shows the one-hot table', () => {
    const { player, host, scene } = setup();
    const root = host.querySelector<HTMLElement>('.bk-scene')!;
    expect(root.dataset.view).toBe('list');
    expect(host.querySelectorAll('li.bk-list-item')).toHaveLength(n);
    expect(host.querySelectorAll('li.bk-list-item')[3].textContent).toBe('Fiş 4: Ekmek, Süt, Yumurta, Tereyağı');
    player.goto(1);
    expect(root.dataset.view).toBe('table');
    expect(host.querySelectorAll('tr.bk-row')).toHaveLength(n);
    expect(host.querySelectorAll('td.bk-cell')).toHaveLength(n * 6);
    expect(host.querySelectorAll('td.bk-cell[data-on="true"]')).toHaveLength(sepetData.transactions.flat().length);
    expect(host.querySelector('.bk-code')!.textContent).toBe('TransactionEncoder().fit(...).transform(...)');
    expect(attr(host, 'td.bk-total[data-item="sut"]', 'data-total')).toBe('12');
    expect(host.textContent).not.toMatch(/NaN|Infinity|undefined/);
    fin(scene, player);
  });

  it('step 3 highlights the ekmek column and counts 11', () => {
    const { player, host, scene } = setup();
    player.goto(2);
    expect(host.querySelectorAll('td.bk-cell[data-hl="x"]')).toHaveLength(n);
    expect(host.querySelector('td.bk-cell[data-hl="x"]')!.getAttribute('data-item')).toBe('ekmek');
    expect(host.querySelector('th.bk-col-head[data-hl="x"]')!.getAttribute('data-item')).toBe('ekmek');
    expect(attr(host, '[data-count]', 'data-count')).toBe('11');
    expect(rowsWith(host, 'data-match')).toBe(count(sepetData.transactions, ['ekmek']));
    expect(host.querySelector('[data-strip-kind="support"]')!.textContent).toBe('destek(Ekmek) = 11 / 18 = 0,611');
    // the support bars sit under the column counts
    expect(attr(host, '.bk-table', 'data-bars')).toBe('true');
    expect(host.querySelectorAll('.bk-bar')).toHaveLength(6);
    expect(Number(attr(host, '.bk-bar[data-item="ekmek"]', 'data-support'))).toBeCloseTo(11 / 18, 6);
    fin(scene, player);
  });

  it('step 4 marks the baskets holding both items', () => {
    const { player, host, scene } = setup();
    player.goto(3);
    expect(attr(host, '[data-count]', 'data-count')).toBe('7');
    expect(rowsWith(host, 'data-match')).toBe(7);
    expect(host.querySelectorAll('th.bk-col-head[data-hl]')).toHaveLength(2);
    expect(attr(host, '.bk-table', 'data-bars')).toBe('false');
    fin(scene, player);
  });

  it('step 5 dims baskets without ekmek and counts 7 of 11', () => {
    const { player, host, scene } = setup();
    player.goto(4);
    expect(rowsWith(host, 'data-dim')).toBe(n - 11);
    expect(rowsWith(host, 'data-x')).toBe(11);
    expect(attr(host, '[data-of]', 'data-of')).toBe('11');
    expect(attr(host, '[data-count]', 'data-count')).toBe('7');
    expect(rowsWith(host, 'data-match')).toBe(7);
    expect(host.querySelector('[data-strip-kind="confidence"]')!.textContent).toBe('güven(Ekmek → Süt) = 7 / 11 = 0,636');
    expect(host.querySelector('th.bk-col-head[data-hl="y"] .bk-tag')!.textContent).toBe('Y');
    fin(scene, player);
  });

  it('step 6 reverses the rule and keeps the support', () => {
    const { player, host, scene } = setup();
    player.goto(5);
    expect(attr(host, '[data-of]', 'data-of')).toBe('12');
    expect(host.querySelector('[data-strip-kind="confidence"]')!.textContent).toBe('güven(Süt → Ekmek) = 7 / 12 = 0,583');
    expect(host.querySelector('[data-strip-kind="support"]')!.textContent).toBe('destek({Ekmek, Süt}) = 7 / 18 = 0,389');
    fin(scene, player);
  });

  it('step 7 draws the confidence bar and the base rate line at 12/18', () => {
    const { player, host, scene } = setup();
    player.goto(6);
    expect(Number(attr(host, '[data-conf-bar]', 'data-conf-bar'))).toBeCloseTo(7 / 11, 9);
    expect((host.querySelector('.bk-gauge-fill') as HTMLElement).style.width).toBe('63.6%');
    expect(Number(attr(host, '[data-base-line]', 'data-base-line'))).toBeCloseTo(12 / 18, 9);
    expect((host.querySelector('.bk-gauge-base') as HTMLElement).style.left).toBe('66.7%');
    expect(host.querySelector('[data-lift="forward"]')!.textContent).toBe('kaldıraç(Ekmek → Süt) = 0,636 / 0,667 = 0,955');
    expect(host.querySelector('[data-lift="backward"]')).toBeNull();
    fin(scene, player);
  });

  it('step 8 lift reads 1,350 both ways', () => {
    const { player, host, scene } = setup();
    player.goto(7);
    expect(host.querySelector('[data-lift="forward"]')!.textContent).toContain('= 1,350');
    expect(host.querySelector('[data-lift="backward"]')!.textContent).toContain('= 1,350');
    expect(host.querySelector('[data-strip-kind="confidence"]')!.textContent).toBe('güven(Yumurta → Süt) = 9 / 10 = 0,900');
    expect(Number(attr(host, '[data-base-line]', 'data-base-line'))).toBeCloseTo(12 / 18, 9);
    fin(scene, player);
  });

  it('steps 9-10 reserve the rule scatter slot and read the rule counts', () => {
    const { player, host, scene } = setup();
    player.goto(8);
    expect(host.querySelector<HTMLElement>('.bk-scene')!.dataset.view).toBe('rules');
    expect(host.querySelector('[data-slot="rules"]')).not.toBeNull();
    expect(attr(host, '[data-rules]', 'data-rules')).toBe('13');
    expect(host.querySelector('[data-kept]')).toBeNull();
    player.goto(9);
    expect(attr(host, '[data-kept]', 'data-kept')).toBe('9');
    expect(attr(host, '[data-faded]', 'data-faded')).toBe('4');
    expect(host.querySelector('.bk-code')!.textContent).toContain('kurallar["lift"] > 1.1');
    fin(scene, player);
  });

  it('a Lab pick without X or Y asks for one instead of a measure', () => {
    const { player, host, scene } = setup();
    player.goto(4);
    player.setParams({ y: [] });
    expect(host.querySelector('.bk-panel')!.textContent).toBe('Bir öncül ve bir sonuç seç.');
    player.setParams({ x: [], y: ['sut'] });
    expect(host.querySelector('.bk-panel')!.textContent).toBe('Bir öncül ve bir sonuç seç.');
    fin(scene, player);
  });

  it('an edited basket changes the counts', () => {
    const { player, host, scene } = setup();
    player.goto(2);
    player.setParams({ edits: [0] }); // basket 1 loses ekmek
    expect(attr(host, '[data-count]', 'data-count')).toBe('10');
    expect(host.querySelector('[data-strip-kind="support"]')!.textContent).toBe('destek(Ekmek) = 10 / 18 = 0,556');
    fin(scene, player);
  });

  it('play and pause do not restart a count-up', () => {
    vi.useFakeTimers();
    const { player, host, scene } = setup(false);
    player.goto(2);
    const read = () => Number(attr(host, '[data-count]', 'data-count'));
    expect(read()).toBe(0);
    expect(host.querySelector<HTMLElement>('.bk-scene')!.dataset.counting).toBe('true');
    vi.advanceTimersByTime(90 * 4);
    expect(read()).toBe(4);
    player.play();
    expect(read()).toBe(4);
    vi.advanceTimersByTime(90);
    expect(read()).toBe(5);
    player.pause();
    expect(read()).toBe(5);
    vi.advanceTimersByTime(90 * 20);
    expect(read()).toBe(11);
    expect(host.querySelector<HTMLElement>('.bk-scene')!.dataset.counting).toBe('false');
    // changing the step does restart it
    player.goto(4);
    expect(read()).toBe(0);
    fin(scene, player);
  });

  it('no product name carries an apostrophe suffix, for every Lab pick of steps 5-8', () => {
    const { player, host, scene } = setup();
    const suffixed = /\p{L}'[\p{L}]+/u;
    const names = sepetData.items.map((i) => sepetData.names[i]);
    for (const s of birliktelikOlculeriScenario.steps) {
      for (const name of names) expect(s.text.includes(`${name}'`), `${s.id}: ${name}'`).toBe(false);
    }
    for (const step of [4, 5, 6, 7]) {
      player.goto(step);
      for (const x of sepetData.items) {
        for (const y of sepetData.items) {
          if (x === y) continue;
          player.setParams({ x: [x], y: [y] });
          const t = host.querySelector('.bk-panel')!.textContent ?? '';
          for (const name of names) expect(t.includes(`${name}'`), `step ${step + 1} ${x}->${y}: ${name}'`).toBe(false);
          expect(t).not.toMatch(suffixed);
        }
      }
    }
    fin(scene, player);
  });

  it('step 4 asks for Y instead of counting X alone, and tags both columns', () => {
    const { player, host, scene } = setup();
    player.goto(3);
    expect(host.querySelectorAll('th.bk-col-head[data-hl] .bk-tag')[0].textContent).toBe('X');
    expect(host.querySelectorAll('th.bk-col-head[data-hl] .bk-tag')[1].textContent).toBe('Y');
    player.setParams({ y: [] });
    expect(host.querySelector('.bk-panel')!.textContent).toBe('Bir öncül ve bir sonuç seç.');
    expect(rowsWith(host, 'data-match')).toBe(0);
    fin(scene, player);
  });

  it('in Ders a cell is plain: a click edits nothing and ArrowRight still reaches the step keys', () => {
    const { player, host, scene } = setup();
    player.goto(1);
    const cell = host.querySelector<HTMLTableCellElement>('td.bk-cell[data-row="0"][data-col="0"]')!;
    expect(host.querySelectorAll('td.bk-cell[tabindex]')).toHaveLength(0);
    cell.click();
    expect(player.state.params.edits).toEqual([]);
    const bubbled = vi.fn();
    window.addEventListener('keydown', bubbled);
    const right = key('ArrowRight');
    cell.dispatchEvent(right);
    expect(bubbled).toHaveBeenCalledTimes(1);
    expect(right.defaultPrevented).toBe(false);
    cell.dispatchEvent(key(' '));
    expect(player.state.params.edits).toEqual([]);
    expect(bubbled).toHaveBeenCalledTimes(2);
    // Lab: the same click edits, and the grid keeps its keys to itself
    scene.setMode('lab');
    expect(host.querySelectorAll('td.bk-cell[tabindex="0"]')).toHaveLength(1);
    cell.click();
    expect(player.state.params.edits).toEqual([0]);
    cell.focus();
    const labRight = key('ArrowRight');
    cell.dispatchEvent(labRight);
    expect(bubbled).toHaveBeenCalledTimes(2);
    expect(labRight.defaultPrevented).toBe(true);
    // Lab -> Ders drops the focus and the tab stops
    const focused = document.activeElement as HTMLElement;
    expect(focused.classList.contains('bk-cell')).toBe(true);
    scene.setMode('ders');
    expect(document.activeElement).not.toBe(focused);
    expect(host.querySelectorAll('td.bk-cell[tabindex]')).toHaveLength(0);
    window.removeEventListener('keydown', bubbled);
    fin(scene, player);
  });

  it('in Ders a rule point is a plain mark: a click picks nothing', () => {
    const { player, host, scene } = setup();
    player.goto(8);
    const pt = host.querySelector<SVGGElement>('g.bk-rule-pt[data-key="sut>yumurta"]')!;
    expect(pt.hasAttribute('role')).toBe(false);
    expect(pt.hasAttribute('tabindex')).toBe(false);
    pt.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(player.state.params.x).toEqual(['ekmek']);
    expect(player.state.params.y).toEqual(['sut']);
    const enter = key('Enter');
    pt.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(false);
    expect(player.state.params.x).toEqual(['ekmek']);
    scene.setMode('lab');
    expect(pt.getAttribute('role')).toBe('button');
    expect(pt.getAttribute('tabindex')).toBe('0');
    pt.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(player.state.params.x).toEqual(['sut']);
    expect(player.state.params.y).toEqual(['yumurta']);
    (pt as unknown as HTMLElement).focus();
    expect(document.activeElement).toBe(pt);
    scene.setMode('ders');
    expect(document.activeElement).not.toBe(pt);
    expect(pt.hasAttribute('role')).toBe(false);
    fin(scene, player);
  });

  it('reduced motion starts no count-up timer', () => {
    vi.useFakeTimers();
    const { player, scene } = setup(true);
    player.goto(2);
    expect(vi.getTimerCount()).toBe(0);
    player.goto(4);
    expect(vi.getTimerCount()).toBe(0);
    fin(scene, player);
  });
});
