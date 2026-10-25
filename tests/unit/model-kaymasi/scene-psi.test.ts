// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import '../svg-stubs';
import { formatNumber as f } from '../../../src/core/plot/format';
import { META, REFERENCE, SPREAD_MONTH, monthOf } from '../../../src/concepts/model-kaymasi/data';
import { modelKaymasiScenario as sc } from '../../../src/concepts/model-kaymasi/scenario';
import { PsiScene, binLabels } from '../../../src/concepts/model-kaymasi/scene-psi';
import { deriveKaymaView, psiFromCounts } from '../../../src/concepts/model-kaymasi/view';
import { stepIndex } from '../../../src/core/player';
import { go, num, setup, texts } from './harness';

const parse = (s: string): number => Number(s.replace('−', '-').replace(',', '.').replace('*', ''));

describe('PSI bars (step 8)', () => {
  it('step 8 terms add up to the stored psi', () => {
    const { el, player } = setup();
    go(player, 'psi');
    const m = monthOf('yayilim', SPREAD_MONTH);
    expect(el.querySelectorAll('.psi-bar')).toHaveLength(2 * REFERENCE.psiCounts.length);
    const terms = texts(el, '.psi-term').map(parse);
    expect(terms).toHaveLength(REFERENCE.psiCounts.length);
    const total = terms.reduce((a, t) => a + t, 0);
    // every term is written with three decimals, so the sum of the written terms is within half a unit of each
    expect(Math.abs(total - m.psi)).toBeLessThan(0.0055);
    expect(el.querySelector('.psi-total')!.textContent).toContain(f(m.psi, 3));
    expect(el.querySelector('.formula')!.textContent).toContain(f(m.psi, 3));
    // the bin names come from the reference deciles
    const names = texts(el, '.psi-bar[data-kind="p"] .bar-name');
    expect(names).toEqual(binLabels());
    expect(names[0]).toBe(`< ${f(REFERENCE.psiCuts[0], 2)}`);
    expect(names[9]).toBe(`≥ ${f(REFERENCE.psiCuts[8], 2)}`);
    expect(el.querySelector('.psi-scene .scene-note')!.textContent).toContain('kitap sınır vermez');
  });

  it('step 8 sweep fills the bars one bin at a time', () => {
    const { el, player } = setup();
    go(player, 'psi', false);
    player.setParams({ scan: 3 });
    expect(el.querySelectorAll('.psi-term')).toHaveLength(3);
    expect(el.querySelectorAll('.psi-bar[data-kind="q"]')).toHaveLength(3);
    // the reference shares are known from the start
    expect(el.querySelectorAll('.psi-bar[data-kind="p"]')).toHaveLength(REFERENCE.psiCounts.length);
  });

  it('an empty bin reads q = 0 with a footnote', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const scene = new PsiScene(host);
    scene.resize(1280, 540, 'ders', false);
    const base = deriveKaymaView(stepIndex(sc, 'psi'), sc.defaults, true);
    // a synthetic month: the ten bins hold 250 values, the fourth bin none
    const counts = [20, 30, 30, 0, 40, 25, 30, 25, 25, 25];
    expect(counts.reduce((a, b) => a + b, 0)).toBe(META.perMonth);
    const psi = psiFromCounts('yayilim', 18, counts);
    expect(psi.bars[3].empty).toBe(true);
    expect(psi.footnote).toContain('q = 0');
    scene.update({ ...base, psi }, 0);
    const term = host.querySelector('.psi-term[data-bin="4"]')!;
    expect(term.textContent).toBe(`${f(psi.bars[3].term, 3)}*`);
    expect(host.querySelector('.psi-bar[data-bin="4"][data-kind="q"] .bar-value')!.textContent).toBe('q = 0');
    expect(host.querySelector('.psi-bar[data-bin="3"][data-kind="q"] .bar-value')!.textContent).not.toContain('q = 0');
    expect(host.querySelector('.psi-footnote')!.textContent).toContain('*');
    expect(host.querySelector('.psi-footnote')!.textContent).toContain('q = 0 olan bölmede');
    // the other terms carry no mark and there is one footnote only
    expect(host.querySelectorAll('.psi-term')).toHaveLength(10);
    expect(texts(host, '.psi-term').filter((t) => t.includes('*'))).toHaveLength(1);
    // the total still adds up
    const sum = texts(host, '.psi-term').map(parse).reduce((a, t) => a + t, 0);
    expect(Math.abs(sum - psi.total)).toBeLessThan(0.0055);
    expect(num(host.querySelector('svg')!, 'width')).toBeLessThanOrEqual(1280);
    scene.destroy();
  });
});
