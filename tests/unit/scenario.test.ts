import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../src/core/player';
import { demo } from '../../src/concepts/knn/data';
import { kNearest, vote } from '../../src/concepts/knn/knn';
import { featureSpace } from '../../src/concepts/knn/space';
import { computeRegions, type RegionGrid } from '../../src/concepts/knn/regions';
import { knnScenario, knnShortcuts, switchDataset, type KnnParams } from '../../src/concepts/knn/scenario';
import { labTextTests } from './lab-text';

function predict(p: KnnParams): { winner: number; ids: number[] } {
  const s = featureSpace(p.dataset, p.scaled);
  const n = kNearest(s.points, s.labels, s.toSpace(p.query), p.k, p.metric, p.weighting);
  return { winner: vote(n).winner, ids: n.map((x) => x.index).sort((a, b) => a - b) };
}

function at(i: number): KnnParams {
  const pl = new StepPlayer<KnnParams>(knnScenario);
  pl.goto(i);
  return pl.state.params;
}

describe('knnScenario', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('has 12 steps with unique ids and Turkish copy', () => {
    expect(knnScenario.steps).toHaveLength(12);
    expect(new Set(knnScenario.steps.map((s) => s.id)).size).toBe(12);
    expect(knnScenario.steps[0].title).toBe('Eğitim verisi');
    expect(knnScenario.steps[11].title).toBe('Ölçekleme kapalı');
  });

  it('gives the English term in parentheses on first use', () => {
    const text = (id: string) => knnScenario.steps.find((s) => s.id === id)!.text;
    expect(text('k1')).toContain('karar bölgelerini (decision regions)');
    expect(text('oklid')).toContain('Öklid (Euclidean)');
    expect(text('toplam')).toContain('Ölçekleme (feature scaling)');
  });

  it('every English term in a step text is also its Ders term', () => {
    let n = 0;
    for (const s of knnScenario.steps) {
      for (const [, en] of s.text.matchAll(/\(([A-Za-z][A-Za-z ]*)\)/g)) {
        n++;
        expect(s.term, s.id).toContain(en);
      }
    }
    expect(n).toBe(5);
  });

  it('explanation steps hide regions, demo steps show them', () => {
    for (let i = 0; i < 5; i++) expect(at(i).regions).toBe(false);
    for (let i = 5; i < 12; i++) expect(at(i).regions).toBe(true);
  });

  it('default query votes 3-2 at the vote step', () => {
    const p = at(4);
    expect(p.dataset).toBe('aylik');
    const s = featureSpace(p.dataset, p.scaled);
    const v = vote(kNearest(s.points, s.labels, s.toSpace(p.query), p.k, p.metric, p.weighting));
    expect([...v.scores].sort()).toEqual([2, 3]);
  });

  it('k sweep emits 1,3,5,7,9 and ends at 9', () => {
    const pl = new StepPlayer<KnnParams>(knnScenario);
    pl.goto(5);
    pl.goto(6);
    const seen = [pl.state.params.k];
    pl.subscribe((s) => seen.push(s.params.k));
    vi.advanceTimersByTime(700 * 6);
    expect(seen.slice(0, 5)).toEqual([1, 3, 5, 7, 9]);
    expect(pl.state.params.k).toBe(9);
    pl.destroy();
  });

  it('k swallow: Ayrıldı(1) at k=1..9, Kaldı(0) at k=15', () => {
    const base = at(5);
    for (const k of [1, 3, 5, 7, 9]) expect(predict({ ...base, k }).winner).toBe(1);
    expect(predict(at(7)).winner).toBe(0);
    expect(at(7).k).toBe(15);
  });

  it('Ayrıldı region shrinks from k=1 to k=15', () => {
    const p = at(5);
    const s = featureSpace(p.dataset, p.scaled);
    const g: RegionGrid = { cols: 80, rows: 50, x0: s.domain.x[0], x1: s.domain.x[1], y0: s.domain.y[0], y1: s.domain.y[1] };
    const count = (k: number) => computeRegions(s, k, p.metric, p.weighting, g).reduce((a, c) => a + c, 0);
    expect(count(15)).toBeLessThan(count(1) * 0.5);
  });

  it('metric step changes neighbour set by 3', () => {
    const o = predict(at(8));
    const m = predict(at(9));
    expect(at(8).metric).toBe('oklid');
    expect(at(9).metric).toBe('manhattan');
    expect(at(9).k).toBe(5);
    expect(o.ids.filter((i) => !m.ids.includes(i))).toHaveLength(3);
  });

  it('scale steps: scaled and unscaled share 0 members on toplam', () => {
    const a = predict(at(10));
    const b = predict(at(11));
    expect(at(10).dataset).toBe('toplam');
    expect(at(10).scaled).toBe(true);
    expect(at(11).scaled).toBe(false);
    expect(at(11).query).toEqual(demo.scaleSplit);
    expect(a.ids.filter((i) => b.ids.includes(i))).toHaveLength(0);
  });

  it('demo steps pin dataset, scaling and weighting over earlier manual changes', () => {
    const pl = new StepPlayer<KnnParams>(knnScenario);
    pl.goto(6);
    switchDataset(pl, 'toplam');
    pl.setParams({ scaled: false, weighting: 'agirlikli' });
    pl.goto(8);
    expect(pl.state.params).toMatchObject({
      dataset: 'aylik', scaled: true, weighting: 'esit', k: 5, metric: 'oklid', query: demo.metricSplit,
    });
    pl.setParam('weighting', 'agirlikli');
    pl.goto(5);
    expect(pl.state.params.weighting).toBe('esit');
    pl.setParam('weighting', 'agirlikli');
    pl.goto(10);
    expect(pl.state.params).toMatchObject({ dataset: 'toplam', scaled: true, weighting: 'esit', k: 5 });
    pl.destroy();
  });
});

describe('knnShortcuts', () => {
  const make = () => {
    const pl = new StepPlayer<KnnParams>(knnScenario);
    pl.goto(9);
    const sc = knnShortcuts(pl);
    const run = (label: string) => sc.find((s) => s.label === label)!.run();
    return { pl, sc, run };
  };

  it('exposes Turkish labels and keys', () => {
    const { sc } = make();
    expect(sc.map((s) => s.label)).toEqual([
      "k'yi artır", "k'yi azalt", 'Öklid / Manhattan', 'Ölçekleme aç / kapat',
      'Veri setini değiştir', 'Karar bölgelerini göster / gizle',
    ]);
    expect(sc[0].keys).toEqual(['+', '=']);
    expect(sc[1].keys).toEqual(['-']);
    expect(sc[2].keys).toEqual(['m', 'M']);
    // help shows one label per shortcut, no case variants
    expect(sc.map((s) => s.display)).toEqual(['+', '-', 'M', 'S', 'D', 'B']);
  });

  it('k up/down clamp to [1, 15] and stay odd steps of 2', () => {
    const { pl, run } = make();
    run("k'yi artır");
    expect(pl.state.params.k).toBe(7);
    for (let i = 0; i < 20; i++) run("k'yi artır");
    expect(pl.state.params.k).toBe(15);
    expect(pl.state.params.k % 2).toBe(1);
    for (let i = 0; i < 20; i++) run("k'yi azalt");
    expect(pl.state.params.k).toBe(1);
    expect(pl.state.params.k % 2).toBe(1);
  });

  it('toggles metric, scaling, regions and dataset', () => {
    const { pl, run } = make();
    run('Öklid / Manhattan');
    expect(pl.state.params.metric).toBe('oklid');
    run('Ölçekleme aç / kapat');
    expect(pl.state.params.scaled).toBe(false);
    run('Karar bölgelerini göster / gizle');
    expect(pl.state.params.regions).toBe(false);
    run('Veri setini değiştir');
    expect(pl.state.params.dataset).toBe('toplam');
    expect(pl.state.params.query).toEqual(demo.defaultQuery.toplam);
  });
});

describe('switchDataset', () => {
  it('resets query to the dataset default with a single emission', () => {
    const pl = new StepPlayer<KnnParams>(knnScenario);
    pl.goto(4);
    const fn = vi.fn();
    pl.subscribe(fn);
    switchDataset(pl, 'toplam');
    expect(pl.state.params.dataset).toBe('toplam');
    expect(pl.state.params.query).toEqual(demo.defaultQuery.toplam);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('knnScenario Lab text', () => {
  labTextTests(knnScenario.steps, [6, 8, 9, 10, 11, 12]);
});
