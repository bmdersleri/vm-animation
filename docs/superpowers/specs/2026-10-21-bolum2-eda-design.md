# Bölüm 2 — EDA ve istatistiksel görselleştirme sayfaları — Tasarım

- **Tarih:** 2026-10-21
- **Kaynak:** Hocanın isteği: "vmAnimation projesini incele ve bölüm 2'yi hazırla." Kapsam sorusuna verilen yanıt: **üç sayfa** — registry'deki iki karta ek olarak korelasyon ve ısı haritası. Bütün kararları tasarımcı verdi; hepsi sonda "Tasarımcının kararları" altında listelenir. `main`'e birleştirme ve push için hocanın sohbetteki onayı yine gerekir.
- **Kitap:** *Modern Veri Madenciliğine Giriş*, Bölüm 2, `C:\projects\ModernVeriMadenGiris\chapters\ch02_eda_gorsellestirme\content\final.md`. Satır aralıkları:
  - EDA tanımı ve yaygın hatalar 82–182,
  - dağılım ve betimsel istatistikler 183–266 (002 örneği, Şekil 2.2),
  - çarpıklık 267–325 (003 örneği),
  - korelasyon 326–406 (004 örneği, Şekil 2.3),
  - kutu grafiği 407–463 (005 örneği),
  - ısı haritası 464–527 (006 örneği, Şekil 2.4),
  - çalışan mini uygulama (`OgrenciEDA`) 528–657,
  - gerçek dünya tuzakları 658–726,
  - kuramsal çerçeve 727–743,
  - bölüm özeti 860–880,
  - sözlük 881–897.
  - Anscombe Dörtlüsü bölümün açılışında (63, 69) ve özetinde (865) anılır; kitapta veri tablosu yoktur, klasik dörtlü kullanılır.
- **Önceki tasarımlar:**
  - `docs/superpowers/specs/2026-10-20-vm-animasyon-knn-design.md`: ortak iskelet (§4), kırmızı çizgiler (§3) ve görsel kimlik oradan aynen geçerlidir.
  - `docs/superpowers/specs/2026-10-20-bolum5-karar-agaci-naive-bayes-design.md`: ortak grafik çekirdeği, iskelet betiği, e2e bölünmesi ve ekran görüntüsü testleri oradan gelir.
  - `docs/superpowers/specs/2026-10-21-bolum3-on-isleme-design.md`: sayı biçimi kuralı (sıfır olmayan değer "0,00" yazılmaz), formül şeridi, fikstür yöntemi ve Lab yerleşimi oradan gelir.
  - `docs/superpowers/specs/2026-10-21-bolum4-boyut-indirgeme-design.md`: çoklu panel sahnesi, renk + şekil kuralı ve performans ölçüm yöntemi oradan gelir.

## Amaç ve kabul ölçütleri

Ana sayfada Bölüm 2'nin üç kartı olur: `dagilim-carpiklik`, `kutu-grafigi` ve yeni `korelasyon-isi-haritasi`. Üçü de animasyonlu sayfaya kavuşur. Sayfalar, kitabın bölüm özetindeki iki cümleyi öğrencinin gözünde somutlaştırmayı hedefler:

- **"Özet istatistik tek başına yeterli değildir, grafik şart."** Anscombe Dörtlüsü'nün dört veri kümesi aynı ortalama, varyans ve korelasyonu verir; grafikleri büsbütün farklıdır.
- **"Ortalama ile medyan arasındaki fark büyüdükçe dağılım simetrik olmayabilir."** Tek bir uzun kuyruk ortalamayı çeker, medyanı yerinde bırakır.

Sayfaların hedeflediği beş zor an:

- **Ortalama neden medyandan büyük?** Kuyruk uzadıkça ortalama sağa kayar; medyan aynı kalır. Çarpıklık bu farkı tek sayıya indirir.
- **Histogramın şekli verinin mi, kovanın mı?** Aynı 10 değer, 3 / 5 / 10 kovada üç farklı resim verir.
- **Kutudaki nokta hatalı veri mi?** Kutu grafiğinin noktası yalnızca "olağan dışı" der; 1,5 × IQR kuralı ve n = 5 uyarısı birlikte okunur.
- **Aynı r nasıl dört farklı veri olur?** Anscombe panelleri aynı istatistikleri, farklı örüntüleri gösterir; tek nokta r'yi eksiye de çevirir.
- **Korelasyon nedensellik mi?** Güçlü katsayı üçüncü değişkeni, ters nedenselliği ve rastlantıyı dışlamaz.

Kabul ölçütleri:

1. `dagilim-carpiklik/`, `kutu-grafigi/` ve `korelasyon-isi-haritasi/` sayfaları yayında. Ana sayfadaki üç kart `hazir` durumunda ve bu sayfalara bağlı.
2. Hoca, üç sayfayı Ders modunda yalnızca klavyeyle (→ / ←) baştan sona anlatabiliyor. 1280×720'de k-NN tasarımının §3'teki yazı boyutu eşikleri her adımda sağlanıyor. Sayfa kaymıyor, sahnedeki hiçbir yazı ekran dışına taşmıyor ve hiçbir etiket bir başkasının üstüne binmiyor.
3. Sayfalardaki her sayı, kitabın kodunun aynı veriyle pandas / numpy'de verdiği sonuçla aynı. Bu, Python betiğinin ürettiği fikstüre karşı birim testleriyle doğrulanır. Bağlantılı API'ler: `Series.mean`, `median`, `std`, `skew`, `quantile` (`linear`), `Series.corr` (`pearson`), `numpy.histogram`, `scipy.stats.spearmanr`, `matplotlib` / seaborn kutu ve ısı haritası kuralları (1,5 × IQR bıyıkları, sınırın içindeki en uç gözlem).
4. Her formül şeridi, değerleri yerine konmuş hâliyle görünür. Hiçbir sıfır olmayan değer "0,00" ya da "%100" diye yazılmaz (Bölüm 3 kuralı: gerekirse en çok 6 basamağa kadar uzatılır); ısı haritası hücreleri bu yüzden 3 basamak yazar ("0,995", köşegen "1,000").
5. Lab'deki sürükleme ve kaydırıcılar takılmadan akıyor. Playwright performans testleri k-NN'deki p95 yöntemiyle ölçer.
6. k-NN, Karar Ağacı, Naive Bayes, `iqr-aykiri`, `olcekleme`, `pca` ve `ozellik-secimi` sayfaları davranış olarak değişmiyor. Mevcut testlerin hepsi geçiyor.

## Kararlar

| Konu | Karar | Neden |
|---|---|---|
| Sayfa sayısı | Üç sayfa: `dagilim-carpiklik` (dağılım + çarpıklık), `kutu-grafigi` (çeyrekler + bıyıklar + aykırı), `korelasyon-isi-haritasi` (korelasyon + ısı haritası + Anscombe) | Kitabın beş tekniğinin hepsi anlatılır. İlk ikisi registry'de zaten planlıydı; üçüncüsü kitabın amiral örneğini (Anscombe) ve nedensellik uyarısını taşıyor, onsuz bölüm yarım kalıyor. |
| Yeni kart | `korelasyon-isi-haritasi`, Bölüm 2, başlık "Korelasyon, ısı haritası ve Anscombe Dörtlüsü" | Kartın içeriği başlıkta görünsün (Bölüm 3 kuralı). |
| Kart başlıkları | `dagilim-carpiklik`: "Dağılım, ortalama–medyan ve çarpıklık"; `kutu-grafigi`: "Kutu grafiği: çeyrekler ve aykırı değerler" | Mevcut "Dağılım ve çarpıklık" / "Kutu grafiği" başlıkları içeriği eksik anlatıyor; sayfa başlıkları da aynı olur. |
| Veri tanıma (`head`, `dtypes`, `isnull`) | Animasyon yok; Lab metni ve `korelasyon-isi-haritasi` sayfasının son adımı | Tek satırlık denetim görsel bir "an" taşımıyor. Kitabın ilk tekniği iki cümleyle anılır. |
| Veri | Kitabın 002, 003, 004, 005 ve 006 örnekleri aynen: [8,10,12,12,14,15,18,20,25,30], [5,6,7,8,8,9,10,11,12,28], 7 öğrencilik üç değişken, iki bölüm × 5 not, 6 öğrencilik dört değişken | Öğrenci kitapta gördüğü sayıyı ekranda bulur. Python betiği kitabın değerlerini assert eder. |
| Üçüncü şekil | Simetrik [10,12,14,15,16,16,17,18,20,22] ve sol çarpık [4,8,10,12,13,14,14,15,16,17] serileri (n = 10) | Kitabın 003 serisi sağ çarpık örnektir; simetri ve sol çarpıklık için aynı n'de iki seri gerekir. Değerler kitabın cümlesini ("çarpıklık simetriden hangi yöne uzaklaştığını gösterir") görünür kılar. |
| Log dönüşümü | `log1p`, 002 serisinde 0,90 → 0,25; 003 serisinde 2,54 → 1,50 | Kitap çarpık değişkende "logaritmik dönüşüm" ihtimalini söyler ama sonucu göstermez. 002'de kuyruk gerçekten söner; 003'te yarıya iner, sıfıra inmez — "log her şeyi düzeltmez" dersi. |
| Kutu grafiğinde 6. öğrenci | Lab parametresi; Bilgisayar'a 66, Elektrik'e 62 eklenir | n = 5'te çeyrekler tam gözleme düşer, ara değer görünmez. 6. değer hem ara değeri hem de sınırların kaydığını gösterir: Elektrik'te 55 artık aykırı değil. |
| Üçüncü grup | Makine [50,66,72,78,94] (medyan 72, IQR 12) | Elektrik'le aynı medyan, daha geniş yayılım: kutu grafiğinin medyanı ve yayılımı birlikte gösterdiğini kanıtlar. |
| Anscombe | Klasik dörtlü, 4 × 11 nokta; özetler birebir kullanılır | Kitabın açılış ve özet cümlesinin tek somut kanıtı. Set IV'ün tek kaldıraç noktası sürüklenebilir. |
| Isı haritası basamakları | Hücreler 3 basamak ("0,995"; köşegen "1,000") | Kitabın şekli "1.00" yazar; 0,9954'ü "1,00" yazmak köşegenle farkı gizler ve Bölüm 3'ün biçim kuralına aykırıdır. |
| Bilgi sızıntısı | Animasyon yok; 9. adımda iki kutu (tüm veri / yalnız eğitim) ve metin | Sızıntının görsel bir "an"ı bu veri boyutunda yok; kural kitabın kendi cümlesiyle verilir (`olcekleme` sayfasında animasyonu zaten var). |
| e2e | Bölüm temposu kuralı: işlevsel e2e ve ekran görüntüleri yalnızca anahtar adımlarda; performans testleri bölüm sonunda bir kez | AGENTS.md § Chapter pace. |
| Ortak kod | `src/core/stats.ts`'e `skewness` ve `histCounts`; geri kalanı sayfa içinde | İki sayfa (A ve C) aynı çarpıklık hesabını kullanır; histogram yalnızca A'da var, kutu/ısı haritası tek sayfada. |

## Kapsam dışı

- `OgrenciEDA` mini uygulamasının animasyonu: sınıf tasarımı bir mühendislik dersi, görsel bir an değil. Lab metninde bir cümle.
- Violin grafiğinin gerçek KDE'si yerine küçük örneklem uyarısı: 8. adımda şematik yoğunluk eğrisi (Silverman bandı) çizilir, "n = 5'te tahmin zayıf" yazar. Ayrı bir violin sayfası yok.
- Spearman hesabı canlı değil: 7. adımda değeri (0,691) yazılır, Lab metninde bir cümle. Sayfa Pearson'ı canlı hesaplar.
- Q-Q grafiği, normalite testleri, pairplot, scatter matrix: yalnızca Lab metninde birer cümle.
- Korelasyon ısı haritasında kümeleme, `annot` dışı biçimlendirme, seaborn teması taklidi yok.
- Telco Churn capstone katkısı (veri sözlüğü + EDA notu) sayfa içinde anlatılmaz; Lab metninde bir cümle.
- Bölüm 3 ve 5'ten ertelenen cila maddeleri (`.remember/remember.md` → Deferred polish).

## Kırmızı çizgiler

k-NN tasarımının §3'ü aynen geçerlidir. Bu üç sayfada özellikle:

- **Formül şeritleri, eksen etiketleri ve değer etiketleri Ders'te gövde boyutundan (< 22 px) küçük yazılamaz.** Şerit tek satıra sığmazsa iki satıra kırılır. Yine sığmazsa metin kısaltılır ya da adım ikiye bölünür, yazı küçültülmez.
- **Değer etiketleri** (ortalama, medyan, Q1, Q3, sınırlar, r, çarpıklık) Ders'te ≥ 18 px ve birbirinin üstüne binmez. Üst üste gelen iki değer varsa etiketler dikeyde kaydırılır (k-NN'deki `stackLevels`).
- **Renk + şekil:** Her işaret türü renkle birlikte şekille de ayrılır:
  - ortalama: turuncu **üçgen** ve düz çizgi,
  - medyan: lacivert **baklava** ve kesik çizgi,
  - Q1 / Q3: lacivert **kare** ve düz çizgi,
  - aykırı değer: turuncu **içi boş baklava**,
  - ısı haritası: renk + hücre içi sayı (yalnız renk yetmez),
  - Anscombe setleri: her panel kendi rengi + panel numarası.
- **Isı haritası erişilebilirliği:** Her hücrede sayı yazılır; renk ikinci kanaldır. Kırmızı–mavi ölçek 0 etrafında simetrik (−1…+1), köşegen çerçeveli.
- **Sayılar yuvarlanmış görünür, hesap tam duyarlıkla yapılır.** Sayfa kendi içinde hesaplar; fikstür yalnızca test içindir.
- **n = 10 ve n = 5 gibi küçük örneklemler sayfada saklanmaz;** her adımda n görünür ve küçük örneklem uyarısı son adımda yazılır.

## Ortak görsel öğeler

- **Sayı doğrusu:** Bölüm 3'ün `src/core/plot/number-line.ts` bileşeni; noktalar tek `path`, etiketler `stackLevels` ile dizilir.
- **Histogram:** Eksen + kova sütunları; sütun üstünde sayı, altında kova aralığı. Kova sınırları `numpy.histogram` ile aynı (`linspace(min, max, bins + 1)`, son kova sağdan kapalı).
- **İşaret çizgileri:** Ortalama (turuncu üçgen + düz), medyan (lacivert baklava + kesik); sahnenin üstünde etiket şeridi.
- **Kutu:** Q1–Q3 arası dolu kutu, içinde medyan çizgisi, dışında bıyıklar (en uç iç gözleme kadar) ve sınır çizgileri (kesik, soluk), aykırılar içi boş baklava.
- **Isı haritası:** Kare hücreler, hücre içi değer, satır/sütun adları; renk ölçeği sağda dikey şerit (−1…+1).
- **Formül şeridi:** Sahnenin altında, değerleri yerine konmuş tek ya da iki satır (Bölüm 3 ile aynı bileşen).
- **Dört panel:** Anscombe için 2 × 2 eşit panel; her panelde eksen aralığı aynı (x 2–20, y 2–14) ki farklar örüntüden gelsin.

## `dagilim-carpiklik` sayfası — Dağılım, ortalama–medyan ve çarpıklık

**Kitap atfı:** Bölüm 2, "Dağılım ve betimsel istatistikler" (002 örneği) ve "Çarpıklık" (003 örneği).

**Terimler (kitapla uyumlu):** dağılım (distribution), histogram, ortalama (mean), medyan (median), standart sapma (standard deviation), çarpıklık (skewness), sağ kuyruk / sol kuyruk, kova (bin), logaritmik dönüşüm (log transform), uç değer (outlier), dayanıklı özet (robust summary), simetri (symmetry).

### Veri

- **002:** `[8, 10, 12, 12, 14, 15, 18, 20, 25, 30]` — n = 10.
- **003:** `[5, 6, 7, 8, 8, 9, 10, 11, 12, 28]` — n = 10.
- **Simetrik:** `[10, 12, 14, 15, 16, 16, 17, 18, 20, 22]` — n = 10.
- **Sol çarpık:** `[4, 8, 10, 12, 13, 14, 14, 15, 16, 17]` — n = 10.

Kontrol değerleri (testlerde sabit):

| Seri | Ortalama | Medyan | Std (ddof 1) | Çarpıklık (pandas G1) | Kova 3 | Kova 5 | Kova 10 |
|---|---|---|---|---|---|---|---|
| 002 | **16,4** | **14,5** | 6,93 | **0,90** | [6,2,2] | [4,2,2,1,1] | [2,2,1,1,1,1,0,1,0,1] |
| 003 | **10,4** | **8,5** | 6,55 | **2,54** | [9,0,1] | [6,3,0,0,1] | [3,3,2,1,0,0,0,0,0,1] |
| Simetrik | **16** | **16** | 3,56 | **0** | [2,5,3] | [2,1,4,1,2] | [1,1,0,1,1,3,1,0,1,1] |
| Sol | **12,3** | **13,5** | 3,97 | **−1,06** | [2,2,6] | [1,1,1,4,3] | [1,0,0,1,1,0,2,2,1,2] |

- **003 uç değeri sürüklendiğinde:** 28 → 32 → 36 → 40 → 45 → 50 → 60; ortalama 10,4 → 13,6, medyan **8,5 sabit**, çarpıklık 2,54 → 3,06.
- **Log dönüşümü:** `log1p(002)` çarpıklığı **0,25** (ortalama 2,79, medyan 2,74); `log1p(003)` çarpıklığı **1,50** (ortalama 2,33, medyan 2,25).
- **Eşikler (kitabın yorum çerçevesi):** |çarpıklık| < 0,5 ≈ simetrik; 0,5–1 orta; > 1 güçlü. Sayfa bu eşikleri 9. adımda yazar; çarpıklık değeri tek başına dönüşüm zorunluluğu değildir.

### Adımlar (Ders) — 9 adım

**Bölüm 1 — Dağılım ve ilk özet (002 verisi)**

1. **Noktalar.** On öğrencinin haftalık çalışma saati sayı doğrusunda: n = 10, en düşük 8, en yüksek 30. Değerlerin çoğu 8–20 arasında, 25 ve 30 sağda ayrı duruyor. Şerit: "n = 10 · en düşük 8 · en yüksek 30". Terim: dağılım (distribution).
2. **Histogram.** Beş kova: [8–12,4), [12,4–16,8), ... Yükseklikler sırasıyla 4, 2, 2, 1, 1. Şerit: "bins = 5 → 4, 2, 2, 1, 1". Mesaj: dağılımın biçimi ilk kez görünür. Terim: histogram.
3. **Ortalama ve medyan.** Ortalama çizgisi 16,4'te (turuncu üçgen), medyan 14,5'te (lacivert baklava) belirir. Şerit: "(8 + 10 + … + 30) / 10 = 16,4; ortadaki iki değer (14 + 15) / 2 = 14,5". Mesaj: ortalama sağdaki iki değer yüzünden medyandan 1,9 saat büyük. Terim: ortalama (mean) · medyan (median).
4. **Çarpıklık.** Sağ kuyruk vurgulanır; çarpıklık 0,90. Şerit: "çarpıklık = 0,90 > 0: sağ kuyruk uzun". Mesaj: ortalama–medyan farkı bir sayıya dönüşür. Terim: çarpıklık (skewness).
5. **Kova sayısı.** Kova sayısı 3 / 5 / 10 seçilir; aynı 10 değer üç farklı resim verir. Şerit canlı: "bins = 3 → 6, 2, 2" gibi. Mesaj: histogramın şekli kova seçimine duyarlıdır; kova sayısı veriyle birlikte yazılmalıdır. Terim: kova (bin).
6. **Log dönüşümü.** `log1p` açılır; noktalar log eksenine kayar, kuyruk sıkışır, çarpıklık 0,90 → 0,25. Şerit: "log1p: çarpıklık 0,90 → 0,25; ortalama 16,4 → 2,79". Mesaj: dönüşüm kuyruğu kısaltır, yönü değiştirmez; her zaman sıfıra indirmez. Terim: logaritmik dönüşüm (log transform).

**Bölüm 2 — Kuyruk ve simetri (003 verisi)**

7. **Kuyruk.** Sahne 003 serisine geçer: 28 saatlik öğrenci sağda tek başına. Uç değer 28 → 60 sürüklenir; ortalama 10,4 → 13,6, medyan 8,5 sabit, çarpıklık 2,54 → 3,06. Şerit: "uç değer 60 → ortalama 13,6 · medyan 8,5 · çarpıklık 3,06". Mesaj: tek gözlem ortalamayı çeker, medyanı çekmez. Terim: uç değer (outlier).
8. **Üç şekil.** Sağ (002), simetrik ve sol seriler arasında geçilir; noktalar kayar, histogram ve işaretler canlı değişir. Şerit: "sağ: 0,90 · simetrik: 0 · sol: −1,06". Mesaj: çarpıklığın işareti kuyruğun yönünü, büyüklüğü uzunluğunu verir; simetrikte ortalama = medyan. Terim: simetri (symmetry).
9. **Kural.** Üç kutu: (a) eşikler |0,5| / |1|; (b) çarpıklık varsa özet olarak medyan + IQR kullan (dayanıklı özet); (c) uç değeri çarpıklık var diye silme — önce kaynağını incele. Altta bağlantılar: "Kutu grafiği" sayfası ve Bölüm 3 `iqr-aykiri`. Terim: dayanıklı özet (robust summary).

Adım başlıklarının ve metinlerin son hâli builder'ın işidir. Akış ve her adımın göstermesi gereken an bağlayıcıdır. Her adıma Ders'te görünen bir `term` verilir.

### Parametreler

| Parametre | Değerler | Varsayılan |
|---|---|---|
| Seri (1–4, 8) | 002 / 003 / simetrik / sol | Adıma bağlı (1–6: 002; 7: 003; 8: 002) |
| Uç değer (7) | 28–60, sürükleme ve kaydırıcı | 28 |
| Kova sayısı (2–6) | 3 / 5 / 10 | 5 |
| Log dönüşümü (1–6) | Kapalı / Açık | Kapalı |

Adımlar kendi parametrelerini k-NN'deki gibi sahiplenir. Elle verilen değer, adım değişene kadar geçerli kalır.

### Lab modu

- Uç değer sayı doğrusunda sürüklenir; ortalama, medyan, çarpıklık ve kova yükseklikleri canlı değişir.
- Kova sayısı seçimi histogramı canlı yeniden çizer.
- Seri seçimi noktaları, histogramı ve işaretleri animasyonla taşır.
- Log dönüşümü açılıp kapanır; eksen etiketleri `log1p` değerlerini ve "1p" notunu gösterir.
- Açıklama panelinde: kategorik sütunun histogram hatası (kitabın 002 yaygın hatası), "ortalama her zaman tipik değildir", standart sapmanın birimi, "sıfıra yakın çarpıklık kesin normallik kanıtı değildir", "uç değer tek başına veri hatası değildir".

## `kutu-grafigi` sayfası — Kutu grafiği: çeyrekler ve aykırı değerler

**Kitap atfı:** Bölüm 2, "Kutu grafiği" (005 örneği) ve "Yaygın hatalar".

**Terimler (kitapla uyumlu):** kutu grafiği (box plot), medyan (median), çeyrek (quartile), çeyrekler arası açıklık (IQR), bıyık (whisker), 1,5 × IQR kuralı, aykırı değer (outlier), yayılım (spread), yoğunluk (density), doğrusal ara değer (linear interpolation).

### Veri

- **Bilgisayar:** `[70, 74, 78, 82, 98]` — Q1 74, medyan 78, Q3 82, IQR 8, sınırlar 62 / 94, bıyıklar 70 / 82, aykırı 98.
- **Elektrik:** `[55, 68, 72, 76, 80]` — Q1 68, medyan 72, Q3 76, IQR 8, sınırlar 56 / 88, bıyıklar 68 / 80, aykırı 55.
- **Makine (Lab / 7. adım):** `[50, 66, 72, 78, 94]` — Q1 66, medyan 72, Q3 78, IQR 12, sınırlar 48 / 96, bıyıklar 50 / 94, aykırı yok.
- **6. öğrenci açıkken:** Bilgisayar `[66, 70, 74, 78, 82, 98]` — Q1 71, medyan 76, Q3 81, IQR 10, sınırlar 56 / 96, aykırı 98. Elektrik `[55, 62, 68, 72, 76, 80]` — Q1 63,5, medyan 70, Q3 75, IQR 11,5, sınırlar 46,25 / 92,25; **55 artık aykırı değil**.
- **k = 3:** Üç grupta da aykırı yok (Bilgisayar 50 / 106, Elektrik 44 / 100, Makine 30 / 114).
- **Ortalamalar:** 80,4 / 70,2 / 72,0.

Kutu grafiği kuralı: bıyık sınırın kendisinde değil, sınırın içindeki en uç gözlemde biter (matplotlib kuralı; Bölüm 3 `iqr-aykiri` ile aynı).

### Adımlar (Ders) — 8 adım

1. **İki grup.** İki şerit: Bilgisayar beş not, Elektrik beş not. Eksen 50–100. Şerit: "Bilgisayar n = 5 · Elektrik n = 5". Terim: grup karşılaştırması (group comparison).
2. **Medyan.** Her grup sıralanır; ortadaki değerler 78 ve 72 işaretlenir. Şerit: "Bilgisayar 78 · Elektrik 72". Terim: medyan (median).
3. **Çeyrekler.** n = 5'te Q1 ve Q3 tam gözleme düşer: 0,25 × (5 − 1) = 1 ve 0,75 × 4 = 3. konumlar. Bilgisayar Q1 74 / Q3 82, Elektrik Q1 68 / Q3 76; iki grupta da IQR 8. Şerit: "Q1 = 74 · Q3 = 82 · IQR = 8". Terim: çeyrek (quartile) · çeyrekler arası açıklık (IQR).
4. **Kutu.** Q1–Q3 arası kutu, içinde medyan çizgisi. Şerit: "kutu: 74–82 · medyan 78". Mesaj: kutunun yarısı verinin ortadaki %50'sidir. Terim: kutu grafiği (box plot).
5. **Bıyıklar.** 1,5 × 8 = 12; alt/üst sınırlar 62 / 94 (Bilgisayar) ve 56 / 88 (Elektrik). Bıyıklar sınırın içindeki en uç gözleme kadar: 70 / 82 ve 68 / 80. Şerit: "1,5 × 8 = 12 → sınırlar 62 / 94". Terim: bıyık (whisker).
6. **Aykırılar.** 98 ve 55 sınırların dışında: içi boş baklava. Şerit: "98 > 94 · 55 < 56 → aykırı". Mesaj (kitabın Sınav Notu): nokta "hatalı veri" demek değildir; kaynağı incelenir. Terim: aykırı değer (outlier).
7. **Üçüncü grup.** Makine eklenir: medyan 72 (Elektrik ile aynı), IQR 12 (8'den geniş), aykırı yok. Şerit: "medyan 72 = 72 · IQR 12 > 8". Mesaj: yalnız medyana bakan, yayılımı kaçırır. Terim: yayılım (spread).
8. **Sınır.** Kutu yoğunluğu ve n'i gizler: her grubun beş noktası şematik yoğunluk eğrisiyle (Silverman bandı) gösterilir; "n = 5: yoğunluk tahmini zayıf" yazar. k = 1,5 / 3,0 karşılaştırılır ve `iqr-aykiri` sayfasına bağlanır. Terim: yoğunluk (density).

Adım başlıklarının ve metinlerin son hâli builder'ın işidir. Akış ve her adımın göstermesi gereken an bağlayıcıdır. Her adıma Ders'te görünen bir `term` verilir.

### Parametreler

| Parametre | Değerler | Varsayılan |
|---|---|---|
| IQR katsayısı k (5–8) | 1,5 / 3,0 | 1,5 |
| 6. öğrenci (2–8) | Kapalı / Açık | Kapalı |
| Üçüncü grup (7–8) | Kapalı / Açık | Adıma bağlı (7–8: Açık) |
| Noktalar (1–8) | Gizli / Görünür | Görünür |

### Lab modu

- Her grubun uç değeri sürüklenir (Bilgisayar 60–100, Elektrik 40–90); çeyrekler, sınırlar, bıyıklar ve aykırı işaretleri canlı değişir.
- 6. öğrenci açılır/kapanır; Elektrik'te 55'in aykırı olmaktan çıktığı an vurgulanır.
- k 1,5 ↔ 3,0: sınırlar genişler, aykırılar kaybolur.
- Açıklama panelinde: "kutunun dışındaki her nokta hata değildir", "küçük örneklemde güçlü sonuç çıkarmayın", "kutu yoğunluğu gizler" ve "silmeden önce kayıt/ölçüm/iş durumu ayrıştırılır".

## `korelasyon-isi-haritasi` sayfası — Korelasyon, ısı haritası ve Anscombe Dörtlüsü

**Kitap atfı:** Bölüm 2, "Korelasyon" (004 örneği), "Isı haritası" (006 örneği) ve açılıştaki Anscombe Dörtlüsü (63, 69, 865).

**Terimler (kitapla uyumlu):** korelasyon (correlation), Pearson katsayısı, saçılım grafiği (scatter plot), nedensellik (causation), ısı haritası (heatmap), Anscombe Dörtlüsü (Anscombe's quartet), kaldıraç (leverage), doğrusal ilişki (linear relationship), sayısal kodlanmış kategori (numeric-coded category), bilgi sızıntısı (data leakage), keşifçi veri analizi (EDA).

### Veri

- **004:** 7 öğrenci — çalışma saati `[8,10,12,15,18,20,25]`, devamsızlık `[10,8,7,5,4,3,1]`, not `[58,62,68,75,82,86,94]`.
- **Korelasyonlar:** çalışma–not **0,995**; devamsızlık–not **−0,993**; çalışma–devamsızlık **−0,988**.
- **006:** 6 öğrenci, dört değişken — çalışma `[8,10,12,15,18,20]`, devamsızlık `[10,8,7,5,4,2]`, not `[58,63,68,77,84,90]`, uyku `[5,6,6,7,7,8]`. Matris (3 basamak):
  - `[[1,000, −0,991, 0,999, 0,961], [−0,991, 1,000, −0,992, −0,987], [0,999, −0,992, 1,000, 0,965], [0,961, −0,987, 0,965, 1,000]]`.
- **Anscombe (klasik dörtlü, n = 11):**
  - Her set: ortalama x **9**, varyans x **11**, ortalama y ≈ **7,5009**, varyans y ≈ **4,127**, r ≈ **0,816**, eğim ≈ **0,500**.
  - Set I: doğrusal; Set II: eğri; Set III: tek aykırı nokta sürüklüyor; Set IV: x = 8 (10 nokta) + tek kaldıraç noktası (19, 12,50).
  - Set IV'te kaldıraç noktası çıkarılınca x'in varyansı 0 olur, r **tanımsız**.
  - Kaldıraç noktasının y'si 6 → 20 sürüklenince r **−0,249 → 0,958**.
  - Set II için Spearman **0,691** (Pearson 0,816): ilişki monoton ama doğrusal değil.
- **Sayısal kodlanmış kategori:** 006 verisine `churn = [1,0,0,1,0,0]` sütunu eklenir; korelasyonları −0,387 / 0,401 / −0,363 / −0,369. Renk "ilişki var" gibi görünür; 0/1 kodlaması ölçüm değildir.

### Adımlar (Ders) — 10 adım

**Bölüm 1 — İki değişken ve ısı haritası**

1. **İki değişken.** 7 öğrenci: x çalışma saati, y sınav notu. Noktalar yukarı sağa diziliyor. Şerit: "7 öğrenci · x: çalışma saati · y: sınav notu". Terim: saçılım grafiği (scatter plot).
2. **Korelasyon.** Eğilim çizgisi çizilir; r = 0,995. Şerit: "r = cov(x,y) / (σx · σy) = 0,995". Mesaj: katsayı ±1 arasında; işaret yönü, büyüklük gücü verir. Terim: Pearson korelasyonu (Pearson correlation).
3. **Nedensellik.** y ekseni devamsızlığa döner; r = −0,993. İki kutu: "gözlem: ilişki var" / "kanıt: neden yok". Üçüncü değişken (motivasyon), ters nedensellik ve rastlantı sayılır. Şerit: "r = −0,993 · korelasyon ≠ nedensellik". Terim: nedensellik (causation).
4. **Isı haritası.** 006 verisinin 4 × 4 matrisi; köşegen 1,000, hücrelerde 3 basamak; renk ölçeği −1…+1. Şerit: "4 değişken · 16 hücre · köşegen 1,000". Mesaj: çok değişkeni tek bakışta tarar; köşegen bulgu değildir. Terim: ısı haritası (heatmap).

**Bölüm 2 — Anscombe: aynı özet, farklı veri**

5. **Dört panel.** Aynı eksenlerde dört saçılım; her panelin altında aynı özet: ortalama x 9, ortalama y 7,5009, varyans x 11, varyans y 4,127, r 0,816. Şerit: "aynı özet · dört farklı örüntü". Terim: Anscombe Dörtlüsü (Anscombe's quartet).
6. **Kaldıraç.** Set IV büyütülür; tek nokta (19, 12,50) sürüklenir. r canlı değişir (−0,249 → 0,958); nokta çıkarılınca r tanımsız. Şerit: "tek nokta · r = 0,816 → 0,958". Mesaj: bir gözlem katsayıyı tek başına taşıyabilir. Terim: kaldıraç (leverage).
7. **Doğrusal değil.** Set II büyütülür: r = 0,816 ama ilişki eğri. Spearman 0,691 yazılır. Mesaj: Pearson yalnız doğrusal ilişkiyi ölçer; grafiğe bakmadan katsayı yorumlanmaz. Terim: doğrusal ilişki (linear relationship).

**Bölüm 3 — Tuzaklar ve kural**

8. **Kategori tuzağı.** Matrise `churn` (0/1) sütunu eklenir; korelasyonlar −0,387 … 0,401. Renkler "ilişki" gibi görünür. Mesaj: sayısal kodlanmış kategori sürekli ölçüm gibi okunmaz; ısı haritası sayısal sürekli değişkenler içindir. Terim: sayısal kodlanmış kategori (numeric-coded category).
9. **Sızıntı.** İki kutu: "tüm veri üzerinde EDA" / "yalnız eğitim kümesinde EDA". Test kümesinin dağılımını görmek bilgi sızıntısıdır; keşif eğitimde yapılır, doğrulama ayrı kümede. Terim: bilgi sızıntısı (data leakage).
10. **Kural.** Tek cümle: "Özet istatistik yeterli değildir, grafik şart." Üç bağlantı: `kutu-grafigi` (aykırı gözlem), Bölüm 3 `iqr-aykiri` (eşik ve aykırı kararı), Bölüm 4 `pca` / `ozellik-secimi` (ilişkili sütunlar ve boyut). Terim: keşifçi veri analizi (EDA).

Adım başlıklarının ve metinlerin son hâli builder'ın işidir. Akış ve her adımın göstermesi gereken an bağlayıcıdır. Her adıma Ders'te görünen bir `term` verilir.

### Parametreler

| Parametre | Değerler | Varsayılan |
|---|---|---|
| Set (5–7) | I / II / III / IV | Adıma bağlı (5: IV yok, dört panel; 6: IV; 7: II) |
| Kaldıraç noktası y (6) | 6–20, sürükleme ve kaydırıcı | 12,5 |
| `churn` sütunu (4, 8) | Kapalı / Açık | Adıma bağlı (8: Açık) |

### Lab modu

- Set seçimi panelleri büyütür; kaldıraç noktası sürüklenir, r canlı okunur.
- `churn` sütunu matrise girip çıkar; hücre değerleri ve renkler canlı değişir.
- Açıklama panelinde: şemsiye–yağmur örneği, üçüncü değişken, ters nedensellik, "köşegen 1,000 bulgu değildir", "küçük örneklemde r dalgalanır", `OgrenciEDA` sınıfı bir cümle, Telco capstone bir cümle.

## Arayüzler

- **Kayıt:** `src/concepts/registry.ts` içinde `dagilim-carpiklik` ve `kutu-grafigi` `hazir` olur, başlıkları yukarıdaki gibi güncellenir; Bölüm 2'ye `korelasyon-isi-haritasi` kaydı eklenir ("Korelasyon, ısı haritası ve Anscombe Dörtlüsü", `hazir`). Ana sayfa e2e'si üç kartı da açar.
- **Sayfalar:** `src/concepts/dagilim-carpiklik/`, `src/concepts/kutu-grafigi/`, `src/concepts/korelasyon-isi-haritasi/`, `npm run yeni-kavram` iskeletinden; `ConceptPage<P>` (`src/core/shell.ts`). Vite girişleri iskeletin eklediği gibi; `index.html` dosyaları.
- **Çekirdek:**
  - `src/core/stats.ts`: `skewness(xs)` (pandas G1: `n / ((n−1)(n−2)) · Σ((x−x̄)/s)³`, n ≥ 3; aksi hâlde `NaN`) ve `histCounts(xs, bins)` (numpy kuralı: eşit genişlik, son kova sağdan kapalı; `{ edges: number[], counts: number[] }`).
  - `src/core/plot/number-line.ts`, `strip.ts`, `marks.ts`, `format.ts`, `viewport.ts`, `dots-path.ts` mevcut hâliyle kullanılır.
  - Kutu, histogram sütunları, ısı haritası ve dört panel sayfa içinde; ikinci bir sayfa aynı parçayı isterse `src/core/plot/`'a taşınır.
- **Veri betiği:** `scripts/make_eda_data.py` (diğer `make_*_data.py` betikleri gibi). Kitabın 002, 003, 004, 005 ve 006 kodlarını aynen çalıştırır, kitabın yazdığı çıktıları (yuvarlanmış) assert eder, uyuşmazlıkta sıfırdan farklı kodla çıkar. Yazdıkları:
  - `src/concepts/dagilim-carpiklik/data/dagilim_data.json`: dört seri, her seri için ortalama / medyan / std / çarpıklık ve 3 / 5 / 10 kova sayımları, `log1p` serileri ve çarpıklıkları, uç değer tarama tablosu (28–60);
  - `src/concepts/kutu-grafigi/data/kutu_data.json`: üç grubun değerleri, 6. öğrencili varyantlar, her grup için Q1 / medyan / Q3 / IQR / sınırlar / bıyıklar / aykırılar (k = 1,5 ve 3,0), ortalamalar;
  - `src/concepts/korelasyon-isi-haritasi/data/korelasyon_data.json`: 004 ve 006 satırları, korelasyon matrisleri, `churn` sütunlu matris, Anscombe dörtlüsü, her setin özetleri, set IV kaldıraç sürükleme tablosu, Spearman değeri;
  - `tests/fixtures/eda_pandas.json`: pandas / numpy / scipy'nin tam duyarlıklı referans değerleri (sürümler dahil).
  - Çıktı belirlenimcidir: iki kez çalıştırmak bayt bayt aynı dosyaları üretir.
- **TypeScript hesapları:** çarpıklık ve histogram çekirdekte; kutu istatistikleri (`quartiles`, `fences`, `whiskers`, `outliers`) sayfa içinde `kutu.ts`; korelasyon `core/stats.pearson` ile; Anscombe özetleri veriden okunur, sürükleme canlı `pearson` ile hesaplanır.

## Kenar durumları

- **n < 3 (çarpıklık):** tanımsız; sayfa "tanımsız" yazar, veride bu durum yok. Testte doğrulanır.
- **Sabit seri (varyans 0):** Pearson tanımsız (`NaN`); Anscombe IV'ün kaldıraç noktası çıkarılınca tam bu durum oluşur ve sayfa "tanımsız (x sabit)" yazar.
- **Isı haritası yuvarlaması:** 0,9954 → "0,995", köşegen tam 1 → "1,000". Hiçbir hücre "0,00" ya da "1,00" diye yuvarlanmaz (köşegen dışında).
- **Bıyık sınırında eşitlik:** sınıra eşit değer aykırı değildir (matplotlib kuralı); testte sınır değeriyle doğrulanır.
- **k = 3:** aykırı kalmaz; etiket "bu kuralda aykırı yok" olur.
- **6. öğrenci:** Elektrik'te 55 aykırı olmaktan çıkar; test bunu sabitler.
- **Kova sayısı 10'da boş kova:** sıfır yükseklikte sütun çizilmez, aralık etiketi yine görünür.
- **Log dönüşümünde sıfır değer:** `log1p(0) = 0`; veride sıfır yok, testte doğrulanır.
- **Sürükleme sırasında adım değişirse:** geçiş iptal edilir, yeni adımın durumu çizilir (k-NN'deki iptal kuralı).
- **Sığmayan metin:** formül şeridi iki satıra kırılır; yine sığmazsa adım ikiye bölünür. Yazı boyutu düşürülmez.
- **Ders'te geniş ekran:** 1280×720 ve 1920×1080'de yazı boyutları tavan değerlerine ulaşır; hiçbir etiket taşmaz.

## Performans

- Tüm veri kümeleri küçük (n ≤ 11); asıl maliyet geçişler ve sürükleme. Sürükleme sırasında yalnızca etkilenen katman yeniden çizilir; noktalar tek `path`, histogram sütunları tek `path` `d` dizisiyle yazılır.
- Kutu grafiğinde üç grup × en çok 6 nokta; ısı haritasında 25 hücre (Anscombe panelleri 44 nokta). Kare başına DOM düğümü eklenmez.
- Performans testleri (Playwright, `performans` projesi): her sayfada bir sürükleme (A: uç değer, B: grup ucu, C: kaldıraç noktası) ve bir kaydırıcı; p95 ≤ k-NN'deki eşik.

## Doğrulama

- **Birim testleri:**
  - `core/stats`: `skewness` (dört seri, G1), `histCounts` (3 / 5 / 10 kova, boş kova, son kova kapalılığı) fikstürle aynı;
  - `dagilim-carpiklik`: dört serinin ortalama / medyan / std / çarpıklık değerleri, uç değer taraması, log değerleri ve çarpıklıkları fikstürle aynı; senaryo adım sayısı (9), kimlikler, terimler ve görünüm türetmesi (her adımın şerit metni, işaretlerin görünürlüğü, hiçbir şeritte "0,00" yok);
  - `kutu-grafigi`: Q1 / Q3 / IQR / sınır / bıyık / aykırı değerleri üç grup ve iki k için fikstürle aynı; 6. öğrencili varyantlar; sınır eşitliği; senaryo (8 adım) ve görünüm;
  - `korelasyon-isi-haritasi`: 004 ve 006 matrisleri, `churn` sütunlu matris, Anscombe özetleri ve r'leri, kaldıraç sürükleme tablosu, Spearman, sabit seride `NaN`; senaryo (10 adım) ve görünüm (hücre metinleri 3 basamak);
  - `home`: 22 kart, 10 hazır bağlantı, 12 yakında; başlıklar.
- **e2e (işlevsel):** ana sayfadan üç karta tıklanınca sayfalar açılıyor; Ders'te klavyeyle her adıma gidilebiliyor; her adımda §3'teki yazı boyutu eşikleri, örtüşme, ekran dışı ve sayfa kayması denetimleri (Bölüm 3'teki yardımcılarla), Ders ve Lab'de 1280×720; Lab'de params kartının o adımın denetimlerini kaydırmadan gösterdiği ve kapalı grupların görünmediği; her spec adımının "an"ı bir DOM öğesine bağlı ve test edilir (ör. A'da 4. adımda ortalama 16,4 / medyan 14,5 etiketleri, B'de 6. adımda iki aykırı baklava, C'de 5. adımda dört panelin aynı r etiketi); ekran görüntüsü testleri seçilmiş adımlarda Ders ve Lab.
- **e2e (performans):** yukarıdaki "Performans" ölçümleri.
- **Kontrolcü:** Ekran görüntüsü taban çizgilerini kendisi açar bakar (Bölüm 3'te etiketlerin yanlış noktanın yanına düşmesi ve Lab örtüşmeleri böyle yakalandı).

## Tasarımcının kararları

Hoca kontrol etsin diye hepsi burada:

- **Üç sayfa, bir yeni kart:** `dagilim-carpiklik`, `kutu-grafigi`, yeni `korelasyon-isi-haritasi`. Yanlışsa bedeli: `korelasyon-isi-haritasi` kartı ana sayfadan kaldırılır, sayfa yayından düşer.
- **Kart başlıkları değişiyor:** "Dağılım ve çarpıklık" → "Dağılım, ortalama–medyan ve çarpıklık"; "Kutu grafiği" → "Kutu grafiği: çeyrekler ve aykırı değerler". Yanlışsa: eski kısa başlıklara dönülür.
- **Veri tanıma animasyonsuz:** yalnızca Lab metninde. Yanlışsa: dördüncü bir küçük sayfa sonraya eklenir.
- **Simetrik ve sol seriler uydurma, n = 10:** kitabın 002 / 003 serileriyle aynı ölçekte. Yanlışsa: yalnızca 002 ve 003 kalır, simetri adımı metne döner.
- **Log dönüşümü `log1p`:** 002'de 0,90 → 0,25, 003'te 2,54 → 1,50. Yanlışsa: adım 8 metne döner; çarpıklık yine anlatılır.
- **Kutu grafiğinde 6. öğrenci ve üçüncü grup Lab'de:** kitabın iki grubunu bozmadan ek ders. Yanlışsa: parametreler kaldırılır, 8. adım metne döner.
- **Anscombe'ta set IV sürüklenebilir:** r'nin tek noktayla −0,249 → 0,958 arasında değiştiği ölçüldü. Yanlışsa: sürükleme kaldırılır, iki uç değer (6 ve 20) arasında düğmeyle geçilir.
- **Isı haritası 3 basamak:** 0,9954 "1,00" yazılmaz. Yanlışsa: 2 basamağa dönülür ama köşegenle karışır.
- **Sızıntı ve veri tanıma animasyonsuz:** bu veri boyutunda görünür bir "an" yok. Yanlışsa: Bölüm 3'ün `olcekleme` sayfasına bağlantı yeterli.
- **`churn` sütunuyla kategori tuzağı:** 006 verisinin altı satırına 0/1 sütunu. Yanlışsa: yalnızca metin kalır.
