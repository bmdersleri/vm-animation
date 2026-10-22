# Bölüm 2 — Normal dağılım ve standart sapma — Tasarım

- **Tarih:** 2026-10-22
- **Kaynak:** Öğretmenin sorusu "normal dağılım kavramını hangi bölüm altında vermeliyiz?";
  önerim (Bölüm 2'de, `dagilim-carpiklik/` sayfasının hemen ardından ayrı bir sayfa) sohbette
  onaylandı: "önerilerin onaylandı gerçekleştir ve push et". Kitabın
  `ch02_eda_gorsellestirme/content/final.md` bölümü (salt okunur) standart sapmayı ve çarpıklığı
  verir; normal dağılımın kendi başlığı yoktur.
- **Yetki:** Onaylanan öneri sayfanın yerini, ayrı sayfa olmasını, beş içerik maddesini ve sonraki
  sayfalara geri bağlantıları belirler. Ayrıntı kararları benimdir ("Benim kararım"); ledger'da
  `Ruling:` satırı olarak da durur ve iş sonunda öğretmene listelenir.
- **Önceki tasarımlar:** `2026-10-21-bolum2-eda-design.md` (aynı bölümün üç sayfası); görünüm
  kuralları oradan ve Bölüm 8 tasarımından devralınır.

## Amaç ve kabul ölçütleri

Bölüm 3 (`StandardScaler`), Bölüm 4 (PCA öncesi ölçekleme) ve Bölüm 5 (`GaussianNB`) normal
dağılımı ve z-skorunu bilinen sayar; öğrenci ilk kez bir sınıflandırıcının içinde karşılaşmasın.
Öğrenci şunları kavramalı:

1. Simetrik, tek tepeli bir histogramın üstüne iki sayıyla (μ, σ) belirlenen bir çan eğrisi
   oturur; μ eğriyi kaydırır, σ genişletir; eğrinin altındaki toplam alan her zaman 1'dir.
2. Olasılık eğrinin yüksekliği değil, bir aralığın altındaki alandır.
3. 68–95–99,7 kuralı: değerlerin yaklaşık %68'i μ ± 1σ, %95'i μ ± 2σ, %99,7'si μ ± 3σ içinde.
4. z-skoru "bu değer ortalamadan kaç standart sapma uzakta?" sorusunun cevabıdır.
5. Çarpık veride kural tutmaz; `StandardScaler` (z-skoru) veriyi normalleştirmez, yalnızca
   kaydırıp ölçekler, şekli (çarpıklığı) aynı kalır.

Kabul ölçütleri:

1. Yeni sayfa yayında: `normal-dagilim/` ("Normal dağılım ve standart sapma", 8 adım), Ders ve
   Laboratuvar modunda çalışır. Ana sayfada Bölüm 2'nin dördüncü kartı olarak
   `dagilim-carpiklik`'ten hemen sonra "hazır" görünür: 25 kavram, 20 hazır, 5 yakında.
2. Ekrandaki her sayı (ortalama, standart sapma, medyan, çarpıklık, histogram sayımları, alanlar,
   örneklem oranları, z-skorları) tarayıcıda hesaplanır ve birim testinde üreticinin yazdığı
   pandas / numpy / scipy fixture'ıyla doğrulanır (alanlar ve yoğunluklar 1e-6 içinde).
3. Senaryo metinlerindeki sayılar veriden okunur, elle yazılmaz.
4. 1280×720'de Ders ve Lab adımlarında yazı yazının üstüne binmez, hiçbir şey kırpılmaz; 900 px
   altında tek sütun, 390 px'te yatay taşma yok (`dar-ekran.spec.ts` kayıt defterindeki hazır
   sayfaları otomatik kapsar).
5. `olcekleme/` ve `naive-bayes/` sayfalarının Lab notlarına yeni sayfayı anan birer cümle
   eklenir (geri bağlantı); yeni sayfanın son adımı bu iki sayfaya ve `dagilim-carpiklik/`'e
   bağlantı verir.
6. `npm run check` yeşil; kontrolcü ekran görüntülerine kendisi bakar.

## Kararlar

| Konu | Karar | Neden |
|---|---|---|
| Yer | Bölüm 2, `dagilim-carpiklik`'ten sonra ayrı sayfa | Onaylanan öneri |
| Kimlik / başlık | `normal-dagilim`, "Normal dağılım ve standart sapma" | Benim kararım: kayıt defteri kalıbı (kebab, Türkçe karaktersiz) |
| Veri | Üretici iki sentetik örneklem yazar: 200 sınav notu (normale yakın) ve 200 çağrı süresi (sağa çarpık) | Benim kararım: kitapta normal örnek yok; kitap "sınıf ortalaması 70" örneğini ve "çağrı süresi" çarpık değişkenini anar; n = 200 kuralın örneklemde görülmesine yeter |
| Standart sapma | Adım 1–7'de pandas `std()` (ddof = 1); adım 8'de `StandardScaler` (ddof = 0) | Kitapla aynı araçlar; fark bir Lab notunda açıklanır |
| Eğri | Örneklemin ortalaması ve standart sapmasıyla N(μ, σ) | Benim kararım: "veriye oturan eğri" mesajı |
| Histogram | Yoğunluk ölçeğinde (yükseklik = sayı / (n · genişlik)), sabit kova genişliği (sınav 5 puan, çağrı 1 dakika) | Eğri ile aynı ölçekte durur; sabit kenarlar sayımı elle okunur kılar |
| Alanlar | Teorik alan Φ ile (tarayıcıda erf yaklaşımı, scipy'ye karşı 1e-6), yanında örneklem oranı | Kural "teori ↔ veri" karşılaştırmasıyla öğretilir |
| Ortak sahne parçası | Yoğunluk eğrisi + alan boyama `src/core/plot/density.ts`'e | AGENTS.md "Chapter pace": Bölüm 5 GaussianNB sahnesi de çan eğrisi çizer |
| Görünüm | `dagilim-carpiklik` sayfasının dili (sayı doğrusu, tek path histogram, formül şeridi, işaretler) | Aynı bölümün kardeş sayfası |

## Kapsam dışı

- Merkezi limit teoremi, örnekleme dağılımları, güven aralıkları, hipotez testleri.
- Normallik testleri (Shapiro–Wilk, Q–Q grafiği) — Q–Q yalnızca bir Lab notunda adıyla anılır.
- Çok değişkenli normal dağılım.
- `naive-bayes/scene-gauss.ts`'in yeni `density.ts`'e taşınması (ileride; bu iş yalnız yeni
  katmanı yazar).
- `dagilim-carpiklik` sahnesine bağlantı eklenmesi (adım 9'un iki bağlantısı aynı kalır).
- Kitabın düzeltilmesi.

## Ortak öğretim dili ve görünüm

Bölüm 2 ve 8 kuralları aynen: metin boyutları yalnız `--fs-*` belirteçlerinden; SVG'lerde
viewBox yok; sayılar Türkçe ondalık virgülüyle (ortalama ve standart sapma 1 ondalık, alanlar 3
ondalık, yüzdeler 1 ondalık, z-skoru 2 ondalık, çarpıklık 2 ondalık); `prefers-reduced-motion`
altında son durum anında çizilir; adım kartı Lab'de `labText` gösterir (Lab'in değiştirdiği
sayıları içermez, yalnız o adımda görünen kontrolleri anar, yön sözcüğü yok).

- Renkler `core/plot/marks.ts` paletinden: eğri lacivert (`NAVY`), alan ve bantlar vurgu
  tonları (iç bant koyu, dış bantlar açık), histogram `dagilim-carpiklik` çubuk rengi; ortalama
  işareti turuncu üçgen, medyan lacivert baklava (kardeş sayfayla aynı). Renk tek taşıyıcı
  değildir: bantlar ayrıca etiketle ("±1σ") verilir.

## Veri (`scripts/make_normal_data.py`)

- Çıktı: `src/concepts/normal-dagilim/data/normal_data.json` (yalnız üretici yazar; elle
  düzenlenmez). Belirlenimci: iki çalıştırma bayt bayt aynı dosyayı verir; `--check` kayma
  denetimi (diğer `make_*_data.py` kalıbı).
- **sinav:** `numpy.random.default_rng(seed)`, `normal(70, 10, 200)`, tamsayıya yuvarlanır,
  0–100'e kırpılır. Tohum 0'dan başlayarak aranır; ilk tohum şu koşulları sağlamalı: ortalama
  69,5–70,5; std (ddof 1) 9,5–10,5; |çarpıklık| < 0,2; ±1σ / ±2σ / ±3σ örneklem oranları sırasıyla
  0,65–0,71 / 0,93–0,97 / ≥ 0,99. Eksen alanı 30–110, kova kenarları 30, 35, …, 110.
- **cagri:** aynı kalıpla `lognormal(mean=1.3, sigma=0.6, 200)`, 1 ondalığa yuvarlanır. Koşul:
  çarpıklık > 1, ortalama > medyan, ±1σ örneklem oranı ≥ 0,75 (kuralın tutmadığı görünsün).
  Eksen alanı 0 – (en büyük değerin üstündeki ilk tam sayı); kova genişliği 1 dakika.
- **Fixture (her örneklem için):** pandas ortalama, std (ddof 1), medyan, çarpıklık (pandas
  `skew`, `core/stats.ts` `skewness` ile aynı tanım), sabit kenarlarla `numpy.histogram`
  sayımları, k = 1, 2, 3 için μ ± kσ içindeki örneklem sayıları (sınırlar dahil), `StandardScaler`
  sonrası ortalama, std (ddof 0) ve çarpıklık; scipy `norm.cdf` ile k = 1, 2, 3 bant alanları
  (0,683 / 0,954 / 0,997) ve adımların sabit noktaları (sinav için P(60 ≤ X ≤ 80), z(85),
  Φ(z(85))); `norm.pdf` birkaç noktada. Üretici koşullardan biri tutmazsa çıkış 1 ile durur.

## Hesap (saf TS)

- `src/core/stats.ts`'e: `normPdf(x, mu, sigma)`, `normCdf(x, mu, sigma)` (erf yaklaşımı,
  mutlak hata ≤ 1e-7), `std(xs, ddof = 1)`. Mevcut `zscores` (ddof 0) adım 8'de kullanılır.
- Sayfanın `view.ts`'i: sabit kenarlı yoğunluk histogramı, bant sayımları, alan, z.

## Sayfa — `normal-dagilim/`

### Görünüm

Üstte **çizim alanı**: altta x ekseni (core sayı doğrusu, başlık "Sınav notu (puan) · n = 200"
ya da "Çağrı süresi (dakika) · n = 200"), üstünde yoğunluk histogramı (tek path, kova başına bir
alt yol), histogramın üstünde çan eğrisi (tek path). Ortalama işareti ve ±kσ çizgileri eğri
boyunca. Adım 6–8'de x ekseninin altında ikinci bir **z ekseni** (−3 … 3 tamsayı işaretleri, x
eksenindeki μ + zσ noktalarıyla hizalı). Altta formül şeridi (`p.formula`, `renderStrip`).
Yoğunluk ekseninde sayı yoktur (yükseklik olasılık değildir); eksen yerine taban çizgisi.

### Adımlar (Ders)

Sayılar aşağıda yaklaşık örnek değerdir; metinler ve şerit veriden okur.

1. **`histogram` — Simetrik bir histogram.** 200 öğrencinin sınav notu: ortalama ≈ 70,
   standart sapma ≈ 10. Histogram tek tepeli ve iki yana simetrik; ortalama ile medyan neredeyse
   aynı yerde. Şerit: `n = 200 · ortalama = … · medyan = … · std = …`.
2. **`egri` — Çan eğrisi.** Histogramın üstüne μ = ortalama, σ = std ile çizilen eğri oturur:
   normal dağılım (normal distribution). Şerit formülü verir:
   `f(x) = 1 / (σ√(2π)) · e^(−(x − μ)² / (2σ²)) · μ = … · σ = …`. Terim:
   "normal dağılım (normal distribution)".
3. **`mu-sigma` — İki sayı, bir eğri.** Ana eğrinin yanında aynı μ ile σ = 5 ve σ = 15 için
   kesikli iki eğri (etiketli). "σ küçülünce eğri daralır ve yükselir, büyüyünce genişler ve
   basıklaşır; alan her zaman 1. μ ise eğriyi yatayda kaydırır." Terim: "ortalama μ · standart
   sapma σ (standard deviation)".
4. **`alan` — Olasılık alandır.** 60 ile 80 arası boyanır: P(60 ≤ X ≤ 80) = Φ(z₈₀) − Φ(z₆₀) ≈
   0,68; örneklemde bu aralıkta N öğrenci (%…). "Eğrinin yüksekliği olasılık değildir; olasılık bir
   aralığın altındaki alandır." Terim: "olasılık yoğunluğu (probability density)".
5. **`kural` — 68–95–99,7.** İç içe üç bant: μ ± 1σ, ± 2σ, ± 3σ; her bandın etiketi teorik ve
   örneklem yüzdesini yazar. Şerit:
   `±1σ: %68,3 (örneklem %…) · ±2σ: %95,4 (…) · ±3σ: %99,7 (…)`. Terim:
   "68–95–99,7 kuralı (empirical rule)".
6. **`z-skor` — Ortalamadan kaç σ?** x = 85 işaretlenir; z ekseni belirir. Şerit:
   `z = (85 − μ) / σ = … · Φ(z) = …`; metin "85 alan öğrenci ortalamanın yaklaşık 1,5 standart
   sapma üstünde; teorik olarak sınıfın %…'inden yüksek." Terim: "z-skoru (z-score)".
7. **`carpik` — Çarpık veride kural tutmaz.** Seri çağrı süresine geçer: sağa çarpık histogram;
   aynı ortalama ve std ile çizilen normal eğri oturmaz (sol kuyruğu 0'ın altına taşar), ±1σ
   bandında %68 yerine %… değer var; ortalama medyandan büyük. Şerit:
   `çarpıklık = … · ±1σ: örneklem %… (normalde %68,3) · ortalama … > medyan …`. `dagilim-carpiklik`
   sayfasına sözle atıf ("kuyruk sağda").
8. **`olcekleme` — z-skoru şekli değiştirmez.** Çağrı süreleri `StandardScaler` ile z'ye çevrilir:
   x ekseni z ekseni olur, ortalama 0, std 1; histogramın şekli aynı kalır, çarpıklık aynı. Şerit:
   `StandardScaler: ortalama … → 0 · std … → 1 · çarpıklık … → …`. "Ölçekleme veriyi normal yapmaz;
   normal yapmak için dönüşüm (log1p) gerekir." Sahnede üç bağlantı: "Dağılım ve çarpıklık"
   (`../dagilim-carpiklik/`), "Ölçekleme ve veri sızıntısı" (`../olcekleme/`), "Naive Bayes"
   (`../naive-bayes/`).

### Laboratuvar

- **Seri seçici** (sinav / cagri): adım 1, 2, 5, 7, 8.
- **μ ve σ kaydırıcıları** (adım 3): μ 30–110 adım 1, σ 3–20 adım 0,5; histogram referans olarak
  yerinde kalır; şerit tepe yüksekliğini `1 / (σ√(2π))` olarak yazar. Seri değişince μ ve σ
  kaydırıcıları o serinin ortalama ve std'sine döner.
- **a ve b kaydırıcıları** (adım 4): eksen alanında adım 1 (cagri'de 0,5); P(a ≤ X ≤ b) ve
  örneklem oranı canlı yazılır.
- **k seçici** (adım 5 ve 7): 1 / 2 / 3; yalnız o bant boyanır.
- **x kaydırıcısı** (adım 6): eksen alanında; z ve Φ(z) canlı.
- Adıma göre yalnız o adımın kontrolleri görünür; kontrolü olmayan adımda kart gizlenir
  (`dagilim-carpiklik` kalıbı: `data-off`).
- Lab notları (kısa, kullanıcı girdisi yok): eğri yüksekliği olasılık değildir (tek noktanın
  olasılığı 0); pandas `std()` ddof 1, `StandardScaler` ddof 0 (n = 200'de fark küçük); kural yalnız
  normale yakın veride geçerli (Q–Q grafiği bir denetimdir); |z| > 3 aykırılık için kaba bir
  işarettir, çarpık veride IQR daha dayanıklıdır; GaussianNB her özelliğin sınıf içinde normal
  dağıldığını varsayar (Bölüm 5). Ve adımın canlı notu.

### Geri bağlantılar

- `olcekleme/` Lab notlarına bir cümle: z-skoru ve 68–95–99,7 kuralı için "Normal dağılım ve
  standart sapma" sayfası (Bölüm 2).
- `naive-bayes/` Lab notlarına bir cümle: Gauss (çan) eğrisinin kendisi için aynı sayfa.
- Bu iki sayfanın Ders metinleri ve sahneleri değişmez.

## Kitapla farklar (kitap düzeltmesi için liste)

- Kitap normal dağılımı ayrı bir başlıkta vermez; Bölüm 3, 4 ve 5 onu bilinen sayar. Sayfa bu
  boşluğu Bölüm 2'de doldurur.
- Kitap çarpıklığı "simetriden uzaklaşma" diye tanımlar; referans şekil (normal) adıyla anılmaz.

## Arayüzler

- Sayfa mevcut `ConceptPage<Params>` sözleşmesini sağlar; `StepPlayer` adım sözleşmesi değişmez;
  adım indeksleri `stepIndex` ile kimliklerden türetilir; Lab metni `Step.labText`.
- Kimlik ve yol: `normal-dagilim` → `normal-dagilim/`; kayıt defterinde `dagilim-carpiklik`'ten
  hemen sonra, bölüm 2.
- Parametreler (öneri, yapıcıya bırakılır):
  `{ seri: 'sinav' | 'cagri'; mu: number; sigma: number; a: number; b: number; x: number; k: 1 | 2 | 3 }`.
- `src/core/plot/density.ts`: `curvePath(f, x0, x1, n, sx, sy)` ve
  `areaPath(f, a, b, n, sx, sy, baseY)` (saf, string döner; `n` örnek sayısı), çağıran sahne
  path'leri kendisi yönetir.
- `src/core/stats.ts`: `normPdf`, `normCdf`, `std` (yukarıda).

## Hata durumları

- σ hiçbir zaman 0 olmaz (kaydırıcı alt sınırı 3).
- a > b: alan ve sayım min/max ile hesaplanır, boyama iki değer arasında; şerit küçüğü önce yazar.
- a = b: alan 0, şerit "P = 0 (tek noktanın olasılığı 0)".
- Seri değişince Lab değerleri yeni serinin eksen alanına kırpılır.
- Hiçbir durumda NaN / Infinity ekrana basılmaz.

## Doğrulama

- Birim: `core/stats` yeni fonksiyonları fixture'a karşı (pdf, cdf 1e-6); `density.ts` path
  testleri (örnek sayısı, alanın a–b arasında kalması); veri fixture testleri (sayımlar, bant
  sayımları, StandardScaler sonrası değerler); senaryo adım kimlikleri ve metinlerdeki sayıların
  veriden geldiği; görünüm (her adımın şeridi); sahne (her adımın anahtar DOM öğesi: eğri, bantlar,
  alan, z ekseni, bağlantılar); kontroller (adıma göre görünürlük, seri değişince μ/σ sıfırlama,
  a > b).
- e2e (yalın): Ders anahtar adımları 2, 5, 6, 7, 8 ve iki Lab etkileşimi (adım 3 σ kaydırıcısı,
  adım 4 a/b kaydırıcıları) ekran görüntüsü temeliyle; etiket çakışması ve sahne dışına taşma
  denetimi (önceki bölümlerin yardımcıları).
- Performans: Lab σ kaydırıcısı sürükleme p95 ≤ 25 ms (bir kez, seri).
- Kapanış: `npm run check` çıkış 0; kontrolcü ekran görüntülerine kendisi bakar.

## Yapıcıya bırakılanlar

Dosya bölünmesi, parametre adları, eğri örnek sayısı, bant tonları, etiket yerleşimi (çakışmasız),
z ekseninin dikey yeri, geçiş süreleri.
