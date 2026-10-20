import { describe, expect, it } from 'vitest';
import { formatNumber, tickFormat } from '../../../src/core/plot/format';

describe('formatNumber', () => {
  it('uses a decimal comma', () => expect(formatNumber(0.3429, 3)).toBe('0,343'));
  it('uses U+2212 for the minus sign', () => expect(formatNumber(-1.5, 1)).toBe('−1,5'));
  it('shows negative zero without a sign', () => expect(formatNumber(-0, 2)).toBe('0,00'));
});

describe('tickFormat', () => {
  it('uses just enough decimals for the tick step', () => expect(tickFormat([0, 0.5, 1])(0.5)).toBe('0,5'));
});
