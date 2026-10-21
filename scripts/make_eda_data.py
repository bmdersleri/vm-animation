"""Generate the Chapter 2 (EDA) pages' data and pandas / numpy / scipy fixtures.

Usage:
    python scripts/make_eda_data.py

Writes (relative to the repo root):
    src/concepts/dagilim-carpiklik/data/dagilim_data.json        four series, bins, extreme sweep
    src/concepts/kutu-grafigi/data/kutu_data.json                three groups, sixth student, k = 1.5 / 3
    src/concepts/korelasyon-isi-haritasi/data/korelasyon_data.json   004 / 006 matrices, Anscombe quartet
    tests/fixtures/eda_pandas.json                               the same blocks at full precision + versions

Reproduces the book's examples 002, 003, 004, 005 and 006 plus Anscombe's
quartet and asserts every control value of the spec (rounded to two decimals;
three for the correlation cells and Anscombe's r); any mismatch exits non-zero.
Output is deterministic: running it twice produces byte-identical files.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import scipy
from scipy import stats

REPO = Path(__file__).resolve().parent.parent
DAGILIM_OUT = REPO / "src" / "concepts" / "dagilim-carpiklik" / "data" / "dagilim_data.json"
KUTU_OUT = REPO / "src" / "concepts" / "kutu-grafigi" / "data" / "kutu_data.json"
KORELASYON_OUT = REPO / "src" / "concepts" / "korelasyon-isi-haritasi" / "data" / "korelasyon_data.json"
FIXTURE_OUT = REPO / "tests" / "fixtures" / "eda_pandas.json"

# --------------------------------------------------------------------------- data

SERIES = {
    "002": [8, 10, 12, 12, 14, 15, 18, 20, 25, 30],  # example 002
    "003": [5, 6, 7, 8, 8, 9, 10, 11, 12, 28],  # example 003
    "simetrik": [10, 12, 14, 15, 16, 16, 17, 18, 20, 22],
    "sol": [4, 8, 10, 12, 13, 14, 14, 15, 16, 17],
}
BINS = (3, 5, 10)
SWEEP = [28, 32, 36, 40, 45, 50, 60]  # 003's last value dragged

GROUPS = [  # example 005: (id, name, five grades, sixth student or None)
    ("bilgisayar", "Bilgisayar", [70, 74, 78, 82, 98], 66),
    ("elektrik", "Elektrik", [55, 68, 72, 76, 80], 62),
    ("makine", "Makine", [50, 66, 72, 78, 94], None),
]
KS = ("1.5", "3")

CORR_VARS = ["Çalışma", "Devamsızlık", "Not"]  # example 004
CORR_ROWS = [
    [8, 10, 58],
    [10, 8, 62],
    [12, 7, 68],
    [15, 5, 75],
    [18, 4, 82],
    [20, 3, 86],
    [25, 1, 94],
]
HEAT_VARS = ["Çalışma", "Devamsızlık", "Not", "Uyku"]  # example 006
HEAT_ROWS = [
    [8, 10, 58, 5],
    [10, 8, 63, 6],
    [12, 7, 68, 6],
    [15, 5, 77, 7],
    [18, 4, 84, 7],
    [20, 2, 90, 8],
]
CHURN = [1, 0, 0, 1, 0, 0]

ANSCOMBE_X = [10, 8, 13, 9, 11, 14, 6, 4, 12, 7, 5]
ANSCOMBE = [
    ("I", ANSCOMBE_X, [8.04, 6.95, 7.58, 8.81, 8.33, 9.96, 7.24, 4.26, 10.84, 4.82, 5.68]),
    ("II", ANSCOMBE_X, [9.14, 8.14, 8.74, 8.77, 9.26, 8.1, 6.13, 3.1, 9.13, 7.26, 4.74]),
    ("III", ANSCOMBE_X, [7.46, 6.77, 12.74, 7.11, 7.81, 8.84, 6.08, 5.39, 8.15, 6.42, 5.73]),
    ("IV", [8, 8, 8, 8, 8, 8, 8, 19, 8, 8, 8], [6.58, 5.76, 7.71, 8.84, 8.47, 7.04, 5.25, 12.5, 5.56, 7.91, 6.89]),
]
LEVERAGE_SET = 4
LEVERAGE_INDEX = 7
LEVERAGE_X = 19
LEVERAGE_Y = 12.5
DRAG_Y = [6, 8, 10, 12.5, 15, 18, 20]


# --------------------------------------------------------------------------- helpers


def fail(msg: str) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def expect(name: str, got, want, places: int = 2) -> None:
    """Assert round(got, places) == want (scalars or equal-length lists)."""
    scale = 10.0**places
    # round half away from zero (the spec's convention; -0.9928 -> -0.993)
    a = np.asarray(got, dtype=float)
    g = (np.sign(a) * np.floor(np.abs(a) * scale + 0.5 + 1e-9) / scale).ravel()
    w = np.asarray(want, dtype=float).ravel()
    if g.shape != w.shape or (g.size and np.max(np.abs(g - w)) > 1e-9):
        fail(f"{name}: got {g.tolist()}, want {w.tolist()}")


def expect_fields(name: str, got: dict, want: dict) -> None:
    """Assert each field of a box statistic (or another flat dict) separately."""
    for key, want_value in want.items():
        expect(f"{name} {key}", got[key], want_value)


def close(name: str, got: float, want: float, tol: float = 0.001) -> None:
    """Assert |got - want| <= tol; for spec values printed with "≈"."""
    if abs(float(got) - want) > tol:
        fail(f"{name}: got {float(got)!r}, want {want} ± {tol}")


def fl(x) -> float:
    return float(x)


def fls(xs) -> list[float]:
    return [float(v) for v in np.asarray(xs, dtype=float).ravel()]


def fls2(m) -> list[list[float]]:
    return [[float(v) for v in row] for row in np.asarray(m, dtype=float)]


def rounded(m, places: int) -> list[list[float]]:
    return [[round(float(v), places) for v in row] for row in np.asarray(m, dtype=float)]


# --------------------------------------------------------------------------- dagilim


def series_block(values: list[float]) -> dict:
    s = pd.Series(values, dtype=float)
    log_values = np.log1p(np.asarray(values, dtype=float))
    ls = pd.Series(log_values)
    return {
        "values": values,
        "mean": fl(s.mean()),
        "median": fl(s.median()),
        "std": fl(s.std()),
        "skew": fl(s.skew()),
        "log": {
            "values": fls(log_values),
            "mean": fl(ls.mean()),
            "median": fl(ls.median()),
            "skew": fl(ls.skew()),
        },
    }


def dagilim_block() -> dict:
    want = {  # mean, median, std (ddof 1), skew (pandas G1)
        "002": (16.4, 14.5, 6.93, 0.90),
        "003": (10.4, 8.5, 6.55, 2.54),
        "simetrik": (16.0, 16.0, 3.56, 0.0),
        "sol": (12.3, 13.5, 3.97, -1.06),
    }
    want_bins = {
        "002": ([6, 2, 2], [4, 2, 2, 1, 1], [2, 2, 1, 1, 1, 1, 0, 1, 0, 1]),
        "003": ([9, 0, 1], [6, 3, 0, 0, 1], [3, 3, 2, 1, 0, 0, 0, 0, 0, 1]),
        "simetrik": ([2, 5, 3], [2, 1, 4, 1, 2], [1, 1, 0, 1, 1, 3, 1, 0, 1, 1]),
        "sol": ([2, 2, 6], [1, 1, 1, 4, 3], [1, 0, 0, 1, 1, 0, 2, 2, 1, 2]),
    }
    series = {key: series_block(values) for key, values in SERIES.items()}
    bins: dict[str, dict[str, list[int]]] = {}
    for key, values in SERIES.items():
        bins[key] = {str(b): np.histogram(values, bins=b)[0].tolist() for b in BINS}
        mean, median, std, skew = want[key]
        expect(f"{key} mean", series[key]["mean"], mean)
        expect(f"{key} median", series[key]["median"], median)
        expect(f"{key} std", series[key]["std"], std)
        expect(f"{key} skew", series[key]["skew"], skew)
        for places, b in enumerate(BINS):
            expect(f"{key} bins {b}", bins[key][str(b)], want_bins[key][places], places=0)

    expect("002 log1p skew", series["002"]["log"]["skew"], 0.25)
    expect("002 log1p mean", series["002"]["log"]["mean"], 2.79)
    expect("002 log1p median", series["002"]["log"]["median"], 2.74)
    expect("003 log1p skew", series["003"]["log"]["skew"], 1.50)
    expect("003 log1p mean", series["003"]["log"]["mean"], 2.33)
    expect("003 log1p median", series["003"]["log"]["median"], 2.25)

    sweep = []
    for x in SWEEP:
        v = list(SERIES["003"])
        v[-1] = float(x)
        s = pd.Series(v, dtype=float)
        sweep.append({"x": x, "mean": fl(s.mean()), "median": fl(s.median()), "skew": fl(s.skew())})
    for row in sweep:
        expect(f"sweep {row['x']} median", row["median"], 8.5)
    expect("sweep 28 mean", sweep[0]["mean"], 10.4)
    expect("sweep 60 mean", sweep[-1]["mean"], 13.6)
    expect("sweep 28 skew", sweep[0]["skew"], 2.54)
    expect("sweep 60 skew", sweep[-1]["skew"], 3.06)

    return {"series": series, "bins": bins, "extremeSweep": sweep}


# --------------------------------------------------------------------------- kutu


def box_stat(values: list[float], k: float) -> dict:
    s = pd.Series(values, dtype=float)
    q1, median, q3 = fl(s.quantile(0.25)), fl(s.quantile(0.5)), fl(s.quantile(0.75))
    iqr = q3 - q1
    lo, hi = q1 - k * iqr, q3 + k * iqr
    inside = [x for x in values if lo <= x <= hi]
    return {
        "q1": q1,
        "median": median,
        "q3": q3,
        "iqr": iqr,
        "lo": lo,
        "hi": hi,
        "wLo": min(inside),
        "wHi": max(inside),
        "outliers": sorted(x for x in values if x < lo or x > hi),
    }


def kutu_block() -> dict:
    groups = []
    for gid, name, values, sixth in GROUPS:
        stats_at = {key: box_stat(values, float(key)) for key in KS}
        with_sixth = None
        if sixth is not None:
            merged = sorted(values + [sixth])
            with_sixth = {"values": merged, "stats": {key: box_stat(merged, float(key)) for key in KS}}
        groups.append(
            {
                "id": gid,
                "name": name,
                "values": values,
                "sixth": sixth,
                "stats": stats_at,
                "withSixth": with_sixth,
            }
        )

    bilgisayar, elektrik, makine = groups
    expect_fields("005 bilgisayar", bilgisayar["stats"]["1.5"],
                  {"q1": 74, "median": 78, "q3": 82, "iqr": 8, "lo": 62, "hi": 94, "wLo": 70, "wHi": 82, "outliers": [98]})
    expect_fields("005 elektrik", elektrik["stats"]["1.5"],
                  {"q1": 68, "median": 72, "q3": 76, "iqr": 8, "lo": 56, "hi": 88, "wLo": 68, "wHi": 80, "outliers": [55]})
    expect_fields("005 makine", makine["stats"]["1.5"],
                  {"q1": 66, "median": 72, "q3": 78, "iqr": 12, "lo": 48, "hi": 96, "wLo": 50, "wHi": 94, "outliers": []})
    expect_fields("005 bilgisayar sixth", bilgisayar["withSixth"]["stats"]["1.5"],
                  {"q1": 71, "median": 76, "q3": 81, "iqr": 10, "lo": 56, "hi": 96, "wLo": 66, "wHi": 82, "outliers": [98]})
    expect_fields("005 elektrik sixth", elektrik["withSixth"]["stats"]["1.5"],
                  {"q1": 63.5, "median": 70, "q3": 75, "iqr": 11.5, "lo": 46.25, "hi": 92.25, "wLo": 55, "wHi": 80, "outliers": []})
    if makine["sixth"] is not None or makine["withSixth"] is not None:
        fail("005 makine must not carry a sixth student (the book gives one only for Bilgisayar and Elektrik)")

    for group, fences in (
        (bilgisayar, (50, 106)),
        (elektrik, (44, 100)),
        (makine, (30, 114)),
    ):
        expect(f"005 {group['id']} k3 fences", [group["stats"]["3"]["lo"], group["stats"]["3"]["hi"]], list(fences))
        if group["stats"]["3"]["outliers"]:
            fail(f"005 {group['id']} k3 still has outliers {group['stats']['3']['outliers']}")

    for group, want_mean in ((bilgisayar, 80.4), (elektrik, 70.2), (makine, 72.0)):
        expect(f"005 {group['id']} mean", pd.Series(group["values"], dtype=float).mean(), want_mean)

    return {"groups": groups}


# --------------------------------------------------------------------------- korelasyon


def matrix_block(variables: list[str], rows: list[list[float]]) -> dict:
    df = pd.DataFrame(rows, columns=variables)
    return {"variables": variables, "rows": rows, "matrix": fls2(df.corr().to_numpy())}


def anscombe_block() -> dict:
    sets = []
    for sid, x, y in ANSCOMBE:
        xs, ys = pd.Series(x, dtype=float), pd.Series(y, dtype=float)
        slope, _intercept = np.polyfit(np.asarray(x, dtype=float), np.asarray(y, dtype=float), 1)
        sets.append(
            {
                "id": sid,
                "x": x,
                "y": y,
                "meanX": fl(xs.mean()),
                "meanY": fl(ys.mean()),
                "varX": fl(xs.var()),
                "varY": fl(ys.var()),
                "r": fl(xs.corr(ys)),
                "slope": fl(slope),
            }
        )

    for s in sets:
        if s["meanX"] != 9 or s["varX"] != 11:
            fail(f"anscombe {s['id']} meanX/varX {s['meanX']} / {s['varX']}")
        expect(f"anscombe {s['id']} meanY", s["meanY"], 7.5)
        close(f"anscombe {s['id']} meanY (spec 7.5009)", s["meanY"], 7.5009)
        close(f"anscombe {s['id']} varY", s["varY"], 4.127, 0.005)
        close(f"anscombe {s['id']} r", s["r"], 0.8164)
        expect(f"anscombe {s['id']} slope", s["slope"], 0.5, places=3)
    expect("anscombe I meanY", sets[0]["meanY"], 7.5009, places=4)

    x = np.asarray(ANSCOMBE[3][1], dtype=float)
    y = np.asarray(ANSCOMBE[3][2], dtype=float)
    if x[LEVERAGE_INDEX] != LEVERAGE_X or y[LEVERAGE_INDEX] != LEVERAGE_Y:
        fail(f"anscombe IV leverage point {x[LEVERAGE_INDEX]} {y[LEVERAGE_INDEX]}")
    drag = []
    for yv in DRAG_Y:
        yy = y.copy()
        yy[LEVERAGE_INDEX] = float(yv)
        drag.append({"y": yv, "r": fl(pd.Series(x).corr(pd.Series(yy)))})
    expect("anscombe drag y6", drag[0]["r"], -0.249, places=3)
    expect("anscombe drag y20", drag[-1]["r"], 0.958, places=3)
    close("anscombe drag y12.5", drag[3]["r"], sets[3]["r"], 1e-12)

    spearman = fl(stats.spearmanr(ANSCOMBE[1][1], ANSCOMBE[1][2]).statistic)
    expect("anscombe II spearman", spearman, 0.691, places=3)
    close("anscombe II pearson (spec 0.816)", sets[1]["r"], 0.816, 0.001)

    return {
        "sets": sets,
        "leverage": {"set": LEVERAGE_SET, "index": LEVERAGE_INDEX, "x": LEVERAGE_X, "y": LEVERAGE_Y},
        "drag": drag,
        "spearman": spearman,
    }


def korelasyon_block() -> dict:
    korelasyon = matrix_block(CORR_VARS, CORR_ROWS)
    expect("004 matrix", rounded(korelasyon["matrix"], 3),
           [[1, -0.988, 0.995], [-0.988, 1, -0.993], [0.995, -0.993, 1]], places=3)

    heatmap = matrix_block(HEAT_VARS, HEAT_ROWS)
    expect("006 matrix", rounded(heatmap["matrix"], 3),
           [[1, -0.991, 0.999, 0.961],
            [-0.991, 1, -0.992, -0.987],
            [0.999, -0.992, 1, 0.965],
            [0.961, -0.987, 0.965, 1]], places=3)

    df = pd.DataFrame(HEAT_ROWS, columns=HEAT_VARS).assign(churn=CHURN)
    churn_matrix = fls2(df.corr().to_numpy())
    expect("006 churn row", [[row] for row in rounded(churn_matrix, 3)[4][:4]],
           [[-0.387], [0.401], [-0.363], [-0.369]], places=3)
    heatmap["withChurn"] = {"variables": HEAT_VARS + ["churn"], "matrix": churn_matrix}

    return {"korelasyon": korelasyon, "heatmap": heatmap, "anscombe": anscombe_block()}


# --------------------------------------------------------------------------- output


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def main() -> None:
    dagilim = dagilim_block()
    kutu = kutu_block()
    korelasyon = korelasyon_block()
    fixture = {
        "dagilim": dagilim,
        "kutu": kutu,
        "korelasyon": korelasyon,
        "versions": {"pandas": pd.__version__, "numpy": np.__version__, "scipy": scipy.__version__},
    }
    for path, block in ((DAGILIM_OUT, dagilim), (KUTU_OUT, kutu), (KORELASYON_OUT, korelasyon), (FIXTURE_OUT, fixture)):
        write_text(path, json.dumps(block, ensure_ascii=False, indent=1, allow_nan=False) + "\n")
    print(f"{len(SERIES)} series, {len(kutu['groups'])} box groups, {len(korelasyon['anscombe']['sets'])} Anscombe sets")
    for p in (DAGILIM_OUT, KUTU_OUT, KORELASYON_OUT, FIXTURE_OUT):
        print(f"Wrote {p.relative_to(REPO).as_posix()}")


if __name__ == "__main__":
    main()
