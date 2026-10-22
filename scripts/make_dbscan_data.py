"""Generate Chapter 7 (DBSCAN) data and an independent sklearn fixture.

Run:   python scripts/make_dbscan_data.py
Check: python scripts/make_dbscan_data.py --check   (writes nothing; exit 1 on drift)

Data: make_moons(200, noise=0.08, random_state=42) plus 10 uniform outliers from
  RandomState(seed) in the moons' bounding box widened by 0.15 (seed starts at 7
  and counts up until eps=0.3 / min_samples=5 gives 2 clusters, >= 5 border and
  >= 5 noise points), StandardScaler, then rounded to 6 decimals. Every later
  sklearn computation uses the rounded points, so the browser sees the same numbers.
Criteria (the generator exits with the failing criterion, it never changes the design):
  grid safety: for eps in {0.05, 0.06, ..., 1.00} every pairwise |d - eps| >= 1e-9;
  epsSweep [0.15, 0.3, 0.6]: noise >= 20 % at 0.15, one cluster at 0.6;
  knee of the min_samples=5 k-distance curve (Kneedle: normalised curve point
  farthest from the diagonal) within 0.1 of 0.3.
Examples (at eps 0.3 / min_samples 5):
  core   A: among cores with the most neighbours, the one nearest the centroid of
            the moon points of its cluster (ties: smaller index);
  border B: a border point with exactly one core in its circle if any (else any
            border point), smaller index first;
  noise  C: the noise point whose nearest other point is farthest (ties: smaller index).
kdist: for min_samples 2..15 the sorted m-th neighbour distance (self counted),
  NearestNeighbors(n_neighbors=m).
Fixture: eps in {0.10, 0.15, ..., 1.00} x min_samples in {2, 3, 5, 8, 10, 15}:
  sklearn core_sample_indices_, labels_ and border points reachable from several
  clusters (ambiguousBorder: {index: [clusters]}).
"""

import json
import platform
import sys
from pathlib import Path

import numpy as np
import sklearn
from sklearn.cluster import DBSCAN, KMeans
from sklearn.datasets import make_moons
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = "src/concepts/dbscan/data/dbscan.json"
FIXTURE_PATH = "tests/fixtures/dbscan_sklearn.json"
EPS, MIN_SAMPLES = 0.3, 5
EPS_SWEEP = [0.15, 0.3, 0.6]
GRID_EPS = [round(0.05 + 0.01 * i, 2) for i in range(96)]
FIXTURE_EPS = [round(0.10 + 0.05 * i, 2) for i in range(19)]
FIXTURE_MS = [2, 3, 5, 8, 10, 15]


def fail(msg):
    print("CRITERION FAILED: " + msg)
    sys.exit(1)


def r6(x):
    return round(float(x), 6)


def build_points(outlier_seed):
    moons, _ = make_moons(n_samples=200, noise=0.08, random_state=42)
    lo, hi = moons.min(axis=0) - 0.15, moons.max(axis=0) + 0.15
    outliers = np.random.RandomState(outlier_seed).uniform(lo, hi, size=(10, 2))
    scaled = StandardScaler().fit_transform(np.vstack([moons, outliers]))
    return np.round(scaled, 6)


def run(points, eps, ms):
    db = DBSCAN(eps=eps, min_samples=ms).fit(points)
    core = np.zeros(len(points), dtype=bool)
    core[db.core_sample_indices_] = True
    return db.labels_.copy(), core


def counts(labels, core):
    border = (~core) & (labels >= 0)
    return {"clusters": len(set(labels.tolist()) - {-1}), "core": int(core.sum()),
            "border": int(border.sum()), "noise": int((labels == -1).sum())}


def pick_seed():
    for seed in range(7, 207):
        points = build_points(seed)
        c = counts(*run(points, EPS, MIN_SAMPLES))
        if c["clusters"] == 2 and c["border"] >= 5 and c["noise"] >= 5:
            return seed, points, c
    fail("no outlier seed in 7..206 gives 2 clusters, border >= 5, noise >= 5")


def knee(sorted_d):
    n = len(sorted_d)
    x = np.linspace(0, 1, n)
    y = (sorted_d - sorted_d[0]) / (sorted_d[-1] - sorted_d[0])
    return float(sorted_d[int(np.argmax(np.abs(x - y)))])


def generate():
    seed, points, base = pick_seed()
    n = len(points)
    dist = np.sqrt(((points[:, None, :] - points[None, :, :]) ** 2).sum(axis=2))

    iu = np.triu_indices(n, k=1)
    pair_d = dist[iu]
    for eps in GRID_EPS:
        gap = np.abs(pair_d - eps)
        if gap.min() < 1e-9:
            k = int(np.argmin(gap))
            fail(f"grid safety: eps={eps} pair ({iu[0][k]}, {iu[1][k]}) d={pair_d[k]!r}")

    labels, core = run(points, EPS, MIN_SAMPLES)
    nbr = dist <= EPS
    ncount = nbr.sum(axis=1)
    border_idx = [i for i in range(n) if labels[i] >= 0 and not core[i]]
    noise_idx = [i for i in range(n) if labels[i] == -1]

    moon = np.arange(n) < 200
    cores = np.flatnonzero(core)
    top = ncount[cores].max()
    cand = [int(i) for i in cores if ncount[i] == top]

    def to_centre(i):
        members = np.flatnonzero((labels == labels[i]) & moon)
        return float(np.linalg.norm(points[i] - points[members].mean(axis=0)))

    a = min(cand, key=lambda i: (to_centre(i), i))
    one_core = [i for i in border_idx if (nbr[i] & core).sum() == 1]
    b = (one_core or border_idx)[0]
    nearest = {i: float(np.sort(dist[i])[1]) for i in noise_idx}
    c = max(noise_idx, key=lambda i: (nearest[i], -i))

    sweep = {}
    for e in EPS_SWEEP:
        sweep[e] = counts(*run(points, e, MIN_SAMPLES))
    if sweep[0.15]["noise"] < 0.2 * n:
        fail(f"epsSweep: noise at 0.15 is {sweep[0.15]['noise']} < 20 % of {n}: {sweep}")
    if sweep[0.6]["clusters"] != 1:
        fail(f"epsSweep: {sweep[0.6]['clusters']} clusters at 0.6 (want 1): {sweep}")

    kdist = []
    for m in range(2, 16):
        d = NearestNeighbors(n_neighbors=m).fit(points).kneighbors(points)[0][:, m - 1]
        kdist.append({"minSamples": m, "sorted": [r6(v) for v in np.sort(d)]})
    k5 = np.array(kdist[3]["sorted"])
    kn = knee(k5)
    if abs(kn - EPS) > 0.1:
        fail(f"knee {kn} is farther than 0.1 from {EPS}")

    km = KMeans(n_clusters=2, n_init=10, random_state=42).fit(points)

    data = {
        "meta": {"sklearn": sklearn.__version__, "numpy": np.__version__, "python": platform.python_version(),
                 "moons": {"n": 200, "noise": 0.08, "seed": 42}, "outliers": {"n": 10, "seed": seed},
                 "eps": EPS, "minSamples": MIN_SAMPLES},
        "points": [[r6(v) for v in row] for row in points],
        "kmeansLabels": [int(v) for v in km.labels_],
        "examples": {"core": int(a), "border": int(b), "noise": int(c)},
        "kdist": kdist, "knee": r6(kn), "epsSweep": EPS_SWEEP,
    }

    grid = []
    for eps in FIXTURE_EPS:
        for ms in FIXTURE_MS:
            lab, cr = run(points, eps, ms)
            amb = {}
            for i in range(n):
                if lab[i] >= 0 and not cr[i]:
                    reach = sorted(set(lab[(dist[i] <= eps) & cr].tolist()))
                    if len(reach) > 1:
                        amb[str(i)] = reach
            grid.append({"eps": eps, "minSamples": ms,
                         "core": [int(i) for i in np.flatnonzero(cr)],
                         "labels": [int(v) for v in lab], "ambiguousBorder": amb})
    fixture = {"sklearn": sklearn.__version__, "grid": grid}

    print(f"seed={seed} counts@0.3/5={base} A={a}(n={int(ncount[a])}) B={b}(n={int(ncount[b])}) "
          f"C={c}(n={int(ncount[c])}) sweep={sweep} knee={kn:.6f} "
          f"ambiguous={sum(len(g['ambiguousBorder']) for g in grid)}")
    return data, fixture


def render(content):
    return json.dumps(content, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n"


if __name__ == "__main__":
    data, fixture = generate()
    outputs = [(DATA_PATH, render(data)), (FIXTURE_PATH, render(fixture))]
    if "--check" in sys.argv:
        stale = [p for p, text in outputs
                 if not (ROOT / p).exists() or (ROOT / p).read_bytes() != text.encode("utf-8")]
        if stale:
            print("Out of date: " + ", ".join(stale))
            sys.exit(1)
        print("dbscan data up to date")
    else:
        for relative, text in outputs:
            path = ROOT / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(text.encode("utf-8"))
            print(f"Generated {relative}")
