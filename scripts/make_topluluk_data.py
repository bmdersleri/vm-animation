"""Generate Chapter 9 (topluluk ogrenmesi / ensemble learning) data and fixture.

Run:   python scripts/make_topluluk_data.py
Check: python scripts/make_topluluk_data.py --check   (writes nothing; exit 1 on drift)

Writes (relative to the repo root):
  src/concepts/topluluk/data/topluluk.json   what the pages draw (customers, trees, numbers)
  tests/fixtures/topluluk_sklearn.json       what the unit tests compare the TS maths against

Data (topluluk.json):
  customers   the 25 training customers of the Chapter 5 page, read from
              src/concepts/karar-agaci/data/churn_tree.json (that file is never changed).
  single      the full-depth gini tree (DecisionTreeClassifier(random_state=0)) on all 25
              customers; its predictions must equal the unlimited-depth gini tree of
              tests/fixtures/karar-agaci_sklearn.json on the grid and on the customers.
  boots       50 bootstrap trees. Bootstrap k is rng.integers(0, 25, 25) from one
              np.random.default_rng(seed), drawn tree after tree; the tree is the same
              full-depth gini tree fitted on the drawn rows (repeats are repeated rows).
              Node layout is scikit-learn's: f = -1 at a leaf, x[f] <= t goes left,
              v = [Kaldi, Ayrildi] training counts (leaf fields t, l, r are 0, -1, -1).
  bookBoot    the book's ch09_kod01 bootstrap (default_rng(42).choice on ids 0-9).
  experiment  ch09_kod02: 10 splits, single tree vs BaggingClassifier(50 trees) accuracy.
  oobCv       ch09_kod04: OOB score and the 5 CV scores of a 300-tree forest; the seconds
              are the book's measured 0.27 / 1.33 from one run (book v0.2; written as
              constants, the page reads them as approximate).
  oobCurve    OOB score of RandomForestClassifier(oob_score=True, random_state=3) for
              n_estimators = 10, 20, ..., 500 on the ch09_kod04 data.
  rf          ch09_kod05 data (600 x 8). byMf: max_features 1..8 with 250 trees:
              roots = how many trees split on each feature at the root and oob = OOB score
              (both on all 600 rows); test, treeAcc and rho on the stratified 75/25 split
              (random_state 21): test = forest accuracy, treeAcc = mean single-tree accuracy,
              rho = mean off-diagonal np.corrcoef of the trees' predict_proba[:, 1] on the
              test set (trees that predict a constant are left out of rho; the count is
              printed, normally 0). mdi = feature_importances_ of the book's forest (all 600
              rows). withId adds a meaningless last column musteriNo (a permutation of
              0..599, default_rng(21)); MDI and permutation importance (n_repeats 10,
              random_state 21, test set) of a 250-tree forest fitted on the train split.
  picks       vote: the Ayrildi customer whose 50-tree vote is the most balanced while the
              majority still says Ayrildi (fewest Ayrildi votes above 25, lowest index on a tie;
              exactly 25 would be a tie that goes to Kaldi). oob: the first customer with at least
              3 OOB votes among the first 12 trees.
  nodeDemo    default_rng(21).choice(8, 2, replace=False) (sorted) are the features a node
              of the page-2 demo may look at; winner = the feature index of the root of
              DecisionTreeClassifier(max_depth=1, random_state=21) on those two columns of
              the 600 x 8 data.

Fixture (topluluk_sklearn.json):
  grid        24 x 24 cell centres over the Chapter 5 plot domain (x 0-60, y -0.5..5.5), row 0
              = top; pred[tree][row * 24 + col] is the sklearn predict of each of the 50 trees.
  custPred    predict of each of the 50 trees on each customer.
  votes       votes[customer][M - 1] = Ayrildi votes of the first M trees (M = 1..50).
  oobAyrildi / oobKaldi   the same for the trees that did not draw the customer.
  oobScore    oobScore[M - 1] = { correct, total } over customers with at least one OOB vote
              (majority of OOB votes, ties go to Kaldi).

Seed search: seeds 0, 1, 2, ... and the first one meeting every condition is kept:
  - the first three bootstrap trees have pairwise different root splits (feature or threshold);
  - the first bootstrap leaves 28-44 % of the customers out (7-11 of 25);
  - the 50-tree majority map on the grid has both classes and differs from the single tree
    at least at one customer.

Book numbers checked (the generator exits 1 with the failing one, it never changes the data):
  bootstrap sample [0 7 6 4 4 8 0 6 2 0], OOB [1 3 5 9];
  ch09_kod02 mean / std 0.749 / 0.033 and 0.835 / 0.028;
  ch09_kod04 OOB 0.899, CV mean 0.896; 10 trees OOB 0.798;
  ch09_kod05 importances hizmetSayisi 0.176 ... sozlesmeTipi 0.048 in that order.
Numbers are rounded to 6 decimals once; the browser uses the rounded numbers.
"""

import json
import sys
import warnings
from pathlib import Path

import numpy as np
import sklearn
from sklearn.datasets import make_classification
from sklearn.ensemble import BaggingClassifier, RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.tree import DecisionTreeClassifier

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = "src/concepts/topluluk/data/topluluk.json"
FIXTURE_PATH = "tests/fixtures/topluluk_sklearn.json"
CHURN_PATH = "src/concepts/karar-agaci/data/churn_tree.json"
TREE_FIXTURE_PATH = "tests/fixtures/karar-agaci_sklearn.json"

N_TREES = 50
N_CUST = 25
GRID = 24
# Plot domain of the Chapter 5 page (src/concepts/karar-agaci/data.ts DOMAIN).
DOM_X = (0.0, 60.0)
DOM_Y = (-0.5, 5.5)
MAX_SEEDS = 100_000
NAMES = ["musteriSuresi_ay", "aylikUcret", "toplamUcret", "sozlesmeTipi",
         "internetHizi", "destekCagriSayisi", "faturaOdemeGecikmesi", "hizmetSayisi"]
BOOK_MDI = [("hizmetSayisi", 0.176), ("faturaOdemeGecikmesi", 0.174), ("internetHizi", 0.150),
            ("destekCagriSayisi", 0.142), ("musteriSuresi_ay", 0.135), ("toplamUcret", 0.121),
            ("aylikUcret", 0.055), ("sozlesmeTipi", 0.048)]


def fail(msg):
    print("CRITERION FAILED: " + msg)
    sys.exit(1)


def r6(x):
    return round(float(x), 6)


# --------------------------------------------------------------------------- trees


def fit_tree(X, y):
    return DecisionTreeClassifier(random_state=0).fit(X, y)


def tree_json(clf):
    """scikit-learn node layout; v = [Kaldi, Ayrildi] counts."""
    t = clf.tree_
    out = []
    for i in range(t.node_count):
        counts = np.zeros(2)
        counts[clf.classes_.astype(int)] = t.value[i][0] * t.n_node_samples[i]
        v = [int(round(c)) for c in counts]
        if t.children_left[i] == -1:
            out.append({"f": -1, "t": 0, "l": -1, "r": -1, "v": v})
        else:
            out.append({"f": int(t.feature[i]), "t": float(t.threshold[i]),
                        "l": int(t.children_left[i]), "r": int(t.children_right[i]), "v": v})
    return out


def grid_points():
    """Cell centres, row 0 = top of the plot (the order GridLayer fills)."""
    xs = [DOM_X[0] + (c + 0.5) / GRID * (DOM_X[1] - DOM_X[0]) for c in range(GRID)]
    ys = [DOM_Y[1] - (r + 0.5) / GRID * (DOM_Y[1] - DOM_Y[0]) for r in range(GRID)]
    pts = np.array([[x, y] for y in ys for x in xs])
    return xs, ys, pts


def fixture_tree_predict(node, x):
    while node["feature"] != -1:
        node = node["left"] if x[node["feature"]] <= node["threshold"] else node["right"]
    c = node["counts"]
    return 1 if c[1] > c[0] else 0


# --------------------------------------------------------------------------- seed search


def draws_for(seed):
    rng = np.random.default_rng(seed)
    return [rng.integers(0, N_CUST, N_CUST) for _ in range(N_TREES)]


def check_seed(seed, X, y, single_cust, pts):
    draws = draws_for(seed)
    oob_first = int(np.sum(np.bincount(draws[0], minlength=N_CUST) == 0))
    if not 7 <= oob_first <= 11:
        return None
    trees = []
    for d in draws:
        trees.append(fit_tree(X[d], y[d]))
    roots = [(int(c.tree_.feature[0]), float(c.tree_.threshold[0])) for c in trees[:3]]
    if len(set(roots)) < 3:
        return None
    grid_votes = sum(c.predict(pts) for c in trees)
    grid_major = (grid_votes * 2 > N_TREES).astype(int)
    if len(set(grid_major.tolist())) < 2:
        return None
    cust_votes = sum(c.predict(X) for c in trees)
    cust_major = (cust_votes * 2 > N_TREES).astype(int)
    if not np.any(cust_major != single_cust):
        return None
    return draws, trees


# --------------------------------------------------------------------------- book checks


def book_bootstrap():
    rng = np.random.default_rng(42)
    ids = np.arange(10)
    sample = rng.choice(ids, size=10, replace=True)
    if sample.tolist() != [0, 7, 6, 4, 4, 8, 0, 6, 2, 0]:
        fail(f"book bootstrap sample {sample.tolist()}")
    counts = np.bincount(sample, minlength=10)
    oob = sorted(set(ids.tolist()) - set(sample.tolist()))
    if oob != [1, 3, 5, 9]:
        fail(f"book OOB {oob}")
    return {"ids": ids.tolist(), "sample": sample.tolist(), "counts": counts.tolist(), "oob": oob}


def experiment():
    X, y = make_classification(n_samples=500, n_features=10, n_informative=6,
                               n_redundant=2, random_state=7)
    tree_acc = []
    bag_acc = []
    for s in range(10):
        xtr, xte, ytr, yte = train_test_split(X, y, test_size=0.3, random_state=s)
        tree = DecisionTreeClassifier(random_state=s).fit(xtr, ytr)
        tree_acc.append(float(np.mean(tree.predict(xte) == yte)))
        bag = BaggingClassifier(estimator=DecisionTreeClassifier(), n_estimators=50,
                                random_state=s).fit(xtr, ytr)
        bag_acc.append(float(np.mean(bag.predict(xte) == yte)))
    got = (round(np.mean(tree_acc), 3), round(np.std(tree_acc), 3),
           round(np.mean(bag_acc), 3), round(np.std(bag_acc), 3))
    if got != (0.749, 0.033, 0.835, 0.028):
        fail(f"ch09_kod02 mean/std {got}")
    return {"tree": [r6(a) for a in tree_acc], "bagging": [r6(a) for a in bag_acc]}


def oob_cv():
    X, y = make_classification(n_samples=1000, n_features=15, n_informative=10, random_state=3)
    forest = RandomForestClassifier(n_estimators=300, oob_score=True, random_state=3).fit(X, y)
    cv = cross_val_score(RandomForestClassifier(n_estimators=300, random_state=3), X, y, cv=5)
    if round(forest.oob_score_, 3) != 0.899:
        fail(f"ch09_kod04 OOB {forest.oob_score_}")
    if round(float(cv.mean()), 3) != 0.896:
        fail(f"ch09_kod04 CV mean {cv.mean()}")
    return {"oob": r6(forest.oob_score_), "cv": [r6(c) for c in cv],
            "seconds": {"oob": 0.27, "cv": 1.33}}, X, y


def oob_curve(X, y):
    curve = []
    for n in range(10, 501, 10):
        f = RandomForestClassifier(n_estimators=n, oob_score=True, random_state=3).fit(X, y)
        curve.append({"n": n, "oob": r6(f.oob_score_)})
    if round(curve[0]["oob"], 3) != 0.798:
        fail(f"10-tree OOB {curve[0]['oob']}")
    return curve


def mean_offdiag(probs):
    keep = [p for p in probs if np.std(p) > 0]
    c = np.corrcoef(np.array(keep))
    n = len(keep)
    return float((c.sum() - n) / (n * (n - 1))), len(probs) - n


def random_forest():
    X, y = make_classification(n_samples=600, n_features=8, n_informative=5,
                               n_redundant=1, random_state=21)
    book = RandomForestClassifier(n_estimators=250, random_state=21).fit(X, y)
    mdi = book.feature_importances_
    order = [NAMES[i] for i in np.argsort(-mdi, kind="stable")]
    if order != [n for n, _ in BOOK_MDI]:
        fail(f"ch09_kod05 MDI order {order}")
    for name, want in BOOK_MDI:
        got = round(float(mdi[NAMES.index(name)]), 3)
        if got != want:
            fail(f"ch09_kod05 {name} {got}, book says {want}")
    xtr, xte, ytr, yte = train_test_split(X, y, test_size=0.25, random_state=21, stratify=y)
    by_mf = []
    for mf in range(1, 9):
        kw = dict(n_estimators=250, random_state=21, max_features=mf)
        full = RandomForestClassifier(oob_score=True, **kw).fit(X, y)
        roots = np.bincount([int(e.tree_.feature[0]) for e in full.estimators_], minlength=8)
        part = RandomForestClassifier(**kw).fit(xtr, ytr)
        probs = [e.predict_proba(xte)[:, 1] for e in part.estimators_]
        rho, dropped = mean_offdiag(probs)
        tree_acc = float(np.mean([np.mean(e.predict(xte) == yte) for e in part.estimators_]))
        if dropped:
            print(f"  max_features {mf}: {dropped} constant trees left out of rho")
        by_mf.append({"mf": mf, "roots": roots.tolist(), "oob": r6(full.oob_score_),
                      "test": r6(part.score(xte, yte)), "treeAcc": r6(tree_acc), "rho": r6(rho)})
    ids = np.random.default_rng(21).permutation(600)
    X2 = np.column_stack([X, ids])
    x2tr, x2te, y2tr, y2te = train_test_split(X2, y, test_size=0.25, random_state=21, stratify=y)
    f2 = RandomForestClassifier(n_estimators=250, random_state=21).fit(x2tr, y2tr)
    perm = permutation_importance(f2, x2te, y2te, n_repeats=10, random_state=21)
    rf = {"names": NAMES, "byMf": by_mf, "mdi": [r6(v) for v in mdi],
          "withId": {"names": NAMES + ["musteriNo"],
                     "mdi": [r6(v) for v in f2.feature_importances_],
                     "perm": [r6(v) for v in perm.importances_mean]}}
    return rf, X, y


def node_demo(X, y):
    drawn = sorted(int(i) for i in np.random.default_rng(21).choice(8, size=2, replace=False))
    stump = DecisionTreeClassifier(max_depth=1, random_state=21).fit(X[:, drawn], y)
    return {"drawn": drawn, "winner": drawn[int(stump.tree_.feature[0])]}


# --------------------------------------------------------------------------- generate


def generate():
    churn = json.loads((ROOT / CHURN_PATH).read_text(encoding="utf-8"))["train"]
    if len(churn) != N_CUST:
        fail(f"{len(churn)} training customers, expected {N_CUST}")
    X = np.array([[r["t"], r["c"]] for r in churn], dtype=float)
    y = np.array([r["y"] for r in churn])
    xs, ys, pts = grid_points()

    single = fit_tree(X, y)
    ref = json.loads((ROOT / TREE_FIXTURE_PATH).read_text(encoding="utf-8"))["trees"]["gini"]["null"]
    want_grid = [fixture_tree_predict(ref, p) for p in pts]
    want_cust = [fixture_tree_predict(ref, p) for p in X]
    if single.predict(pts).tolist() != want_grid or single.predict(X).tolist() != want_cust:
        fail("single tree differs from the Chapter 5 unlimited-depth gini tree")
    if single.predict(X).tolist() != y.tolist():
        fail("single tree does not fit all 25 customers")
    single_cust = single.predict(X)

    found = None
    for seed in range(MAX_SEEDS):
        found = check_seed(seed, X, y, single_cust, pts)
        if found:
            break
    if not found:
        fail(f"no seed below {MAX_SEEDS} meets the selection conditions")
    draws, trees = found
    print(f"bootstrap seed {seed}")

    boots = [{"draws": d.tolist(), "counts": np.bincount(d, minlength=N_CUST).tolist(),
              "tree": tree_json(c)} for d, c in zip(draws, trees)]

    grid_pred = [c.predict(pts).astype(int).tolist() for c in trees]
    cust_pred = np.array([c.predict(X).astype(int) for c in trees])  # [tree][customer]
    counts = np.array([b["counts"] for b in boots])  # [tree][customer]
    votes = []
    oob_a = []
    oob_k = []
    for i in range(N_CUST):
        votes.append(np.cumsum(cust_pred[:, i]).tolist())
        out = counts[:, i] == 0
        oob_a.append(np.cumsum(out & (cust_pred[:, i] == 1)).tolist())
        oob_k.append(np.cumsum(out & (cust_pred[:, i] == 0)).tolist())
    oob_score = []
    for m in range(N_TREES):
        correct = 0
        total = 0
        for i in range(N_CUST):
            a = oob_a[i][m]
            k = oob_k[i][m]
            if a + k == 0:
                continue
            total += 1
            correct += int((1 if a > k else 0) == y[i])
        oob_score.append({"correct": correct, "total": total})

    vote_pick = None
    for i in range(N_CUST):
        if y[i] == 1 and votes[i][-1] > N_TREES // 2 and (vote_pick is None or abs(votes[i][-1] - 25) < abs(votes[vote_pick][-1] - 25)):
            vote_pick = i
    oob_pick = next((i for i in range(N_CUST) if oob_a[i][11] + oob_k[i][11] >= 3), None)
    if vote_pick is None or oob_pick is None:
        fail("no customer for the PICKS")
    print(f"picks vote {vote_pick} ({votes[vote_pick][-1]} / 50), oob {oob_pick}")

    oob_cv_data, ox, oy = oob_cv()
    rf, rx, ry = random_forest()
    demo = node_demo(rx, ry)
    print(f"nodeDemo {demo}")
    data = {
        "meta": {"sklearn": sklearn.__version__, "numpy": np.__version__, "seed": seed},
        "customers": [{"t": r["t"], "c": r["c"], "y": r["y"], "jy": r["jy"]} for r in churn],
        "single": tree_json(single),
        "boots": boots,
        "bookBoot": book_bootstrap(),
        "experiment": experiment(),
        "oobCv": oob_cv_data,
        "oobCurve": oob_curve(ox, oy),
        "rf": rf,
        "picks": {"vote": vote_pick, "oob": oob_pick},
        "nodeDemo": demo,
    }
    fixture = {
        "grid": {"cols": GRID, "rows": GRID, "xs": xs, "ys": ys, "pred": grid_pred},
        "custPred": cust_pred.tolist(),
        "votes": votes,
        "oobAyrildi": oob_a,
        "oobKaldi": oob_k,
        "oobScore": oob_score,
    }
    return data, fixture


def render(content):
    return json.dumps(content, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n"


if __name__ == "__main__":
    data, fixture = generate()
    files = {DATA_PATH: render(data), FIXTURE_PATH: render(fixture)}
    if "--check" in sys.argv:
        stale = [p for p, text in files.items()
                 if not (ROOT / p).exists() or (ROOT / p).read_bytes() != text.encode("utf-8")]
        if stale:
            print("Out of date: " + ", ".join(stale))
            sys.exit(1)
        print("topluluk data up to date")
    else:
        for p, text in files.items():
            path = ROOT / p
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(text.encode("utf-8"))
            print(f"Generated {p}")
