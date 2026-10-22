// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { mountAprioriScene } from '../../../src/concepts/apriori/scene';
import { aprioriScenario, type AprioriParams } from '../../../src/concepts/apriori/scenario';
import { layoutFpTree } from '../../../src/concepts/apriori/scene-fptree';
import { fpFor } from '../../../src/concepts/apriori/view';
import { sepetData } from '../../../src/concepts/birliktelik/data';
import { itemName } from '../../../src/concepts/birliktelik/format';
import type { Node } from '../../../src/concepts/birliktelik/fptree';

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
const STEP = Object.fromEntries(aprioriScenario.steps.map((s, i) => [s.id, i]));
const shown = (host: HTMLElement) => [...host.querySelectorAll<HTMLElement>('.ap-fp-node:not([hidden])')];
const nodeAt = (host: HTMLElement, id: string) => host.querySelector<HTMLElement>(`.ap-fp-node[data-id="${id}"]`)!;
const flat = (n: Node): Node[] => n.children.flatMap((c) => [c, ...flat(c)]);
const label = (n: Node) => `${itemName(n.item as string)}:${n.count}`;
const apart = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;

describe('apriori FP-tree scene', () => {
  it("inserting all 18 baskets yields the tree's node counts", () => {
    const { host, scene, player } = setup();
    player.goto(STEP['fp-agac']);
    // reduced motion: the finished tree is there at once
    expect(player.state.params.inserted).toBe(18);
    const want = flat(fpFor(4).snapshots[18]);
    const ons = shown(host).filter((e) => e.dataset.id !== 'root');
    expect(ons).toHaveLength(want.length);
    for (const n of want) expect(nodeAt(host, n.id).textContent).toBe(label(n));
    expect(nodeAt(host, 'root>sut').textContent).toBe('Süt:12');
    expect(host.querySelector('.ap-fp-count')!.textContent).toBe(`18 fiş, ${want.length} düğüm`);
    // header table: frequency order, the dropped product last
    const rows = [...host.querySelectorAll<HTMLElement>('.ap-fp-header tbody tr')].map((r) => r.textContent);
    expect(rows).toEqual(['Süt12', 'Ekmek11', 'Yumurta10', 'Tereyağı7', 'Peynir5', 'Reçel3 (atıldı)']);
    fin(scene, player);
  });

  it('a partial tree shows only the nodes inserted so far, at the same places', () => {
    const { host, scene, player } = setup();
    player.goto(STEP['fp-agac']);
    const where = nodeAt(host, 'root>sut').style.left;
    player.setParams({ inserted: 1 });
    expect(shown(host).filter((e) => e.dataset.id !== 'root')).toHaveLength(fpFor(4).filtered[0].length);
    expect(nodeAt(host, 'root>sut').style.left).toBe(where);
    player.setParams({ inserted: 0 });
    expect(shown(host).map((e) => e.dataset.id)).toEqual(['root']);
    fin(scene, player);
  });

  it("the inserted basket's path is highlighted", () => {
    const { host, scene, player } = setup();
    player.goto(STEP['fp-agac']);
    player.setParams({ inserted: 5 });
    let id = 'root';
    const path = fpFor(4).filtered[4].map((item) => (id = `${id}>${item}`));
    const lit = [...host.querySelectorAll<HTMLElement>('.ap-fp-node[data-hl="true"]')].map((e) => e.dataset.id);
    expect(lit).toEqual(path);
    expect(host.querySelectorAll('.ap-fp-edge[data-hl="true"]')).toHaveLength(path.length);
    expect(host.querySelector('.ap-fp-note')!.textContent).toContain('Fiş 5:');
    fin(scene, player);
  });

  it('the aside writes the baskets in product order', () => {
    const { host, scene, player } = setup();
    player.goto(STEP['fp-agac']);
    player.setParams({ inserted: 4 });
    expect(host.querySelector('.ap-fp-note')!.textContent).toMatch(/^Fiş 4: Ekmek, Süt, Yumurta, Tereyağı → /);
    player.setParams({ inserted: 11 });
    expect(host.querySelector('.ap-fp-note')!.textContent).toMatch(/^Fiş 11: Ekmek, Süt, Tereyağı → /);
    fin(scene, player);
  });

  it('the insertion sweep runs basket by basket, and is skipped under reduced motion', () => {
    vi.useFakeTimers();
    const slow = setup(false);
    slow.player.goto(STEP['fp-agac']);
    expect(slow.player.state.params.inserted).toBe(1);
    // play/pause re-emit the same step: no restart
    slow.player.play();
    slow.player.pause();
    vi.advanceTimersByTime(350 * 3);
    expect(slow.player.state.params.inserted).toBe(4);
    vi.advanceTimersByTime(350 * 30);
    expect(slow.player.state.params.inserted).toBe(18);
    fin(slow.scene, slow.player);
    document.body.replaceChildren();
    const fast = setup(true);
    fast.player.goto(STEP['fp-agac']);
    expect(fast.player.state.params.inserted).toBe(18);
    fin(fast.scene, fast.player);
  });

  it('peynir conditional base lists its prefix paths', () => {
    const { host, scene, player } = setup();
    player.goto(STEP.kosullu);
    const paths = [...host.querySelectorAll('.ap-base-path')].map((e) => e.textContent as string);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.reduce((s, t) => s + Number(t.split(': ')[1]), 0)).toBe(5);
    for (const t of paths) expect(t).not.toContain('Peynir');
    const sets = [...host.querySelectorAll('.ap-base-set')].map((e) => e.textContent as string);
    expect(sets).toContain('{Süt, Peynir} 4 ≥ 4 sık');
    expect(sets).toContain('{Yumurta, Peynir} 4 ≥ 4 sık');
    expect(sets.some((t) => t.startsWith('{Süt, Yumurta, Peynir} 3 < 4'))).toBe(true);
    // the Peynir nodes are marked in the tree and the header table
    const marked = [...host.querySelectorAll<HTMLElement>('.ap-fp-node[data-base="true"]')];
    expect(marked.length).toBeGreaterThan(0);
    for (const m of marked) expect(m.textContent).toMatch(/^Peynir:/);
    expect(host.querySelector<HTMLElement>('.ap-fp-header tr[data-base="true"]')!.dataset.item).toBe('peynir');
    // another product, then one that is not in the tree
    player.setParams({ baseItem: 'tereyagi' });
    expect(host.querySelector('.ap-base-title')!.textContent).toBe('Tereyağı için koşullu taban');
    player.setParams({ baseItem: 'recel' });
    expect(host.querySelector('.ap-base-none')!.textContent).toBe('Reçel bu eşikte sık değil, ağaçta yok.');
    fin(scene, player);
  });

  it('the comparison lists the same 12 sets for both algorithms', () => {
    const { host, scene, player } = setup();
    player.goto(STEP.karsilastir);
    const lists = [...host.querySelectorAll('.ap-compare-list')].map((l) => [...l.querySelectorAll('.ap-set')].map((e) => e.textContent));
    expect(lists[0]).toHaveLength(12);
    expect(lists[1]).toEqual(lists[0]);
    expect(host.querySelector('.ap-compare-verdict')!.textContent).toBe('Aynı 12 sık küme.');
    const rows = [...host.querySelectorAll('.ap-compare-table tbody tr')].map((r) => r.textContent);
    expect(rows).toContain('Veri tarama sayısı32');
    expect(rows).toContain('Aday üretimivaryok');
    expect(rows).toContain('Süre (kitap)0,75 ms0,49 ms');
    expect([...host.querySelectorAll('.ap-code-line')].map((e) => e.textContent)).toEqual([
      'apriori(islemMatrisi, min_support=0.2, use_colnames=True)',
      'fpgrowth(islemMatrisi, min_support=0.2, use_colnames=True)',
    ]);
    fin(scene, player);
  });

  it('no two tree nodes overlap at 1280 px, at any threshold', () => {
    for (let minCount = 1; minCount <= 18; minCount++) {
      const { boxes } = layoutFpTree(fpFor(minCount).snapshots[18], 1280 - 230 - 168, 380);
      for (let i = 0; i < boxes.length; i++) {
        expect(boxes[i].x).toBeGreaterThanOrEqual(0);
        for (let j = i + 1; j < boxes.length; j++) expect(apart(boxes[i], boxes[j]), `minCount ${minCount}: ${boxes[i].id} / ${boxes[j].id}`).toBe(true);
      }
    }
  });

  it("the scene's tree boxes do not overlap either", () => {
    const { host, scene, player } = setup();
    player.goto(STEP['fp-agac']);
    player.setParams({ minCount: 1 });
    const boxes = shown(host).map((e) => ({ x: parseInt(e.style.left, 10), y: parseInt(e.style.top, 10), w: parseInt(e.style.width, 10), h: parseInt(e.style.height, 10) }));
    expect(boxes.length).toBeGreaterThan(10);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(apart(boxes[i], boxes[j])).toBe(true);
    fin(scene, player);
  });

  it('a threshold that leaves no frequent set says so, in the lattice and the tree', () => {
    const { host, scene, player } = setup();
    const empty = () => host.querySelector<HTMLElement>('.ap-empty')!;
    player.goto(STEP.dur);
    expect(empty().hidden).toBe(true);
    player.setParams({ minCount: 18 });
    expect(empty().hidden).toBe(false);
    expect(empty().textContent).toBe('Bu eşikte sık küme yok.');
    player.goto(STEP['fp-agac']);
    expect(empty().hidden).toBe(false);
    expect(shown(host).map((e) => e.dataset.id)).toEqual(['root']);
    expect(host.textContent).not.toMatch(/NaN|undefined|Infinity/);
    fin(scene, player);
  });

  it('no product name carries a suffix in the FP-tree texts', () => {
    const { host, scene, player } = setup();
    const bad = /(Ekmek|Süt|Yumurta|Tereyağı|Peynir|Reçel)(['’]|\p{L})/u;
    for (const id of ['fp-sira', 'fp-agac', 'kosullu', 'karsilastir']) {
      player.goto(STEP[id]);
      for (const item of sepetData.items) {
        player.setParams({ baseItem: item });
        const words = [...host.querySelectorAll('*')].filter((e) => e.children.length === 0).map((e) => e.textContent).join(' ');
        expect(words, `${id}/${item}`).not.toMatch(bad);
      }
    }
    fin(scene, player);
  });
});
