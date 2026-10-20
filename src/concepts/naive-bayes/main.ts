import '../../core/theme.css';
import './naive-bayes.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import type { StepPlayer } from '../../core/player';
import { nbScenario, nbShortcuts, type NbParams } from './scenario';
import { mountNbScene } from './scene';
import type { QueryPointer } from './scene-gauss';
import { mountNbParams } from './controls';
import { mountNbExtra } from './extra';

/** Steps where the new customer can be dragged: gauss, yeni-musteri, sinir (indices 10-12, part 3). */
const FIRST_DRAG_STEP = 10;
const LAST_DRAG_STEP = 12;

/**
 * Lab drag of the new customer: the scene already clamps `t` and `c`, so the
 * callback only forwards them as the `query` override. `isLab` is read at
 * event time because the mode can change while the page is open.
 */
export function createNbPointer(p: StepPlayer<NbParams>, isLab: () => boolean): QueryPointer {
  return (q, kind) => {
    const index = p.state.index;
    if (kind === 'up' || !isLab() || index < FIRST_DRAG_STEP || index > LAST_DRAG_STEP) return;
    p.setParam('query', { t: q.t, c: q.c });
  };
}

export const naiveBayesPage: ConceptPage<NbParams> = {
  title: 'Naive Bayes',
  chapter: 'Bölüm 5 · Sınıflandırmaya Giriş',
  scenario: nbScenario,
  mountScene: (el, player, mode) => {
    const h = mountNbScene(el, player, mode);
    const isLab = (): boolean => el.closest<HTMLElement>('[data-mode]')?.dataset.mode === 'lab';
    h.onPointer(createNbPointer(player, isLab));
    return h;
  },
  mountParams: mountNbParams,
  mountExplainExtra: mountNbExtra,
  shortcuts: nbShortcuts,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, naiveBayesPage);
