import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { nbScenario, nbShortcuts, type NbParams } from '../../../src/concepts/naive-bayes/scenario';
import { gauss } from '../../../src/concepts/naive-bayes/data';
import { naturalCounts } from '../../../src/concepts/naive-bayes/bayes';
import { PRIOR_SPAM, trail } from '../../../src/concepts/naive-bayes/spam';
import { deriveNbView, pct } from '../../../src/concepts/naive-bayes/view';
import { formatNumber } from '../../../src/core/plot/format';
import fixture from '../../fixtures/naive-bayes_sklearn.json';

function make(): StepPlayer<NbParams> {
  return new StepPlayer<NbParams>(nbScenario);
}

/** Spam posterior at the end of a word list, from the fixture's alpha0 cases. */
function fixtureSpam(words: string[]): number {
  const hit = fixture.alpha0.find((c) => c.words.join(',') === words.join(','));
  if (!hit) throw new Error(`no alpha0 fixture for ${words.join(',')}`);
  return hit.proba[1];
}

function lastSpam(p: NbParams): number | null {
  const t = trail(p.words, p.alpha);
  return t[t.length - 1];
}

describe('nbScenario', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('has 13 steps with unique ids', () => {
    expect(nbScenario.steps).toHaveLength(13);
    expect(new Set(nbScenario.steps.map((s) => s.id)).size).toBe(13);
  });

  it('every English term in a step text is also its Ders term', () => {
    let n = 0;
    for (const s of nbScenario.steps) {
      for (const [, en] of s.text.matchAll(/\(([A-Za-z][A-Za-z ]*)\)/g)) {
        n++;
        expect(s.term, s.id).toContain(en);
      }
    }
    expect(n).toBeGreaterThanOrEqual(7);
  });

  it('defaults', () => {
    expect(nbScenario.defaults).toEqual({
      prior: 0.01, sens: 0.9, fpr: 0.1, reveal: 0, words: [], alpha: 0,
      query: gauss.firstTest, regions: false,
    });
  });

  it('part 1 reveals prior, test, then positives only', () => {
    const pl = make();
    pl.goto(0);
    expect(pl.state.params).toMatchObject({ prior: 0.01, reveal: 0 });
    pl.goto(1);
    expect(pl.state.params.reveal).toBe(1);
    pl.goto(2);
    expect(pl.state.params.reveal).toBe(2);
    const c = naturalCounts(pl.state.params.prior, pl.state.params.sens, pl.state.params.fpr);
    expect([c.tp, c.fp]).toEqual([9, 99]);
    pl.destroy();
  });

  it('step 3 posterior is 50%', () => {
    const pl = make();
    pl.goto(3);
    const p = pl.state.params;
    expect(p).toMatchObject({ prior: 0.1, reveal: 2 });
    const c = naturalCounts(p.prior, p.sens, p.fpr);
    expect(c.posterior).toBeCloseTo(0.5, 10);
    expect(nbScenario.steps[3].text).toContain('%50');
    pl.destroy();
  });

  it('word steps follow the story', () => {
    const pl = make();
    pl.goto(4);
    expect(pl.state.params.words).toEqual([]);
    expect(pl.state.params.alpha).toBe(0);
    expect(trail([], 0)).toEqual([0.4]);

    pl.goto(5);
    let p = pl.state.params;
    expect(p.words).toEqual(['bedava']);
    const s5 = lastSpam(p)!;
    expect(s5).toBeCloseTo(fixtureSpam(['bedava']), 10);
    expect(s5).toBeGreaterThan(0.85);

    pl.goto(6);
    p = pl.state.params;
    expect(p.words).toEqual(['bedava', 'kazandınız']);
    const s6 = lastSpam(p)!;
    expect(s6).toBeCloseTo(fixtureSpam(p.words), 10);
    expect(s6).toBeGreaterThan(0.95);

    pl.goto(7);
    p = pl.state.params;
    expect(p.words).toEqual(['bedava', 'kazandınız', 'toplantı']);
    const s7 = lastSpam(p)!;
    expect(s7).toBeCloseTo(fixtureSpam(p.words), 10);
    expect(s7).toBeLessThan(s6);
    expect(s7).toBeGreaterThan(0.5);
    pl.destroy();
  });

  it('order sweep ends with all three words', () => {
    const pl = make();
    pl.goto(8);
    expect(pl.state.params.words).toEqual(['toplantı']);
    const seen = [pl.state.params.words];
    pl.subscribe((s) => seen.push(s.params.words));
    vi.advanceTimersByTime(900 * 4);
    expect(seen).toContainEqual(['toplantı', 'kazandınız']);
    expect(seen).toContainEqual(['toplantı', 'kazandınız', 'bedava']);
    expect(pl.state.params.words).toEqual(['toplantı', 'kazandınız', 'bedava']);
    // Same set of words, same final posterior as step 7, in any order.
    expect(lastSpam(pl.state.params)).toBeCloseTo(fixtureSpam(['bedava', 'kazandınız', 'toplantı']), 10);
    pl.destroy();
  });

  it('laplace sweep ends at alpha 1', () => {
    const pl = make();
    pl.goto(9);
    const p0 = pl.state.params;
    expect(p0.words).toEqual(['bedava', 'kazandınız', 'toplantı', 'rapor']);
    expect(p0.alpha).toBe(0);
    expect(lastSpam(p0)).toBe(fixtureSpam(p0.words));
    expect(fixtureSpam(p0.words)).toBe(0);
    const seen = [p0.alpha];
    pl.subscribe((s) => seen.push(s.params.alpha));
    vi.advanceTimersByTime(1500 * 3);
    expect(seen).toContain(1);
    expect(pl.state.params.alpha).toBe(1);
    const s = lastSpam(pl.state.params)!;
    expect(s).toBeCloseTo(fixture.multinomial[3].proba[1], 10);
    expect(s).toBeGreaterThan(0.5);
    pl.destroy();
  });

  it('the numbers in the step texts are the computed ones', () => {
    const pl = make();
    const at = (i: number): { text: string; p: NbParams } => {
      pl.goto(i);
      return { text: nbScenario.steps[i].text, p: pl.state.params };
    };
    const whole = (x: number): string => `%${formatNumber(x * 100, 0)}`;
    const spamAt = (words: string[], alpha: 0 | 1): number => trail(words, alpha).at(-1)!;

    // 1.000 people
    let s = at(0);
    let n = naturalCounts(s.p.prior, s.p.sens, s.p.fpr);
    expect(s.text).toContain(`${n.sick}’u hasta`);
    s = at(1);
    n = naturalCounts(s.p.prior, s.p.sens, s.p.fpr);
    expect(s.text).toContain(`hastaların ${n.tp}’unu ve sağlıklıların ${n.fp}’unu`);
    expect(s.text).toContain(whole(s.p.sens));
    s = at(2);
    n = naturalCounts(s.p.prior, s.p.sens, s.p.fpr);
    expect([n.tp, n.fp, n.tp + n.fp]).toEqual([9, 99, 108]);
    expect(s.text).toContain(`${n.tp + n.fp} pozitif kalır: ${n.tp} hasta, ${n.fp} sağlıklı`);
    expect(s.text).toContain(`${n.tp}/${n.tp + n.fp} ≈ ${pct(n.posterior!)}`);
    s = at(3);
    n = naturalCounts(s.p.prior, s.p.sens, s.p.fpr);
    expect(s.text).toContain(`${n.sick} hasta ve ${n.healthy} sağlıklı`);
    expect(s.text).toContain(`${n.tp} hasta ile ${n.fp} sağlıklı`);
    expect(s.text).toContain(`${n.tp}/${n.tp + n.fp} = ${whole(n.posterior!)}`);

    // the spam story
    expect(at(4).text).toContain(whole(PRIOR_SPAM));
    s = at(5);
    expect(s.text).toContain(`${whole(PRIOR_SPAM)}’tan ${pct(spamAt(s.p.words, 0))}’a`);
    expect(pct(spamAt(s.p.words, 0))).toBe('%90,9');
    s = at(6);
    expect(s.text).toContain(`(${pct(spamAt(['bedava'], 0))})`);
    expect(s.text).toContain(`${pct(spamAt(s.p.words, 0))}’e`);
    expect(pct(spamAt(s.p.words, 0))).toBe('%99,5');
    s = at(7);
    expect(s.text).toContain(`${pct(spamAt(s.p.words, 0))}’e`);
    expect(pct(spamAt(s.p.words, 0))).toBe('%96,4');
    s = at(9);
    expect(s.text).toContain(`${whole(spamAt(s.p.words, 0))}’a düşer`);
    expect(s.text).toContain(`${pct(spamAt(s.p.words, 1))}’ya`);
    expect(pct(spamAt(s.p.words, 1))).toBe('%81,6');

    // GaussianNB
    expect(at(10).text).toContain(`${gauss.train.length} eğitim noktası`);
    expect(gauss.train.length).toBe(154);
    s = at(11);
    expect(s.text).toContain(`${s.p.query.t} ay sözleşme, ${s.p.query.c} şikâyet`);
    const post = deriveNbView(11, s.p).bar!.spam!;
    expect(s.text).toContain(`Kaldı ${formatNumber(1 - post, 3)}, Ayrıldı ${formatNumber(post, 3)}`);
    pl.destroy();
  });

  it('part 3 steps: curves, new customer, regions', () => {
    const pl = make();
    pl.goto(10);
    expect(pl.state.params.regions).toBe(false);
    pl.goto(11);
    expect(pl.state.params.query).toEqual({ t: 18, c: 1 });
    expect(pl.state.params.regions).toBe(false);
    pl.goto(12);
    expect(pl.state.params.regions).toBe(true);
    pl.destroy();
  });
});

describe('nbShortcuts', () => {
  const setup = () => {
    const pl = make();
    const sc = nbShortcuts(pl);
    const run = (label: string) => sc.find((s) => s.label === label)!.run();
    return { pl, sc, run };
  };

  it('exposes keys for the help overlay', () => {
    const { sc } = setup();
    expect(sc.map((s) => s.display)).toEqual(['L', 'B', '+', '-']);
    expect(sc[0].keys).toEqual(['l', 'L']);
  });

  it('L toggles alpha and B toggles regions', () => {
    const { pl, run } = setup();
    run('Laplace α: 0 / 1');
    expect(pl.state.params.alpha).toBe(1);
    run('Laplace α: 0 / 1');
    expect(pl.state.params.alpha).toBe(0);
    run('Karar bölgelerini göster / gizle');
    expect(pl.state.params.regions).toBe(true);
    run('Karar bölgelerini göster / gizle');
    expect(pl.state.params.regions).toBe(false);
    pl.destroy();
  });

  it('shortcuts clamp prior to [0.001, 0.5]', () => {
    const { pl, run } = setup();
    run('Öncülü artır');
    expect(pl.state.params.prior).toBe(0.011);
    pl.setParam('prior', 0.5);
    run('Öncülü artır');
    expect(pl.state.params.prior).toBe(0.5);
    run('Öncülü azalt');
    expect(pl.state.params.prior).toBe(0.499);
    pl.setParam('prior', 0.001);
    run('Öncülü azalt');
    expect(pl.state.params.prior).toBe(0.001);
    // No float drift over many presses.
    for (let i = 0; i < 7; i++) run('Öncülü artır');
    expect(pl.state.params.prior).toBe(0.008);
    pl.destroy();
  });
});
