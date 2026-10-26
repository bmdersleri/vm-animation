# Bölüm 13 — Açıklanabilir yapay zekâ: SHAP ve LIME — Tasarım

- **Tarih:** 2026-10-25
- **Kaynak:** Öğretmen: "önerin onaylandı" (Bölüm 13'e soru sormadan başlama önerisi) ve "push için
  onay bekleme işlemleri bitirince merge + push". Kitabın
  `ch13_aciklanabilir_yapay_zeka_xai/content/final.md` bölümü (salt okunur).
- **Yetki:** Bütün tasarım kararları benimdir (aşağıda "Benim kararım"). Kararlar ledger'da
  `Ruling:` satırı olarak da durur ve iş sonunda öğretmene listelenir. Bu bölüm için yayın onayı
  verildi: `npm run check` yeşilse iş sonunda main'e merge + push.
- **Önceki tasarımlar:** Bölüm 12 (`2026-10-25-bolum12-metin-madenciligi-design.md`); ortak
  görünüm kuralları ve iki sayfa kalıbı oradan devralınır. Random Forest Bölüm 9'da
  (`random-forest/`), özellik önemi orada ve Bölüm 4'te işlendi; burada yalnız açıklama açısından
  kullanılır.
- **Ön deneme (2026-10-25, scikit-learn 1.9.0, numpy 2.5.2, kitabın kodları aynen):**
  - Veri: `make_classification(n_samples=400, n_features=3, n_informative=3, n_redundant=0,
    n_clusters_per_class=1, weights=[0.75, 0.25], random_state=42)`, kitabın ölçek dönüşümleri;
    301 / 99 sınıf; katmanlı 75/25 bölme (`random_state=42`) → 300 eğitim, 100 test (25 ayrılan).
    `RandomForestClassifier(n_estimators=200, random_state=42)`; test doğruluğu 0,94.
  - `bolum13_kod01`: test kümesinin ilk müşterisi (satır 301: tenure 51, MonthlyCharges 51,06,
    TotalCharges 2366,05) için p(ayrılma) = 0,945 — kitapla aynı.
  - `bolum13_kod02`: `feature_importances_` 0,546 / 0,231 / 0,223 — kitapla aynı.
  - `bolum13_kod03`: ortalama |SHAP| 0,221060 / 0,064580 / 0,035807 — kitapla aynı.
  - `bolum13_kod04`: müşterinin SHAP katkıları 0,567064 / 0,092737 / 0,039599, temel değer
    0,2456; 0,2456 + 0,6994 = 0,945 (toplama tam tutar) — kitapla aynı.
  - SHAP hesabı kütüphanesiz: ağaç başına "yol bağımlı" koşullu beklenti (bilinmeyen özellikte iki
    dal, düğümün `weighted_n_node_samples` ağırlığıyla ortalanır), 3 özelliğin 8 alt kümesi,
    Shapley formülü. Geçici bir sanal ortamda kurulan `shap 0.54.1`'in `TreeExplainer`'ıyla 100
    test müşterisinde aynı (1e-12).
  - `bolum13_kod05`: LIME (tohum 42) `tenure > 41.25: 0.540`, `39.87 < MonthlyCharges <= 51.59:
    0.074`, `2294.79 < TotalCharges <= 2474.31: -0.023` — kitapla aynı. LIME kütüphanesiz bir
    ikizle yeniden üretildi (kartil bölmesi, bölme sıklığıyla seçim, bölme içinde kesik normal
    `scipy.stats.truncnorm`, ikili "aynı bölmede mi" gösterimi, uzaklık = farklı bölme sayısının
    karekökü, çekirdek √exp(−d² / w²), w = 0,75 · √3, `Ridge(alpha=1)`); geçici ortamdaki
    `lime`'la tohum 42, 0, 1, 7'de 1e-15 içinde aynı. Kesişim 0,146; vekilin bu müşteri için
    tahmini 0,737 (model 0,945); ağırlıklı R² 0,693.
  - Tohum değişince LIME katsayısı (tenure) 11 tohumda (42 ve 0–9) 0,525–0,551 arasında oynar
    (5000 örnek), 50 örnekle 0,404–0,554 (kitap v0.2 `bolum13_kod09` ile aynı; sayfa veriden okur).
  - 100 test müşterisinde SHAP ile LIME'ın (tohum 42) en etkili özelliği 24 müşteride farklı.
    Örnek: satır 77 (test sırası 12): p = 0,055; SHAP tenure +0,200, MonthlyCharges −0,273,
    TotalCharges −0,118; LIME tenure +0,472 (en etkili), vekilin tahmini 0,602.
  - Etkileşim: satır 77'de v({tenure}) = 0,734 ama v({tenure, MonthlyCharges}) = 0,314; tenure
    ilk sırada eklenirse +0,489, son sırada −0,053 katar.

## Amaç ve kabul ölçütleri

Öğrenci dört şeyi kavramalı:

1. **Doğruluk açıklama değildir.** Kara kutu modelin olasılığı "neden?" sorusunu yanıtlamaz;
   genel özellik önemi yön ve kişi bilgisi vermez.
2. **Shapley değeri adil paylaşımdır.** Özellikler oyuncu; bir özellik kümesinin "değeri" o
   özellikler bilindiğinde modelin beklenen tahminidir. Bir özelliğin katkısı, bütün ekleniş
   sıralarındaki marjinal katkılarının ortalamasıdır; katkılar temel değerden tahmine tam toplanır.
3. **Yerel ve global açıklama farklı sorulardır.** Kuvvet grafiği tek müşteriyi, ortalama |SHAP|
   ve özet grafiği bütün test kümesini anlatır; global sıralama tek müşteriye aktarılamaz.
4. **LIME bir vekildir.** Komşuluk örneklenir, kara kutuya sorulur, yakınlığa göre tartılır,
   basit doğrusal model uydurulur; kural vekilin kuralıdır, modelin değil. Örnekleme ve çekirdek
   genişliği sonucu değiştirir; SHAP ile uyuşmazlık bir denetim işaretidir; açıklama nedensellik
   kanıtı değildir.

Kabul ölçütleri:

1. İki yeni sayfa yayında: `shap-degerleri/` ("SHAP: Shapley değerleriyle katkı", 10 adım) ve
   `lime-yerel/` ("LIME: yerel vekil model ve SHAP ile karşılaştırma", 10 adım); ikisi de Ders ve
   Laboratuvar modunda çalışır. Ana sayfada Bölüm 13'ün iki kartı "hazır" olur: 30 kavram,
   30 hazır, 0 yakında.
2. Ekrandaki her model sayısı (olasılıklar, önemler, koalisyon değerleri, SHAP katkıları, temel
   değer, bölme sınırları, örnek sayımları, çekirdek ağırlıkları, LIME katsayıları, kesişim, R²)
   üreticinin scikit-learn / scipy ile yazdığı veriden gelir ya da tarayıcıda o veriden hesaplanır
   ve birim testinde üreticinin fixture'ıyla doğrulanır. Kitabın tutan sayıları (0,945;
   0,546 / 0,231 / 0,223; 0,221 / 0,065 / 0,036; 0,567 / 0,093 / 0,040; 0,540 / 0,074 / −0,023)
   üreticide denetlenir; tutmazsa üretici durur.
3. Her hesap sayılarıyla da yazılır ("φ = ⅓ · 0,481 + ⅙ · 0,589 + …", "0,246 + 0,567 + 0,093 +
   0,040 = 0,945", "w = √exp(−1 / 1,688) = 0,744").
4. 1280×720'de Ders ve Lab adımlarında yazı yazının üstüne binmez, hiçbir şey kırpılmaz;
   900 px altında tek sütun, 390 px'te yatay taşma yok ve sahne oynatıcı çubuğunun altında
   kalmaz (`dar-ekran.spec.ts` hazır sayfaları kayıt defterinden otomatik kapsar).
5. `npm run check` yeşil; kontrolcü ekran görüntülerine kendisi bakar.

## Kararlar

| Konu | Karar | Kimin |
|---|---|---|
| Sayfa sayısı | İki sayfa: SHAP (sayfa 1); LIME ve iki yöntemin karşılaştırması, hata ayıklama (sayfa 2) | Benim kararım (Bölüm 7–12'nin iki sayfa kalıbı) |
| Kimlikler | `shap-degerleri` ve `lime-yerel`; kayıttaki `soon('shap', 13, 'SHAP')` iki hazır kayıtla değişir | Benim kararım |
| Veri | Kitabın verisi ve modeli aynen (400 sentetik müşteri, 3 özellik, 200 ağaç); özellik adları ekranda kitaptaki gibi İngilizce (`tenure`, `MonthlyCharges`, `TotalCharges`), kod yazı tipinde | Kitap |
| SHAP hesabı | Üretici kütüphanesiz hesaplar (yukarıdaki ön deneme); shap paketi gerekmez. Tarayıcı ormanı taşımaz: her test müşterisi için 8 koalisyon değeri veride; Shapley değerleri, sıralamalar ve marjinal katkılar tarayıcıda bu 8 değerden hesaplanır (fixture'la 1e-12) | Benim kararım: 14 200 düğümlük orman sayfaya ağır; 3 özellikte 8 değer bütün hesabı taşır |
| LIME hesabı | Üretici, LIME'ı kütüphanesiz ikizle hesaplar (yalnız numpy + scipy + sklearn; `scripts/requirements.txt` değişmez). İkili gösterimde yalnız 8 desen olduğundan her çalıştırma 8 desen özetine iner (örnek sayısı, ortalama p, desen içi kareler toplamı); ağırlıklı Ridge bu özetten tam çözülür. Tarayıcı Ridge'i bu özetten canlı çözer (çekirdek genişliği kaydırıcısı), fixture'la 1e-9 | Benim kararım |
| LIME çalıştırma ızgarası | 4 hazır müşteri (kitabın satır 301'i; satır 77 "uyuşmazlık"; satır 217 "orta risk, MonthlyCharges baskın"; satır 176 "düşük risk") × tohum {42, 0–9} × örnek sayısı {50, 100, 500, 1000, 5000}; ayrıca 100 test müşterisinin hepsinde tohum 42, 5000 örnek | Benim kararım |
| Komşuluk bulutu | Her hazır müşteri için tohum 42 / 5000 örnek çalıştırmasının ilk 500 örneği (değerler, desen, p) veride; bulut yalnız bu çalıştırmayı çizer | Benim kararım: bulutu bütün ızgara için saklamak veriyi megabaytlara çıkarır |
| Renkler | Katkı yönü: ayrılma yönüne (pozitif) turuncu, kalma yönüne (negatif) mavi (kitabın Şekil 13.2'si). Özet grafiğinde özellik değeri: düşük mavi → yüksek kırmızı-pembe (kitabın Şekil 13.1'i); turuncu yalnız katkı yönüne ayrılır. Lacivert arayüz mürekkebi | Benim kararım |
| Ölçek | SHAP katkıları bu modelde olasılık ölçeğindedir (Random Forest `predict_proba`); 3 ondalıkla yazılır, yüzde puan olarak değil | Benim kararım (kitabın uyarısı XGBoost'un log-odds çıktısı için geçerli; adım 10 kartı söyler) |
| Ortak parçalar | Çubuklar `HBarsLayer`, eksenler `AxesLayer`, sayı doğrusu `NumberLineLayer`, kod paneli `core/plot/code-panel.ts`, formül şeridi, `dodge` (özet grafiği yığılması). Yeni ortak parça yalnız ikinci sayfa da kullanırsa `src/core/plot/`'a girer (kuvvet / şelale çubuğu iki sayfada da kullanılır → `src/core/plot/waterfall.ts`) | AGENTS.md ortak parça kuralı |

## Kapsam dışı

- XGBoost / log-odds açıklaması, KernelSHAP, arka plan kümesi seçimi, SHAP etkileşim değerleri,
  kısmi bağımlılık grafiği (yalnız adım 10 kartlarında birer cümle).
- Tarayıcıda orman, tarayıcıda LIME örneklemesi, kullanıcının elle girdiği müşteri değerleri
  ("ya şöyle olsaydı" kaydırıcıları).
- Kitabın düzeltilmesi (yalnız "Kitapla farklar").

## Ortak öğretim dili ve görünüm

Bölüm 9–12 kuralları aynen: metin boyutları yalnız `--fs-*` belirteçlerinden; SVG'lerde viewBox
yok; sayılar Türkçe ondalık virgülüyle (olasılık, katkı, katsayı, ağırlık 3 ondalık; önem 3
ondalık; R² 3 ondalık; doğruluk yüzde 1 ondalık; özellik değerleri kitaptaki gibi: tenure tam
sayı, ücretler 2 ondalık); hesaplanan sayıdan sonra kesme işaretli ek yok ("100 müşteri",
"8 koalisyon"); tarama bitince taranan değer son değerinde kalır; `prefers-reduced-motion`
altında son durum anında çizilir; adım kartı Lab'de `labText` gösterir; etkileşimli sahne öğeleri
yalnız Lab'de. Müşteriler ekranda "müşteri 301" (veri satırı numarası) diye anılır.

- İki sayfanın ortak verisi ve hesabı `src/concepts/xai/` altında (Bölüm 10–12 kalıbı).
- Sınıf adları ekranda: "ayrılır" (1) ve "kalır" (0); olasılık "p(ayrılma)".

## Ortak veri ve hesap (`src/concepts/xai/`)

- `data/xai.json` (yalnız üretici yazar):
  - **model:** özellik adları, eğitim / test boyutları ve sınıf sayımları, test doğruluğu,
    `feature_importances_`, temel değer (φ₀);
  - **test müşterileri (100):** veri satırı numarası, üç değer, etiket, p, SHAP katkıları, 8
    koalisyon değeri (anahtar: özellik bit maskesi 0–7, bit 0 tenure, bit 1 MonthlyCharges, bit 2
    TotalCharges);
  - **global:** ortalama |SHAP| (3 özellik);
  - **LIME bölmeleri:** her özelliğin eğitim kartilleri (3 sınır), bölme adları (lime'ın
    biçiminde, ör. `tenure > 41.25`), bölme başına eğitim sıklığı;
  - **LIME çalıştırmaları:** hazır müşteri × tohum × örnek sayısı için 8 desen özeti (desen bit
    maskesi, örnek sayısı, ortalama p, desen içi kareler toplamı) ve varsayılan çekirdekte
    sklearn `Ridge` sonucu (katsayılar, kesişim, vekil tahmini, ağırlıklı R²); 100 test
    müşterisi için tohum 42 / 5000 örnek sonuçları (aynı alanlar);
  - **komşuluk bulutu:** hazır müşteri başına 500 örnek (üç değer, desen, p);
  - **kitap:** kitabın düzeltilmiş hata ayıklama kodunun `n_estimators=100` modelinde müşteri 301
    için p (kitapla farklar listesi için).
- Saf TS fonksiyonları:
  - `coalitionValue(v, mask)`, `marginals(v, order)` → sıradaki her özelliğin eklenişinde değer
    farkı; `orderings()` → 6 sıralama; `shapley(v)` → φ (formülle) ve `shapleyByOrder(v)` (6
    sıralamanın ortalamasıyla) — ikisi aynı;
  - `shapleyWeight(size, n)` = size! (n − size − 1)! / n!;
  - `kernelWeight(d, width)` = √exp(−d² / width²); `patternDistance(mask)` = √(3 − bit sayısı);
  - `limeFit(patterns, width, alpha = 1)` → `{ coef, intercept, localPred, score }` (ağırlıklı
    Ridge, kesişim cezasız, 3 × 3 kapalı çözüm; ağırlıklı R² desen içi kareler toplamıyla).
- Birim testleri: `shapley` 100 müşteride fixture'daki SHAP değerleriyle 1e-12 içinde; iki yol
  aynı; toplama özelliği (φ₀ + Σφ = p) 1e-12; `limeFit` hazır müşteri çalıştırmalarında sklearn
  sonucuyla varsayılan genişlikte ve fixture'daki iki ek genişlikte (0,5 ve 3,0) 1e-9 içinde.
- Üretici: `scripts/make_xai_data.py` (`--check` ile kayma denetimi; diğer üreticilerin kalıbı;
  iki kez çalışınca bayt bayt aynı). Denetimler: kitabın sayıları (yukarıda); SHAP toplama
  özelliği her müşteride 1e-12; desen özetinden çözülen Ridge, 5000 örnekle sklearn `Ridge`'in
  sonucuyla 1e-9; tohum 42'nin müşteri 301 katsayıları 0,540 / 0,074 / −0,023 (3 ondalık);
  hazır müşteri 77'de SHAP ile LIME'ın en etkili özelliği farklı; tutmazsa durur ve raporlar.
  Fixture: `tests/fixtures/xai_shap_lime.json` (100 müşterinin SHAP'ı ve koalisyonları, hazır
  çalıştırmaların sklearn Ridge sonuçları üç genişlikte).

## Sayfa 1 — SHAP: Shapley değerleriyle katkı (`shap-degerleri/`)

### Öğrenme sonucu

Öğrenci kara kutu bir modelin tek bir olasılığının neden açıklama istediğini görür; genel önemin
yön vermediğini fark eder; Shapley değerini koalisyon değerlerinden, sıralamaların marjinal
katkılarını ortalayarak sayılarıyla hesaplar; katkıların temel değerden tahmine tam toplandığını
şelale ve kuvvet grafiğinde izler; aynı katkıları bütün test kümesinde özetleyerek global
açıklamaya geçer ve global sıralamanın tek müşteriye aktarılamadığını görür.

### Görünüm

Adım 1–2'de **müşteri kartı** (üç değer, p çubuğu) ve önem çubukları (`HBarsLayer`). Adım 3–5'te
**koalisyon kafesi**: 8 alt küme dört katta (∅; tek; ikili; üçü), her düğümde v(S); kenarlar bir
özelliğin eklenişi; adım 5'te yanında **sıralama tablosu** (6 satır × 3 özellik). Adım 6–7'de
**şelale / kuvvet çubuğu** (`core/plot/waterfall.ts`). Adım 8'de iki çubuk grubu, adım 9'da
**özet grafiği** (3 satır, 100 nokta, `dodge` ile yığılmış), adım 10'da **kartlar**.

### Adımlar (Ders)

1. **Kara kutu.** Müşteri 301 (tenure 51, MonthlyCharges 51,06, TotalCharges 2366,05): 200 ağaçlı
   orman p(ayrılma) = 0,945 der (veriden); test doğruluğu %94,0. Kitabın kod01 satırları şeritte.
   "Tahmin var; gerekçe yok."
2. **Genel önem yön vermez.** `feature_importances_` 0,546 / 0,231 / 0,223 (veriden); "Model
   tenure'u çok kullanıyor; ama tenure bu müşteride tahmini artırdı mı, azalttı mı?"
3. **Koalisyonlar.** Kafesin 8 düğümü sırayla dolar: v(∅) = 0,246 temel değer (ağaçların kök
   düğümlerindeki ayrılma oranının ortalaması), v({tenure}) = 0,726 … v(hepsi) = 0,945 (veriden). Şerit: "v(S): yalnız
   S'deki özellikler bilinirken ormanın beklenen tahmini; bilinmeyen özellikte ağaç iki dala da
   gider, eğitim örneği sayısıyla ağırlıklı ortalanır."
4. **Bir sıralamada marjinal katkı.** tenure → MonthlyCharges → TotalCharges yolu kafeste vurgulu:
   +0,481, +0,155, +0,064 (veriden); toplam 0,699 = 0,945 − 0,246. "Başka bir sırada tenure'un
   katkısı farklıdır": TotalCharges → MonthlyCharges → tenure sırasında +0,663.
5. **Altı sıralamanın ortalaması.** Tablo 6 satır dolar (tarama); her sütunun ortalaması φ:
   0,567 / 0,093 / 0,040 (veriden). Formül şeridi kitabın Shapley formülü ve ağırlıkları ⅓, ⅙, ⅙,
   ⅓; tenure için sayılarıyla.
6. **Toplama: temel değerden tahmine.** Şelale: 0,246 → +0,567 → +0,093 → +0,040 → 0,945; şerit
   "φ₀ + Σ φ = p" sayılarıyla. Kitabın kod04 tablosu.
7. **Kuvvet grafiği: iki müşteri.** Müşteri 301 (bütün katkılar turuncu) ve müşteri 77 (p =
   0,055: tenure +0,200 turuncu; MonthlyCharges −0,273 ve TotalCharges −0,118 mavi) iki kuvvet
   çubuğu, ortak 0–1 ekseni, temel değer çizgisi. "Turuncu ayrılmaya iter, mavi kalmaya çeker."
8. **Yerelden globale.** Ortalama |SHAP| 0,221 / 0,065 / 0,036 ile `feature_importances_` yan yana
   (veriden). "İkisi de tenure'u öne koyar; SHAP olasılık ölçeğinde konuşur, önem ölçütü bölünme
   kazancında."
9. **Özet grafiği.** 100 test müşterisi, her özellik bir satır; nokta konumu SHAP, rengi özellik
   değeri. tenure satırında yüksek değerler (kırmızı-pembe) sağda: bu sentetik veride uzun süre
   ayrılma tahminini artırır (veriden: değer ile katkı arasındaki korelasyon 0,84). Not satırı:
   "Kitabın metni kısa süreli müşterilerin sağda olduğunu söyler; bu veride tersi görülür."
10. **Sınırlar.** Dört kart: (a) global ≠ yerel: müşteri 217'de en büyük katkı MonthlyCharges
    (+0,154), tenure −0,022 (veriden); (b) açıklama nedensellik değildir (kitabın "Dikkat"
    kutusu); (c) ölçek: bu modelde katkı olasılık birimidir, XGBoost'ta log-odds; (d) sızıntı:
    yüksek katkılı bir özellik önce hedefle nasıl hesaplandığına bakılarak denetlenir. Ders sonu
    bağlantıları: LIME sayfasına ve Bölüm 9 `random-forest/` sayfasına.

### Laboratuvar

- **Adım 1, 3–7:** müşteri seçimi (100 test müşterisi; hazır seçimler müşteri 301, 77, 217, 176
  adlarıyla ve kısa notlarıyla); kart, kafes, tablo, şelale canlı. Adım 4'te sıralama seçimi
  (6 sıralama); adım 7'de ikinci kuvvet çubuğunun müşterisi.
- **Adım 9:** vurgulanacak müşteri seçimi (noktası halkalı, üç satırda) ve renk için özellik
  seçimi (noktaları başka bir özelliğin değerine göre boyamak: bağımlılık ipucu).
- Adım 2, 8, 10'da kontrol yok (parametre kartı gizlenir).
- Adıma göre yalnızca o adımın kontrolleri görünür.

## Sayfa 2 — LIME: yerel vekil model ve SHAP ile karşılaştırma (`lime-yerel/`)

### Öğrenme sonucu

Öğrenci LIME'ın dört adımını (komşuluk üret, kara kutuya sor, yakınlığa göre tart, basit model
uydur) aynı müşteride sayılarıyla izler; kuralların kartil bölmelerinden geldiğini ve vekilin
modelin kendisi olmadığını yerel uyumdan (vekil tahmini, R²) okur; örnek sayısı ve tohumun
katsayıları nasıl oynattığını görür; SHAP ile LIME'ın uyuştuğu ve uyuşmadığı müşterileri
karşılaştırır; kitabın hata ayıklama kodundaki beş hatayı görür.

### Görünüm

Adım 1'de **akış şeridi** (komşuluk → kara kutu → ağırlık → vekil). Adım 2'de üç **sayı doğrusu**
(`NumberLineLayer`, kartil sınırları, müşterinin bölmesi vurgulu). Adım 3–4'te **komşuluk
bulutu** (tenure × MonthlyCharges, `AxesLayer`, kartil ızgarası, müşteri yıldızı) ve yanında
**desen tablosu** (8 satır: üç "aynı bölmede mi" işareti, örnek sayısı, ortalama p). Adım 5'te
**çekirdek eğrisi** (d → ağırlık, 4 nokta) ve tabloya ağırlık sütunu. Adım 6–7'de **vekil
çubukları** (`HBarsLayer`, kural adlarıyla) ve **uyum panosu** (model p ile vekil tahmini, R²).
Adım 8'de **kararlılık şeridi** (11 tohumun katsayıları, örnek sayısına göre iki satır). Adım 9'da
**yan yana pano** (SHAP katkıları ile LIME katsayıları, `core/plot/waterfall.ts` ve `HBarsLayer`).
Adım 10'da **kod paneli** (`core/plot/code-panel.ts`).

### Adımlar (Ders)

1. **Yerel soru.** Müşteri 301, p = 0,945 (veriden). LIME'ın dört adımı akış şeridinde; kitabın
   kod05 satırı `LimeTabularExplainer(…, mode="classification", random_state=42)`.
2. **Kartil bölmeleri.** 300 eğitim müşterisinden her özelliğin 3 kartil sınırı (tenure 17 / 28 /
   41,25; MonthlyCharges 39,87 / 51,59 / 59,36; TotalCharges 2294,79 / 2474,31 / 2714,64 —
   veriden); müşterinin bölmeleri vurgulu: `tenure > 41.25`, `39.87 < MonthlyCharges <= 51.59`,
   `2294.79 < TotalCharges <= 2474.31`. "LIME sürekli özelliği dört bölmeye ayırır."
3. **Komşuluk örnekleme.** 5000 örnekten 500'ü bulutta (tarama: noktalar gruplar hâlinde gelir);
   her özellik için bölme eğitim sıklığıyla seçilir, değer bölme içinde kesik normalden çekilir.
   Müşteri yıldızı ve kartil ızgarası.
4. **Kara kutuya sor ve ikiye indir.** Noktalar modelin p'siyle boyanır; her örnek üç "aynı
   bölmede mi" işaretine iner; 8 desenin tablosu: örnek sayısı ve ortalama p (veriden; ör. üçü de
   aynı bölmede: n, ortalama p).
5. **Yakınlık ağırlığı.** Uzaklık = √(farklı bölme sayısı): 0, 1, √2, √3; çekirdek genişliği w =
   0,75 · √3 = 1,299; ağırlıklar 1,000 / 0,744 / 0,553 / 0,411 (hesaptan); çekirdek eğrisi ve
   formül şeridi sayılarıyla.
6. **Vekil model.** Ağırlıklı Ridge (alpha = 1): `tenure > 41.25` 0,540; `39.87 < MonthlyCharges
   <= 51.59` 0,074; `2294.79 < TotalCharges <= 2474.31` −0,023; kesişim 0,146 (veriden; kitabın
   çıktısı). Şerit: vekil = kesişim + Σ katsayı · işaret.
7. **Vekil modelin kendisi değil.** Vekilin bu müşteri için tahmini 0,146 + 0,540 + 0,074 − 0,023
   = 0,737; model 0,945; ağırlıklı R² 0,693 (veriden). Kitabın "Yaygın hata"sı: "`tenure > 41.25`
   ormanın kuralı değil, vekilin bölmesidir."
8. **Kararlılık.** 11 tohumda tenure katsayısı: 5000 örnekle dar aralık (0,525–0,551), 50
   örnekle geniş aralık (0,404–0,554; ikisi de veriden, kitabın `bolum13_kod09` çıktısıyla aynı); iki satırlık nokta şeridi, aralıklar yazılı. Kitabın üçüncü
   tuzağı: `random_state` sabitlenmezse aynı müşteri farklı açıklama alır.
9. **SHAP ile LIME.** Önce müşteri 301: kitabın kod06 tablosu (iki yöntemde aynı sıra:
   tenure, MonthlyCharges, TotalCharges). Sonra müşteri 77: SHAP'ta en büyük katkı
   MonthlyCharges (−0,273), LIME'da tenure (+0,472); model p = 0,055, vekil tahmini 0,602
   (veriden). Sayaç: 100 test müşterisinin 24'ünde en etkili özellik farklı (veriden). Kitabın
   "Sık yanlış anlama" kutusu: uyuşmazlık modeli hatalı yapmaz; veri, bağımlılık ve örnekleme
   incelenir.
10. **Hata ayıklama.** Kitabın `HataAyiklama` kodu; beş hata sırayla işaretlenir (sınıf
    örneklenmemiş, tek satır iki boyutlu değil, `predict_proba` eksenleri, tanımsız
    `tahmin_olasiligi`, DataFrame yerine Series); sonra düzeltilmiş kod. Kitabın kapanış ipucu:
    tahmin başarımı, veri kalitesi, açıklama tutarlılığı ve insan denetimi birlikte. Ders sonu
    bağlantıları: SHAP sayfasına ve Bölüm 11 `smote-sizinti/` sayfasına (sızıntı).

### Laboratuvar

- **Adım 2–7:** hazır müşteri seçimi (4 müşteri); adım 5–7'de çekirdek genişliği kaydırıcısı
  (0,3–4,0; varsayılan 1,299) ve örnek sayısı seçimi (tohum 42): adım 5'in desen tablosu seçilen
  çalıştırmayı gösterir; ağırlıklar, katsayılar, vekil tahmini ve R² canlı (TS `limeFit`). Adım
  3–4'ün bulutu ve tablosu her zaman tohum 42 / 5000 örnek çalıştırmasıdır.
- **Adım 8:** hazır müşteri ve örnek sayısı seçimi (50 / 100 / 500 / 1000 / 5000); seçilen örnek
  sayısının satırı vurgulu, 11 tohumun katsayıları üç özellik için.
- **Adım 9:** 100 test müşterisinden seçim; iki pano ve uyuşma rozeti canlı (veriden).
- **Adım 10:** "düzeltilmiş kodu göster" anahtarı.
- Adım 1'de kontrol yok. Adıma göre yalnızca o adımın kontrolleri görünür.

## Kitapla farklar (kitap düzeltmesi için liste)

- SHAP özet grafiğinin açıklaması (Şekil 13.1'in altı) kısa üyeliğin (mavi tenure) sağa yığıldığını
  söyler; kitabın sentetik verisinde tersi olur: uzun tenure ayrılma tahminini artırır (değer ile
  katkı arasındaki korelasyon 0,84; kod04'te tenure 51 için +0,567). Sayfa 1 adım 9 bunu gösterir.
- Düzeltilmiş hata ayıklama kodunun çıktı yorumu "%72.4" der; aynı veride `n_estimators=100`
  modelin müşteri 301 için olasılığı veriden okunan değerdir (ön denemede 0,960).
- "Orta" programlama alıştırmasının beklenen çıktısı "En etkili özellik: MonthlyCharges"; bu
  veride en etkili özellik tenure'dur (0,546).
- Kod04'ün açıklaması "katkıların toplamı model çıktısına yaklaşır" der; TreeExplainer'da toplam
  tam tutar (0,2456 + 0,6994 = 0,945).
- Kod01'in açıklaması "kod ilk olarak hedef değişkeni sayısal biçime dönüştürür" der; kodda böyle
  bir adım yoktur (veri sentetik ve zaten sayısal).
- Kitap LIME'ın vekil tahminini (0,737) ve yerel R²'yi (0,693) göstermez; sayfa 2 adım 7 ikisini
  modelin 0,945'iyle yan yana koyar.

## Arayüzler

- Her sayfa mevcut `ConceptPage<Params>` sözleşmesini sağlar; `StepPlayer` adım/tarama
  sözleşmesi değişmez; adım indeksleri `stepIndex` ile adım kimliklerinden türetilir; Lab metni
  `Step.labText`.
- Kimlikler ve yollar: `shap-degerleri` → `shap-degerleri/`, başlık "SHAP: Shapley değerleriyle
  katkı"; `lime-yerel` → `lime-yerel/`, başlık "LIME: yerel vekil model ve SHAP ile
  karşılaştırma". Kayıt defterinde `soon('shap', 13, 'SHAP')` iki hazır kayıtla değişir; `soon`
  yardımcısı kullanılmaz hâle gelirse kaldırılmaz (ileride yeni bölümler için kalır; lint
  uyarısı verirse dışa aktarılır).
- Çekirdek: `src/core/plot/waterfall.ts` (yatay şelale / kuvvet çubuğu: temel değer, işaretli
  parçalar, ok uçları, etiket yerleştirme; iki sayfa kullanır).
- Parametre adları (öneri, yapıcıya bırakılır): sayfa 1 `{ customer: number; order: number;
  second: number; highlight: number; colorBy: number }`; sayfa 2 `{ customer: number; width:
  number; samples: number; compare: number; fixed: boolean }`.

## Hata durumları

- Bir desende hiç örnek yoksa (küçük örnek sayısı) o desenin satırı "0 örnek" yazar, ortalama p
  "—"; Ridge kalan desenlerle çözülür (Ridge cezası tekilliği önler).
- Ağırlıkların toplamı sıfıra yaklaşırsa (çok dar çekirdek) R² "—" yazılır; NaN / Infinity
  ekrana basılmaz.
- Katkısı sıfıra çok yakın parça (|φ| < 0,005) şelalede ince çizgi olarak çizilir, etiketi
  yanında durur.

## Doğrulama

- Birim: ortak hesap fixture'a karşı (yukarıda); senaryo adım kimlikleri, parametreleri ve
  metinlerdeki sayıların veriden geldiği; sahne testleri (her adımın anahtar DOM öğesi: müşteri
  kartı ve p, önem çubukları, kafes düğümleri ve vurgulu yol, sıralama tablosu satırları, şelale
  parçaları, iki kuvvet çubuğu, özet grafiği noktaları; akış şeridi, sayı doğruları ve vurgulu
  bölmeler, bulut noktaları, desen tablosu, çekirdek noktaları, vekil çubukları, uyum panosu,
  kararlılık noktaları, yan yana pano ve rozet, kod paneli işaretleri).
- e2e (yalın): her sayfa için Ders anahtar adımları (sayfa 1: 3, 5, 7, 9; sayfa 2: 3, 5, 7, 9)
  ve birer Lab etkileşimi (sayfa 1: adım 5'te müşteri 77'yi seç; sayfa 2: adım 6'da çekirdek
  genişliğini değiştir) ekran görüntüsü temeliyle; etiket çakışması ve sahne dışına taşma
  kontrolleri.
- Performans: sayfa 1 adım 5'te müşteri değiştirme ve sayfa 2 adım 6'da çekirdek kaydırıcısı
  p95 ≤ 25 ms (bölüm sonunda bir kez).
- Kapanış: `npm run check` çıkış 0; kontrolcü ekran görüntülerine kendisi bakar.

## Yapıcıya bırakılanlar

- Dosya bölünmesi, parametre adları, kafesin yerleşimi (dört kat, düğüm boyutları), özet grafiği
  nokta boyutu ve yığılma aralığı, bulut nokta boyutu ve tarama hızları, panel oranları, renk
  tonları (anlamları yukarıda sabit), hazır müşteri notlarının metni.
