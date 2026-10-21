// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { select } from 'd3-selection';
import 'd3-transition';
import '../svg-stubs';

describe('svg-stubs', () => {
  it('lets transitions on g and div finish without errors', async () => {
    const svg = select(document.body).append('svg');
    const g = svg.append('g');
    const div = select(document.body).append('div');
    const done = [
      g.transition().duration(30).attr('transform', 'translate(10,0)').end(),
      div.transition().duration(30).style('transform', 'translate(5px, 0px)').end(),
    ];
    await Promise.all(done);
    await new Promise((r) => setTimeout(r, 80));
    const flat = (s: string | null) => (s ?? '').replace(/\s+/g, '');
    expect(flat(g.attr('transform'))).toBe('translate(10,0)');
    expect(flat(div.style('transform'))).toBe('translate(5px,0px)');
  });
});
