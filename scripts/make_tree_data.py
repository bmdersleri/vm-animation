"""Generate the decision-tree page's churn sample and scikit-learn fixtures.

Usage:
    python scripts/make_tree_data.py

Writes (relative to the repo root):
    src/concepts/karar-agaci/data/churn_tree.json   train/test customers (t months, c complaints)
    tests/fixtures/karar-agaci_sklearn.json         tennis/book hand values + sklearn trees

The script tries seeds 0, 1, 2, ... and keeps the first sample meeting every selection
condition. Output is deterministic: running it twice produces byte-identical files.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from sklearn.tree import DecisionTreeClassifier

REPO = Path(__file__).resolve().parent.parent
SAMPLE_OUT = REPO / "src" / "concepts" / "karar-agaci" / "data" / "churn_tree.json"
FIXTURE_OUT = REPO / "tests" / "fixtures" / "karar-agaci_sklearn.json"

CRITERIA = {"gini": "gini", "entropi": "entropy"}
DEPTHS: list[int | None] = [1, 2, 3, 4, 5, 6, None]
TIE_EPS = 1e-9
MAX_SEEDS = 100_000

# Tennis (Quinlan, 1986), Turkish values. Class 0 = evet, 1 = hayir.
TENNIS_ATTRS = ["Hava", "Sıcaklık", "Nem", "Rüzgâr"]
TENNIS = [
    ("Güneşli", "Sıcak", "Yüksek", "Zayıf", 1),
    ("Güneşli", "Sıcak", "Yüksek", "Güçlü", 1),
    ("Bulutlu", "Sıcak", "Yüksek", "Zayıf", 0),
    ("Yağmurlu", "Ilık", "Yüksek", "Zayıf", 0),
    ("Yağmurlu", "Serin", "Normal", "Zayıf", 0),
    ("Yağmurlu", "Serin", "Normal", "Güçlü", 1),
    ("Bulutlu", "Serin", "Normal", "Güçlü", 0),
    ("Güneşli", "Ilık", "Yüksek", "Zayıf", 1),
    ("Güneşli", "Serin", "Normal", "Zayıf", 0),
    ("Yağmurlu", "Ilık", "Normal", "Zayıf", 0),
    ("Güneşli", "Ilık", "Normal", "Güçlü", 0),
    ("Bulutlu", "Ilık", "Yüksek", "Güçlü", 0),
    ("Bulutlu", "Sıcak", "Normal", "Zayıf", 0),
    ("Yağmurlu", "Ilık", "Yüksek", "Güçlü", 1),
]


def fail(msg: str) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


# --------------------------------------------------------------------------- impurity


def gini(counts) -> float:
    n = sum(counts)
    return 1.0 - sum((c / n) ** 2 for c in counts) if n else 0.0


def entropy(counts) -> float:
    n = sum(counts)
    return float(-sum((c / n) * np.log2(c / n) for c in counts if c)) if n else 0.0


MEASURE = {"gini": gini, "entropi": entropy}


def split_summary(parent: list[int], branches: list[list[int]]) -> dict:
    n = sum(parent)
    wg = sum(sum(b) / n * gini(b) for b in branches)
    we = sum(sum(b) / n * entropy(b) for b in branches)
    return {
        "branches": [{"counts": b, "gini": float(gini(b)), "entropy": entropy(b)} for b in branches],
        "weightedGini": float(wg),
        "weightedEntropy": float(we),
        "giniReduction": float(gini(parent) - wg),
        "informationGain": float(entropy(parent) - we),
    }


def tennis_fixture() -> dict:
    y = [r[4] for r in TENNIS]
    root = [y.count(0), y.count(1)]
    cands = []
    for j, name in enumerate(TENNIS_ATTRS):
        values = list(dict.fromkeys(r[j] for r in TENNIS))  # first-appearance order
        branches = []
        for v in values:
            ys = [r[4] for r in TENNIS if r[j] == v]
            branches.append([ys.count(0), ys.count(1)])
        s = split_summary(root, branches)
        for b, v in zip(s["branches"], values):
            b["value"] = v
        cands.append({"attribute": name, **s})
    expected = {
        "Hava": (0.343, 0.116, 0.247),
        "Nem": (0.367, 0.092, 0.152),
        "Rüzgâr": (0.429, 0.031, 0.048),
        "Sıcaklık": (0.440, 0.019, 0.029),
    }
    for c in cands:
        got = (round(c["weightedGini"], 3), round(c["giniReduction"], 3), round(c["informationGain"], 3))
        if got != expected[c["attribute"]]:
            fail(f"tennis {c['attribute']}: {got} != {expected[c['attribute']]}")
    if (round(gini(root), 3), round(entropy(root), 3)) != (0.459, 0.940):
        fail("tennis root impurity mismatch")
    return {
        "attributes": TENNIS_ATTRS,
        "rows": [{"day": f"G{i + 1}", "values": list(r[:4]), "y": r[4]} for i, r in enumerate(TENNIS)],
        "root": {"counts": root, "gini": float(gini(root)), "entropy": entropy(root)},
        "candidates": cands,
    }


def book_fixture() -> dict:
    parent = [40, 60]
    s = split_summary(parent, [[35, 15], [5, 45]])
    got = (
        round(gini(parent), 3),
        round(s["weightedGini"], 3),
        round(entropy(parent), 3),
        round(s["weightedEntropy"], 3),
        round(s["informationGain"], 3),
    )
    if got != (0.480, 0.300, 0.971, 0.675, 0.296):
        fail(f"book example mismatch: {got}")
    return {"root": {"counts": parent, "gini": float(gini(parent)), "entropy": entropy(parent)}, **s}


# --------------------------------------------------------------------------- sampling


def draw(seed: int):
    rng = np.random.default_rng(seed)
    n_train = int(rng.integers(24, 31))
    n_test = int(rng.integers(10, 13))
    noise = float(rng.uniform(0.08, 0.12))
    n = n_train + n_test
    short = rng.random(n) < 0.4  # oversample short contracts so the rule fires
    t = np.where(short, rng.integers(1, 12, n), rng.integers(12, 60, n))
    c = rng.integers(0, 6, n)
    y = ((t < 12) & (c >= 3)).astype(int)
    flip = rng.random(n) < noise
    y = np.where(flip, 1 - y, y)
    jy = np.round(rng.uniform(-0.25, 0.25, n), 3)
    X = np.column_stack([t, c]).astype(float)
    return X[:n_train], y[:n_train], jy[:n_train], X[n_train:], y[n_train:], jy[n_train:]


def fit(X, y, criterion: str, depth):
    return DecisionTreeClassifier(criterion=CRITERIA[criterion], max_depth=depth, random_state=0).fit(X, y)


def candidates(X, y, measure) -> list[tuple[float, int, float]]:
    """All (weighted impurity, feature, threshold) candidates at a node, CART midpoints."""
    n = len(y)
    out = []
    for j in range(X.shape[1]):
        vals = np.unique(X[:, j])
        for lo, hi in zip(vals[:-1], vals[1:]):
            thr = float((lo + hi) / 2)
            left = X[:, j] <= thr
            parts = [np.bincount(y[m], minlength=2).tolist() for m in (left, ~left)]
            imp = sum(sum(p) / n * measure(p) for p in parts)
            out.append((float(imp), j, thr))
    return out


def internal_nodes(clf, X):
    path = clf.decision_path(X).toarray().astype(bool)
    t = clf.tree_
    return [(i, path[:, i]) for i in range(t.node_count) if t.children_left[i] != -1]


def check_seed(seed: int):
    Xtr, ytr, jtr, Xte, yte, jte = draw(seed)
    d2 = fit(Xtr, ytr, "gini", 2)
    nodes = [(int(d2.tree_.feature[i]), float(d2.tree_.threshold[i])) for i, _ in internal_nodes(d2, Xtr)]
    if len(nodes) != 2:
        return None, "depth-2 tree does not have two internal nodes"
    f_t = [th for f, th in nodes if f == 0]
    f_c = [th for f, th in nodes if f == 1]
    if not (len(f_t) == 1 and len(f_c) == 1 and 10.5 <= f_t[0] <= 12.5 and abs(f_c[0] - 2.5) < TIE_EPS):
        return None, "depth-2 questions are not t<=11.5+-1 and c<=2.5"
    full = fit(Xtr, ytr, "gini", None)
    if full.score(Xtr, ytr) != 1.0:
        return None, "unlimited tree does not reach train accuracy 1.0"
    if full.score(Xte, yte) > d2.score(Xte, yte) - 0.15 + 1e-12:
        return None, "unlimited test accuracy not >= 0.15 below depth 2"
    root = sorted(candidates(Xtr, ytr, gini))
    if root[1][0] - root[0][0] < 0.02:
        return None, "root best threshold not 0.02 clear of the closest rival"
    for crit in CRITERIA:
        for depth in DEPTHS:
            clf = fit(Xtr, ytr, crit, depth)
            for _, mask in internal_nodes(clf, Xtr):
                cs = sorted(candidates(Xtr[mask], ytr[mask], MEASURE[crit]))
                if len(cs) > 1 and cs[1][0] - cs[0][0] < TIE_EPS:
                    return None, f"tie at a node of the {crit} depth-{depth} tree"
    return (Xtr, ytr, jtr, Xte, yte, jte), "ok"


# --------------------------------------------------------------------------- fixtures


def node_json(t, i: int) -> dict:
    n = int(t.n_node_samples[i])
    counts = [int(round(n * v)) for v in t.value[i][0]]
    if t.children_left[i] == -1:
        return {"feature": -1, "threshold": None, "counts": counts}
    return {
        "feature": int(t.feature[i]),
        "threshold": float(t.threshold[i]),
        "counts": counts,
        "left": node_json(t, int(t.children_left[i])),
        "right": node_json(t, int(t.children_right[i])),
    }


def key(depth) -> str:
    return "null" if depth is None else str(depth)


def make_fixtures(Xtr, ytr, Xte, yte) -> dict:
    trees: dict = {}
    accuracy: dict = {}
    for crit in CRITERIA:
        trees[crit], accuracy[crit] = {}, {}
        for depth in DEPTHS:
            clf = fit(Xtr, ytr, crit, depth)
            trees[crit][key(depth)] = node_json(clf.tree_, 0)
            accuracy[crit][key(depth)] = {
                "train": float(clf.score(Xtr, ytr)),
                "test": float(clf.score(Xte, yte)),
            }
    allc = sorted(candidates(Xtr, ytr, gini), key=lambda c: (c[1], c[2]))
    sweep = [[{"threshold": thr, "impurity": imp} for imp, j, thr in allc if j == f] for f in (0, 1)]
    return {
        "tennis": tennis_fixture(),
        "book": book_fixture(),
        "trees": trees,
        "accuracy": accuracy,
        "rootSweep": sweep,
    }


# --------------------------------------------------------------------------- output


def dumps(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(", ", ": "))


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def rows_json(X, y, jy) -> str:
    rows = [{"t": int(a[0]), "c": int(a[1]), "y": int(b), "jy": float(j)} for a, b, j in zip(X, y, jy)]
    return "[\n" + ",\n".join("  " + dumps(r) for r in rows) + "\n ]"


def main() -> None:
    for seed in range(MAX_SEEDS):
        found, _why = check_seed(seed)
        if found is not None:
            break
    else:
        fail(f"no seed below {MAX_SEEDS} meets the selection conditions")
    Xtr, ytr, jtr, Xte, yte, jte = found
    print(f"Seed {seed}: {len(ytr)} train ({int(ytr.sum())} Ayrildi), {len(yte)} test ({int(yte.sum())} Ayrildi)")

    fixtures = make_fixtures(Xtr, ytr, Xte, yte)
    for crit in CRITERIA:
        for depth in DEPTHS:
            print(f"  {crit} depth {key(depth)}: {fixtures['accuracy'][crit][key(depth)]}")

    sample = (
        "{\n"
        f' "seed": {seed},\n'
        f' "train": {rows_json(Xtr, ytr, jtr)},\n'
        f' "test": {rows_json(Xte, yte, jte)}\n'
        "}\n"
    )
    json.loads(sample)
    write_text(SAMPLE_OUT, sample)
    write_text(FIXTURE_OUT, json.dumps(fixtures, ensure_ascii=False, indent=1) + "\n")
    print(f"Wrote {SAMPLE_OUT.relative_to(REPO).as_posix()} and {FIXTURE_OUT.relative_to(REPO).as_posix()}")


if __name__ == "__main__":
    main()
