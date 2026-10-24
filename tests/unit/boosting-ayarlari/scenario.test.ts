import { describe, it, expect } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { CURVES, SURFACE } from '../../../src/concepts/boosting/data';
import { earlyStop } from '../../../src/concepts/boosting/boost';
import { boostingAyarlariScenario as sc } from '../../../src/concepts/boosting-ayarlari/scenario';
import { formatNumber as f } from '../../../src/core/plot/format';

const step = (id: string) => sc.steps.find((s) => s.id === id)!;
const curve = (lr: number) => CURVES.byLr.find((c) => c.lr === lr)!;

describe('boosting-ayarlari scenario', () => {
  it('step ids follow the spec', () => {
    expect(sc.steps.map((s) => s.id)).toEqual([
      'lr-deney',
      'egriler',
      'agac-ekle',
      'ezber',
      'erken-durdurma',
      'seviye',
      'yaprak',
      'yaprak-siniri',
      'izgara',
      'sirali-arama',
    ]);
    expect(sc.defaults).toEqual({
      lr: 0.3,
      trees: 150,
      patience: 50,
      depth: 2,
      leaves: 4,
      budget: 8,
      trial: 8,
      seed: 0,
      showSurface: false,
    });
    expect(step('egriler').sweep!.key).toBe('trees');
    expect(step('egriler').sweep!.values).toHaveLength(150);
    expect(step('yaprak-siniri').sweep!.key).toBe('leaves');
    expect(step('yaprak-siniri').sweep!.values).toEqual(Array.from({ length: 61 }, (_, i) => i + 4));
    expect(step('izgara').sweep!.key).toBe('trial');
    expect(step('izgara').sweep!.values).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(step('sirali-arama').sweep!.values).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('lr and trees follow the steps', () => {
    const player = new StepPlayer(sc);
    const at = (id: string) => {
      player.goto(sc.steps.findIndex((s) => s.id === id));
      return { lr: player.state.params.lr, trees: player.state.params.trees };
    };
    expect(at('agac-ekle')).toEqual({ lr: 0.01, trees: 500 });
    expect(at('ezber')).toEqual({ lr: 1, trees: 500 });
    expect(at('erken-durdurma')).toEqual({ lr: 0.3, trees: 500 });
    player.destroy();
  });

  it('step texts read their numbers from the data', () => {
    // step 1: the five AUC values at 150 trees
    const aucs = [0.01, 0.05, 0.1, 0.3, 0.5].map((lr) => f(curve(lr).valAuc[149], 3));
    expect(aucs).toEqual(['0,930', '0,964', '0,969', '0,970', '0,963']);
    expect(step('lr-deney').text).toContain(aucs.join(' → '));
    // step 3: AUC at 150 and at 500 trees
    expect(step('agac-ekle').text).toContain(f(curve(0.01).valAuc[149], 3));
    expect(step('agac-ekle').text).toContain(f(curve(0.01).valAuc[499], 3));
    expect(step('agac-ekle').text).toContain('0,959');
    // step 5: best and stop tree
    const es = earlyStop(curve(0.3).valLoss, 50);
    expect([es.best, es.stop]).toEqual([91, 141]);
    expect(es).toEqual({ best: 91, stop: 141 });
    expect(step('erken-durdurma').text).toContain(`${es.best}. ağaçta en düşük`);
    expect(step('erken-durdurma').text).toContain(`${es.stop}. ağaçta dur`);
    // step 7: three thresholds and two errors
    expect(step('yaprak').text).toContain('2,651');
    expect(step('yaprak').text).toContain('6,372');
    expect(step('yaprak').text).toContain('9,021');
    expect(step('yaprak').text).toContain('0,113');
    expect(step('seviye').text).toContain('0,162');
    expect(step('seviye').text).toContain('0,616');
    // step 10 reads the surface
    expect(SURFACE.auc.flat()).toHaveLength(54);
    expect(step('sirali-arama').text).toContain('54 hücrenin');
    // the sequential best (0,957) beats the grid best (0,951); each best cell is named once
    const t10 = step('sirali-arama').text;
    expect(t10).toContain('Izgara en iyisi: derinlik 5, ν = 0,316, AUC 0,951 · Sıralı en iyisi: derinlik 5, ν = 1,0, AUC 0,957 → sıralı arama daha yüksek AUC buldu');
    expect(t10.match(/AUC 0,957/g)).toHaveLength(1);
    for (const s of sc.steps) {
      expect(s.text).not.toMatch(/NaN|undefined|Infinity/);
    }
  });

  it('no Turkish apostrophe suffix follows a computed number', () => {
    const texts = sc.steps.map((s) => s.text).join(' ');
    expect(texts).not.toMatch(/[\d²³]'(de|da|den|dan|e|a|ye|ya|in|ın|nin|nın|si|sı|sini|sını|yi|yı|i|ı|te|ta)/);
  });
});
