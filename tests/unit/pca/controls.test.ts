// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { pcaScenario, type PcaParams } from '../../../src/concepts/pca/scenario';
import { derivePcaView } from '../../../src/concepts/pca/view';
import { mountPcaParams } from '../../../src/concepts/pca/controls';
import { mountPcaExtra } from '../../../src/concepts/pca/extra';
import { createPcaPointer } from '../../../src/concepts/pca/main';

const cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup.splice(0).forEach((f) => f());
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function make(): { player: StepPlayer<PcaParams>; host: HTMLElement } {
  const player = new StepPlayer(pcaScenario);
  const host = document.createElement('div');
  document.body.append(host);
  cleanup.push(() => player.destroy());
  return { player, host };
}

const radios = (host: HTMLElement, name: string): HTMLInputElement[] =>
  [...host.querySelectorAll<HTMLInputElement>(`input[type=radio][name=${name}]`)];
const checked = (host: HTMLElement, name: string): string | undefined =>
  radios(host, name).find((r) => r.checked)?.value;
const slider = (host: HTMLElement, param: string): HTMLInputElement =>
  host.querySelector<HTMLInputElement>(`input[type=range][data-param=${param}]`)!;
const ctl = (el: Element): HTMLElement => el.closest<HTMLElement>('.ctl')!;
const setSlider = (s: HTMLInputElement, v: number): void => {
  s.value = String(v);
  s.dispatchEvent(new Event('input'));
};

function groups(host: HTMLElement): Record<'theta' | 'find' | 'birim' | 'threshold' | 'perplexity', HTMLElement> {
  return {
    theta: ctl(slider(host, 'theta')),
    find: ctl(host.querySelector('button.find-pc1')!),
    birim: ctl(radios(host, 'birim')[0]),
    threshold: ctl(slider(host, 'threshold')),
    perplexity: ctl(radios(host, 'perplexity')[0]),
  };
}
const openGroups = (host: HTMLElement): string[] =>
  Object.entries(groups(host)).filter(([, g]) => !g.hasAttribute('data-off')).map(([k]) => k);

describe('mountPcaParams', () => {
  it('builds the groups with the specified ranges and values', () => {
    const { player, host } = make();
    mountPcaParams(host, player);
    expect(host.querySelector('div.knn-params.pca-params')).not.toBeNull();
    const t = slider(host, 'theta');
    expect([t.min, t.max, t.step]).toEqual(['0', '179', '1']);
    const th = slider(host, 'threshold');
    expect([th.min, th.max, th.step]).toEqual(['50', '99', '1']);
    expect(radios(host, 'birim').map((r) => r.value)).toEqual(['1', '1000']);
    expect(radios(host, 'perplexity').map((r) => r.value)).toEqual(['5', '30', '50']);
    expect(host.querySelectorAll('fieldset.ctl.choice')).toHaveLength(2);
    expect(host.querySelectorAll('div.ctl.range')).toHaveLength(2);
    expect(host.querySelector('div.ctl.action button.find-pc1')).not.toBeNull();
  });

  it('slider writes theta and follows the step', () => {
    vi.useFakeTimers();
    const { player, host } = make();
    mountPcaParams(host, player);
    player.goto(1);
    setSlider(slider(host, 'theta'), 30);
    expect(player.state.params.theta).toBe(30);
    expect(ctl(slider(host, 'theta')).querySelector('output')!.textContent).toBe('30°');
    player.goto(3);
    expect(slider(host, 'theta').value).toBe('45');
    player.goto(2);
    vi.advanceTimersByTime(4000);
    expect(player.state.params.theta).toBe(180);
    expect(slider(host, 'theta').value).toBe('0');
  });

  it('find PC1 animates theta to 45, with ×1000 to 90', () => {
    const { player, host } = make();
    mountPcaParams(host, player);
    let t = 0;
    const queue: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => queue.push(cb));
    vi.spyOn(performance, 'now').mockImplementation(() => t);
    const run = (): number[] => {
      const seen: number[] = [];
      const off = player.subscribe((s) => seen.push(s.params.theta));
      for (let i = 0; i < 20 && queue.length; i++) {
        t += 100;
        queue.shift()!(t);
      }
      if (typeof off === 'function') off();
      return seen;
    };
    player.goto(1);
    host.querySelector<HTMLButtonElement>('button.find-pc1')!.click();
    const seen = run();
    expect(seen.some((v) => v > 0 && v < 45)).toBe(true);
    expect(player.state.params.theta).toBe(45);

    player.setParam('birim', 1000);
    player.setParam('theta', 0);
    t = 0;
    host.querySelector<HTMLButtonElement>('button.find-pc1')!.click();
    const seen2 = run();
    expect(seen2.some((v) => v > 0 && v < 90)).toBe(true);
    expect(player.state.params.theta).toBe(90);
  });

  it('groups follow the steps and hide outside them', () => {
    const { player, host } = make();
    mountPcaParams(host, player);
    expect(openGroups(host)).toEqual(['birim']);
    player.goto(1);
    expect(openGroups(host)).toEqual(['theta', 'find', 'birim']);
    player.goto(8);
    expect(openGroups(host)).toEqual(['threshold']);
    expect(ctl(slider(host, 'threshold')).querySelector('output')!.textContent).toBe('%90 → 3 bileşen');
    player.goto(10);
    expect(openGroups(host)).toEqual(['perplexity']);
    expect(checked(host, 'perplexity')).toBe('30');
    for (let i = 0; i < 13; i++) {
      player.goto(i);
      for (const g of Object.values(groups(host))) {
        const inputs = [...g.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button')];
        expect(inputs.every((x) => x.disabled), `step ${i + 1}`).toBe(g.hasAttribute('data-off'));
      }
    }
  });

  it('radios write params', () => {
    const { player, host } = make();
    mountPcaParams(host, player);
    const pick = (name: string, value: string): void => {
      const r = radios(host, name).find((x) => x.value === value)!;
      r.checked = true;
      r.dispatchEvent(new Event('change'));
    };
    pick('birim', '1000');
    expect(player.state.params.birim).toBe(1000);
    expect(checked(host, 'birim')).toBe('1000');
    player.goto(10);
    pick('perplexity', '50');
    expect(player.state.params.perplexity).toBe(50);
  });

  it('threshold slider writes the param and shows the count', () => {
    const { player, host } = make();
    mountPcaParams(host, player);
    player.goto(9);
    setSlider(slider(host, 'threshold'), 50);
    expect(player.state.params.threshold).toBe(50);
    expect(ctl(slider(host, 'threshold')).querySelector('output')!.textContent).toBe('%50 → 2 bileşen');
  });
});

describe('createPcaPointer', () => {
  it('pointer works only in lab at steps 2–5', () => {
    const { player } = make();
    const spy = vi.spyOn(player, 'setParam');
    const lab = createPcaPointer(player, () => true);
    const ders = createPcaPointer(player, () => false);
    player.goto(1);
    ders(30, 'down');
    ders(40, 'move');
    expect(spy).not.toHaveBeenCalled();
    lab(30, 'down');
    expect(player.state.params.theta).toBe(30);
    lab(40, 'move');
    expect(player.state.params.theta).toBe(40);
    lab(100, 'up');
    expect(player.state.params.theta).toBe(40);
    spy.mockClear();
    for (const i of [0, 5, 7]) {
      player.goto(i);
      lab(60, 'down');
      lab(70, 'move');
    }
    expect(spy).not.toHaveBeenCalled();
    player.goto(4);
    lab(80, 'down');
    expect(player.state.params.theta).toBe(80);
  });

  it('move without a prior down does not call setParam', () => {
    const { player } = make();
    const spy = vi.spyOn(player, 'setParam');
    const lab = createPcaPointer(player, () => true);
    player.goto(1);
    lab(50, 'move');
    expect(spy).not.toHaveBeenCalled();
    lab(50, 'down');
    lab(55, 'up');
    spy.mockClear();
    lab(60, 'move');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('mountPcaExtra', () => {
  const visible = (host: HTMLElement): string[] =>
    [...host.querySelectorAll<HTMLElement>('.pca-extra p:not(.live-note)')]
      .filter((e) => !e.hidden).map((e) => e.textContent!);

  it('extra lists the curse of dimensionality, 60 → 53, the refit rule and the PCA-before-t-SNE tip', () => {
    const { player, host } = make();
    mountPcaExtra(host, player);
    const t0 = visible(host);
    expect(t0).toHaveLength(3);
    expect(t0[0]).toContain('Boyutun laneti (curse of dimensionality)');
    expect(t0[0]).toContain('5000');
    expect(t0[1]).toContain('53');
    expect(host.querySelector('code')!.textContent).toBe('PCA(n_components=0.90)');
    expect(t0[2]).toContain('yeniden fit etmeyin');
    player.goto(10);
    const t1 = visible(host);
    expect(t1).toHaveLength(2);
    expect(t1[0]).toContain('yeniden fit etmeyin');
    expect(t1[1]).toContain('t-SNE’den önce PCA ile 30–50 boyuta inmek');
    for (const i of [0, 3, 9, 12]) {
      player.goto(i);
      expect(host.querySelector('p.live-note')!.textContent).toBe(derivePcaView(i, player.state.params).note);
    }
    player.goto(9);
    player.setParam('threshold', 50);
    expect(host.querySelector('p.live-note')!.textContent).toBe(derivePcaView(9, player.state.params).note);
  });
});
