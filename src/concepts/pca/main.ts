import '../../core/theme.css';
import './pca.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import type { StepPlayer } from '../../core/player';
import { pcaScenario, pcaShortcuts, THETA_STEPS, type PcaParams } from './scenario';
import { mountPcaScene } from './scene';
import type { ThetaPointer } from './scene-scatter';
import { mountPcaParams } from './controls';
import { mountPcaExtra } from './extra';

/**
 * Lab drag of the PC direction: the scene already wraps the angle, so the
 * callback forwards it as the `theta` override. `isLab` is read at event time
 * because the mode can change while the page is open. The scatter layer also
 * reports plain pointer moves, so only moves of a drag that started with a
 * `down` count; `up` keeps the last value.
 */
export function createPcaPointer(p: StepPlayer<PcaParams>, isLab: () => boolean): ThetaPointer {
  let dragging = false;
  return (deg, kind) => {
    if (kind === 'up') {
      dragging = false;
      return;
    }
    if (!isLab() || !THETA_STEPS.includes(p.state.index)) return;
    if (kind === 'down') dragging = true;
    else if (!dragging) return;
    p.setParam('theta', deg);
  };
}

const pcaPage: ConceptPage<PcaParams> = {
  title: 'PCA ve t-SNE ile boyut indirgeme',
  chapter: 'Bölüm 4 · Boyut İndirgeme',
  scenario: pcaScenario,
  mountScene: (el, player, mode) => {
    const h = mountPcaScene(el, player, mode);
    const isLab = (): boolean => el.closest<HTMLElement>('[data-mode]')?.dataset.mode === 'lab';
    h.onPointer(createPcaPointer(player, isLab));
    return h;
  },
  mountParams: mountPcaParams,
  mountExplainExtra: mountPcaExtra,
  shortcuts: pcaShortcuts,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, pcaPage);
