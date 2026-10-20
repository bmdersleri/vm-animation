// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { treeScenario, type TreeParams } from '../../../src/concepts/karar-agaci/scenario';
import { mountTreeParams } from '../../../src/concepts/karar-agaci/controls';
import { mountTreeExtra } from '../../../src/concepts/karar-agaci/extra';
import { createTreePointer } from '../../../src/concepts/karar-agaci/main';
import { train } from '../../../src/concepts/karar-agaci/data';

let cleanup: (() => void)[] = [];
afterEach(() => {
  for (const f of cleanup) f();
  cleanup = [];
  document.body.replaceChildren();
});

function make(): { player: StepPlayer<TreeParams>; host: HTMLElement } {
  const player = new StepPlayer(treeScenario);
  const host = document.createElement('div');
  document.body.append(host);
  cleanup.push(() => player.destroy());
  return { player, host };
}

const frame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));
const range = (xs: number[]): [number, number] => [Math.min(...xs), Math.max(...xs)];

describe('tree parameter controls', () => {
  it('depth slider maps 7 to Infinity and back', () => {
    const { player, host } = make();
    mountTreeParams(host, player);
    const slider = host.querySelector<HTMLInputElement>('input[type=range]')!;
    expect([slider.min, slider.max]).toEqual(['0', '7']);
    slider.value = '7';
    slider.dispatchEvent(new Event('input'));
    expect(player.state.params.depth).toBe(Infinity);
    expect(host.querySelector('output')!.textContent).toBe('sınırsız');
    player.setParam('depth', 3);
    expect(slider.value).toBe('3');
    expect(host.querySelector('output')!.textContent).toBe('3');
    player.setParam('depth', Infinity);
    expect(slider.value).toBe('7');
  });

  it('criterion select follows step 5', () => {
    const { player, host } = make();
    mountTreeParams(host, player);
    const sel = host.querySelector<HTMLSelectElement>('select')!;
    expect(sel.value).toBe('gini');
    player.goto(5);
    expect(sel.value).toBe('entropi');
    sel.value = 'gini';
    sel.dispatchEvent(new Event('change'));
    expect(player.state.params.criterion).toBe('gini');
  });

  it('test points checkbox is two-way', () => {
    const { player, host } = make();
    mountTreeParams(host, player);
    const box = host.querySelector<HTMLInputElement>('input[type=checkbox]')!;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    expect(player.state.params.showTest).toBe(true);
    player.setParam('showTest', false);
    expect(box.checked).toBe(false);
  });
});

describe('tree threshold pointer', () => {
  it('pointer outside lab or outside steps 6–8 does nothing', () => {
    const { player } = make();
    let lab = false;
    const ptr = createTreePointer(player, () => lab);
    player.goto(7);
    ptr({ x: 30, y: 2 }, 'down', 0);
    expect(player.state.params.userSplit).toBeNull();
    lab = true;
    player.goto(9);
    ptr({ x: 30, y: 2 }, 'down', 0);
    expect(player.state.params.userSplit).toBeNull();
    player.goto(7);
    ptr({ x: 30, y: 2 }, 'down', null);
    expect(player.state.params.userSplit).toBeNull();
  });

  it('drag clamps the threshold to the data range', () => {
    const { player } = make();
    const ptr = createTreePointer(player, () => true);
    player.goto(7);
    ptr({ x: 30, y: 2 }, 'down', 0);
    expect(player.state.params.userSplit).toEqual({ feature: 0, threshold: 30 });
    expect(player.state.params.scan).toBe(-1);
    const [lo, hi] = range(train.map((r) => r.t));
    ptr({ x: 1000, y: 2 }, 'move', null);
    expect(player.state.params.userSplit!.threshold).toBe(hi);
    ptr({ x: -1000, y: 2 }, 'move', null);
    expect(player.state.params.userSplit!.threshold).toBe(lo);
    ptr({ x: 20, y: 2 }, 'move', null);
    ptr({ x: 500, y: 2 }, 'up', null);
    expect(player.state.params.userSplit!.threshold).toBe(20);
    ptr({ x: 40, y: 2 }, 'move', null); // no press any more: hover only
    expect(player.state.params.userSplit!.threshold).toBe(20);
  });

  it('drags the complaint line on the y axis', () => {
    const { player } = make();
    const ptr = createTreePointer(player, () => true);
    player.goto(8);
    ptr({ x: 30, y: 2.5 }, 'down', 1);
    ptr({ x: 30, y: 99 }, 'move', null);
    const [, hi] = range(train.map((r) => r.c));
    expect(player.state.params.userSplit).toEqual({ feature: 1, threshold: hi });
  });
});

describe('tree extra panel', () => {
  it('extra shows the tennis table in part 1 and accuracies in part 2', async () => {
    const { player, host } = make();
    mountTreeExtra(host, player);
    expect(host.querySelectorAll('tbody tr').length).toBe(14);
    expect(host.querySelector('tr[data-branch]')).toBeNull();
    player.goto(4);
    await frame();
    const rows = [...host.querySelectorAll('tbody tr')];
    expect(rows.every((r) => r.hasAttribute('data-branch'))).toBe(true);
    // winner Hava: G1 Güneşli is branch 0, G3 Bulutlu branch 1, G4 Yağmurlu branch 2
    expect(rows.slice(0, 4).map((r) => r.getAttribute('data-branch'))).toEqual(['0', '0', '1', '2']);
    expect(host.textContent).not.toContain('Eğitim doğruluğu');
    player.goto(10);
    await frame();
    expect(host.querySelector<HTMLElement>('.tree-extra-scroll')!.hidden).toBe(true);
    expect(host.textContent).toContain('Eğitim doğruluğu %');
    expect(host.textContent).toContain('Test doğruluğu %');
    expect(host.textContent).toContain('scikit-learn (CART) her düğümü ikiye böler; burada kategorileri ayrı dallar olarak gösteriyoruz.');
  });

  it('test accuracy is hidden while test points are hidden', async () => {
    const { player, host } = make();
    mountTreeExtra(host, player);
    player.goto(8);
    await frame();
    expect(host.textContent).toContain('Eğitim doğruluğu');
    expect(host.textContent).not.toContain('Test doğruluğu');
  });
});
