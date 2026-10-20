import { describe, it, expect } from 'vitest';
import { placeBadges, placeQueryLabel } from '../../src/concepts/knn/scene-labels';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);

describe('placeBadges', () => {
  const R = 13;
  const off = (9 * 0.7 + R * 0.75) * Math.SQRT2;
  const q = { x: 200, y: 200 };

  it('puts a lone badge on the far side of its point, off the query', () => {
    const p = { x: 230, y: 200 };
    const [b] = placeBadges([p], q, off, R, 14.4);
    expect(b.x).toBeCloseTo(230 + off, 6);
    expect(b.y).toBeCloseTo(200, 6);
    expect(dist(b, q)).toBeGreaterThan(dist(p, q));
  });

  it('point on the query: badge goes up and right, clear of the diamond', () => {
    const [b] = placeBadges([{ ...q }], q, off, R, 14.4);
    expect(b.x).toBeGreaterThan(q.x);
    expect(b.y).toBeLessThan(q.y);
    expect(dist(b, q) - R).toBeGreaterThan(14.4);
  });

  it('a dense cluster of 15 ends without overlapping badges, each next to its point', () => {
    const pts = Array.from({ length: 15 }, (_, i) => ({
      x: 200 + 22 * Math.cos(i * 2.4) * (1 + (i % 3) * 0.4),
      y: 200 + 22 * Math.sin(i * 2.4) * (1 + (i % 3) * 0.4),
    }));
    const out = placeBadges(pts, q, off, R, 14.4);
    let overlaps = 0;
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) if (dist(out[i], out[j]) < 2 * R - 0.5) overlaps++;
    expect(overlaps).toBe(0);
    out.forEach((b, i) => expect(dist(b, pts[i])).toBeLessThanOrEqual(off + R + 1e-6));
  });
});

describe('placeQueryLabel', () => {
  const plot = { left: 0, top: 0, width: 400, height: 400 };

  it('defaults to below right when nothing is in the way', () => {
    const r = placeQueryLabel({ x: 200, y: 200 }, 14, 100, 18, [], [], plot);
    expect(r.index).toBe(0);
    expect(r.pos.anchor).toBe('start');
    expect(r.pos.y).toBeGreaterThan(0);
  });

  it('moves away from a rank badge under the default spot', () => {
    const badge = { x: 240, y: 225, r: 13 };
    const r = placeQueryLabel({ x: 200, y: 200 }, 14, 100, 18, [badge], [], plot);
    expect(r.index).not.toBe(0);
  });

  it('stays inside the plot near the right edge', () => {
    const r = placeQueryLabel({ x: 390, y: 200 }, 14, 100, 18, [], [], plot);
    expect(r.pos.anchor).toBe('end');
  });

  it('keeps the previous spot on a tie', () => {
    const r = placeQueryLabel({ x: 200, y: 200 }, 14, 100, 18, [], [], plot, 3);
    expect(r.index).toBe(3);
  });
});
