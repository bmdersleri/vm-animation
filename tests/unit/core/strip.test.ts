// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderStrip } from '../../../src/core/plot/strip';

describe('renderStrip', () => {
  it('splits lines and terms, and is idempotent for equal text', () => {
    const p = document.createElement('p');
    renderStrip(p, 'a = 1 · b = 2\nc → d');
    const lines = p.querySelectorAll('span.line');
    expect(lines.length).toBe(2);
    expect([...lines[0].querySelectorAll('span.term')].map((t) => t.textContent)).toEqual(['a', '= 1', '· b', '= 2']);
    expect([...lines].map((l) => l.textContent)).toEqual(['a = 1 · b = 2', 'c → d']);
    const first = p.firstElementChild;
    renderStrip(p, 'a = 1 · b = 2\nc → d');
    expect(p.firstElementChild).toBe(first);
  });
});
