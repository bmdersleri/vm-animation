import { describe, it, expect } from 'vitest';
import {
  BOOK_BOOT, BOOTS, CUSTOMERS, EXPERIMENT, NODE_DEMO, OOB_CURVE, OOB_CV, PICKS, RF,
} from '../../../src/concepts/topluluk/data';
import { meanStd } from '../../../src/concepts/topluluk/math';
import { votes } from '../../../src/concepts/topluluk/vote';

const r3 = (x: number): number => Math.round(x * 1000) / 1000;

describe('topluluk data', () => {
  it('book numbers come from the data', () => {
    expect(BOOK_BOOT.sample).toEqual([0, 7, 6, 4, 4, 8, 0, 6, 2, 0]);
    expect(BOOK_BOOT.oob).toEqual([1, 3, 5, 9]);
    expect(BOOK_BOOT.counts).toEqual([3, 0, 1, 0, 2, 0, 2, 1, 1, 0]);
    const t = meanStd(EXPERIMENT.tree);
    const b = meanStd(EXPERIMENT.bagging);
    expect([r3(t.mean), r3(t.std)]).toEqual([0.749, 0.033]);
    expect([r3(b.mean), r3(b.std)]).toEqual([0.835, 0.028]);
    expect(r3(OOB_CV.oob)).toBe(0.899);
    expect(r3(meanStd(OOB_CV.cv).mean)).toBe(0.896);
    expect(OOB_CV.seconds).toEqual({ oob: 0.27, cv: 1.23 });
    expect(OOB_CURVE[0]).toEqual({ n: 10, oob: 0.798 });
    expect(OOB_CURVE).toHaveLength(50);
    const order = RF.names
      .map((name, i) => ({ name, v: RF.mdi[i] }))
      .sort((p, q) => q.v - p.v);
    expect(order.map((o) => o.name)).toEqual([
      'hizmetSayisi', 'faturaOdemeGecikmesi', 'internetHizi', 'destekCagriSayisi',
      'musteriSuresi_ay', 'toplamUcret', 'aylikUcret', 'sozlesmeTipi',
    ]);
    expect(order.map((o) => r3(o.v))).toEqual([0.176, 0.174, 0.15, 0.142, 0.135, 0.121, 0.055, 0.048]);
  });

  it('bagging roots crowd into two features at max_features 8', () => {
    const bagging = RF.byMf[7];
    expect(bagging.mf).toBe(8);
    expect(bagging.roots.reduce((s, v) => s + v, 0)).toBe(250);
    const top = [...bagging.roots].sort((p, q) => q - p);
    expect(top[0] + top[1]).toBeGreaterThanOrEqual(240);
    expect(RF.names[bagging.roots.indexOf(top[0])]).toBe('faturaOdemeGecikmesi');
    expect(RF.byMf[1].roots.filter((v) => v > 0).length).toBeGreaterThan(5);
  });

  it('the correlation falls as max_features falls', () => {
    expect(RF.byMf).toHaveLength(8);
    expect(RF.byMf[0].rho).toBeLessThan(RF.byMf[7].rho);
  });

  it('the id column fools MDI but not permutation importance', () => {
    const last = RF.withId.names.length - 1;
    expect(RF.withId.names[last]).toBe('musteriNo');
    expect(RF.withId.mdi[last]).toBeGreaterThan(0.03);
    expect(RF.withId.perm[last]).toBeLessThan(0.01);
  });

  it('picks and node demo are consistent', () => {
    expect(BOOTS).toHaveLength(50);
    const pick = CUSTOMERS[PICKS.vote];
    expect(pick.y).toBe(1);
    expect(votes([pick.t, pick.c], 50)).toBeGreaterThan(25);
    expect(PICKS.oob).toBeGreaterThanOrEqual(0);
    expect(NODE_DEMO.drawn).toContain(NODE_DEMO.winner);
  });
});
