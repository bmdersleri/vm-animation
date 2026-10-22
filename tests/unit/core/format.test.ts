import { describe, expect, it } from 'vitest';
import { formatNonZero, formatNumber, formatPercent, formatTrim, tickFormat } from '../../../src/core/plot/format';

describe('formatNumber', () => {
  it('uses a decimal comma', () => expect(formatNumber(0.3429, 3)).toBe('0,343'));
  it('uses U+2212 for the minus sign', () => expect(formatNumber(-1.5, 1)).toBe('−1,5'));
  it('shows negative zero without a sign', () => expect(formatNumber(-0, 2)).toBe('0,00'));
});

describe('tickFormat', () => {
  it('uses just enough decimals for the tick step', () => expect(tickFormat([0, 0.5, 1])(0.5)).toBe('0,5'));
});

describe('formatNonZero', () => {
  it('adds decimals so a non-zero value never shows as zero', () => expect(formatNonZero(0.004, 2)).toBe('0,004'));
  it('keeps true zero', () => expect(formatNonZero(0, 2)).toBe('0,00'));
  it('uses U+2212 minus', () => expect(formatNonZero(-0.0001, 2)).toBe('−0,0001'));
  it('leaves ordinary values alone', () => expect(formatNonZero(68.76667, 2)).toBe('68,77'));
});

describe('formatPercent', () => {
  it('formats ratios', () => {
    expect(formatPercent(0.91217145)).toBe('%91,2');
    expect(formatPercent(0.9999996795)).toBe('%99,99997');
    expect(formatPercent(3.2046e-7)).toBe('%0,00003');
    expect(formatPercent(1)).toBe('%100,0');
    expect(formatPercent(0)).toBe('%0,0');
    expect(formatPercent(0.4225, 2)).toBe('%42,25');
    expect(formatPercent(0.3099)).toBe('%31,0');
  });
});

describe('formatTrim', () => {
  it('drops trailing zeros and a bare comma', () => {
    expect(formatTrim(16.4, 2)).toBe('16,4');
    expect(formatTrim(8, 2)).toBe('8');
    expect(formatTrim(2.7900001, 2)).toBe('2,79');
    expect(formatTrim(12.4, 1)).toBe('12,4');
    expect(formatTrim(16, 1)).toBe('16');
  });
  it('keeps the non-zero rule and the U+2212 minus', () => {
    expect(formatTrim(0.004, 2)).toBe('0,004');
    expect(formatTrim(-1.5, 2)).toBe('−1,5');
    expect(formatTrim(0, 2)).toBe('0');
  });
});
