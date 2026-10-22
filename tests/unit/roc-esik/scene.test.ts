// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { rocScenario } from '../../../src/concepts/roc-esik/scenario';
import { mountRocScene } from '../../../src/concepts/roc-esik/scene';

afterEach(() => { document.body.replaceChildren(); });

describe('roc scene metric row', () => {
  it('step 3 shows precision and recall', () => {
    const player = new StepPlayer(rocScenario); const host = document.createElement('div');
    const scene = mountRocScene(host, player, 'ders');
    const row = host.querySelector<HTMLElement>('.roc-metrics')!;
    player.goto(1); expect(row.hidden).toBe(true);
    player.goto(2); expect(row.hidden).toBe(false);
    expect(host.querySelector('[data-precision]')?.textContent).toMatch(/Precision .*Recall /);
    expect(host.querySelector('.roc-note')?.textContent).toMatch(/Recall.*Precision/);
    scene.destroy(); player.destroy();
  });
});
