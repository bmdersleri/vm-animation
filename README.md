# VM Animasyon

Veri madenciliği kavramlarını adım adım animasyonlarla anlatan, ders sırasında kullanılmak üzere hazırlanmış statik bir Türkçe öğretim sitesi. Yayındaki kavramlar: **k-En Yakın Komşu (k-NN)**, **Karar Ağacı**, **Naive Bayes**, **Eksik Veri ve IQR Aykırı Değer** ile **Ölçekleme ve Veri Sızıntısı**, **PCA ve t-SNE ile Boyut İndirgeme**, **Özellik Seçimi (filtre ve sarmalayıcı)**, **Karmaşıklık Matrisi ve Metrikler**, **ROC, PR ve Karar Eşiği** ile **Çapraz Doğrulama ve Veri Sızıntısı**.

İçerik, "Modern Veri Madenciliğine Giriş" kitabına (Prof. Dr. İsmail KIRBAŞ) dayanır.

## Canlı site

- Ana sayfa: https://bmdersleri.github.io/vm-animation/
- k-NN: https://bmdersleri.github.io/vm-animation/knn/
- Ders modu: https://bmdersleri.github.io/vm-animation/knn/?mod=ders
- Karar ağacı: https://bmdersleri.github.io/vm-animation/karar-agaci/
- Naive Bayes: https://bmdersleri.github.io/vm-animation/naive-bayes/
- IQR ve aykırı değer: https://bmdersleri.github.io/vm-animation/iqr-aykiri/
- Ölçekleme: https://bmdersleri.github.io/vm-animation/olcekleme/
- PCA ve t-SNE: https://bmdersleri.github.io/vm-animation/pca/
- Özellik seçimi: https://bmdersleri.github.io/vm-animation/ozellik-secimi/
- DBSCAN: https://bmdersleri.github.io/vm-animation/dbscan/
- Hiyerarşik kümeleme ve dendrogram: https://bmdersleri.github.io/vm-animation/dendrogram/
- Karmaşıklık matrisi: https://bmdersleri.github.io/vm-animation/karmasiklik-matrisi/
- ROC ve karar eşiği: https://bmdersleri.github.io/vm-animation/roc-esik/
- Çapraz doğrulama: https://bmdersleri.github.io/vm-animation/capraz-dogrulama/
- K-Means döngüsü: https://bmdersleri.github.io/vm-animation/k-means/
- k sayısının seçimi: https://bmdersleri.github.io/vm-animation/k-secimi/

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
| D | IQR: doldurma stratejisi (yok / ortalama / medyan) |
| K | IQR: katsayı 1,5 / 3,0 |
| C | IQR: müdahale yok / sil / kırp |
| U | Ölçekleme: birim ay / yıl / gün |
| S | Ölçekleme: StandardScaler aç / kapat |
| T | Ölçekleme: fit kapsamı (yalnız eğitim / tüm veri) |
| B | PCA: 9. öznitelik ×1 / ×1000 |
| Y | PCA: PC1’i bul |
| T | PCA: perplexity 5 / 30 / 50 |
| V | Özellik seçimi: varyans eşiği 0 / 0,01 / 1 / 10 |
| S | Özellik seçimi: ölçekleme yok / StandardScaler |

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
python scripts/make_onisleme_data.py
python scripts/make_boyut_data.py
python scripts/make_degerlendirme_data.py
python scripts/make_kmeans_data.py
python scripts/make_dbscan_data.py
python scripts/make_dendrogram_data.py
```

- `make_knn_data.py`: Telco churn CSV'sinden k-NN örneğini ve scikit-learn referans değerlerini üretir.
- `make_tree_data.py`: karar ağacı sayfasının churn örneğini (`src/concepts/karar-agaci/data/churn_tree.json`) ve `tests/fixtures/karar-agaci_sklearn.json` referanslarını üretir; CSV gerekmez.
- `make_nb_data.py`: Naive Bayes sayfasının spam sayımlarını ve Gauss eğitim kümesini (`src/concepts/naive-bayes/data/nb_data.json`) ve `tests/fixtures/naive-bayes_sklearn.json` referanslarını üretir; CSV gerekmez.
- `make_onisleme_data.py`: IQR ve ölçekleme sayfalarının verisini üretir (kitabın 002, 003, 004 ve 006 örnekleri): `src/concepts/iqr-aykiri/data/iqr_data.json`, `src/concepts/olcekleme/data/olcekleme_data.json` ve `tests/fixtures/onisleme_sklearn.json` referansları; CSV gerekmez.
- `make_boyut_data.py`: PCA ve özellik seçimi sayfalarının verisini üretir (kitabın 002, 003, 004 ve 005 örnekleri): `src/concepts/pca/data/pca_data.json`, `src/concepts/ozellik-secimi/data/secim_data.json` ve `tests/fixtures/boyut_sklearn.json` referansları; t-SNE altı kez koşar; CSV gerekmez.
- `make_degerlendirme_data.py`: Bölüm 6 sayfalarının (karmaşıklık matrisi, ROC/PR ve çapraz doğrulama) ortak verisini (`src/concepts/degerlendirme/data/degerlendirme.json`) ve `tests/fixtures/degerlendirme_sklearn.json` referanslarını üretir; Python, NumPy ve scikit-learn sürümleri dosyaya yazılır; ikinci çalıştırma fark üretmez; CSV gerekmez.
- `make_kmeans_data.py`: Bölüm 7 sayfalarının (K-Means döngüsü ve k sayısının seçimi) ortak Iris verisini ve scikit-learn referanslarını üretir (`src/concepts/kmeans/data/`); CSV gerekmez.
- `make_dbscan_data.py`: DBSCAN sayfasının iki hilal verisini ve scikit-learn referanslarını üretir (`src/concepts/dbscan/data/`); CSV gerekmez.
- `make_dendrogram_data.py`: Hiyerarşik kümeleme ve dendrogram sayfasının verisini ve SciPy/scikit-learn referanslarını üretir (`src/concepts/dendrogram/data/`); CSV gerekmez.

## Yeni kavram ekleme

1. İskeleti üretin: `npm run yeni-kavram -- <kimlik> "<Başlık>"`. Betik `<kimlik>/index.html`, `src/concepts/<kimlik>/` (`main.ts`, `scenario.ts`, `<kimlik>.css`), birim ve e2e test dosyalarını oluşturur ve `vite.config.ts` girdisini ekler.
2. `main.ts` içindeki `ConceptPage` (bkz. `src/core/shell.ts`) sahnesini, parametrelerini ve senaryosunu doldurun.
3. `src/concepts/registry.ts` içinde ilgili kaydı `hazir` durumuna çevirip `href` değerini verin.
