export { html, svg } from '../degerlendirme/ui';
import { UNDEFINED_TEXT } from '../degerlendirme/ui';
export const number = (v: number): string => v.toLocaleString('tr-TR', { maximumFractionDigits: 3 });
export const percent = (v: number | null): string => v === null ? UNDEFINED_TEXT : `%${(100*v).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`;
export const thresholdText = (v: number | 'none'): string => v === 'none' ? 'Hiç pozitif tahmin yok' : v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
