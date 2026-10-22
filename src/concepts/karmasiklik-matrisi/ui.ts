export { html, svg } from '../degerlendirme/ui';
import { UNDEFINED_TEXT } from '../degerlendirme/ui';

export const number = (value: number): string => value.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
export const percent = (value: number | null): string => value === null ? UNDEFINED_TEXT : `%${number(value * 100)}`;
