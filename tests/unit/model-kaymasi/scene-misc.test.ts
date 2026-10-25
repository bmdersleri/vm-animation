// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { META } from '../../../src/concepts/model-kaymasi/data';
import { ALARM_IDS, ALARM_PATH } from '../../../src/concepts/model-kaymasi/flow';
import { BUGS, OUTPUT, RUN_ERROR } from '../../../src/concepts/model-kaymasi/code-text';
import { flat, go, num, setup, texts } from './harness';

describe('timeline, alarm flow and code (steps 1, 9, 10)', () => {
  it('step 1 timeline marks six reference months', () => {
    const { el } = setup();
    expect(el.querySelector('.kayma-stage')!.getAttribute('data-view')).toBe('timeline');
    const cells = [...el.querySelectorAll('.month-cell')];
    expect(cells.map((c) => num(c, 'data-month'))).toEqual(Array.from({ length: META.months }, (_v, i) => i + 1));
    expect(cells.filter((c) => c.classList.contains('is-ref'))).toHaveLength(META.refMonths);
    expect(flat(el.querySelector('.ref-band-label')!.textContent)).toBe(flat('referans: model burada eğitildi'));
    expect(flat(el.querySelector('.watch-band-label')!.textContent)).toBe('izleme');
    expect(el.querySelector('.ref-band')).not.toBeNull();
    expect(el.querySelector('.watch-band')).not.toBeNull();
    // the reference band covers exactly the reference cells
    const ref = el.querySelector('.ref-band')!;
    const last = cells[META.refMonths - 1];
    expect(num(ref, 'x') + num(ref, 'width')).toBeGreaterThanOrEqual(num(last, 'x') + num(last, 'width') - 0.5);
    expect(num(ref, 'x') + num(ref, 'width')).toBeLessThan(num(cells[META.refMonths], 'x') + num(cells[META.refMonths], 'width'));
  });

  it('step 9 walks the alarm through the behaviour branch', () => {
    const { el, player } = setup();
    go(player, 'alarm-akisi', false);
    expect(el.querySelectorAll('.flow-node')).toHaveLength(ALARM_IDS.length);
    player.setParams({ scan: 1 });
    expect(el.querySelectorAll('.flow-edge.is-path')).toHaveLength(1);
    player.setParams({ scan: Number.POSITIVE_INFINITY });
    expect([...el.querySelectorAll('.flow-edge.is-path')].map((e) => e.getAttribute('data-edge')).sort()).toEqual([...ALARM_PATH].sort());
    // the token ends on the monitoring node, where the return edge leads
    expect(el.querySelector('.flow-node.is-current')!.getAttribute('data-node')).toBe('izleme');
    expect(el.querySelector('.flow-token')).not.toBeNull();
    player.setParams({ scan: 5 });
    expect(el.querySelector('.flow-node.is-current')!.getAttribute('data-node')).toBe('davranis');
    expect(texts(el, '.flow-edge-label')).toEqual(expect.arrayContaining(['Evet', 'Hayır']));
  });

  it('step 10 marks four bugs and the TypeError', () => {
    const { el, player } = setup();
    go(player, 'hata-ayiklama', false);
    player.setParams({ scan: 1 });
    expect(el.querySelectorAll('.bug-badge')).toHaveLength(1);
    expect(el.querySelector('.code-error')!.textContent).toContain(RUN_ERROR);
    expect(el.querySelector('.code-error')!.textContent).toContain('çalışma burada durur');
    player.setParams({ scan: BUGS.length });
    expect(el.querySelectorAll('.bug-badge')).toHaveLength(BUGS.length);
    expect(el.querySelector('.code-output')).toBeNull();
    // after the last bug the corrected code and its output show
    player.setParams({ scan: BUGS.length + 1 });
    expect(el.querySelector('.code-error')).toBeNull();
    expect(texts(el, '.output-line')).toEqual([...OUTPUT]);
    // the corrected code's badges: four, one per bug, each naming the fix and not the bug
    const badges = [...el.querySelectorAll('.fix-badge')];
    expect(badges.map(b => Number(b.getAttribute('data-bug'))).sort()).toEqual([1, 2, 3, 4]);
    for (const b of badges) {
      const bug = BUGS[Number(b.getAttribute('data-bug')) - 1];
      expect(b.textContent).toBe(`${bug.n} · ${bug.fix}`);
      expect(b.textContent).not.toContain(bug.what);
    }
    const hrefs = [...el.querySelectorAll('a.card-link')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['../crisp-dm/', '../shap-degerleri/']);
  });

  it('fixed toggle shows the corrected output', () => {
    const { host, el, player } = setup(745, 530, 'lab');
    go(player, 'hata-ayiklama');
    expect(el.querySelector('.code-output')).toBeNull();
    expect(el.querySelectorAll('.bug-badge')).toHaveLength(BUGS.length);
    const box = host.querySelector<HTMLInputElement>('input[type="checkbox"][data-param="fixed"]')!;
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect(texts(el, '.output-line')).toEqual([...OUTPUT]);
    expect(el.querySelector('.code-title')!.textContent).toBe('Düzeltilmiş kod');
  });
});
