"""Generate the Naive Bayes page's data and scikit-learn fixtures.

Usage:
    python scripts/make_nb_data.py

Writes (relative to the repo root):
    src/concepts/naive-bayes/data/nb_data.json   spam corpus counts + book GaussianNB training set
    tests/fixtures/naive-bayes_sklearn.json      MultinomialNB / alpha=0 / GaussianNB reference values

Class index convention: spam part 0 = normal, 1 = spam; Gaussian part 0 = Kaldi, 1 = Ayrildi
(the book's churn label). The Gaussian sample reproduces the book code
(final.md lines 708-744) exactly and asserts the book's printed numbers.
Output is deterministic: running it twice produces byte-identical files.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import GaussianNB, MultinomialNB

REPO = Path(__file__).resolve().parent.parent
DATA_OUT = REPO / "src" / "concepts" / "naive-bayes" / "data" / "nb_data.json"
FIXTURE_OUT = REPO / "tests" / "fixtures" / "naive-bayes_sklearn.json"

DOCS = [150, 100]  # normal, spam e-mails
PRIOR = [0.6, 0.4]
# word, normal count, spam count (class totals 300 and 200)
WORDS = [
    ("bedava", 6, 60),
    ("kazandınız", 3, 40),
    ("toplantı", 45, 4),
    ("rapor", 6, 0),
    ("indirim", 6, 50),
    ("tıkla", 3, 30),
    ("merhaba", 90, 10),
    ("fatura", 141, 6),
]
STORY = ["bedava", "kazandınız", "toplantı"]
STEP10 = ["bedava", "kazandınız", "toplantı", "rapor"]  # "rapor" never seen in spam
N_RANDOM_SUBSETS = 6
GRID = [(t, c) for t in (5, 15, 25, 40, 55) for c in (1, 4)]


def fail(msg: str) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


# --------------------------------------------------------------------------- spam


def check_corpus() -> None:
    if [sum(w[1] for w in WORDS), sum(w[2] for w in WORDS)] != [300, 200]:
        fail("class word totals are not 300 / 200")


def sklearn_multinomial(words: list[str]) -> list[float]:
    names = [w[0] for w in WORDS]
    X = np.array([[w[1] for w in WORDS], [w[2] for w in WORDS]], dtype=float)
    clf = MultinomialNB(alpha=1.0, class_prior=PRIOR).fit(X, [0, 1])
    x = np.array([[1.0 if n in words else 0.0 for n in names]])
    return [float(p) for p in clf.predict_proba(x)[0]]


def formula_proba(words: list[str], alpha: float) -> list[float]:
    """Posterior from the P(word | class) = (count + alpha) / (total + alpha V) formula."""
    totals = [sum(w[1] for w in WORDS), sum(w[2] for w in WORDS)]
    v = len(WORDS)
    like = list(PRIOR)
    table = {w[0]: (w[1], w[2]) for w in WORDS}
    for word in words:
        for k in (0, 1):
            like[k] *= (table[word][k] + alpha) / (totals[k] + alpha * v)
    s = like[0] + like[1]
    if s == 0:
        fail(f"both classes zero for {words} at alpha={alpha}")
    return [like[0] / s, like[1] / s]


def story_check() -> None:
    """The binding e-mail story, at alpha = 0 then alpha = 1 (spec section 'Bölüm 2')."""
    p1, p2, p3 = (formula_proba(STORY[: i + 1], 0)[1] for i in range(3))
    if not (p1 > 0.85 and p2 > 0.95 and p2 > p1 and p3 < p2 and p3 > 0.5):
        fail(f"story mismatch: {p1}, {p2}, {p3}")
    if formula_proba(STEP10, 0)[1] != 0.0:
        fail("step 10 e-mail does not zero the spam probability at alpha = 0")
    if formula_proba(STEP10, 1)[1] <= 0.5:
        fail("step 10 e-mail does not recover with alpha = 1")


def spam_cases() -> list[list[str]]:
    cases = [STORY[: i + 1] for i in range(len(STORY))] + [STEP10]
    rng = np.random.default_rng(15)
    names = [w[0] for w in WORDS]
    seen = {tuple(c) for c in cases}
    while len(cases) < len(STORY) + 1 + N_RANDOM_SUBSETS:
        k = int(rng.integers(1, 6))
        subset = [names[i] for i in sorted(rng.choice(len(names), size=k, replace=False))]
        if tuple(subset) not in seen:
            seen.add(tuple(subset))
            cases.append(subset)
    return cases


# --------------------------------------------------------------------------- gaussian


def book_gaussian():
    # Reproduces the book's code exactly (final.md 708-744); RNG call order matters.
    np.random.seed(23)
    n = 220
    sozlesme_suresi = np.random.randint(1, 60, n)
    sikayet_sayisi = np.random.randint(0, 6, n)
    churn = ((sozlesme_suresi < 15).astype(int) + (sikayet_sayisi >= 3).astype(int) >= 1).astype(int)
    X = np.column_stack([sozlesme_suresi, sikayet_sayisi]).astype(float)
    X_tr, X_te, y_tr, y_te = train_test_split(X, churn, test_size=0.3, random_state=23)
    model = GaussianNB().fit(X_tr, y_tr)

    acc = float((model.predict(X_te) == y_te).mean())
    post = model.predict_proba(X_te[0:1])[0]
    if round(acc, 3) != 0.909:
        fail(f"book accuracy {acc} != 0.909")
    if [round(float(p), 3) for p in model.class_prior_] != [0.383, 0.617]:
        fail(f"book priors {model.class_prior_}")
    if [round(float(p), 3) for p in post] != [0.815, 0.185]:
        fail(f"book posterior {post}")
    if len(y_tr) != 154 or [int(v) for v in X_te[0]] != [18, 1]:
        fail("train size or first test customer differs from the book")
    return model, X_tr, y_tr, X_te


# --------------------------------------------------------------------------- output


def dumps(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(", ", ": "))


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def main() -> None:
    check_corpus()
    story_check()
    model, X_tr, y_tr, X_te = book_gaussian()

    cases = spam_cases()
    multinomial = [{"words": c, "proba": sklearn_multinomial(c)} for c in cases]
    for case in multinomial:
        ref = formula_proba(case["words"], 1)
        if max(abs(a - b) for a, b in zip(ref, case["proba"])) > 1e-12:
            fail(f"formula and sklearn disagree for {case['words']}")
    alpha0 = [{"words": c, "proba": formula_proba(c, 0)} for c in cases]

    pts = [[float(X_te[0][0]), float(X_te[0][1])]] + [[float(t), float(c)] for t, c in GRID]
    gcases = [{"x": x, "proba": [float(p) for p in model.predict_proba([x])[0]]} for x in pts]
    fixture = {
        "multinomial": multinomial,
        "alpha0": alpha0,
        "gaussian": {
            "prior": [float(p) for p in model.class_prior_],
            "theta": model.theta_.tolist(),
            "var": model.var_.tolist(),
            "cases": gcases,
        },
    }

    jrng = np.random.default_rng(23)
    jy = np.round(jrng.uniform(-0.25, 0.25, len(y_tr)), 3)
    rows = [
        {"t": int(a[0]), "c": int(a[1]), "y": int(b), "jy": float(j)} for a, b, j in zip(X_tr, y_tr, jy)
    ]
    words = [{"w": w, "n": [a, b]} for w, a, b in WORDS]
    data = (
        "{\n"
        f' "spam": {{"docs": {dumps(DOCS)}, "words": [\n'
        + ",\n".join("  " + dumps(w) for w in words)
        + "\n ]},\n"
        ' "gauss": {"train": [\n'
        + ",\n".join("  " + dumps(r) for r in rows)
        + '\n ], "firstTest": {"t": 18, "c": 1}}\n'
        "}\n"
    )
    json.loads(data)
    write_text(DATA_OUT, data)
    write_text(FIXTURE_OUT, json.dumps(fixture, ensure_ascii=False, indent=1) + "\n")
    print(f"{len(cases)} multinomial cases; {len(y_tr)} train ({int(y_tr.sum())} Ayrildi)")
    print(f"Wrote {DATA_OUT.relative_to(REPO).as_posix()} and {FIXTURE_OUT.relative_to(REPO).as_posix()}")


if __name__ == "__main__":
    main()
