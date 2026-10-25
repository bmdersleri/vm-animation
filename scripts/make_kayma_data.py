"""Generate Chapter 14 (model drift and monitoring) data and the scikit-learn fixture.

Run:   python scripts/make_kayma_data.py
Check: python scripts/make_kayma_data.py --check   (writes nothing; exit 1 on drift)
Seed:  python scripts/make_kayma_data.py --find-seed   (first seed from 0 that passes every check;
       writes nothing; the result is written once into SEED below)

Reads nothing (no CSV): the book code 03 of chapter 14 (mean difference against a threshold) is
written in this file verbatim; the customers are simulated.

Writes (relative to the repo root):
  src/concepts/model-kaymasi/data/kayma.json  data the page draws
  tests/fixtures/kayma_sklearn.json           full precision numbers the TypeScript maths is compared with

Data (kayma.json; display numbers 6 decimals, counts and cut points full precision):
  meta       seed, versions, months 24, perMonth 250, refMonths 6, labelDelay 3, accMargin 0.05,
             psiFloor 0.0001, screen histogram {lo 15, hi 125, width 5}.
  book       the two lists of code 03, their means, difference, threshold 8.0, status, and the mini
             application's difference (21.33).
  reference  months 1..6 (1500 customers): n, mean, std (ddof 1), 9 PSI cuts (deciles), the ten bin
             counts, 22 screen histogram counts, logistic coefficient and intercept, accuracy, churn
             rate and maxMonthlyDiff (largest |month mean - reference mean| over months 1..6).
  scenarios  five (yok, ani, yavas, yayilim, kavram) x 24 months: mean, std, diff, psiCounts (10),
             psi, hist (22), accuracy (reference model on that month's 250 customers), churnRate.
             Every scenario draws the same z and u, so months 1..6 are identical.
  curves     per scenario, the logistic fit on months 15..24 (coef, intercept, churnRate).
  spreadMonth  for yayilim, the month in 15..24 with the smallest diff.

Model: month m has mean mu(m) = 65 + 2.5 sin(2 pi (m - 1) / 12), sd 15, fee = round(clip(mu + sd z,
18, 120), 2); churn = u < p with p_old = sigmoid(-5.2 + 0.065 fee); the concept scenario uses
p_new = sigmoid(0.8 - 0.025 fee) from month 15. PSI: bins from the reference deciles, reference
share p_i = bin count / 1500, current share q_i = count / 250; an empty current bin uses 0.0001 in
the whole term (q - p) ln(q / p).

Fixture (kayma_sklearn.json), full precision: per scenario-month diff, psi, accuracy; the reference
model; curves; the reference psiCounts.

Checks (SystemExit "check failed: <name>"; the generator never bends data to pass):
  book_numbers, psi_recomputes, yok_false_alarms, ani_detects, yavas_threshold_tradeoff,
  yayilim_hidden_from_mean, kavram_silent_inputs, accuracy_holds_before.
"""

import json
import math
import platform
import statistics
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn
from sklearn.linear_model import LogisticRegression

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = "src/concepts/model-kaymasi/data/kayma.json"
FIXTURE_PATH = "tests/fixtures/kayma_sklearn.json"

SEED = 2

MONTHS = 24
PER_MONTH = 250
REF_MONTHS = 6
LABEL_DELAY = 3
ACC_MARGIN = 0.05
PSI_FLOOR = 0.0001
HIST = {"lo": 15, "hi": 125, "width": 5}
SIGMA = 15.0
SCENARIOS = [
    ("yok", "kayma yok", None),
    ("ani", "ani kayma", 15),
    ("yavas", "yavaş kayma", 13),
    ("yayilim", "yalnız yayılım değişir", 15),
    ("kavram", "kavram kayması", 15),
]


def fail(name):
    raise SystemExit(f"check failed: {name}")


def r6(x):
    return round(float(x), 6)


def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-x))


def mu_of(month):
    return 65 + 2.5 * math.sin(2 * math.pi * (month - 1) / 12)


def fees_and_labels(sid, month, z, u):
    mu = mu_of(month)
    sd = SIGMA
    if sid == "ani" and month >= 15:
        mu += 14
    if sid == "yavas" and month >= 13:
        mu += 1.2 * (month - 12)
    if sid == "yayilim" and month >= 15:
        sd = 30.0
    fee = np.round(np.clip(mu + sd * z, 18, 120), 2)
    if sid == "kavram" and month >= 15:
        p = sigmoid(0.8 - 0.025 * fee)
    else:
        p = sigmoid(-5.2 + 0.065 * fee)
    return fee, (u < p).astype(int)


def psi_of(counts, ref_counts, n_ref, n_cur):
    total = 0.0
    for c, rc in zip(counts, ref_counts):
        p = rc / n_ref
        q = c / n_cur
        if q == 0:
            q = PSI_FLOOR
        total += (q - p) * math.log(q / p)
    return total


def alarms(values, threshold):
    """Months 7..24 whose value is strictly above the threshold."""
    return [m for m in range(REF_MONTHS + 1, MONTHS + 1) if values[m - 1] > threshold]


def false_alarms(al, change):
    return len([m for m in al if change is None or m < change])


def delay(al, change):
    after = [m for m in al if change is not None and m >= change]
    return (after[0] - change) if after else None


def book_part():
    """Code 03 of chapter 14, verbatim."""
    ref = [45, 51, 54, 62, 67]
    cur = [58, 64, 71, 76, 82]
    fark = abs(statistics.mean(ref) - statistics.mean(cur))
    durum = "UYARI" if fark > 8.0 else "NORMAL"
    mini = abs(statistics.mean([45, 51, 54]) - statistics.mean([65, 71, 78]))
    return {"reference": ref, "current": cur, "refMean": statistics.mean(ref),
            "curMean": statistics.mean(cur), "diff": fark, "esik": 8.0, "status": durum,
            "miniDiff": mini}


def generate(seed):
    book = book_part()
    if (round(book["refMean"], 2) != 55.80 or round(book["curMean"], 2) != 70.20
            or round(book["diff"], 2) != 14.40 or book["status"] != "UYARI"
            or round(book["miniDiff"], 2) != 21.33):
        fail("book_numbers")

    rng = np.random.default_rng(seed)
    zs, us = [], []
    for _ in range(MONTHS):
        zs.append(rng.standard_normal(PER_MONTH))
        us.append(rng.random(PER_MONTH))

    # Raw per scenario and month.
    raw = {}
    for sid, _, _ in SCENARIOS:
        raw[sid] = [fees_and_labels(sid, m, zs[m - 1], us[m - 1]) for m in range(1, MONTHS + 1)]

    ref_fee = np.concatenate([raw["yok"][m][0] for m in range(REF_MONTHS)])
    ref_y = np.concatenate([raw["yok"][m][1] for m in range(REF_MONTHS)])
    n_ref = len(ref_fee)
    model = LogisticRegression().fit(ref_fee.reshape(-1, 1), ref_y)
    ref_acc = float(model.score(ref_fee.reshape(-1, 1), ref_y))
    cuts = np.percentile(ref_fee, [10, 20, 30, 40, 50, 60, 70, 80, 90])
    ref_counts = np.bincount(np.searchsorted(cuts, ref_fee, side="right"), minlength=10)
    ref_mean = float(ref_fee.mean())
    ref_std = float(pd.Series(ref_fee).std())

    def hist_of(x):
        idx = np.clip(np.floor((x - HIST["lo"]) / HIST["width"]).astype(int), 0, 21)
        return np.bincount(idx, minlength=22)

    month_mean_ref = [float(raw["yok"][m][0].mean()) for m in range(REF_MONTHS)]
    max_monthly = max(abs(v - ref_mean) for v in month_mean_ref)

    scenarios = []
    full = {}
    for sid, name, change in SCENARIOS:
        months = []
        full[sid] = []
        for m in range(1, MONTHS + 1):
            fee, y = raw[sid][m - 1]
            mean = float(fee.mean())
            std = float(pd.Series(fee).std())
            diff = abs(mean - ref_mean)
            counts = np.bincount(np.searchsorted(cuts, fee, side="right"), minlength=10)
            psi = psi_of(counts, ref_counts, n_ref, PER_MONTH)
            acc = float(model.score(fee.reshape(-1, 1), y))
            churn = float(y.mean())
            full[sid].append({"month": m, "mean": mean, "std": std, "diff": diff, "psi": psi,
                              "accuracy": acc, "churnRate": churn,
                              "psiCounts": [int(c) for c in counts]})
            months.append({
                "month": m, "mean": r6(mean), "std": r6(std), "diff": r6(diff),
                "psiCounts": [int(c) for c in counts], "psi": r6(psi),
                "hist": [int(c) for c in hist_of(fee)], "accuracy": acc, "churnRate": churn,
            })
        scenarios.append({"id": sid, "name": name, "changeMonth": change, "months": months})

    # psi_recomputes: independent numpy recomputation from the bin counts.
    p = ref_counts / n_ref
    for sid in full:
        for row in full[sid]:
            q = np.array(row["psiCounts"], dtype=float) / PER_MONTH
            q = np.where(q == 0, PSI_FLOOR, q)
            again = float(np.sum((q - p) * np.log(q / p)))
            if abs(again - row["psi"]) > 1e-12:
                fail("psi_recomputes")

    diffs = {sid: [r["diff"] for r in full[sid]] for sid in full}
    psis = {sid: [r["psi"] for r in full[sid]] for sid in full}
    accs = {sid: [r["accuracy"] for r in full[sid]] for sid in full}
    change_of = {sid: c for sid, _, c in SCENARIOS}

    if false_alarms(alarms(diffs["yok"], 8), None) != 0 or false_alarms(alarms(diffs["yok"], 4), None) < 2:
        fail("yok_false_alarms")
    al8 = alarms(diffs["ani"], 8)
    if delay(al8, 15) != 0 or false_alarms(al8, 15) != 0:
        fail("ani_detects")
    d4 = delay(alarms(diffs["yavas"], 4), 13)
    d8 = delay(alarms(diffs["yavas"], 8), 13)
    d12 = delay(alarms(diffs["yavas"], 12), 13)
    if d4 is None or d8 is None or not d4 < d8 or d12 is not None:
        fail("yavas_threshold_tradeoff")
    for m in range(15, MONTHS + 1):
        if not (diffs["yayilim"][m - 1] < 8 and psis["yayilim"][m - 1] >= 0.25):
            fail("yayilim_hidden_from_mean")
    if any(d >= 8 for d in diffs["kavram"]) or any(v >= 0.25 for v in psis["kavram"]):
        fail("kavram_silent_inputs")
    if any(accs["kavram"][m - 1] >= ref_acc - ACC_MARGIN for m in range(15, MONTHS + 1)):
        fail("kavram_silent_inputs")
    for sid in accs:
        if any(accs[sid][m - 1] < ref_acc - ACC_MARGIN for m in range(7, 15)):
            fail("accuracy_holds_before")

    curves = {}
    for sid, _, _ in SCENARIOS:
        fee = np.concatenate([raw[sid][m - 1][0] for m in range(15, MONTHS + 1)])
        y = np.concatenate([raw[sid][m - 1][1] for m in range(15, MONTHS + 1)])
        fit = LogisticRegression().fit(fee.reshape(-1, 1), y)
        curves[sid] = {"coef": float(fit.coef_[0, 0]), "intercept": float(fit.intercept_[0]),
                       "churnRate": float(y.mean())}
    spread = min(range(15, MONTHS + 1), key=lambda m: (diffs["yayilim"][m - 1], m))

    reference = {
        "n": n_ref, "mean": r6(ref_mean), "std": r6(ref_std), "psiCuts": [float(c) for c in cuts],
        "psiCounts": [int(c) for c in ref_counts], "hist": [int(c) for c in hist_of(ref_fee)],
        "coef": float(model.coef_[0, 0]), "intercept": float(model.intercept_[0]),
        "accuracy": ref_acc, "churnRate": float(ref_y.mean()), "maxMonthlyDiff": r6(max_monthly),
    }
    meta = {
        "seed": seed,
        "versions": {"python": platform.python_version(), "numpy": np.__version__,
                     "pandas": pd.__version__, "scikit-learn": sklearn.__version__},
        "months": MONTHS, "perMonth": PER_MONTH, "refMonths": REF_MONTHS,
        "labelDelay": LABEL_DELAY, "accMargin": ACC_MARGIN, "psiFloor": PSI_FLOOR, "hist": HIST,
    }
    data = {"meta": meta, "book": book, "reference": reference, "scenarios": scenarios,
            "curves": curves, "spreadMonth": spread}
    fixture = {
        "reference": {"coef": reference["coef"], "intercept": reference["intercept"],
                      "accuracy": ref_acc, "psiCounts": reference["psiCounts"], "mean": ref_mean},
        "scenarios": {sid: [{k: r[k] for k in ("month", "diff", "psi", "accuracy")}
                            for r in full[sid]] for sid in full},
        "curves": curves,
    }
    return data, fixture


def render(content):
    return json.dumps(content, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
                      allow_nan=False) + "\n"


def find_seed(limit=500):
    names = {}
    for s in range(limit):
        try:
            generate(s)
        except SystemExit as e:
            names[str(e)] = names.get(str(e), 0) + 1
            continue
        print(f"first passing seed: {s}")
        return
    print(f"no seed in 0..{limit - 1} passes; failures: {names}")
    sys.exit(2)


if __name__ == "__main__":
    if "--find-seed" in sys.argv:
        find_seed()
        sys.exit(0)
    data, fixture = generate(SEED)
    files = {DATA_PATH: render(data), FIXTURE_PATH: render(fixture)}
    if "--check" in sys.argv:
        stale = [p for p, text in files.items()
                 if not (ROOT / p).exists() or (ROOT / p).read_bytes() != text.encode("utf-8")]
        if stale:
            print("Out of date: " + ", ".join(stale))
            sys.exit(1)
        print("kayma data up to date")
    else:
        for p, text in files.items():
            path = ROOT / p
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(text.encode("utf-8"))
            print(f"Generated {p} ({len(text.encode('utf-8'))} bytes)")
