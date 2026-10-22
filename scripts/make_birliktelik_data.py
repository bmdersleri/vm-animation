"""Generate Chapter 8 (birliktelik / association rules) data.

Run:   python scripts/make_birliktelik_data.py
Check: python scripts/make_birliktelik_data.py --check   (writes nothing; exit 1 on drift)

Data: the book's 18 market baskets (ch08, Blok 1), in the book's order. Item ids are the
  book's ASCII names; display names and one-letter abbreviations are stored too.
Fixture (mlxtend):
  frequent[k]  for every min count k = 1..18 (min_support = k / 18): itemset key -> count.
               Keys are item ids in item order joined by ",". apriori and fpgrowth must agree.
  rules        association_rules(min_support 0.2, min confidence 0.5) with support, confidence,
               lift; sorted by lift desc, confidence desc, then "x->y" text.
  grid         rule counts for min_support {0.10, 0.15, 0.20, 0.30} x confidence {0.3, 0.5, 0.7}
               (key "<support>|<confidence>").
Book numbers checked (the generator exits 1 with the failing one, it never changes the data):
  item counts ekmek 11, sut 12, yumurta 10, tereyagi 7, peynir 5, recel 3;
  min_support 0.5 / 0.3 / 0.2 / 0.15 -> 4 / 7 / 12 / 16 sets, apriori == fpgrowth at every k;
  0.2 / 0.5 -> 13 rules, 9 with lift > 1.1; ekmek -> sut confidence 0.636364, lift 0.954545.
Numbers are rounded to 6 decimals once; the browser uses the rounded numbers.
"""

import json
import sys
from pathlib import Path

import mlxtend
import pandas as pd
from mlxtend.frequent_patterns import apriori, association_rules, fpgrowth
from mlxtend.preprocessing import TransactionEncoder

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = "src/concepts/birliktelik/data/sepet.json"
ITEMS = ["ekmek", "sut", "yumurta", "tereyagi", "peynir", "recel"]
NAMES = {"ekmek": "Ekmek", "sut": "Süt", "yumurta": "Yumurta",
         "tereyagi": "Tereyağı", "peynir": "Peynir", "recel": "Reçel"}
ABBR = {"ekmek": "E", "sut": "S", "yumurta": "Y", "tereyagi": "T", "peynir": "P", "recel": "R"}
TX = [
    ["ekmek", "sut", "yumurta"], ["ekmek", "tereyagi"], ["sut", "yumurta", "peynir"],
    ["ekmek", "sut", "tereyagi", "yumurta"], ["peynir", "yumurta"], ["ekmek", "sut"],
    ["ekmek", "tereyagi", "recel"], ["sut", "yumurta"], ["ekmek", "sut", "yumurta", "peynir"],
    ["tereyagi", "recel"], ["ekmek", "tereyagi", "sut"], ["yumurta", "peynir", "sut"],
    ["ekmek", "sut", "yumurta"], ["ekmek", "recel"], ["sut", "peynir"],
    ["ekmek", "sut", "yumurta", "tereyagi"], ["yumurta", "sut"], ["ekmek", "tereyagi"],
]
N = len(TX)
GRID_SUPPORT = [0.10, 0.15, 0.20, 0.30]
GRID_CONFIDENCE = [0.3, 0.5, 0.7]


def fail(msg):
    print("CRITERION FAILED: " + msg)
    sys.exit(1)


def key(items):
    return ",".join(sorted(items, key=ITEMS.index))


def r6(x):
    return round(float(x), 6)


def onehot():
    te = TransactionEncoder()
    return pd.DataFrame(te.fit(TX).transform(TX), columns=te.columns_)


def sets_of(df):
    return {key(s): int(round(sup * N)) for s, sup in zip(df["itemsets"], df["support"])}


def rules_of(df, min_support, min_conf):
    fi = apriori(df, min_support=min_support, use_colnames=True)
    if len(fi) == 0:
        return []
    ar = association_rules(fi, metric="confidence", min_threshold=min_conf)
    out = [{"x": key(a), "y": key(c), "support": r6(s), "confidence": r6(cf), "lift": r6(lf)}
           for a, c, s, cf, lf in zip(ar["antecedents"], ar["consequents"], ar["support"],
                                      ar["confidence"], ar["lift"])]
    out.sort(key=lambda r: (-r["lift"], -r["confidence"], r["x"] + "->" + r["y"]))
    return out


def generate():
    df = onehot()
    counts = {i: sum(i in t for t in TX) for i in ITEMS}
    if counts != {"ekmek": 11, "sut": 12, "yumurta": 10, "tereyagi": 7, "peynir": 5, "recel": 3}:
        fail(f"item counts {counts}")
    frequent = {}
    for k in range(1, N + 1):
        ms = k / N
        a = sets_of(apriori(df, min_support=ms, use_colnames=True))
        f = sets_of(fpgrowth(df, min_support=ms, use_colnames=True))
        if a != f:
            fail(f"apriori != fpgrowth at min count {k}")
        direct = {s for s, c in a.items() if c >= k}
        if len(direct) != len(a):
            fail(f"mlxtend returned a set below the threshold at {k}")
        frequent[str(k)] = a
    # min_support 0.5 / 0.3 / 0.2 / 0.15 -> min counts 9 / 6 / 4 / 3
    for ms, want in [(0.5, 4), (0.3, 7), (0.2, 12), (0.15, 16)]:
        got = len(sets_of(apriori(df, min_support=ms, use_colnames=True)))
        if got != want:
            fail(f"min_support {ms}: {got} sets, book says {want}")
    rules = rules_of(df, 0.2, 0.5)
    if len(rules) != 13:
        fail(f"{len(rules)} rules at 0.2 / 0.5, book says 13")
    hi = sum(r["lift"] > 1.1 for r in rules)
    if hi != 9:
        fail(f"{hi} rules with lift > 1.1, expected 9")
    ek = next((r for r in rules if r["x"] == "ekmek" and r["y"] == "sut"), None)
    if not ek or ek["confidence"] != 0.636364 or ek["lift"] != 0.954545:
        fail(f"ekmek -> sut is {ek}")
    grid = {f"{s:.2f}|{c:.1f}": len(rules_of(df, s, c)) for s in GRID_SUPPORT for c in GRID_CONFIDENCE}
    return {
        "meta": {"mlxtend": mlxtend.__version__, "pandas": pd.__version__},
        "items": ITEMS,
        "names": NAMES,
        "abbr": ABBR,
        "transactions": TX,
        "fixture": {"frequent": frequent, "rules": rules, "grid": grid},
    }


def render(content):
    return json.dumps(content, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n"


if __name__ == "__main__":
    text = render(generate())
    path = ROOT / DATA_PATH
    if "--check" in sys.argv:
        if not path.exists() or path.read_bytes() != text.encode("utf-8"):
            print("Out of date: " + DATA_PATH)
            sys.exit(1)
        print("birliktelik data up to date")
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(text.encode("utf-8"))
        print(f"Generated {DATA_PATH}")
