// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { mountBirliktelikOlculeriParams, snapLift } from '../../../src/concepts/birliktelik-olculeri/controls';
import { mountBirliktelikOlculeriScene } from '../../../src/concepts/birliktelik-olculeri/scene';
import { birliktelikOlculeriScenario, type BirliktelikOlculeriParams } from '../../../src/concepts/birliktelik-olculeri/scenario';
import { sepetData } from '../../../src/concepts/birliktelik/data';
import { itemName } from '../../../src/concepts/birliktelik/format';
import { count } from '../../../src/concepts/birliktelik/metrics';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

const setup = () => {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }));
  const player = new StepPlayer<BirliktelikOlculeriParams>(birliktelikOlculeriScenario);
  const sceneHost = document.createElement('div');
  const params = document.createElement('div');
  document.body.append(sceneHost, params);
  const scene = mountBirliktelikOlculeriScene(sceneHost, player, 'lab');
  scene.resize(1000, 600);
  mountBirliktelikOlculeriParams(params, player);
  return { player, sceneHost, params, scene };
};
const cell = (h: HTMLElement, row: number, item: string) => h.querySelector<HTMLTableCellElement>(`td.bk-cell[data-row="${row}"][data-item="${item}"]`)!;
const chip = (h: HTMLElement, key: 'x' | 'y', item: string) => h.querySelector<HTMLButtonElement>(`button[data-chip="${key}"][data-item="${item}"]`)!;
const visible = (h: HTMLElement, ctl: string) => !h.querySelector<HTMLElement>(`[data-ctl="${ctl}"]`)!.hidden;
const move = (i: HTMLInputElement, v: number | string) => { i.value = String(v); i.dispatchEvent(new Event('input', { bubbles: true })); };
const total = (h: HTMLElement, item: string) => h.querySelector(`td.bk-total[data-item="${item}"]`)!.textContent;
const key = (k: string) => new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });

describe('birliktelik-olculeri controls', () => {
  it('toggling a cell changes counts and metrics', () => {
    const { player, sceneHost, scene } = setup();
    player.goto(4);
    const before = count(sepetData.transactions, ['ekmek']);
    const row = sepetData.transactions.findIndex((b) => !b.includes('ekmek'));
    expect(total(sceneHost, 'ekmek')).toBe(String(before));
    expect(sceneHost.querySelector('[data-strip-kind="confidence"]')!.textContent).toBe('güven(Ekmek → Süt) = 7 / 11 = 0,636');
    cell(sceneHost, row, 'ekmek').click();
    expect(player.state.params.edits).toHaveLength(1);
    expect(total(sceneHost, 'ekmek')).toBe(String(before + 1));
    expect(cell(sceneHost, row, 'ekmek').dataset.on).toBe('true');
    expect(sceneHost.querySelector('[data-strip-kind="confidence"]')!.textContent).toMatch(/^güven\(Ekmek → Süt\) = \d+ \/ 12 = /);
    // toggling again removes the edit
    cell(sceneHost, row, 'ekmek').click();
    expect(player.state.params.edits).toEqual([]);
    expect(total(sceneHost, 'ekmek')).toBe(String(before));
    scene.destroy();
  });

  it('keyboard: arrows move between cells and Space toggles', () => {
    const { player, sceneHost, scene } = setup();
    player.goto(1);
    const c = cell(sceneHost, 0, 'ekmek');
    c.focus();
    c.dispatchEvent(key('ArrowRight'));
    const next = cell(sceneHost, 0, 'sut');
    expect(document.activeElement).toBe(next);
    expect(next.tabIndex).toBe(0);
    expect(c.tabIndex).toBe(-1);
    const was = next.dataset.on;
    next.dispatchEvent(key(' '));
    expect(cell(sceneHost, 0, 'sut').dataset.on).toBe(was === 'true' ? 'false' : 'true');
    scene.destroy();
  });

  it('Home and End move within the row and do not change the step', () => {
    const { player, sceneHost, scene } = setup();
    player.goto(1);
    const bubbled = vi.fn();
    window.addEventListener('keydown', bubbled);
    const c = cell(sceneHost, 2, 'yumurta');
    c.focus();
    c.dispatchEvent(key('End'));
    expect(document.activeElement).toBe(cell(sceneHost, 2, sepetData.items[sepetData.items.length - 1]));
    (document.activeElement as HTMLElement).dispatchEvent(key('Home'));
    expect(document.activeElement).toBe(cell(sceneHost, 2, 'ekmek'));
    expect(cell(sceneHost, 2, 'ekmek').tabIndex).toBe(0);
    expect(bubbled).not.toHaveBeenCalled();
    expect(player.state.index).toBe(1);
    window.removeEventListener('keydown', bubbled);
    scene.destroy();
  });

  it('reset restores the book basket', () => {
    const { player, sceneHost, params, scene } = setup();
    player.goto(1);
    cell(sceneHost, 0, 'ekmek').click();
    cell(sceneHost, 5, 'peynir').click();
    expect(player.state.params.edits).toHaveLength(2);
    params.querySelector<HTMLButtonElement>('button.bk-reset')!.click();
    expect(player.state.params.edits).toEqual([]);
    for (const item of sepetData.items) expect(total(sceneHost, item)).toBe(String(count(sepetData.transactions, [item])));
    scene.destroy();
  });

  it('a chip in X is disabled in Y', () => {
    const { player, params, scene } = setup();
    player.goto(4);
    expect(chip(params, 'x', 'ekmek').getAttribute('aria-pressed')).toBe('true');
    expect(chip(params, 'y', 'ekmek').disabled).toBe(true);
    expect(chip(params, 'x', 'sut').disabled).toBe(true);
    expect(chip(params, 'y', 'yumurta').disabled).toBe(false);
    chip(params, 'x', 'yumurta').click();
    expect(player.state.params.x).toEqual(['ekmek', 'yumurta']);
    expect(chip(params, 'y', 'yumurta').disabled).toBe(true);
    // chips keep product order whatever the click order
    chip(params, 'x', 'tereyagi').click();
    chip(params, 'x', 'ekmek').click();
    expect(player.state.params.x).toEqual(['yumurta', 'tereyagi']);
    scene.destroy();
  });

  it('clicking a rule point selects its X and Y', () => {
    const { player, sceneHost, scene } = setup();
    player.goto(9);
    sceneHost.querySelector<SVGGElement>('g.bk-rule-pt[data-key="sut>yumurta"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(player.state.params.x).toEqual(['sut']);
    expect(player.state.params.y).toEqual(['yumurta']);
    expect(sceneHost.querySelector<SVGGElement>('g.bk-rule-pt[data-selected="true"]')!.dataset.key).toBe('sut>yumurta');
    expect(sceneHost.querySelector('[data-sel-lift]')!.textContent).toBe('1,350');
    // Enter works too, and a multi-item antecedent is selected whole
    sceneHost.querySelector<SVGGElement>('g.bk-rule-pt[data-key*=","]')!.dispatchEvent(key('Enter'));
    expect(player.state.params.x.length + player.state.params.y.length).toBeGreaterThan(2);
    scene.destroy();
  });

  it('clicking a shared point again picks the next rule on it', () => {
    const { player, sceneHost, scene } = setup();
    player.goto(8);
    const at = (k: string) => sceneHost.querySelector<SVGGElement>(`g.bk-rule-pt[data-key="${k}"]`)!;
    const click = (k: string) => at(k).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // Peynir -> Süt (smaller lift) is drawn over Peynir -> Yumurta, so clicks land on it
    click('peynir>sut');
    expect([player.state.params.x, player.state.params.y]).toEqual([['peynir'], ['sut']]);
    click('peynir>sut');
    expect([player.state.params.x, player.state.params.y]).toEqual([['peynir'], ['yumurta']]);
    expect(at('peynir>yumurta').dataset.selected).toBe('true');
    click('peynir>sut');
    expect([player.state.params.x, player.state.params.y]).toEqual([['peynir'], ['sut']]);
    // Enter picks exactly the focused rule, without cycling
    at('peynir>sut').dispatchEvent(key('Enter'));
    expect([player.state.params.x, player.state.params.y]).toEqual([['peynir'], ['sut']]);
    scene.destroy();
  });

  it('a multi-item side reads in braces in the panel and the strips', () => {
    const { player, sceneHost, scene } = setup();
    player.goto(4);
    player.setParams({ x: ['ekmek', 'yumurta'], y: ['sut', 'peynir'] });
    expect(sceneHost.querySelector('.bk-panel .bk-title')!.textContent).toBe('Kural: {Ekmek, Yumurta} → {Süt, Peynir}');
    expect(sceneHost.querySelector('[data-strip-kind="confidence"]')!.textContent).toMatch(/^güven\(\{Ekmek, Yumurta\} → \{Süt, Peynir\}\) = /);
    player.goto(8);
    player.setParams({ x: ['ekmek', 'yumurta'], y: ['sut'] });
    expect([...sceneHost.querySelectorAll('.bk-panel .bk-note')].map((p) => p.textContent)).toContain('Seçili kural: {Ekmek, Yumurta} → Süt');
    scene.destroy();
  });

  it('sliders write the thresholds on the 0.05 grid', () => {
    const { player, sceneHost, params, scene } = setup();
    player.goto(8);
    const sup = params.querySelector<HTMLInputElement>('input[data-param=minSupport]')!;
    const conf = params.querySelector<HTMLInputElement>('input[data-param=minConfidence]')!;
    const lift = params.querySelector<HTMLInputElement>('input[data-param=minLift]')!;
    expect([sup.min, sup.max, sup.step]).toEqual(['0.05', '0.6', '0.05']);
    expect([conf.min, conf.max, conf.step]).toEqual(['0.1', '1', '0.05']);
    expect([lift.min, lift.max, lift.step]).toEqual(['0.5', '2', '0.05']);
    move(sup, 0.1 + 0.05);
    expect(player.state.params.minSupport).toBe(0.15);
    expect(params.textContent).toContain('min_support = 0,15');
    expect(sceneHost.querySelectorAll('g.bk-rule-pt').length).toBeGreaterThan(13);
    move(conf, 0.7);
    expect(player.state.params.minConfidence).toBe(0.7);
    move(lift, 1.2);
    expect(player.state.params.minLift).toBe(1.2);
    move(lift, 0.5);
    expect(player.state.params.minLift).toBe(0);
    expect(params.textContent).toContain('min lift: kapalı');
    expect(snapLift(1.1)).toBe(1.1);
    scene.destroy();
  });

  it('only the step controls are visible', () => {
    const { player, params, scene } = setup();
    const ctls = ['editor', 'x', 'y', 'minSupport', 'minConfidence', 'minLift', 'reset'];
    const want: Record<number, string[]> = {
      0: ['editor', 'reset'],
      1: ['reset'],
      2: ['x', 'reset'],
      3: ['x', 'y', 'reset'],
      4: ['x', 'y', 'reset'],
      7: ['x', 'y', 'reset'],
      8: ['editor', 'minSupport', 'minConfidence', 'minLift', 'reset'],
      9: ['editor', 'minSupport', 'minConfidence', 'minLift', 'reset'],
    };
    for (const [i, shown] of Object.entries(want)) {
      player.goto(Number(i));
      expect(ctls.filter((c) => visible(params, c)), `step ${Number(i) + 1}`).toEqual(ctls.filter((c) => shown.includes(c)));
    }
    scene.destroy();
  });

  it('the editor toggles the chosen receipt and the list follows', () => {
    const { player, sceneHost, params, scene } = setup();
    const fis = params.querySelector<HTMLInputElement>('input[data-param=basket]')!;
    move(fis, 4);
    const btn = params.querySelector<HTMLButtonElement>('button[data-edit-item="ekmek"]')!;
    expect(btn.getAttribute('aria-pressed')).toBe(String(sepetData.transactions[3].includes('ekmek')));
    btn.click();
    expect(player.state.params.edits).toEqual([3 * 6]);
    expect(sceneHost.querySelectorAll('li.bk-list-item')[3].textContent).toBe('Fiş 4: Süt, Yumurta, Tereyağı');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    scene.destroy();
  });

  it('empty X shows the prompt', () => {
    const { player, sceneHost, params, scene } = setup();
    player.goto(4);
    chip(params, 'x', 'ekmek').click();
    expect(player.state.params.x).toEqual([]);
    expect(sceneHost.querySelector('.bk-panel')!.textContent).toContain('Bir öncül ve bir sonuç seç.');
    expect(sceneHost.textContent).not.toMatch(/NaN|Infinity|undefined/);
    scene.destroy();
  });

  it('an X that no basket holds reads undefined, and no product name takes a suffix', () => {
    const { player, sceneHost, params, scene } = setup();
    player.goto(4);
    // take Ekmek out of every basket, one cell at a time
    sepetData.transactions.forEach((b, r) => { if (b.includes('ekmek')) cell(sceneHost, r, 'ekmek').click(); });
    expect(sceneHost.querySelector('.bk-panel')!.textContent).toContain('— (tanımsız)');
    expect(sceneHost.textContent).not.toMatch(/NaN|Infinity|undefined/);
    for (const el of [sceneHost, params]) for (const item of sepetData.items) expect(el.textContent).not.toContain(`${itemName(item)}'`);
    scene.destroy();
  });
});
