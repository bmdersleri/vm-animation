// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { randomForestScenario } from '../../../src/concepts/random-forest/scenario';
import { mountRfScene } from '../../../src/concepts/random-forest/scene';
import { RF } from '../../../src/concepts/topluluk/data';

const clean: (() => void)[] = [];
afterEach(() => {
  clean.splice(0).forEach((f) => f());
  document.body.replaceChildren();
});

function setup(w = 1280, h = 540) {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(randomForestScenario);
  const scene = mountRfScene(el, player, 'ders', { durationScale: 0 });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { el, player };
}

const step = (id: string) => randomForestScenario.steps.findIndex((s) => s.id === id);
const host = (el: HTMLElement) => el.querySelector('.rf-importance-host')!;
const values = (root: Element) => [...root.querySelectorAll('g.imp-bar')].map((b) => Number(b.getAttribute('data-value')));
const names = (root: Element) => [...root.querySelectorAll('g.imp-bar text.bar-name')].map((t) => t.textContent);

describe('importance scene', () => {
  it('step 9 bars are sorted and sum to one', () => {
    const { el, player } = setup();
    player.goto(step('onem'));
    expect(el.querySelector('.rf-stage')!.getAttribute('data-view')).toBe('importance');
    const v = values(host(el));
    expect(v).toHaveLength(8);
    expect(v).toEqual([...v].sort((a, b) => b - a));
    expect(v.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 3);
    expect(names(host(el))[0]).toBe('hizmetSayisi');
    expect(host(el).querySelector('g.imp-bar text.bar-value')!.textContent).toBe('0,176');
    expect(host(el).querySelector('text.imp-total')!.textContent).toContain('1,000');
    // the id column joins the split model
    player.setParam('withId', true);
    expect(values(host(el))).toHaveLength(9);
    expect(values(host(el)).reduce((s, x) => s + x, 0)).toBeCloseTo(1, 3);
  });

  it('step 10 shows musteriNo near zero under permutation', () => {
    const { el, player } = setup();
    player.goto(step('tuzak'));
    const cols = [...host(el).querySelectorAll('g.imp-col')];
    expect(cols.map((c) => c.getAttribute('data-method'))).toEqual(['mdi', 'perm']);
    for (const c of cols) {
      const v = values(c);
      expect(v).toHaveLength(9);
      expect(v).toEqual([...v].sort((a, b) => b - a));
    }
    const idBar = (c: Element) => c.querySelector('g.imp-bar.hl')!;
    expect(idBar(cols[0]).querySelector('text.bar-name')!.textContent).toBe('musteriNo');
    expect(idBar(cols[0]).querySelector('text.bar-value')!.textContent).toBe('0,044');
    expect(idBar(cols[1]).querySelector('text.bar-value')!.textContent).toBe('0,001');
    expect(Number(idBar(cols[1]).getAttribute('data-value'))).toBeLessThan(0.01);
    // the two orders differ: permutation puts internetHizi first
    expect(names(cols[1])[0]).toBe('internetHizi');
    expect(names(cols[0])[0]).not.toBe('internetHizi');
    expect(host(el).querySelector('text.causal')!.textContent).toContain('nedeni değil');
    expect(RF.withId.names).toContain('musteriNo');
  });

  it('step 10 links point to bagging and ozellik-secimi', () => {
    const { el, player } = setup();
    player.goto(step('tuzak'));
    const links = [...host(el).querySelectorAll('a.scene-link')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['../bagging/', '../ozellik-secimi/']);
    expect(links.every((a) => (a.textContent ?? '').length > 5)).toBe(true);
    player.goto(step('onem'));
    expect(host(el).querySelectorAll('a.scene-link')).toHaveLength(0);
  });
});
