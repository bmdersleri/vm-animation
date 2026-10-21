import '../../core/theme.css';
import './olcekleme.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import type { StepPlayer } from '../../core/player';
import { olceklemeScenario, olcShortcuts, SCATTER_STEPS, type OlcParams } from './scenario';
import { mountOlcScene } from './scene';
import type { QueryPointer } from './scene-scatter';
import { mountOlcParams } from './controls';
import { mountOlcExtra } from './extra';

/**
 * Lab drag of the new customer: the scene already clamps to the data box, so
 * the callback only forwards it as the `query` override. `isLab` is read at
 * event time because the mode can change while the page is open. `up` keeps
 * the last value.
 */
export function createOlcPointer(p: StepPlayer<OlcParams>, isLab: () => boolean): QueryPointer {
  return (q, kind) => {
    if (kind === 'up' || !isLab() || !SCATTER_STEPS.includes(p.state.index)) return;
    p.setParam('query', { t: q.t, f: q.f });
  };
}

export const olceklemePage: ConceptPage<OlcParams> = {
  title: 'Ölçekleme ve veri sızıntısı',
  chapter: 'Bölüm 3 · Veri Ön İşleme',
  scenario: olceklemeScenario,
  mountScene: (el, player, mode) => {
    const h = mountOlcScene(el, player, mode);
    const isLab = (): boolean => el.closest<HTMLElement>('[data-mode]')?.dataset.mode === 'lab';
    h.onPointer(createOlcPointer(player, isLab));
    return h;
  },
  mountParams: mountOlcParams,
  mountExplainExtra: mountOlcExtra,
  shortcuts: olcShortcuts,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, olceklemePage);
