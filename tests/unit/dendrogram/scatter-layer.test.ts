import { describe, expect, it } from 'vitest';
import { convexHull } from '../../../src/concepts/dendrogram/scatter-layer';

describe('convexHull', () => {
  it('drops interior points of a square', () => {
    const h = convexHull([[0, 0], [2, 0], [2, 2], [0, 2], [1, 1]]);
    expect(h).toHaveLength(4);
    expect(h).not.toContainEqual([1, 1]);
  });

  it('keeps one or two points as they are', () => {
    expect(convexHull([[3, 4]])).toEqual([[3, 4]]);
    expect(convexHull([[2, 2], [0, 0]])).toEqual([[0, 0], [2, 2]]);
  });

  it('collinear points reduce to the two ends', () => {
    const h = convexHull([[0, 0], [1, 1], [2, 2], [3, 3]]);
    expect(h).toHaveLength(2);
    expect(h).toContainEqual([0, 0]);
    expect(h).toContainEqual([3, 3]);
  });
});
