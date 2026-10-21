import { scaleLinear, type ScaleLinear } from 'd3-scale';

export interface Domain { x: [number, number]; y: [number, number] }
export interface Rect { left: number; top: number; width: number; height: number }
export interface Scales { x: ScaleLinear<number, number>; y: ScaleLinear<number, number> }

/**
 * One space unit is the same number of px on both axes; the domain is centred
 * in `rect` (letterboxed) and y is inverted. The scale ranges are the content
 * box, not the whole rect.
 */
export function fitEqualAspect(domain: Domain, rect: Rect): Scales {
  const dx = domain.x[1] - domain.x[0] || 1;
  const dy = domain.y[1] - domain.y[0] || 1;
  const s = Math.min(rect.width / dx, rect.height / dy);
  const w = dx * s;
  const h = dy * s;
  const left = rect.left + (rect.width - w) / 2;
  const top = rect.top + (rect.height - h) / 2;
  return {
    x: scaleLinear().domain(domain.x).range([left, left + w]),
    y: scaleLinear().domain(domain.y).range([top + h, top]),
  };
}

/**
 * Scales whose range is exactly `rect` (x: left→right, y: bottom→top).
 * equalAspect: the fitEqualAspect mapping, with the domain widened outward so
 * axes, ticks and the region grid span the whole plot rect (used for scaled,
 * z-unit spaces). Otherwise each axis maps its domain onto the rect on its own
 * (used for raw-unit spaces, ruling R11).
 */
export function fitViewport(domain: Domain, rect: Rect, equalAspect: boolean): Scales {
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;
  if (!equalAspect) {
    return {
      x: scaleLinear().domain(domain.x).range([rect.left, right]),
      y: scaleLinear().domain(domain.y).range([bottom, rect.top]),
    };
  }
  const fit = fitEqualAspect(domain, rect);
  return {
    x: scaleLinear().domain([fit.x.invert(rect.left), fit.x.invert(right)]).range([rect.left, right]),
    y: scaleLinear().domain([fit.y.invert(bottom), fit.y.invert(rect.top)]).range([bottom, rect.top]),
  };
}

/** Where fitAspect widens the slack axis from: both ends ('centre') or only the upper end ('min'). */
export type AspectAnchor = 'centre' | 'min';

/**
 * Scales whose range is exactly `rect`; px per x unit = ratio × px per y unit.
 * The axis with slack has its domain widened outward so axes and grids span
 * the whole rect: from the centre by default, or upward from the domain
 * minimum with anchor 'min' (the minimum stays on the left / bottom edge, so a
 * domain that starts at 0 never shows negative ticks). ratio 1 with the
 * centre anchor equals fitViewport(domain, rect, true).
 */
export function fitAspect(domain: Domain, rect: Rect, ratio: number, anchor: AspectAnchor = 'centre'): Scales {
  const dx = domain.x[1] - domain.x[0] || 1;
  const dy = domain.y[1] - domain.y[0] || 1;
  const sy = Math.min(rect.width / (ratio * dx), rect.height / dy);
  const sx = ratio * sy;
  const wx = rect.width / sx;
  const wy = rect.height / sy;
  const x0 = anchor === 'min' ? domain.x[0] : (domain.x[0] + domain.x[1]) / 2 - wx / 2;
  const y0 = anchor === 'min' ? domain.y[0] : (domain.y[0] + domain.y[1]) / 2 - wy / 2;
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;
  return {
    x: scaleLinear().domain([x0, x0 + wx]).range([rect.left, right]),
    y: scaleLinear().domain([y0, y0 + wy]).range([bottom, rect.top]),
  };
}
