// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { mountAprioriParams, minSupportText } from '../../../src/concepts/apriori/controls';
import { mountAprioriScene } from '../../../src/concepts/apriori/scene';
import { aprioriScenario, type AprioriParams } from '../../../src/concepts/apriori/scenario';
import { sepetData } from '../../../src/concepts/birliktelik/data';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

const setup = () => {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }));
  const player = new StepPlayer<AprioriParams>(aprioriScenario);
  const sceneHost = document.createElement('div');
  const params = document.createElement('div');
  document.body.append(sceneHost, params);
  const scene = mountAprioriScene(sceneHost, player, 'lab');
  scene.resize(1280, 440);
  mountAprioriParams(params, player);
  return { player, sceneHost, params, scene };
};
const STEP = Object.fromEntries(aprioriScenario.steps.map((s, i) => [s.id, i]));
const move = (i: HTMLInputElement, v: number | string) => { i.value = String(v); i.dispatchEvent(new Event('input', { bubbles: true })); };
const visible = (h: HTMLElement, ctl: string) => !h.querySelector<HTMLElement>(`[data-ctl="${ctl}"]`)!.hidden;
const state = (h: HTMLElement, abbr: string) => h.querySelector<HTMLElement>(`.ap-node[data-abbr="${abbr}"]`)!.dataset.state;
const inState = (h: HTMLElement, s: string) => h.querySelectorAll(`.ap-node[data-state="${s}"]`).length;
const act = (h: HTMLElement, a: string) => h.querySelector<HTMLButtonElement>(`button[data-act="${a}"]`)!;
const key = (k: string) => new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });

describe('apriori controls', () => {
  it('min_support slider recolours the lattice', () => {
    const { player, sceneHost, params, scene } = setup();
    player.goto(STEP.dur);
    const slider = params.querySelector<HTMLInputElement>('input[data-param="minCount"]')!;
    expect(slider.min).toBe('1');
    expect(slider.max).toBe('18');
    expect(slider.value).toBe('4');
    expect(params.querySelector('[data-ctl="minCount"] output')!.textContent).toBe('0,222 · en az 4 fiş');
    expect(inState(sceneHost, 'frequent')).toBe(12);
    move(slider, 9);
    expect(player.state.params.minCount).toBe(9);
    expect(params.querySelector('[data-ctl="minCount"] output')!.textContent).toBe('0,500 · en az 9 fiş');
    expect(sceneHost.querySelector('.ap-threshold')!.textContent).toBe('min_support 0,5 → en az 9 fiş');
    expect(inState(sceneHost, 'frequent')).toBe(4);
    expect(state(sceneHost, 'T')).toBe('infrequent');
    move(slider, 3);
    expect(inState(sceneHost, 'frequent')).toBe(16);
    expect(state(sceneHost, 'R')).toBe('frequent');
    // out-of-range input is clamped, never NaN
    move(slider, 99);
    expect(player.state.params.minCount).toBe(18);
    expect(minSupportText(18)).toBe('1,000 · en az 18 fiş');
    scene.destroy();
  });

  it('level stepper walks levels and stops at the last', () => {
    const { player, sceneHost, params, scene } = setup();
    player.goto(STEP.seviye1);
    const out = () => params.querySelector('[data-out="level"]')!.textContent;
    expect(out()).toBe('seviye 1 / 6');
    expect(act(params, 'prev').disabled).toBe(true);
    expect(state(sceneHost, 'ES')).toBe('unseen');
    act(params, 'next').click();
    expect(player.state.params.level).toBe(2);
    expect(state(sceneHost, 'ES')).toBe('frequent');
    act(params, 'prev').click();
    expect(player.state.params.level).toBe(1);
    for (let i = 0; i < 8; i++) act(params, 'next').click();
    expect(player.state.params.level).toBe(6);
    expect(out()).toBe('seviye 6 / 6');
    expect(act(params, 'next').disabled).toBe(true);
    expect(act(params, 'last').disabled).toBe(true);
    act(params, 'prev').click();
    act(params, 'last').click();
    expect(player.state.params.level).toBe(6);
    scene.destroy();
  });

  it('clicking a node explains its status', () => {
    const { player, sceneHost, scene } = setup();
    player.goto(STEP.budama);
    const info = sceneHost.querySelector<HTMLElement>('.ap-node-info')!;
    expect(info.hidden).toBe(true);
    const click = (abbr: string) => sceneHost.querySelector<HTMLElement>(`.ap-node[data-abbr="${abbr}"]`)!.click();
    click('EST');
    expect(player.state.params.node).toBe('ekmek,sut,tereyagi');
    expect(info.hidden).toBe(false);
    expect(info.textContent).toBe('EST budandı: ST sık değil (3 < 4), bu yüzden sayılmadı.');
    expect(sceneHost.querySelector('.ap-node[data-selected="true"]')!.getAttribute('data-abbr')).toBe('EST');
    click('SY');
    expect(info.textContent).toBe('SY sık: 9 fiş ≥ 4.');
    click('ST');
    expect(info.textContent).toBe('ST sık değil: 3 fiş < 4.');
    click('ESYTPR');
    expect(info.textContent).toBe('ESYTPR budandı: R sık değil (3 < 4), bu yüzden sayılmadı.');
    // a second click on the picked node unpicks it
    click('ESYTPR');
    expect(player.state.params.node).toBeNull();
    expect(info.hidden).toBe(true);
    // a node above the painted level is not yet looked at
    player.goto(STEP.seviye1);
    click('ESY');
    expect(info.textContent).toBe('ESY: henüz bakılmadı.');
    // the reason follows the threshold
    player.goto(STEP.budama);
    click('ST');
    player.setParams({ minCount: 3 });
    expect(info.textContent).toBe('ST sık: 3 fiş ≥ 3.');
    scene.destroy();
  });

  it('keyboard: arrows move between nodes, Enter and Space pick, and the step keys stay out', () => {
    const { player, sceneHost, scene } = setup();
    player.goto(STEP.budama);
    const at = (abbr: string) => sceneHost.querySelector<HTMLElement>(`.ap-node[data-abbr="${abbr}"]`)!;
    const first = at('E');
    first.focus();
    const right = key('ArrowRight');
    first.dispatchEvent(right);
    expect(document.activeElement).toBe(at('S'));
    expect(at('S').tabIndex).toBe(0);
    expect(first.tabIndex).toBe(-1);
    const bubbled = vi.fn();
    const stray = key('ArrowRight');
    at('S').dispatchEvent(stray);
    expect(stray.defaultPrevented).toBe(true);
    at('S').focus();
    window.addEventListener('keydown', bubbled);
    const down = key('ArrowDown');
    at('S').dispatchEvent(down);
    expect((document.activeElement as HTMLElement).dataset.level).toBe('2');
    const space = key(' ');
    (document.activeElement as HTMLElement).dispatchEvent(space);
    expect(bubbled).not.toHaveBeenCalled();
    expect(player.state.params.node).toBe((document.activeElement as HTMLElement).dataset.key);
    expect(player.state.index).toBe(STEP.budama);
    window.removeEventListener('keydown', bubbled);
    // Enter on the picked node unpicks it, and once more picks it again
    (document.activeElement as HTMLElement).dispatchEvent(key('Enter'));
    expect(sceneHost.querySelector<HTMLElement>('.ap-node-info')!.hidden).toBe(true);
    (document.activeElement as HTMLElement).dispatchEvent(key('Enter'));
    expect(sceneHost.querySelector<HTMLElement>('.ap-node-info')!.hidden).toBe(false);
    scene.destroy();
  });

  it('Home and End move within the level row and do not change the step', () => {
    const { player, sceneHost, scene } = setup();
    player.goto(STEP.budama);
    const at = (abbr: string) => sceneHost.querySelector<HTMLElement>(`.ap-node[data-abbr="${abbr}"]`)!;
    const bubbled = vi.fn();
    window.addEventListener('keydown', bubbled);
    at('Y').focus();
    at('Y').dispatchEvent(key('End'));
    expect(document.activeElement).toBe(at('R'));
    at('R').dispatchEvent(key('Home'));
    expect(document.activeElement).toBe(at('E'));
    expect(at('E').tabIndex).toBe(0);
    expect(bubbled).not.toHaveBeenCalled();
    expect(player.state.index).toBe(STEP.budama);
    window.removeEventListener('keydown', bubbled);
    scene.destroy();
  });

  it("only the step's controls are visible", () => {
    const { player, params, scene } = setup();
    const ctls = ['minCount', 'level', 'inserted', 'baseItem'];
    const shownAt = (id: string) => { player.goto(STEP[id]); return ctls.filter((c) => visible(params, c)); };
    expect(shownAt('uzay')).toEqual([]);
    for (const id of ['seviye1', 'ozellik', 'seviye2', 'budama', 'dur']) expect(shownAt(id), id).toEqual(['minCount', 'level']);
    expect(shownAt('esik')).toEqual(['minCount']);
    expect(shownAt('fp-sira')).toEqual(['minCount', 'inserted']);
    expect(shownAt('fp-agac')).toEqual(['minCount', 'inserted']);
    expect(shownAt('kosullu')).toEqual(['minCount', 'baseItem']);
    expect(shownAt('karsilastir')).toEqual(['minCount']);
    scene.destroy();
  });

  it('every lab text names only controls visible on its step', () => {
    const { player, params, scene } = setup();
    const named: [RegExp, string][] = [[/[Ss]eviye düğme|Sona git/, 'level'], [/Fiş ekleme/, 'inserted'], [/Ürün seçici/, 'baseItem'], [/min_support/, 'minCount']];
    aprioriScenario.steps.forEach((step, i) => {
      player.goto(i);
      for (const [re, ctl] of named) if (re.test(step.labText ?? '')) expect(visible(params, ctl), `${step.id}: ${ctl}`).toBe(true);
    });
    // every Lab step with a threshold control names it
    aprioriScenario.steps.forEach((step, i) => {
      if (i === 0) return;
      expect(step.labText, step.id).toMatch(/min_support/);
    });
    scene.destroy();
  });

  it('basket slider and product picker drive the tree', () => {
    const { player, sceneHost, params, scene } = setup();
    player.goto(STEP['fp-agac']);
    const slider = params.querySelector<HTMLInputElement>('input[data-param="inserted"]')!;
    expect(slider.max).toBe('18');
    expect(params.querySelector('[data-ctl="inserted"] output')!.textContent).toBe('18 / 18 fiş');
    move(slider, 0);
    expect(sceneHost.querySelectorAll('.ap-fp-node:not([hidden])')).toHaveLength(1);
    move(slider, 7);
    expect(sceneHost.querySelector('.ap-fp-count')!.textContent).toMatch(/^7 fiş, \d+ düğüm$/);
    player.goto(STEP.kosullu);
    const chip = (item: string) => params.querySelector<HTMLButtonElement>(`button[data-item="${item}"]`)!;
    expect(chip('peynir').getAttribute('aria-pressed')).toBe('true');
    expect(chip('recel').disabled).toBe(true);
    chip('yumurta').click();
    expect(player.state.params.baseItem).toBe('yumurta');
    expect(chip('yumurta').getAttribute('aria-pressed')).toBe('true');
    expect(sceneHost.querySelector('.ap-base-title')!.textContent).toBe('Yumurta için koşullu taban');
    move(params.querySelector<HTMLInputElement>('input[data-param="minCount"]')!, 1);
    expect(chip('recel').disabled).toBe(false);
    scene.destroy();
  });

  it('no frequent set shows the empty message', () => {
    const { player, sceneHost, params, scene } = setup();
    player.goto(STEP.seviye2);
    const empty = sceneHost.querySelector<HTMLElement>('.ap-empty')!;
    expect(empty.hidden).toBe(true);
    move(params.querySelector<HTMLInputElement>('input[data-param="minCount"]')!, 18);
    expect(empty.hidden).toBe(false);
    expect(empty.textContent).toBe('Bu eşikte sık küme yok.');
    expect(sceneHost.querySelector('[data-counter="frequent"]')!.textContent).toBe('sık küme: 0');
    expect(sceneHost.textContent).not.toMatch(/NaN|undefined|Infinity/);
    move(params.querySelector<HTMLInputElement>('input[data-param="minCount"]')!, 4);
    expect(empty.hidden).toBe(true);
    scene.destroy();
  });

  it('in Ders a node is a plain box: a click picks nothing and ArrowRight still steps', () => {
    const { player, sceneHost, scene } = setup();
    const ders = document.createElement('div');
    document.body.append(ders);
    scene.destroy();
    player.destroy();
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }));
    const p = new StepPlayer<AprioriParams>(aprioriScenario);
    const sc = mountAprioriScene(ders, p, 'ders');
    sc.resize(1280, 440);
    p.goto(STEP.budama);
    const node = ders.querySelector<HTMLElement>('.ap-node[data-abbr="ES"]')!;
    expect(node.hasAttribute('role')).toBe(false);
    expect(node.hasAttribute('tabindex')).toBe(false);
    node.click();
    expect(p.state.params.node).toBeNull();
    const ev = key('ArrowRight');
    const bubbled = vi.fn();
    window.addEventListener('keydown', bubbled);
    node.dispatchEvent(ev);
    expect(bubbled).toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
    window.removeEventListener('keydown', bubbled);
    // Lab -> Ders drops the roving focus and the buttons
    sc.setMode('lab');
    const lab = ders.querySelector<HTMLElement>('.ap-node[data-abbr="E"]')!;
    expect(lab.getAttribute('role')).toBe('button');
    lab.focus();
    sc.setMode('ders');
    expect(document.activeElement).not.toBe(lab);
    expect(lab.hasAttribute('role')).toBe(false);
    sc.destroy();
    p.destroy();
    void sceneHost;
  });

  it('control labels and outputs carry no product-name suffix', () => {
    const { player, params, scene } = setup();
    const bad = new RegExp(`(${Object.values(sepetData.names).join('|')})(['’]|\\p{L})`, 'u');
    for (let i = 0; i < aprioriScenario.steps.length; i++) {
      player.goto(i);
      const words = [...params.querySelectorAll('*')].filter((e) => e.children.length === 0).map((e) => e.textContent).join(' ');
      expect(words).not.toMatch(bad);
      expect(words).not.toMatch(/NaN|undefined|Infinity/);
    }
    scene.destroy();
  });
});
