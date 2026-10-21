import { describe, it, expect } from 'vitest';
import { PAIR, SCREE, TSNE, PERPLEXITIES } from '../../../src/concepts/pca/data';
import fixture from '../../fixtures/boyut_sklearn.json';

describe('pca data', () => {
  it('has 500 finite pair points', () => {
    expect(PAIR).toHaveLength(500);
    expect(PAIR.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
  });

  it('has the scree data', () => {
    expect(SCREE.evr).toHaveLength(12);
    expect(SCREE.evr.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(SCREE.cum).toHaveLength(12);
    expect(SCREE.kByThreshold).toHaveLength(50);
    expect(SCREE.kByThreshold[0]).toBe(2);
    expect(SCREE.kByThreshold[40]).toBe(3);
    expect(SCREE.kByThreshold[49]).toBe(9);
  });

  it('has the t-SNE data', () => {
    expect(TSNE.labels).toHaveLength(300);
    expect(TSNE.labels.filter((l) => l === 1)).toHaveLength(150);
    expect(TSNE.pca).toHaveLength(300);
    expect(PERPLEXITIES).toEqual([5, 30, 50]);
    for (const p of PERPLEXITIES) {
      expect(TSNE.embed[p]).toHaveLength(300);
      expect(TSNE.embedNew[p]).toHaveLength(301);
    }
  });

  it('has the sklearn fixture', () => {
    expect(fixture.versions.sklearn.length).toBeGreaterThan(0);
    expect(fixture.pca.ex002.after).toBe(53);
  });
});
