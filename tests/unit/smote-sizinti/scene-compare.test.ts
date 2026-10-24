// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import '../svg-stubs';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { formatNumber as f } from '../../../src/core/plot/format';
import { classify } from '../../../src/concepts/degerlendirme/curves';
import { metrics } from '../../../src/concepts/degerlendirme/metrics';
import { COMPARE, KOD05 } from '../../../src/concepts/dengesiz/data';
import { matchCaught } from '../../../src/concepts/smote-sizinti/model';
import { smoteSizintiScenario as sc } from '../../../src/concepts/smote-sizinti/scenario';
import { mountLeakScene } from '../../../src/concepts/smote-sizinti/scene';

const clean: (() => void)[] = [];
afterEach(() => {
  clean.splice(0).forEach((fn) => fn());
  document.body.replaceChildren();
});

function setup(id: string, w = 1280, h = 540) {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(sc);
  const scene = mountLeakScene(el, player, 'ders', { durationScale: 0 });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  player.goto(stepIndex(sc, id));
  return { el, player };
}

const num = (e: Element, a: string) => Number(e.getAttribute(a));
const texts = (el: HTMLElement, sel: string) => [...el.querySelectorAll(sel)].map((t) => t.textContent);

describe('compare scene (steps 7 and 8)', () => {
  it('step 7 draws three curves on one baseline', () => {
    const { el } = setup('smote-agirlik');
    const paths = [...el.querySelectorAll('path.lc-series')];
    expect(paths.map((p) => /is-(base|smote|weighted)/.exec(p.getAttribute('class')!)![0])).toEqual(['is-base', 'is-smote', 'is-weighted']);
    expect(el.querySelectorAll('line.baseline')).toHaveLength(1);
    expect(texts(el, 'text.lc-pin-label')).toEqual(['ağırlıksız 0,190', 'SMOTE 0,176', 'ağırlıklı 0,173', 'taban 0,062']);
    expect(el.querySelector('.formula')!.textContent).toContain('Sık yanlış anlama');
  });

  it('step 7 curve switches remove the curve with its score label', () => {
    const { el, player } = setup('smote-agirlik');
    player.setParam('show', { base: true, smote: false, weighted: true });
    expect(el.querySelectorAll('path.lc-series')).toHaveLength(2);
    expect(texts(el, 'text.lc-pin-label').join('|')).not.toContain('SMOTE');
  });

  it('step 8 marks the 0.5 point with 27 of 37', () => {
    const { el } = setup('esik');
    const dots = el.querySelectorAll('circle.op-point');
    expect(dots).toHaveLength(1);
    const m = KOD05.matrix;
    const prec = metrics(m).precision!;
    const frame = el.querySelector('.leak-pr-host rect.frame')!;
    const x = num(frame, 'x') + (num(frame, 'width') * m.tp) / (m.tp + m.fn);
    const y = num(frame, 'y') + num(frame, 'height') * (1 - prec);
    expect(num(dots[0], 'cx')).toBeCloseTo(x, 0);
    expect(num(dots[0], 'cy')).toBeCloseTo(y, 0);
    expect(el.querySelector('[data-cell="tp"] .cell-count')!.textContent).toBe('27');
    expect(el.querySelector('[data-cell="fn"] .cell-count')!.textContent).toBe('10');
    expect(texts(el, 'text.panel-line')[0]).toBe(`27 / 37 yakalandı · kesinlik ${f(prec, 3)}`);
    expect(el.querySelector('a.op-link')!.getAttribute('href')).toBe('../roc-esik/');
  });

  it('step 8 names the base threshold with the same recall', () => {
    const { el } = setup('esik');
    const same = matchCaught(COMPARE.base.scores, KOD05.matrix.tp);
    const line = texts(el, 'text.panel-line').join(' ');
    expect(line).toContain(`${f(same.threshold, 3)} eşiğinde`);
    expect(line).toContain(`kesinliği ${f(same.precision, 3)}`);
    // it is the largest threshold that still catches 27: one step higher catches fewer
    expect(classify(COMPARE.base.scores, same.threshold).tp).toBeGreaterThanOrEqual(27);
    expect(classify(COMPARE.base.scores, same.threshold + 1e-6).tp).toBeLessThan(27);
  });

  it('step 8 at the slider ends stays finite and undefined precision is named', () => {
    const { el, player } = setup('esik');
    for (const t of [0.01, 0.99]) {
      player.setParam('threshold', t);
      expect(el.textContent).not.toMatch(/NaN|Infinity|undefined/);
      expect(el.querySelector('.formula')!.textContent).not.toMatch(/NaN|Infinity|undefined/);
    }
    // at 0.99 nothing is caught: no point, no comparison line, precision undefined
    expect(el.querySelectorAll('circle.op-point')).toHaveLength(0);
    expect(texts(el, 'text.panel-line')).toHaveLength(1);
    expect(texts(el, 'text.panel-line')[0]).toContain('— (tanımsız)');
  });
});
