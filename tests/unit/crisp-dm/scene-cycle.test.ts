// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { go, setup, texts } from './harness';

afterEach(() => {
  vi.unstubAllGlobals();
});

const edgeClasses = (el: Element, id: string): string => el.querySelector(`path.flow-edge[data-edge="${id}"]`)!.getAttribute('class')!;
const current = (el: Element): string | undefined => el.querySelector('.flow-node.is-current')?.getAttribute('data-node') ?? undefined;

describe('cycle scene', () => {
  it('step 1 draws six phases and two decisions', () => {
    const { el, player } = setup();
    go(player, 'sorun');
    expect(el.querySelectorAll('.flow-node')).toHaveLength(8);
    expect(el.querySelectorAll('.flow-node[data-kind="phase"]')).toHaveLength(6);
    expect(el.querySelectorAll('.flow-node[data-kind="decision"]')).toHaveLength(2);
    expect(current(el)).toBe('ia');
    expect(el.querySelectorAll('circle.flow-token')).toHaveLength(1);
    expect(texts(el, '.flow-node[data-node="ya"] tspan').join('')).toBe('Yaygınlaştırma');
    expect(el.querySelector('.crisp-stage')!.getAttribute('data-step')).toBe('sorun');
  });

  it('step 4 sends the project back from the first decision', () => {
    const { el, player } = setup();
    go(player, 'veri-yeterli', false);
    player.setParams({ scan: 2 });
    expect(edgeClasses(el, 'd1-ia')).toContain('is-path');
    expect(edgeClasses(el, 'd1-ia')).toContain('kind-back');
    expect(current(el)).toBe('ia');
  });

  it('step 8 evaluation goes back to data understanding', () => {
    const { el, player } = setup();
    go(player, 'degerlendirme');
    expect(edgeClasses(el, 'd2-va')).toContain('is-path');
    expect(current(el)).toBe('va');
  });

  it('step 9 second tour reaches deployment and loops back', () => {
    const { el, player } = setup();
    go(player, 'ikinci-tur', false);
    player.setParams({ scan: 6 });
    expect(current(el)).toBe('ya');
    expect(edgeClasses(el, 'd2-ya')).toContain('is-path');
    player.setParams({ scan: 7 });
    expect(current(el)).toBe('ia');
    expect(edgeClasses(el, 'ya-ia')).toContain('is-path');
    expect(edgeClasses(el, 'ya-ia')).toContain('kind-outer');
  });

  it('step 10 draws the plain cycle: no current node, no token', () => {
    const { el, player } = setup();
    go(player, 'hata-ayiklama');
    expect(el.querySelectorAll('.flow-node')).toHaveLength(8);
    expect(current(el)).toBeUndefined();
    expect(el.querySelectorAll('circle.flow-token')).toHaveLength(0);
  });

  it('reduced motion puts the token on its node at once', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    const { el, player } = setup();
    go(player, 'veri-anlama');
    const node = el.querySelector('.flow-node[data-node="va"]')!.getAttribute('transform');
    expect(el.querySelector('circle.flow-token')!.getAttribute('transform')).toBe(node);
    // a sweep step lands on its last value when entered
    go(player, 'veri-yeterli', false);
    expect(player.state.params.scan).toBe(4);
    expect(current(el)).toBe('d1');
  });

  it('the Lab path writes the reason beside the sending node', () => {
    const { el, player } = setup(745, 530, 'lab');
    go(player, 'veri-yeterli');
    player.setParams({ days: 14 });
    const r = el.querySelector('.path-reason')!;
    expect(r.textContent).toBe('Veri yeterli mi? Hayır: sınav günü 0 < 5');
    expect(r.getAttribute('data-node')).toBe('d1');
    expect(current(el)).toBe('d1');
    player.setParams({ days: 56, missing: 'cikar', stock: 'satis' });
    expect(el.querySelector('.path-reason')!.textContent).toMatch(/^Sonuç uygun mu\? Hayır: kaçan talep %[\d,]+ > %3$/);
    expect(el.querySelector('.path-reason')!.getAttribute('data-node')).toBe('d2');
    player.setParams({ stock: 'soran' });
    expect(el.querySelector('.path-reason')).toBeNull();
  });

  it('Ders draws no reason line', () => {
    const { el, player } = setup();
    go(player, 'degerlendirme');
    expect(el.querySelector('.path-reason')).toBeNull();
  });
});
