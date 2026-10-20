// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { StepPlayer } from '../../src/core/player';
import { bindKeys, isFormControl } from '../../src/core/keyboard';

const scenario = {
  defaults: {},
  steps: [0, 1, 2, 3].map((i) => ({ id: `s${i}`, title: `t${i}`, text: '' })),
};
let unbind: (() => void) | null = null;
afterEach(() => { unbind?.(); unbind = null; document.body.innerHTML = ''; });

function setup(extra: { keys: string[]; label: string; run(): void }[] = []) {
  const player = new StepPlayer(scenario);
  const actions = { toggleFullscreen: vi.fn(), toggleHelp: vi.fn() };
  unbind = bindKeys(window, player, actions, extra);
  return { player, actions };
}
function press(key: string, opts: KeyboardEventInit = {}, target: EventTarget = document.body) {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
  target.dispatchEvent(ev);
  return ev;
}
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  document.body.appendChild(e);
  return e;
}

describe('keyboard', () => {
  it('ArrowRight advances and prevents default', () => {
    const { player } = setup();
    const ev = press('ArrowRight');
    expect(player.state.index).toBe(1);
    expect(ev.defaultPrevented).toBe(true);
  });
  it('Space advances; ArrowLeft goes back; Home/End', () => {
    const { player } = setup();
    press(' ');
    expect(player.state.index).toBe(1);
    press('ArrowLeft');
    expect(player.state.index).toBe(0);
    press('End');
    expect(player.state.index).toBe(3);
    press('Home');
    expect(player.state.index).toBe(0);
  });
  it('ignores step keys when focus is in a form control', () => {
    const { player } = setup();
    const range = el('input', { type: 'range' });
    for (const k of ['ArrowRight', ' ', 'Home', 'End', 'ArrowLeft']) {
      const ev = press(k, {}, range);
      expect(ev.defaultPrevented).toBe(false);
    }
    expect(player.state.index).toBe(0);
  });
  it('Space on a button does not advance', () => {
    const { player } = setup();
    const ev = press(' ', {}, el('button'));
    expect(player.state.index).toBe(0);
    expect(ev.defaultPrevented).toBe(false);
  });
  it('p/f/? built-ins, case-insensitive; ignore f/? repeat', () => {
    const { player, actions } = setup();
    press('P');
    expect(player.state.playing).toBe(true);
    press('p');
    expect(player.state.playing).toBe(false);
    press('F');
    press('f', { repeat: true });
    expect(actions.toggleFullscreen).toHaveBeenCalledTimes(1);
    press('?');
    press('?', { repeat: true });
    expect(actions.toggleHelp).toHaveBeenCalledTimes(1);
  });
  it('letter shortcuts ignored in text input but work on range', () => {
    const { actions } = setup();
    press('f', {}, el('input', { type: 'text' }));
    press('f', {}, el('input'));
    press('f', {}, el('textarea'));
    expect(actions.toggleFullscreen).not.toHaveBeenCalled();
    press('f', {}, el('input', { type: 'range' }));
    press('f', {}, el('input', { type: 'checkbox' }));
    press('f', {}, el('select'));
    press('f', {}, el('button'));
    expect(actions.toggleFullscreen).toHaveBeenCalledTimes(4);
  });
  it('extra shortcut runs (and not in text input)', () => {
    const run = vi.fn();
    setup([{ keys: ['+', '='], label: 'artır', run }]);
    const ev = press('=');
    expect(run).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);
    press('+', {}, el('input', { type: 'text' }));
    expect(run).toHaveBeenCalledTimes(1);
  });
  it('Ctrl/Alt/Meta combos ignored', () => {
    const { player } = setup();
    press('ArrowRight', { ctrlKey: true });
    press('ArrowRight', { altKey: true });
    press('ArrowRight', { metaKey: true });
    expect(player.state.index).toBe(0);
  });
  it('unbind removes listener', () => {
    const { player } = setup();
    unbind!();
    unbind = null;
    press('ArrowRight');
    expect(player.state.index).toBe(0);
  });
  it('isFormControl', () => {
    expect(isFormControl(null)).toBe(false);
    expect(isFormControl(el('div'))).toBe(false);
    expect(isFormControl(el('select'))).toBe(true);
    expect(isFormControl(el('div', { contenteditable: 'true' }))).toBe(true);
  });
});
