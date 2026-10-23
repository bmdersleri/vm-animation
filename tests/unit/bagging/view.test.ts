import { describe, it, expect } from 'vitest';
import { baggingScenario, rootLabel } from '../../../src/concepts/bagging/scenario';
import { deriveBaggingView, drawsFor } from '../../../src/concepts/bagging/view';
import { BOOK_BOOT, BOOTS, EXPERIMENT, PICKS } from '../../../src/concepts/topluluk/data';
import { oobChance } from '../../../src/concepts/topluluk/math';

const d = baggingScenario.defaults;
const at = (id: string, patch: Partial<typeof d> = {}) =>
  deriveBaggingView(
    baggingScenario.steps.findIndex((s) => s.id === id),
    { ...d, ...patch },
  );

describe('deriveBaggingView', () => {
  it('book draw gives counts 3, 2, 2 and oob 1 3 5 9', () => {
    const v = at('oob').bag!;
    expect(v.sample).toEqual([0, 7, 6, 4, 4, 8, 0, 6, 2, 0]);
    expect(v.counts).toEqual(BOOK_BOOT.counts);
    expect(v.badges).toEqual([
      { id: 0, count: 3 },
      { id: 4, count: 2 },
      { id: 6, count: 2 },
    ]);
    expect(v.oob).toEqual([1, 3, 5, 9]);
  });

  it('oob chance strip at n 10', () => {
    expect(at('oob').strip).toBe('OOB = 4 / 10 = %40,0');
    const v = at('yuzde');
    expect(v.strip).toContain('(1 − 1/10)^10 = 0,349');
    expect(v.strip).toContain('1/e = 0,368');
    expect(v.curve!.marker).toMatchObject({ x: 10, y: oobChance(10) });
    expect(v.curve!.series[0].pts).toHaveLength(100);
    expect(v.bag).toBeNull();
  });

  it('the sweep shows only the draws played so far and names no OOB yet', () => {
    const v = at('cekilis', { shown: 3 }).bag!;
    expect(v.counts).toEqual([1, 0, 0, 0, 0, 0, 1, 1, 0, 0]);
    expect(v.oob).toEqual([]);
    expect(v.badges).toEqual([]);
    expect(at('cekilis', { shown: 3 }).strip).toContain('[0 7 6] · 3 / 10 çekiliş');
    expect(at('torba', { shown: 0 }).bag!.counts.every((c) => c === 0)).toBe(true);
  });

  it('Lab draws are seeded and keep n cards', () => {
    expect(drawsFor(10, 0)).toEqual(BOOK_BOOT.sample);
    expect(drawsFor(10, 5)).toEqual(drawsFor(10, 5));
    expect(drawsFor(14, 0)).toHaveLength(14);
    expect(at('oob', { n: 14, draw: 3 }).bag!.ids).toHaveLength(14);
  });

  it('region and chart steps carry their data', () => {
    expect(at('tek-agac').regions!.layout).toBe('single');
    const panels = at('uc-agac').regions!;
    expect(panels.trees).toEqual([0, 1, 2]);
    expect(panels.titles).toEqual([0, 1, 2].map((i) => rootLabel(BOOTS[i].tree)));
    const vote = at('oylama').regions!;
    expect(vote.pick).toMatchObject({ index: PICKS.vote, m: 50, verdict: 'Ayrıldı' });
    expect(at('oylama', { trees: 7 }).strip).toContain('7 ağaçtan');
    expect(at('oylama', { pick: null }).regions!.pick).toBeNull();
    const maj = at('cogunluk').charts!;
    expect(maj.kind).toBe('majority');
    expect(maj.majority.marker!.label).toContain('0,896');
    expect(at('deney').charts!.experiment[0].values).toEqual(EXPERIMENT.tree);
    expect(at('sinir').links.map((l) => l.href)).toEqual(['../random-forest/', '../karar-agaci/']);
  });
});
