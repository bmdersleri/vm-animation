import '../../core/theme.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import type { StepPlayer } from '../../core/player';
import type { RawPoint } from './data';
import type { Vec } from './knn';
import { knnScenario, knnShortcuts, type KnnParams } from './scenario';
import { mountKnnScene, type PointerKind } from './scene';
import { featureSpace, type FeatureSpace } from './space';
import type { Domain } from './viewport';
import { mountKnnParams } from './controls';
import { mountKnnTable } from './table';

const clamp = (v: number, [lo, hi]: [number, number]): number => Math.max(lo, Math.min(hi, v));

/** Keep a point (in feature-space units) inside a domain (e.g. the visible plot extent). */
export function clampToDomain(v: Vec, domain: Domain): Vec {
  return { x: clamp(v.x, domain.x), y: clamp(v.y, domain.y) };
}

const contains = (outer: Domain, inner: Domain): boolean => {
  const eps = 1e-9 * Math.max(1, Math.abs(inner.x[1] - inner.x[0]), Math.abs(inner.y[1] - inner.y[0]));
  return outer.x[0] <= inner.x[0] + eps && outer.x[1] >= inner.x[1] - eps
    && outer.y[0] <= inner.y[0] + eps && outer.y[1] >= inner.y[1] - eps;
};

/** Index of step 5 (vote and prediction): the step a live drag runs at. */
const VOTE_STEP = 4;
/** Fraction of the domain span (per axis) a press must travel to become a drag. */
const DRAG_DEAD_ZONE = 0.015;

/**
 * Lab click / drag on the plot. The scene reports hover moves without a
 * prior 'down' and may report 'up' at bogus coordinates (pointercancel), so
 * the drag state lives here: only moves between 'down' and 'up' count, and
 * 'up' never moves the query. A move becomes a drag only after the pointer
 * has travelled more than DRAG_DEAD_ZONE of the domain span from the down
 * point, so a click that wobbles still restarts at step 2 (or 5). `isLab` is
 * read at event time because the mode can change while the page is open.
 * Points are clamped to `visible()` — the plot's feature-space extent, which
 * for equal-aspect spaces is wider than the data — so a click in the margin
 * lands where it was made; the data domain is the fallback (no scene yet, or
 * an extent that does not belong to the current space).
 */
export function createLabPointer(
  p: StepPlayer<KnnParams>, isLab: () => boolean, visible: () => Domain | null = () => null,
): (raw: RawPoint, kind: PointerKind) => void {
  let pressed: Vec | null = null; // clamped down point in space units
  let dragging = false;
  const space = (): FeatureSpace => featureSpace(p.state.params.dataset, p.state.params.scaled);
  const clamped = (raw: RawPoint, s: FeatureSpace): Vec => {
    const vis = visible();
    return clampToDomain(s.toSpace(raw), vis && contains(vis, s.domain) ? vis : s.domain);
  };
  const end = (): void => {
    pressed = null;
    dragging = false;
  };
  return (raw, kind) => {
    if (!isLab()) {
      end();
      return;
    }
    if (kind === 'down') {
      const s = space();
      const at = clamped(raw, s);
      pressed = at;
      dragging = false;
      // Pin every effective param of the plot the user clicked on (one emit):
      // restarting at step 2 must not swap the demo step's k, metric,
      // regions, dataset or scaling under the new query.
      const { query: _query, ...keep } = p.state.params;
      p.setParams({ ...keep, query: s.toRaw(at) });
      p.goto(keep.instant ? VOTE_STEP : 1);
    } else if (kind === 'move') {
      if (!pressed) return;
      const s = space();
      const at = clamped(raw, s);
      if (!dragging) {
        const { x, y } = s.domain;
        const travel = Math.max(Math.abs(at.x - pressed.x) / (x[1] - x[0]), Math.abs(at.y - pressed.y) / (y[1] - y[0]));
        if (travel <= DRAG_DEAD_ZONE) return;
        dragging = true;
      }
      // query first, so the step change (if any) renders with the new query
      p.setParam('query', s.toRaw(at));
      if (p.state.index < VOTE_STEP) p.goto(VOTE_STEP);
    } else {
      end();
    }
  };
}

export const knnPage: ConceptPage<KnnParams> = {
  title: 'k-En Yakın Komşu (k-NN)',
  chapter: 'Bölüm 5 · Sınıflandırmaya Giriş',
  scenario: knnScenario,
  mountScene: (el, p, m) => {
    const h = mountKnnScene(el, p, m);
    const isLab = (): boolean => el.closest<HTMLElement>('[data-mode]')?.dataset.mode === 'lab';
    h.onPointer(createLabPointer(p, isLab, () => h.visibleDomain()));
    return h;
  },
  mountParams: mountKnnParams,
  mountExplainExtra: mountKnnTable,
  shortcuts: knnShortcuts,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, knnPage);
