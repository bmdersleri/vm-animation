// @vitest-environment jsdom
import '../svg-stubs';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { ozellikSecimiScenario, type SecimParams } from '../../../src/concepts/ozellik-secimi/scenario';
import { mountSecimScene } from '../../../src/concepts/ozellik-secimi/scene';
import { deriveSecimView } from '../../../src/concepts/ozellik-secimi/view';

let cleanup: (() => void)[] = [];
afterEach(() => {
  for (const f of cleanup) f();
  cleanup = [];
  document.body.replaceChildren();
  vi.useRealTimers();
});

function setup(durationScale = 0) {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(ozellikSecimiScenario);
  const scene = mountSecimScene(el, player, 'ders', { durationScale });
  scene.resize(1280, 540);
  cleanup.push(() => { scene.destroy(); player.destroy(); });
  return { el, player, scene };
}
const view = (player: StepPlayer<SecimParams>) => deriveSecimView(player.state.index, player.state.params);
const all = (el: Element, sel: string): Element[] => [...el.querySelectorAll(sel)];
const one = (el: Element, sel: string): Element => {
  const e = el.querySelector(sel);
  if (!e) throw new Error(`missing ${sel}`);
  return e;
};
const texts = (el: Element, sel: string): (string | null)[] => all(el, sel).map((e) => e.textContent);
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('secim scene', () => {
  it('step 10: kbest, both and rfe lists', () => {
    const { el, player } = setup();
    player.goto(9);
    expect(one(el, '.secim-scene').getAttribute('data-view')).toBe('intersect');
    const pair = ['musteriKidemAy', 'destekTaleplerinSayisi'];
    expect(texts(el, 'div.intersect ul.kbest li')).toEqual(pair);
    expect(texts(el, 'div.intersect ul.both li')).toEqual(pair);
    expect(texts(el, 'div.intersect ul.rfe li')).toEqual(pair);
    expect(one(el, 'section.sel-kbest h3').textContent).toBe('SelectKBest (k = 2)');
    expect(one(el, 'section.sel-both h3').textContent).toBe('ortak');
    expect(one(el, 'section.sel-rfe h3').textContent).toBe('RFE (n = 2, ölçekli)');
    expect(one(el, 'p.rule').textContent).toContain('PCA sıkıştırır');
    expect(one(el, 'p.rule').textContent).toContain('yalnızca eğitim verisiyle');
    expect((one(el, 'div.intersect') as HTMLElement).hidden).toBe(false);
    const rows = all(el, 'svg.secim-plot g.row');
    expect(rows).toHaveLength(8);
    expect(rows.every((r) => r.classList.contains('hidden'))).toBe(true);
  });

  it('the intersection is hidden outside step 10', () => {
    const { el, player } = setup();
    expect((one(el, 'div.intersect') as HTMLElement).hidden).toBe(true);
    player.goto(9);
    player.goto(3);
    expect((one(el, 'div.intersect') as HTMLElement).hidden).toBe(true);
    expect(all(el, 'svg.secim-plot g.row.hidden')).toHaveLength(0);
  });

  it('strip text equals view.strip', () => {
    const { el, player } = setup();
    for (let i = 0; i < ozellikSecimiScenario.steps.length; i++) {
      player.goto(i);
      expect(texts(one(el, 'p.formula'), '.line').join('\n'), `step ${i + 1}`).toBe(view(player).strip);
    }
  });

  it('data-view follows the step mode', () => {
    const { el, player } = setup();
    const modes: string[] = [];
    for (let i = 0; i < ozellikSecimiScenario.steps.length; i++) {
      player.goto(i);
      modes.push(one(el, '.secim-scene').getAttribute('data-view')!);
    }
    expect(modes).toEqual(['strips', 'variance', 'fscore', 'kbest', 'split', 'rfe', 'rfe', 'rfe', 'rfe', 'intersect']);
  });

  it('a param change redraws the rows instantly', () => {
    const { el, player } = setup(1);
    player.goto(3);
    player.setParam('k', 2);
    return sleep(40).then(() => {
      expect(all(el, 'g.row.selected')).toHaveLength(2);
    });
  });

  it('no NaN in DOM', () => {
    const { el, player } = setup();
    for (let i = 0; i < ozellikSecimiScenario.steps.length; i++) {
      player.goto(i);
      expect(el.innerHTML, `step ${i + 1}`).not.toContain('NaN');
    }
  });

  it('rapid step changes during the RFE sweep end in the final state', async () => {
    const { el, player } = setup(1);
    player.goto(6);
    await sleep(1300);
    player.goto(8);
    player.goto(3);
    await sleep(1500);
    expect(one(el, '.secim-scene').getAttribute('data-view')).toBe('kbest');
    expect(texts(el, 'text.elim-label').filter(Boolean)).toEqual(['elendi', 'elendi', 'elendi', 'elendi']);
    expect(all(el, 'g.row.selected')).toHaveLength(4);
    expect(all(el, 'text.elim-label').some((t) => (t.textContent ?? '').includes('tur'))).toBe(false);
  }, 8000);

  it('render is measured', () => {
    const { player } = setup();
    const n = performance.getEntriesByName('secim-render').length;
    player.goto(3);
    expect(performance.getEntriesByName('secim-render').length).toBeGreaterThan(n);
  });
});
