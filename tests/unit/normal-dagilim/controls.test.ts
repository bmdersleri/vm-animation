// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import {
  normalScenario,
  SERIES_STEPS,
  MU_SIGMA_STEPS,
  AB_STEPS,
  K_STEPS,
  X_STEPS,
  type NormalParams,
} from '../../../src/concepts/normal-dagilim/scenario';
import { SERIES } from '../../../src/concepts/normal-dagilim/data';
import { mountNormalParams } from '../../../src/concepts/normal-dagilim/controls';
import { mountNormalExtra } from '../../../src/concepts/normal-dagilim/extra';
import { deriveNormalView } from '../../../src/concepts/normal-dagilim/view';

const players: StepPlayer<NormalParams>[] = [];

afterEach(() => {
  players.splice(0).forEach((p) => p.destroy());
  document.body.replaceChildren();
});

function make() {
  const player = new StepPlayer(normalScenario);
  players.push(player);
  const host = document.createElement('div');
  document.body.append(host);
  mountNormalParams(host, player);
  return { player, host };
}

const ctl = (host: HTMLElement, key: string) =>
  host.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-param=${key}]`)!;

it("only step's controls enabled", () => {
  const { player, host } = make();
  const groups = {
    seri: SERIES_STEPS,
    mu: MU_SIGMA_STEPS,
    sigma: MU_SIGMA_STEPS,
    a: AB_STEPS,
    b: AB_STEPS,
    k: K_STEPS,
    x: X_STEPS,
  };
  normalScenario.steps.forEach((_, i) => {
    player.goto(i);
    for (const [key, steps] of Object.entries(groups)) {
      expect(ctl(host, key).disabled).toBe(!steps.includes(i));
      expect(ctl(host, key).closest('.ctl')!.hasAttribute('data-off')).toBe(!steps.includes(i));
    }
  });
});

it('a step without controls hides card', () => {
  const player = new StepPlayer({
    ...normalScenario,
    steps: [...normalScenario.steps, { id: 'no-controls', title: 'Özet', text: 'Özet' }],
  });
  players.push(player);
  const host = document.createElement('div');
  mountNormalParams(host, player);
  player.goto(8);
  expect(host.hasAttribute('data-off')).toBe(true);
  player.goto(0);
  expect(host.hasAttribute('data-off')).toBe(false);
});

it('changing series resets mu and sigma', () => {
  const { player, host } = make();
  player.setParams({ mu: 90, sigma: 20 });
  ctl(host, 'seri').value = 'cagri';
  ctl(host, 'seri').dispatchEvent(new Event('change'));
  expect(player.state.params.mu).toBe(SERIES.cagri.mean);
  expect(player.state.params.sigma).toBe(SERIES.cagri.std);
});

it('sigma slider writes param', () => {
  const { player, host } = make();
  player.goto(MU_SIGMA_STEPS[0]);
  ctl(host, 'sigma').value = '12.5';
  ctl(host, 'sigma').dispatchEvent(new Event('input'));
  expect(player.state.params.sigma).toBe(12.5);
  expect(host.querySelector('output[for="' + ctl(host, 'sigma').id + '"]')!.textContent).toContain('12,5');
});

it('a and b sliders clamp series domain', () => {
  const { player, host } = make();
  player.setParams({ a: -100, b: 1000, x: 1000 });
  ctl(host, 'seri').value = 'cagri';
  ctl(host, 'seri').dispatchEvent(new Event('change'));
  expect(player.state.params.a).toBe(SERIES.cagri.domain[0]);
  expect(player.state.params.b).toBe(SERIES.cagri.domain[1]);
  expect(player.state.params.x).toBe(SERIES.cagri.domain[1]);
  expect((ctl(host, 'a') as HTMLInputElement).step).toBe('0.5');
});

it('five Lab notes and live view note', () => {
  const { player, host } = make();
  const extra = document.createElement('div');
  host.append(extra);
  mountNormalExtra(extra, player);
  expect(extra.querySelectorAll('p:not(.live-note)')).toHaveLength(5);
  normalScenario.steps.forEach((_, i) => {
    player.goto(i);
    expect(extra.querySelector('.live-note')!.textContent).toBe(deriveNormalView(i, player.state.params).note);
  });
});

it('scenario-forced series transitions reset params and widgets together', () => {
  const { player, host } = make();
  ctl(host, 'seri').value = 'cagri';
  ctl(host, 'seri').dispatchEvent(new Event('change'));
  player.goto(MU_SIGMA_STEPS[0]);
  expect(player.state.params.seri).toBe('sinav');
  expect(player.state.params.mu).toBe(SERIES.sinav.mean);
  expect(player.state.params.sigma).toBe(SERIES.sinav.std);
  expect(ctl(host, 'mu').value).toBe(String(SERIES.sinav.mean));
  player.goto(7);
  expect(player.state.params.mu).toBe(SERIES.cagri.mean);
  player.goto(0);
  expect(player.state.params.mu).toBe(SERIES.sinav.mean);
});
