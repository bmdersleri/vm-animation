import { formatNumber } from '../../core/plot/format';
import { gauss } from './data';
import { naturalCounts, type Natural } from './bayes';
import { fitGaussian, pdf, proba, type GaussModel } from './gaussian';
import { nbScenario, type NbParams } from './scenario';
import { likelihood, trail } from './spam';

export type NbPart = 1 | 2 | 3; // steps 0-3, 4-9, 10-12

export interface NbView {
  part: NbPart;
  stepId: string;
  natural: Natural;
  reveal: 0 | 1 | 2;
  /** Part 2: P(spam); part 3: P(Ayrıldı). Null in part 1. */
  bar: { spam: number | null; label: string } | null;
  trail: (number | null)[];
  /** Step 8 only: the trail of the original word order. */
  ghost: (number | null)[] | null;
  words: string[];
  alpha: 0 | 1;
  /**
   * Strip text with values filled in. Part 1 reveal 2 is two lines joined by
   * "\n" (count line, then the Bayes formula); every other strip is one line.
   */
  strip: string;
  /** heights[feature][class]: Gaussian densities at the query. */
  gauss: {
    model: GaussModel;
    query: { t: number; c: number };
    heights: [[number, number], [number, number]];
  } | null;
  regions: boolean;
}

const model: GaussModel = fitGaussian(
  gauss.train.map((r) => [r.t, r.c] as [number, number]),
  gauss.train.map((r) => r.y),
);

const ORIGINAL_ORDER = ['bedava', 'kazandınız', 'toplantı'];
const SORT_STEP = 8;

const pct = (x: number): string => `%${formatNumber(x * 100, 1)}`;
const f2 = (x: number): string => formatNumber(x, 2);
/** Slider value without trailing zeros: 0,01 / 0,9 / 0,1. */
const plain = (x: number): string => formatNumber(x, 3).replace(/,?0+$/, '');

function partOf(index: number): NbPart {
  return index <= 3 ? 1 : index <= 9 ? 2 : 3;
}

function part1Strip(n: Natural, p: NbParams): string {
  if (p.reveal === 0) return `P(hasta) = ${n.sick}/${n.sick + n.healthy}`;
  if (p.reveal === 1) return `Hastalardan ${n.tp} / ${n.sick}, sağlıklılardan ${n.fp} / ${n.healthy} pozitif`;
  if (n.posterior === null) return 'Pozitif çıkan yok: sonsal tanımsız';
  const num = `${plain(p.prior)} · ${plain(p.sens)}`;
  return [
    `${n.tp} / (${n.tp} + ${n.fp}) = ${pct(n.posterior)}`,
    `P(hasta | +) = ${num} / (${num} + ${plain(1 - p.prior)} · ${plain(p.fpr)})`,
  ].join('\n');
}

function part2Strip(words: string[], alpha: 0 | 1, tr: (number | null)[]): string {
  if (words.length === 0) return 'Henüz kelime yok: sonsal = öncül';
  const post = tr[words.length];
  const prev = tr[words.length - 1];
  if (post === null || prev === null) return 'İki sınıf da sıfır: karar verilemiyor';
  const w = words[words.length - 1];
  const label = words.length === 1 ? 'öncül' : 'yeni öncül';
  return (
    `${label} ${f2(prev)} · P(${w} | spam) ${f2(likelihood(w, 1, alpha))}  vs  ` +
    `${f2(1 - prev)} · P(${w} | normal) ${f2(likelihood(w, 0, alpha))} → ${pct(post)} spam`
  );
}

export function deriveNbView(index: number, p: NbParams): NbView {
  const part = partOf(index);
  const natural = naturalCounts(p.prior, p.sens, p.fpr);
  const base = {
    part,
    stepId: nbScenario.steps[index].id,
    natural,
    reveal: p.reveal,
    words: p.words,
    alpha: p.alpha,
    regions: p.regions,
  };

  if (part === 1) {
    return { ...base, bar: null, trail: [], ghost: null, strip: part1Strip(natural, p), gauss: null };
  }

  if (part === 2) {
    const tr = trail(p.words, p.alpha);
    return {
      ...base,
      bar: { spam: tr[tr.length - 1], label: 'P(spam)' },
      trail: tr,
      ghost: index === SORT_STEP ? trail(ORIGINAL_ORDER, p.alpha) : null,
      strip: part2Strip(p.words, p.alpha, tr),
      gauss: null,
    };
  }

  const q = p.query;
  const post = proba(model, [q.t, q.c]);
  return {
    ...base,
    bar: { spam: post[1], label: 'P(Ayrıldı)' },
    trail: [],
    ghost: null,
    strip: `Öncül × eğri yükseklikleri, normalize → P(Kaldı) ${formatNumber(post[0], 3)} · P(Ayrıldı) ${formatNumber(post[1], 3)}`,
    gauss: {
      model,
      query: q,
      heights: [
        [pdf(model, 0, 0, q.t), pdf(model, 1, 0, q.t)],
        [pdf(model, 0, 1, q.c), pdf(model, 1, 1, q.c)],
      ],
    },
  };
}
