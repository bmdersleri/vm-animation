import { describe, expect, it } from 'vitest';
import fixture from '../../fixtures/dengesiz_sklearn.json';
import { CUSTOMERS } from '../../../src/concepts/dengesiz/data';
import {
  fromScaled, randomOversample, smote, syntheticCount, toScaled, type Pt,
} from '../../../src/concepts/dengesiz/smote';

const trainMinority = (): Pt[] => CUSTOMERS
  .filter(c => c.split === 'train' && c.churn === 1)
  .map(toScaled);

describe('smote', () => {
  it('smote matches the python twin for seeds 42 and 7 and k 1 and 5', () => {
    const points = fixture.smote.points.map(([x, y]) => ({ x, y }));
    expect(fixture.smote.runs).toHaveLength(4);
    for (const run of fixture.smote.runs) {
      const out = smote(points, run.k, run.new.length, run.seed);
      expect(out).toHaveLength(run.new.length);
      run.new.forEach((want, t) => {
        expect(out[t].i).toBe(want.i);
        expect(out[t].j).toBe(want.j);
        expect(Math.abs(out[t].lambda - want.lambda)).toBeLessThan(1e-12);
        expect(Math.abs(out[t].x - want.x)).toBeLessThan(1e-12);
        expect(Math.abs(out[t].y - want.y)).toBeLessThan(1e-12);
      });
    }
  });

  it('the standardised training churners of the data are the fixture points', () => {
    const mine = trainMinority();
    expect(mine).toHaveLength(fixture.smote.points.length);
    mine.forEach((p, t) => {
      expect(Math.abs(p.x - fixture.smote.points[t][0])).toBeLessThan(1e-12);
      expect(Math.abs(p.y - fixture.smote.points[t][1])).toBeLessThan(1e-12);
    });
  });

  it('same seed gives the same synthetic points', () => {
    const points = trainMinority();
    expect(smote(points, 5, 30, 42)).toEqual(smote(points, 5, 30, 42));
    expect(smote(points, 5, 30, 42)).not.toEqual(smote(points, 5, 30, 7));
  });

  it('every synthetic point lies on its parent segment', () => {
    const points = trainMinority();
    for (const s of smote(points, 5, 200, 42)) {
      const a = points[s.i];
      const b = points[s.j];
      expect(s.i).not.toBe(s.j);
      expect(s.lambda).toBeGreaterThanOrEqual(0);
      expect(s.lambda).toBeLessThan(1);
      expect(s.x).toBeCloseTo(a.x + s.lambda * (b.x - a.x), 12);
      expect(s.y).toBeCloseTo(a.y + s.lambda * (b.y - a.y), 12);
    }
  });

  it('ratio below the current balance makes no synthetic point', () => {
    expect(syntheticCount(1313, 87, 1)).toBe(1226);
    expect(syntheticCount(1313, 87, 0.5)).toBe(570);
    expect(syntheticCount(1313, 87, 0.05)).toBe(0);
    expect(syntheticCount(1313, 87, 0.01)).toBe(0);
    expect(smote(trainMinority(), 5, 0, 42)).toEqual([]);
  });

  it('k above n minus one uses n minus one', () => {
    const three: Pt[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 5, y: 5 }];
    const out = smote(three, 10, 50, 3);
    expect(out).toHaveLength(50);
    expect(out).toEqual(smote(three, 2, 50, 3));
  });

  it('random oversample counts add up to nNew', () => {
    const copies = randomOversample(87, 1226, 42);
    expect(copies).toHaveLength(87);
    expect(copies.reduce((a, b) => a + b, 0)).toBe(1226);
    expect(copies.every(c => c >= 0)).toBe(true);
    expect(randomOversample(87, 1226, 42)).toEqual(copies);
  });

  it('fromScaled inverts toScaled', () => {
    const c = CUSTOMERS[0];
    const back = fromScaled(toScaled(c));
    expect(back.tenure).toBeCloseTo(c.tenure, 9);
    expect(back.charge).toBeCloseTo(c.charge, 9);
  });
});
