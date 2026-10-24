// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import '../svg-stubs';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { overlap, type Box } from '../../../src/core/plot/label-place';
import { BALANCED, copiesFor, MINORITY, SWEEP_RATIOS, syntheticFor } from '../../../src/concepts/dengesiz-veri/model';
import { dengesizVeriScenario as sc } from '../../../src/concepts/dengesiz-veri/scenario';
import { mountImbScene } from '../../../src/concepts/dengesiz-veri/scene';
import { BADGE_MAX, BADGE_MIN, copyScale, panelsLayout } from '../../../src/concepts/dengesiz-veri/scene-smote';

const clean: (() => void)[] = [];
afterEach(() => {
  clean.splice(0).forEach((fn) => fn());
  document.body.replaceChildren();
});

function setup(w = 1280, h = 540) {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(sc);
  const scene = mountImbScene(el, player, 'ders', { durationScale: 0 });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { el, player };
}

const go = (player: StepPlayer<(typeof sc)['defaults']>, id: string) => player.goto(stepIndex(sc, id));
const count = (el: ParentNode, sel: string) => el.querySelectorAll(sel).length;
const num = (e: Element, a: string) => Number(e.getAttribute(a));
const boxOf = (rect: Element): Box => ({ l: num(rect, 'x'), t: num(rect, 'y'), r: num(rect, 'x') + num(rect, 'width'), b: num(rect, 'y') + num(rect, 'height') });

describe('step 6: SMOTE fills the training set', () => {
  it('step 6 sweep ends at 1313 against 1313', () => {
    const { el, player } = setup();
    go(player, 'smote-doldur');
    expect(el.querySelector('.imb-stage')!.getAttribute('data-view')).toBe('smote');
    player.setParams({ ratio: SWEEP_RATIOS[SWEEP_RATIOS.length - 1] });
    expect(el.querySelector('.imb-smote-host .imb-bar.neg .bar-value')!.textContent).toBe('1313');
    expect(el.querySelector('.imb-smote-host .imb-bar.pos .bar-value')!.textContent).toBe('1313');
    expect(count(el, '.imb-smote-host circle.pt.synthetic')).toBe(1226);
    expect(el.querySelector('.imb-smote-host .note-line')!.textContent).toBe('ayrılan 87 + 1226 sentetik');
  });

  it('a middle stop of the sweep adds that many synthetic points', () => {
    const { el, player } = setup();
    go(player, 'smote-doldur');
    const ratio = SWEEP_RATIOS[10];
    player.setParams({ ratio });
    expect(count(el, '.imb-smote-host circle.pt.synthetic')).toBe(syntheticFor(ratio));
    expect(el.querySelector('.imb-smote-host .note-line')!.textContent).toBe(`ayrılan 87 + ${syntheticFor(ratio)} sentetik`);
    expect(el.querySelector('.formula')!.textContent).not.toMatch(/NaN|undefined|Infinity/);
  });
});

describe('step 7: copy against SMOTE', () => {
  it('step 7 copy panel badges the most copied point', () => {
    const { el, player } = setup();
    go(player, 'kopyalama');
    expect(count(el, 'g[data-panel]')).toBe(2);
    const copies = copiesFor(42, 1);
    const top = Math.max(...copies);
    const first = copies.indexOf(top);
    expect(top).toBeGreaterThanOrEqual(BADGE_MIN);
    const badges = [...el.querySelectorAll('[data-panel="kopya"] .copy-badge')];
    const best = badges.find((b) => b.getAttribute('data-index') === String(first))!;
    expect(best.querySelector('text')!.textContent).toBe(`×${top + 1}`);
    expect(count(el, '[data-panel="smote"] .copy-badge')).toBe(0);
    // every badge belongs to a point with at least BADGE_MIN extra copies
    for (const b of badges) {
      expect(copies[Number(b.getAttribute('data-index'))]).toBeGreaterThanOrEqual(BADGE_MIN);
    }
    expect(badges.length).toBeLessThanOrEqual(BADGE_MAX);
    // the lesson text names the same N
    expect(sc.steps[stepIndex(sc, 'kopyalama')].text).toContain(`×${top + 1}`);
    expect(count(el, '[data-panel="kopya"] circle.pt.synthetic')).toBe(0);
    expect(count(el, '[data-panel="smote"] circle.pt.synthetic')).toBe(1226);
    expect(count(el, '[data-panel="kopya"] circle.pt.pos')).toBe(MINORITY.length);
  });

  it('at most 3 badges, and the copy count shows as dot area', () => {
    const { el, player } = setup();
    go(player, 'kopyalama');
    const copies = copiesFor(42, 1);
    expect(count(el, '[data-panel="kopya"] .copy-badge')).toBeLessThanOrEqual(3);
    expect(count(el, '[data-panel="kopya"] .copy-badge')).toBeGreaterThanOrEqual(1);
    const radii = [...el.querySelectorAll('[data-panel="kopya"] circle.pt.pos')].map((c) => num(c, 'r'));
    const few = copies.indexOf(Math.min(...copies));
    const many = copies.indexOf(Math.max(...copies));
    expect(copyScale(copies[many])).toBeGreaterThan(copyScale(copies[few]));
    expect(Math.max(...radii)).toBeGreaterThan(Math.min(...radii));
    // SMOTE panel keeps plain marks
    expect(new Set([...el.querySelectorAll('[data-panel="smote"] circle.pt.pos')].map((c) => num(c, 'r'))).size).toBe(1);
  });

  it.each([
    [1280, 540],
    [900, 480],
    [390, 640],
  ])('badges stay inside their panel and apart at %i px', (w, h) => {
    const { el, player } = setup(w, h);
    go(player, 'kopyalama');
    const lay = panelsLayout(w, h);
    const svg = el.querySelector('svg.imb-panels')!;
    expect(num(svg, 'width')).toBeLessThanOrEqual(w);
    const panel = el.querySelector('[data-panel="kopya"]')!;
    const frame = panel.querySelector('rect.frame')!;
    const fr = boxOf(frame);
    const rects = [...panel.querySelectorAll('.copy-badge rect')].map(boxOf);
    expect(rects.length).toBeGreaterThanOrEqual(1);
    rects.forEach((r, i) => {
      expect(r.l).toBeGreaterThanOrEqual(fr.l - 1);
      expect(r.r).toBeLessThanOrEqual(fr.r + 1);
      expect(r.t).toBeGreaterThanOrEqual(fr.t - 1);
      expect(r.b).toBeLessThanOrEqual(fr.b + 1);
      for (let j = i + 1; j < rects.length; j++) expect(overlap(r, rects[j])).toBe(0);
    });
    // no badge covers a churner mark
    const marks = [...panel.querySelectorAll('circle.pt.pos')].map((c) => ({
      l: num(c, 'cx') - num(c, 'r'),
      r: num(c, 'cx') + num(c, 'r'),
      t: num(c, 'cy') - num(c, 'r'),
      b: num(c, 'cy') + num(c, 'r'),
    }));
    for (const r of rects) for (const m of marks) expect(overlap(r, m)).toBe(0);
    // the two panels do not overlap and fit the width
    const [a, b] = lay.panels;
    expect(a.x + a.w).toBeLessThanOrEqual(w);
    expect(b.x + b.w).toBeLessThanOrEqual(w);
    expect(overlap({ l: a.x, t: a.y, r: a.x + a.w, b: a.y + a.h }, { l: b.x, t: b.y, r: b.x + b.w, b: b.y + b.h })).toBe(0);
  });

  it('panel titles and counts name the method and the added points', () => {
    const { el, player } = setup();
    go(player, 'kopyalama');
    expect(el.querySelector('[data-panel="kopya"] .panel-sub')!.textContent).toBe('87 özgün + 1226 kopya');
    expect(el.querySelector('[data-panel="smote"] .panel-sub')!.textContent).toBe('87 özgün + 1226 sentetik');
  });
});

describe('step 8: class weight', () => {
  const radius = (e: Element) => num(e, 'r');
  it('step 8 churner radius grows with the square root of the weight', () => {
    const { el, player } = setup();
    go(player, 'agirlik');
    expect(el.querySelector('.imb-stage')!.getAttribute('data-view')).toBe('weight');
    const host = el.querySelector('.imb-weight-host')!;
    expect(count(host, 'circle.pt')).toBe(1400);
    player.setParams({ weight: 'yok' });
    const base = radius(host.querySelector('circle.pt.pos')!);
    expect(radius(host.querySelector('circle.pt.neg')!)).toBe(base);
    player.setParams({ weight: 'dengeli' });
    const pos = radius(host.querySelector('circle.pt.pos')!);
    const neg = radius(host.querySelector('circle.pt.neg')!);
    expect(pos).toBeGreaterThan(base);
    expect(neg).toBeLessThan(base);
    expect(pos / base).toBeCloseTo(Math.sqrt(BALANCED.pos), 1);
    expect(neg / base).toBeCloseTo(Math.sqrt(BALANCED.neg), 1);
    // area is proportional to the weight: weight 4 doubles the radius
    player.setParams({ weight: 'elle', manualWeight: 4 });
    expect(radius(host.querySelector('circle.pt.pos')!) / base).toBeCloseTo(2, 1);
    expect(radius(host.querySelector('circle.pt.neg')!)).toBe(base);
  });

  it('step 8 strip and note carry the two weights', () => {
    const { el, player } = setup();
    go(player, 'agirlik');
    expect(el.querySelector('.formula')!.textContent).toContain('ayrılan 8,05 = 1400 / (2 · 87)');
    expect(el.querySelector('.formula')!.textContent).toContain('kalan 0,53 = 1400 / (2 · 1313)');
    expect(el.querySelector('.imb-weight-host .note-line')!.textContent).toContain('8,05');
  });
});
