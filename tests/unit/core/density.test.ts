import { describe, it, expect } from 'vitest';
import { curvePath, areaPath } from '../../../src/core/plot/density';
describe('density paths', () => {
 it('samples endpoints and rounds coordinates', () => expect(curvePath(x => x, 0, 1, 3, x => x, y => y)).toBe('M0,0L0.5,0.5L1,1'));
 it('closes the area and sorts reversed bounds', () => { const a = areaPath(x => x, 0, 1, 3, x => x, y => y, 2); expect(a).toBe('M0,2L0,0L0.5,0.5L1,1L1,2Z'); expect(areaPath(x => x, 1, 0, 3, x => x, y => y, 2)).toBe(a); });
 it('keeps every sample within interval bounds', () => {const path=areaPath(x=>x*x,2,4,7,x=>x,y=>y,0);const xs=[...path.matchAll(/[ML]([0-9.]+),/g)].map(m=>Number(m[1]));expect(xs.every(x=>x>=2&&x<=4)).toBe(true);expect(curvePath(x=>x,0,1,7,x=>x,y=>y).match(/[ML]/g)).toHaveLength(7);});
 it('returns no area for equal bounds', () => expect(areaPath(x => x, 1, 1, 3, x => x, y => y, 2)).toBe(''));
});
