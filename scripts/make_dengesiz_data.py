"""Generate Chapter 11 (imbalanced data, SMOTE leakage) data and the sklearn test fixture.

Run:   python scripts/make_dengesiz_data.py
Check: python scripts/make_dengesiz_data.py --check   (writes nothing; exit 1 on drift)

Reads (relative to the repo root):
  scripts/data/telco_churn_synthetic_severe.csv   byte-for-byte copy of the book dataset

Writes (relative to the repo root):
  src/concepts/dengesiz/data/dengesiz.json   data the two pages draw
  tests/fixtures/dengesiz_sklearn.json       sklearn numbers the TS maths is compared with

Warnings: the book code LogisticRegression(max_iter=1000) on unscaled data emits a
ConvergenceWarning. That is expected; the generator silences all warnings so its output stays
clean. The results are still deterministic.

SMOTE: imbalanced-learn is not installed and must not be. smote() below is hand-written and
has a TypeScript twin (src/concepts/dengesiz/smote.ts). Xm = minority rows in data order;
neighbours by squared Euclidean distance with a stable sort (ties: smaller index), the point
itself left out, first k kept. For every new point, in order: i = int(r() * n),
j = nb[i][int(r() * k)], lam = r(), x = Xm[i] + lam * (Xm[j] - Xm[i]); r = mulberry32(seed).
The number of new points is majority - minority (ratio 1.0).

Data (dengesiz.json; coordinates and scores 6 decimals, PR-AUCs 4 decimals):
  customers  Columnar: tenure, charge (MonthlyCharges), churn (Churn == "Yes"), test
             (1 = in the stratified 70/30 test split, train_test_split(range(2000),
             test_size=0.30, stratify=y, random_state=42), both parts kept in data order).
  scale      Training mean and std (ddof 0, full precision) of the two features
             (StandardScaler).
  book01     Book code 01: LogisticRegression(max_iter=1000) on the 8 unscaled features,
             test matrix at 0.5, minority-row metrics.
  models2d   Two features (tenure, charge) standardised on the training part;
             LogisticRegression(C=1.0, tol=1e-10, max_iter=10000): base (no weights), smote
             (k 5, seed 42, ratio 1.0, in the standardised space), weighted
             (class_weight="balanced"). Coefficients, intercept, test matrix at 0.5, test
             PR-AUC.
  leak       Book code 02 for seeds 42 and 0..4. Leaky: SMOTE (8 features, unscaled, k 5) on
             the whole data, then train_test_split(test_size=0.30, random_state=42) without
             stratify, LogisticRegression(max_iter=1000). Per run: test rows, positives,
             synthetic positives, synthetic test points with a parent (i or j) in training,
             test scores and labels, PR-AUC. Honest: stratified split, SMOTE on the training
             part only (same seed), same model. example = first synthetic test row (seed 42)
             whose both parents are in the leaky training part and whose tenure is 6..66 and
             charge 30..110: point (tenure, charge) and the two parent customer indexes.
  cv         Book code 03: StratifiedKFold(5, shuffle=True, random_state=42); each fold:
             StandardScaler -> SMOTE (seed 42) -> LogisticRegression(max_iter=1000,
             random_state=42); fold PR-AUC, mean, training / SMOTE / validation counts.
  compare    Book codes 04 / 05 on the stratified split: base (unscaled), smote (scaled
             pipeline, seed 42), weighted (class_weight="balanced", unscaled); test scores
             and PR-AUC; kod05 matrix at 0.5.

Fixture (dengesiz_sklearn.json):
  mulberry   First 5 values of mulberry32 for seeds 0 and 12345.
  smote      The standardised training minority points and, for seeds 42 and 7 times k in
             {1, 5}, the first 20 new points (i, j, lambda, x, y), full precision.
  logreg     Coefficients and intercept (full precision, tol 1e-10) of the base, smote,
             balanced and manual weight 20 (class_weight {0: 1, 1: 20}) two-feature models,
             with the test matrix at 0.5 and PR-AUC.
  ap         average_precision_score of the leaky and honest runs (full precision, computed
             on the stored 6-decimal scores).

Checks (the generator exits 1 on the first failing one, never changes data):
  - 2000 rows, 124 churners; training 1313 / 87, test 563 / 37;
  - code 01 matrix [[563, 0], [37, 0]];
  - code 04 PR-AUC is 0.173 at 3 decimals;
  - seed 42: leaky PR-AUC > 0.5 and at least 3 times the honest one;
  - the two-feature base model says "churn" for nobody in the test part;
  - the two-feature smote and weighted PR-AUCs differ from the base one by at most 0.01.
"""

import json
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, confusion_matrix
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = "scripts/data/telco_churn_synthetic_severe.csv"
DATA_PATH = "src/concepts/dengesiz/data/dengesiz.json"
FIXTURE_PATH = "tests/fixtures/dengesiz_sklearn.json"

MASK = 0xFFFFFFFF
LEAK_SEEDS = [42, 0, 1, 2, 3, 4]
SMOTE_K = 5
SMOTE_SEED = 42
FIXTURE_SEEDS = [42, 7]
FIXTURE_KS = [1, 5]
FIXTURE_NEW = 20


def fail(msg):
    print("CRITERION FAILED: " + msg)
    sys.exit(1)


def r4(v):
    return round(float(v), 4)


def r6(v):
    return round(float(v), 6)


# --------------------------------------------------------------------------- random + SMOTE


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


def neighbours(xm, k):
    """For every row the k nearest other rows (squared Euclidean, stable order)."""
    n = len(xm)
    k = min(k, n - 1)
    out = []
    for i in range(n):
        d2 = ((xm - xm[i]) ** 2).sum(axis=1)
        order = np.argsort(d2, kind="stable")
        out.append([int(j) for j in order if j != i][:k])
    return out


def smote(xm, k, n_new, seed):
    """Hand-written SMOTE; returns the new points and their (i, j, lam)."""
    nb = neighbours(xm, k)
    kk = len(nb[0])
    n = len(xm)
    r = mulberry32(seed)
    points, info = [], []
    for _ in range(n_new):
        i = int(r() * n)
        j = nb[i][int(r() * kk)]
        lam = r()
        points.append(xm[i] + lam * (xm[j] - xm[i]))
        info.append((i, j, lam))
    if not points:
        return np.zeros((0, xm.shape[1])), info
    return np.array(points), info


def oversample(x, y, k, seed):
    """x, y with the minority class (1) topped up to the majority size; new rows last."""
    xm = x[y == 1]
    n_new = int((y == 0).sum() - (y == 1).sum())
    new, info = smote(xm, k, n_new, seed)
    x2 = np.vstack([x, new]) if len(new) else x
    y2 = np.concatenate([y, np.ones(len(new), dtype=int)])
    return x2, y2, info


# --------------------------------------------------------------------------- helpers


def load():
    df = pd.read_csv(ROOT / CSV_PATH)
    y = (df["Churn"] == "Yes").astype(int).to_numpy()
    num = df[["tenure", "MonthlyCharges", "TotalCharges"]]
    cat = pd.get_dummies(df[["Contract", "InternetService", "TeknikDestek"]], drop_first=True)
    x = pd.concat([num, cat], axis=1).astype(float).to_numpy()
    return df, x, y


def ap_of(y_true, scores):
    return float(average_precision_score(y_true, scores))


def matrix_of(y_true, scores, threshold=0.5):
    pred = (scores >= threshold).astype(int)
    m = confusion_matrix(y_true, pred, labels=[0, 1])
    return {"tn": int(m[0, 0]), "fp": int(m[0, 1]), "fn": int(m[1, 0]), "tp": int(m[1, 1])}


def rounded(scores):
    return [r6(v) for v in scores]


def fit_lr(x, y, **kw):
    return LogisticRegression(**kw).fit(x, y)


def lr_numbers(model):
    return {"coef": [float(v) for v in model.coef_[0]], "intercept": float(model.intercept_[0])}


# --------------------------------------------------------------------------- generation


def generate():
    df, x, y = load()
    if len(df) != 2000 or int(y.sum()) != 124:
        fail(f"rows / churners {len(df)} / {int(y.sum())} != 2000 / 124")

    idx = np.arange(2000)
    tr, te = train_test_split(idx, test_size=0.30, stratify=y, random_state=42)
    tr, te = np.sort(tr), np.sort(te)  # data order: the minority rows and the scores line up
    xtr, xte, ytr, yte = x[tr], x[te], y[tr], y[te]
    counts = (int((ytr == 0).sum()), int((ytr == 1).sum()), int((yte == 0).sum()),
              int((yte == 1).sum()))
    if counts != (1313, 87, 563, 37):
        fail(f"train / test counts {counts} != (1313, 87, 563, 37)")
    test_flag = np.zeros(2000, dtype=int)
    test_flag[te] = 1

    # kod01
    base8 = fit_lr(xtr, ytr, max_iter=1000)
    s01 = base8.predict_proba(xte)[:, 1]
    m01 = matrix_of(yte, s01)
    if m01 != {"tn": 563, "fp": 0, "fn": 37, "tp": 0}:
        fail(f"kod01 matrix {m01} != [[563, 0], [37, 0]]")
    book01 = {
        "matrix": m01,
        "precision": None,
        "recall": 0.0,
        "f1": 0.0,
        "accuracy": r4((m01["tn"] + m01["tp"]) / 600),
    }

    # Two-feature models.
    f2 = x[:, :2]
    scaler = StandardScaler().fit(f2[tr])
    mean = [float(v) for v in scaler.mean_]
    std = [float(v) for v in scaler.scale_]
    z = scaler.transform(f2)
    ztr, zte = z[tr], z[te]
    zs, ys, _ = oversample(ztr, ytr, SMOTE_K, SMOTE_SEED)
    kw2 = dict(C=1.0, tol=1e-10, max_iter=10000)
    m_base = fit_lr(ztr, ytr, **kw2)
    m_smote = fit_lr(zs, ys, **kw2)
    m_bal = fit_lr(ztr, ytr, class_weight="balanced", **kw2)
    m_w20 = fit_lr(ztr, ytr, class_weight={0: 1, 1: 20}, **kw2)
    models2d, logreg = {}, {}
    for name, model in (("base", m_base), ("smote", m_smote), ("weighted", m_bal),
                        ("weight20", m_w20)):
        s = model.predict_proba(zte)[:, 1]
        mx = matrix_of(yte, s)
        ap = ap_of(yte, s)
        nums = lr_numbers(model)
        logreg[name] = {**nums, "matrix": mx, "ap": ap}
        if name != "weight20":
            models2d[name] = {"coef": [r6(v) for v in nums["coef"]],
                              "intercept": r6(nums["intercept"]), "matrix": mx, "ap": r4(ap)}
    if models2d["base"]["matrix"]["fp"] + models2d["base"]["matrix"]["tp"] != 0:
        fail(f"two-feature base model predicts churn: {models2d['base']['matrix']}")
    for name in ("smote", "weighted"):
        if abs(logreg[name]["ap"] - logreg["base"]["ap"]) > 0.01:
            fail(f"two-feature {name} AP {logreg[name]['ap']} vs base {logreg['base']['ap']}")

    # kod02: leakage experiment.
    leak_runs = []
    example = None
    ap_fix = []
    minority_idx = np.where(y == 1)[0]
    for seed in LEAK_SEEDS:
        xl, yl, info = oversample(x, y, SMOTE_K, seed)
        ids = np.arange(len(yl))
        ltr, lte = train_test_split(ids, test_size=0.30, random_state=42)
        in_train = np.zeros(len(yl), dtype=bool)
        in_train[ltr] = True
        mdl = fit_lr(xl[ltr], yl[ltr], max_iter=1000)
        sl = rounded(mdl.predict_proba(xl[lte])[:, 1])
        yt = yl[lte]
        ap_leaky = ap_of(yt, sl)
        synth = [int(t) for t in lte if t >= 2000]
        parent_in = 0
        for t in synth:
            pa = int(minority_idx[info[t - 2000][0]])
            pb = int(minority_idx[info[t - 2000][1]])
            if in_train[pa] or in_train[pb]:
                parent_in += 1
        if seed == SMOTE_SEED:
            for t in synth:
                pa = int(minority_idx[info[t - 2000][0]])
                pb = int(minority_idx[info[t - 2000][1]])
                ten, chg = xl[t][0], xl[t][1]
                if in_train[pa] and in_train[pb] and 6 <= ten <= 66 and 30 <= chg <= 110:
                    example = {"point": [r6(ten), r6(chg)], "parents": [pa, pb]}
                    break
        # Honest path: stratified split, SMOTE on the training part only.
        xh, yh, _ = oversample(xtr, ytr, SMOTE_K, seed)
        hm = fit_lr(xh, yh, max_iter=1000)
        sh = rounded(hm.predict_proba(xte)[:, 1])
        ap_honest = ap_of(yte, sh)
        leak_runs.append({
            "seed": seed,
            "leaky": {"n": int(len(lte)), "pos": int(yt.sum()), "synthPos": len(synth),
                      "parentInTrain": parent_in, "scores": sl,
                      "actual": [int(v) for v in yt], "ap": r4(ap_leaky)},
            "honest": {"scores": sh, "actual": [int(v) for v in yte], "ap": r4(ap_honest)},
        })
        ap_fix.append({"seed": seed, "leaky": ap_leaky, "honest": ap_honest})
    if example is None:
        fail("no leak example with both parents in training and a readable projection")
    run42 = leak_runs[0]
    if not (run42["leaky"]["ap"] > 0.5 and run42["leaky"]["ap"] >= 3 * run42["honest"]["ap"]):
        fail(f"seed 42 leaky {run42['leaky']['ap']} vs honest {run42['honest']['ap']}")

    # kod03: pipeline cross validation.
    folds = []
    for ftr, fva in StratifiedKFold(5, shuffle=True, random_state=42).split(x, y):
        sc = StandardScaler().fit(x[ftr])
        a, b = sc.transform(x[ftr]), sc.transform(x[fva])
        a2, y2, _ = oversample(a, y[ftr], SMOTE_K, SMOTE_SEED)
        mdl = fit_lr(a2, y2, max_iter=1000, random_state=42)
        ap = ap_of(y[fva], mdl.predict_proba(b)[:, 1])
        folds.append({
            "trainNeg": int((y[ftr] == 0).sum()), "trainPos": int((y[ftr] == 1).sum()),
            "smoteNeg": int((y2 == 0).sum()), "smotePos": int((y2 == 1).sum()),
            "valNeg": int((y[fva] == 0).sum()), "valPos": int((y[fva] == 1).sum()),
            "ap": ap,
        })
    cv_mean = float(np.mean([f["ap"] for f in folds]))
    for f in folds:
        f["ap"] = r4(f["ap"])
    cv = {"folds": folds, "mean": r4(cv_mean)}

    # kod04 / kod05.
    s_base = base8.predict_proba(xte)[:, 1]
    w8 = fit_lr(xtr, ytr, class_weight="balanced", max_iter=1000, random_state=42)
    s_w = w8.predict_proba(xte)[:, 1]
    sc8 = StandardScaler().fit(xtr)
    a, b = sc8.transform(xtr), sc8.transform(xte)
    a2, y2, _ = oversample(a, ytr, SMOTE_K, SMOTE_SEED)
    pipe = fit_lr(a2, y2, max_iter=1000, random_state=42)
    s_s = pipe.predict_proba(b)[:, 1]
    compare = {}
    for name, s in (("base", s_base), ("smote", s_s), ("weighted", s_w)):
        rs = rounded(s)
        compare[name] = {"scores": rs, "ap": r4(ap_of(yte, rs))}
    if round(ap_of(yte, s_w), 3) != 0.173:
        fail(f"kod04 PR-AUC {ap_of(yte, s_w)} is not 0.173")
    kod05 = {"matrix": matrix_of(yte, s_s)}

    # Fixture pieces.
    rng_fix = []
    for seed in (0, 12345):
        r = mulberry32(seed)
        rng_fix.append({"seed": seed, "values": [r() for _ in range(5)]})
    minority = ztr[ytr == 1]
    smote_fix = {"points": [[float(p[0]), float(p[1])] for p in minority], "runs": []}
    for seed in FIXTURE_SEEDS:
        for k in FIXTURE_KS:
            new, info = smote(minority, k, FIXTURE_NEW, seed)
            smote_fix["runs"].append({
                "seed": seed, "k": k,
                "new": [{"i": i, "j": j, "lambda": lam, "x": float(p[0]), "y": float(p[1])}
                        for (i, j, lam), p in zip(info, new)],
            })

    print("rows / churners", len(df), int(y.sum()))
    print("train / test", counts)
    print("kod01 matrix", m01)
    for name in ("base", "smote", "weighted", "weight20"):
        print("two-feature", name, logreg[name]["matrix"], "AP", round(logreg[name]["ap"], 4))
    for run in leak_runs:
        lk, hn = run["leaky"], run["honest"]
        print("seed", run["seed"], "leaky n/pos/synth/parentInTrain",
              lk["n"], lk["pos"], lk["synthPos"], lk["parentInTrain"], "AP", lk["ap"],
              "| honest AP", hn["ap"])
    print("leak example", example)
    print("cv folds", [f["ap"] for f in folds], "mean", cv["mean"])
    print("cv counts", [(f["trainNeg"], f["trainPos"], f["smoteNeg"], f["smotePos"],
                         f["valNeg"], f["valPos"]) for f in folds])
    print("compare AP", {k: v["ap"] for k, v in compare.items()}, "kod05", kod05["matrix"])

    data = {
        "customers": {
            "tenure": [int(v) if float(v).is_integer() else float(v) for v in x[:, 0]],
            "charge": [float(v) for v in x[:, 1]],
            "churn": [int(v) for v in y],
            "test": [int(v) for v in test_flag],
        },
        "scale": {"mean": mean, "std": std},
        "book01": book01,
        "models2d": models2d,
        "leak": {"seeds": LEAK_SEEDS, "bySeed": leak_runs, "example": example},
        "cv": cv,
        "compare": compare,
        "kod05": kod05,
    }
    fixture = {
        "mulberry": rng_fix,
        "smote": smote_fix,
        "logreg": logreg,
        "ap": ap_fix,
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
        print("dengesiz data up to date")
    else:
        for p, text in files.items():
            path = ROOT / p
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(text.encode("utf-8"))
            print(f"Generated {p}")
