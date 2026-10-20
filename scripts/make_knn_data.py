"""Sample the book's Telco churn CSV and generate the k-NN page data + sklearn fixtures.

Usage:
    python scripts/make_knn_data.py <csv_path>

Writes (relative to the repo root):
    src/concepts/knn/data/telco_sample.json   48 customers + demo query positions
    tests/fixtures/knn_sklearn.json           sklearn KNeighborsClassifier reference cases

The output is deterministic: running the script twice produces byte-identical files.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import StandardScaler

EXPECTED_SHA256 = "b522990b1e66edd6b144657280df505b2dcc2aed0be867176793655cbf1f7720"
SEED = 42
N_NO, N_YES = 36, 12
TIE_EPS = 1e-9

REPO = Path(__file__).resolve().parent.parent
SAMPLE_OUT = REPO / "src" / "concepts" / "knn" / "data" / "telco_sample.json"
FIXTURE_OUT = REPO / "tests" / "fixtures" / "knn_sklearn.json"

DATASETS = ("aylik", "toplam")
Y_COLUMN = {"aylik": "monthly", "toplam": "total"}
METRICS = {"oklid": "euclidean", "manhattan": "manhattan"}
WEIGHTS = {"esit": "uniform", "agirlikli": "distance"}
FIXTURE_KS = (1, 3, 5, 9, 15)

# Demo search grid (integer tenure, integer y grid per dataset).
GRID_TENURE = np.arange(1, 73)
GRID_Y = {"aylik": np.arange(18, 121, 1), "toplam": np.arange(18, 8610, 25)}


def fail(msg: str) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


# --------------------------------------------------------------------------- data


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def load_sample(csv_path: Path) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    total = pd.to_numeric(df["TotalCharges"], errors="coerce")
    bad = int(total.isna().sum())
    if bad:
        print(f"Dropping {bad} rows with blank/non-numeric TotalCharges")
    df = df.assign(TotalCharges=total)[total.notna()]

    sizes = {"No": N_NO, "Yes": N_YES}
    parts = [g.sample(n=sizes[name], random_state=SEED) for name, g in df.groupby("Churn", sort=True)]
    sample = pd.concat(parts)  # No-then-Yes (groupby sorts keys)
    sample = sample.sample(frac=1, random_state=SEED).reset_index(drop=True)
    return pd.DataFrame(
        {
            "id": sample["customerID"].astype(str),
            "tenure": sample["tenure"].astype(int),
            "monthly": sample["MonthlyCharges"].astype(float),
            "total": sample["TotalCharges"].astype(float),
            "churn": (sample["Churn"] == "Yes").astype(int),
        }
    )


class Space:
    """One dataset view: raw (tenure, value) points, labels and optional scaler."""

    def __init__(self, cust: pd.DataFrame, dataset: str, scaled: bool):
        self.dataset = dataset
        self.scaled = scaled
        self.raw = np.column_stack([cust["tenure"].to_numpy(float), cust[Y_COLUMN[dataset]].to_numpy(float)])
        self.labels = cust["churn"].to_numpy(int)
        self.scaler = StandardScaler().fit(self.raw) if scaled else None
        self.points = self.to_space(self.raw)

    def to_space(self, q: np.ndarray) -> np.ndarray:
        q = np.asarray(q, dtype=float).reshape(-1, 2)
        return self.scaler.transform(q) if self.scaler is not None else q

    def model(self, k: int, metric: str, weighting: str) -> KNeighborsClassifier:
        return KNeighborsClassifier(
            n_neighbors=k, metric=METRICS[metric], weights=WEIGHTS[weighting], algorithm="brute"
        ).fit(self.points, self.labels)

    def exact_distances(self, q_raw: np.ndarray, metric: str) -> np.ndarray:
        """Directly computed distances, shape (n_queries, 48)."""
        diff = self.to_space(q_raw)[:, None, :] - self.points[None, :, :]
        if metric == "oklid":
            return np.sqrt((diff**2).sum(axis=2))
        return np.abs(diff).sum(axis=2)


def ordered_neighbors(dist_row: np.ndarray, k: int) -> tuple[list[int], bool]:
    """Indices sorted by (distance, index); flag True if the k-th/(k+1)-th boundary is a tie."""
    order = np.lexsort((np.arange(dist_row.size), dist_row))
    tie = abs(dist_row[order[k]] - dist_row[order[k - 1]]) <= TIE_EPS
    return [int(i) for i in order[:k]], bool(tie)


# --------------------------------------------------------------------------- demo search


class Evaluator:
    """Grid evaluation of one (dataset, scaled) space for all needed (k, metric) configs."""

    def __init__(self, cust: pd.DataFrame, dataset: str, scaled: bool, grid_raw: np.ndarray):
        self.space = Space(cust, dataset, scaled)
        self.grid_raw = grid_raw
        self._dist: dict[str, np.ndarray] = {}
        self._cache: dict[tuple[int, str], dict] = {}

    def dist(self, metric: str) -> np.ndarray:
        if metric not in self._dist:
            self._dist[metric] = self.space.exact_distances(self.grid_raw, metric)
        return self._dist[metric]

    def run(self, k: int, metric: str) -> dict:
        """sklearn neighbour sets/predictions (uniform votes) + exact-distance tie flags."""
        key = (k, metric)
        if key not in self._cache:
            model = self.space.model(k, metric, "esit")
            q = self.space.to_space(self.grid_raw)
            sk_idx = model.kneighbors(q, return_distance=False)
            pred = model.predict(q)
            proba = model.predict_proba(q)
            d = self.dist(metric)
            order = np.lexsort((np.broadcast_to(np.arange(d.shape[1]), d.shape), d), axis=1)
            sd = np.take_along_axis(d, order, axis=1)
            tie = np.abs(sd[:, k] - sd[:, k - 1]) <= TIE_EPS
            sets = [frozenset(int(i) for i in row) for row in sk_idx]
            exact_sets = [frozenset(int(i) for i in row) for row in order[:, :k]]
            agree = np.array([a == b for a, b in zip(sets, exact_sets)])
            self._cache[key] = {
                "sets": sets,
                "pred": pred.astype(int),
                "votes1": np.rint(proba[:, 1] * k).astype(int),
                "ok": ~tie & agree,  # unambiguous boundary and sklearn == exact
            }
        return self._cache[key]


def make_grid(dataset: str, cust: pd.DataFrame) -> np.ndarray:
    """Brief's integer grid, restricted to the sample's raw extent so demo points sit among the data."""
    y = cust[Y_COLUMN[dataset]]
    t = GRID_TENURE[(GRID_TENURE >= cust["tenure"].min()) & (GRID_TENURE <= cust["tenure"].max())]
    v = GRID_Y[dataset][(GRID_Y[dataset] >= y.min()) & (GRID_Y[dataset] <= y.max())]
    tt, vv = np.meshgrid(t, v, indexing="ij")
    return np.column_stack([tt.ravel(), vv.ravel()]).astype(float)


def centre_distance(cust: pd.DataFrame, dataset: str, grid_raw: np.ndarray) -> np.ndarray:
    """Distance to the plot centre (midpoint of raw x/y ranges), measured in the default scaled view."""
    y = cust[Y_COLUMN[dataset]]
    centre = np.array([[(cust["tenure"].min() + cust["tenure"].max()) / 2, (y.min() + y.max()) / 2]])
    sp = Space(cust, dataset, scaled=True)
    return np.sqrt(((sp.to_space(grid_raw) - sp.to_space(centre)) ** 2).sum(axis=1))


def pick(grid_raw: np.ndarray, mask: np.ndarray, keys: list[np.ndarray]) -> int | None:
    """Index of the best candidate: lexicographic min over keys, then tenure, then value."""
    idx = np.flatnonzero(mask)
    if idx.size == 0:
        return None
    cols = [grid_raw[idx, 1], grid_raw[idx, 0]] + [kk[idx] for kk in reversed(keys)]
    return int(idx[np.lexsort(cols)[0]])


def to_point(p: np.ndarray) -> dict:
    return {"tenure": int(p[0]), "value": int(p[1])}


def describe(ev: Evaluator, gi: int, k: int, metric: str, cust: pd.DataFrame) -> str:
    sp = ev.space
    d = sp.exact_distances(ev.grid_raw[gi : gi + 1], metric)[0]
    nb, _ = ordered_neighbors(d, k)
    r = ev.run(k, metric)
    parts = [f"#{i}({'A' if sp.labels[i] else 'K'},d={d[i]:.4f})" for i in nb]
    order = np.lexsort((np.arange(d.size), d))
    gap = d[order[k]] - d[order[k - 1]]
    return (
        f"    {sp.dataset} scaled={sp.scaled} {metric} k={k}: pred={int(r['pred'][gi])} "
        f"votes Ayrildi={int(r['votes1'][gi])}/{k}  boundary gap={gap:.4g}\n      neighbours: {' '.join(parts)}"
    )


def search_demo(cust: pd.DataFrame) -> dict:
    demo: dict = {"defaultQuery": {}}
    log: list[str] = []

    # defaultQuery: scaled, euclid, uniform, k=5 -> 3-2 vote, nearest to centre.
    for ds in DATASETS:
        grid = make_grid(ds, cust)
        ev = Evaluator(cust, ds, True, grid)
        r = ev.run(5, "oklid")
        mask = r["ok"] & np.isin(r["votes1"], [2, 3])
        gi = pick(grid, mask, [centre_distance(cust, ds, grid)])
        if gi is None:
            fail(f"defaultQuery.{ds}: no grid point with a 3-2 vote at k=5")
        demo["defaultQuery"][ds] = to_point(grid[gi])
        log.append(f"defaultQuery.{ds} = {demo['defaultQuery'][ds]}  ({int(mask.sum())} candidates)")
        log.append(describe(ev, gi, 5, "oklid", cust))

    # kSwallow: aylik, scaled, euclid: pred 1 for k in {1,3,5}, 0 for k=15.
    grid = make_grid("aylik", cust)
    ev = Evaluator(cust, "aylik", True, grid)
    mask = np.ones(len(grid), bool)
    for k in (1, 3, 5, 7, 9, 15):  # 7, 9: the page sweeps them too; require unambiguous sets
        mask &= ev.run(k, "oklid")["ok"]
    for k in (1, 3, 5):
        mask &= ev.run(k, "oklid")["pred"] == 1
    mask &= ev.run(15, "oklid")["pred"] == 0
    cdist = centre_distance(cust, "aylik", grid)
    # Prefer points that stay Ayrildi through the page's k sweep (k=7, 9), so k=15 is the flip.
    sweep_flips = sum((ev.run(k, "oklid")["pred"] == 0).astype(int) for k in (7, 9))
    gi = pick(grid, mask, [sweep_flips, cdist])
    if gi is None:
        fail("kSwallow: no grid point with prediction 1 for k=1,3,5 and 0 for k=15")
    demo["kSwallow"] = to_point(grid[gi])
    log.append(
        f"kSwallow = {demo['kSwallow']}  ({int(mask.sum())} candidates, "
        f"{int((mask & (sweep_flips == 0)).sum())} also Ayrildi at k=7,9)"
    )
    for k in (1, 3, 5, 7, 9, 15):
        log.append(describe(ev, gi, k, "oklid", cust))

    # metricSplit: aylik, scaled, k=5: euclid vs manhattan sets differ by >= 2 members.
    re_, rm = ev.run(5, "oklid"), ev.run(5, "manhattan")
    ndiff = np.array([len(a - b) for a, b in zip(re_["sets"], rm["sets"])])
    mask = re_["ok"] & rm["ok"] & (ndiff >= 2)
    gi = pick(grid, mask, [-ndiff, cdist])  # most differing members first, then nearest centre
    if gi is None:
        fail(f"metricSplit: no grid point where neighbour sets differ by >= 2 (max {int(ndiff.max())})")
    demo["metricSplit"] = to_point(grid[gi])
    log.append(
        f"metricSplit = {demo['metricSplit']}  ({int(mask.sum())} candidates, "
        f"{int(ndiff[gi])} members differ)"
    )
    log.append(describe(ev, gi, 5, "oklid", cust))
    log.append(describe(ev, gi, 5, "manhattan", cust))

    # scaleSplit: toplam, euclid, k=5: scaled vs unscaled sets share <= 2 members; prefer differing preds.
    grid = make_grid("toplam", cust)
    evs, evu = Evaluator(cust, "toplam", True, grid), Evaluator(cust, "toplam", False, grid)
    rs, ru = evs.run(5, "oklid"), evu.run(5, "oklid")
    shared = np.array([len(a & b) for a, b in zip(rs["sets"], ru["sets"])])
    same_pred = (rs["pred"] == ru["pred"]).astype(int)
    mask = rs["ok"] & ru["ok"] & (shared <= 2)
    gi = pick(grid, mask, [same_pred, shared, centre_distance(cust, "toplam", grid)])
    if gi is None:
        fail(f"scaleSplit: no grid point with <= 2 shared neighbours (min {int(shared.min())})")
    demo["scaleSplit"] = to_point(grid[gi])
    n_diff_pred = int((mask & (same_pred == 0)).sum())
    log.append(
        f"scaleSplit = {demo['scaleSplit']}  ({int(mask.sum())} candidates, {n_diff_pred} with differing "
        f"predictions; chosen shares {int(shared[gi])}, predictions differ: {not same_pred[gi]})"
    )
    log.append(describe(evs, gi, 5, "oklid", cust))
    log.append(describe(evu, gi, 5, "oklid", cust))

    print("Demo positions:")
    print("\n".join("  " + line for line in log))
    return demo


def region_share(cust: pd.DataFrame) -> None:
    """Evidence for the scenario test 'Ayrildi region shrinks' (80x50 grid, padded 8% domain)."""
    sp = Space(cust, "aylik", True)
    lo, hi = sp.points.min(axis=0), sp.points.max(axis=0)
    pad = (hi - lo) * 0.08
    lo, hi = lo - pad, hi + pad
    cols, rows = 80, 50
    xs = lo[0] + (np.arange(cols) + 0.5) * (hi[0] - lo[0]) / cols
    ys = hi[1] - (np.arange(rows) + 0.5) * (hi[1] - lo[1]) / rows
    cells = np.array([[x, y] for y in ys for x in xs])
    counts = {}
    for k in (1, 15):
        m = KNeighborsClassifier(n_neighbors=k, algorithm="brute").fit(sp.points, sp.labels)
        counts[k] = int(m.predict(cells).sum())
    ratio = counts[15] / counts[1] if counts[1] else float("nan")
    print(f"Region check (aylik, scaled, oklid, esit, 80x50): Ayrildi cells k=1 {counts[1]}, k=15 {counts[15]} "
          f"-> ratio {ratio:.3f} (scenario test needs < 0.5)")


# --------------------------------------------------------------------------- fixtures


def make_fixtures(cust: pd.DataFrame) -> tuple[list[dict], int]:
    rng = np.random.default_rng(SEED)
    queries: dict[str, list[np.ndarray]] = {}
    for ds in DATASETS:
        y = cust[Y_COLUMN[ds]].to_numpy(float)
        t = cust["tenure"].to_numpy(float)
        tq = np.round(rng.uniform(t.min(), t.max(), 20), 2)
        yq = np.round(rng.uniform(y.min(), y.max(), 20), 2)
        qs = [np.array([a, b]) for a, b in zip(tq, yq)]
        qs.append(np.array([t[0], y[0]]))  # exactly on customers[0]
        queries[ds] = qs

    cases: list[dict] = []
    skipped = 0
    for ds in DATASETS:
        for scaled in (True, False):
            sp = Space(cust, ds, scaled)
            for metric in METRICS:
                for weighting in WEIGHTS:
                    for k in FIXTURE_KS:
                        model = sp.model(k, metric, weighting)
                        for q in queries[ds]:
                            d = sp.exact_distances(q, metric)[0]
                            nb, tie = ordered_neighbors(d, k)
                            if tie:
                                skipped += 1
                                continue
                            qs = sp.to_space(q)
                            sk = model.kneighbors(qs, return_distance=False)[0]
                            if set(int(i) for i in sk) != set(nb):
                                fail(f"sklearn/exact neighbour mismatch: {ds} {scaled} {metric} k={k} q={q}")
                            proba = model.predict_proba(qs)[0]
                            cases.append(
                                {
                                    "dataset": ds,
                                    "scaled": scaled,
                                    "metric": metric,
                                    "weighting": weighting,
                                    "k": k,
                                    "query": {"tenure": float(q[0]), "value": float(q[1])},
                                    "neighbors": nb,
                                    "prediction": int(model.predict(qs)[0]),
                                    "proba": [float(proba[0]), float(proba[1])],
                                }
                            )
    return cases, skipped


# --------------------------------------------------------------------------- output


def dumps(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(", ", ": "))


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def write_sample(cust: pd.DataFrame, sha: str, demo: dict) -> None:
    rows = [
        {"id": r.id, "tenure": int(r.tenure), "monthly": float(r.monthly), "total": float(r.total), "churn": int(r.churn)}
        for r in cust.itertuples(index=False)
    ]
    demo_lines = [
        f'  "defaultQuery": {dumps(demo["defaultQuery"])}',
        f'  "kSwallow": {dumps(demo["kSwallow"])}',
        f'  "metricSplit": {dumps(demo["metricSplit"])}',
        f'  "scaleSplit": {dumps(demo["scaleSplit"])}',
    ]
    text = (
        "{\n"
        f' "source": "telco_churn_synthetic.csv",\n'
        f' "sha256": "{sha}",\n'
        f' "seed": {SEED},\n'
        ' "customers": [\n'
        + ",\n".join("  " + dumps(r) for r in rows)
        + "\n ],\n"
        ' "demo": {\n'
        + ",\n".join(demo_lines)
        + "\n }\n}\n"
    )
    json.loads(text)  # sanity: valid JSON
    write_text(SAMPLE_OUT, text)


def write_fixtures(cases: list[dict]) -> None:
    text = '{\n "cases": [\n' + ",\n".join("  " + dumps(c) for c in cases) + "\n ]\n}\n"
    json.loads(text)
    write_text(FIXTURE_OUT, text)


def main() -> None:
    if len(sys.argv) != 2:
        fail("usage: python scripts/make_knn_data.py <csv_path>")
    csv_path = Path(sys.argv[1])
    if not csv_path.is_file():
        fail(f"CSV not found: {csv_path}")
    sha = sha256_of(csv_path)
    if sha != EXPECTED_SHA256:
        fail(f"sha256 mismatch: got {sha}, expected {EXPECTED_SHA256}")

    cust = load_sample(csv_path)
    if len(cust) != N_NO + N_YES:
        fail(f"expected {N_NO + N_YES} customers, got {len(cust)}")
    print(f"Sampled {len(cust)} customers ({int(cust['churn'].sum())} Ayrildi, {int((cust['churn'] == 0).sum())} Kaldi)")
    print(
        f"Extent: tenure {cust['tenure'].min()}..{cust['tenure'].max()}, "
        f"monthly {cust['monthly'].min()}..{cust['monthly'].max()}, total {cust['total'].min()}..{cust['total'].max()}"
    )

    demo = search_demo(cust)
    region_share(cust)
    cases, skipped = make_fixtures(cust)

    write_sample(cust, sha, demo)
    write_fixtures(cases)
    print(f"Wrote {SAMPLE_OUT.relative_to(REPO).as_posix()} ({len(cust)} customers, demo keys: {', '.join(demo)})")
    print(f"Wrote {FIXTURE_OUT.relative_to(REPO).as_posix()} ({len(cases)} cases, {skipped} skipped for boundary ties)")


if __name__ == "__main__":
    main()
