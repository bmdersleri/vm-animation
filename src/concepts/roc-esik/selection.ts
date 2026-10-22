import { bestThreshold, type ScoredSample, type Threshold } from '../degerlendirme/curves';
/** Only validation supplies candidates and costs. Test remains a reporting input. */
export function selectFinalThreshold(data: { readonly validation: readonly ScoredSample[]; readonly test: readonly ScoredSample[] }, fpCost: number, fnCost: number): Threshold {
  return bestThreshold(data.validation, fpCost, fnCost);
}
