import { describe, expect, it } from 'vitest';
import { sepetData } from '../../../src/concepts/birliktelik/data';
import { sortItems } from '../../../src/concepts/birliktelik/format';
import {
  applyEdits, baseStrip, basketLine, confidenceStrip, liftStrip, measures, supportStrip, UNDEFINED,
} from '../../../src/concepts/birliktelik-olculeri/view';

const tx = sepetData.transactions;
const ordered = tx.map((b) => sortItems(b));

describe('birliktelik-olculeri view', () => {
  it('formula strip writes numerator, denominator and value', () => {
    expect(supportStrip(tx, ['ekmek'])).toBe('destek(Ekmek) = 11 / 18 = 0,611');
    expect(supportStrip(tx, ['ekmek', 'sut'])).toBe('destek({Ekmek, Süt}) = 7 / 18 = 0,389');
    expect(confidenceStrip(tx, ['ekmek'], ['sut'])).toBe('güven(Ekmek → Süt) = 7 / 11 = 0,636');
    expect(confidenceStrip(tx, ['sut'], ['ekmek'])).toBe('güven(Süt → Ekmek) = 7 / 12 = 0,583');
    expect(baseStrip(tx, ['sut'])).toBe('taban oran = destek(Süt) = 12 / 18 = 0,667');
    expect(liftStrip(tx, ['ekmek'], ['sut'])).toBe('kaldıraç(Ekmek → Süt) = 0,636 / 0,667 = 0,955');
    expect(liftStrip(tx, ['yumurta'], ['sut'])).toContain('= 1,350');
    expect(liftStrip(tx, ['sut'], ['yumurta'])).toBe('kaldıraç(Süt → Yumurta) = 0,750 / 0,556 = 1,350');
  });

  it('undefined confidence shows — (tanımsız)', () => {
    const noBread = tx.map((b) => b.filter((i) => i !== 'ekmek'));
    expect(confidenceStrip(noBread, ['ekmek'], ['sut'])).toBe(`güven(Ekmek → Süt) = 0 / 0 = ${UNDEFINED}`);
    expect(liftStrip(noBread, ['ekmek'], ['sut'])).toBe(`kaldıraç(Ekmek → Süt) = ${UNDEFINED}`);
    // an unknown consequent has no base rate, so the lift is undefined while the confidence is 0
    const m = measures(noBread, ['sut'], ['ekmek']);
    expect(m.confidence).toBe(0);
    expect(m.lift).toBeNull();
    expect(liftStrip(noBread, ['sut'], ['ekmek'])).toBe(`kaldıraç(Süt → Ekmek) = ${UNDEFINED}`);
    for (const s of [confidenceStrip([], ['ekmek'], ['sut']), supportStrip([], ['ekmek']), baseStrip([], ['sut'])]) {
      expect(s).not.toMatch(/NaN|Infinity|undefined/);
    }
  });

  it('applyEdits toggles cells and keeps product order', () => {
    expect(applyEdits([])).toEqual(ordered);
    const items = sepetData.items.length;
    const cell = 0 * items + sepetData.items.indexOf('recel');
    const edited = applyEdits([cell]);
    expect(edited[0]).toEqual(sortItems([...tx[0], 'recel']));
    expect(applyEdits([cell, cell])).toEqual(ordered);
    // removing a present item
    expect(applyEdits([0])[0]).not.toContain('ekmek');
    // out-of-range and bad codes are ignored
    expect(applyEdits([-1, 9999, 1.5, Number.NaN])).toEqual(ordered);
  });

  it('basket line reads the book example', () => {
    expect(basketLine(tx, 3)).toBe('Fiş 4: Ekmek, Süt, Yumurta, Tereyağı');
  });
});
