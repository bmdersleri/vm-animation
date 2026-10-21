"""Generate the Chapter 3 (pre-processing) pages' data and pandas / scikit-learn fixtures.

Usage:
    python scripts/make_onisleme_data.py

Writes (relative to the repo root):
    src/concepts/iqr-aykiri/data/iqr_data.json        book series for the fill / IQR / mode steps
    src/concepts/olcekleme/data/olcekleme_data.json   six customers, query, 10-value train/test split
    tests/fixtures/onisleme_sklearn.json              SimpleImputer / quantile / zscore / scalers /
                                                      train_test_split reference values (full precision)

Reproduces the book's code examples 002, 003, 004 and 006 and asserts every
control value of the spec (rounded to two decimals); any mismatch exits non-zero.
No RNG is used besides train_test_split(random_state=42). Output is deterministic:
running it twice produces byte-identical files.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MinMaxScaler, RobustScaler, StandardScaler

REPO = Path(__file__).resolve().parent.parent
IQR_OUT = REPO / "src" / "concepts" / "iqr-aykiri" / "data" / "iqr_data.json"
SCALE_OUT = REPO / "src" / "concepts" / "olcekleme" / "data" / "olcekleme_data.json"
FIXTURE_OUT = REPO / "tests" / "fixtures" / "onisleme_sklearn.json"

NAN = float("nan")
FILL = [29.85, 56.95, NAN, 42.30, 38.50, NAN, 200.00, 45.00]  # example 002
FILL_EXTREME = 6
IQR = [29.85, 56.95, 42.30, 38.50, 45.00, 60.20, 51.10, 480.00]  # example 003
IQR_EXTREME = 7
MODE = ["Aylık", "Aylık", None, "Bir Yıllık"]
CUSTOMERS = [  # example 004: (id, months, TL)
    ("M1", 1, 29.85),
    ("M2", 34, 56.95),
    ("M3", 2, 42.30),
    ("M4", 45, 38.50),
    ("M5", 8, 200.00),
    ("M6", 60, 70.10),
]
QUERY = (12, 55.00)
UNITS = {"ay": 1.0, "yil": 1 / 12, "gun": 30.0}
FATURA = [29.85, 56.95, 42.30, 38.50, 45.00, 60.20, 51.10, 80.00, 33.00, 90.00]  # example 006
CHURN = [0, 0, 0, 0, 1, 0, 0, 1, 0, 1]
SPLIT_TRAIN = [7, 0, 2, 5, 6, 1, 9]
SPLIT_TEST = [4, 8, 3]
SWEEP = [50, 60, 82, 83, 90, 99, 100, 101, 200, 300, 480, 500]
DRAG_CASES = [[30, 100], [5, 150], [50, 40], [20, 60], [0, 210]]


def fail(msg: str) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def expect(name: str, got, want, places: int = 2) -> None:
    """Assert round(got, places) == want (scalars or equal-length lists)."""
    scale = 10.0**places
    # round half away from zero (the spec's convention; 49.625 -> 49.63)
    a = np.asarray(got, dtype=float)
    g = (np.sign(a) * np.floor(np.abs(a) * scale + 0.5 + 1e-9) / scale).ravel()
    w = np.asarray(want, dtype=float).ravel()
    if g.shape != w.shape or np.max(np.abs(g - w)) > 1e-9:
        fail(f"{name}: got {g.tolist()}, want {w.tolist()}")


def fl(x) -> float:
    return float(x)


def fls(xs) -> list[float]:
    return [float(v) for v in np.asarray(xs, dtype=float).ravel()]


def fls2(m) -> list[list[float]]:
    return [[float(v) for v in row] for row in np.asarray(m, dtype=float)]


def nones(xs) -> list:
    return [None if (isinstance(v, float) and math.isnan(v)) else v for v in xs]


# --------------------------------------------------------------------------- fill


def impute(values: list[float], strategy: str) -> list[float]:
    X = np.array(values, dtype=float).reshape(-1, 1)
    return fls(SimpleImputer(strategy=strategy).fit_transform(X))


def fill_block() -> dict:
    s = pd.Series(FILL)
    mean, median = fl(s.mean()), fl(s.median())
    expect("002 mean", mean, 68.77)
    expect("002 median", median, 43.65)
    filled = SimpleImputer(strategy="most_frequent").fit_transform(
        pd.DataFrame({"p": [np.nan if m is None else m for m in MODE]}, dtype=object)
    )
    filled = [str(v) for v in filled.ravel()]
    if filled[2] != "Aylık":
        fail(f"002 mode fill {filled}")
    return {
        "mean": mean,
        "median": median,
        "imputed": {"mean": impute(FILL, "mean"), "median": impute(FILL, "median")},
        "mode": {"filled": filled},
    }


# --------------------------------------------------------------------------- iqr


def iqr_stats(values: list[float], k: float = 1.5) -> dict:
    s = pd.Series(values, dtype=float)
    q1, q3 = fl(s.quantile(0.25)), fl(s.quantile(0.75))
    iqr = q3 - q1
    return {"q1": q1, "q3": q3, "iqr": iqr, "lo": q1 - k * iqr, "hi": q3 + k * iqr}


def outlier_idx(values: list[float], lo: float, hi: float) -> list[int]:
    return [i for i, v in enumerate(values) if v < lo or v > hi]


def iqr_block() -> dict:
    v = IQR
    s = pd.Series(v, dtype=float)
    b = iqr_stats(v)
    b30 = iqr_stats(v, 3.0)
    expect("003 q1", b["q1"], 41.35)
    expect("003 q3", b["q3"], 57.76)
    expect("003 iqr", b["iqr"], 16.41)
    expect("003 1.5 iqr", 1.5 * b["iqr"], 24.62)
    expect("003 k1.5 fences", [b["lo"], b["hi"]], [16.73, 82.38])
    expect("003 k3 fences", [b30["lo"], b30["hi"]], [-7.89, 107.00])
    out15 = outlier_idx(v, b["lo"], b["hi"])
    out30 = outlier_idx(v, b30["lo"], b30["hi"])
    if out15 != [7] or out30 != [7]:
        fail(f"003 outliers {out15} {out30}")
    inside = [x for x in v if b["lo"] <= x <= b["hi"]]
    whiskers = [min(inside), max(inside)]
    expect("003 whiskers", whiskers, [29.85, 60.20])
    median, mean, std0 = fl(s.median()), fl(s.mean()), fl(np.std(v))
    expect("003 median", median, 48.05)
    expect("003 mean", mean, 100.49)
    expect("003 std", std0, 143.74)
    z = fls(stats.zscore(v))
    expect("003 z(480)", z[7], 2.64)
    clipped = [min(max(x, b["lo"]), b["hi"]) for x in v]
    mean_deleted, mean_clipped = fl(np.mean(inside)), fl(np.mean(clipped))
    expect("003 three means", [mean, mean_deleted, mean_clipped], [100.49, 46.27, 50.79])
    dstats = iqr_stats(inside)
    d = pd.Series(inside)
    clipped30 = [min(max(x, b30["lo"]), b30["hi"]) for x in v]
    return {
        "sorted": fls(sorted(v)),
        "q1": b["q1"],
        "q3": b["q3"],
        "iqr": b["iqr"],
        "fences": {"k15": [b["lo"], b["hi"]], "k30": [b30["lo"], b30["hi"]]},
        "outliers": {"k15": out15, "k30": out30},
        "whiskers": whiskers,
        "median": median,
        "mean": mean,
        "std0": std0,
        "z": z,
        "zBound": math.sqrt(7),
        "meanAsIs": mean,
        "meanDeleted": mean_deleted,
        "meanClipped": mean_clipped,
        "deleted": {**dstats, "median": fl(d.median()), "mean": fl(d.mean())},
        "clippedK30Mean": fl(np.mean(clipped30)),
    }


def sweep_block() -> list[dict]:
    rows = []
    for x in SWEEP:
        fill = list(FILL)
        fill[FILL_EXTREME] = float(x)
        fs = pd.Series(fill)
        v = list(IQR)
        v[IQR_EXTREME] = float(x)
        b = iqr_stats(v)
        std0 = fl(np.std(v))
        rows.append(
            {
                "x": x,
                "fill": {
                    "mean": fl(fs.mean()),
                    "median": fl(fs.median()),
                    "imputedMean": impute(fill, "mean"),
                },
                "iqr": {
                    "sorted": fls(sorted(v)),
                    "q1": b["q1"],
                    "q3": b["q3"],
                    "lo": b["lo"],
                    "hi": b["hi"],
                    "outliers": outlier_idx(v, b["lo"], b["hi"]),
                    "mean": fl(np.mean(v)),
                    "std0": std0,
                    "zExtreme": (x - fl(np.mean(v))) / std0,
                },
            }
        )
    return rows


# --------------------------------------------------------------------------- scale

C = np.array([[t, f] for _, t, f in CUSTOMERS], dtype=float)
Q = np.array(QUERY, dtype=float)


def with_unit(m: np.ndarray, unit: float) -> np.ndarray:
    m = np.array(m, dtype=float)
    m[..., 0] = m[..., 0] * unit
    return m


def dists(points: np.ndarray, q: np.ndarray) -> list[float]:
    return fls(np.sqrt(((points - q) ** 2).sum(axis=1)))


def nearest(d: list[float]) -> int:
    return int(np.argmin(d))


def scale_block() -> dict:
    sc = StandardScaler().fit(C)
    mu, sigma = sc.mean_, sc.scale_
    expect("004 mu", mu, [25, 72.95])
    expect("004 sigma", sigma, [22.73, 58.29])
    z = sc.transform(C)
    qz = sc.transform(Q.reshape(1, -1))[0]
    expect("004 query z", qz, [-0.57, -0.31])
    by_unit = {}
    for name, u in UNITS.items():
        by_unit[name] = StandardScaler().fit_transform(with_unit(C, u))
        if np.max(np.abs(by_unit[name] - z)) > 1e-12:
            fail(f"004 zByUnit {name} differs from z")
    d = {name: dists(with_unit(C, u), with_unit(Q, u)) for name, u in UNITS.items()}
    d["z"] = dists(z, qz)
    expect("004 dist ay", d["ay"], [27.45, 22.09, 16.16, 36.90, 145.06, 50.32])
    expect("004 dist z", d["z"], [0.65, 0.97, 0.49, 1.48, 2.49, 2.13])
    near = {k: nearest(v) for k, v in d.items()}
    if near != {"ay": 2, "yil": 1, "gun": 4, "z": 2}:
        fail(f"004 nearest {near}")
    expect("004 yil M2", d["yil"][1], 2.68)
    expect("004 gun M5", d["gun"][4], 188.22)

    fcol = np.array([f for _, _, f in CUSTOMERS], dtype=float).reshape(-1, 1)
    rob = RobustScaler().fit(fcol)
    mm = MinMaxScaler().fit(fcol)
    fatura = {
        "StandardScaler": fls(StandardScaler().fit_transform(fcol)),
        "MinMaxScaler": fls(mm.transform(fcol)),
        "RobustScaler": fls(rob.transform(fcol)),
        "robust": {"center": fl(rob.center_[0]), "scale": fl(rob.scale_[0])},
        "minmax": {"min": fl(mm.data_min_[0]), "max": fl(mm.data_max_[0])},
    }
    expect("004 robust", [fatura["robust"]["center"], fatura["robust"]["scale"]], [49.63, 27.36])

    drag = []
    for q in DRAG_CASES:
        qa = np.array(q, dtype=float)
        dd = {name: dists(with_unit(C, u), with_unit(qa, u)) for name, u in UNITS.items()}
        dd["z"] = dists(z, sc.transform(qa.reshape(1, -1))[0])
        drag.append({"query": q, "dist": dd, "nearest": {k: nearest(v) for k, v in dd.items()}})
    return {
        "mu": fls(mu),
        "sigma": fls(sigma),
        "z": fls2(z),
        "queryZ": fls(qz),
        "zByUnit": {k: fls2(v) for k, v in by_unit.items()},
        "dist": d,
        "nearest": near,
        "fatura": fatura,
        "dragCases": drag,
    }


# --------------------------------------------------------------------------- split


def split_block() -> dict:
    idx = list(range(len(FATURA)))
    tr, te = train_test_split(idx, test_size=0.3, random_state=42, stratify=CHURN)
    if te != SPLIT_TEST or tr != SPLIT_TRAIN:
        fail(f"006 split {tr} / {te}")
    f = np.array(FATURA, dtype=float)
    rate = {
        "train": fl(np.mean([CHURN[i] for i in tr])),
        "test": fl(np.mean([CHURN[i] for i in te])),
    }
    expect("006 churn rate", [rate["train"], rate["test"]], [0.29, 0.33])
    xt, xe = f[tr].reshape(-1, 1), f[te].reshape(-1, 1)
    a = StandardScaler().fit(xt)
    tz = fls(a.transform(xe))
    expect("006 train mu", a.mean_, 58.63)
    expect("006 train sigma", a.scale_, 19.26)
    # The spec prints -1.05 for the third value because it divides by the rounded mu and sigma
    # (20.13 / 19.26); the exact value is -1.0449, so allow one unit in the last printed digit.
    if max(abs(x - y) for x, y in zip(tz, [-0.71, -1.33, -1.05])) > 0.006:
        fail(f"006 test z (train): {tz}")
    b = StandardScaler().fit(f.reshape(-1, 1))
    az = fls(b.transform(xe))
    expect("006 all mu", b.mean_, 52.69)
    expect("006 all sigma", b.scale_, 18.69)
    expect("006 test z (all)", az, [-0.41, -1.05, -0.76])
    return {
        "train": tr,
        "test": te,
        "churnRate": rate,
        "fitTrain": {
            "mu": fl(a.mean_[0]),
            "sigma": fl(a.scale_[0]),
            "testZ": tz,
            "trainZ": fls(a.transform(xt)),
        },
        "fitAll": {"mu": fl(b.mean_[0]), "sigma": fl(b.scale_[0]), "testZ": az},
    }


# --------------------------------------------------------------------------- output


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def main() -> None:
    fixture = {
        "fill": fill_block(),
        "iqr": iqr_block(),
        "extremeSweep": sweep_block(),
        "scale": scale_block(),
        "split": split_block(),
    }
    iqr_data = {
        "fill": {"values": nones(FILL), "extremeIndex": FILL_EXTREME},
        "iqr": {"values": IQR, "extremeIndex": IQR_EXTREME},
        "mode": {"values": MODE},
    }
    scale_data = {
        "customers": [{"id": i, "t": t, "f": f} for i, t, f in CUSTOMERS],
        "query": {"t": QUERY[0], "f": QUERY[1]},
        "split": {"values": FATURA, "churn": CHURN, "train": SPLIT_TRAIN, "test": SPLIT_TEST},
    }
    write_text(IQR_OUT, json.dumps(iqr_data, ensure_ascii=False, indent=1) + "\n")
    write_text(SCALE_OUT, json.dumps(scale_data, ensure_ascii=False, indent=1) + "\n")
    write_text(FIXTURE_OUT, json.dumps(fixture, ensure_ascii=False, indent=1, allow_nan=False) + "\n")
    print(f"{len(SWEEP)} sweep cases; split train {SPLIT_TRAIN} test {SPLIT_TEST}")
    for p in (IQR_OUT, SCALE_OUT, FIXTURE_OUT):
        print(f"Wrote {p.relative_to(REPO).as_posix()}")


if __name__ == "__main__":
    main()
