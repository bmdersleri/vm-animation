// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import '../svg-stubs';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { formatNumber as f } from '../../../src/core/plot/format';
import { CV } from '../../../src/concepts/dengesiz/data';
import { smoteSizintiScenario as sc } from '../../../src/concepts/smote-sizinti/scenario';
import { mountLeakScene } from '../../../src/concepts/smote-sizinti/scene';

const clean: (() => void)[] = [];
afterEach(() => {
  clean.splice(0).forEach((fn) => fn());
  document.body.replaceChildren();
});

function setup(mode: 'ders' | 'lab' = 'ders') {
  const el = document.createElement('div');
  document.body.append(el);
  const player = new StepPlayer(sc);
  const scene = mountLeakScene(el, player, mode, { durationScale: 0 });
  scene.resize(1280, 540);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  player.goto(stepIndex(sc, 'pipeline'));
  return { el, player };
}

const scores = (el: HTMLElement) => [...el.querySelectorAll('.fold-score.is-shown')].map((t) => t.textContent);

describe('fold scene', () => {
  it('step 6 sweep fills five fold scores and the mean', () => {
    const { el, player } = setup();
    expect(el.querySelector('.leak-stage')!.getAttribute('data-view')).toBe('folds');
    expect(el.querySelectorAll('.fold-row')).toHaveLength(5);
    const want = CV.folds.map((x) => f(x.ap, 3));
    for (let k = 1; k <= 5; k++) {
      player.setParam('fold', k);
      expect(scores(el)).toEqual(want.slice(0, k));
      expect(el.querySelector('.fold-row.is-selected')!.getAttribute('data-fold')).toBe(String(k));
      expect(el.querySelector('.fold-mean')!.textContent).toBe(k === 5 ? `ortalama PR-AUC ${f(CV.mean, 3)}` : '');
    }
    expect(el.querySelector('.fold-book')!.textContent).toContain('Pipeline(steps=[("olcekleme"');
    expect(el.querySelector('.formula')!.textContent).toContain('kitap 0,177');
  });

  it('validation parts carry no synthetic rows', () => {
    const { el } = setup();
    const rows = [...el.querySelectorAll('.fold-row')];
    rows.forEach((row, i) => {
      const fold = CV.folds[i];
      const val = row.querySelector('.fold-val')!;
      expect(val.textContent).toContain('dokunulmaz');
      expect(val.textContent).toContain(`${fold.valNeg} / ${fold.valPos}`);
      expect(val.textContent).not.toContain('SMOTE');
      const train = row.querySelector('.fold-train')!.textContent!;
      expect(train).toContain(`kalan ${fold.trainNeg} / ayrılan ${fold.trainPos}`);
      expect(train).toContain(`SMOTE sonrası ${fold.smoteNeg} / ${fold.smotePos}`);
      // the training width follows the original training count, not the SMOTE-grown one
      expect((row.querySelector('.fold-train') as HTMLElement).style.flex).toContain(String(fold.trainNeg + fold.trainPos));
    });
  });

  it('the Lab keeps every score and highlights the chosen fold', () => {
    const { el, player } = setup('lab');
    player.setParam('fold', 2);
    expect(scores(el)).toHaveLength(5);
    expect(el.querySelectorAll('.fold-row.is-selected')).toHaveLength(1);
    expect(el.querySelector('.fold-row.is-selected')!.getAttribute('data-fold')).toBe('2');
    player.setParam('fold', 0);
    expect(el.querySelectorAll('.fold-row.is-selected')).toHaveLength(0);
  });

  it('the CSS gives the training part one display only', async () => {
    const { readFileSync } = (await import('node:fs' as string)) as { readFileSync: (p: string, e: string) => string };
    const css = readFileSync('src/concepts/smote-sizinti/smote-sizinti.css', 'utf8');
    // every rule whose selector list names .fold-train itself (not a descendant) and sets display
    const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(
      ([, sel, body]) => sel.split(',').some((x) => /\.fold-train\s*$/.test(x.trim().replace(/^.*\s/, ''))) && /display:/.test(body),
    );
    expect(rules.map(([, , body]) => /display:([a-z-]+)/.exec(body)![1])).toEqual(['block']);
  });
});
