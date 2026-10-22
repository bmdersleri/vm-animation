// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { mountAprioriScene } from '../../../src/concepts/apriori/scene';
import { aprioriScenario, type AprioriParams } from '../../../src/concepts/apriori/scenario';
import { layoutLattice } from '../../../src/concepts/apriori/scene-lattice';
import { LATTICE, counters, paintLattice } from '../../../src/concepts/apriori/view';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

const setup = (reduce = true, width = 1280, height = 440) => {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: reduce && q.includes('reduce'), media: q }));
  const player = new StepPlayer<AprioriParams>(aprioriScenario);
  const host = document.createElement('div');
  document.body.append(host);
  const scene = mountAprioriScene(host, player, 'ders');
  scene.resize(width, height);
  return { player, host, scene };
};
const fin = (scene: { destroy(): void }, player: StepPlayer<AprioriParams>) => { scene.destroy(); player.destroy(); };
const node = (host: HTMLElement, abbr: string) => host.querySelector<HTMLElement>(`.ap-node[data-abbr="${abbr}"]`)!;
const inState = (host: HTMLElement, state: string) => host.querySelectorAll(`.ap-node[data-state="${state}"]`).length;
const counter = (host: HTMLElement, name: string) => host.querySelector(`[data-counter="${name}"]`)!.textContent;
const STEP = Object.fromEntries(aprioriScenario.steps.map((s, i) => [s.id, i]));

describe('apriori lattice scene', () => {
  it('63 nodes in rows of 6, 15, 20, 15, 6, 1', () => {
    const { host, scene, player } = setup();
    expect(host.querySelectorAll('.ap-node')).toHaveLength(63);
    expect([1, 2, 3, 4, 5, 6].map((k) => host.querySelectorAll(`.ap-node[data-level="${k}"]`).length)).toEqual([6, 15, 20, 15, 6, 1]);
    expect(LATTICE.filter((n) => n.k === 3)).toHaveLength(20);
    // step 1: nothing looked at yet
    expect(inState(host, 'unseen')).toBe(63);
    expect(counter(host, 'counted')).toBe('sayılan aday: 0 / 63');
    expect(host.querySelector('.ap-threshold')!.textContent).toBe('min_support 0,2 → en az 4 fiş');
    fin(scene, player);
  });

  it('step 2 counts the six single products and finds Reçel infrequent', () => {
    const { host, scene, player } = setup();
    player.goto(STEP.seviye1);
    expect(inState(host, 'frequent')).toBe(5);
    expect(node(host, 'R').dataset.state).toBe('infrequent');
    expect(node(host, 'R').dataset.count).toBe('3');
    expect(node(host, 'S').dataset.count).toBe('12');
    fin(scene, player);
  });

  it('the scan of step 2 counts candidate by candidate and stops on the final state', () => {
    vi.useFakeTimers();
    const { host, scene, player } = setup(false);
    player.goto(STEP.seviye1);
    expect(host.querySelectorAll('.ap-node[data-state="candidate"]')).toHaveLength(1);
    expect(node(host, 'E').dataset.state).toBe('candidate');
    expect(counter(host, 'counted')).toBe('sayılan aday: 0 / 63');
    vi.advanceTimersByTime(260);
    expect(node(host, 'E').dataset.state).toBe('frequent');
    expect(node(host, 'S').dataset.state).toBe('candidate');
    expect(counter(host, 'counted')).toBe('sayılan aday: 1 / 63');
    // play/pause re-emit the same step: the scan does not restart
    player.play();
    player.pause();
    expect(node(host, 'E').dataset.state).toBe('frequent');
    vi.advanceTimersByTime(260 * 10);
    expect(inState(host, 'candidate')).toBe(0);
    expect(counter(host, 'counted')).toBe('sayılan aday: 6 / 63');
    fin(scene, player);
  });

  it('step 3 marks the 31 recel supersets as pruned', () => {
    const { host, scene, player } = setup();
    player.goto(STEP.ozellik);
    const pruned = [...host.querySelectorAll<HTMLElement>('.ap-node[data-state="pruned"]')];
    expect(pruned).toHaveLength(31);
    expect(pruned.every((n) => n.dataset.abbr!.includes('R') && n.dataset.abbr !== 'R')).toBe(true);
    expect(host.querySelector('.ap-notes')!.textContent).toContain('Reçel sık değil (3 < 4): içeren 31 küme budandı');
    expect(counter(host, 'counted')).toBe('sayılan aday: 6 / 63');
    fin(scene, player);
  });

  it('step 4 counts the ten pairs: six frequent', () => {
    const { host, scene, player } = setup();
    player.goto(STEP.seviye2);
    expect(node(host, 'ES').dataset.count).toBe('7');
    expect(node(host, 'ES').dataset.state).toBe('frequent');
    expect(node(host, 'YT').dataset.state).toBe('infrequent');
    expect(host.querySelectorAll('.ap-node[data-level="2"][data-state="frequent"]')).toHaveLength(6);
    expect(counter(host, 'counted')).toBe('sayılan aday: 16 / 63');
    fin(scene, player);
  });

  it('step 5 shows EST pruned by ST', () => {
    const { host, scene, player } = setup();
    player.goto(STEP.budama);
    const est = node(host, 'EST');
    expect(est.dataset.state).toBe('pruned');
    expect(est.dataset.prunedBy).toBe('ST');
    expect(est.querySelector('.ap-sub')!.textContent).toBe('⊘ST');
    expect(est.dataset.count).toBe('');
    expect(host.querySelector('.ap-notes')!.textContent).toContain('EST budandı: ST sık değil (3 < 4)');
    expect(node(host, 'ESY').dataset.state).toBe('frequent');
    expect(node(host, 'ESY').dataset.count).toBe('5');
    expect(node(host, 'SYP').dataset.state).toBe('infrequent');
    expect(node(host, 'SYP').dataset.count).toBe('3');
    fin(scene, player);
  });

  it('step 6 counters read 18 of 63 and 12 frequent', () => {
    const { host, scene, player } = setup();
    player.goto(STEP.dur);
    expect(counter(host, 'counted')).toBe('sayılan aday: 18 / 63');
    expect(counter(host, 'frequent')).toBe('sık küme: 12');
    expect(inState(host, 'unseen')).toBe(0);
    expect(host.textContent).not.toMatch(/NaN|Infinity|undefined/);
    fin(scene, player);
  });

  it('step 7 repaints the lattice at every sweep stop', () => {
    vi.useFakeTimers();
    const { host, scene, player } = setup();
    player.goto(STEP.esik);
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      seen.push(`${host.querySelector('.ap-threshold')!.textContent}|${counter(host, 'frequent')}`);
      vi.advanceTimersByTime(1800);
    }
    expect(seen).toEqual([
      'min_support 0,5 → en az 9 fiş|sık küme: 4',
      'min_support 0,3 → en az 6 fiş|sık küme: 7',
      'min_support 0,2 → en az 4 fiş|sık küme: 12',
      'min_support 0,15 → en az 3 fiş|sık küme: 16',
    ]);
    fin(scene, player);
  });

  it('steps 8-11 give the lattice place to the FP-tree slot', () => {
    const { host, scene, player } = setup();
    const root = host.querySelector<HTMLElement>('.ap-scene')!;
    expect(root.dataset.view).toBe('lattice');
    player.goto(STEP['fp-sira']);
    expect(root.dataset.view).toBe('fptree');
    expect(host.querySelector('[data-slot="fptree"]')).not.toBeNull();
    fin(scene, player);
  });

  it('level 3 row fits 1280 px without overlap', () => {
    const layout = layoutLattice(1280, 440);
    const row = layout.boxes.filter((b) => b.k === 3);
    expect(row).toHaveLength(20);
    expect(new Set(row.map((b) => b.y)).size).toBe(1);
    const sorted = [...row].sort((a, b) => a.x - b.x);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].x).toBeGreaterThanOrEqual(sorted[i - 1].x + sorted[i - 1].w);
    expect(sorted[0].x).toBeGreaterThanOrEqual(0);
    expect(sorted[19].x + sorted[19].w).toBeLessThanOrEqual(1280);
    for (const b of layout.boxes) {
      for (const o of layout.boxes) {
        if (b === o) continue;
        const apart = b.x + b.w <= o.x || o.x + o.w <= b.x || b.y + b.h <= o.y || o.y + o.h <= b.y;
        expect(apart, `${b.key} / ${o.key}`).toBe(true);
      }
      expect(b.y + b.h).toBeLessThanOrEqual(440);
    }
  });

  it('narrow widths wrap a row instead of overlapping', () => {
    const layout = layoutLattice(390, 340);
    expect(layout.boxes).toHaveLength(63);
    for (const b of layout.boxes) {
      expect(b.x + b.w).toBeLessThanOrEqual(390);
      for (const o of layout.boxes) {
        if (b === o) continue;
        expect(b.x + b.w <= o.x || o.x + o.w <= b.x || b.y + b.h <= o.y || o.y + o.h <= b.y).toBe(true);
      }
    }
    expect(layout.height).toBeGreaterThanOrEqual(340);
  });

  it('the pure paint function agrees with the scene counters', () => {
    const p = paintLattice({ minCount: 4, level: 6, pruneSingles: true, scan: null });
    expect(counters(p)).toEqual({ counted: 18, frequent: 12 });
  });

  it('no product name carries a suffix in the scene text, at every step', () => {
    const { host, scene, player } = setup();
    const bad = /(Ekmek|Süt|Yumurta|Tereyağı|Peynir|Reçel)(['’]|\p{L})/u;
    for (let i = 0; i < aprioriScenario.steps.length; i++) {
      player.goto(i);
      // Joined with spaces: adjacent elements ("Ekmek" then "S Süt") are not one word.
      const words = [...host.querySelectorAll('*')].filter((e) => e.children.length === 0).map((e) => e.textContent).join(' ');
      expect(words).not.toMatch(bad);
    }
    fin(scene, player);
  });
});
