"""Generate Chapter 7 (K-Means) data and an independent sklearn fixture.

Run:   python scripts/make_kmeans_data.py
Check: python scripts/make_kmeans_data.py --check   (writes nothing; exit 1 on drift)

Data: Iris columns 0 and 2 (sepal length, petal length), StandardScaler, n=150.

Page 1 (loop): 12 recorded Lloyd runs for k=3.
  A turn = one assignment (to the previous centres) then one centre update.
  Turn 1 has changed=null; the run stops at the first assignment that changes
  no label, and that last turn records changed=0 (its centres equal the
  previous ones). Starts are given to sklearn as explicit arrays for the
  cross-check (KMeans(init=start, n_init=1, algorithm="lloyd", tol=0)), whose
  partition and inertia must match or the generator exits.
  Run selection (fixed, deterministic):
    runs[0] good: first seed 0,1,2,... with k-means++ (kmeans_plusplus) whose
                  final inertia rounds to 43.03 in 4..7 turns (if none exists
                  the range widens to 3..8; meta.turnRange records the range).
    runs[1] bad:  first seed 0,1,2,... with init="random"
                  (RandomState(seed).choice(150, 3, replace=False)) whose final
                  inertia > 1.5 * best (best = KMeans(3, n_init=10, rs=42)).
    runs[2..11]:  alternate k-means++ (even slot) / random (odd slot); each
                  method counts up from the seed after its last used seed
                  (good seed + 1, bad seed + 1). Seeds that leave a cluster
                  empty, or whose stored 6-decimal numbers would flip a near-tie label, are
                  skipped (same skip applies to the good/bad searches). Ten slots are filled; if no run ends at
                  inertia ~44.2 the generator exits.
nInit: KMeans(3, init="k-means++", n_init=1, random_state=s), s=0..9.
distancePoints: for each turn-1 cluster of runs[0] (cluster 0,1,2) the member
  whose distance to its own turn-1 centre is the median (sorted by
  (distance, index), position (m-1)//2).
silhouettePoint: the k=3 point whose stored silhouette is closest to the stored
  k=3 mean silhouette (ties: smaller index).

Page 2 (choose k): KMeans(k, n_init=10, random_state=42), k=1..10 with silhouette
  and per-point a, b, s. Cluster numbers are made stable across k: greedy
  relabel by overlap with the previous k (pairs by overlap descending, ties by
  (new, old) ascending, zero overlap skipped; a new cluster takes the next free
  number). Run/nInit final clusters are mapped onto the k=3 numbering the same
  way, and the mapping is applied to labels, centres, starts and all turns.
Numbers are rounded to 6 decimals. The fixture is raw sklearn output.
"""

import json
import platform
import sys
from pathlib import Path

import numpy as np
import sklearn
from sklearn.cluster import KMeans, kmeans_plusplus
from sklearn.datasets import load_iris
from sklearn.metrics import silhouette_samples, silhouette_score
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = "src/concepts/kmeans/data/kmeans.json"
FIXTURE_PATH = "tests/fixtures/kmeans_sklearn.json"
SEED = 42
K = 3
BEST = 43.03


class EmptyCluster(Exception):
    pass


def r6(x):
    return round(float(x), 6)


def rl(a):
    return [r6(v) for v in np.asarray(a).ravel()]


def rp(a):
    return [[r6(v) for v in row] for row in np.asarray(a)]


def sq_to(points, centers):
    return ((points[:, None, :] - centers[None, :, :]) ** 2).sum(axis=2)


def lloyd(points, start):
    centers = np.array(start, dtype=float)
    k = len(centers)
    prev_labels = None
    turns = []
    while True:
        labels = np.argmin(sq_to(points, centers), axis=1)  # ties: smaller index
        changed = None if prev_labels is None else int((labels != prev_labels).sum())
        if len(set(labels.tolist())) < k:
            raise EmptyCluster
        centers = np.array([points[labels == j].mean(axis=0) for j in range(k)])
        inertia = float(((points - centers[labels]) ** 2).sum())
        turns.append({"labels": labels.copy(), "centers": centers.copy(), "changed": changed, "inertia": inertia})
        if changed == 0:
            return turns
        prev_labels = labels
        if len(turns) > 300:
            raise SystemExit("Lloyd did not converge")


def greedy_map(new, ref, k_new, k_ref):
    """Return mapping old cluster id -> stable number."""
    overlap = np.zeros((k_new, k_ref), dtype=int)
    for a, b in zip(new, ref):
        overlap[a, b] += 1
    pairs = sorted((-int(overlap[j, i]), j, i) for j in range(k_new) for i in range(k_ref) if overlap[j, i] > 0)
    mapping, used = {}, set()
    for _, j, i in pairs:
        if j not in mapping and i not in used:
            mapping[j] = i
            used.add(i)
    free = (n for n in range(k_new + k_ref) if n not in used)
    for j in range(k_new):
        if j not in mapping:
            mapping[j] = next(free)
    return mapping


def remap_labels(labels, mapping):
    return np.array([mapping[int(v)] for v in labels])


def remap_centers(centers, mapping):
    out = np.zeros_like(centers)
    for j, n in mapping.items():
        out[n] = centers[j]
    return out


def partition(labels):
    arr = np.asarray(labels)
    return sorted(tuple(np.flatnonzero(arr == c).tolist()) for c in set(arr.tolist()))


def sizes_sorted(labels):
    return sorted(int(v) for v in np.bincount(labels))


def silhouette_parts(points, labels, k):
    d = np.sqrt(sq_to(points, points))
    n = len(points)
    a = np.zeros(n)
    b = np.full(n, np.inf)
    for i in range(n):
        for c in range(k):
            mask = labels == c
            if c == labels[i]:
                m = mask.sum()
                a[i] = d[i, mask].sum() / (m - 1) if m > 1 else 0.0
            else:
                b[i] = min(b[i], d[i, mask].mean())
    denom = np.maximum(a, b)
    s = np.where(denom > 0, (b - a) / np.where(denom > 0, denom, 1), 0.0)
    return a, b, s


def final_check(points, start, turns):
    km = KMeans(n_clusters=len(start), init=np.array(start), n_init=1, algorithm="lloyd", tol=0, max_iter=300).fit(points)
    last = turns[-1]
    if partition(km.labels_) != partition(last["labels"]) or abs(km.inertia_ - last["inertia"]) > 1e-9:
        raise SystemExit("sklearn cross-check failed for a Lloyd run")
    return int(km.n_iter_)


def kpp_start(points, seed):
    return kmeans_plusplus(points, K, random_state=seed)[0]


def rnd_start(points, seed):
    return points[np.random.RandomState(seed).choice(len(points), K, replace=False)]


def stable_when_rounded(points, start, turns):
    """The browser re-derives labels from the stored (6-decimal) numbers; reject
    runs where rounding would flip a near-tie assignment."""
    pr = np.round(points, 6)
    prev = np.round(np.asarray(start), 6)
    for t in turns:
        if not np.array_equal(np.argmin(sq_to(pr, prev), axis=1), t["labels"]):
            return False
        prev = np.round(t["centers"], 6)
    return True


def try_run(points, init, seed):
    start = kpp_start(points, seed) if init == "k-means++" else rnd_start(points, seed)
    try:
        turns = lloyd(points, start)
    except EmptyCluster:
        return None
    return (start, turns) if stable_when_rounded(points, start, turns) else None


def generate():
    iris = load_iris()
    points = StandardScaler().fit_transform(iris.data[:, [0, 2]])
    n = len(points)

    # ---- page 2: k results (raw fixture, then relabelled) ----
    raw_ks, fixture_ks = [], []
    for k in range(1, 11):
        km = KMeans(n_clusters=k, n_init=10, random_state=SEED).fit(points)
        sil = float(silhouette_score(points, km.labels_)) if k >= 2 else None
        raw_ks.append((km, sil))
        fixture_ks.append({"k": k, "inertia": r6(km.inertia_), "silhouette": None if sil is None else r6(sil),
                           "sizes": sizes_sorted(km.labels_), "labels": [int(v) for v in km.labels_]})
    ks = []
    prev_labels = None
    for k, (km, sil) in enumerate(raw_ks, start=1):
        labels, centers = km.labels_.copy(), km.cluster_centers_.copy()
        if prev_labels is not None:
            mapping = greedy_map(labels, prev_labels, k, k - 1)
            labels, centers = remap_labels(labels, mapping), remap_centers(centers, mapping)
        prev_labels = labels
        a = b = s = None
        if k >= 2:
            a, b, s = silhouette_parts(points, labels, k)
            if np.abs(s - silhouette_samples(points, labels)).max() > 1e-9:
                raise SystemExit("silhouette parts disagree with sklearn")
        ks.append({"k": k, "labels": [int(v) for v in labels], "centers": rp(centers), "inertia": r6(km.inertia_),
                   "sizes": [int(v) for v in np.bincount(labels, minlength=k)],
                   "silhouette": None if sil is None else r6(sil),
                   "s": None if s is None else rl(s), "a": None if a is None else rl(a),
                   "b": None if b is None else rl(b)})
    k3 = np.array(ks[2]["labels"])
    best_inertia = raw_ks[2][0].inertia_
    if round(best_inertia, 2) != BEST:
        raise SystemExit("k=3 inertia is not 43.03")

    # ---- page 1: runs ----
    def make_run(init, seed, start, turns):
        final_check(points, start, turns)
        mapping = greedy_map(turns[-1]["labels"], k3, K, K)
        out = [{"labels": [int(v) for v in remap_labels(t["labels"], mapping)],
                "centers": rp(remap_centers(t["centers"], mapping)),
                "changed": t["changed"], "inertia": r6(t["inertia"])} for t in turns]
        return {"id": f"{'kpp' if init == 'k-means++' else 'rnd'}-{seed}", "init": init, "seed": seed,
                "start": rp(remap_centers(np.asarray(start), mapping)), "turns": out,
                "inertia": r6(turns[-1]["inertia"])}

    def find_good(lo, hi):
        for seed in range(500):
            res = try_run(points, "k-means++", seed)
            if res and round(res[1][-1]["inertia"], 2) == BEST and lo <= len(res[1]) <= hi:
                return seed, res
        return None

    turn_range = (4, 7)
    found = find_good(*turn_range)
    if not found:
        turn_range = (3, 8)
        found = find_good(*turn_range)
    if not found:
        raise SystemExit("no good seed")
    good_seed, (good_start, good_turns) = found
    bad_seed, bad = None, None
    for seed in range(500):
        res = try_run(points, "random", seed)
        if res and res[1][-1]["inertia"] > 1.5 * best_inertia:
            bad_seed, bad = seed, res
            break
    if bad is None:
        raise SystemExit("no bad seed")

    runs = [make_run("k-means++", good_seed, good_start, good_turns),
            make_run("random", bad_seed, bad[0], bad[1])]
    nxt = {"k-means++": good_seed + 1, "random": bad_seed + 1}
    for slot in range(2, 12):
        init = "k-means++" if slot % 2 == 0 else "random"
        while True:
            seed = nxt[init]
            nxt[init] += 1
            res = try_run(points, init, seed)
            if res:
                break
        runs.append(make_run(init, seed, res[0], res[1]))
    if not any(round(r["inertia"], 1) == 44.2 for r in runs):
        raise SystemExit("no ~44.2 run among the 12")

    # ---- n_init=10 ----
    n_init = []
    for s in range(10):
        km = KMeans(n_clusters=K, init="k-means++", n_init=1, random_state=s).fit(points)
        mapping = greedy_map(km.labels_, k3, K, K)
        n_init.append({"seed": s, "labels": [int(v) for v in remap_labels(km.labels_, mapping)],
                       "centers": rp(remap_centers(km.cluster_centers_, mapping)),
                       "inertia": r6(km.inertia_), "iterations": int(km.n_iter_)})
    inertias = [e["inertia"] for e in n_init]
    n_init_best = int(np.argmin(inertias))
    book_inertia = KMeans(n_clusters=K, n_init=10, random_state=SEED).fit(points).inertia_
    if round(inertias[n_init_best], 2) != round(book_inertia, 2):
        raise SystemExit("n_init best does not equal the book call")

    # ---- chosen points ----
    r0 = runs[0]
    t1 = np.array(r0["turns"][0]["labels"])
    c1 = np.array(r0["turns"][0]["centers"])
    distance_points = []
    for c in range(K):
        members = np.flatnonzero(t1 == c)
        dist = np.sqrt(((points[members] - c1[c]) ** 2).sum(axis=1))
        order = sorted(range(len(members)), key=lambda i: (dist[i], members[i]))
        distance_points.append(int(members[order[(len(members) - 1) // 2]]))
    s3 = np.array(ks[2]["s"])
    silhouette_point = int(np.argmin(np.abs(s3 - ks[2]["silhouette"])))

    data = {
        "meta": {"sklearn": sklearn.__version__, "numpy": np.__version__, "python": platform.python_version(),
                 "features": [iris.feature_names[0], iris.feature_names[2]], "n": n, "seed": SEED,
                 "goodSeed": good_seed, "badSeed": bad_seed, "turnRange": list(turn_range),
                 "runSeeds": [[r["init"], r["seed"]] for r in runs]},
        "points": rp(points), "runs": runs, "nInit": n_init, "nInitBest": n_init_best, "ks": ks,
        "distancePoints": distance_points, "silhouettePoint": silhouette_point,
    }
    fixture = {"sklearn": sklearn.__version__, "seed": SEED, "ks": fixture_ks,
               "nInitInertias": inertias, "bookInertia": r6(book_inertia)}
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
        print("kmeans data up to date")
    else:
        for relative, text in outputs:
            path = ROOT / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(text.encode("utf-8"))
            print(f"Generated {relative}")
