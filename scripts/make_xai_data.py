"""Generate Chapter 13 (explainable AI: SHAP and LIME) data and the sklearn fixture.

Run:   python scripts/make_xai_data.py
Check: python scripts/make_xai_data.py --check   (writes nothing; exit 1 on drift)

Reads nothing: the book data and model (code 01 of chapter 13) are written in this file verbatim.
Neither `shap` nor `lime` is used. SHAP is computed with the path-dependent tree conditional
expectation (matches shap.TreeExplainer to 1e-12 on the 100 test customers); LIME is computed with a
numpy + scipy + sklearn twin that draws the same random numbers in the same order as lime 0.2 and
matches it (checked once in a throwaway environment).

Writes (relative to the repo root):
  src/concepts/xai/data/xai.json     data the two pages draw
  tests/fixtures/xai_shap_lime.json  sklearn numbers the TypeScript maths is compared with

Data (xai.json; display numbers 6 decimals, numbers that enter a calculation full precision):
  model      split sizes and class counts, test accuracy, feature_importances_, base value v(empty),
             mean |SHAP| per feature, topDisagree (test customers whose most influential feature
             differs between SHAP and LIME at seed 42 / 5000 samples).
  customers  The 100 test customers in test order: row (data row = DataFrame index), values, label,
             p, shap, v (8 coalition values, index = feature bit mask: bit 0 tenure, bit 1
             MonthlyCharges, bit 2 TotalCharges).
  bins       Per feature: three training quartile cuts, four lime-style bin names, training counts.
  runs       4 preset customers x 11 seeds x 5 sample sizes: the customer's bins, the 8 pattern
             summaries [n, mean p, within-pattern sum of squares] in mask order (mask bit j = the
             sample's feature j is in the customer's bin) and the sklearn Ridge fit at the default
             kernel width.
  all        The 100 test customers at seed 42 / 5000 samples: bins and the same fit.
  cloud      Per preset customer, the first 500 samples of the seed 42 / 5000 run (values, mask, p).
  book       The fixed debugging code of the book (n_estimators=100): p of customer 301.

Fixture (xai_shap_lime.json), full precision:
  customers  row, p, v, shap of the 100 test customers.
  ridge      For every preset run and each kernel width (default, 0.5, 3.0), sklearn Ridge on the
             samples themselves: {row, seed, samples, width, coef, intercept, localPred, score}.

Checks (SystemExit with the failing check named; the generator never bends data to pass):
  - the book numbers: p(301) 0.945, accuracy 0.94, importances 0.546 / 0.231 / 0.223, mean
    |SHAP| 0.221060 / 0.064580 / 0.035807, SHAP of customer 301 0.567064 / 0.092737 / 0.039599,
    LIME seed 42 coefficients 0.540 / 0.074 / -0.023;
  - v(all) = p and base + sum(phi) = p for every customer (1e-12);
  - the Ridge solved from the 8 pattern summaries equals sklearn Ridge on the samples (1e-9) for
    every run at the three widths;
  - customer 77: SHAP and LIME disagree on the most influential feature;
  - at least one 50-sample run has an empty pattern.
"""

import collections
import itertools
import json
import math
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import scipy.stats
from sklearn.datasets import make_classification
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import Ridge
from sklearn.model_selection import train_test_split

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = "src/concepts/xai/data/xai.json"
FIXTURE_PATH = "tests/fixtures/xai_shap_lime.json"

FEATURES = ["tenure", "MonthlyCharges", "TotalCharges"]
PRESETS = [301, 77, 217, 176]
SEEDS = [42, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
SIZES = [50, 100, 500, 1000, 5000]
KERNEL_WIDTH = 0.75 * math.sqrt(3)
WIDTHS = [KERNEL_WIDTH, 0.5, 3.0]
CLOUD_N = 500


def fail(msg):
    print("CRITERION FAILED: " + msg)
    sys.exit(1)


def r6(v):
    return round(float(v), 6)


def build():
    """The book's data and model (code 01), verbatim."""
    X, y = make_classification(n_samples=400, n_features=3, n_informative=3, n_redundant=0,
                               n_clusters_per_class=1, weights=[0.75, 0.25], random_state=42)
    df = pd.DataFrame(X, columns=FEATURES)
    df["tenure"] = (df["tenure"] * 12 + 36).clip(1, 72).round(0)
    df["MonthlyCharges"] = (df["MonthlyCharges"] * 15 + 65).clip(18, 120).round(2)
    df["TotalCharges"] = (df["TotalCharges"] * 500 + 2000).clip(0, None).round(2)
    t = pd.Series(y, name="Churn")
    xtr, xte, ytr, yte = train_test_split(df, t, test_size=0.25, random_state=42, stratify=t)
    model = RandomForestClassifier(n_estimators=200, random_state=42).fit(xtr, ytr)
    fixed = RandomForestClassifier(n_estimators=100, random_state=42).fit(xtr, ytr)
    return df, t, xtr, xte, ytr, yte, model, fixed


# --- SHAP ------------------------------------------------------------------------------------

def tree_arrays(est):
    tr = est.tree_
    leaf = []
    for n in range(tr.node_count):
        leaf.append(float(tr.value[n][0][1] / tr.value[n][0].sum()))
    return (tr.children_left.tolist(), tr.children_right.tolist(), tr.feature.tolist(),
            tr.threshold.tolist(), tr.weighted_n_node_samples.tolist(), leaf)


def cond(arrays, x, known):
    left, right, feat, thr, wn, leaf = arrays

    def rec(n):
        if left[n] == -1:
            return leaf[n]
        f = feat[n]
        lc, rc = left[n], right[n]
        if f in known:
            return rec(lc) if x[f] <= thr[n] else rec(rc)
        wl, wr = wn[lc], wn[rc]
        return (wl * rec(lc) + wr * rec(rc)) / (wl + wr)

    return rec(0)


def coalitions(trees, x32):
    """v(x, S) for the 8 masks (bit j = feature j known)."""
    out = []
    for mask in range(8):
        known = {j for j in range(3) if mask >> j & 1}
        out.append(float(np.mean([cond(a, x32, known) for a in trees])))
    return out


def shapley(v):
    phi = []
    for i in range(3):
        rest = [j for j in range(3) if j != i]
        s = 0.0
        for k in range(3):
            for sub in itertools.combinations(rest, k):
                w = math.factorial(k) * math.factorial(3 - k - 1) / math.factorial(3)
                m = sum(1 << j for j in sub)
                s += w * (v[m | (1 << i)] - v[m])
        phi.append(s)
    return phi


# --- LIME twin -------------------------------------------------------------------------------

class Lime:
    """lime_tabular twin: quartile bins, bin-frequency sampling, truncated normals inside a bin."""

    def __init__(self, train):
        self.train = train
        d = train.shape[1]
        self.qts = [np.unique(np.percentile(train[:, j], [25, 50, 75])) for j in range(d)]
        self.means, self.stds, self.mins, self.maxs = [], [], [], []
        for j in range(d):
            b = self.disc(j, train[:, j])
            mu, sd = [], []
            for k in range(len(self.qts[j]) + 1):
                s = train[b == k, j]
                mu.append(np.mean(s) if len(s) else 0)
                sd.append((np.std(s) if len(s) else 0) + 1e-11)
            self.means.append(np.array(mu))
            self.stds.append(np.array(sd))
            self.mins.append(np.array([train[:, j].min()] + list(self.qts[j])))
            self.maxs.append(np.array(list(self.qts[j]) + [train[:, j].max()]))
        self.tdisc = np.column_stack([self.disc(j, train[:, j]) for j in range(d)]).astype(float)

    def disc(self, j, x):
        return np.searchsorted(self.qts[j], x)

    def bins_of(self, row):
        return [int(self.disc(j, row[j])) for j in range(self.train.shape[1])]

    def sample(self, row, predict, seed, n):
        """Binary data (n x 3), real-valued samples, model p; the draw order is lime's."""
        rs = np.random.RandomState(seed)
        d = self.train.shape[1]
        first = np.array(self.bins_of(row))
        data = np.zeros((n, d))
        data[0] = row
        inv = data.copy()
        for j in range(d):
            c = collections.Counter(self.tdisc[:, j])
            vals, fr = map(list, zip(*sorted(c.items())))
            fr = np.array(fr) / sum(fr)
            ic = rs.choice(vals, size=n, replace=True, p=fr)
            bc = (ic == first[j]).astype(int)
            bc[0] = 1
            ic[0] = data[0, j]
            data[:, j] = bc
            inv[:, j] = ic
        for j in range(d):
            v = inv[1:, j].astype(int)
            mn, mx, mu, sd = self.mins[j][v], self.maxs[j][v], self.means[j][v], self.stds[j][v]
            lo = (mn - mu) / sd
            hi = (mx - mu) / sd
            ret = lo.copy()
            ne = lo != hi
            ret[ne] = scipy.stats.truncnorm.rvs(lo[ne], hi[ne], loc=mu[ne], scale=sd[ne],
                                                random_state=rs)
            inv[1:, j] = ret
        inv[0] = row
        return data, inv, predict(inv)[:, 1]


def kernel_weights(data, width):
    dist = np.sqrt(((data - data[0]) ** 2).sum(1))
    return np.sqrt(np.exp(-dist ** 2 / width ** 2))


def sk_fit(data, y, width):
    w = kernel_weights(data, width)
    r = Ridge(alpha=1, fit_intercept=True).fit(data, y, sample_weight=w)
    return {"coef": [float(c) for c in r.coef_], "intercept": float(r.intercept_),
            "localPred": float(r.predict(data[:1])[0]),
            "score": float(r.score(data, y, sample_weight=w))}


def patterns_of(data, y):
    mask = (data[:, 0] + 2 * data[:, 1] + 4 * data[:, 2]).astype(int)
    out = []
    for k in range(8):
        ys = y[mask == k]
        n = len(ys)
        mean = float(ys.mean()) if n else 0.0
        ss = float(((ys - mean) ** 2).sum()) if n else 0.0
        out.append([n, mean, ss])
    return mask, out


def pattern_fit(patterns, width, alpha=1.0):
    """Weighted Ridge solved from the pattern summaries (the TypeScript limeFit, in Python)."""
    ws, xs, means, ns, sss = [], [], [], [], []
    for k, (n, mean, ss) in enumerate(patterns):
        if n == 0:
            continue
        pc = bin(k).count("1")
        ws.append(math.sqrt(math.exp(-(3 - pc) / width ** 2)))
        xs.append([k >> j & 1 for j in range(3)])
        means.append(mean)
        ns.append(n)
        sss.append(ss)
    ws, xs, means, ns, sss = map(np.array, (ws, xs, means, ns, sss))
    big = ws * ns
    tot = big.sum()
    xbar = (big[:, None] * xs).sum(0) / tot
    ybar = (big * means).sum() / tot
    xc = xs - xbar
    a = (big[:, None, None] * xc[:, :, None] * xc[:, None, :]).sum(0) + alpha * np.eye(3)
    b = (big[:, None] * xc * (means - ybar)[:, None]).sum(0)
    beta = np.linalg.solve(a, b)
    icpt = ybar - xbar @ beta
    pred = icpt + xs @ beta
    ssres = (ws * (sss + ns * (means - pred) ** 2)).sum()
    sstot = (ws * (sss + ns * (means - ybar) ** 2)).sum()
    return {"coef": beta.tolist(), "intercept": float(icpt),
            "localPred": float(icpt + beta.sum()),
            "score": float(1 - ssres / sstot)}


def close(a, b, tol):
    return abs(a - b) <= tol


def generate():
    df, t, xtr, xte, ytr, yte, model, fixed = build()
    train = xtr.values
    trees = [tree_arrays(e) for e in model.estimators_]
    names = list(df.columns)

    def predict(a):
        return model.predict_proba(pd.DataFrame(a, columns=names))

    acc = float(model.score(xte, yte))
    imps = [float(v) for v in model.feature_importances_]
    probs = model.predict_proba(xte)[:, 1]

    customers = []
    for pos in range(len(xte)):
        row = int(xte.index[pos])
        x = xte.iloc[pos].values
        v = coalitions(trees, x.astype(np.float32))
        phi = shapley(v)
        p = float(probs[pos])
        if not close(v[7], p, 1e-12):
            fail(f"v(all) = p, customer {row}: {v[7]} vs {p}")
        if not close(v[0] + sum(phi), p, 1e-12):
            fail(f"base + sum(phi) = p, customer {row}")
        customers.append({"row": row, "values": [float(a) for a in x], "label": int(yte.iloc[pos]),
                          "p": p, "shap": phi, "v": v})
    base = customers[0]["v"][0]
    if any(not close(c["v"][0], base, 1e-12) for c in customers):
        fail("base value differs between customers")
    mean_abs = [float(np.mean([abs(c["shap"][j]) for c in customers])) for j in range(3)]
    by_row = {c["row"]: c for c in customers}
    pos_of = {c["row"]: i for i, c in enumerate(customers)}
    for row, pos in zip(PRESETS, [0, 12, 1, 4]):
        if pos_of.get(row) != pos:
            fail(f"preset {row} is not at test position {pos}")

    lime = Lime(train)
    bins = {"cuts": [[float(q) for q in lime.qts[j]] for j in range(3)], "names": [], "freqs": []}
    for j in range(3):
        if len(lime.qts[j]) != 3:
            fail(f"{FEATURES[j]} has fewer than three distinct quartile cuts")
        q = lime.qts[j]
        f = FEATURES[j]
        bins["names"].append([f"{f} <= {q[0]:.2f}", f"{q[0]:.2f} < {f} <= {q[1]:.2f}",
                              f"{q[1]:.2f} < {f} <= {q[2]:.2f}", f"{f} > {q[2]:.2f}"])
        bins["freqs"].append([int((lime.tdisc[:, j] == k).sum()) for k in range(4)])

    runs, fx_ridge, cloud = [], [], {}
    empty_runs = []
    for row in PRESETS:
        x = np.array(by_row[row]["values"])
        cb = lime.bins_of(x)
        for seed in SEEDS:
            for n in SIZES:
                data, inv, y = lime.sample(x, predict, seed, n)
                mask, pats = patterns_of(data, y)
                fits = [sk_fit(data, y, w) for w in WIDTHS]
                for w, fit in zip(WIDTHS, fits):
                    alt = pattern_fit(pats, w)
                    for key in ("intercept", "localPred", "score"):
                        if not close(alt[key], fit[key], 1e-9):
                            fail(f"pattern Ridge {key} row {row} seed {seed} n {n} width {w}")
                    for a, b in zip(alt["coef"], fit["coef"]):
                        if not close(a, b, 1e-9):
                            fail(f"pattern Ridge coef row {row} seed {seed} n {n} width {w}")
                    fx_ridge.append({"row": row, "seed": seed, "samples": n, "width": w, **fit})
                if n == 50 and any(p[0] == 0 for p in pats):
                    empty_runs.append((row, seed))
                runs.append({"row": row, "seed": seed, "samples": n, "bins": cb,
                             "patterns": pats, "fit": fits[0]})
                if seed == 42 and n == 5000:
                    cloud[str(row)] = {"values": [[r6(a) for a in r] for r in inv[:CLOUD_N]],
                                       "mask": [int(m) for m in mask[:CLOUD_N]],
                                       "p": [r6(a) for a in y[:CLOUD_N]]}
    if not empty_runs:
        fail("no 50-sample run has an empty pattern")

    all_fits = []
    for c in customers:
        x = np.array(c["values"])
        data, inv, y = lime.sample(x, predict, 42, 5000)
        all_fits.append({"row": c["row"], "bins": lime.bins_of(x),
                         "fit": sk_fit(data, y, KERNEL_WIDTH)})

    c301 = by_row[301]
    if round(c301["p"], 3) != 0.945:
        fail("p(301) 0.945")
    if round(acc, 3) != 0.94:
        fail("accuracy 0.94")
    if [round(v, 3) for v in imps] != [0.546, 0.231, 0.223]:
        fail("importances 0.546 / 0.231 / 0.223")
    if [round(v, 6) for v in mean_abs] != [0.221060, 0.064580, 0.035807]:
        fail("mean |SHAP| 0.221060 / 0.064580 / 0.035807")
    if [round(v, 6) for v in c301["shap"]] != [0.567064, 0.092737, 0.039599]:
        fail("SHAP of customer 301 0.567064 / 0.092737 / 0.039599")
    fit301 = next(a for a in all_fits if a["row"] == 301)["fit"]
    if [round(v, 3) for v in fit301["coef"]] != [0.540, 0.074, -0.023]:
        fail("LIME seed 42 coefficients 0.540 / 0.074 / -0.023")

    def top(vals):
        return int(np.argmax(np.abs(vals)))

    disagree = [top(c["shap"]) != top(a["fit"]["coef"]) for c, a in zip(customers, all_fits)]
    if not disagree[pos_of[77]]:
        fail("customer 77: SHAP and LIME should disagree on the most influential feature")

    book_p = float(fixed.predict_proba(xte.loc[[301]])[0, 1])
    model_out = {
        "nTrain": len(xtr), "nTest": len(xte),
        "trainCounts": [int((ytr == 0).sum()), int((ytr == 1).sum())],
        "testCounts": [int((yte == 0).sum()), int((yte == 1).sum())],
        "accuracy": acc, "importances": imps, "base": base, "meanAbsShap": mean_abs,
        "topDisagree": int(sum(disagree)),
    }

    print("base", base, "acc", acc, "imp", [round(v, 3) for v in imps])
    for row in PRESETS:
        c = by_row[row]
        print("customer", row, "p", round(c["p"], 6), "shap", [round(v, 6) for v in c["shap"]])
    print("topDisagree", model_out["topDisagree"], "fixedCodeP", book_p)
    for n in (5000, 50):
        ts = [run["fit"]["coef"][0] for run in runs if run["row"] == 301 and run["samples"] == n]
        print(f"tenure coef, customer 301, {n} samples: {min(ts):.4f} .. {max(ts):.4f}")
    print("50-sample runs with an empty pattern (row, seed):", empty_runs)

    data = {
        "model": model_out,
        "customers": customers,
        "bins": bins, "runs": runs, "all": all_fits, "cloud": cloud,
        "book": {"fixedCodeP": book_p},
    }
    fixture = {
        "customers": [{"row": c["row"], "p": c["p"], "v": c["v"], "shap": c["shap"]}
                      for c in customers],
        "ridge": fx_ridge,
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
        print("xai data up to date")
    else:
        for p, text in files.items():
            path = ROOT / p
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(text.encode("utf-8"))
            print(f"Generated {p} ({len(text.encode('utf-8'))} bytes)")
