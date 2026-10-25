// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { CodePanel, type CodePanelSpec } from '../../../src/core/plot/code-panel';

const spec = (marked: number, fixed = false): CodePanelSpec => ({
  faulty: [
    { text: 'a = 1', bugs: [] },
    { text: 'b = (1, 2)', bugs: [1] },
    { text: 'c = b[5]', bugs: [2] },
  ],
  fixedLines: [
    { text: 'a = 1', bugs: [] },
    { text: 'b = [1, 2]', bugs: [], fix: true },
  ],
  bugs: [
    { n: 1, kind: 'Tür', what: 'demet' },
    { n: 2, kind: 'Mantık', what: 'olmayan indeks' },
  ],
  marked,
  fixed,
});

describe('code panel', () => {
  it('numbers lines and marks bugs up to the sweep position', () => {
    const host = document.createElement('div');
    const panel = new CodePanel(host);
    panel.update(spec(1));
    expect([...host.querySelectorAll('.code-no')].map((n) => n.textContent)).toEqual(['1', '2', '3']);
    expect(host.querySelectorAll('.code-line.is-bug')).toHaveLength(1);
    panel.update(spec(2));
    expect([...host.querySelectorAll('.bug-badge')].map((b) => b.getAttribute('data-bug'))).toEqual(['1', '2']);
    expect(host.querySelector('.is-current .code-text')!.textContent).toBe('c = b[5]');
    panel.update(spec(2, true));
    expect(host.querySelectorAll('.is-fix')).toHaveLength(1);
    expect(host.querySelector('.code-title')!.textContent).toBe('Düzeltilmiş kod');
    panel.destroy();
    expect(host.querySelector('.code-scene')).toBeNull();
  });
});
