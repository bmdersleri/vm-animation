import { describe, expect, it } from 'vitest';
import { chooseOffset, labelArea, offsets, overlap, type Box } from '../../../src/core/plot/label-place';

const area = labelArea({ left: 0, top: 0, width: 400, height: 300 });
const args = (taken: Box[], x = 200, y = 150) => ({ x, y, chars: 6, cands: offsets(8, 4, 12), fs: 12, taken, area });

describe('chooseOffset', () => {
  it('takes the first candidate when nothing is in the way, and records its box', () => {
    const taken: Box[] = [];
    const o = chooseOffset(args(taken));
    expect(o).toEqual(offsets(8, 4, 12)[0]);
    expect(taken).toHaveLength(1);
  });

  it('skips a candidate that collides and takes the next collision-free one', () => {
    const first = chooseOffset(args([]));
    const blocker: Box = { l: 200 + first.dx, t: 150 + first.dy - 12, r: 200 + first.dx + 30, b: 150 + first.dy + 4 };
    const o = chooseOffset(args([blocker]));
    expect(o).not.toEqual(first);
    expect(o).toEqual(offsets(8, 4, 12)[1]);
  });

  it('keeps labels inside the area, and falls back to the least overlap when every offset collides', () => {
    const near = chooseOffset(args([], 2, 150));
    expect(near.anchor).toBe('start');
    const everything: Box = { l: 0, t: 0, r: 400, b: 300 };
    const cands = offsets(8, 4, 12);
    const o = chooseOffset(args([everything]));
    expect(cands).toContainEqual(o);
    expect(overlap(everything, { l: 0, t: 0, r: 1, b: 1 })).toBe(1);
  });
});
