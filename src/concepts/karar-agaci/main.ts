import '../../core/theme.css';
import './karar-agaci.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import type { StepPlayer } from '../../core/player';
import { treeScenario, treeShortcuts, type TreeParams } from './scenario';
import { mountTreeScene, type PointerKind } from './scene';
import { mountTreeParams } from './controls';
import { mountTreeExtra } from './extra';
import { train } from './data';

/** Steps where the threshold can be dragged: dagilim, tarama, esik. */
const FIRST_DRAG_STEP = 6;
const LAST_DRAG_STEP = 8;

const RANGE: [[number, number], [number, number]] = [
  [Math.min(...train.map((r) => r.t)), Math.max(...train.map((r) => r.t))],
  [Math.min(...train.map((r) => r.c)), Math.max(...train.map((r) => r.c))],
];

/**
 * Lab drag of a threshold line. Only a press that grabbed a line (`near`)
 * starts a drag; moves keep the dragged feature and clamp the threshold to
 * that feature's training range; 'up' keeps the last value. `isLab` is read
 * at event time because the mode can change while the page is open.
 */
export function createTreePointer(
  p: StepPlayer<TreeParams>, isLab: () => boolean,
): (at: { x: number; y: number }, kind: PointerKind, near: 0 | 1 | null) => void {
  let feature: 0 | 1 | null = null;
  const value = (at: { x: number; y: number }, f: 0 | 1): number => {
    const [lo, hi] = RANGE[f];
    return Math.max(lo, Math.min(hi, f === 0 ? at.x : at.y));
  };
  return (at, kind, near) => {
    const index = p.state.index;
    if (!isLab() || index < FIRST_DRAG_STEP || index > LAST_DRAG_STEP) {
      feature = null;
      return;
    }
    if (kind === 'down') {
      feature = near;
      if (near === null) return;
      p.setParams({ userSplit: { feature: near, threshold: value(at, near) }, scan: -1 });
    } else if (kind === 'move') {
      if (feature === null) return;
      p.setParams({ userSplit: { feature, threshold: value(at, feature) } });
    } else {
      feature = null;
    }
  };
}

export const kararAgaciPage: ConceptPage<TreeParams> = {
  title: 'Karar Ağacı',
  chapter: 'Bölüm 5 · Sınıflandırmaya Giriş',
  scenario: treeScenario,
  mountScene: (el, player, mode) => {
    const h = mountTreeScene(el, player, mode);
    const isLab = (): boolean => el.closest<HTMLElement>('[data-mode]')?.dataset.mode === 'lab';
    h.onPointer(createTreePointer(player, isLab));
    return h;
  },
  mountParams: mountTreeParams,
  mountExplainExtra: mountTreeExtra,
  shortcuts: treeShortcuts,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, kararAgaciPage);
