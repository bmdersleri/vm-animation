"""Generate the Chapter 4 (PCA / t-SNE and feature selection) pages' data and scikit-learn fixtures.

Usage:
    python scripts/make_boyut_data.py

Writes (relative to the repo root):
    src/concepts/pca/data/pca_data.json              customer pair, scree, PCA / t-SNE panels
    src/concepts/ozellik-secimi/data/secim_data.json churn table and the RFE elimination paths
    tests/fixtures/boyut_sklearn.json                PCA / t-SNE / VarianceThreshold / SelectKBest / RFE
                                                     reference values (full precision)

Reproduces the book's code examples 002, 003, 004 and 005 (same RNG call order) and asserts
every control value of the spec; any mismatch exits non-zero. Output is deterministic:
running it twice produces byte-identical files (t-SNE coordinates are rounded to 4 decimals).
"""

from __future__ import annotations

import json
import math
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn
from sklearn.decomposition import PCA
from sklearn.feature_selection import RFE, SelectKBest, VarianceThreshold, f_classif
from sklearn.linear_model import LogisticRegression
from sklearn.manifold import TSNE
from sklearn.preprocessing import StandardScaler

REPO = Path(__file__).resolve().parent.parent
PCA_OUT = REPO / "src" / "concepts" / "pca" / "data" / "pca_data.json"
SECIM_OUT = REPO / "src" / "concepts" / "ozellik-secimi" / "data" / "secim_data.json"
FIXTURE_OUT = REPO / "tests" / "fixtures" / "boyut_sklearn.json"

PAIR_COLS = (1, 8)
PERPLEXITIES = (5, 30, 50)
THRESHOLDS = (0, 0.01, 1, 10)
COLS = ["aylikUcret", "toplamUcret", "hizmetSayisi", "musteriKidemAy",
        "sabitDeger", "gurultuluOznitelik", "destekTaleplerinSayisi", "odemeGecikmesi"]


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


def check(name: str, ok: bool, detail="") -> None:
    if not ok:
        fail(f"{name}: {detail}")


def fls(xs) -> list[float]:
    return [float(v) for v in np.asarray(xs, dtype=float).ravel()]


def fls2(m) -> list[list[float]]:
    return [[float(v) for v in row] for row in np.asarray(m, dtype=float)]


def r4(m) -> list[list[float]]:
    return [[round(float(v), 4) for v in row] for row in np.asarray(m, dtype=float)]


def nones(xs) -> list:
    return [None if (isinstance(v, float) and math.isnan(v)) else v for v in xs]


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def dump(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=1, allow_nan=False) + "\n"


def names(mask) -> list[str]:
    return [COLS[i] for i, m in enumerate(mask) if m]


# --------------------------------------------------------------------------- pca


def ex002() -> dict:
    rng = np.random.default_rng(42)
    data = rng.normal(size=(5000, 60))
    out = PCA(n_components=0.90, random_state=42).fit_transform(data)
    check("002 after", out.shape[1] == 53, out.shape)
    return {"before": 60, "after": int(out.shape[1])}


def pair_pca(pair: np.ndarray) -> dict:
    m = PCA(random_state=42).fit(pair)
    return {"lambda": fls(m.explained_variance_), "components": fls2(m.components_),
            "evr": fls(m.explained_variance_ratio_)}


def ex003() -> tuple[dict, dict]:
    rng = np.random.default_rng(7)
    temelSinyal = rng.normal(size=(500, 3))
    karisimMatrisi = rng.normal(size=(3, 12))
    ozniteliklerHam = temelSinyal @ karisimMatrisi + rng.normal(scale=0.5, size=(500, 12))
    ozniteliklerOlcekli = StandardScaler().fit_transform(ozniteliklerHam)
    pcaModeli = PCA(random_state=42)
    pcaModeli.fit_transform(ozniteliklerOlcekli)
    evr = pcaModeli.explained_variance_ratio_
    cum = np.cumsum(evr)
    expect("003 evr", evr[:5], [0.441, 0.31, 0.188, 0.02, 0.012], 3)
    expect("003 cum[2]", cum[2], 0.938, 3)
    check("003 shape", pcaModeli.components_.shape == (12, 12), pcaModeli.components_.shape)

    kby = {t: int(PCA(n_components=t / 100, random_state=42).fit(ozniteliklerOlcekli).n_components_)
           for t in range(50, 100)}
    check("003 k(50/90/99)", (kby[50], kby[90], kby[99]) == (2, 3, 9), (kby[50], kby[90], kby[99]))

    # the pair (2nd and 9th feature)
    pair = ozniteliklerOlcekli[:, list(PAIR_COLS)]
    cov = np.cov(pair, rowvar=False)
    r = float(np.corrcoef(pair, rowvar=False)[0, 1])
    base = pair_pca(pair)
    big = pair.copy()
    big[:, 1] *= 1000.0
    x1000 = pair_pca(big)
    var0 = float(cov[0, 0])
    expect("pair r", r, 0.82)
    expect("pair var0", var0, 1.00)
    expect("pair lambda", base["lambda"], [1.83, 0.18])
    expect("pair |components[0]|", np.abs(base["components"][0]), [0.707, 0.707], 3)
    expect("pair evr", base["evr"], [0.912, 0.088], 3)
    angles = np.deg2rad(np.arange(180))
    proj = (np.cos(angles) ** 2 * cov[0, 0] + 2 * np.cos(angles) * np.sin(angles) * cov[0, 1]
            + np.sin(angles) ** 2 * cov[1, 1])
    check("pair best angle", int(np.argmax(proj)) == 45, int(np.argmax(proj)))
    expect("x1000 |components[0]|", np.abs(x1000["components"][0]), [0.0008, 1.0], 4)
    check("x1000 evr", 0.9999 < x1000["evr"][0] < 1, x1000["evr"][0])

    fixture = {
        "pair": {"r": r, "cov": fls2(cov), "var0": var0, "lambda": base["lambda"],
                 "components": base["components"], "evr": base["evr"], "x1000": x1000},
        "evr12": fls(evr), "cum12": fls(cum),
        "kByThreshold": {str(t): k for t, k in kby.items()},
        "componentsShape": [int(s) for s in pcaModeli.components_.shape],
    }
    page = {"pair": {"cols": list(PAIR_COLS), "points": fls2(pair)},
            "scree": {"evr": fls(evr), "cum": fls(cum), "kByThreshold": [kby[t] for t in range(50, 100)]}}
    return page, fixture


def ex005() -> tuple[dict, dict]:
    rng = np.random.default_rng(11)
    kume1 = rng.normal(loc=0, scale=1, size=(150, 10))
    kume2 = rng.normal(loc=4, scale=1, size=(150, 10))
    tumVeri = np.vstack([kume1, kume2])
    etiketler = [0] * 150 + [1] * 150
    olcekleyici = StandardScaler()
    veriOlcekli = olcekleyici.fit_transform(tumVeri)
    yeni = olcekleyici.transform(np.full((1, 10), 4.0))
    veriYeni = np.vstack([veriOlcekli, yeni])

    pcaModel = PCA(n_components=2, random_state=42)
    pcaIzdusum = pcaModel.fit_transform(veriOlcekli)
    newPca = pcaModel.transform(yeni)[0]
    evr = pcaModel.explained_variance_ratio_
    expect("005 evr", evr, [0.821, 0.025], 3)
    c0, c1 = pcaIzdusum[:150].mean(axis=0), pcaIzdusum[150:].mean(axis=0)
    check("new customer nearer to class 1",
          np.linalg.norm(newPca - c1) < np.linalg.norm(newPca - c0))

    embed, embedNew = {}, {}
    for p in PERPLEXITIES:
        embed[p] = TSNE(n_components=2, perplexity=p, random_state=42,
                        init="pca").fit_transform(veriOlcekli)
        embedNew[p] = TSNE(n_components=2, perplexity=p, random_state=42,
                           init="pca").fit_transform(veriYeni)
    expect("005 p30 first point", embed[30][0], [28.3, 1.2], 1)
    a, b = embed[30], embedNew[30][:300]
    disp = float(np.mean(np.linalg.norm(a - b, axis=1)))
    width = float(max(np.ptp(a[:, 0]), np.ptp(a[:, 1])))
    check("005 displacement", disp > 0.25 * width, (disp, width))

    page = {"labels": etiketler, "pca": fls2(pcaIzdusum), "pcaEvr": fls(evr), "newPca": fls(newPca),
            "embed": {str(p): r4(embed[p]) for p in PERPLEXITIES},
            "embedNew": {str(p): r4(embedNew[p]) for p in PERPLEXITIES}}
    fixture = {"evr": fls(evr), "newPca": fls(newPca), "firstP30": fls(embed[30][0]),
               "firstP30New": fls(embedNew[30][0]), "meanDisplacement": disp, "width": width}
    print(f"t-SNE p30 first point {embed[30][0].round(2).tolist()}, "
          f"new-customer first point {embedNew[30][0].round(2).tolist()}, "
          f"mean displacement {disp:.2f} = {100 * disp / width:.0f}% of width {width:.2f}")
    return page, fixture


# --------------------------------------------------------------------------- selection


def ex004() -> tuple[dict, dict]:
    rng = np.random.default_rng(3)
    n = 400
    df = pd.DataFrame({
        "aylikUcret": rng.normal(70, 20, n),
        "toplamUcret": rng.normal(2000, 800, n),
        "hizmetSayisi": rng.integers(1, 9, n),
        "musteriKidemAy": rng.integers(1, 60, n),
        "sabitDeger": np.ones(n),
        "gurultuluOznitelik": rng.normal(0, 1, n),
        "destekTaleplerinSayisi": rng.integers(0, 10, n),
        "odemeGecikmesi": rng.integers(0, 5, n),
    })
    check("columns", list(df.columns) == COLS)
    y = ((df["musteriKidemAy"] < 12).astype(int) | (df["destekTaleplerinSayisi"] > 6).astype(int))
    churn = [int(v) for v in y]
    check("churn count", sum(churn) == 169, sum(churn))

    var = VarianceThreshold(threshold=0.01).fit(df)
    expect("variances", var.variances_, [406.37, 629688.34, 5.22, 302.89, 0, 0.84, 8.92, 1.95])
    vt = {}
    for t in THRESHOLDS:
        vt[t] = names(VarianceThreshold(threshold=t).fit(df).get_support())
    check("vt 0.01", len(vt[0.01]) == 7 and "sabitDeger" not in vt[0.01], vt[0.01])
    check("vt 1", vt[1] == [c for c in vt[0.01] if c != "gurultuluOznitelik"], vt[1])
    check("vt 10", vt[10] == ["aylikUcret", "toplamUcret", "musteriKidemAy"], vt[10])

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        f = np.asarray(SelectKBest(score_func=f_classif, k=4).fit(df, y).scores_, dtype=float)
    check("F nan", bool(np.isnan(f[4])) and not np.isnan(np.delete(f, 4)).any())
    expect("F", np.nan_to_num(f, nan=0.0), [0.57, 0.73, 2.86, 94.66, 0, 0.04, 158.44, 1.62])
    kbest = {}
    for k in range(1, 8):
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            kbest[k] = names(SelectKBest(score_func=f_classif, k=k).fit(df, y).get_support())
    check("kbest4", kbest[4] == ["hizmetSayisi", "musteriKidemAy", "destekTaleplerinSayisi",
                                 "odemeGecikmesi"], kbest[4])

    X_raw = df.to_numpy(dtype=float)
    X_std = StandardScaler().fit_transform(df)
    rfe_page, rfe_fix = {}, {}
    for key, X in (("yok", X_raw), ("standard", X_std)):
        remaining = list(range(8))
        rounds = []
        eliminated_order = []
        while len(remaining) > 1:
            lr = LogisticRegression(max_iter=1000).fit(X[:, remaining], y)
            coef = np.abs(lr.coef_[0])
            elim = remaining[int(np.argmin(coef))]
            rounds.append({"remaining": list(remaining), "coef": fls(coef), "eliminated": elim})
            eliminated_order.append(elim)
            remaining = [c for c in remaining if c != elim]
        order = eliminated_order + remaining
        # the refit on the last survivor (RFE(n_features_to_select=1).estimator_); for k >= 2 the
        # refit on the k survivors is rounds[8 - k]
        last = LogisticRegression(max_iter=1000).fit(X[:, remaining], y)
        final = {"remaining": list(remaining), "coef": fls(np.abs(last.coef_[0]))}
        support, ranking4, estimator = {}, None, {}
        for k in range(1, 8):
            sel = RFE(estimator=LogisticRegression(max_iter=1000), n_features_to_select=k).fit(X, y)
            mine = sorted(order[8 - k:])
            check(f"rfe {key} k={k} support", [i for i, s in enumerate(sel.get_support()) if s] == mine,
                  (sel.get_support().tolist(), mine))
            support[k] = names(sel.get_support())
            if k == 4:
                ranking4 = [int(v) for v in sel.ranking_]
            # the coefficients the page shows once RFE has finished are sklearn's refit on the survivors
            refit = rounds[8 - k] if k >= 2 else final
            got = np.abs(sel.estimator_.coef_[0])
            check(f"rfe {key} k={k} estimator_", refit["remaining"] == mine and
                  np.allclose(got, refit["coef"], rtol=1e-9, atol=1e-12), (got.tolist(), refit))
            estimator[k] = fls(got)
        rfe_page[key] = {"order": order, "rounds": rounds, "final": final}
        rfe_fix[key] = {"support": {str(k): v for k, v in support.items()}, "ranking4": ranking4,
                        "estimatorCoef": {str(k): v for k, v in estimator.items()}}

    check("order yok", rfe_page["yok"]["order"] == [1, 4, 0, 2, 7, 3, 5, 6], rfe_page["yok"]["order"])
    check("order standard", rfe_page["standard"]["order"] == [4, 1, 0, 7, 2, 5, 3, 6],
          rfe_page["standard"]["order"])
    check("rfe yok 4", rfe_fix["yok"]["support"]["4"] ==
          ["musteriKidemAy", "gurultuluOznitelik", "destekTaleplerinSayisi", "odemeGecikmesi"])
    check("rfe yok ranking", rfe_fix["yok"]["ranking4"] == [3, 5, 2, 1, 4, 1, 1, 1],
          rfe_fix["yok"]["ranking4"])
    check("rfe std 4", rfe_fix["standard"]["support"]["4"] ==
          ["hizmetSayisi", "musteriKidemAy", "gurultuluOznitelik", "destekTaleplerinSayisi"])
    expect("round1 |beta|", rfe_page["yok"]["rounds"][0]["coef"],
           [0.0022, 0.0000, 0.0219, 0.0939, 0.0033, 0.1511, 0.6286, 0.0266], 4)
    inter = sorted(set(kbest[4]) & set(rfe_fix["yok"]["support"]["4"]), key=COLS.index)
    check("intersection", inter == ["musteriKidemAy", "destekTaleplerinSayisi", "odemeGecikmesi"], inter)

    page = {"columns": COLS, "values": [df[c].tolist() for c in COLS], "churn": churn,
            "variance": fls(var.variances_), "rfe": rfe_page}
    fixture = {"churnCount": sum(churn), "churnRate": sum(churn) / n, "variance": fls(var.variances_),
               "std0": fls(df.std(ddof=0)),
               "vtSupport": {str(t): v for t, v in vt.items()},
               "f": nones([float(v) for v in f]),
               "kbest": {str(k): v for k, v in kbest.items()},
               "rfe": rfe_fix}
    return page, fixture


def main() -> None:
    after = ex002()
    pca_page, pca_fix = ex003()
    tsne_page, t005 = ex005()
    pca_fix["ex002"] = after
    pca_fix["t005"] = t005
    pca_page["tsne"] = tsne_page
    secim_page, secim_fix = ex004()

    write_text(PCA_OUT, dump(pca_page))
    write_text(SECIM_OUT, dump(secim_page))
    write_text(FIXTURE_OUT, dump({"versions": {"sklearn": sklearn.__version__, "numpy": np.__version__},
                                  "pca": pca_fix, "secim": secim_fix}))
    print("OK: all control values hold")


if __name__ == "__main__":
    main()
