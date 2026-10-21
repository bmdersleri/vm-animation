import { formatNonZero, formatNumber, formatPercent } from '../../core/plot/format';
import type { Domain } from '../../core/plot/viewport';
import { PAIR, SCREE, TSNE, type Perplexity, type Pt } from './data';
import { componentsFor, normDeg, pairFit, projVar, varianceCurve, withBirim, type Birim } from './pca2';
import type { PcaParams } from './scenario';
import { pcaScenario } from './scenario';

export type PcaPart = 1 | 2 | 3;
export type PcaKind = 'scatter' | 'scree' | 'panels';

/** Equal px per unit in x and y at ×1; at ×1000 the y range scales with the data so the rotated cloud still fits. */
export const DOMAIN: Record<Birim, Domain> = {
  1: { x: [-5, 5], y: [-5, 5] },
  1000: { x: [-5, 5], y: [-5000, 5000] },
};

export interface DirView { deg: number; label: string }
export interface SideView {
  gauge: { value: number; max: number; label: string };
  curve: {
    values: number[];
    upTo: number | null;
    marker: number;
    peak: { deg: number; label: string } | null;
  };
}
export interface ScatterView {
  birim: Birim;
  points: readonly Pt[];
  domain: Domain;
  axisTitles: { x: string; y: string };
  center: boolean;
  dir: DirView | null;
  dir2: DirView | null;
  projections: boolean;
  rotate: number;
  collapsed: boolean;
  dropLines: boolean;
  side: SideView | null;
}
export interface ScreeView {
  evr: number[];
  labels: string[];
  cum: number[] | null;
  threshold: { t: number; label: string } | null;
  k: number | null;
  cumLabel: string | null;
}
export interface PanelsView {
  perplexity: Perplexity;
  embedKey: `p${Perplexity}` | `p${Perplexity}-new`;
  newCustomer: boolean;
  titles: [string, string];
  rule: boolean;
}
export interface PcaView {
  part: PcaPart;
  stepId: string;
  kind: PcaKind;
  scatter: ScatterView | null;
  scree: ScreeView | null;
  panels: PanelsView | null;
  strip: string;
  note: string;
}

const scaled = new Map<Birim, readonly Pt[]>();
function pointsFor(birim: Birim): readonly Pt[] {
  if (birim === 1) return PAIR;
  let pts = scaled.get(birim);
  if (!pts) {
    pts = withBirim(PAIR, birim);
    scaled.set(birim, pts);
  }
  return pts;
}

const fv = (v: number): string => (v >= 1000 ? formatNumber(v, 0) : formatNonZero(v, 2));
const deg0 = (d: number): string => `${Math.round(d)}°`;

/**
 * `reached`: the largest θ the step 3 curve has already been drawn to in this
 * visit of the step (the scene tracks it), so dragging back after the sweep does
 * not cut the curve short.
 */
export function derivePcaView(index: number, p: PcaParams, opts: { reached?: number } = {}): PcaView {
  const birim = p.birim;
  const fit = pairFit(birim);
  const { l1, l2, v1, v2 } = fit.eig;
  const comp = (x: number): string => formatNonZero(x, birim === 1000 ? 4 : 3);
  // step 3 sweeps 0° → 180°: its labels read the un-normalised angle so the sweep ends on 180°, not 0°
  const swept = Math.min(180, Math.max(0, p.theta));
  const theta = index === 2 ? swept : normDeg(p.theta);
  const pc1 = fit.pc1Deg;
  const kind: PcaKind = index <= 7 ? 'scatter' : index <= 9 ? 'scree' : 'panels';
  const part: PcaPart = index <= 7 ? 1 : index <= 9 ? 2 : 3;

  let scatter: ScatterView | null = null;
  let scree: ScreeView | null = null;
  let panels: PanelsView | null = null;

  if (kind === 'scatter') {
    const onPc1 = Math.abs(theta - pc1) < 0.5;
    let dir: DirView | null = null;
    let dir2: DirView | null = null;
    if (index === 1 || index === 2) dir = { deg: normDeg(p.theta), label: `θ = ${deg0(theta)}` };
    else if (index === 3 || index === 4) dir = { deg: theta, label: onPc1 ? 'PC1' : `θ = ${deg0(theta)}` };
    else if (index >= 5) dir = { deg: pc1, label: 'PC1' };
    if (index === 4) {
      const d = normDeg(theta + 90);
      dir2 = { deg: d, label: onPc1 ? 'PC2' : `θ + 90° = ${Math.round(d)}°` };
    } else if (index === 5 || index === 6) {
      dir2 = { deg: normDeg(pc1 + 90), label: 'PC2' };
    }
    const hasSide = (index >= 1 && index <= 4) || index === 7;
    let side: SideView | null = null;
    if (hasSide && dir) {
      const upTo = index === 1 ? null : index === 2 ? Math.min(180, Math.max(swept, opts.reached ?? 0)) : 180;
      const value = projVar(fit.cov, dir.deg);
      side = {
        gauge: { value, max: 1.1 * l1, label: `varyans ${fv(value)}` },
        curve: {
          values: varianceCurve(fit.cov),
          upTo,
          // projVar(180) = projVar(0): at the end of the sweep the marker stays at the right end of the curve
          marker: index === 2 ? swept : dir.deg,
          peak: upTo === 180 ? { deg: Math.round(pc1), label: `en büyük: θ = ${deg0(pc1)}` } : null,
        },
      };
    }
    const pcAxes = index === 5 || index === 6;
    scatter = {
      birim,
      points: pointsFor(birim),
      domain: DOMAIN[birim],
      axisTitles: pcAxes
        ? { x: 'PC1', y: 'PC2' }
        : {
          x: '2. öznitelik (ölçekli)',
          y: birim === 1000 ? '9. öznitelik × 1000' : '9. öznitelik (ölçekli)',
        },
      center: index <= 4 || index === 7,
      dir,
      dir2,
      projections: index >= 1 && index <= 4,
      rotate: pcAxes ? -pc1 : 0,
      collapsed: index === 6,
      dropLines: index === 6,
      side,
    };
  } else if (kind === 'scree') {
    const evr = SCREE.evr;
    const labels = evr.map((e) => formatPercent(e));
    if (index === 8) {
      scree = { evr, labels, cum: null, threshold: null, k: null, cumLabel: null };
    } else {
      const k = componentsFor(SCREE.cum, p.threshold / 100);
      scree = {
        evr, labels, cum: SCREE.cum,
        threshold: { t: p.threshold, label: `%${p.threshold} eşik` },
        k, cumLabel: formatPercent(SCREE.cum[k - 1]),
      };
    }
  } else {
    panels = {
      perplexity: p.perplexity,
      embedKey: index === 10 ? `p${p.perplexity}` : `p${p.perplexity}-new`,
      newCustomer: index >= 11,
      titles: [`PCA · PC1 ${formatPercent(TSNE.pcaEvr[0])}`, `t-SNE · perplexity = ${p.perplexity}`],
      rule: index === 12,
    };
  }

  const strip = stripFor(index, p);
  const note = noteFor(index, p);
  return { part, stepId: pcaScenario.steps[index].id, kind, scatter, scree, panels, strip, note };

  function stripFor(i: number, q: PcaParams): string {
    const pcs = `(${comp(v1[0])}; ${comp(v1[1])})`;
    switch (i) {
      case 0:
        return 'r = 0,82: iki sütun büyük ölçüde aynı bilgiyi taşıyor';
      case 1:
        return `θ = ${deg0(theta)} → izdüşümlerin varyansı ${fv(projVar(fit.cov, theta))}`;
      case 2: {
        const t = Math.min(180, Math.max(0, q.theta));
        const first = `θ = ${deg0(t)} → izdüşümlerin varyansı ${fv(projVar(fit.cov, t))}`;
        return t >= 180 ? `${first}\nen büyük varyans θ = ${deg0(pc1)}’de: ${fv(l1)}` : first;
      }
      case 3:
        return `λ1 = ${fv(l1)} · PC1 = ${pcs}`;
      case 4:
        return `λ2 = ${fv(l2)} · PC2 = (${comp(v2[0])}; ${comp(v2[1])}) · PC1’e dik`;
      case 5:
        return `EVR₁ = ${fv(l1)} / (${fv(l1)} + ${fv(l2)}) = ${formatPercent(fit.evr[0])}`;
      case 6:
        return `2 sütun → 1 bileşen · korunan ${formatPercent(fit.evr[0])} · kaybolan ${formatPercent(fit.evr[1])}`;
      case 7:
        return `×${birim}: PC1 = ${pcs} · PC1’in oranı ${formatPercent(fit.evr[0])}`;
      case 8:
        return `12 bileşenin açıklanan varyans oranı: ${SCREE.evr.slice(0, 5).map((e) => formatPercent(e)).join(' · ')} · …`;
      case 9: {
        const k = scree!.k!;
        return `PCA(n_components=0.${String(q.threshold).padStart(2, '0')}) → ${k} bileşen · kümülatif ${scree!.cumLabel}`;
      }
      case 10:
        return `PCA: PC1 ${formatPercent(TSNE.pcaEvr[0])} · t-SNE: perplexity = ${q.perplexity}`;
      case 11:
        return `pca.transform(yeni) → (${formatNumber(TSNE.newPca[0], 2)}; ${formatNumber(TSNE.newPca[1], 2)})\n`
          + 'tsne.transform(yeni) → AttributeError · yeniden çalıştırınca harita değişti';
      default:
        return 'PCA sıkıştırır, özellik seçimi eler, t-SNE yalnızca gösterir.';
    }
  }

  function noteFor(i: number, q: PcaParams): string {
    if (i >= 1 && i <= 4) {
      return `θ = ${deg0(theta)} → izdüşüm varyansı ${fv(projVar(fit.cov, theta))}; PC1 (${deg0(pc1)}) yönünde ${fv(l1)}.`;
    }
    if (i === 0 || (i >= 5 && i <= 7)) {
      return `×${birim}: PC1 = (${comp(v1[0])}; ${comp(v1[1])}), açıklanan varyans ${formatPercent(fit.evr[0])}.`;
    }
    if (i <= 9) {
      const k = componentsFor(SCREE.cum, q.threshold / 100);
      return `%${q.threshold} eşiği için ${k} bileşen gerekir (kümülatif ${formatPercent(SCREE.cum[k - 1])}).`;
    }
    return `perplexity = ${q.perplexity}: komşuluk genişliği değişince t-SNE haritası değişir; PCA paneli değişmez.`;
  }
}
