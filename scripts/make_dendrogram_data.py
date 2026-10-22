"""Generate Chapter 7 (dendrogram) data.

Run:   python scripts/make_dendrogram_data.py
Check: python scripts/make_dendrogram_data.py --check   (writes nothing; exit 1 on drift)

Data: 17 two-feature points (no scaling), 2 decimals: A = 0..4, B = 5..9, C = 10..12,
  chain ("zincir") = 13..16 between A and B. The spec's trial coordinates are the
  start. Criteria (the generator exits with the failing one, it never changes the design):
  1. ward, complete, average and single: consecutive merge heights differ by >= 0.05;
  2. ward's largest gap among k = 2..6 is the k = 3 gap and its 3 clusters hold
     A, B and C whole, with the chain split between A's and B's clusters;
  3. single at k = 3: A, chain and B (14 points) share one cluster (C is then split in two);
  4. scipy fcluster(maxclust, 3) equals sklearn AgglomerativeClustering(3, linkage)
     up to label permutation, in all four linkages.
Nudge rule (used only when the start fails criteria 1-3; deterministic): simulated
  annealing in up to 10 runs, seeds 0..9 in order (run s uses RandomState(s) and starts
  again from the start coordinates), each of at most 60000 steps. A step moves one
  coordinate of one point by one of +-0.01, 0.02, 0.05, 0.10 (result rounded to 2
  decimals) and is skipped if any coordinate would end up more than 0.20 from the start.
  The cost is the sum over the four linkages of max(0, 0.055 - gap) over consecutive
  merge heights, plus 10 per failed criterion 2 or 3. A step is taken if it does not
  raise the cost, else with probability exp(-increase / temperature); the temperature
  falls linearly from 0.02 + 1e-4 to 1e-4 over the run's steps. The first state with
  cost 0 is kept and its seed and step count are written to meta.nudge. If no run
  reaches cost 0: exit 1.
Per linkage: scipy linkage (rows a, b, height, size; ids >= n are earlier merges),
  dendrogram(no_plot=True) leaf order, and for k = 1..6 the cut range
  [Z[n-k-1, 2], Z[n-k, 2]) (merges with height <= t applied; k = 1 has no upper
  merge so high = last height * 1.1) with fcluster(distance) labels taken at the
  range midpoint and renumbered left to right by leaf order.
Heights are rounded to 6 decimals once; the browser uses the rounded numbers.
wardExample: the 4th merge (index 3) with its sum-of-squares increase computed
  directly: SSE(union) - SSE(a) - SSE(b).
"""

import json
import platform
import sys
from pathlib import Path

import numpy as np
import scipy
import sklearn
from scipy.cluster.hierarchy import dendrogram, fcluster, linkage
from sklearn.cluster import AgglomerativeClustering

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = "src/concepts/dendrogram/data/dendrogram.json"
LINKAGES = ["ward", "complete", "average", "single"]
GROUPS = {"A": [0, 1, 2, 3, 4], "B": [5, 6, 7, 8, 9], "C": [10, 11, 12], "zincir": [13, 14, 15, 16]}
START = [(1.0, 1.0), (1.4, 1.3), (0.8, 1.6), (1.6, 0.8), (1.2, 2.0),
         (6.0, 1.2), (6.5, 1.6), (5.7, 0.7), (6.3, 0.6), (6.8, 1.1),
         (3.3, 5.0), (3.8, 5.4), (3.0, 5.6),
         (2.3, 1.2), (3.2, 1.1), (4.1, 1.15), (5.0, 1.1)]
MIN_GAP, MARGIN, MAX_SHIFT, STEPS, SEED, RESTARTS = 0.05, 0.055, 0.20, 60000, 0, 10
WARD_EXAMPLE_MERGE = 3


def fail(msg):
    print("CRITERION FAILED: " + msg)
    sys.exit(1)


def partition(labels):
    out = {}
    for i, v in enumerate(labels):
        out.setdefault(int(v), set()).add(i)
    return {frozenset(s) for s in out.values()}


def logic_failures(X, Zs):
    """Criteria 2 and 3 on the cuts; returns a list of failure messages."""
    n = len(X)
    bad = []
    Zw = Zs["ward"]
    gaps = {k: Zw[n - k, 2] - Zw[n - k - 1, 2] for k in range(2, 7)}
    if max(gaps, key=gaps.get) != 3:
        bad.append(f"2: ward largest gap is k={max(gaps, key=gaps.get)} not 3 ({gaps})")
    lab = fcluster(Zw, 3, "maxclust")
    cl = {g: {int(lab[i]) for i in idx} for g, idx in GROUPS.items()}
    if not (len(cl["A"]) == len(cl["B"]) == len(cl["C"]) == 1 and len({*cl["A"], *cl["B"], *cl["C"]}) == 3):
        bad.append(f"2: ward k=3 does not hold A, B, C whole: {cl}")
    elif not (cl["zincir"] == {*cl["A"], *cl["B"]}):
        bad.append(f"2: ward k=3 does not split the chain between A and B: {cl}")
    ls = fcluster(Zs["single"], 3, "maxclust")
    ch = {int(ls[i]) for g in ("A", "B", "zincir") for i in GROUPS[g]}
    if len(ch) != 1:
        bad.append(f"3: single k=3 does not put A, chain and B in one cluster ({ch})")
    return bad


def cost(X):
    Zs = {m: linkage(X, m) for m in LINKAGES}
    c = sum(np.maximum(0.0, MARGIN - np.diff(Z[:, 2])).sum() for Z in Zs.values())
    return c + 10.0 * len(logic_failures(X, Zs)), Zs


def find_points():
    base = np.array(START)
    if all(np.diff(linkage(base, m)[:, 2]).min() >= MIN_GAP for m in LINKAGES) and not logic_failures(
            base, {m: linkage(base, m) for m in LINKAGES}):
        return base, {"seed": None, "steps": 0, "maxShift": MAX_SHIFT}
    best = None
    for seed in range(SEED, SEED + RESTARTS):
        rng = np.random.RandomState(seed)
        cur_x = base.copy()
        cur, _ = cost(cur_x)
        for step in range(STEPS):
            temp = 0.02 * (1 - step / STEPS) + 1e-4
            cand = cur_x.copy()
            i, j = rng.randint(17), rng.randint(2)
            cand[i, j] = round(cand[i, j] + rng.choice([-0.1, -0.05, -0.02, -0.01, 0.01, 0.02, 0.05, 0.1]), 2)
            if np.abs(cand - base).max() > MAX_SHIFT + 1e-9:
                continue
            c, _ = cost(cand)
            if c <= cur or rng.rand() < np.exp((cur - c) / temp):
                cur_x, cur = cand, c
            if cur == 0.0:
                return np.round(cur_x, 2), {"seed": seed, "steps": step + 1, "maxShift": MAX_SHIFT}
        best = cur if best is None else min(best, cur)
    fail(f"1/2/3: no coordinates within {MAX_SHIFT} of the start after {RESTARTS} runs of {STEPS} steps (best cost {best})")


def leaf_renumber(labels, leaves):
    mapping = {}
    for i in leaves:
        mapping.setdefault(int(labels[i]), len(mapping))
    return [mapping[int(v)] for v in labels]


def sse(X, idx):
    p = X[sorted(idx)]
    return float(((p - p.mean(axis=0)) ** 2).sum())


def members(Z, n, node):
    if node < n:
        return [int(node)]
    row = Z[int(node) - n]
    return members(Z, n, row[0]) + members(Z, n, row[1])


def generate():
    X, nudge = find_points()
    n = len(X)
    X = np.round(X, 2)
    out = {}
    for m in LINKAGES:
        Z = linkage(X, m)
        h = Z[:, 2]
        if np.diff(h).min() < MIN_GAP:
            fail(f"1: {m} smallest gap {np.diff(h).min()!r} < {MIN_GAP}")
        leaves = [int(v) for v in dendrogram(Z, no_plot=True)["leaves"]]
        cuts = []
        for k in range(1, 7):
            low = float(h[n - k - 1])
            high = float(h[n - k]) if k > 1 else float(h[-1]) * 1.1
            lab = fcluster(Z, (low + high) / 2, "distance")
            if len(set(lab.tolist())) != k:
                fail(f"1: {m} cut at the k={k} midpoint gives {len(set(lab.tolist()))} clusters")
            cuts.append({"k": k, "low": round(low, 6), "high": round(high, 6),
                         "labels": leaf_renumber(lab, leaves)})
        sk = AgglomerativeClustering(n_clusters=3, linkage=m).fit(X).labels_
        if partition(sk) != partition(fcluster(Z, 3, "maxclust")):
            fail(f"4: scipy and sklearn disagree for {m} at k=3")
        out[m] = {"merges": [{"a": int(r[0]), "b": int(r[1]), "height": round(float(r[2]), 6), "size": int(r[3])}
                             for r in Z],
                  "leaves": leaves, "cuts": cuts}
    # Rounded heights must keep the gap and the cut ranges consistent.
    for m, ld in out.items():
        hs = [r["height"] for r in ld["merges"]]
        if min(b - a for a, b in zip(hs, hs[1:])) < MIN_GAP - 1e-9:
            fail(f"1: {m} rounded heights closer than {MIN_GAP}")

    Zw = linkage(X, "ward")
    row = Zw[WARD_EXAMPLE_MERGE]
    ma, mb = members(Zw, n, row[0]), members(Zw, n, row[1])
    increase = sse(X, ma + mb) - sse(X, ma) - sse(X, mb)
    if abs(increase - row[2] ** 2 / 2) > 1e-9:
        fail(f"wardExample: SSE increase {increase} != height^2/2 {row[2] ** 2 / 2}")

    gaps = {k: out["ward"]["cuts"][k - 1]["high"] - out["ward"]["cuts"][k - 1]["low"] for k in range(2, 7)}
    natural = max(gaps, key=gaps.get)
    data = {
        "meta": {"scipy": scipy.__version__, "sklearn": sklearn.__version__, "numpy": np.__version__,
                 "python": platform.python_version(), "groups": GROUPS, "nudge": nudge},
        "points": [[round(float(v), 2) for v in row_] for row_ in X],
        "linkages": out,
        "wardExample": {"merge": WARD_EXAMPLE_MERGE, "increase": round(increase, 6)},
        "naturalK": natural,
    }
    for m in LINKAGES:
        hs = [r["height"] for r in out[m]["merges"]]
        print(f"{m}: last5={hs[-5:]} mingap={min(b - a for a, b in zip(hs, hs[1:])):.4f} "
              f"k3 sizes={sorted(np.bincount(out[m]['cuts'][2]['labels']).tolist())}")
    print(f"points={data['points']} nudge={nudge} wardExample={data['wardExample']} naturalK={natural}")
    return data


def render(content):
    return json.dumps(content, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n"


if __name__ == "__main__":
    text = render(generate())
    if "--check" in sys.argv:
        path = ROOT / DATA_PATH
        if not path.exists() or path.read_bytes() != text.encode("utf-8"):
            print("Out of date: " + DATA_PATH)
            sys.exit(1)
        print("dendrogram data up to date")
    else:
        path = ROOT / DATA_PATH
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(text.encode("utf-8"))
        print(f"Generated {DATA_PATH}")
