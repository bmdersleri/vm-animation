import { describe, it, expect } from 'vitest';
import { dodge } from '../../../src/core/plot/dodge';

describe('dodge', () => {
  it('keeps the order, separates close labels and stays inside the range', () => {
    const out = dodge([100, 102, 101, 300], 20, 0, 400);
    expect(out[0]).toBeLessThan(out[2]);
    expect(out[2]).toBeLessThan(out[1]);
    const sorted = [...out].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(20 - 1e-9);
    expect(out[3]).toBe(300);
    // labels crowded at the bottom edge are pushed back up
    const low = dodge([395, 398, 400], 20, 0, 400);
    expect(Math.max(...low)).toBeLessThanOrEqual(400);
    expect(low[1] - low[0]).toBeGreaterThanOrEqual(20 - 1e-9);
    expect(dodge([], 20, 0, 10)).toEqual([]);
  });
});
