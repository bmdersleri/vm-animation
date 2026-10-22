// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import {
  CHURN_STEPS, LEVERAGE_STEPS, SET_STEPS,
  korelasyonScenario, type KorelParams,
} from '../../../src/concepts/korelasyon-isi-haritasi/scenario';
import { mountKorelasyonParams } from '../../../src/concepts/korelasyon-isi-haritasi/controls';
import { mountKorelasyonExtra } from '../../../src/concepts/korelasyon-isi-haritasi/extra';
import { mountKorelasyonScene } from '../../../src/concepts/korelasyon-isi-haritasi/scene';
import { deriveKorelView } from '../../../src/concepts/korelasyon-isi-haritasi/view';

// jsdom has no DOMMatrix, which d3-transition needs to tween CSS transforms
class FakeMatrix {
  a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
  constructor(s = '') {
    const t = /translate\(\s*(-?[\d.]+)(?:px)?\s*,\s*(-?[\d.]+)/.exec(s);
    const m = /matrix\(([^)]+)\)/.exec(s);
    if (t) { this.e = Number(t[1]); this.f = Number(t[2]); }
    else if (m) [this.a, this.b, this.c, this.d, this.e, this.f] = m[1].split(',').map(Number);
  }
  get isIdentity(): boolean { return this.e === 0 && this.f === 0 && this.a === 1 && this.d === 1; }
}
(globalThis as { DOMMatrix?: unknown }).DOMMatrix ??= FakeMatrix;

const cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup.splice(0).forEach((f) => f());
  document.body.replaceChildren();
});

function make(): { player: StepPlayer<KorelParams>; host: HTMLElement } {
  const player = new StepPlayer<KorelParams>(korelasyonScenario);
  const host = document.createElement('div');
  document.body.append(host);
  cleanup.push(() => player.destroy());
  return { player, host };
}

const select = (host: HTMLElement): HTMLSelectElement =>
  host.querySelector<HTMLSelectElement>('select[data-param=set]')!;
const range = (host: HTMLElement): HTMLInputElement =>
  host.querySelector<HTMLInputElement>('input[type=range][data-param=noktaY]')!;
const box = (host: HTMLElement): HTMLInputElement =>
  host.querySelector<HTMLInputElement>('input[type=checkbox][data-param=churn]')!;
const row = (host: HTMLElement, param: string): HTMLElement =>
  host.querySelector<HTMLElement>(`[data-param=${param}]`)!.closest<HTMLElement>('.ctl')!;
const pick = (input: HTMLInputElement, checked: boolean): void => {
  input.checked = checked;
  input.dispatchEvent(new Event('change'));
};

const text = (e: Element | null): string => (e?.textContent ?? '').trim();

/** The y-axis ticks of set IV as (value, px) pairs, read from the axes layer's own transforms. */
function yTicks(el: Element): { v: number; y: number }[] {
  return [...el.querySelectorAll<SVGElement>('g.panel[data-set=IV] g.axis.y g.tick')]
    .map((g) => {
      const m = /translate\(\s*[-\d.]+,\s*(-?[\d.]+)/.exec(g.getAttribute('transform') ?? '');
      const v = Number(text(g.querySelector('text')).replace('−', '-').replace(',', '.'));
      return { v, y: m ? Number(m[1]) : NaN };
    })
    .filter((t) => Number.isFinite(t.v) && Number.isFinite(t.y))
    .sort((a, b) => a.v - b.v);
}
function yOf(el: Element, value: number): number {
  const t = yTicks(el);
  const a = t[0];
  const b = t[t.length - 1];
  return a.y + ((value - a.v) * (b.y - a.y)) / (b.v - a.v);
}

describe('mountKorelasyonParams', () => {
  it('has the set select, the noktaY range with its Turkish readout and the churn checkbox', () => {
    const { player, host } = make();
    mountKorelasyonParams(host, player);
    const set = select(host);
    expect([...set.options].map((o) => o.value)).toEqual(['1', '2', '3', '4']);
    expect([...set.options].map((o) => o.textContent)).toEqual(['I', 'II', 'III', 'IV']);
    const y = range(host);
    expect(y.min).toBe('6');
    expect(y.max).toBe('20');
    expect(y.step).toBe('0.5');
    expect(y.value).toBe('12.5');
    expect(text(host.querySelector('output'))).toBe('y = 12,5');
    expect(box(host).type).toBe('checkbox');
    expect(box(host).checked).toBe(false);
  });

  it('the set select writes the param with the right type', () => {
    const { player, host } = make();
    mountKorelasyonParams(host, player);
    player.goto(6);
    const spy = vi.spyOn(player, 'setParam');
    const set = select(host);
    set.value = '3';
    set.dispatchEvent(new Event('change'));
    expect(spy).toHaveBeenCalledWith('set', 3);
    expect(player.state.params.set).toBe(3);
  });

  it('the range and the checkbox write the params', () => {
    const { player, host } = make();
    mountKorelasyonParams(host, player);
    player.goto(5);
    const y = range(host);
    y.value = '18';
    y.dispatchEvent(new Event('input'));
    expect(player.state.params.noktaY).toBe(18);
    player.goto(3);
    pick(box(host), true);
    expect(player.state.params.churn).toBe(true);
  });

  it('every control is disabled and marked off outside its steps', () => {
    const { player, host } = make();
    mountKorelasyonParams(host, player);
    for (let i = 0; i < korelasyonScenario.steps.length; i++) {
      player.goto(i);
      const groups: [string, HTMLElement & { disabled: boolean }, readonly number[]][] = [
        ['set', select(host), SET_STEPS],
        ['noktaY', range(host), LEVERAGE_STEPS],
        ['churn', box(host), CHURN_STEPS],
      ];
      for (const [param, control, steps] of groups) {
        const off = !steps.includes(i);
        expect(control.disabled, `${param} adım ${i + 1}`).toBe(off);
        expect(row(host, param).hasAttribute('data-off'), `${param} adım ${i + 1}`).toBe(off);
      }
      // a step with no control at all hides the whole card in Lab
      expect(host.hasAttribute('data-off'), `adım ${i + 1}`).toBe(
        !SET_STEPS.includes(i) && !LEVERAGE_STEPS.includes(i) && !CHURN_STEPS.includes(i),
      );
    }
  });

  it('a step change re-syncs the widgets to the player state', () => {
    const { player, host } = make();
    mountKorelasyonParams(host, player);
    player.goto(4);
    // step 5 always draws the four panels: its set select is dead, so it is off
    expect(select(host).disabled).toBe(true);
    player.goto(5);
    expect(select(host).value).toBe('4');
    expect(select(host).disabled).toBe(false);
    expect(range(host).disabled).toBe(false);
    player.setParam('set', 1);
    expect(select(host).value).toBe('1');
    expect(range(host).disabled).toBe(true);
    player.goto(6);
    expect(select(host).value).toBe('2');
    player.goto(7);
    expect(box(host).checked).toBe(true);
    expect(box(host).disabled).toBe(false);
    expect(select(host).disabled).toBe(true);
    player.goto(0);
    expect(box(host).checked).toBe(false);
    expect(host.hasAttribute('data-off')).toBe(true);
  });

  it('the leverage slider is gated by set IV on step 6', () => {
    const { player, host } = make();
    mountKorelasyonParams(host, player);
    player.goto(5);
    expect(range(host).disabled).toBe(false);
    player.setParam('set', 2);
    expect(range(host).disabled).toBe(true);
    expect(row(host, 'noktaY').hasAttribute('data-off')).toBe(true);
    // the stored value is kept; only the live picture stops responding
    expect(text(host.querySelector('output'))).toBe('y = 12,5');
    player.setParam('set', 4);
    expect(range(host).disabled).toBe(false);
    expect(row(host, 'noktaY').hasAttribute('data-off')).toBe(false);
  });

  it('a scene drag moves the range input to the dragged y', () => {
    const { player, host } = make();
    mountKorelasyonParams(host, player);
    const stage = document.createElement('div');
    document.body.append(stage);
    const scene = mountKorelasyonScene(stage, player, 'lab', { durationScale: 0 });
    scene.resize(1280, 720);
    cleanup.push(() => scene.destroy());
    player.goto(5);
    expect(range(host).value).toBe('12.5');
    const lever = stage.querySelector<SVGElement>('circle.leverage');
    if (!lever) throw new Error('missing circle.leverage');
    const C = (window.PointerEvent ?? MouseEvent) as typeof MouseEvent;
    const at = (kind: string, y: number): void => {
      lever.dispatchEvent(new C(kind, { clientX: Number(lever.getAttribute('cx')), clientY: y, bubbles: true }));
    };
    at('pointerdown', Number(lever.getAttribute('cy')));
    at('pointermove', yOf(stage, 18));
    at('pointerup', yOf(stage, 18));
    expect(player.state.params.noktaY).toBe(18);
    expect(range(host).value).toBe('18');
    expect(text(host.querySelector('output'))).toBe('y = 18,0');
  });
});

describe('mountKorelasyonExtra', () => {
  it('gives the Lab paragraphs and a live note bound to view.note', () => {
    const { player, host } = make();
    mountKorelasyonExtra(host, player);
    const paras = [...host.querySelectorAll<HTMLParagraphElement>('p:not(.live-note)')];
    expect(paras).toHaveLength(7);
    expect(paras.every((p) => p.textContent!.length > 60)).toBe(true);
    const joined = paras.map((p) => p.textContent).join(' ');
    for (const key of ['şemsiye', 'üçüncü değişken', 'ters nedensellik', 'köşegen', 'küçük örneklem', 'OgrenciEDA', 'Telco']) {
      expect(joined).toContain(key);
    }
    const note = host.querySelector<HTMLElement>('p.live-note')!;
    for (let i = 0; i < korelasyonScenario.steps.length; i++) {
      player.goto(i);
      expect(note.textContent).toBe(deriveKorelView(i, player.state.params).note);
    }
  });
});
