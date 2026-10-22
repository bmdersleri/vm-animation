// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { TextMeasure } from '../../../src/core/plot/text-measure';

function measure(): TextMeasure {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const probe = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  svg.append(probe);
  document.body.append(svg);
  return new TextMeasure(probe);
}

describe('TextMeasure.wrap', () => {
  it('greedily fills each line up to the width (jsdom estimate: 0.62 em per character)', () => {
    // 10 px font: 6,2 px per character, so 62 px holds ten characters
    expect(measure().wrap('aaa bbb ccc ddd', 62, 'rule-body', 10)).toEqual(['aaa bbb', 'ccc ddd']);
  });
  it('never splits a word, even one wider than the line', () => {
    expect(measure().wrap('uzunkelimeuzun kısa', 30, 'rule-body', 10)).toEqual(['uzunkelimeuzun', 'kısa']);
  });
  it('keeps a short text on one line and an empty text as no line', () => {
    expect(measure().wrap('kısa', 200, 'rule-body', 10)).toEqual(['kısa']);
    expect(measure().wrap('', 200, 'rule-body', 10)).toEqual([]);
  });
});
