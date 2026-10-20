# VM Animasyon

Veri madenciliği kavramlarını adım adım animasyonlarla anlatan, ders sırasında kullanılmak üzere hazırlanmış statik bir Türkçe öğretim sitesi. Yayındaki kavramlar: **k-En Yakın Komşu (k-NN)**, **Karar Ağacı** ve **Naive Bayes**.

İçerik, "Modern Veri Madenciliğine Giriş" kitabına (Prof. Dr. İsmail KIRBAŞ) dayanır.

## Canlı site

- Ana sayfa: https://bmdersleri.github.io/vm-animation/
- k-NN: https://bmdersleri.github.io/vm-animation/knn/
- Ders modu: https://bmdersleri.github.io/vm-animation/knn/?mod=ders
- Karar ağacı: https://bmdersleri.github.io/vm-animation/karar-agaci/
- Naive Bayes: https://bmdersleri.github.io/vm-animation/naive-bayes/

Site, GitHub Pages etkinleştirildiğinde (Settings > Pages > Source: GitHub Actions) `main` dalına her push ile yayına girer. GitHub Actions yalnızca derleyip yayınlar; testler yerelde çalışır. `npm ci` bir push öncesi kancası (`.githooks/pre-push`) kurar: `main`'e her push'tan önce `npm run check` kendiliğinden çalışır ve geçmezse push durur.

## Ders modu

Herhangi bir kavram sayfasına `?mod=ders` eklemek, sınıfta projeksiyon için tasarlanmış ders modunu açar.

## Klavye kısayolları

| Tuş | İşlev |
| --- | --- |
| → / Boşluk | Sonraki adım |
| ← | Önceki adım |
| P | Oynat / duraklat |
| F | Tam ekran |
| Home / End | İlk / son adım |
| ? | Yardım |
| + / - | k-NN: k değerini artır / azalt |
| M | k-NN: Öklid / Manhattan |
| S | k-NN: ölçekleme |
| D | k-NN: veri seti |
| B | k-NN: karar bölgeleri |
| G | Karar ağacı: ölçüt (Gini / Entropi) |
| + / - | Karar ağacı: derinliği artır / azalt |
| T | Karar ağacı: test noktalarını göster / gizle |
| L | Naive Bayes: Laplace α (0 / 1) |
| B | Naive Bayes: karar bölgelerini göster / gizle |
| + / - | Naive Bayes: öncülü artır / azalt |

## Yerel geliştirme

```bash
npm ci
npm run dev        # geliştirme sunucusu
npm test           # birim testleri
npm run build      # tip denetimi + üretim derlemesi (dist/)
npm run test:e2e   # Playwright; Google Chrome kurulu olmalı
npm run check      # yayın öncesi kapı: birim testleri + derleme + Playwright
```

## Veriyi yeniden üretme

```bash
pip install -r scripts/requirements.txt
python scripts/make_knn_data.py <csv yolu>
python scripts/make_tree_data.py
python scripts/make_nb_data.py
```

- `make_knn_data.py`: Telco churn CSV'sinden k-NN örneğini ve scikit-learn referans değerlerini üretir.
- `make_tree_data.py`: karar ağacı sayfasının churn örneğini (`src/concepts/karar-agaci/data/churn_tree.json`) ve `tests/fixtures/karar-agaci_sklearn.json` referanslarını üretir; CSV gerekmez.
- `make_nb_data.py`: Naive Bayes sayfasının spam sayımlarını ve Gauss eğitim kümesini (`src/concepts/naive-bayes/data/nb_data.json`) ve `tests/fixtures/naive-bayes_sklearn.json` referanslarını üretir; CSV gerekmez.

## Yeni kavram ekleme

1. İskeleti üretin: `npm run yeni-kavram -- <kimlik> "<Başlık>"`. Betik `<kimlik>/index.html`, `src/concepts/<kimlik>/` (`main.ts`, `scenario.ts`, `<kimlik>.css`), birim ve e2e test dosyalarını oluşturur ve `vite.config.ts` girdisini ekler.
2. `main.ts` içindeki `ConceptPage` (bkz. `src/core/shell.ts`) sahnesini, parametrelerini ve senaryosunu doldurun.
3. `src/concepts/registry.ts` içinde ilgili kaydı `hazir` durumuna çevirip `href` değerini verin.
