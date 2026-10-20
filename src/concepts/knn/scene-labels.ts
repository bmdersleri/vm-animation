/**
 * Placement of the rank badges and of the "Yeni müşteri" label around the
 * query (pure geometry in px, recomputed per render; cheap for k ≤ 15).
 */

export interface P { x: number; y: number }
export interface Circle extends P { r: number }

/**
 * Badge centres for the k neighbours. Each badge starts on the side of its
 * point facing away from the query (so the query diamond, drawn on top, never
 * hides a rank), then a few relaxation passes push overlapping badges apart
 * and out of the diamond while keeping each badge next to its own point.
 */
export function placeBadges(points: P[], q: P, off: number, badgeR: number, queryHalf: number): P[] {
  const out = points.map((p) => {
    let dx = p.x - q.x;
    let dy = p.y - q.y;
    let len = Math.hypot(dx, dy);
    if (len < 1e-6) [dx, dy, len] = [1, -1, Math.SQRT2]; // on the query: upper right
    return { x: p.x + (dx / len) * off, y: p.y + (dy / len) * off };
  });
  const minGap = 2 * badgeR + 2;
  const minQ = queryHalf + badgeR + 2;
  const maxOff = off + badgeR;
  const minOff = off * 0.85;
  for (let it = 0; it < 24; it++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i];
        const b = out[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= minGap) continue;
        if (d < 1e-6) [dx, dy, d] = [1, 0, 1]; // coincident: split sideways
        const push = (minGap - d) / 2;
        a.x -= (dx / d) * push;
        a.y -= (dy / d) * push;
        b.x += (dx / d) * push;
        b.y += (dy / d) * push;
        moved = true;
      }
    }
    for (let i = 0; i < out.length; i++) {
      const b = out[i];
      const p = points[i];
      // out of the query diamond
      const qd = Math.hypot(b.x - q.x, b.y - q.y);
      if (qd < minQ && qd > 1e-6) {
        b.x = q.x + ((b.x - q.x) / qd) * minQ;
        b.y = q.y + ((b.y - q.y) / qd) * minQ;
      }
      // stay next to (but not on) the badge's own point
      const ex = b.x - p.x;
      const ey = b.y - p.y;
      const e = Math.hypot(ex, ey);
      if (e > maxOff || (e < minOff && e > 1e-6)) {
        const t = (e > maxOff ? maxOff : minOff) / e;
        b.x = p.x + ex * t;
        b.y = p.y + ey * t;
      }
    }
    if (!moved) break;
  }
  return out;
}

export interface QueryLabelPos { anchor: 'start' | 'end'; x: number; y: number }

/**
 * Candidate spots for the query label, relative to the query centre: below
 * right (the default), below left, above right, above left, right, left.
 */
function candidates(half: number, fontPx: number): QueryLabelPos[] {
  const below = half + fontPx * 0.8;
  const above = -half - 4;
  const side = fontPx * 0.35;
  return [
    { anchor: 'start', x: half * 0.6, y: below },
    { anchor: 'end', x: -half * 0.6, y: below },
    { anchor: 'start', x: half * 0.6, y: above },
    { anchor: 'end', x: -half * 0.6, y: above },
    { anchor: 'start', x: half + 6, y: side },
    { anchor: 'end', x: -half - 6, y: side },
  ];
}

function circleHitsRect(c: Circle, l: number, t: number, r: number, b: number): boolean {
  const nx = Math.max(l, Math.min(c.x, r));
  const ny = Math.max(t, Math.min(c.y, b));
  return Math.hypot(c.x - nx, c.y - ny) < c.r;
}

/**
 * Picks the candidate whose label box covers the fewest rank badges (weight 3)
 * and points (weight 1) and stays inside the plot. `prev` (index) is kept on a
 * tie so the label does not flicker while the query is dragged.
 */
export function placeQueryLabel(
  q: P, half: number, labelW: number, fontPx: number,
  badges: Circle[], points: Circle[], plot: { left: number; top: number; width: number; height: number },
  prev = 0,
): { index: number; pos: QueryLabelPos } {
  const cs = candidates(half, fontPx);
  const score = (c: QueryLabelPos): number => {
    const l = q.x + (c.anchor === 'start' ? c.x : c.x - labelW);
    const r = l + labelW;
    const b = q.y + c.y + fontPx * 0.25; // baseline + descent
    const t = b - fontPx;
    let s = 0;
    if (l < plot.left || r > plot.left + plot.width || t < plot.top || b > plot.top + plot.height) s += 100;
    for (const c2 of badges) if (circleHitsRect(c2, l, t, r, b)) s += 3;
    for (const c2 of points) if (circleHitsRect(c2, l, t, r, b)) s += 1;
    return s;
  };
  const scores = cs.map(score);
  let best = 0;
  for (let i = 1; i < cs.length; i++) if (scores[i] < scores[best]) best = i;
  if (prev >= 0 && prev < cs.length && scores[prev] <= scores[best]) best = prev;
  return { index: best, pos: cs[best] };
}
