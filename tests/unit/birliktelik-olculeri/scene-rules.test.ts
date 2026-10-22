// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { mountBirliktelikOlculeriScene } from '../../../src/concepts/birliktelik-olculeri/scene';
import { birliktelikOlculeriScenario, type BirliktelikOlculeriParams } from '../../../src/concepts/birliktelik-olculeri/scenario';
import { sepetData } from '../../../src/concepts/birliktelik/data';
import { itemName } from '../../../src/concepts/birliktelik/format';
import { rules } from '../../../src/concepts/birliktelik/rules';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

const setup = () => {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }));
  const player = new StepPlayer<BirliktelikOlculeriParams>(birliktelikOlculeriScenario);
  const host = document.createElement('div');
  document.body.append(host);
  const scene = mountBirliktelikOlculeriScene(host, player, 'ders');
  scene.resize(1000, 600);
  return { player, host, scene };
};
const fin = (scene: { destroy(): void }, player: StepPlayer<BirliktelikOlculeriParams>) => { scene.destroy(); player.destroy(); };
const pts = (host: HTMLElement) => [...host.querySelectorAll<SVGGElement>('g.bk-rule-pt')];
const tx = sepetData.transactions;

describe('birliktelik-olculeri rule scatter', () => {
  it('13 rule points at 0.2 and 0.5', () => {
    const { player, host, scene } = setup();
    player.goto(8);
    expect(host.querySelector<HTMLElement>('.bk-scene')!.dataset.view).toBe('rules');
    expect(pts(host)).toHaveLength(13);
    expect(pts(host)).toHaveLength(rules(tx, 0.2, 0.5).length);
    expect(pts(host).filter((p) => p.dataset.dim === 'true')).toHaveLength(0);
    // lift at most 1 is hollow, above 1 is filled
    for (const p of pts(host)) expect(p.dataset.hollow).toBe(String(Number(p.dataset.lift) <= 1 + 1e-9));
    expect(pts(host).some((p) => p.dataset.hollow === 'true')).toBe(true);
    expect(pts(host).some((p) => p.dataset.hollow === 'false')).toBe(true);
    // the two threshold lines are drawn
    expect(host.querySelector('line.bk-thr-support')).not.toBeNull();
    expect(host.querySelector('line.bk-thr-conf')).not.toBeNull();
    expect(host.querySelector('.bk-thr-label.support')!.textContent).toBe('min_support 0,20');
    expect(host.querySelector('.bk-thr-label.conf')!.textContent).toBe('min güven 0,50');
    // Ekmek -> Süt is marked and labelled
    const sel = pts(host).filter((p) => p.dataset.selected === 'true');
    expect(sel).toHaveLength(1);
    expect(sel[0].dataset.key).toBe('ekmek>sut');
    expect(host.querySelector('.bk-rule-label')!.textContent).toBe('Ekmek → Süt');
    expect(host.textContent).not.toMatch(/NaN|Infinity|undefined/);
    fin(scene, player);
  });

  it('step 10 dims the 4 rules with lift at most 1.1', () => {
    const { player, host, scene } = setup();
    player.goto(9);
    const dim = pts(host).filter((p) => p.dataset.dim === 'true');
    expect(pts(host)).toHaveLength(13);
    expect(dim).toHaveLength(4);
    for (const p of dim) expect(Number(p.dataset.lift)).toBeLessThanOrEqual(1.1 + 1e-9);
    for (const p of pts(host).filter((q) => q.dataset.dim === 'false')) expect(Number(p.dataset.lift)).toBeGreaterThan(1.1);
    fin(scene, player);
  });

  it('the top rule is labelled', () => {
    const { player, host, scene } = setup();
    player.goto(9);
    const top = host.querySelector('.bk-rule-label.top')!;
    expect(top.textContent).toBe('{Ekmek, Yumurta} → Süt');
    // the top rule is the first kept rule, and its marker is the first point drawn
    expect(pts(host)[0].getAttribute('aria-label')).toContain('{Ekmek, Yumurta} → Süt');
    expect(pts(host)[0].dataset.dim).toBe('false');
    // Ekmek -> Süt is still marked (and faded) beside it
    expect(host.querySelectorAll('.bk-rule-label')).toHaveLength(2);
    expect(host.querySelector<SVGGElement>('g.bk-rule-pt[data-key="ekmek>sut"]')!.dataset.dim).toBe('true');
    fin(scene, player);
  });

  it('the two labels do not overlap', () => {
    const { player, host, scene } = setup();
    player.goto(9);
    const texts = [...host.querySelectorAll('.bk-rule-label')].map((t) => ({
      x: Number(t.getAttribute('x')), y: Number(t.getAttribute('y')), n: t.textContent!.length, a: t.getAttribute('text-anchor'),
    }));
    const box = (t: (typeof texts)[number]) => {
      const w = t.n * 0.7 * 16;
      const l = t.a === 'end' ? t.x - w : t.a === 'middle' ? t.x - w / 2 : t.x;
      return { l, r: l + w, t: t.y - 15, b: t.y + 5 };
    };
    const [a, b] = texts.map(box);
    expect(a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t).toBe(true);
    fin(scene, player);
  });

  it('shows the chosen rule readout and a no-rules note, never NaN', () => {
    const { player, host, scene } = setup();
    player.goto(8);
    expect(host.querySelector('[data-sel-support]')!.textContent).toBe('0,389');
    expect(host.querySelector('[data-sel-confidence]')!.textContent).toBe('0,636');
    expect(host.querySelector('[data-sel-lift]')!.textContent).toBe('0,955');
    player.setParams({ minSupport: 0.6, minConfidence: 1 });
    expect(pts(host)).toHaveLength(0);
    expect(host.querySelector('.bk-rule-empty')!.textContent).toBe('Bu eşiklerde kural yok.');
    expect(host.textContent).not.toMatch(/NaN|Infinity|undefined/);
    fin(scene, player);
  });

  it('the panel names the rules that share a point', () => {
    const { player, host, scene } = setup();
    player.goto(8);
    const stacks = [...host.querySelectorAll<HTMLElement>('.bk-panel [data-stack]')].map((p) => p.textContent);
    expect(stacks).toEqual([
      'Aynı noktada 2 kural: Peynir → Yumurta · Peynir → Süt',
      'Aynı noktada 2 kural: Yumurta → {Ekmek, Süt} · Yumurta → Ekmek',
    ]);
    fin(scene, player);
  });

  it('a busy Lab scatter caps the stacked-point notes', () => {
    const { player, host, scene } = setup();
    player.goto(8);
    player.setParams({ minSupport: 0.05, minConfidence: 0.1 });
    expect(host.querySelectorAll('.bk-panel [data-stack]')).toHaveLength(2);
    const notes = [...host.querySelectorAll('.bk-panel .bk-note')].map((p) => p.textContent);
    expect(notes).toContain('… ve 20 noktada daha birden çok kural var.');
    expect(host.querySelector('.bk-panel [data-stack]')!.textContent).toMatch(/ · …$/);
    fin(scene, player);
  });

  it('adds no Turkish suffix after a product name', () => {
    const { player, host, scene } = setup();
    for (const i of [8, 9]) {
      player.goto(i);
      const text = host.textContent ?? '';
      for (const item of sepetData.items) expect(text).not.toContain(`${itemName(item)}'`);
    }
    fin(scene, player);
  });
});
