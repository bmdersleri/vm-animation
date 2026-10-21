import { describe, expect, it } from 'vitest';
import { circlesPath, countSubpaths, diamondPath, segmentsPath, trianglesPath } from '../../../src/core/plot/dots-path';

describe('dots-path', () => {
  it('circlesPath: one sub-path per point', () => {
    const d = circlesPath([0, 10], [0, 0], 2);
    expect(d).toBe('M-2,0a2,2 0 1,0 4,0a2,2 0 1,0 -4,0M8,0a2,2 0 1,0 4,0a2,2 0 1,0 -4,0');
    expect(countSubpaths(d)).toBe(2);
  });
  it('trianglesPath: closed sub-path per point', () => {
    const d = trianglesPath([0, 5, 9], [0, 5, 9], 3);
    expect(countSubpaths(d)).toBe(3);
    expect(d.match(/Z/g)).toHaveLength(3);
    expect(d.split('M').slice(1).every((s) => s.endsWith('Z'))).toBe(true);
  });
  it('segmentsPath', () => expect(segmentsPath([0, 2], [0, 2], [1, 3], [1, 3])).toBe('M0,0L1,1M2,2L3,3'));
  it('diamondPath: closed with four corners', () => {
    const d = diamondPath(0, 0, 10);
    expect(d.endsWith('Z')).toBe(true);
    expect(d.match(/[ML]/g)).toHaveLength(4);
  });
  it('empty input gives an empty path', () => {
    expect(circlesPath([], [], 2)).toBe('');
    expect(trianglesPath([], [], 2)).toBe('');
    expect(segmentsPath([], [], [], [])).toBe('');
    expect(countSubpaths('')).toBe(0);
  });
});
