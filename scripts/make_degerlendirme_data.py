"""Generate Chapter 6 examples and independent sklearn curve references.

Run: python scripts/make_degerlendirme_data.py
Scores are deliberately authored synthetic rankings, not fitted probabilities.
CV predictions come from separately fitted StandardScaler/LogisticRegression
pipelines. Test identities never enter a fold or the C-selection protocol.
"""

import json
import platform
from pathlib import Path

import numpy as np
import sklearn
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, average_precision_score, confusion_matrix, f1_score,
    precision_recall_curve, precision_score, recall_score, roc_auc_score, roc_curve,
)
from sklearn.model_selection import KFold, StratifiedKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


ROOT = Path(__file__).resolve().parents[1]
SEED = 42


def scored(prefix, rows):
    return [{"id": f"{prefix}-{i + 1:02d}", "actual": actual, "score": score}
            for i, (actual, score) in enumerate(rows)]


def confusion(actual, predicted):
    tn, fp, fn, tp = confusion_matrix(actual, predicted, labels=[0, 1]).ravel()
    return {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)}


def result(ids, actual, predicted):
    return {
        "predictions": [{"id": id_, "actual": int(a), "predicted": int(p)}
                        for id_, a, p in zip(ids, actual, predicted)],
        "confusion": confusion(actual, predicted),
        "f1": float(f1_score(actual, predicted, zero_division=0)),
    }


def curve_reference(samples):
    actual = [s["actual"] for s in samples]
    scores = [s["score"] for s in samples]
    fpr, tpr, thresholds = roc_curve(actual, scores, drop_intermediate=False)
    precision, recall, pr_thresholds = precision_recall_curve(actual, scores)
    return {
        "rocAuc": float(roc_auc_score(actual, scores)),
        "averagePrecision": float(average_precision_score(actual, scores)),
        # JSON has an explicit all-negative endpoint instead of Infinity.
        "roc": [{"threshold": "none" if i == 0 else float(t),
                 "kind": "none-positive" if i == 0 else "threshold",
                 "fpr": float(f), "tpr": float(r)}
                for i, (t, f, r) in enumerate(zip(thresholds, fpr, tpr))],
        # sklearn's final precision=1, recall=0 is a plotting convention only.
        "pr": [{"threshold": float(t), "precision": float(p), "recall": float(r)}
               for t, p, r in zip(pr_thresholds, precision, recall)],
        "prEndpoint": {"kind": "none-positive", "precision": 1, "recall": 0},
    }


def pipeline(c):
    return make_pipeline(StandardScaler(), LogisticRegression(
        C=c, solver="lbfgs", max_iter=1000, random_state=SEED))


def generate():
    score_sets = {
        "balanced": {
            "validation": scored("balanced-validation", [(1, .8), (0, .8), (1, .2), (0, .1)]),
            "test": scored("balanced-test", [(1, .9), (0, .7), (1, .7), (0, .3), (1, .2), (0, .1)]),
        },
        "imbalanced": {
            "validation": scored("imbalanced-validation", [
                (0, .95), (1, .85), (0, .85), (0, .7), (0, .6), (1, .55),
                (0, .4), (0, .3), (0, .2), (0, .15), (0, .1), (0, .05)]),
            "test": scored("imbalanced-test", [
                (0, .9), (1, .8), (0, .8), (0, .6), (0, .5),
                (0, .4), (1, .3), (0, .2), (0, .1), (0, 0)]),
        },
    }
    rng = np.random.default_rng(SEED)
    # Ordered classes intentionally expose ordinary KFold's class clumping.
    y = np.array([0] * 24 + [1] * 16)
    test_y = np.array([0] * 10 + [1] * 5)
    x = rng.normal(size=(40, 2)) + y[:, None] * np.array([1.25, .6])
    test_x = rng.normal(size=(15, 2)) + test_y[:, None] * np.array([1.25, .6])
    ids = [f"development-{i + 1:02d}" for i in range(len(y))]
    test_ids = [f"test-{i + 1:02d}" for i in range(len(test_y))]
    samples = [{"id": id_, "x": features.tolist(), "actual": int(actual), "partition": partition}
               for partition, part_ids, features_, labels in [
                   ("development", ids, x, y), ("test", test_ids, test_x, test_y)]
               for id_, features, actual in zip(part_ids, features_, labels)]
    runs = []
    for k in [3, 5]:
        for method in ["kfold", "stratified"]:
            for c in [.1, 1]:
                splitter = KFold(k, shuffle=False) if method == "kfold" else StratifiedKFold(k, shuffle=False)
                folds = []
                for train, validation in splitter.split(x, y):
                    model = pipeline(c)
                    model.fit(x[train], y[train])
                    scaler = model.named_steps["standardscaler"]
                    folds.append({
                        "trainIds": [ids[i] for i in train],
                        "validationIds": [ids[i] for i in validation],
                        "mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist(),
                        **result([ids[i] for i in validation], y[validation], model.predict(x[validation])),
                    })
                scores = [f["f1"] for f in folds]
                runs.append({"k": k, "method": method, "c": c, "folds": folds,
                             "meanF1": float(np.mean(scores)), "stdF1": float(np.std(scores))})
    candidates = [r for r in runs if r["k"] == 5 and r["method"] == "stratified"]
    selected = min(candidates, key=lambda r: (-r["meanF1"], r["c"]))
    final_model = pipeline(selected["c"])
    final_model.fit(x, y)
    final_scaler = final_model.named_steps["standardscaler"]
    selection = {"k": 5, "method": "stratified", "c": selected["c"], "meanF1": selected["meanF1"],
                 "fitMean": final_scaler.mean_.tolist(), "fitScale": final_scaler.scale_.tolist(),
                 "finalTest": result(test_ids, test_y, final_model.predict(test_x))}
    versions = {"python": platform.python_version(), "numpy": np.__version__, "sklearn": sklearn.__version__}
    metadata = {
        "seed": SEED, "versions": versions,
        "scoreDescription": "Açıklanmış sentetik sıralama örnekleri; bağlı skorlar birlikte hareket eder. CV'den bağımsızdır.",
        "zeroDivisionPolicy": "sklearn F1 referansı zero_division=0 kullanır. Arayüz sıfır paydalı oranları null (tanımsız) gösterir; F1=2TP/(2TP+FP+FN). PR boş pozitif uç precision=1 yalnız çizim konvansiyonudur. Pozitifsiz AP tanımsızdır.",
        "cvParameters": {"solver": "lbfgs", "maxIter": 1000, "shuffle": False},
    }
    matrix = {"tn": 80, "fp": 10, "fn": 4, "tp": 6}
    matrix_actual = [0] * 90 + [1] * 10
    matrix_predicted = [0] * 80 + [1] * 10 + [0] * 4 + [1] * 6
    assert confusion(matrix_actual, matrix_predicted) == matrix
    matrix_reference = {
        "accuracy": accuracy_score(matrix_actual, matrix_predicted),
        "precision": precision_score(matrix_actual, matrix_predicted),
        "recall": recall_score(matrix_actual, matrix_predicted),
        "f1": f1_score(matrix_actual, matrix_predicted),
        "specificity": recall_score(matrix_actual, matrix_predicted, pos_label=0),
    }
    data = {"metadata": metadata, "matrix": matrix, "scoreSets": score_sets,
            "cv": {"samples": samples, "runs": runs, "selection": selection}}
    reference = {"seed": SEED, "versions": versions, "matrix": matrix_reference,
                 "scoreSets": {name: {part: curve_reference(values) for part, values in partitions.items()}
                               for name, partitions in score_sets.items()}}
    return data, reference


if __name__ == "__main__":
    data, reference = generate()
    for relative, content in [("src/concepts/degerlendirme/data/degerlendirme.json", data),
                              ("tests/fixtures/degerlendirme_sklearn.json", reference)]:
        path = ROOT / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(content, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8", newline="\n")
        print(f"Generated {relative}")
