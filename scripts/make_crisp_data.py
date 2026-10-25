"""Generate Chapter 1 (CRISP-DM cafe) data and the pandas fixture.

Run:   python scripts/make_crisp_data.py
Check: python scripts/make_crisp_data.py --check   (writes nothing; exit 1 on drift)
Seed:  python scripts/make_crisp_data.py --find-seed   (first seed from 0 that passes every check;
       writes nothing; the result is written once into SEED below)

Reads nothing (no CSV): the book snippets of chapter 1 are written in this file verbatim and run
with pandas.

Writes (relative to the repo root):
  src/concepts/crisp-dm/data/crisp.json  data the page draws
  tests/fixtures/crisp_pandas.json       full precision numbers the TypeScript maths is compared with

Data (crisp.json; display numbers 6 decimals, numbers that enter a calculation full precision):
  meta     seed, versions, constants (old order 50, margin 1.10, ask rate 0.9, exam weeks, month
           levels, criteria 0.15 / 0.03, minimum group 5, pool and test days).
  book     isHedefi, the 4 row kafeVerisi, hamVeri before / after and its means, the leakage
           example, the KafeAnalizi output, the satisKayitlari and kafeVerisi groupings.
  days     The 70 table days (2026-03-06 .. 2026-05-14): weekday (0 = Monday), exam week, month,
           satis (null where the till failed), stokTukendi, soran (asked after the stock ran out),
           aySonuIsrafi (waste of the old order of 50 over the whole month), talep (true demand),
           test (the last 14 days).
  baseline Outcome of ordering 50 every test day.
  grid     32 cells (days 4/14/28/56 x missing sifir/cikar x stock satis/soran x leak false/true,
           nested in that order): usable days per group, enough, group predictions of the model
           without the leaking input (null for an empty group), leak coefficient, the 14 evaluation
           and 14 deployment orders (evaluation uses May's month-end waste, deployment April's) and
           the two outcomes.

Fixture (crisp_pandas.json), full precision: every cell's group predictions, leak coefficient,
unrounded margin predictions, orders and outcomes; the test demand; the baseline; the book pandas
numbers.

Checks (SystemExit "check failed: <name>"; the generator never bends data to pass):
  book_numbers, enough_by_days, cell_56_cikar_soran_ok, cell_56_cikar_satis_service_fails,
  cell_56_sifir_soran_one_fails, cell_56_leak_eval_ok_deploy_fails, exam_stockouts_half,
  ols_equals_group_means, orders_round_half_up.
"""

import datetime
import json
import math
import platform
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn
from sklearn.linear_model import LinearRegression

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = "src/concepts/crisp-dm/data/crisp.json"
FIXTURE_PATH = "tests/fixtures/crisp_pandas.json"

SEED = 0

OLD_ORDER = 50
MARGIN = 1.10
ASK_RATE = 0.9
MONTH_LEVEL = {3: -5, 4: 5, 5: 0}
EXAM_WEEKS = [("2026-03-23", "2026-03-29"), ("2026-04-20", "2026-04-26"),
              ("2026-05-04", "2026-05-10")]
CRITERIA = {"waste": 0.15, "service": 0.03}
MIN_GROUP = 5
POOL_DAYS = 56
TEST_DAYS = 14
FIRST_DAY = datetime.date(2026, 3, 1)
LAST_DAY = datetime.date(2026, 5, 31)
TABLE_START = datetime.date(2026, 3, 6)
DAY_OPTIONS = [4, 14, 28, 56]


def fail(name):
    raise SystemExit(f"check failed: {name}")


def r6(x):
    return None if x is None else round(float(x), 6)


def round_half_up(x):
    """Same as JavaScript Math.round."""
    return int(math.floor(x + 0.5))


def is_exam(d):
    return any(datetime.date.fromisoformat(a) <= d <= datetime.date.fromisoformat(b)
               for a, b in EXAM_WEEKS)


def build_days(seed):
    """All 92 calendar days with demand, then the 70 table days with the missing sales."""
    rng = np.random.default_rng(seed)
    dates = [FIRST_DAY + datetime.timedelta(days=i) for i in range((LAST_DAY - FIRST_DAY).days + 1)]
    eps = rng.normal(0.0, 3.0, len(dates))
    rows = []
    for d, e in zip(dates, eps):
        exam = is_exam(d)
        talep = round_half_up(40 + 20 * int(exam) + MONTH_LEVEL[d.month] + float(e))
        rows.append({"date": d, "exam": exam, "talep": talep, "month": d.month})
    for row in rows:
        row["soran"] = int(rng.binomial(max(row["talep"] - OLD_ORDER, 0), ASK_RATE))
    waste = {m: sum(max(OLD_ORDER - r["talep"], 0) for r in rows if r["month"] == m)
             for m in MONTH_LEVEL}
    table = [r for r in rows if r["date"] >= TABLE_START][:POOL_DAYS + TEST_DAYS]
    exam_pos = [i for i in range(POOL_DAYS) if table[i]["exam"]]
    norm_pos = [i for i in range(POOL_DAYS) if not table[i]["exam"]]
    missing = set(int(i) for i in rng.choice(exam_pos, 2, replace=False))
    missing |= set(int(i) for i in rng.choice(norm_pos, 2, replace=False))
    days = []
    for i, r in enumerate(table):
        days.append({
            "date": r["date"].isoformat(), "weekday": r["date"].weekday(), "sinav": r["exam"],
            "month": r["month"],
            "satis": None if i in missing else min(r["talep"], OLD_ORDER),
            "stokTukendi": r["talep"] >= OLD_ORDER, "soran": r["soran"],
            "aySonuIsrafi": waste[r["month"]], "talep": r["talep"], "test": i >= POOL_DAYS,
        })
    return days


def evaluate(orders, demand):
    prepared = int(sum(orders))
    wasted = int(sum(max(o - t, 0) for o, t in zip(orders, demand)))
    lost = int(sum(max(t - o, 0) for o, t in zip(orders, demand)))
    total = int(sum(demand))
    return {"prepared": prepared, "wasted": wasted, "lost": lost, "demand": total,
            "wasteRate": wasted / prepared if prepared else None,
            "lostShare": lost / total if total else None}


def verdict(result, base_rate):
    """Add the reduction against the baseline waste rate and the two criteria."""
    reduction = None
    if result["wasteRate"] is not None and base_rate:
        reduction = 1 - result["wasteRate"] / base_rate
    waste_ok = reduction is not None and reduction >= CRITERIA["waste"]
    service_ok = result["lostShare"] is not None and result["lostShare"] <= CRITERIA["service"]
    return {**result, "reduction": reduction, "wasteOk": bool(waste_ok),
            "serviceOk": bool(service_ok), "ok": bool(waste_ok and service_ok)}


def build_cell(days, base_rate, n, missing, stock, leak):
    pool = pd.DataFrame(days[:n])
    test = pd.DataFrame(days[POOL_DAYS:])
    satis = pool["satis"].astype(float)
    target = satis if stock == "satis" else satis + pool["soran"]
    used = pool.assign(y=target)
    if missing == "sifir":
        used = used.assign(y=used["y"].fillna(0))
    else:
        used = used.dropna(subset=["y"])
    usable = {"normal": int((~used["sinav"]).sum()), "sinav": int(used["sinav"].sum())}
    x_cols = ["sinav", "aySonuIsrafi"] if leak else ["sinav"]
    model = LinearRegression().fit(used[x_cols].astype(float).to_numpy(), used["y"].to_numpy())
    # Evaluation sees May's own month-end waste; deployment only knows the last closed month, April.
    waste_eval = test["aySonuIsrafi"].astype(float).to_numpy()
    waste_deploy = np.full(len(test), float(days[POOL_DAYS - 1]["aySonuIsrafi"]))
    sinav_test = test["sinav"].astype(float).to_numpy()

    def predict(waste):
        cols = [sinav_test] + ([waste] if leak else [])
        return model.predict(np.column_stack(cols))

    exact = {"eval": [MARGIN * float(p) for p in predict(waste_eval)],
             "deploy": [MARGIN * float(p) for p in predict(waste_deploy)]}
    orders = {k: [round_half_up(x) for x in v] for k, v in exact.items()}
    plain = LinearRegression().fit(used[["sinav"]].astype(float).to_numpy(), used["y"].to_numpy())
    group = {}
    means = {}
    for key, flag in (("normal", False), ("sinav", True)):
        has = usable[key] > 0
        group[key] = float(plain.predict([[1.0 if flag else 0.0]])[0]) if has else None
        means[key] = float(used.loc[used["sinav"] == flag, "y"].mean()) if has else None
    demand = [int(t) for t in test["talep"]]
    return {
        "days": n, "missing": missing, "stock": stock, "leak": leak, "usable": usable,
        "enough": usable["normal"] >= MIN_GROUP and usable["sinav"] >= MIN_GROUP,
        "pred": group, "groupMeans": means,
        "leakCoef": float(model.coef_[1]) if leak else None,
        "orders": orders, "exact": exact,
        "eval": verdict(evaluate(orders["eval"], demand), base_rate),
        "deploy": verdict(evaluate(orders["deploy"], demand), base_rate),
    }


def book_part():
    """The book snippets (chapter 1) run with pandas."""
    sat = pd.DataFrame({"urun": ["Kahve", "Kahve", "Sandvic", "Sandvic"],
                        "satis_adedi": [85, 110, 42, 31],
                        "sinav_haftasi": [False, True, False, True]})
    grp = sat.groupby("sinav_haftasi")["satis_adedi"].mean()
    ham = pd.DataFrame({"urun": ["kahve", " Kahve ", "Sandvic"], "satis_adedi": [80, None, 35]})
    temiz = ham.copy()
    temiz["urun"] = temiz["urun"].str.strip().str.title()
    temiz["satis_adedi"] = temiz["satis_adedi"].fillna(0)
    ham_clean = ham.copy()
    ham_clean["urun"] = ham_clean["urun"].str.strip().str.title()
    kafe = pd.DataFrame({
        "tarih": ["2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05"],
        "urun": ["Kahve", "Kahve", "Sandvic", "Sandvic"],
        "satis_adedi": [95, 110, 42, 30],
        "stok_tukendi": [False, True, False, False],
        "sinav_haftasi": [False, True, False, True]})
    kgrp = kafe.groupby("sinav_haftasi")["satis_adedi"].mean()
    analiz = pd.DataFrame({"sinav": [True, False, True], "adet": [90, "100", None]})
    analiz["adet"] = pd.to_numeric(analiz["adet"], errors="coerce")
    sinav = analiz[analiz["sinav"] == True]  # noqa: E712 (verbatim book code)
    ortalama = float(sinav["adet"].dropna().mean())

    def cells(df):
        out = []
        for urun, adet in zip(df["urun"], df["satis_adedi"]):
            out.append({"urun": urun, "satis_adedi": None if pd.isna(adet) else float(adet)})
        return out

    return {
        "isHedefi": {"amac": "Sandviç israfını azaltmak",
                     "basari_olcutu": "Aylık israf oranını yüzde 15 azaltmak",
                     "veri_sorusu": "Hangi günlerde talep daha yüksektir?"},
        "kafeVerisi": [
            {"tarih": r.tarih, "urun": r.urun, "satis_adedi": int(r.satis_adedi),
             "stok_tukendi": bool(r.stok_tukendi), "sinav_haftasi": bool(r.sinav_haftasi)}
            for r in kafe.itertuples()],
        "satisKayitlari": {"normal": float(grp[False]), "sinav": float(grp[True])},
        "kafeVerisiGrup": {"normal": float(kgrp[False]), "sinav": float(kgrp[True])},
        "hamVeri": {
            "once": cells(ham),
            "sonra": cells(temiz),
            "kahveFillna0": float(temiz[temiz["urun"] == "Kahve"]["satis_adedi"].mean()),
            "kahveAtlanir": float(ham_clean[ham_clean["urun"] == "Kahve"]["satis_adedi"].mean()),
            "genelFillna0": float(temiz["satis_adedi"].mean()),
            "genelAtlanir": float(ham["satis_adedi"].mean()),
        },
        "sizinti": {"gunlukKayit": {"gun": "2026-03-02", "sicaklik": 12, "ay_sonu_israfi": 90},
                    "yanlisGirdiler": ["sicaklik", "ay_sonu_israfi"],
                    "dogruGirdiler": ["sicaklik"]},
        "kafeAnalizi": {"mean": ortalama, "count": int(len(sinav)),
                        "used": int(sinav["adet"].notna().sum())},
    }


def check_book(book):
    pairs = [
        (book["satisKayitlari"]["normal"], 63.5), (book["satisKayitlari"]["sinav"], 70.5),
        (book["hamVeri"]["kahveAtlanir"], 80.0), (book["hamVeri"]["kahveFillna0"], 40.0),
        (book["hamVeri"]["genelAtlanir"], 57.5), (book["hamVeri"]["genelFillna0"], 38.33),
        (book["kafeAnalizi"]["mean"], 90.0),
        (book["kafeVerisiGrup"]["normal"], 68.5), (book["kafeVerisiGrup"]["sinav"], 70.0),
    ]
    if any(round(a, 2) != b for a, b in pairs):
        fail("book_numbers")
    if book["kafeAnalizi"]["count"] != 2 or book["kafeAnalizi"]["used"] != 1:
        fail("book_numbers")


def generate(seed):
    book = book_part()
    check_book(book)
    days = build_days(seed)
    demand = [d["talep"] for d in days[POOL_DAYS:]]
    base = verdict(evaluate([OLD_ORDER] * TEST_DAYS, demand), None)
    base_rate = base["wasteRate"]
    base["reduction"] = 0.0

    grid = []
    for n in DAY_OPTIONS:
        for missing in ("sifir", "cikar"):
            for stock in ("satis", "soran"):
                for leak in (False, True):
                    grid.append(build_cell(days, base_rate, n, missing, stock, leak))
    cell = {(c["days"], c["missing"], c["stock"], c["leak"]): c for c in grid}

    for c in grid:
        if c["enough"] != (c["days"] >= 28):
            fail("enough_by_days")
    ok = cell[(56, "cikar", "soran", False)]
    if not (ok["eval"]["ok"] and ok["deploy"]["ok"]):
        fail("cell_56_cikar_soran_ok")
    sat = cell[(56, "cikar", "satis", False)]
    if sat["eval"]["serviceOk"] or sat["deploy"]["serviceOk"]:
        fail("cell_56_cikar_satis_service_fails")
    zero = cell[(56, "sifir", "soran", False)]
    if (zero["eval"]["wasteOk"] == zero["eval"]["serviceOk"]
            or zero["deploy"]["wasteOk"] == zero["deploy"]["serviceOk"]):
        fail("cell_56_sifir_soran_one_fails")
    lk = cell[(56, "cikar", "soran", True)]
    if not (lk["eval"]["ok"] and not lk["deploy"]["ok"]):
        fail("cell_56_leak_eval_ok_deploy_fails")
    pool_exam = [d for d in days[:POOL_DAYS] if d["sinav"]]
    if sum(d["stokTukendi"] for d in pool_exam) * 2 < len(pool_exam):
        fail("exam_stockouts_half")
    for c in grid:
        if c["leak"]:
            continue
        for key in ("normal", "sinav"):
            if c["pred"][key] is not None and abs(c["pred"][key] - c["groupMeans"][key]) > 1e-9:
                fail("ols_equals_group_means")
    for c in grid:
        for x in c["exact"]["eval"] + c["exact"]["deploy"]:
            if abs((x + 0.5) % 1.0 - 0.0) < 1e-9 or abs((x + 0.5) % 1.0 - 1.0) < 1e-9:
                fail("orders_round_half_up")

    def out_r6(o):
        return {k: (r6(v) if isinstance(v, float) else v) for k, v in o.items()}

    data_cells = [{
        "days": c["days"], "missing": c["missing"], "stock": c["stock"], "leak": c["leak"],
        "usable": c["usable"], "enough": c["enough"],
        "pred": {k: r6(v) for k, v in c["pred"].items()}, "leakCoef": r6(c["leakCoef"]),
        "orders": c["orders"], "eval": out_r6(c["eval"]), "deploy": out_r6(c["deploy"]),
    } for c in grid]
    versions = {"python": platform.python_version(), "numpy": np.__version__,
                "pandas": pd.__version__, "scikit-learn": sklearn.__version__}
    meta = {
        "seed": seed, "versions": versions, "oldOrder": OLD_ORDER, "margin": MARGIN,
        "askRate": ASK_RATE, "examWeeks": [list(w) for w in EXAM_WEEKS],
        "monthLevel": {str(k): v for k, v in MONTH_LEVEL.items()}, "criteria": CRITERIA,
        "minGroup": MIN_GROUP, "poolDays": POOL_DAYS, "testDays": TEST_DAYS,
    }
    data = {"meta": meta, "book": book, "days": days, "baseline": out_r6(base),
            "grid": data_cells}
    fixture = {
        "demand": demand, "baseline": base,
        "book": {"satisKayitlari": book["satisKayitlari"], "kafeVerisiGrup": book["kafeVerisiGrup"],
                 "hamVeri": {k: v for k, v in book["hamVeri"].items() if k not in ("once", "sonra")},
                 "kafeAnalizi": book["kafeAnalizi"]},
        "cells": [{k: c[k] for k in ("days", "missing", "stock", "leak", "usable", "enough", "pred",
                                     "leakCoef", "orders", "exact", "eval", "deploy")}
                  for c in grid],
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
        print("crisp data up to date")
    else:
        for p, text in files.items():
            path = ROOT / p
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(text.encode("utf-8"))
            print(f"Generated {p} ({len(text.encode('utf-8'))} bytes)")
