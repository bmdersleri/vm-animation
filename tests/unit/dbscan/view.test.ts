import { describe, expect, it } from 'vitest';
import { dbscanData as d } from '../../../src/concepts/dbscan/data';
import { dbscan } from '../../../src/concepts/dbscan/dbscan';
import { countsText, kindCounts, reachedCount, verdictFor } from '../../../src/concepts/dbscan/view';

const { core, border, noise } = d.examples;
const base = dbscan(d.points, d.meta.eps, d.meta.minSamples);

describe('dbscan view', () => {
  it('verdict texts say the count, the comparison and the kind', () => {
    const a = verdictFor(base, core, 5);
    expect(a.kind).toBe('core');
    expect(a.neighbours).toBe(base.neighbours[core].length);
    expect(a.text).toBe(`${a.neighbours} ≥ 5 → çekirdek`);

    const b = verdictFor(base, border, 5);
    expect(b.kind).toBe('border');
    expect(b.viaCore).not.toBeNull();
    expect(base.kind[b.viaCore!]).toBe('core');
    expect(base.neighbours[border]).toContain(b.viaCore);
    expect(b.text).toBe(`${b.neighbours} < 5, dairesinde çekirdek var (Nokta ${b.viaCore! + 1}) → sınır`);

    const c = verdictFor(base, noise, 5);
    expect(c.kind).toBe('noise');
    expect(c.viaCore).toBeNull();
    expect(c.text).toBe(`${c.neighbours} < 5 ve dairesinde çekirdek yok → gürültü`);
  });

  it('panel verdict follows live params', () => {
    for (const eps of [0.05, 0.1, 0.3, 0.6]) {
      for (const m of [2, 5, 12]) {
        const r = dbscan(d.points, eps, m);
        const v = verdictFor(r, core, m);
        expect(v.kind).toBe(r.kind[core]);
        expect(v.neighbours).toBe(r.neighbours[core].length);
        expect(v.text).toContain(String(v.neighbours));
        expect(v.text).toContain(v.kind === 'core' ? 'çekirdek' : v.kind === 'border' ? 'sınır' : 'gürültü');
        expect(v.text).toContain(v.kind === 'core' ? `≥ ${m}` : `< ${m}`);
      }
    }
    // At a tiny eps the same point A is no longer a core point and is told so.
    const tiny = dbscan(d.points, 0.05, 5);
    expect(verdictFor(tiny, core, 5).text).toMatch(/< 5 ve dairesinde çekirdek yok → gürültü$/);
  });

  it('counts text reads the numbers from the result', () => {
    const k = kindCounts(base);
    expect(k.core + k.border + k.noise).toBe(d.points.length);
    expect(countsText(base)).toBe(`${base.clusters} küme · ${k.core} çekirdek · ${k.border} sınır · ${k.noise} gürültü`);
    expect(k).toEqual({ core: 191, border: 8, noise: 11 });
    const none = dbscan(d.points, 0.05, 15);
    expect(kindCounts(none).core).toBe(0);
    expect(countsText(none)).toContain('0 küme');
  });

  it('reachedCount maps spread to a share of the order', () => {
    expect(reachedCount(10, 0)).toBe(0);
    expect(reachedCount(10, 0.5)).toBe(5);
    expect(reachedCount(10, 1)).toBe(10);
    expect(reachedCount(10, 7)).toBe(10);
    expect(reachedCount(10, -1)).toBe(0);
  });
});
