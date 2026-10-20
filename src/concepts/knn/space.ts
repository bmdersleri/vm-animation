import { customers, rawPoint, type DatasetId, type RawPoint } from './data';
import { applyScaler, fitScaler, invertScaler, type Scaler, type Vec } from './knn';

export interface FeatureSpace {
  dataset: DatasetId;
  scaled: boolean;
  points: Vec[];
  labels: (0 | 1)[];
  scaler: Scaler | null;
  toSpace(r: RawPoint): Vec;
  toRaw(v: Vec): RawPoint;
  domain: { x: [number, number]; y: [number, number] };
}

const cache = new Map<string, FeatureSpace>();

function pad(values: number[]): [number, number] {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const p = (hi - lo) * 0.08;
  return [lo - p, hi + p];
}

export function featureSpace(d: DatasetId, scaled: boolean): FeatureSpace {
  const key = `${d}|${scaled}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rawVecs: Vec[] = customers.map((c) => {
    const r = rawPoint(c, d);
    return { x: r.tenure, y: r.value };
  });
  const scaler = scaled ? fitScaler(rawVecs) : null;
  const points = rawVecs.map((v) => applyScaler(v, scaler));
  const s: FeatureSpace = {
    dataset: d,
    scaled,
    points,
    labels: customers.map((c) => c.churn),
    scaler,
    toSpace: (r) => applyScaler({ x: r.tenure, y: r.value }, scaler),
    toRaw: (v) => {
      const u = invertScaler(v, scaler);
      return { tenure: u.x, value: u.y };
    },
    domain: { x: pad(points.map((p) => p.x)), y: pad(points.map((p) => p.y)) },
  };
  cache.set(key, s);
  return s;
}
