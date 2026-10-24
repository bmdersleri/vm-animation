import { CURVES } from './data';

/**
 * One colour per learning rate, the same on every boosting page: the class `lrc-N` where N is the
 * index of the rate in `CURVES.lrs` (0,01 / 0,05 / 0,1 / 0,3 / 0,5 / 1,0). The colours live in
 * `lr-color.css`. A rate outside the data (a Lab value such as 0,02) gets the neutral `lrc-x`.
 */
export function lrColorClass(lr: number): string {
  const i = CURVES.lrs.findIndex((v) => Math.abs(v - lr) < 1e-9);
  return i < 0 ? 'lrc-x' : `lrc-${i}`;
}
