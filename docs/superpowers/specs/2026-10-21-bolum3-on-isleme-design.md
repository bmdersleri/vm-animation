# Bölüm 3 — Eksik veri, IQR ve ölçekleme sayfaları — Tasarım

- **Tarih:** 2026-10-21
- **Kaynak:** Hocanın isteği: "bölüm 3'ü de hazırla, benden onay bekleme". Hoca beyin fırtınası ve onay adımlarını açıkça devretti. Bu belgedeki bütün kararları tasarımcı verdi; hepsi sonda "Tasarımcının kararları" altında kontrol için listelenir.
- **Kitap:** *Modern Veri Madenciliğine Giriş*, Bölüm 3, `C:\projects\ModernVeriMadenGiris\chapters\ch03_veri_on_isleme\content\final.md`. Satır aralıkları:
  - eksik veri 93–239,
  - doldurma (imputation) 240–351,
  - aykırı değer ve IQR 352–457,
  - ölçekleme 458–581,
  - eğitim-test ayrımı 693–794,
  - Pipeline 795–941,
  - hata alıştırması 1079–1185.
- **Önceki tasarımlar:**
  - `docs/superpowers/specs/2026-10-20-vm-animasyon-knn-design.md`: ortak iskelet (§4), kırmızı çizgiler (§3) ve görsel kimlik oradan aynen geçerlidir.
  - `docs/superpowers/specs/2026-10-20-bolum5-karar-agaci-naive-bayes-design.md`: ortak grafik çekirdeği, iskelet betiği, e2e bölünmesi ve ekran görüntüsü testleri oradan gelir.

## Amaç ve kabul ölçütleri

Ana sayfada Bölüm 3'ün iki kartı var: `iqr-aykiri` ve `olcekleme`. İkisi de animasyonlu sayfaya kavuşur. Kitabın bölüm boyunca tekrarladığı tek soru şudur: "Bu istatistiği yalnızca eğitim verisinden mi öğreniyorum?" Sayfalar öğrencinin en çok takıldığı dört anı hedefler:

- **Uç değer ortalamayı sürükler, medyanı sürükleyemez.** Bu yüzden ortalamayla doldurma yanıltır.
- **IQR sınırı nereden gelir?** Çeyreklerin konumla hesaplanması ve 1,5 × IQR kuralı.
- **Ölçeklenmemiş uzaklık, birime göre değişir.** Aynı veride ay, yıl ya da gün seçimi en yakın komşuyu değiştirir.
- **Önce ayır, sonra öğren, sonra uygula.** Tüm veriyle `fit` edilen ölçekleyici, test bilgisini eğitime sızdırır.

Kabul ölçütleri:

1. `iqr-aykiri/` ve `olcekleme/` sayfaları yayında. Ana sayfadaki iki kart `hazir` durumunda ve bu sayfalara bağlı.
2. Hoca, iki sayfayı Ders modunda yalnızca klavyeyle (→ / ←) baştan sona anlatabiliyor. 1280×720'de k-NN tasarımının §3'teki yazı boyutu eşikleri her adımda sağlanıyor. Sayfa kaymıyor, sahnedeki hiçbir yazı ekran dışına taşmıyor.
3. Sayfalardaki her sayı, kitabın kodunun aynı veriyle pandas ve scikit-learn'de verdiği sonuçla aynı. Bu, Python betiğinin ürettiği fikstüre karşı birim testleriyle doğrulanır. Bağlantılı API'ler:
   - pandas: `Series.quantile` (doğrusal ara değer), `mean`, `median`, `clip`;
   - scikit-learn: `SimpleImputer`, `StandardScaler`, `MinMaxScaler`, `RobustScaler`, `train_test_split`.
4. Her formül şeridi, değerleri yerine konmuş hâliyle görünür. Hiçbir sıfır olmayan değer "0,00" diye yazılmaz.
5. Lab'deki sürükleme ve kaydırıcılar takılmadan akıyor. Playwright performans testleri k-NN'deki p95 yöntemiyle ölçer.
6. k-NN, Karar Ağacı ve Naive Bayes sayfaları davranış olarak değişmiyor. Tek istisna aşağıdaki "Ek düzeltme"dir. Mevcut testlerin hepsi geçiyor.

## Kararlar

| Konu | Karar | Neden |
|---|---|---|
| Sayfa sayısı | Ana sayfadaki iki kayıt: `iqr-aykiri` ve `olcekleme` | Kayıtlar zaten var. Bölüm 5'teki gibi kayıtlı her kart bir sayfa olur. |
| `iqr-aykiri` kapsamı | Eksik veri ve doldurma, ardından IQR ve aykırı değer | Kitapta doldurma bölümü, uç değerin ortalamayı nasıl sürüklediğini gösterir (200 TL örneği). IQR'ye doğal köprüdür. |
| `olcekleme` kapsamı | Ölçek farkı ve k-NN uzaklığı, StandardScaler ve iki rakibi, ardından fit/transform ve veri sızıntısı | Sızıntı, bölümün "en önemli tek cümlelik özeti"dir (final.md 920). En somut hâli ölçekleyicinin `fit`'idir. |
| Kart başlıkları | "Eksik veri ve IQR ile aykırı değer", "Ölçekleme ve veri sızıntısı" | Kartın içeriği başlıkta görünsün |
| Veri | Kitabın kod örneklerindeki sayılar aynen: 002 (doldurma), 003 (IQR), 004 (ölçekleme), 006 (ayrım) | Öğrenci kitapta gördüğü sayıyı ekranda bulur |
| Uç değerin yeri | Sayı doğrusu 0–100 TL doğrusal. 100'ün sağında bir kırık eksen işareti var; 100'den büyük değerler oraya, kendi değer etiketleriyle yerleşir. | 480 ile 30–60 kalabalığı aynı doğrusal eksende okunmaz. Kırık eksen, kutuyu okunur genişlikte tutar. |
| Ortak çekirdek | Sayı doğrusu ve kırık eksen iki sayfada da kullanılır | Sınırını builder belirler. Bölüm 5'teki `src/core/plot/` kalıbı izlenir. |
| Ek düzeltme | Naive Bayes Bölüm 2 hesap şeridi (aşağıda) | Canlı kontrolde bulundu. Hoca "bölüm 3'ü de" diyerek önerilen düzeltmeyi de kabul etti. |

## Kapsam dışı

- One-Hot Encoding, `ColumnTransformer` ve tam `Pipeline` animasyonu. Pipeline, `olcekleme` sayfasının son adımında yalnızca kural olarak görünür. Kodlama ayrı bir kavram kartı olarak sonraya kalır; ana sayfaya kart eklenmez.
- MCAR / MAR / MNAR ayrımının animasyonu. Bu üç tür yalnızca Lab metninde, kitaptaki örnekleriyle birer cümleyle anılır.
- `KNNImputer`, log dönüşümü ve zaman serisinde bölünme. Gerekirse Lab metninde birer cümleyle anılır.
- Bölüm 5'ten ertelenen cila maddeleri (`.remember/remember.md` → Deferred polish).

## Kırmızı çizgiler

k-NN tasarımının §3'ü aynen geçerlidir. Bu iki sayfada özellikle:

- **Formül şeritleri, kartlar ve fatura hücreleri, Ders'te gövde boyutundan (≥ 22 px) küçük yazılamaz.** Şerit tek satıra sığmazsa iki satıra kırılır. Yine sığmazsa metin kısaltılır ya da adım ikiye bölünür, yazı küçültülmez.
- **Değer etiketleri** (Q1, Q3, sınırlar, μ, medyan, nokta değerleri) Ders'te ≥ 18 px ve birbirinin üstüne binmez. Çakışırsa etiketler dikeyde kademelenir.
- **Renk + şekil:** Her nokta türü renkle birlikte şekille de ayrışır. Kitaptaki kalıp:
  - normal gözlem: lacivert ●,
  - aykırı gözlem: turuncu ▲,
  - doldurulmuş değer: camgöbeği ◆,
  - yeni müşteri: turuncu ◆ ve kalın kontur,
  - test noktası: içi boş ○ (eğitim dolu ●).

## Ortak görsel öğeler

- **Fatura kartları:** Bir sıra hücre, her hücrede bir değer. Boş hücre kesik çizgili kontur ve "boş" yazısıyla görünür. Doldurulunca camgöbeği zemin ve ◆ işareti alır. Sıralama adımlarında hücreler animasyonla yer değiştirir ve altlarında sıra numarası (0–7) görünür.
- **Sayı doğrusu:** Yatay eksen, Ders'te tik etiketleri ≥ 18 px. Noktalar eksenin üstünde durur. Değerleri birbirine çok yakın noktalar dikeyde istiflenir (beeswarm).
- **Kırık eksen:** 100'ün sağında iki eğik çizgi ve bir boşluk. Ötedeki noktalar kendi değer etiketleriyle durur ("480"). Bir değer 100'ün altına inerse (Lab kaydırıcısı ya da kırpma) doğrusal bölgeye animasyonla geçer.
- **İşaretler:**
  - ortalama: eksenin altında bir denge üçgeni,
  - medyan: dikey kısa çizgi,
  - Q1 ve Q3: kutu kenarları,
  - sınırlar: kesik dikey çizgiler.
  Her işaret değer etiketini taşır.
- **Formül şeridi:** Sahnenin altında, Naive Bayes'teki gibi, değerleri yerine konmuş tek ya da iki satır.

## `iqr-aykiri` sayfası — Eksik veri ve IQR ile aykırı değer

**Kitap atfı:** Bölüm 3, "Eksik veri", "Imputation" ve "Aykırı değerler ve IQR" alt başlıkları.
**Terimler (kitapla uyumlu):** eksik veri (missing data), doldurma (imputation), ortalama (mean), medyan (median), dayanıklı (robust), çeyrek (quartile), çeyrekler arası açıklık (IQR), Tukey'in 1,5 × IQR kuralı, Z-score, kırpma (clipping).

### Bölüm 1 verisi — kitabın 002 örneği

`aylikFatura = [29.85, 56.95, NaN, 42.30, 38.50, NaN, 200.00, 45.00]`, 8 hücre, 2 boş.

Kontrol değerleri (testlerde sabit):

- Dolu altı değerin ortalaması **68,77** (68,7667), medyanı **43,65**.
- Ortalamayla doldurma: iki boş hücre 68,77 olur. Medyanla doldurma: 43,65 olur. Sayılar `SimpleImputer` ile aynıdır.
- Kategorik mod örneği (yalnızca Lab metni): "Aylık, Aylık, boş, Bir Yıllık" → "Aylık".

### Bölüm 2 verisi — kitabın 003 örneği

`aylikFatura = [29.85, 56.95, 42.30, 38.50, 45.00, 60.20, 51.10, 480.00]`, 8 değer.

Kontrol değerleri (pandas `quantile` doğrusal ara değer):

- **Sıralı dizi:** 29,85 · 38,50 · 42,30 · 45,00 · 51,10 · 56,95 · 60,20 · 480,00.
- **Q1:** konum 0,25 · 7 = 1,75. Q1 = 38,50 + 0,75 · (42,30 − 38,50) = **41,35**.
- **Q3:** konum 0,75 · 7 = 5,25. Q3 = 56,95 + 0,25 · (60,20 − 56,95) = **57,76** (57,7625).
- **IQR:** 57,7625 − 41,35 = **16,41** (16,4125). 1,5 · IQR = 24,62.
- **Sınırlar, 1,5 katsayısıyla:** alt **16,73**, üst **82,38**.
- **Sınırlar, 3,0 katsayısıyla (Lab):** alt −7,89, üst 107,00.
- **Aykırı gözlem:** yalnızca 480,00.
- **Bıyıklar:** sınırın içindeki en uç gözlemlerde biter, 29,85 ve 60,20 (matplotlib'in kuralı). Lab metni bunu bir cümleyle söyler (kitap v0.2'nin Şekil 3.2 açıklamasıyla aynı: "Bıyıklar sınıra kadar uzamaz").
- **Medyan** 48,05. **Ortalama** 100,49. Standart sapma, `ddof=0` ile (`scipy.stats.zscore` varsayılanı), 143,74.
- **z(480):** (480 − 100,49) / 143,74 = **2,64**. Bu değer 3'ün altındadır. Sekiz gözlemde `ddof=0` ile hiçbir z değeri √7 ≈ 2,65'i geçemez. Lab metni bunu belirtir.
- **Müdahale sonrası ortalama:**
  - olduğu gibi: 100,49,
  - silince (7 gözlem): **46,27**,
  - üst sınıra kırpınca: **50,79**.

### Adımlar

**Eksik veri ve doldurma**

1. **Boş hücreler.** Sekiz fatura kartı, ikisi boş. Sayı doğrusunda altı nokta var; 200,00 kırık eksenin ötesinde duruyor. Şerit: "8 hücreden 2'si boş: %25 eksik". Terim: eksik veri (missing data).
2. **Ortalama.** Denge üçgeni eksen boyunca kayar ve 68,77'de durur. Kalabalığın sağında kalır, çünkü 200 onu çeker. Şerit: (29,85 + 56,95 + 42,30 + 38,50 + 200,00 + 45,00) / 6 = 68,77. Terim: ortalama (mean).
3. **Medyan.** Kartlar sıralanır. Ortadaki iki değer (42,30 ve 45,00) vurgulanır ve medyan çizgisi 43,65'te belirir. Şerit: (42,30 + 45,00) / 2 = 43,65. Terim: medyan (median).
4. **Ortalamayla doldurma.** İki boş kart 68,77 alır. İki camgöbeği ◆ nokta, kalabalığın dışına, sağa düşer. Şerit: `SimpleImputer(strategy="mean")` → 68,77. Terim: doldurma (imputation).
5. **Medyanla doldurma.** ◆ noktalar 43,65'e, kalabalığın içine kayar. Mesaj: medyan uç değere karşı dayanıklıdır. Şerit: `strategy="median"` → 43,65. Terim: dayanıklı (robust).

**Aykırı değer ve IQR**

6. **Sırala.** Sahne kitabın 003 verisine geçer: sekiz fatura, 480,00 kırık eksenin ötesinde. Kartlar sıralanır, altlarında sıra numaraları 0–7 belirir. Terim: çeyrek (quartile).
7. **Q1.** 1,75. konumda bir işaret, 1. ve 2. kartın arasına, 2.'ye daha yakın konur. Şerit: 38,50 + 0,75 · (42,30 − 38,50) = 41,35. Eksende Q1 çizgisi belirir.
8. **Q3 ve kutu.** 5,25. konum. Şerit: 56,95 + 0,25 · (60,20 − 56,95) = 57,76. Kutu Q1'den Q3'e çizilir. Şeridin ikinci satırı: IQR = 57,76 − 41,35 = 16,41. Terim: çeyrekler arası açıklık (IQR).
9. **Tukey sınırları.** Kutunun iki yanına 1,5 · 16,41 = 24,62 uzunluğunda kollar açılır. Sınırlar 16,73 ve 82,38'de kesik çizgi olur. 480, turuncu ▲ olarak "aykırı" işaretlenir. Bıyıklar 29,85 ve 60,20'de biter. Terim: Tukey'in 1,5 × IQR kuralı.
10. **Neden Z-score değil?** Ortalama ve ±3σ bandı gösterilir. Şerit: z(480) = (480 − 100,49) / 143,74 = 2,64 < 3. Mesaj: 480, ortalamayı ve sapmayı kendisi şişirir, bu yüzden yakalanmaz. Çeyrekler ise ondan etkilenmez. Terim: Z-score.
11. **Sil mi, kırp mı?** 480 kırık eksenden doğrusal bölgeye geçer ve üst sınırda (82,38) durur. Şerit: ortalama olduğu gibi 100,49 · silince 46,27 · kırpınca 50,79. Mesaj: 480 gerçek bir kurumsal müşteri olabilir. Silmek satırı atar, kırpmak satırı tutar. Terim: kırpma (clipping).

Adım başlıklarının ve metinlerin son hâli builder'ın işidir. Akış ve her adımın göstermesi gereken an bağlayıcıdır. Her adıma Ders'te görünen bir `term` verilir.

### Parametreler

| Parametre | Değerler | Varsayılan |
|---|---|---|
| Uç değer (Bölüm 1'de 200,00'ün, Bölüm 2'de 480,00'ün yerine) | 50–500 TL, kaydırıcı, adım 1 | Kitabın değeri |
| Doldurma stratejisi (Bölüm 1) | Ortalama / Medyan | Adıma bağlı |
| IQR katsayısı (Bölüm 2) | 1,5 / 3,0 | 1,5 |
| Müdahale (Bölüm 2) | Yok / Sil / Kırp | Adıma bağlı (11. adımda Kırp) |

Adımlar kendi parametrelerini k-NN'deki gibi sahiplenir. Elle verilen değer, adım değişene kadar geçerli kalır.

### Lab modu

- Uç değer kaydırıcısıyla nokta eksende kayar. Ortalama, medyan, Q1, Q3, sınırlar, aykırı işareti ve şerit canlı değişir. Değer 100'ün altına inince nokta kırık eksenden doğrusal bölgeye geçer.
  - Mesaj Bölüm 1'de: ortalama kayar, medyan yerinde kalır.
  - Bölüm 2'de: değer 82,38'in altına inince aykırı işareti kalkar.
- Açıklama panelinde:
  - Bölüm 1'de: MCAR / MAR / MNAR, kitabın örnekleriyle birer cümle. Ayrıca kategorik sütunda mod örneği.
  - Bölüm 2'de: bıyık kuralı ve sekiz gözlemde z'nin üst sınırı. Kitabın hata alıştırmasındaki formül hatası da anılır: `q3 + 1.5 * q1` yanlış, `q3 + 1.5 * (q3 - q1)` doğru (final.md 1127).

### Kısayollar

`D`: doldurma stratejisi. `K`: IQR katsayısı. `C`: müdahale (Yok → Sil → Kırp). Hepsi `?` yardımında listelenir. Yerleşik tuşlarla (`P`, `F`, `?`, oklar, Boşluk, Home/End) çakışamaz.

## `olcekleme` sayfası — Ölçekleme ve veri sızıntısı

**Kitap atfı:** Bölüm 3, "Özellik ölçekleme: StandardScaler", "Eğitim-test ayrımı" ve "Pipeline ve ColumnTransformer" alt başlıkları.
**Terimler (kitapla uyumlu):** ölçek (scale), Öklid uzaklığı (Euclidean distance), standart sapma (standard deviation), standardizasyon (z-score), MinMaxScaler, RobustScaler, fit / transform, eğitim-test ayrımı (train-test split), veri sızıntısı (data leakage), Pipeline.

### Bölüm 1–2 verisi — kitabın 004 örneği

| Müşteri | Hizmet süresi (ay) | Aylık fatura (TL) |
|---|---|---|
| M1 | 1 | 29,85 |
| M2 | 34 | 56,95 |
| M3 | 2 | 42,30 |
| M4 | 45 | 38,50 |
| M5 | 8 | 200,00 |
| M6 | 60 | 70,10 |

Yeni müşteri: 12 ay, 55,00 TL (kitapla aynı).

Kontrol değerleri (testlerde sabit):

- **Yeni müşteriye uzaklıklar ve en yakın komşu:**
  - ay biriminde: M1 27,45 · M2 22,09 · **M3 16,16** · M4 36,90 · M5 145,06 · M6 50,32. En yakın M3.
  - yıl biriminde (ay / 12): en yakın **M2 (2,68)**.
  - gün biriminde (ay · 30): en yakın **M5 (188,22)**.
  - z biriminde: M1 0,65 · M2 0,97 · **M3 0,49** · M4 1,48 · M5 2,49 · M6 2,13. En yakın M3, birim ne olursa olsun.
- **StandardScaler** (`ddof=0`):
  - hizmet süresi μ = 25, σ = 22,73;
  - fatura μ = 72,95, σ = 58,29.
- **Ölçeklenmiş değerler** (kitabın çıktısı):

  | | M1 | M2 | M3 | M4 | M5 | M6 |
  |---|---|---|---|---|---|---|
  | hizmet süresi | −1,06 | 0,40 | −1,01 | 0,88 | −0,75 | 1,54 |
  | fatura | −0,74 | −0,27 | −0,53 | −0,59 | 2,18 | −0,05 |

- **Yeni müşteri:** (−0,57; −0,31).
- **Fatura sütunu, üç ölçekleyici:**

  | Ölçekleyici | M1 | M2 | M3 | M4 | M5 | M6 |
  |---|---|---|---|---|---|---|
  | StandardScaler | −0,74 | −0,27 | −0,53 | −0,59 | 2,18 | −0,05 |
  | MinMaxScaler | 0 | 0,16 | 0,07 | 0,05 | 1 | 0,24 |
  | RobustScaler (medyan 49,63, IQR 27,36) | −0,72 | 0,27 | −0,27 | −0,41 | 5,50 | 0,75 |

### Bölüm 3 verisi — kitabın 006 örneği

10 fatura: 29,85 · 56,95 · 42,30 · 38,50 · 45,00 · 60,20 · 51,10 · 80,00 · 33,00 · 90,00. Churn sırasıyla: 0 0 0 0 1 0 0 1 0 1.

Ayrım: `train_test_split(test_size=0.3, random_state=42, stratify=churn)`.

- **Test** (sıra numaraları 4, 8, 3): 45,00 · 33,00 · 38,50.
- **Eğitim:** kalan yedi değer.
- **Churn oranı:** eğitimde 0,29, testte 0,33 (kitapla aynı).
- **Yalnız eğitimle fit:** μ = 58,63, σ = 19,26. Test z değerleri −0,71 · −1,33 · −1,04.
- **Tüm veriyle fit (sızıntı):** μ = 52,69, σ = 18,69. Test z değerleri −0,41 · −1,05 · −0,76.

### Adımlar

**Neden ölçeklemek?**

1. **İki farklı ölçek.** Altı müşteri, hizmet süresi × aylık fatura dağılımında. Lab'de tablo görünür. Eksen başlıkları birimleri söyler: hizmet süresi 1–60 ay, fatura 29,85–200 TL. Terim: ölçek (scale).
2. **En yakın komşu.** Yeni müşteri (turuncu ◆) belirir. Her müşteriye uzaklık çizgisi çekilir, en yakını (M3) vurgulanır. Yeni müşterinin çevresinde, en yakın komşuya kadar bir eşit uzaklık eğrisi çizilir. Eksenlerin ölçeği farklı olduğu için bu eğri ekranda elips görünür. Şerit: d = √((12 − 2)² + (55 − 42,30)²) = √(100 + 161,29) = 16,16. Terim: Öklid uzaklığı (Euclidean distance).
3. **Birim değişince komşu değişir.** Hizmet süresi önce yıla, sonra güne çevrilir. Noktalar yatayda sıkışır ya da açılır. En yakın komşu M3 → M2 → M5 olur. Şerit, her birimde en yakın komşuyu ve uzaklığını yazar. Mesaj: ölçeklenmemiş uzaklık, hangi özelliğin önemli olduğunu değil, hangisinin sayısının büyük olduğunu izler.

**StandardScaler**

4. **Ortalama ve sapma.** Birim aya döner. Her eksende μ çizgisi ve ±σ bandı belirir. Şerit: hizmet süresi μ = 25, σ = 22,73 · fatura μ = 72,95, σ = 58,29. Terim: standart sapma (standard deviation).
5. **Kaydır: x − μ.** Noktalar kayar, μ çizgileri sıfırda buluşur.
6. **Böl: ÷ σ.** İki eksen de z birimine geçer, elips çembere döner. Şerit: z = (200 − 72,95) / 58,29 = 2,18 (M5'in faturası). Terim: standardizasyon (z-score).
7. **Birim artık fark etmez.** Birim yeniden ay → yıl → gün döner. z değerleri yerinden kıpırdamaz, en yakın komşu hep M3 (0,49) kalır.
8. **Üç ölçekleyici.** Sahne, fatura sütununun üç sayı doğrusuna geçer: StandardScaler, MinMaxScaler, RobustScaler. MinMax'te 200 değeri 1'e gider, diğer beşi 0 ile 0,24 arasına sıkışır. Robust'ta kalabalık açık kalır. Terimler: MinMaxScaler, RobustScaler.

**fit / transform ve veri sızıntısı**

9. **Yeni müşteri: yalnızca transform.** Dağılım z biriminde geri gelir. Yeni müşteri, eğitimden öğrenilen μ ve σ ile dönüşür. Şerit: ((12 − 25) / 22,73; (55 − 72,95) / 58,29) = (−0,57; −0,31). Terim: fit / transform.
10. **Önce ayır.** Sahne kitabın 006 verisine geçer: tek bir fatura sayı doğrusunda 10 nokta. `stratify` ile 7 eğitim (dolu ●) ve 3 test (içi boş ○) ayrılır. Şerit: churn oranı eğitimde 0,29, testte 0,33. Terim: eğitim-test ayrımı (train-test split).
11. **Eğitimden öğren.** Test noktaları soluklaşır. μ ve ±σ yalnızca eğitim noktalarından hesaplanır: μ = 58,63, σ = 19,26. Ardından test noktaları bu ölçekle dönüşür: −0,71 · −1,33 · −1,04.
12. **Yanlış sıra: sızıntı.** Ölçekleyici bu kez on noktanın tümüyle `fit` edilir. μ çizgisi test noktalarına doğru 52,69'a kayar, σ 18,69 olur. İki μ çizgisi yan yana kalır. Test z değerleri −0,41 · −1,05 · −0,76'ya değişir. Mesaj: test kümesi kendi değerlendirmesini etkiledi, program ise hata vermedi. Terim: veri sızıntısı (data leakage).
13. **Altın kural.** Üç kutulu akış: `train_test_split` → `fit` (yalnızca eğitim) → `transform` (eğitim ve test). Kitabın cümlesi: "önce ayır, sonra öğren, sonra uygula". Pipeline bu sırayı yapısal olarak zorlar. Terim: Pipeline.

Adım başlıklarının ve metinlerin son hâli builder'ın işidir. Akış ve her adımın göstermesi gereken an bağlayıcıdır. Her adıma Ders'te görünen bir `term` verilir.

### Parametreler

| Parametre | Değerler | Varsayılan |
|---|---|---|
| Hizmet süresi birimi (Bölüm 1–2) | Ay / Yıl / Gün | Ay (3. ve 7. adımlar kendi gösterimini oynatır) |
| Ölçekleme (Bölüm 1–2) | Yok / StandardScaler | Adıma bağlı |
| `fit` kapsamı (Bölüm 3) | Yalnız eğitim / Tüm veri | Adıma bağlı (12. adımda Tüm veri) |

### Lab modu

- Yeni müşteri, 1–9. adımlarda dağılımda sürüklenebilir. Uzaklıklar, en yakın komşu, eşit uzaklık eğrisi ve şerit canlı değişir. Ölçeklenmiş görünümde müşterinin z değerleri de canlı yazar.
- Açıklama panelinde:
  - 1–9. adımlarda: altı müşterinin tablosu (ham ve, ölçekleme açıksa, z değerleri) ve yeni müşteriye uzaklıklar. En yakın satır vurgulanır.
  - 10–13. adımlarda: kitabın üç hatası birer cümleyle anılır. Bunlar test verisinde yeniden `fit` (final.md 1125), ayrımdan önce ölçekleme (final.md 1122) ve `stratify` / `random_state` eksikliğidir (final.md 1128).
- Ağaç tabanlı modellerin ölçeklemeye duyarsız olduğu (final.md 464), 8. adımın Lab metninde bir cümleyle anılır.

### Kısayollar

`U`: birim (Ay → Yıl → Gün). `S`: ölçekleme. `T`: `fit` kapsamı. Hepsi `?` yardımında listelenir. Çakışma kuralı `iqr-aykiri` ile aynıdır.

## Ek düzeltme — Naive Bayes hesap şeridi

1280×720 canlı kontrolde bulundu. Bölüm 2'nin hesap şeridi (`src/concepts/naive-bayes/view.ts` → `part2Strip`) 8. adımda şunu yazıyor: "yeni öncül 1,00 · P(toplantı | spam) 0,02 vs 0,00 · P(toplantı | normal) 0,15 → %96,4 spam". Sorunlar:

- Öncül iki basamağa yuvarlandığı için 0,995 "1,00", 0,005 "0,00" görünüyor ve sonuçla (%96,4) çelişiyor.
- İkinci öncülün P(normal) olduğu yazmıyor. Bu, 6. adımdaki "0,30 vs 0,60" için de geçerli.

Düzeltme:

- İki öncül de etiketlenir: "P(spam) …" ve "P(normal) …". 7. adımdan itibaren spam öncülü "yeni öncül" olarak anılmaya devam eder; hocanın hedeflediği an kaybolmaz.
- Öncüller `lik()` ile aynı kuralla yazılır: iki basamak, ama 0 ya da 1 olmayan bir değer "0,00" ya da "1,00" görünecekse gereken kadar fazla basamak (en çok 6). 0,995 → "0,995", 0,005 → "0,005".
- Şerit Ders'te sığmazsa iki satıra kırılır: bir satır spam, bir satır normal tarafı. Yazı küçültülmez.
- Birim testi 6., 7., 8. ve 10. adımların şerit metnini sabitler. Naive Bayes ekran görüntüsü taban çizgileri, yalnızca bu şeridin değiştiği karelerde yenilenir.

## Arayüzler

- **Kayıt:** `src/concepts/registry.ts` içinde `iqr-aykiri` ve `olcekleme` kayıtları `hazir` olur. `href` değerleri `iqr-aykiri/` ve `olcekleme/`, başlıklar yukarıdaki kart başlıklarıdır.
- **İskelet:** İki sayfa `npm run yeni-kavram <id>` ile başlatılır.
- **Sayfa sözleşmesi:** Her sayfa `ConceptPage<P>` arayüzünü uygular (`src/core/shell.ts`). Adımlar `Step` türündedir.
- **Veri betiği:** `scripts/make_onisleme_data.py`, `make_*_data.py` kalıbında yazılır.
  - Kitabın dört örneğini tanımlar ve pandas / scikit-learn ile hesaplar.
  - Çıktılar: `src/concepts/iqr-aykiri/data/*.json`, `src/concepts/olcekleme/data/*.json` ve `tests/fixtures/onisleme_sklearn.json`.
  - Betik deterministiktir: iki çalıştırma bayt bayt aynı dosyaları üretir.
  - Fikstür, yukarıdaki bütün kontrol değerlerini tam duyarlıkla içerir.
- **TypeScript hesapları:** Çeyrek (doğrusal ara değer), ortalama, medyan, `ddof=0` standart sapma, kırpma, üç ölçekleyici ve uzaklıklar tarayıcıda yeniden hesaplanır. Lab kaydırıcısı ve sürükleme için bu gerekir. Hepsi fikstüre karşı test edilir. Ayrım indeksleri betikten gelir; TypeScript `train_test_split`'i taklit etmez.

## Hata durumları

- **Uç değer kaydırıcısı kalabalığın içine inerse:** Bölüm 2'de aykırı kalmaz. Şerit "Sınırların dışında gözlem yok" yazar, Z-score adımı da bunu söyler. Hata ya da NaN gösterilmez.
- **Uç değer kalabalığın en küçüğünden de küçük olursa:** Kaydırıcının alt ucu 50'dir. Sıralama yine doğru animasyonla yapılır.
- **Sil müdahalesi:** Nokta solup kaybolur ve n = 7 olur. Q1, Q3 ve sınırlar Lab'de yeni n ile yeniden hesaplanır; şerit bunu yazar.
- **Lab'de yeni müşteri sürüklenirken iki müşteri eşit uzaklıkta kalırsa:** Veri sırasındaki ilk müşteri en yakın sayılır.
- **Yeni müşteri grafiğin dışına sürüklenmek istenirse:** Eksen sınırlarında durur.
- **Sığmayan metin:** Formül şeridi iki satıra kırılır. Yine sığmazsa adım ikiye bölünür. Yazı boyutu düşürülmez.

## Doğrulama

- **Birim testleri:**
  - çeyrek, ortalama, medyan, standart sapma, z, kırpma ve silme hesapları fikstürle aynı;
  - `SimpleImputer` sonuçları (ortalama ve medyan) fikstürle aynı;
  - üç ölçekleyicinin çıktıları ve yeni müşterinin z değerleri fikstürle aynı;
  - dört birimde uzaklıklar ve en yakın komşu (M3, M2, M5, M3) fikstürle aynı;
  - ayrım, eğitimden fit ve tümüyle fit değerleri fikstürle aynı;
  - senaryolar: adım sayıları (11 ve 13), kimlikler, terimler, ve Ders terimlerinin metindeki İngilizce terimlerle uyumu (k-NN'deki kural);
  - görünüm türetmesi: her adımın şerit metni ve işaretlerin görünürlüğü;
  - Naive Bayes şeridinin yeni metinleri.
- **e2e (işlevsel):**
  - ana sayfadan iki karta tıklanınca sayfalar açılıyor;
  - Ders'te klavyeyle her adıma gidilebiliyor;
  - her adımda §3 yazı boyutları sağlanıyor ve sayfa kaymıyor;
  - parametre paneli açıkken sahnede hiçbir şey örtülmüyor;
  - Lab'de uç değer kaydırıcısı ve müşteri sürükleme ekrandaki sayıları değiştiriyor.
- **e2e (performans):** p95 bütçeleri, k-NN'dekilerle aynı ölçüm yöntemiyle ve onlardan gevşek olmadan:
  - uç değer kaydırıcısı (her iki bölümde),
  - yeni müşteri sürükleme,
  - birim geçişi animasyonu.
- **Ekran görüntüleri:** İki sayfanın anahtar adımları, Ders ve Lab modunda, 1280×720.
- **Kapı:** `npm run check` sıfır koduyla çıkmalı.

## Builder'a bırakılanlar

- Dosya ve bileşen sınırları; sayı doğrusu ve kırık eksenin ortak çekirdekteki API'si.
- Animasyon süreleri ve easing.
- Adım başlıklarının ve metinlerin son hâli (akış ve gösterilecek anlar bağlayıcı).
- Sahne yerleşimi: kartların, sayı doğrusunun, şeridin ve dağılımın 1280×720'deki konumları (kırmızı çizgileri sağlamak şartıyla).
- Kısayol harfleri, yerleşik tuşlarla çakışmamak şartıyla.
- Performans bütçelerinin kesin değerleri (k-NN'dekilerden gevşek olamaz).

## Tasarımcının kararları (hoca onaylamadı, kontrol için listelendi)

- **Kapsam:** İki sayfa, ana sayfadaki iki kayda göre. One-Hot ve tam Pipeline sonraya kaldı.
- **`iqr-aykiri` içeriği:** Doldurma ile IQR aynı sayfada. Köprü, uç değerin ortalamayı sürüklemesi.
- **`olcekleme` içeriği:** Ölçekleme ile veri sızıntısı aynı sayfada. Sızıntı, ölçekleyicinin `fit`'i üzerinden anlatılır.
- **Veri:** Kitabın 002, 003, 004 ve 006 kod örnekleri aynen kullanıldı. Sayılar kitapla birebir aynı.
- **Kırık eksen:** 0–100 TL doğrusal; 100'ün ötesi kırık eksende.
- **Z-score adımı (10):** Kitabın IQR–Z-score karşılaştırma tablosunu, sekiz gözlemde z'nin 3'e ulaşamadığı somut bir anla gösterir. Standart sapma `ddof=0` ile alınır, `scipy.stats.zscore` varsayılanı gibi.
- **Bıyık kuralı:** matplotlib'deki gibi sınır içindeki en uç gözleme kadar. Kitap v0.2'nin Şekil 3.2 açıklaması da aynı kuralı söyler; Lab metni onu izler.
- **Birim gösterimi (3. ve 7. adımlar):** Ay → yıl → gün. Kitabın verisinde en yakın komşuyu üç kez değiştiren tek gösterim budur; kitabın kendi cümlesindeki iddia (final.md 462), bu veride en somut bu yolla görünür.
- **Sızıntı adımı:** Kitabın 006 verisi ve `random_state=42`. Fit kapsamı farkı μ'yü 58,63'ten 52,69'a kaydırır.
- **Ek düzeltme:** Naive Bayes şeridi bu dalda düzeltilir. Ayrı bir dal açılmaz.
- **Kısayol harfleri:** `iqr-aykiri`'de `D`, `K`, `C`; `olcekleme`'de `U`, `S`, `T`.
