"""Generate Chapter 12 (text mining: TF-IDF, cosine similarity, sentiment) data and the sklearn fixture.

Run:   python scripts/make_metin_data.py
Check: python scripts/make_metin_data.py --check   (writes nothing; exit 1 on drift)

Reads nothing: the book examples are written in this file verbatim and the comment corpus is
synthetic (templates below, random.Random(42)).

Writes (relative to the repo root):
  src/concepts/metin/data/metin.json   data the two pages draw
  tests/fixtures/metin_sklearn.json    sklearn numbers the TypeScript maths is compared with

Tokenisation. Every vectoriser in this file (the book examples included) uses the book's code 01
cleaning as `preprocessor`: "İ" -> "i", "I" -> "ı", lower(), `[^a-zçğıöşü\\s]` -> space. sklearn then
applies its own token_pattern `(?u)\\b\\w\\w+\\b` to the cleaned text. The book texts are already
clean, so this changes none of their numbers; the checks prove it (default TfidfVectorizer() against
the cleaning one, matrices equal). The TypeScript twin is src/concepts/metin/vectorize.ts.

Data (metin.json; display numbers 6 decimals, model parameters full precision):
  stopWords  The book's stop-word set (code 01).
  book       kod01 (comment, tokens, the two traps), kod02 (3 documents: vocabulary, BoW, df, IDF,
             raw weights, norms, TF-IDF), kod03 (3 comments: vocabulary, TF-IDF, scores), kod04
             (8 comments, labels, split, test predictions, report, the new comment's probability and
             the stored model), mini (4 comments, the example comment's probability, similarities and
             the stored model), cosPair ("internet bağlantısı çok iyi" / "... çok kötü").
  corpus     Columnar: text, label (1 = olumlu), kind (duz / olumsuzlama / karisik), test (1 = in the
             stratified 75/25 split, train_test_split(range(n), test_size=0.25, stratify=label,
             random_state=42), both parts kept in data order).
  models     8 models {uni, bi} x {keep, drop "değil" as stop word} x {train, all (leaky)}:
             `<ngram>-<keep|drop>-<train|all>`. Vectoriser TfidfVectorizer(preprocessor=clean,
             ngram_range=(1, n), stop_words=["değil"] or None); the leaky ones fit the vectoriser on
             all corpus comments, the others on the training part. LogisticRegression(max_iter=1000)
             fits the training rows. Per model: ngram, dropDegil, leaky, nDocs, vocab (column order),
             idf, coef, intercept (full precision), matrix {tn, fp, fn, tp} on the test part with
             olumlu (1) as the positive class, accuracy, negN / negAccuracy (the olumsuzlama
             comments of the test part), vocabSize, testOnly (vocabulary terms no training comment has,
             only the leaky models).
  drift      The uni-keep-train model on the 40 "new period" comments (terms never seen in training:
             fiber, esim, ...): comments, per-comment probability, out-of-vocabulary token rate on
             the test part and on the new period, accuracies, the new terms, the all-new comments.

Fixture (metin_sklearn.json), full precision:
  tokenize   20 example comments: book tokens, with the stop words kept / dropped.
  analyze    sklearn build_analyzer output for 10 texts x ngram 1 / 2 x "değil" kept / dropped.
  books      kod02, kod03, cosPair: documents, vocabulary, BoW, IDF, TF-IDF.
  models     Per model: vocabulary, IDF, TF-IDF rows (sparse) of the first 30 training and 30 test
             comments, the probabilities and logits of the first 30 test comments, five new-period
             comments with probability and out-of-vocabulary counts, and the book models.

Checks (SystemExit with the failing check named; the generator never bends data to pass):
  - the cleaning preprocessor changes no number of kod02 / kod03 / kod04 / mini;
  - kod02 TF-IDF table 0.43 / 0.56, kod03 scores 1.00 / 0.14 / 0.00, kod04 accuracy 0.50 with
    predictions 1, 1 and the new comment p = 0.542 -> 1, mini p = 0.500 -> 1, cosPair 0.603;
  - the corpus: 400 comments, 200 / 200, at least 60 olumsuzlama, 4-10 tokens each, unique, no digits;
    split 300 / 100 stratified; 40 new-period comments with at least 6 terms the whole corpus never uses and at least 2
    comments made only of unseen terms;
  - keeping "değil" with bigrams beats dropping it on the olumsuzlama comments of the test part;
  - the new period's out-of-vocabulary rate is above the test part's.
"""

import json
import random
import re
import sys
import warnings
from pathlib import Path

import numpy as np
from sklearn.exceptions import ConvergenceWarning
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = "src/concepts/metin/data/metin.json"
FIXTURE_PATH = "tests/fixtures/metin_sklearn.json"

SEED = 42
STOP_WORDS = ["ve", "ile", "bir", "bu", "şu", "için", "çok", "ama"]
DEGIL = ["değil"]
N_PER_KIND = {"duz": 200, "olumsuzlama": 120, "karisik": 80}
N_NEW = 40


def fail(msg):
    print("CRITERION FAILED: " + msg)
    sys.exit(1)


def r6(v):
    return round(float(v), 6) + 0.0


def f6(rows):
    return [[r6(v) for v in row] for row in rows]


def full(v):
    return float(v) + 0.0


# --------------------------------------------------------------------------- the book's code 01


def clean(text):
    """The book's code 01 cleaning, without the split: lower-case letters and spaces only."""
    lowered = text.replace("İ", "i").replace("I", "ı").lower()
    return re.sub(r"[^a-zçğıöşü\s]", " ", lowered)


def book_tokens(text):
    """The book's metni_temizle_ve_tokenlara_ayir: clean, split, drop one-character tokens."""
    return [w for w in clean(text).split() if len(w) > 1]


def tfidf_vec(ngram=1, drop=False, default=False):
    if default:
        return TfidfVectorizer(ngram_range=(1, ngram))
    return TfidfVectorizer(preprocessor=clean, ngram_range=(1, ngram),
                           stop_words=list(DEGIL) if drop else None)


def sparse_rows(matrix):
    out = []
    for i in range(matrix.shape[0]):
        row = matrix.getrow(i)
        order = np.argsort(row.indices)
        out.append([[int(row.indices[k]), full(row.data[k])] for k in order])
    return out


def fit_lr(x, y):
    with warnings.catch_warnings():
        warnings.simplefilter("error", ConvergenceWarning)
        try:
            return LogisticRegression(max_iter=1000).fit(x, y)
        except ConvergenceWarning:
            fail("LogisticRegression(max_iter=1000) did not converge")


# --------------------------------------------------------------------------- the comment corpus
# Natural Turkish telecom comments, template based, no personal data. Every slot lists
# (value, weight): the heavy entries are the shared core words, the weight-1 entries the long tail.

ASPECTS = {
    "internet": {
        "weight": 4,
        "nouns": [("internet hızı", 6), ("internet bağlantısı", 5), ("ev interneti", 4),
                  ("mobil internet", 4), ("bağlantı kalitesi", 3), ("yükleme hızı", 2),
                  ("indirme hızı", 1)],
        "pos": [("hızlı", 8), ("iyi", 8), ("kaliteli", 5), ("kararlı", 4), ("güzel", 3),
                ("sorunsuz", 2), ("mükemmel", 1), ("stabil", 1)],
        "neg": [("yavaş", 8), ("kötü", 8), ("yetersiz", 5), ("sorunlu", 4), ("kararsız", 3),
                ("berbat", 1), ("vasat", 1), ("dengesiz", 1)],
    },
    "fatura": {
        "weight": 3,
        "nouns": [("fatura", 6), ("fatura tutarı", 4), ("paket fiyatları", 4), ("tarifem", 3),
                  ("kampanyalar", 3), ("aylık ücret", 2), ("ek paketler", 1)],
        "pos": [("uygun", 8), ("makul", 6), ("iyi", 8), ("şeffaf", 3), ("anlaşılır", 3),
                ("kaliteli", 3), ("avantajlı", 1)],
        "neg": [("pahalı", 8), ("yüksek", 6), ("kötü", 8), ("karışık", 4), ("anlaşılmaz", 2),
                ("yetersiz", 4), ("hatalı", 1)],
    },
    "hizmet": {
        "weight": 3,
        "nouns": [("müşteri hizmetleri", 6), ("destek ekibi", 6), ("teknik servis", 4),
                  ("çağrı merkezi", 3), ("kurulum ekibi", 2), ("bayi", 1)],
        "pos": [("ilgili", 8), ("yardımcı", 5), ("hızlı", 8), ("iyi", 8), ("nazik", 3),
                ("profesyonel", 3), ("güler yüzlü", 1)],
        "neg": [("ilgisiz", 6), ("yetersiz", 6), ("yavaş", 8), ("kötü", 8), ("kaba", 2),
                ("bilgisiz", 2), ("ulaşılmaz", 1)],
    },
    "uygulama": {
        "weight": 2,
        "nouns": [("mobil uygulama", 6), ("uygulama", 5), ("müşteri paneli", 2),
                  ("online işlemler", 2)],
        "pos": [("kullanışlı", 6), ("kolay", 5), ("pratik", 3), ("hızlı", 8), ("iyi", 8),
                ("kaliteli", 3), ("sade", 1)],
        "neg": [("karışık", 5), ("yavaş", 8), ("hatalı", 4), ("kötü", 8), ("yetersiz", 5),
                ("sorunlu", 4), ("hantal", 1)],
    },
    "ses": {
        "weight": 2,
        "nouns": [("arama kalitesi", 6), ("ses kalitesi", 5), ("çekim gücü", 5), ("sinyal", 2),
                  ("kapsama alanı", 1)],
        "pos": [("net", 4), ("güçlü", 5), ("iyi", 8), ("kaliteli", 6), ("yeterli", 4),
                ("kristal gibi", 1)],
        "neg": [("kötü", 8), ("zayıf", 6), ("düşük", 4), ("yetersiz", 5), ("parazitli", 2),
                ("yavaş", 1)],
    },
}

CTX = [("bu ay", 4), ("geçen hafta", 3), ("uzun süredir", 3), ("her gün", 3), ("akşamları", 2),
       ("hafta sonu", 2), ("yeni paketle", 2), ("taşındıktan sonra", 1), ("bir aydır", 3),
       ("iki gündür", 2), ("evde", 2), ("işyerinde", 1), ("sabahları", 2), ("şehir dışında", 1),
       ("tatilde", 1), ("son zamanlarda", 3), ("dün akşam", 1), ("yıllardır", 1)]

POS_EXTRA = [("memnunum", 8), ("teşekkürler", 8), ("teşekkür ederim", 4), ("harika", 4),
             ("çok memnunum", 4), ("tavsiye ederim", 4), ("mutluyum", 3), ("devam edin", 3),
             ("beğendim", 3), ("sağ olun", 1), ("elinize sağlık", 1)]
NEG_EXTRA = [("şikayetçiyim", 8), ("rezalet", 5), ("bıktım", 5), ("yeter artık", 3),
             ("mağdur oldum", 4), ("tavsiye etmem", 4), ("iptal edeceğim", 3),
             ("hayal kırıklığı", 3), ("çok yoruldum", 2), ("memnuniyetsizim", 3),
             ("kabul edilemez", 1), ("sinir bozucu", 1)]

DUZ_TEMPLATES = [("{X} gerçekten {A}", 3), ("{C} {X} {A}", 3), ("{X} {A} {E}", 5),
                 ("{E} {X} {A}", 2), ("{X} {A}, {E}", 3), ("{X} her zaman {A}", 2),
                 ("{C} {X} {A} {E}", 3), ("{X} {A} diyebilirim", 1)]
NEG_TEMPLATES = [("{X} {A} değil", 5), ("{X} pek {A} değil", 3), ("{X} hiç de {A} değil", 3),
                 ("{X} o kadar {A} değil", 2), ("{C} {X} {A} değil", 4),
                 ("{X} {A} değil {E}", 2), ("{X} bence {A} değil", 1)]
MIX_CONJ = [("ama", 6), ("fakat", 2), ("ancak", 2)]

# New period: terms the training comments never use.
NEW_NOUNS = [("fiber altyapı", 5), ("esim aktivasyonu", 4), ("mesh sistemi", 3),
             ("wifi kapsama", 3), ("roaming ücretleri", 3), ("hotspot kullanımı", 2),
             ("fiber kurulum", 2), ("esim", 2), ("fiber", 2)]
NEW_POS = [("muhteşem", 3), ("kesintisiz", 3), ("gecikmesiz", 2)]
NEW_NEG = [("felaket", 3), ("kesintili", 3), ("çalışmıyor", 2)]


def pick(rng, items):
    values = [v for v, _ in items]
    weights = [w for _, w in items]
    return rng.choices(values, weights=weights, k=1)[0]


def pick_aspect(rng, skip=None):
    names = [n for n in ASPECTS if n != skip]
    return rng.choices(names, weights=[ASPECTS[n]["weight"] for n in names], k=1)[0]


def duz(rng, label):
    a = ASPECTS[pick_aspect(rng)]
    adj = pick(rng, a["pos"] if label == 1 else a["neg"])
    extra = pick(rng, POS_EXTRA if label == 1 else NEG_EXTRA)
    tpl = pick(rng, DUZ_TEMPLATES)
    return tpl.format(X=pick(rng, a["nouns"]), A=adj, E=extra, C=pick(rng, CTX))


def olumsuzlama(rng, label):
    """'X kötü değil' is olumlu (1); 'X hızlı değil' is olumsuz (0)."""
    a = ASPECTS[pick_aspect(rng)]
    adj = pick(rng, a["neg"] if label == 1 else a["pos"])
    extra = pick(rng, POS_EXTRA if label == 1 else NEG_EXTRA)
    tpl = pick(rng, NEG_TEMPLATES)
    return tpl.format(X=pick(rng, a["nouns"]), A=adj, E=extra, C=pick(rng, CTX))


def karisik(rng, label):
    """Two clauses with opposite feelings; the clause after the conjunction decides the label."""
    name1 = pick_aspect(rng)
    a1, a2 = ASPECTS[name1], ASPECTS[pick_aspect(rng, skip=name1)]
    first = pick(rng, a1["neg"] if label == 1 else a1["pos"])
    second = pick(rng, a2["pos"] if label == 1 else a2["neg"])
    prefix = pick(rng, CTX) + " " if rng.random() < 0.25 else ""
    suffix = ", " + pick(rng, POS_EXTRA if label == 1 else NEG_EXTRA) if rng.random() < 0.5 else ""
    return "{}{} {} {} {} {}{}".format(prefix, pick(rng, a1["nouns"]), first, pick(rng, MIX_CONJ),
                                       pick(rng, a2["nouns"]), second, suffix)


def new_period(rng, label, mode):
    """mode 'only': every token unseen; 'adj': unseen noun + unseen adjective + known extra;
    'known': unseen noun with a known adjective."""
    pos = label == 1
    noun = pick(rng, NEW_NOUNS)
    if mode == "only":
        noun2 = pick(rng, [n for n in NEW_NOUNS if n[0] != noun])
        return "{} {} {} {}".format(noun, pick(rng, NEW_POS if pos else NEW_NEG),
                                    noun2, pick(rng, NEW_POS if pos else NEW_NEG))
    if mode == "adj":
        tpl = pick(rng, [("{N} {S}", 3), ("{C} {N} {S}", 4), ("{N} {S} {C}", 2)])
        return tpl.format(N=noun, S=pick(rng, NEW_POS if pos else NEW_NEG), C=pick(rng, CTX))
    a = ASPECTS[pick_aspect(rng)]
    adj = pick(rng, a["pos"] if pos else a["neg"])
    extra = pick(rng, POS_EXTRA if pos else NEG_EXTRA)
    tpl = pick(rng, [("{N} {A} {E}", 2), ("{C} {N} {A}", 4), ("{N} geçişinden sonra {X} {A}", 2),
                     ("{N} gerçekten {A}", 2)])
    return tpl.format(N=noun, A=adj, E=extra, C=pick(rng, CTX), X=pick(rng, a["nouns"]))


def decorate(rng, text):
    """Sentence case with the Turkish i / İ rule, and a closing mark; token content unchanged."""
    if rng.random() < 0.7:
        first = "İ" if text[0] == "i" else text[0].upper()
        text = first + text[1:]
    return text + pick(rng, [("", 5), (".", 4), ("!", 2), ("...", 1)])


def build_corpus():
    rng = random.Random(SEED)
    seen = set()
    items = []

    def add(kind, label, make, lo=4, hi=10):
        for _ in range(500):
            raw = make(rng, label)
            toks = book_tokens(raw)
            key = " ".join(toks)
            if lo <= len(toks) <= hi and key not in seen:
                seen.add(key)
                items.append({"text": decorate(rng, raw), "label": label, "kind": kind})
                return
        fail(f"no unique {kind} comment found for label {label}")

    maker = {"duz": duz, "olumsuzlama": olumsuzlama, "karisik": karisik}
    for kind, n in N_PER_KIND.items():
        for k in range(n):
            add(kind, k % 2, maker[kind])
    rng.shuffle(items)

    new = []
    modes = ["only"] * 6 + ["adj"] * 16 + ["known"] * 18
    labels = [k % 2 for k in range(N_NEW)]
    rng.shuffle(modes)
    for mode, label in zip(modes, labels):
        for _ in range(500):
            raw = new_period(rng, label, mode)
            toks = book_tokens(raw)
            key = " ".join(toks)
            if 3 <= len(toks) <= 10 and key not in seen:
                seen.add(key)
                new.append({"text": decorate(rng, raw), "label": label,
                            "kind": "yeni" if mode != "known" else "yeni-bilinen", "mode": mode})
                break
        else:
            fail(f"no unique new-period comment for mode {mode}")
    return items, new


# --------------------------------------------------------------------------- tokenisation fixture

TOKENIZE_EXAMPLES = [
    "İnternetim 3 gündür çok yavaş; destek ekibi dönüş yapmadı!",
    "IŞIK ve ISI kontrolü ile ILIK su",
    "İSTANBUL'da İYİ çekim",
    "Hizmet kötü değil",
    "5G hızı 100 Mbps, ama pahalı!!!",
    "BAĞLANTI sürekli KOPUYOR",
    "ÇOK şikayet var; ÖĞRENCİ tarifesi ÜCRETSİZ mi?",
    "a b c internet d",
    "Fatura   çok    yüksek",
    "Wi-Fi sinyali zayıf (2. kat)",
    "ağ_bağlantısı yok",
    "internet\thızlı\nve güvenilir",
    "  başında ve sonunda boşluk  ",
    "Kampanya 50% indirim; ama için bu şu",
    "ÇAĞRI merkezi ÇÖZÜM üretmedi.",
    "Memnunum :) harika... teşekkürler",
    "Müşteri hizmetleri ilgili değil, bir şey yapmadı",
    "SMS ve e-posta gelmiyor",
    "İki gündür kesinti var, ışık yanıp sönüyor",
    "12345 67 89",
]

ANALYZE_TEXTS = [
    "Hizmet kötü değil",
    "İnternet hızı çok iyi",
    "Destek ekibi ilgili değil, bir şey yapmadı",
    "IŞIK ve ISI",
    "Fatura tutarı yüksek ama uygulama kullanışlı",
    "a b c",
    "kötü değil kötü değil",
    "Bağlantı kalitesi çok kötü!",
    "ÇAĞRI merkezi ilgisiz değil",
    "x",
]


# --------------------------------------------------------------------------- book examples


def check_same(label, docs, ngram=1):
    """The cleaning preprocessor must not change any number of an already clean book text."""
    a = tfidf_vec(ngram, default=True).fit(docs)
    b = tfidf_vec(ngram).fit(docs)
    if list(a.get_feature_names_out()) != list(b.get_feature_names_out()):
        fail(f"{label}: preprocessor changes the vocabulary")
    xa, xb = a.transform(docs).toarray(), b.transform(docs).toarray()
    if not np.array_equal(xa, xb):
        fail(f"{label}: preprocessor changes the TF-IDF numbers")


def book_examples():
    out = {}
    fx = {}

    # kod01
    text = "İnternetim 3 gündür çok yavaş; destek ekibi dönüş yapmadı!"
    toks = book_tokens(text)
    if toks != ["internetim", "gündür", "çok", "yavaş", "destek", "ekibi", "dönüş", "yapmadı"]:
        fail(f"kod01 tokens {toks}")
    naive = [w for w in re.sub(r"[^a-zçğıöşü\s]", " ", text.lower()).split() if len(w) > 1]
    out["kod01"] = {
        "text": text,
        "tokens": toks,
        "naiveTokens": naive,
        "trap": {"wrongPattern": re.sub(r"[^a-z\s]", " ", "bağlantı kötü"),
                 "rightPattern": clean("bağlantı kötü")},
    }

    # kod02
    docs2 = ["internet yavaş destek yetersiz", "fatura yüksek destek iyi",
             "internet hızlı bağlantı iyi"]
    check_same("kod02", docs2)
    cv = CountVectorizer(preprocessor=clean).fit(docs2)
    tv = tfidf_vec().fit(docs2)
    bow = cv.transform(docs2).toarray()
    tfidf = tv.transform(docs2).toarray()
    vocab = [str(t) for t in tv.get_feature_names_out()]
    if len(vocab) != 9:
        fail(f"kod02 vocabulary has {len(vocab)} terms, not 9")
    expected = [[0, .43, 0, 0, .43, 0, .56, .56, 0], [0, .43, .56, 0, 0, .43, 0, 0, .56],
                [.56, 0, 0, .56, .43, .43, 0, 0, 0]]
    if not np.array_equal(np.round(tfidf, 2), np.array(expected)):
        fail("kod02 TF-IDF table is not the book's 0.43 / 0.56 table")
    raw = bow * tv.idf_
    out["kod02"] = {
        "docs": docs2, "vocab": vocab,
        "bow": bow.astype(int).tolist(),
        "df": [int(v) for v in (bow > 0).sum(axis=0)],
        "idf": [r6(v) for v in tv.idf_],
        "raw": f6(raw),
        "norms": [r6(v) for v in np.linalg.norm(raw, axis=1)],
        "tfidf": f6(tfidf),
    }
    fx["kod02"] = {"docs": docs2, "vocab": vocab, "bow": bow.astype(int).tolist(),
                   "idf": [full(v) for v in tv.idf_], "tfidf": [[full(v) for v in r] for r in tfidf]}

    # kod03
    docs3 = ["internet bağlantısı sürekli kopuyor", "bağlantı kesiliyor internet çok yavaş",
             "fatura tutarım beklediğimden yüksek"]
    check_same("kod03", docs3)
    tv3 = tfidf_vec().fit(docs3)
    x3 = tv3.transform(docs3)
    sims = cosine_similarity(x3[0:1], x3).flatten()
    if [round(float(v), 2) for v in sims] != [1.0, 0.14, 0.0]:
        fail(f"kod03 scores {sims} are not 1.00 / 0.14 / 0.00")
    order = sorted(range(3), key=lambda i: sims[i], reverse=True)
    out["kod03"] = {"docs": docs3, "vocab": [str(t) for t in tv3.get_feature_names_out()],
                    "tfidf": f6(x3.toarray()), "scores": [r6(v) for v in sims], "order": order}
    fx["kod03"] = {"docs": docs3, "vocab": [str(t) for t in tv3.get_feature_names_out()],
                   "idf": [full(v) for v in tv3.idf_], "tfidf": [[full(v) for v in r] for r in x3.toarray()],
                   "scores": [full(v) for v in sims]}

    # cosine pair
    pair = ["internet bağlantısı çok iyi", "internet bağlantısı çok kötü"]
    check_same("cosPair", pair)
    tp = tfidf_vec().fit(pair)
    xp = tp.transform(pair)
    cp = float(cosine_similarity(xp[0:1], xp[1:2])[0, 0])
    if round(cp, 3) != 0.603:
        fail(f"cosine pair {cp} is not 0.603")
    out["cosPair"] = {"a": pair[0], "b": pair[1], "cos": r6(cp)}
    fx["cosPair"] = {"docs": pair, "vocab": [str(t) for t in tp.get_feature_names_out()],
                     "tfidf": [[full(v) for v in r] for r in xp.toarray()], "cos": cp}

    # kod04
    docs4 = [
        "internet çok hızlı ve destek ekibi ilgili",
        "fatura beklediğimden yüksek müşteri hizmetleri kötü",
        "bağlantı sürekli kopuyor çözüm bulunamadı",
        "uygulama kolay kullanılıyor hizmetten memnunum",
        "modem arızalı destek kaydıma dönüş yapılmadı",
        "paketim uygun fiyatlı internet kalitesi iyi",
        "taahhüt koşulları açık ve işlem hızlı",
        "çekim gücü düşük sürekli sorun yaşıyorum",
    ]
    y4 = [1, 0, 0, 1, 0, 1, 1, 0]
    new4 = "bağlantı sorunu çözüldü destek ekibi çok ilgili"
    check_same("kod04", docs4, 2)
    idx = list(range(8))
    i_tr, i_te, y_tr, y_te = train_test_split(idx, y4, test_size=0.25, random_state=42,
                                              stratify=y4)
    b_tr, b_te, _, _ = train_test_split(docs4, y4, test_size=0.25, random_state=42, stratify=y4)
    if [docs4[i] for i in i_tr] != b_tr or [docs4[i] for i in i_te] != b_te:
        fail("kod04 index split differs from the book split")
    pipe = Pipeline([("tfidf", tfidf_vec(2)), ("clf", LogisticRegression(max_iter=1000))])
    pipe.fit(b_tr, y_tr)
    pred = [int(v) for v in pipe.predict(b_te)]
    rep = classification_report(y_te, pred, zero_division=0, output_dict=True)
    p_new = float(pipe.predict_proba([new4])[0, 1])
    pred_new = int(pipe.predict([new4])[0])
    if (y_te != [0, 1] or pred != [1, 1] or round(rep["accuracy"], 2) != 0.5
            or round(p_new, 3) != 0.542 or pred_new != 1):
        fail(f"kod04: test {y_te} predictions {pred} accuracy {rep['accuracy']} p {p_new}")
    vec4, lr4 = pipe.named_steps["tfidf"], pipe.named_steps["clf"]
    model4 = {"ngram": 2, "dropDegil": False, "vocab": [str(t) for t in vec4.get_feature_names_out()],
              "idf": [full(v) for v in vec4.idf_], "coef": [full(v) for v in lr4.coef_[0]],
              "intercept": full(lr4.intercept_[0])}
    out["kod04"] = {
        "docs": docs4, "labels": y4, "trainIdx": [int(i) for i in i_tr],
        "testIdx": [int(i) for i in i_te], "testLabels": y_te, "predictions": pred,
        "accuracy": r6(rep["accuracy"]),
        "report": {c: {k: r6(rep[c][k]) for k in ("precision", "recall", "f1-score")}
                   | {"support": int(rep[c]["support"])} for c in ("0", "1")},
        "newComment": new4, "pNew": r6(p_new), "predNew": pred_new, "model": model4,
    }
    fx["kod04"] = {"model": model4, "pNew": p_new,
                   "probs": [full(v) for v in pipe.predict_proba(b_te)[:, 1]]}

    # mini application
    docs5 = ["internet hızlı destek ilgili", "fatura yüksek bağlantı sürekli kopuyor",
             "uygulama kullanışlı hizmet iyi", "müşteri hizmetleri sorunu çözmedi"]
    y5 = [1, 0, 1, 0]
    comment = "internet yavaş ve destek ekibi sorunu çözmedi"
    check_same("mini", docs5)
    pipe5 = Pipeline([("tfidf", tfidf_vec()), ("clf", LogisticRegression(max_iter=1000))])
    pipe5.fit(docs5, y5)
    vec5, lr5 = pipe5.named_steps["tfidf"], pipe5.named_steps["clf"]
    p5 = float(pipe5.predict_proba([comment])[0, 1])
    sims5 = cosine_similarity(vec5.transform([comment]), vec5.transform(docs5)).flatten()
    best = int(sims5.argmax())
    pred5 = int(pipe5.predict([comment])[0])
    top = sorted(float(v) for v in sims5)[-2:]
    if round(p5, 3) != 0.5 or pred5 != 1:
        fail(f"mini p {p5} prediction {pred5} is not 0.500 -> 1")
    if abs(top[0] - top[1]) > 1e-12 or round(top[1], 2) != 0.5:
        fail(f"mini similarity tie {top} is not 0.5 twice")
    tied = [i for i in range(4) if abs(sims5[i] - top[1]) <= 1e-12]
    if sorted(y5[i] for i in tied) != [0, 1]:
        fail("mini tie is not one olumlu and one olumsuz comment")
    model5 = {"ngram": 1, "dropDegil": False, "vocab": [str(t) for t in vec5.get_feature_names_out()],
              "idf": [full(v) for v in vec5.idf_], "coef": [full(v) for v in lr5.coef_[0]],
              "intercept": full(lr5.intercept_[0])}
    out["mini"] = {"docs": docs5, "labels": y5, "comment": comment, "p": r6(p5), "pred": pred5,
                   "similarities": [r6(v) for v in sims5], "best": best, "tied": tied,
                   "model": model5}
    fx["mini"] = {"model": model5, "p": p5, "similarities": [full(v) for v in sims5]}
    return out, fx


# --------------------------------------------------------------------------- models


def model_key(ngram, drop, leaky):
    return "{}-{}-{}".format("uni" if ngram == 1 else "bi", "drop" if drop else "keep",
                             "all" if leaky else "train")


def generate():
    book, fx_books = book_examples()

    items, new = build_corpus()
    n = len(items)
    texts = [c["text"] for c in items]
    y = np.array([c["label"] for c in items])
    kinds = [c["kind"] for c in items]
    clean_docs = [" ".join(book_tokens(t)) for t in texts]

    # Corpus checks.
    if n != 400 or int(y.sum()) != 200:
        fail(f"corpus has {n} comments with {int(y.sum())} olumlu, not 400 with 200")
    if kinds.count("olumsuzlama") < 60:
        fail("fewer than 60 olumsuzlama comments")
    for t in texts + [c["text"] for c in new]:
        if re.search(r"[0-9@]", t):
            fail(f"digit or @ in comment: {t}")
    lengths = [len(book_tokens(t)) for t in texts]
    if min(lengths) < 4 or max(lengths) > 10:
        fail(f"token counts {min(lengths)}..{max(lengths)} outside 4..10")

    idx = np.arange(n)
    i_tr, i_te = train_test_split(idx, test_size=0.25, stratify=y, random_state=42)
    i_tr, i_te = np.sort(i_tr), np.sort(i_te)
    if (len(i_tr), len(i_te)) != (300, 100) or (int(y[i_tr].sum()), int(y[i_te].sum())) != (150, 50):
        fail("stratified split is not 300 / 100 with 150 / 50 olumlu")
    test_flag = np.zeros(n, dtype=int)
    test_flag[i_te] = 1
    tr_docs, te_docs = [texts[i] for i in i_tr], [texts[i] for i in i_te]
    ytr, yte = y[i_tr], y[i_te]
    neg_test = np.array([kinds[i] == "olumsuzlama" for i in i_te])
    new_texts = [c["text"] for c in new]
    ynew = np.array([c["label"] for c in new])

    models, fx_models = {}, {}
    vecs = {}
    for ngram in (1, 2):
        for drop in (False, True):
            for leaky in (False, True):
                key = model_key(ngram, drop, leaky)
                vec = tfidf_vec(ngram, drop)
                vec.fit(texts if leaky else tr_docs)
                xtr, xte = vec.transform(tr_docs), vec.transform(te_docs)
                lr = fit_lr(xtr, ytr)
                p_te = lr.predict_proba(xte)[:, 1]
                pred = lr.predict(xte)
                cm = confusion_matrix(yte, pred, labels=[0, 1])
                vocab = [str(t) for t in vec.get_feature_names_out()]
                df_tr = np.asarray((xtr > 0).sum(axis=0)).ravel()
                test_only = [vocab[j] for j in range(len(vocab)) if df_tr[j] == 0]
                acc = float((pred == yte).mean())
                neg_acc = float((pred[neg_test] == yte[neg_test]).mean())
                models[key] = {
                    "ngram": ngram, "dropDegil": drop, "leaky": leaky, "nDocs": n if leaky else len(tr_docs),
                    "vocab": vocab, "idf": [full(v) for v in vec.idf_],
                    "coef": [full(v) for v in lr.coef_[0]], "intercept": full(lr.intercept_[0]),
                    "matrix": {"tn": int(cm[0, 0]), "fp": int(cm[0, 1]), "fn": int(cm[1, 0]),
                               "tp": int(cm[1, 1])},
                    "accuracy": r6(acc), "negN": int(neg_test.sum()), "negAccuracy": r6(neg_acc),
                    "vocabSize": len(vocab), "testOnly": test_only if leaky else [],
                }
                vecs[key] = (vec, lr)

                z_te = xte @ lr.coef_[0] + lr.intercept_[0]
                fx_models[key] = {
                    "vocab": vocab, "idf": [full(v) for v in vec.idf_],
                    "trainRows": sparse_rows(xtr[:30]), "testRows": sparse_rows(xte[:30]),
                    "probs": [full(v) for v in p_te[:30]], "logits": [full(v) for v in z_te[:30]],
                }

    # Model checks.
    bk, bd = models["bi-keep-train"], models["bi-drop-train"]
    if not bk["negAccuracy"] > bd["negAccuracy"]:
        fail("negation check: keeping 'değil' with bigrams does not beat dropping it "
             f"({bk['negAccuracy']} vs {bd['negAccuracy']} on {bk['negN']} comments)")
    if len(models["uni-keep-all"]["testOnly"]) < 3:
        fail("the leaky unigram model has fewer than 3 test-only terms")

    # Drift with the leak-free unigram model.
    vec, lr = vecs["uni-keep-train"]
    vocab_set = set(vec.get_feature_names_out())
    analyzer = vec.build_analyzer()

    def oov_count(doc_list):
        toks = [analyzer(t) for t in doc_list]
        total = sum(len(t) for t in toks)
        miss = sum(1 for t in toks for w in t if w not in vocab_set)
        return miss, total

    miss_te, tot_te = oov_count(te_docs)
    miss_new, tot_new = oov_count(new_texts)
    rate_te, rate_new = miss_te / tot_te, miss_new / tot_new
    if not rate_new > rate_te:
        fail(f"drift check: new-period OOV rate {rate_new} is not above the test rate {rate_te}")
    corpus_terms = set()
    for t in texts:
        corpus_terms.update(analyzer(t))
    new_terms = sorted({w for t in new_texts for w in analyzer(t) if w not in vocab_set})
    novel_terms = [w for w in new_terms if w not in corpus_terms]
    if len(novel_terms) < 6:
        fail(f"only {len(novel_terms)} new-period terms are absent from the whole corpus")
    all_new = [i for i, t in enumerate(new_texts)
               if all(w not in vocab_set for w in analyzer(t))]
    if len(all_new) < 2:
        fail("fewer than 2 new-period comments made only of unseen terms")
    p_new = lr.predict_proba(vec.transform(new_texts))[:, 1]
    pred_new = lr.predict(vec.transform(new_texts))
    acc_new = float((pred_new == ynew).mean())
    drift = {
        "model": "uni-keep-train",
        "comments": {"text": new_texts, "label": [int(v) for v in ynew],
                     "p": [r6(v) for v in p_new]},
        "oovTokensTest": miss_te, "tokensTest": tot_te, "oovRateTest": r6(rate_te),
        "oovTokensNew": miss_new, "tokensNew": tot_new, "oovRateNew": r6(rate_new),
        "accuracyTest": models["uni-keep-train"]["accuracy"], "accuracyNew": r6(acc_new),
        "newTerms": new_terms, "novelTerms": novel_terms, "allNew": all_new,
    }

    # Fixture: five new-period comments for every model.
    others = [i for i in range(N_NEW) if i not in all_new]
    pick5 = all_new[:2] + [others[0], others[len(others) // 2], others[-1]]
    for key, (v, m) in vecs.items():
        vs = set(v.get_feature_names_out())
        an = v.build_analyzer()
        sel = [new_texts[i] for i in pick5]
        fx_models[key]["new"] = {
            "texts": sel,
            "probs": [full(q) for q in m.predict_proba(v.transform(sel))[:, 1]],
            "oov": [sum(1 for w in an(t) if w not in vs) for t in sel],
        }
        fx_models[key]["testTexts"] = te_docs[:30]
        fx_models[key]["trainTexts"] = tr_docs[:30]
        fx_models[key]["coef"] = models[key]["coef"]
        fx_models[key]["intercept"] = models[key]["intercept"]

    # Fixture: tokenisation and analyzer.
    tok_fx = {"stopWords": STOP_WORDS + DEGIL, "examples": []}
    stop_set = set(tok_fx["stopWords"])
    for t in TOKENIZE_EXAMPLES:
        toks = book_tokens(t)
        tok_fx["examples"].append({
            "text": t, "tokens": toks,
            "kept": [w for w in toks if w not in stop_set],
            "dropped": [w for w in toks if w in stop_set],
        })
    an_fx = []
    for t in ANALYZE_TEXTS:
        for ngram in (1, 2):
            for drop in (False, True):
                an_fx.append({"text": t, "ngram": ngram, "drop": drop,
                              "terms": list(tfidf_vec(ngram, drop).build_analyzer()(t))})

    print("corpus", n, "olumlu", int(y.sum()), "kinds",
          {k: kinds.count(k) for k in N_PER_KIND}, "tokens/comment",
          min(lengths), "..", max(lengths))
    print("split train/test", len(i_tr), len(i_te), "negation comments in test", int(neg_test.sum()))
    for key, m in models.items():
        print(f"{key:14s} vocab {m['vocabSize']:5d} acc {m['accuracy']:.3f} "
              f"neg {m['negAccuracy']:.3f} testOnly {len(m['testOnly'])} matrix {m['matrix']}")
    print("drift OOV rate test", drift["oovRateTest"], f"({miss_te}/{tot_te})", "new",
          drift["oovRateNew"], f"({miss_new}/{tot_new})", "acc test", drift["accuracyTest"],
          "new", drift["accuracyNew"])
    print("new terms", len(new_terms), new_terms, "novel", len(novel_terms), novel_terms, "all-new comments", all_new)
    print("leaky test-only terms", models["uni-keep-all"]["testOnly"])
    print("kod04 p", book["kod04"]["pNew"], "mini p", book["mini"]["p"], "cosPair",
          book["cosPair"]["cos"])
    vk, mk = vecs["bi-keep-train"]
    vu, mu = vecs["uni-keep-train"]
    vd, md = vecs["bi-drop-train"]

    def prob(v, m, t):
        return float(m.predict_proba(v.transform([t]))[0, 1])

    cands = [i for i in i_te if kinds[i] == "olumsuzlama" and y[i] == 1
             and prob(vk, mk, texts[i]) > 0.5 and prob(vu, mu, texts[i]) < 0.5
             and prob(vd, md, texts[i]) < 0.5]
    ex = max(cands, key=lambda i: prob(vk, mk, texts[i])) if cands else None
    if ex is not None:
        t = texts[ex]
        print("step-7 example", repr(t), "corpus index", int(ex), "p bi-keep",
              round(prob(vk, mk, t), 3), "uni-keep", round(prob(vu, mu, t), 3), "bi-drop",
              round(prob(vd, md, t), 3), "tokens", vd.build_analyzer()(t))
    else:
        print("step-7 example: none found")

    data = {
        "stopWords": STOP_WORDS,
        "book": book,
        "corpus": {"text": texts, "label": [int(v) for v in y], "kind": kinds,
                   "test": [int(v) for v in test_flag]},
        "models": models,
        "drift": drift,
    }
    fixture = {"tokenize": tok_fx, "analyze": an_fx, "books": fx_books, "models": fx_models}
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
        print("metin data up to date")
    else:
        for p, text in files.items():
            path = ROOT / p
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(text.encode("utf-8"))
            print(f"Generated {p}")
