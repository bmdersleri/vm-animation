import '../../core/theme.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import type { StepPlayer } from '../../core/player';
import type { RawPoint } from './data';
import type { Vec } from './knn';
import { knnScenario, knnShortcuts, type KnnParams } from './scenario';
import { mountKnnScene, type PointerKind } from './scene';
import { featureSpace, type FeatureSpace } from './space';
import { mountKnnParams } from './controls';
import { mountKnnTable } from './table';

const clamp = (v: number, [lo, hi]: [number, number]): number => Math.max(lo, Math.min(hi, v));

/** Keep a point (in feature-space units) inside the data domain. */
export function clampToDomain(v: Vec, domain: FeatureSpace['domain']): Vec {
  return { x: clamp(v.x, domain.x), y: clamp(v.y, domain.y) };
}

/** Index of step 5 (vote and prediction): the step a live drag runs at. */
const VOTE_STEP = 4;

/**
 * Lab click / drag on the plot. The scene reports hover moves without a
 * prior 'down' and may report 'up' at bogus coordinates (pointercancel), so
 * the drag state lives here: only moves between 'down' and 'up' count, and
 * 'up' never moves the query. `isLab` is read at event time because the mode
 * can change while the page is open.
 */
export function createLabPointer(
  p: StepPlayer<KnnParams>, isLab: () => boolean,
): (raw: RawPoint, kind: PointerKind) => void {
  let dragging = false;
  const clamped = (raw: RawPoint): RawPoint => {
    const { dataset, scaled } = p.state.params;
    const space = featureSpace(dataset, scaled);
    return space.toRaw(clampToDomain(space.toSpace(raw), space.domain));
  };
  return (raw, kind) => {
    if (!isLab()) {
      dragging = false;
      return;
    }
    if (kind === 'down') {
      dragging = true;
      const instant = p.state.params.instant;
      p.setParam('query', clamped(raw));
      p.goto(instant ? VOTE_STEP : 1);
    } else if (kind === 'move') {
      if (!dragging) return;
      if (p.state.index < VOTE_STEP) p.goto(VOTE_STEP);
      p.setParam('query', clamped(raw));
    } else {
      dragging = false;
    }
  };
}

export const knnPage: ConceptPage<KnnParams> = {
  title: 'k-En Yakın Komşu (k-NN)',
  chapter: 'Bölüm 5 · Sınıflandırmaya Giriş',
  scenario: knnScenario,
  mountScene: (el, p, m) => {
    const h = mountKnnScene(el, p, m);
    h.onPointer(createLabPointer(p, () => el.closest<HTMLElement>('[data-mode]')?.dataset.mode === 'lab'));
    return h;
  },
  mountParams: mountKnnParams,
  mountExplainExtra: mountKnnTable,
  shortcuts: knnShortcuts,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, knnPage);
