import { describe, expect, it } from 'vitest';
import { drops, inertiaOf, nearest, sqDist } from '../../../src/concepts/kmeans/geometry';
import { kmeansData } from '../../../src/concepts/kmeans/data';

describe('kmeans geometry', () => {
  it('sqDist is the squared euclidean distance', () => {
    expect(sqDist([0, 0], [3, 4])).toBe(25);
  });

  it('nearest picks the smaller index on a tie', () => {
    expect(nearest([0, 0], [[1, 0], [-1, 0], [5, 5]])).toBe(0);
    expect(nearest([0, 0], [[5, 5], [0, 1], [1, 0]])).toBe(1);
  });

  it('inertiaOf sums squared distances to assigned centres', () => {
    expect(inertiaOf([[0, 0], [2, 0]], [0, 1], [[1, 0], [1, 0]])).toBe(2);
  });

  it('drops are the inertia decreases for k=2..10', () => {
    const d = drops(kmeansData.ks);
    expect(d).toHaveLength(9);
    expect(d.slice(0, 4).map((v) => Number(v.toFixed(2)))).toEqual([215.28, 41.69, 14.54, 6.09]);
  });
});
