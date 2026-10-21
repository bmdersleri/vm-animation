import { describe, it, expect } from 'vitest';
import { derivePcaView, DOMAIN } from '../../../src/concepts/pca/view';
import { pcaScenario, type PcaParams } from '../../../src/concepts/pca/scenario';
import { pairFit, projVar } from '../../../src/concepts/pca/pca2';
import { PAIR } from '../../../src/concepts/pca/data';

const base = (i: number): PcaParams => ({ ...pcaScenario.defaults, ...pcaScenario.steps[i].params });
const V = (i: number, over: Partial<PcaParams> = {}) => derivePcaView(i, { ...base(i), ...over });
const S = (i: number, over: Partial<PcaParams> = {}) => V(i, over).scatter!;
const idx = [...Array(13).keys()];

describe('pca view', () => {
  it('kind and part per step', () => {
    expect(idx.map((i) => V(i).kind)).toEqual([...Array(8).fill('scatter'), 'scree', 'scree', 'panels', 'panels', 'panels']);
    expect(idx.map((i) => V(i).part)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 3, 3]);
    expect(idx.map((i) => V(i).stepId)).toEqual(pcaScenario.steps.map((s) => s.id));
  });

  it('strips at the book values', () => {
    expect(V(0).strip).toBe('r = 0,82: iki sütun büyük ölçüde aynı bilgiyi taşıyor');
    expect(V(1).strip).toBe('θ = 0° → izdüşümlerin varyansı 1,00');
    expect(V(2, { theta: 180 }).strip).toBe('θ = 180° → izdüşümlerin varyansı 1,00\nen büyük varyans θ = 45°’de: 1,83');
    expect(V(2, { theta: 135 }).strip).toBe('θ = 135° → izdüşümlerin varyansı 0,18');
    expect(V(2, { theta: 60 }).strip).not.toContain('\n');
    expect(V(3).strip).toBe('λ1 = 1,83 · PC1 = (0,707; 0,707)');
    expect(V(4).strip).toBe('λ2 = 0,18 · PC2 = (0,707; −0,707) · PC1’e dik');
    expect(V(5).strip).toBe('EVR₁ = 1,83 / (1,83 + 0,18) = %91,2');
    expect(V(6).strip).toBe('2 sütun → 1 bileşen · korunan %91,2 · kaybolan %8,8');
    expect(V(7).strip).toBe('×1000: PC1 = (0,0008; 1,0000) · PC1’in oranı %99,99997');
    expect(V(7, { birim: 1 }).strip).toBe('×1: PC1 = (0,707; 0,707) · PC1’in oranı %91,2');
    expect(V(8).strip).toBe('12 bileşenin açıklanan varyans oranı: %44,1 · %31,0 · %18,8 · %2,0 · %1,2 · …');
    expect(V(9).strip).toBe('PCA(n_components=0.90) → 3 bileşen · kümülatif %93,8');
    expect(V(9, { threshold: 50 }).strip).toBe('PCA(n_components=0.50) → 2 bileşen · kümülatif %75,1');
    expect(V(10).strip).toBe('PCA: PC1 %82,1 · t-SNE: perplexity = 30');
    expect(V(11).strip).toBe('pca.transform(yeni) → (2,78; −0,02)\ntsne.transform(yeni) → AttributeError · yeniden çalıştırınca harita değişti');
    expect(V(12).strip).toBe('PCA sıkıştırır, özellik seçimi eler, t-SNE yalnızca gösterir.');
  });

  it('live notes', () => {
    expect(V(1, { theta: 30 }).note).toBe('θ = 30° → izdüşüm varyansı 1,72; PC1 (45°) yönünde 1,83.');
    expect(V(0).note).toBe('×1: PC1 = (0,707; 0,707), açıklanan varyans %91,2.');
    expect(V(8).note).toBe('%90 eşiği için 3 bileşen gerekir (kümülatif %93,8).');
    expect(V(12).note).toBe('perplexity = 30: komşuluk genişliği değişince t-SNE haritası değişir; PCA paneli değişmez.');
  });

  it('step 1: 500 points, equal domain, centre cross', () => {
    const s = S(0);
    expect(s.points).toHaveLength(500);
    expect(s.points).toBe(PAIR);
    expect(s.domain).toEqual({ x: [-5, 5], y: [-5, 5] });
    expect(s.center).toBe(true);
    expect(s.dir).toBeNull();
    expect(s.axisTitles).toEqual({ x: '2. öznitelik (ölçekli)', y: '9. öznitelik (ölçekli)' });
    expect(DOMAIN[1000].y).toEqual([-5000, 5000]);
  });

  it('step 2: direction at 0° with projections and gauge 1,00', () => {
    const s = S(1);
    expect(s.dir).toEqual({ deg: 0, label: 'θ = 0°' });
    expect(s.projections).toBe(true);
    expect(s.side!.gauge.label).toBe('varyans 1,00');
    expect(s.side!.curve.upTo).toBeNull();
  });

  it('step 3: curve drawn up to θ', () => {
    const s = S(2, { theta: 60 });
    expect(s.side!.curve.upTo).toBe(60);
    expect(s.side!.curve.marker).toBe(60);
    expect(s.side!.curve.peak).toBeNull();
    expect(s.side!.curve.values).toHaveLength(181);
    expect(s.dir!.label).toBe('θ = 60°');
  });

  it('step 3 end: peak at 45° and the second strip line', () => {
    const v = V(2, { theta: 180 });
    expect(v.scatter!.side!.curve.peak).toEqual({ deg: 45, label: 'en büyük: θ = 45°' });
    expect(v.strip.split('\n')[1]).toBe('en büyük varyans θ = 45°’de: 1,83');
  });

  it('step 3 at θ = 180: line label, curve marker and note all read 180°', () => {
    const v = V(2, { theta: 180 });
    const s = v.scatter!;
    expect(s.dir!.label).toBe('θ = 180°');
    expect(s.side!.curve.marker).toBe(180);
    expect(s.side!.curve.upTo).toBe(180);
    expect(s.side!.gauge.label).toBe('varyans 1,00');
    expect(v.strip.startsWith('θ = 180°')).toBe(true);
    expect(v.note.startsWith('θ = 180°')).toBe(true);
    // the direction itself is still drawn mod 180
    expect(s.dir!.deg).toBe(0);
  });

  it('step 3: a curve already drawn to 180° stays whole when θ is dragged back', () => {
    const p = { ...base(2), theta: 100 };
    expect(derivePcaView(2, p).scatter!.side!.curve.upTo).toBe(100);
    const s = derivePcaView(2, p, { reached: 180 }).scatter!;
    expect(s.side!.curve.upTo).toBe(180);
    expect(s.side!.curve.marker).toBe(100);
    expect(s.side!.curve.peak).toEqual({ deg: 45, label: 'en büyük: θ = 45°' });
    expect(derivePcaView(2, p, { reached: 60 }).scatter!.side!.curve.upTo).toBe(100);
  });

  it('step 4: PC1 at 45° and λ1 1,83', () => {
    const s = S(3);
    expect(s.dir).toEqual({ deg: 45, label: 'PC1' });
    expect(s.side!.curve.upTo).toBe(180);
    expect(s.side!.curve.peak!.deg).toBe(45);
    expect(S(3, { theta: 30 }).dir!.label).toBe('θ = 30°');
  });

  it('step 5: PC2 perpendicular, λ2 0,18', () => {
    const s = S(4);
    expect(s.dir2).toEqual({ deg: 135, label: 'PC2' });
    expect(S(4, { theta: 30 }).dir2).toEqual({ deg: 120, label: 'θ + 90° = 120°' });
  });

  it('step 6: rotate −45, PC axis titles', () => {
    const s = S(5);
    expect(s.rotate).toBeCloseTo(-pairFit(1).pc1Deg, 9);
    expect(s.axisTitles).toEqual({ x: 'PC1', y: 'PC2' });
    expect(s.dir).toEqual({ deg: pairFit(1).pc1Deg, label: 'PC1' });
    expect(s.dir2).toEqual({ deg: 135, label: 'PC2' });
    expect(s.collapsed).toBe(false);
  });

  it('step 7: collapse onto PC1', () => {
    const s = S(6);
    expect(s.collapsed).toBe(true);
    expect(s.dropLines).toBe(true);
    expect(s.rotate).toBeCloseTo(-45, 6);
    expect(S(5).dropLines).toBe(false);
  });

  it('step 8: ×1000, PC1 vertical, strip', () => {
    const v = V(7);
    const s = v.scatter!;
    expect(s.birim).toBe(1000);
    expect(s.rotate).toBe(0);
    expect(s.center).toBe(true);
    expect(s.domain).toEqual(DOMAIN[1000]);
    expect(s.axisTitles.y).toBe('9. öznitelik × 1000');
    expect(s.dir!.label).toBe('PC1');
    expect(s.dir!.deg).toBeGreaterThan(89.9);
    expect(s.side!.curve.peak!.deg).toBe(90);
    const g = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(projVar(pairFit(1000).cov, s.dir!.deg));
    expect(s.side!.gauge.label).toBe(`varyans ${g}`);
    expect(v.strip).toContain('PC1 = (0,0008; 1,0000)');
  });

  it('step 9: twelve ratios', () => {
    const c = V(8).scree!;
    expect(c.evr).toHaveLength(12);
    expect(c.labels.slice(0, 3)).toEqual(['%44,1', '%31,0', '%18,8']);
    expect(c.cum).toBeNull();
    expect(c.threshold).toBeNull();
    expect(c.k).toBeNull();
  });

  it('step 10: threshold 90 → 3 components, %93,8', () => {
    const c = V(9).scree!;
    expect(c.cum).toHaveLength(12);
    expect(c.threshold).toEqual({ t: 90, label: '%90 eşik' });
    expect(c.k).toBe(3);
    expect(c.cumLabel).toBe('%93,8');
  });

  it('threshold table 50 → 2, 90 → 3, 99 → 9', () => {
    expect([50, 90, 99].map((threshold) => V(9, { threshold }).scree!.k)).toEqual([2, 3, 9]);
  });

  it('step 11: panels with perplexity 30', () => {
    const p = V(10).panels!;
    expect(p).toMatchObject({ perplexity: 30, embedKey: 'p30', newCustomer: false, rule: false });
    expect(p.titles).toEqual(['PCA · PC1 %82,1', 't-SNE · perplexity = 30']);
  });

  it('step 12 and 13 panels', () => {
    expect(V(11).panels).toMatchObject({ embedKey: 'p30-new', newCustomer: true, rule: false });
    expect(V(12).panels).toMatchObject({ newCustomer: true, rule: true });
  });

  it('perplexity picks the embedding', () => {
    expect(V(10, { perplexity: 5 }).panels!.embedKey).toBe('p5');
    expect(V(11, { perplexity: 50 }).panels!.embedKey).toBe('p50-new');
  });

  it('theta 180 draws like 0', () => {
    const s = S(1, { theta: 180 });
    expect(s.dir!.deg).toBe(0);
    expect(s.side!.gauge.label).toBe('varyans 1,00');
  });

  it('birim 1000 at every part-1 step keeps every value finite and PC1 near 90°', () => {
    for (let i = 0; i < 8; i++) {
      const v = V(i, { birim: 1000, theta: i === 2 ? 180 : base(i).theta });
      expect(v.strip + v.note).not.toMatch(/NaN|undefined|Infinity/);
      const side = v.scatter!.side;
      if (side) {
        expect(side.gauge.max).toBeGreaterThan(1e6);
        expect(Number.isFinite(side.gauge.value)).toBe(true);
        if (side.curve.upTo === 180) expect(side.curve.peak!.deg).toBe(90);
      }
    }
    const r = S(5, { birim: 1000 }).rotate;
    expect(r).toBeLessThan(-89.9);
    expect(r).toBeGreaterThan(-90);
  });

  it('no strip prints %100 or a zero-looking value for a non-zero number', () => {
    for (const i of idx) for (const birim of [1, 1000] as const) for (const threshold of [50, 75, 90, 99])
      for (const perplexity of [5, 30, 50] as const) for (const theta of [0, 90, 180]) {
        const { strip } = V(i, { birim, threshold, perplexity, theta });
        expect(strip, `${i}/${birim}`).not.toMatch(/%100(?![,]\d*[1-9])/);
        expect(strip, `${i}/${birim}`).not.toMatch(/(?<![\d,])0,0+(?![\d])/);
      }
  });
});
