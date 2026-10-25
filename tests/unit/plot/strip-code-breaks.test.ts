// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { allowCodeBreaks, renderStrip } from '../../../src/core/plot/strip';

/** The text before each `wbr` of a term. */
const before = (term: Element): string[] => [...term.querySelectorAll('wbr')].map((w) => w.previousSibling!.textContent ?? '');

describe('allowCodeBreaks', () => {
  it('a code term may wrap after "(" and after the dot of a dotted name, never inside an identifier', () => {
    const p = document.createElement('p');
    renderStrip(p, 'olasilik = model.predict_proba(musteri)[0, 1]');
    allowCodeBreaks(p);
    const code = [...p.querySelectorAll('.term')].find((t) => t.textContent!.includes('predict_proba'))!;
    expect(before(code)).toEqual(['= model.', 'predict_proba(']);
    // the text is unchanged
    expect(p.textContent).toBe('olasilik = model.predict_proba(musteri)[0, 1]');
  });

  it('plain terms, numbers with a dot and a bracket of prose stay untouched', () => {
    const p = document.createElement('p');
    renderStrip(p, 'p = 0.945 · ( a + b ) · renk = özellik değeri (düşük mavi) · (1 − p)');
    allowCodeBreaks(p);
    expect(p.querySelectorAll('wbr')).toHaveLength(0);
  });

  it('runs once per strip text and again when the text changes', () => {
    const p = document.createElement('p');
    renderStrip(p, 'fit(x)');
    allowCodeBreaks(p);
    allowCodeBreaks(p);
    expect(p.querySelectorAll('wbr')).toHaveLength(1);
    renderStrip(p, 'a.b(c)');
    allowCodeBreaks(p);
    expect(before(p.querySelector('.term')!)).toEqual(['a.', 'b(']);
  });
});
