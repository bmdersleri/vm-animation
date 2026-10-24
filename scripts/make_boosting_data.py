"""Generate Chapter 10 (gradient boosting) data and the sklearn test fixture.

Run:   python scripts/make_boosting_data.py
Check: python scripts/make_boosting_data.py --check   (writes nothing; exit 1 on drift)

Writes (relative to the repo root):
  src/concepts/boosting/data/boosting.json   data the two pages draw
  tests/fixtures/boosting_sklearn.json       sklearn numbers the TS maths is compared with

Data (boosting.json):
  reg      Regression data of the book's ch10 code. Training set: RandomState(42),
           x = sort(rand(80, 1) * 10), y = sin(x) + normal(0, 0.1, 80). Validation set: the
           same process with RandomState(7). x and y are rounded to 4 decimals BEFORE any
           fitting and everything after that uses the rounded values (so the float32 cast
           inside sklearn cannot move a partition). mean = training mean of y.
  book     The book's hand loop: nu 0.3, DecisionTreeRegressor(max_depth=2, random_state=42),
           5 trees. mse = training mean squared error after each tree (4 decimals); trees =
           scikit-learn node layout of each tree (t, l, r, v; leaf has l = r = -1, t = 0).
  curves   GradientBoostingClassifier(n_estimators=500, max_depth=4, random_state=42) on
           make_classification(3000, 15, n_informative=8, random_state=42),
           train_test_split(test_size=0.25, random_state=42), for six learning rates.
           staged_predict_proba gives, for 1..500 trees: train log-loss, validation log-loss
           (6 decimals) and validation roc_auc (4 decimals).
  surface  Search surface: make_classification(800, 15, n_informative=8, random_state=42),
           train_test_split(test_size=0.2, random_state=42), training part; depth 1..6 times
           np.logspace(-2, 0, 9); GradientBoostingClassifier(n_estimators=100,
           max_depth=d, learning_rate=nu, random_state=42); cross_val_score(roc_auc, cv=3)
           mean (4 decimals).
  The book's XGBoost AUCs (0.9261 / 0.9625 / 0.9713 / 0.9711 / 0.9693) are not generated; they
  are constants in src/concepts/boosting/data.ts.

Fixture (boosting_sklearn.json):
  grid        nu in {0.05, 0.3, 1.0} x depth in {1, 2, 3}: the book's hand loop (every tree is
              DecisionTreeRegressor(max_depth=d)) for 200 trees; train and validation mean
              squared error after each tree (full precision).
  firstResiduals  Residuals r0 = y - mean. For DecisionTreeRegressor(max_depth=2) and
              (max_leaf_nodes=4): internal-node thresholds (sorted), leaf values (left to
              right) and the training mean squared error.
  maxLeaves   max_leaf_nodes = 2..64 on r0: real leaf count, depth, train error and
              validation error (validation residual = y_val - mean_train). beyond =
              max_leaf_nodes 200 (more than the data can fill).
  mulberry    First values of mulberry32 for seeds 0 and 12345.
  search      Sequential search (Python twin of src/concepts/boosting/search.ts) over the
              surface above for seeds 0..4, budget 16: the 16 cell indices in trial order.
              Cell index = depthIdx * 9 + lrIdx.

Sequential search (same in TS): u = depthIdx / 5, v = lrIdx / 8. First 3 trials:
floor(mulberry32(seed)() * 54), next number if already taken. After that: tried cells sorted
by AUC descending (ties: trial order); good = first max(1, ceil(0.25 n)), bad = the rest
(both summed in trial order);
every untried cell (small index first) scores mean_good K / (mean_bad K + 1e-9) with
K = exp(-d^2 / (2 * 0.2^2)); the strictly largest score is tried next (scores within a relative 1e-9 count as equal,
so mirror-symmetric cells tie and the smaller index wins in Python and TypeScript alike).

Checks (the generator exits 1 on the first failing one, never changes data):
  - the five book errors 0.2952 0.2138 0.1587 0.1201 0.0933 (4 decimals);
  - nu 0.3, depth 2 validation error (200 trees) has a minimum before tree 200;
  - on the first residuals the max_leaf_nodes=4 tree has a smaller training error than the
    max_depth=2 tree;
  - at 150 trees nu 0.01 has the lowest AUC of the five book rates and the best AUC belongs
    to nu in {0.05, 0.1, 0.3}.
"""

import json
import math
import sys
import warnings
from pathlib import Path

import numpy as np
from sklearn.datasets import make_classification
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import log_loss, roc_auc_score
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.tree import DecisionTreeRegressor

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = "src/concepts/boosting/data/boosting.json"
FIXTURE_PATH = "tests/fixtures/boosting_sklearn.json"

BOOK_ERRORS = [0.2952, 0.2138, 0.1587, 0.1201, 0.0933]
BOOK_LRS = [0.01, 0.05, 0.1, 0.3, 0.5]
CURVE_LRS = [0.01, 0.05, 0.1, 0.3, 0.5, 1.0]
N_CURVE_TREES = 500
GRID_NUS = [0.05, 0.3, 1.0]
GRID_DEPTHS = [1, 2, 3]
GRID_TREES = 200
SURFACE_DEPTHS = [1, 2, 3, 4, 5, 6]
SURFACE_LRS = [float(v) for v in np.logspace(-2, 0, 9)]
SEARCH_BUDGET = 16
SEARCH_SEEDS = [0, 1, 2, 3, 4]
N_LR = 9
N_CELLS = 54
MASK = 0xFFFFFFFF
# Scores closer than this (relative) are a tie: mirror cells have mathematically equal scores
# that differ in the last bit between Python and JavaScript; the smaller index must win.
TIE_EPS = 1e-9


def fail(msg):
    print("CRITERION FAILED: " + msg)
    sys.exit(1)


def r4(v):
    return round(float(v), 4)


def r6(v):
    return round(float(v), 6)


# --------------------------------------------------------------------------- regression


def make_reg(seed):
    rng = np.random.RandomState(seed)
    x = np.sort(rng.rand(80, 1) * 10, axis=0)
    y = np.sin(x).ravel() + rng.normal(0, 0.1, 80)
    return np.round(x, 4), np.round(y, 4)


def mse(a, b):
    return float(np.mean((a - b) ** 2))


def hand_loop(x, y, xv, yv, nu, depth, m):
    """The book's loop; returns train and validation mean squared error after each tree."""
    mean = y.mean()
    f = np.full(y.shape, mean)
    fv = np.full(yv.shape, mean)
    train, val, trees = [], [], []
    for _ in range(m):
        tree = DecisionTreeRegressor(max_depth=depth, random_state=42).fit(x, y - f)
        f = f + nu * tree.predict(x)
        fv = fv + nu * tree.predict(xv)
        train.append(mse(y, f))
        val.append(mse(yv, fv))
        trees.append(tree)
    return train, val, trees


def tree_nodes(tree):
    t = tree.tree_
    out = []
    for i in range(t.node_count):
        leaf = t.children_left[i] == -1
        out.append({
            "t": 0.0 if leaf else float(t.threshold[i]),
            "l": -1 if leaf else int(t.children_left[i]),
            "r": -1 if leaf else int(t.children_right[i]),
            "v": float(t.value[i][0][0]),
        })
    return out


def in_order(tree):
    """Thresholds (sorted) and leaf values left to right."""
    t = tree.tree_
    thresholds, leaves = [], []

    def walk(i):
        if t.children_left[i] == -1:
            leaves.append(float(t.value[i][0][0]))
            return
        thresholds.append(float(t.threshold[i]))
        walk(t.children_left[i])
        walk(t.children_right[i])

    walk(0)
    return sorted(thresholds), leaves


# --------------------------------------------------------------------------- classification


def classification_curves():
    x, y = make_classification(n_samples=3000, n_features=15, n_informative=8, random_state=42)
    xa, xb, ya, yb = train_test_split(x, y, test_size=0.25, random_state=42)
    by_lr = []
    for lr in CURVE_LRS:
        gb = GradientBoostingClassifier(n_estimators=N_CURVE_TREES, max_depth=4,
                                        learning_rate=lr, random_state=42).fit(xa, ya)
        train_loss = [r6(log_loss(ya, p[:, 1])) for p in gb.staged_predict_proba(xa)]
        val_loss, val_auc = [], []
        for p in gb.staged_predict_proba(xb):
            val_loss.append(r6(log_loss(yb, p[:, 1])))
            val_auc.append(r4(roc_auc_score(yb, p[:, 1])))
        by_lr.append({"lr": lr, "trainLoss": train_loss, "valLoss": val_loss, "valAuc": val_auc})
    return {"lrs": CURVE_LRS, "byLr": by_lr}


def search_surface():
    x, y = make_classification(n_samples=800, n_features=15, n_informative=8, random_state=42)
    xa, _, ya, _ = train_test_split(x, y, test_size=0.2, random_state=42)
    auc = []
    for depth in SURFACE_DEPTHS:
        row = []
        for lr in SURFACE_LRS:
            gb = GradientBoostingClassifier(n_estimators=100, max_depth=depth,
                                            learning_rate=lr, random_state=42)
            row.append(r4(cross_val_score(gb, xa, ya, scoring="roc_auc", cv=3).mean()))
        auc.append(row)
    return {"depths": SURFACE_DEPTHS, "lrs": SURFACE_LRS, "auc": auc, "nTrees": 100, "cv": 3}


# --------------------------------------------------------------------------- search twin


def imul(a, b):
    return (a * b) & MASK


def mulberry32(seed):
    state = [seed & MASK]

    def nxt():
        state[0] = (state[0] + 0x6D2B79F5) & MASK
        t = state[0]
        t = imul(t ^ (t >> 15), t | 1)
        t ^= (t + imul(t ^ (t >> 7), t | 61)) & MASK
        return ((t ^ (t >> 14)) & MASK) / 4294967296

    return nxt


def kernel(a, b):
    d2 = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2
    return math.exp(-d2 / (2 * 0.2 * 0.2))


def coord(c):
    return (c // N_LR / 5, c % N_LR / 8)


def sequential_search(auc, budget, seed):
    rng = mulberry32(seed)
    flat = [v for row in auc for v in row]
    tried = []
    while len(tried) < min(3, budget):
        c = math.floor(rng() * N_CELLS)
        while c in tried:
            c = (c + 1) % N_CELLS
        tried.append(c)
    while len(tried) < budget:
        order = sorted(range(len(tried)), key=lambda k: (-flat[tried[k]], k))
        n_good = max(1, math.ceil(0.25 * len(tried)))
        good_set = set(order[:n_good])
        good = [tried[k] for k in range(len(tried)) if k in good_set]
        bad = [tried[k] for k in range(len(tried)) if k not in good_set]
        best, best_score = -1, 0.0
        for c in range(N_CELLS):
            if c in tried:
                continue
            kg = 0.0
            for g in good:
                kg += kernel(coord(c), coord(g))
            kb = 0.0
            for b in bad:
                kb += kernel(coord(c), coord(b))
            num = kg / len(good)
            den = (kb / len(bad) if bad else 0.0) + 1e-9
            score = num / den
            if best < 0 or score > best_score + TIE_EPS * max(1.0, abs(best_score)):
                best, best_score = c, score
        tried.append(best)
    return tried


# --------------------------------------------------------------------------- generate


def generate():
    x, y = make_reg(42)
    xv, yv = make_reg(7)
    mean = float(y.mean())

    # Book loop.
    book_train, _, book_trees = hand_loop(x, y, xv, yv, 0.3, 2, 5)
    book_mse = [r4(v) for v in book_train]
    if book_mse != BOOK_ERRORS:
        fail(f"book errors {book_mse} != {BOOK_ERRORS}")

    # Fixture: hand-loop grid.
    grid = []
    val_03_2 = None
    for nu in GRID_NUS:
        for depth in GRID_DEPTHS:
            train, val, _ = hand_loop(x, y, xv, yv, nu, depth, GRID_TREES)
            grid.append({"nu": nu, "depth": depth, "trainMse": train, "valMse": val})
            if nu == 0.3 and depth == 2:
                val_03_2 = val
    best = int(np.argmin(val_03_2)) + 1
    if not best < GRID_TREES:
        fail(f"nu 0.3 depth 2 validation minimum at tree {best}, not before {GRID_TREES}")

    # First residuals.
    r0 = y - mean
    tree_d2 = DecisionTreeRegressor(max_depth=2).fit(x, r0)
    tree_l4 = DecisionTreeRegressor(max_leaf_nodes=4).fit(x, r0)
    err_d2 = mse(r0, tree_d2.predict(x))
    err_l4 = mse(r0, tree_l4.predict(x))
    if not err_l4 < err_d2:
        fail(f"leaf-wise 4 leaves error {err_l4} is not below level-wise {err_d2}")
    first = {}
    for name, tree, err in (("depth2", tree_d2, err_d2), ("leaf4", tree_l4, err_l4)):
        thresholds, leaves = in_order(tree)
        first[name] = {"thresholds": thresholds, "leaves": leaves, "train": err}

    # Fixture: max_leaf_nodes table.
    def leaf_row(limit):
        tree = DecisionTreeRegressor(max_leaf_nodes=limit).fit(x, r0)
        return {
            "limit": limit,
            "leaves": int(tree.get_n_leaves()),
            "depth": int(tree.get_depth()),
            "train": mse(r0, tree.predict(x)),
            "val": mse(yv - mean, tree.predict(xv)),
        }

    max_leaves = [leaf_row(k) for k in range(2, 65)]
    beyond = leaf_row(200)

    # Classification curves.
    curves = classification_curves()
    auc150 = [curves["byLr"][CURVE_LRS.index(lr)]["valAuc"][149] for lr in BOOK_LRS]
    if auc150.index(min(auc150)) != 0:
        fail(f"nu 0.01 is not the lowest AUC at 150 trees: {auc150}")
    if BOOK_LRS[auc150.index(max(auc150))] not in (0.05, 0.1, 0.3):
        fail(f"best AUC at 150 trees is not in nu 0.05 / 0.1 / 0.3: {auc150}")

    surface = search_surface()

    # Search twin.
    search = [{"seed": s, "order": sequential_search(surface["auc"], SEARCH_BUDGET, s)}
              for s in SEARCH_SEEDS]
    mulberry = []
    for seed in (0, 12345):
        rng = mulberry32(seed)
        mulberry.append({"seed": seed, "values": [rng() for _ in range(5)]})

    log_best = int(np.argmin(curves["byLr"][CURVE_LRS.index(0.3)]["valLoss"])) + 1
    print("book errors", book_mse)
    print("nu 0.3 depth 2 validation minimum at tree", best, "=", r4(val_03_2[best - 1]),
          "; tree 200:", r4(val_03_2[-1]))
    print("first residuals: depth2", [round(t, 3) for t in first["depth2"]["thresholds"]],
          "mse", round(err_d2, 4), "; leaf4", [round(t, 3) for t in first["leaf4"]["thresholds"]],
          "mse", round(err_l4, 4))
    print("150-tree AUC for nu", BOOK_LRS, auc150)
    print("nu 0.3 classifier validation log-loss minimum at tree", log_best)
    print("search orders", [s["order"] for s in search])

    data = {
        "reg": {
            "train": {"x": [r4(v) for v in x.ravel()], "y": [r4(v) for v in y]},
            "val": {"x": [r4(v) for v in xv.ravel()], "y": [r4(v) for v in yv]},
            "mean": mean,
        },
        "book": {"nu": 0.3, "depth": 2, "mse": book_mse,
                 "trees": [tree_nodes(t) for t in book_trees]},
        "curves": curves,
        "surface": surface,
    }
    fixture = {
        "grid": grid,
        "firstResiduals": first,
        "maxLeaves": max_leaves,
        "beyond": beyond,
        "mulberry": mulberry,
        "search": {"budget": SEARCH_BUDGET, "runs": search},
    }
    return data, fixture


def render(content):
    return json.dumps(content, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
                      allow_nan=False) + "\n"


if __name__ == "__main__":
    data, fixture = generate()
    files = {DATA_PATH: render(data), FIXTURE_PATH: render(fixture)}
    if "--check" in sys.argv:
        stale = [p for p, text in files.items()
                 if not (ROOT / p).exists() or (ROOT / p).read_bytes() != text.encode("utf-8")]
        if stale:
            print("Out of date: " + ", ".join(stale))
            sys.exit(1)
        print("boosting data up to date")
    else:
        for p, text in files.items():
            path = ROOT / p
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(text.encode("utf-8"))
            print(f"Generated {p}")
