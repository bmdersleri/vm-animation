# Bölüm 10 — Gradyan artırma: artıklarla düzeltme, öğrenme oranı, erken durdurma, ağaç büyütme ve hiperparametre araması — Tasarım

- **Tarih:** 2026-10-24
- **Kaynak:** Öğretmen: "bittiyse bölüm 10 ile devam edelim"; soru sorulmaması kuralı Bölüm 9'dan
  sürer ("soruları atla, sen öner ve başla"). Kitabın `ch10_gradyan_artirma/content/final.md`
  bölümü (salt okunur).
- **Yetki:** Bütün tasarım kararları benimdir (aşağıda "Benim kararım"). Kararlar ledger'da
  `Ruling:` satırı olarak da durur ve iş sonunda öğretmene listelenir. Yayın (main'e push) için
  öğretmenin onayı ayrıca beklenir.
- **Önceki tasarımlar:** Bölüm 9 (`2026-10-23-bolum9-topluluk-design.md`); ortak görünüm
  kuralları ve iki sayfa kalıbı oradan devralınır.
- **Ön deneme (2026-10-24, scikit-learn 1.9.0, numpy 2.5.2):**
  - Kitabın `bolum10_kod01` elle gradyan artırması birebir çıktı: 5 adımda ortalama kare hata
    0,2952 → 0,2138 → 0,1587 → 0,1201 → 0,0933.
  - Aynı süreçten `RandomState(7)` ile 80 noktalık doğrulama kümesi: ν = 0,3, derinlik 2'de
    doğrulama hatası 34. ağaçta en düşük (0,0139), 200 ağaçta 0,0194; ν = 1,0'da en düşük 17.
    ağaçta (0,0158); ν = 0,05'te 184. ağaçta (0,0126). Eğitim hatası 200 ağaçta 0,0001.
  - İlk artıklara (y − ȳ) seviye-öncelikli derinlik 2 ağacı: eşikler 2,651; 0,616 ve 6,372;
    hata 0,162. Yaprak-öncelikli 4 yapraklı ağaç (`max_leaf_nodes=4`): eşikler 2,651; 6,372 ve
    9,021, derinlik 3, hata 0,113.
  - Kitabın `bolum10_kod04` verisi `GradientBoostingClassifier` ile (150 ağaç, derinlik 4):
    doğrulama AUC 0,930 / 0,964 / 0,969 / 0,970 / 0,963 (ν = 0,01 / 0,05 / 0,1 / 0,3 / 0,5);
    doğrulama log-kaybı ν = 0,3'te 91. ağaçta en düşük. Kitabın XGBoost sayıları 0,9261 /
    0,9625 / 0,9713 / 0,9711 / 0,9693; aynı ters U.
  - Kitabın `bolum10_kod05` verisi (800 gözlem) üzerinde derinlik 1–6 × 9 öğrenme oranı
    (0,01–1, log aralıklı), 100 ağaç, 3 katlı CV AUC yüzeyi: en kötü 0,793, en iyi 0,957; tepe
    derinlik 4–5, ν 0,3–1 bölgesinde.
  - Makinede `xgboost`, `lightgbm` ve `optuna` kurulu değil.

## Amaç ve kabul ölçütleri

Öğrenci üç şeyi kavramalı:

1. **Boosting ardışık düzeltmedir.** Sabit bir başlangıçtan (ortalama) başlanır; her sığ ağaç
   o ana kadarki toplam tahminin artığına uyar ve öğrenme oranıyla küçültülerek eklenir:
   F_m = F_{m−1} + ν·h_m. Artıklar adım adım küçülür, kitabın hata dizisi ekranda oluşur.
   Bagging'deki gibi bağımsız oylama değil, her ağaç bir öncekine bağlı.
2. **Öğrenme oranı ile ağaç sayısı birlikte ayarlanır; doğrulama eğrisi ne zaman duracağını
   söyler.** Küçük ν daha çok ağaç ister ama daha iyi bir dibe iner; büyük ν hızlı iner, sonra
   gürültüyü ezberler (eğitim hatası sıfıra giderken doğrulama hatası yükselir). Erken durdurma
   en iyi ağaç sayısını veriye bıraktırır.
3. **Ağacın nasıl büyüdüğü ve hangi ayarların deneneceği de bir seçimdir.** Seviye-öncelikli
   (XGBoost) her seviyeyi bütün açar; yaprak-öncelikli (LightGBM) en çok kazandıran yaprağı açar:
   aynı yaprak sayısında daha düşük kayıp, ama derin ve dengesiz ağaç (`num_leaves` <
   2^`max_depth`). Izgara araması sabit noktaları dener; sıralı arama önceki denemelerden
   öğrenip iyi bölgeye yoğunlaşır.

Kabul ölçütleri:

1. İki yeni sayfa yayında: `gradyan-artirma/` ("Gradyan artırma: artıklarla düzeltme", 10 adım)
   ve `boosting-ayarlari/` ("Boosting ayarları: öğrenme oranı, erken durdurma, arama", 10 adım);
   ikisi de Ders ve Laboratuvar modunda çalışır. Ana sayfada Bölüm 10'un iki kartı "hazır" olur:
   27 kavram, 24 hazır, 3 yakında.
2. Ekrandaki her model sayısı (artıklar, eşikler, hatalar, AUC'ler, durma noktaları, arama
   sonuçları) üreticinin scikit-learn ile yazdığı veriden gelir ya da tarayıcıda o veriden
   hesaplanır ve birim testinde üreticinin fixture'ıyla birebir doğrulanır. Kitabın sayıları
   üreticide doğrulanır; tutmazsa üretici durur.
3. Her güncelleme sayılarıyla da yazılır ("2 + 0,3 · 2 = 2,6", "34. ağaçta en düşük: 0,0139").
4. 1280×720'de Ders ve Lab adımlarında yazı yazının üstüne binmez, hiçbir şey kırpılmaz;
   900 px altında tek sütun, 390 px'te yatay taşma yok (`dar-ekran.spec.ts` hazır sayfaları
   kayıt defterinden otomatik kapsar).
5. `npm run check` yeşil; kontrolcü ekran görüntülerine kendisi bakar.

## Kararlar

| Konu | Karar | Kimin |
|---|---|---|
| Sayfa sayısı | İki sayfa: artık döngüsü + öğrenme oranı (sayfa 1); öğrenme oranı deneyi, erken durdurma, ağaç büyütme ve arama (sayfa 2) | Benim kararım (Bölüm 7–9'un iki sayfa kalıbı) |
| Kimlikler | `gradyan-artirma` ve `boosting-ayarlari`; kayıttaki `soon('boosting', 10, 'Boosting')` iki hazır kayıtla değişir | Benim kararım |
| Sayfa 1 verisi | Kitabın `bolum10_kod01` verisi (80 nokta, `RandomState(42)`, sin + N(0; 0,1)), ν = 0,3, derinlik 2, 5 ağaç, değiştirilmeden | Kitap |
| Doğrulama kümesi | Aynı süreçten 80 nokta, `RandomState(7)` | Benim kararım: kitabın kodunda doğrulama yok; ezberi göstermek için gerekli |
| Regresyon ağacı | Tek öznitelikli regresyon ağacı TS'de yazılır (kare hata, orta nokta eşikleri, derinlik sınırında önce-derinlik, yaprak sınırında önce-en-iyi büyüme); fixture'da sklearn `DecisionTreeRegressor` ile birebir doğrulanır | Benim kararım: Lab ν / derinlik / M'yi canlı değiştirir; 80 noktada eğitim anında |
| Sınıflandırma deneyleri | Kitabın verileri ve tohumları, ama model `GradientBoostingClassifier` (XGBoost yerine) | Benim kararım: `xgboost`/`lightgbm` üreticinin ortamında yok; sayılar kitabınkine çok yakın, örüntü aynı. "Kitapla farklar"da yazar |
| Öğrenme oranı eğrileri | ν ∈ {0,01; 0,05; 0,1; 0,3; 0,5; 1,0}, derinlik 4, 1–500 ağaç; her ağaçta eğitim ve doğrulama log-kaybı ile doğrulama AUC | Kitap verisi; eğriler benim eklemem |
| Erken durdurma | Doğrulama log-kaybı, sabır 50 (kitabın `early_stopping_rounds=50`); en iyi ağaç ve durma ağacı tarayıcıda eğriden hesaplanır | Kitap |
| Ağaç büyütme | Sayfa 1'in ilk artıkları (y − ȳ) üzerinde seviye-öncelikli ve yaprak-öncelikli ağaç; aynı yaprak sayısı | Benim kararım: tek boyutta bölünmeler eksende görünür |
| Arama uzayı | Kitabın `bolum10_kod05` verisi; derinlik 1–6 × ν 9 değer (0,01–1, log aralıklı), 100 ağaç, 3 katlı CV AUC; 54 hücrenin hepsi üreticide ölçülür | Benim kararım: kitabın 3 boyutlu ızgarası çizilebilsin diye 2 boyut |
| Sıralı arama | Optuna'nın TPE fikrinin sadeleştirilmiş, deterministik hâli (aşağıda); ekranda "Optuna'nın yaptığına benzer sıralı arama" | Benim kararım: Optuna kurulu değil; algoritma açık ve test edilebilir |
| Görünüm | Bölüm 9'un çizgi grafikleri (`LineChartLayer`), lacivert/yeşil/turuncu ν renkleri, sayfa 1'de iki panel (üst veri ve F, alt artıklar ve h) | Benim kararım |

## Kapsam dışı

- AdaBoost'un örnek ağırlıkları (yalnız bir cümle), stacking, CatBoost.
- XGBoost'un Hessian'ı ve L1/L2 cezası formülle (bir cümlede anılır), eksik değer yönü.
- Gerçek süre ölçümü ve kitabın XGBoost–LightGBM hız karşılaştırması (kitabın iki farklı
  ölçümü birbirini tutmuyor; bir cümlede "veri büyüdükçe histogram araması hızlanır").
- Sınıflandırmada log-kaybının gradyanı (artık = y − p) formülle; yalnız bir bilgi cümlesi.
- Dengesiz sınıf ve doğruluk tuzağı (Bölüm 11'in konusu; kitabın Hata 3'ü).
- Tarayıcıda sınıflandırıcı eğitimi; kitabın düzeltilmesi (çıktı yalnızca "Kitapla farklar").

## Ortak öğretim dili ve görünüm

Bölüm 9 kuralları aynen: metin boyutları yalnız `--fs-*` belirteçlerinden; SVG'lerde viewBox
yok; sayılar Türkçe ondalık virgülüyle (hatalar 4 ondalık, AUC 3 ondalık, eşikler 3 ondalık);
hesaplanan sayıdan sonra kesme işaretli ek yok ("34. ağaçta", "ağaç sayısı 34"); tarama bitince
taranan değer son değerinde kalır; `prefers-reduced-motion` altında son durum anında çizilir;
adım kartı Lab'de `labText` gösterir; etkileşimli sahne öğeleri yalnız Lab'de.

- Sahneler `src/core/plot/` parçalarını kullanır (`AxesLayer`, `LineChartLayer`, formül şeridi,
  etiket yerleştirici, biçimlendirme, geçişler). İki sayfanın da kullandığı yeni çizim parçası
  (ör. basamak fonksiyonu çizgisi, küçük ağaç şeması) `src/core/plot/`'a gider.
- İki sayfanın ortak verisi ve hesabı `src/concepts/boosting/` altında durur (Bölüm 9'daki
  `topluluk/` kalıbı).
- Renkler: veri noktaları gri-lacivert ●, doğrulama noktaları içi boş ○; toplam tahmin F lacivert
  kalın çizgi; artıklar turuncu dikey çizgiler; ağacın düzeltmesi h yeşil basamak; ν eğrileri
  sabit bir paletten (her eğrinin ucunda ν etiketi, renk tek taşıyıcı değil). Eğitim eğrisi düz,
  doğrulama eğrisi kesikli.

## Ortak veri ve hesap (`src/concepts/boosting/`)

- `data/boosting.json` (yalnız üretici yazar):
  - **regresyon verisi:** eğitim 80 nokta (x, y; 4 ondalık, model bu yuvarlanmış değerlerle
    eğitilir), doğrulama 80 nokta, ȳ;
  - **kitap döngüsü:** ν = 0,3, derinlik 2, 5 ağaç: her ağacın yapısı (eşik, sol, sağ, yaprak
    değeri), her adımın eğitim hatası (kitabın 5 sayısı);
  - **sınıflandırma eğrileri:** ν ∈ {0,01; 0,05; 0,1; 0,3; 0,5; 1,0} için 1–500 ağaçta eğitim
    log-kaybı, doğrulama log-kaybı, doğrulama AUC (4 ondalık); kitabın 5 değerinde 150 ağaçtaki
    doğrulama AUC'si ayrıca;
  - **arama yüzeyi:** 6 × 9 hücrenin CV AUC'si, derinlik ve ν değerleri.
- Saf TS fonksiyonları:
  - `fitRegTree(xs, rs, { maxDepth } | { maxLeaves })` → düğümler (eşik, sol, sağ, değer,
    derinlik) ve bölünme sırası (her bölünmenin kayıp azalışıyla); `predictReg(tree, x)`.
    sklearn kuralları: eşik ardışık iki farklı x'in orta noktası, `x <= eşik` sola, en büyük
    azalış, eşitlikte ilk bulunan; önce-en-iyi büyümede açılacak yaprak en büyük ağırlıklı
    azalışa göre.
  - `boost(train, val, nu, depth, M)` → her adımın ağacı, eğitim ve doğrulama ortalama kare
    hatası, F'nin çizim ızgarasındaki değerleri.
  - `earlyStop(valLoss, patience)` → `{ best, stop }` (en iyi ağaç sayısı; durma ağacı =
    best + patience, eğri daha kısaysa son ağaç).
  - `gridTrials(budget)` → ızgara aramasının denediği hücreler (adım bölümünde);
    `sequentialSearch(surface, budget, seed)` → sıralı aramanın hücre sırası.
  - Sıralı arama: hücre koordinatları u = derinlik dizini / 5, v = ν dizini / 8. İlk 3 deneme
    tohumlu bir 32 bitlik üreteçten (Python ve TS'de aynı, ör. mulberry32) seçilen farklı
    hücreler. Sonra her denemede denenmiş hücreler AUC'ye göre sıralanır; iyi küme = ilk
    max(1, ⌈0,25·n⌉), kötü küme = kalanlar; denenmemiş her hücre için puan = ortalama
    K(hücre, iyi) / (ortalama K(hücre, kötü) + 10⁻⁹), K Gauss çekirdeği (bant 0,2); en yüksek
    puanlı hücre denenir (eşitlikte küçük hücre dizini).
- Birim testleri: `fitRegTree` ve `boost` fixture'daki sklearn tahminleriyle birebir (kitap
  döngüsü, ν ∈ {0,05; 0,3; 1,0} × derinlik {1, 2, 3} × 200 ağaçta eğitim ve doğrulama hataları
  1e-9 içinde; seviye ve yaprak ağaçlarının eşikleri); `sequentialSearch` üreticideki Python
  eşiyle (tohum 0–4, bütçe 16) aynı sırayı verir; kitabın sayıları fixture'dan.
- Üretici: `scripts/make_boosting_data.py` (`--check` ile kayma denetimi; diğer üreticilerin
  kalıbı; iki kez çalışınca bayt bayt aynı). Kitabın 5 hata sayısını 4 ondalıkta doğrular;
  ν = 0,3, derinlik 2 doğrulama eğrisinin 200 ağaçtan önce bir dibi olduğunu; yaprak-öncelikli
  4 yapraklı ağacın hatasının seviye-öncelikliden küçük olduğunu; ν = 0,01'in 150 ağaçtaki
  AUC'sinin en düşük olduğunu; tutmazsa durur ve raporlar.

## Sayfa 1 — Gradyan artırma: artıklarla düzeltme (`gradyan-artirma/`)

### Öğrenme sonucu

Öğrenci sabit başlangıç tahminini, artığı, artığa uyan sığ ağacı ve küçültülmüş eklemeyi tek
tek izler; kitabın 5 adımlık hata dizisini ekranda oluşurken görür; eğitim hatası sıfıra
giderken doğrulama hatasının bir dipten sonra yükseldiğini; ν'nun dibin yerini ve derinliğini
nasıl değiştirdiğini; boosting'in bagging'den farkını (sıralı, sığ, yanlılığı azaltır) görür.

### Görünüm

İki panel üst üste, ortak x ekseni (0–10). **Üst panel:** eğitim noktaları ●, toplam tahmin F
(lacivert basamak çizgisi), istenirse gerçek sin eğrisi soluk. **Alt panel:** artıklar r (turuncu
nokta ve sıfır çizgisinden dikey çizgi), ağacın düzeltmesi h (yeşil basamak). Adım 7–9'da alt
panelin yerine hata – ağaç sayısı grafiği (eğitim düz, doğrulama kesikli; y ekseni log ölçek
olabilir, yapıcı karar verir). Panelin yanında ya da altında formül şeridi.

### Adımlar (Ders)

1. **Veri.** 80 nokta: x ∈ [0; 10], y = sin x + gürültü. "Tek bir sığ ağaç bu dalgayı ancak dört
   basamakla kabaca çizer. Boosting basamakları üst üste koyar."
2. **Başlangıç: ortalama.** F₀ = ȳ (yatay çizgi); ortalama kare hata (veriden). "İlk model
   hiçbir şey bilmez: herkese ortalamayı söyler."
3. **Artık.** r = y − F₀; alt panelde 80 artık. "Artık, modelin her noktada ne kadar
   yanıldığıdır; bir sonraki ağaç bunu öğrenecek."
4. **Artığa ağaç.** Derinlik 2 ağacı artıklara uyar: dört basamak, eşikler (veriden: 0,616;
   2,651; 6,372). Ağaç y'yi değil artığı tahmin eder. Altında kitabın satırı:
   `sigAgac.fit(girisDegerleri, artikHata)`.
5. **Küçük adım.** F₁ = F₀ + 0,3 · h₁: üst paneldeki çizgi düzeltmenin yalnız %30'u kadar
   oynar; hata 0,2952. Formül şeridinde kitabın elle örneği: gerçek [3; 5], tahmin [2; 4],
   düzeltme [2; 0], ν = 0,1 → [2 + 0,1 · 2; 4 + 0,1 · 0] = [2,2; 4].
6. **Tekrar.** Tarama m = 2 → 5: her adımda yeni artıklar, yeni ağaç, yeni ekleme; yanda kitabın
   tablosu satır satır dolar (0,2138; 0,1587; 0,1201; 0,0933). "Beşinci adımda hata birincinin
   yaklaşık üçte biri" (oran veriden).
7. **Ne zaman durmalı?** Tarama M = 1 → 200: eğitim hatası sıfıra iner (200 ağaçta 0,0001),
   doğrulama hatası 34. ağaçta en düşük (0,0139), sonra yükselir (sayılar veriden). Dip
   noktası işaretli.
8. **Öğrenme oranı.** Üç doğrulama eğrisi: ν = 1,0 / 0,3 / 0,05; her birinin dibi işaretli
   (17. / 34. / 184. ağaç; 0,0158 / 0,0139 / 0,0126). "Küçük adım daha çok ağaç ister ama daha
   iyi bir dibe iner. ν ile ağaç sayısı birlikte ayarlanır."
9. **Ezber.** Üst panelde iki F: 34 ağaç (yumuşak) ve 200 ağaç (her gürültü noktasından geçen
   zikzak); doğrulama noktaları ○ görünür. "Eğitim hatası 0,0001, ama yeni noktada daha kötü."
10. **Bagging ile karşılaştır.** İki satırlı şema: bagging (bağımsız, derin ağaçlar → oylama /
    ortalama; varyansı azaltır) ve boosting (sığ ağaçlar zinciri, her biri öncekinin artığına;
    yanlılığı azaltır, sırayla kurulur). Kitabın tablosundan dört satır (sıra, odaklandığı hata,
    tipik derinlik, aşırı öğrenme eğilimi). Ders sonu bağlantıları: Boosting ayarları sayfasına
    ve Bölüm 9 bagging sayfasına.

(Sayılar ön denemenin değerleridir; ekrandaki her sayı üreticiden ya da fixture'la doğrulanan
TS hesabından okunur.)

### Laboratuvar

- **Adım 1–3:** "Doğrulama noktalarını göster" anahtarı.
- **Adım 4:** ağaç derinliği kaydırıcısı 1–3 (ilk ağacın basamakları ve eşikleri canlı).
- **Adım 5–6:** ν kaydırıcısı (0,01; 0,02; 0,05; 0,1; 0,2; 0,3; 0,5; 1,0) ve adım m kaydırıcısı
  1–20; formül şeridi ve hata canlı.
- **Adım 7–9:** ν, derinlik 1–3 ve ağaç sayısı M 1–200; eğri üstünde M noktası, eğitim ve
  doğrulama hatası, doğrulamanın dibi. Adım 9'da üst panelde M ağaçlık F.
- **Adım 10:** kontrol yok.
- Adıma göre yalnızca o adımın kontrolleri görünür. Tarayıcı her değişiklikte `boost`'u yeniden
  çalıştırır.

## Sayfa 2 — Boosting ayarları: öğrenme oranı, erken durdurma, arama (`boosting-ayarlari/`)

### Öğrenme sonucu

Öğrenci kitabın öğrenme oranı deneyindeki ters U'yu, bunun nedenini (küçük ν 150 ağaçta
yakınsamamış, büyük ν ezberlemiş) eğrilerden okur; ν düşünce ağaç sayısının artması gerektiğini;
eğitim ile doğrulama kaybı arasındaki açığın aşırı öğrenme işareti olduğunu; erken durdurmanın
en iyi ağaç sayısını nasıl bulduğunu; seviye ve yaprak öncelikli büyümenin farkını ve yaprak
sayısı sınırının neden gerektiğini; ızgara ile sıralı aramanın aynı bütçeyi nasıl farklı
harcadığını görür.

### Görünüm

Adım 1'de **nokta grafiği**: x log ölçekte ν, y doğrulama AUC, noktalar birleşik. Adım 2–5'te
**eğri sahnesi** (`LineChartLayer`): x ağaç sayısı 1–500, y log-kaybı; ν eğrileri ya da tek ν'nun
eğitim/doğrulama çifti; dikey işaretler (150 ağaç, en iyi ağaç, durma ağacı). Adım 6–8'de
**büyüme sahnesi**: solda küçük ağaç şeması (düğümler bölünme sırası numarasıyla), sağda
artıkların saçılımı ve ağacın basamakları (bölünme eşikleri dikey kesikli çizgiler); adım 8'de
yaprak sayısına göre eğitim ve doğrulama hatası eğrisi. Adım 9–10'da **arama sahnesi**: 6 × 9
ısı haritası (satır derinlik, sütun ν), denenmemiş hücreler gri, denenen hücre AUC tonuyla ve
deneme sırası numarasıyla; en iyi deneme çerçeveli.

### Adımlar (Ders)

1. **Kitabın deneyi.** 3000 gözlem, 150 ağaç, derinlik 4; ν = 0,01 → 0,5: doğrulama AUC 0,930 →
   0,970 → 0,963 (veriden): ters U. "Neden ortada en iyi?" Altında kitabın satırı
   `XGBClassifier(n_estimators=150, max_depth=4, learning_rate=oran)` ve "bu sayfada aynı deney
   scikit-learn'ün `GradientBoostingClassifier`'ıyla".
2. **Eğrilerin içi.** Beş ν'nun doğrulama log-kaybı ağaç sayısına göre; tarama 1 → 150; 150'de
   dikey çizgi. "0,01 hâlâ iniyor: yakınsamadı. 0,5 çoktan dibi geçti."
3. **ν'yu düşürünce ağaç ekle.** ν = 0,01'in eğrisi 500 ağaca uzar; AUC 150'de ve 500'de (veriden).
   Kitabın uyarısı: "Öğrenme oranını düşürüp ağaç sayısını sabit bırakmak yetersiz öğrenmeye
   yol açar."
4. **Ezber açığı.** Büyük ν (1,0): eğitim log-kaybı sıfıra iner, doğrulama kaybı dipten sonra
   yükselir; aradaki açık taralı. Kitabın Hata 1'i: "eğitimde neredeyse mükemmel, doğrulamada
   düşüş".
5. **Erken durdurma.** ν = 0,3, sabır 50: doğrulama kaybı 91. ağaçta en düşük; 50 ağaç
   iyileşme yok → 141. ağaçta dur (sayılar veriden). `early_stopping_rounds=50` satırı.
   "Durmaya doğrulama kümesi karar verir; test kümesi en sona saklanır."
6. **Seviye-öncelikli büyüme (XGBoost).** Sayfa 1'in ilk artıklarına derinlik 2 ağacı: önce kök
   (2,651), sonra ikinci seviyenin iki düğümü birlikte (0,616 ve 6,372); dört yaprak, dengeli;
   hata 0,162 (veriden).
7. **Yaprak-öncelikli büyüme (LightGBM).** Aynı dört yaprak: her adımda en çok kazandıran yaprak
   açılır (2,651 → 6,372 → 9,021; her bölünmenin kayıp azalışı yazılı); ağaç dengesiz, derinlik
   3; hata 0,113. "Aynı yaprak sayısında daha düşük kayıp, ama daha derin."
8. **Yaprak sınırı.** Yaprak-öncelikli tek ağaç, yaprak sayısı 4 → 64: derinlik 3 → 12; eğitim
   hatası sıfıra iner, doğrulama hatası bir yerden sonra yükselir (veriden). Kitabın kuralı:
   `num_leaves` < 2^`max_depth` (`max_depth=5` iken `num_leaves=24`).
9. **Izgara araması.** Kitabın 800 gözlemlik verisi; derinlik × ν uzayı, 100 ağaç, 3 katlı CV
   AUC. Izgara 8 deneme: derinlik {3, 5} × ν {0,01; 0,032; 0,1; 0,316}; denenen hücreler sırayla
   boyanır; en iyisi (veriden). "Izgara nereye bakacağını önceden sabitler."
10. **Sıralı arama.** Aynı bütçe, 8 deneme: ilk 3 rastgele, sonra her deneme o ana kadarki iyi
    sonuçların yakınına (deneme sırası numaralı). İki en iyi değer yan yana (veriden; hangisinin
    büyük olduğu metne veriden girer). Son olarak bütün yüzey soluk açılır: "Bunu gerçek bir
    aramada bilemezdiniz; burada sonradan 54 hücrenin hepsini ölçtük." Ders sonu bağlantıları:
    gradyan artırma sayfasına ve Bölüm 6 çapraz doğrulama sayfasına.

(Sayılar ön denemenin değerleridir; ekrandaki her sayı üreticiden okunur.)

### Laboratuvar

- **Adım 1–3:** ν seçimi (6 değer, adım 1'de 1,0 da eklenir) ve ağaç sayısı kaydırıcısı 1–500;
  eğride nokta, doğrulama AUC ve log-kaybı.
- **Adım 4:** ν seçimi; eğitim–doğrulama çifti o ν için.
- **Adım 5:** ν seçimi ve sabır kaydırıcısı 10–100; en iyi ve durma ağacı canlı.
- **Adım 6–7:** derinlik kaydırıcısı 1–3: seviye ağacı 2^d yaprak, yaprak ağacı aynı yaprak
  sayısı; ağaç şeması ve hata canlı (TS `fitRegTree`).
- **Adım 8:** yaprak sayısı kaydırıcısı 2–64; şemanın yerine derinlik ve iki hata.
- **Adım 9–10:** bütçe kaydırıcısı 4–16, "yeni başlangıç" düğmesi (sıralı aramanın tohumu),
  "bütün yüzeyi göster" anahtarı.
- Adıma göre yalnızca o adımın kontrolleri görünür.

## Kitapla farklar (kitap düzeltmesi için liste)

- Kitabın sınıflandırma deneyleri XGBoost/LightGBM/Optuna ile; sayfa aynı verileri ve tohumları
  scikit-learn'ün `GradientBoostingClassifier`'ıyla ve sadeleştirilmiş bir sıralı aramayla
  ölçer. Sayılar birkaç binde bir farklı, örüntü aynı.
- Kitabın `bolum10_kod03` çıktısında LightGBM'in süresi kod yorumunda 0,17 s, çıktı bloğunda
  2,46 s; ikisi birbirini tutmuyor, metin de "LightGBM daha hızlı" diyor.
- Kitabın Hata 2'si "2^5 = 32 yaprak sınırı `num_leaves` tarafından aşılmadan geçerli olmaz"
  cümlesi anlaşılmıyor; sayfa kuralı yaprak-öncelikli ağacın derinliğiyle gösterir.
- Kitabın kodunda doğrulama yok; sayfa ezberi göstermek için aynı süreçten bir doğrulama kümesi
  ekler.
- Kitabın ızgarası 3 boyutlu (2 × 2 × 2); sayfa çizilebilsin diye 2 boyutlu (derinlik × ν,
  100 ağaç) bir uzay kullanır.

## Arayüzler

- Her sayfa mevcut `ConceptPage<Params>` sözleşmesini sağlar; `StepPlayer` adım/tarama
  sözleşmesi değişmez; adım indeksleri `stepIndex` ile adım kimliklerinden türetilir; Lab metni
  `Step.labText`.
- Kimlikler ve yollar: `gradyan-artirma` → `gradyan-artirma/`, başlık "Gradyan artırma:
  artıklarla düzeltme"; `boosting-ayarlari` → `boosting-ayarlari/`, başlık "Boosting ayarları:
  öğrenme oranı, erken durdurma, arama". Kayıt defterinde `soon('boosting', 10, 'Boosting')` iki
  hazır kayıtla değişir (sıra: gradyan-artirma, boosting-ayarlari).
- Parametre adları (öneri, yapıcıya bırakılır): sayfa 1 `{ nu: number; depth: number; m: number;
  trees: number; showVal: boolean }`; sayfa 2 `{ lr: number; trees: number; patience: number;
  depth: number; leaves: number; budget: number; seed: number; showSurface: boolean }`.

## Hata durumları

- Doğrulama eğrisinin dibi son ağaçtaysa: "Henüz dip yok: daha çok ağaç dene" (en iyi = son).
- Erken durdurmada sabır eğrinin sonunu aşarsa: "500 ağaca kadar durmadı".
- Regresyon ağacında bölünecek iki farklı x kalmamışsa düğüm yaprak kalır; istenen yaprak
  sayısına ulaşılamazsa gerçek yaprak sayısı yazılır.
- Sıralı arama bütçesi denenmemiş hücre sayısını aşamaz (54 hücre; bütçe en çok 16).
- Hiçbir durumda NaN / Infinity ekrana basılmaz.

## Doğrulama

- Birim: ortak hesap fixture'a karşı (yukarıda); senaryo adım kimlikleri, parametreleri ve
  metinlerdeki sayıların veriden geldiği; sahne testleri (her adımın anahtar DOM öğesi: eğitim
  noktaları, F çizgisi, artık çizgileri, h basamakları ve eşik etiketleri, formül şeridi, kitap
  tablosu satırları, hata eğrileri ve dip işaretleri, ν eğri etiketleri, iki satırlı
  karşılaştırma şeması; AUC noktaları, 150 / en iyi / durma işaretleri, ezber açığı tarası, ağaç
  şeması düğümleri ve sıra numaraları, eşik çizgileri, ısı haritası hücreleri ve deneme
  numaraları).
- e2e (yalın): her sayfa için Ders anahtar adımları (sayfa 1: 3, 5, 7, 9; sayfa 2: 1, 5, 7, 10)
  ve birer Lab etkileşimi (ν + M kaydır; derinlik kaydır + bütçe kaydır) ekran görüntüsü
  temeliyle; etiket çakışması ve sahne dışına taşma kontrolleri.
- Performans: sayfa 1 adım 7 M sürükleme (200 ağaçlık `boost` yeniden çalışır) ve sayfa 2 adım 8
  yaprak sayısı sürükleme p95 ≤ 25 ms (bölüm sonunda bir kez).
- Kapanış: `npm run check` çıkış 0; kontrolcü ekran görüntülerine kendisi bakar.

## Yapıcıya bırakılanlar

- Dosya bölünmesi, parametre adları, panel oranları, hata grafiğinin y ölçeği (doğrusal ya da
  log), ağaç şemasının çizimi (karar ağacı sayfasının şeması uyarlanabilir ya da yeni küçük bir
  çekirdek parça), ısı haritası ton kademeleri, tarama hızları, ν paleti, 32 bitlik üretecin
  seçimi (Python ve TS'de aynı sonucu vermesi şartıyla).
