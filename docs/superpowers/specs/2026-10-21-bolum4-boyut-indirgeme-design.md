# Bölüm 4 — PCA, t-SNE ve özellik seçimi sayfaları — Tasarım

- **Tarih:** 2026-10-21
- **Kaynak:** Hocanın isteği: "bitince bölüm 4'e geç". Bölüm 3'te hoca beyin fırtınası ve onay adımlarını açıkça devretmişti ("benden onay bekleme"); bu istek aynı akışın devamı sayıldı. Bu belgedeki bütün kararları tasarımcı verdi; hepsi sonda "Tasarımcının kararları" altında kontrol için listelenir. `main`'e birleştirme ve push için hocanın sohbetteki onayı yine gerekir.
- **Kitap:** *Modern Veri Madenciliğine Giriş*, Bölüm 4, `C:\projects\ModernVeriMadenGiris\chapters\ch04_boyut_indirgeme_ozellik_muhendisligi\content\final.md`. Satır aralıkları:
  - özellik mühendisliği 91–260,
  - boyut indirgeme 261–344 (002 örneği),
  - PCA 345–505 (003 örneği, Şekil 4.1),
  - özellik seçimi 506–660 (004 örneği),
  - t-SNE 661–808 (005 örneği, Şekil 4.2),
  - pipeline ve "Sık Yanlış Anlama" 809–831,
  - kuramsal çerçeve 833–849,
  - bölüm özeti ve Sınav Notu 1246–1270.
- **Önceki tasarımlar:**
  - `docs/superpowers/specs/2026-10-20-vm-animasyon-knn-design.md`: ortak iskelet (§4), kırmızı çizgiler (§3) ve görsel kimlik oradan aynen geçerlidir.
  - `docs/superpowers/specs/2026-10-20-bolum5-karar-agaci-naive-bayes-design.md`: ortak grafik çekirdeği, iskelet betiği, e2e bölünmesi ve ekran görüntüsü testleri oradan gelir.
  - `docs/superpowers/specs/2026-10-21-bolum3-on-isleme-design.md`: sayı biçimi kuralı (sıfır olmayan değer "0,00" yazılmaz), formül şeridi, fikstür yöntemi ve Lab yerleşimi oradan gelir.

## Amaç ve kabul ölçütleri

Ana sayfada Bölüm 4'ün iki kartı olur: mevcut `pca` kaydı ve yeni `ozellik-secimi` kaydı. İkisi de animasyonlu sayfaya kavuşur. Kitabın bölüm özetindeki tek cümlelik kural iki sayfanın ortak omurgasıdır: **"PCA sıkıştırır, özellik seçimi eler, t-SNE yalnızca gösterir."** Sayfalar öğrencinin en çok takıldığı beş anı hedefler:

- **"En çok yayıldığı yön" ne demek?** Bir doğru bulutun üstünde döner; izdüşümlerin varyansı en büyük olduğu açıda PC1 bulunur.
- **Bir boyutu atınca ne kaybolur?** Noktalar PC1'e iner; kaybolan pay, PC2'nin açıklanan varyans oranıdır.
- **Kaç bileşen yeter?** Kümülatif açıklanan varyans eğrisi %90 eşiğini 3. bileşende keser.
- **t-SNE neden model girdisi değildir?** Yeni bir müşteri için PCA `transform` eder; t-SNE'nin `transform`'u yoktur, yeniden çalışınca harita değişir.
- **Filtre ile sarmalayıcı neden farklı seçer?** `SelectKBest` her sütunu tek başına puanlar; RFE modelin katsayılarıyla eler ve ölçeksiz veride saf gürültü sütununu seçer.

Kabul ölçütleri:

1. `pca/` ve `ozellik-secimi/` sayfaları yayında. Ana sayfadaki iki kart `hazir` durumunda ve bu sayfalara bağlı.
2. Hoca, iki sayfayı Ders modunda yalnızca klavyeyle (→ / ←) baştan sona anlatabiliyor. 1280×720'de k-NN tasarımının §3'teki yazı boyutu eşikleri her adımda sağlanıyor. Sayfa kaymıyor, sahnedeki hiçbir yazı ekran dışına taşmıyor ve hiçbir etiket bir başkasının üstüne binmiyor.
3. Sayfalardaki her sayı, kitabın kodunun aynı veriyle scikit-learn'de verdiği sonuçla aynı. Bu, Python betiğinin ürettiği fikstüre karşı birim testleriyle doğrulanır. Bağlantılı API'ler:
   - `StandardScaler`, `PCA` (`explained_variance_`, `explained_variance_ratio_`, `components_`, `transform`), `TSNE`;
   - `VarianceThreshold`, `SelectKBest(f_classif)`, `RFE(LogisticRegression(max_iter=1000))`.
4. Her formül şeridi, değerleri yerine konmuş hâliyle görünür. Hiçbir sıfır olmayan değer "0,00" ya da "%100" diye yazılmaz (Bölüm 3 kuralı: gerekirse en çok 6 basamağa kadar uzatılır).
5. Lab'deki sürükleme ve kaydırıcılar takılmadan akıyor. Playwright performans testleri k-NN'deki p95 yöntemiyle ölçer.
6. k-NN, Karar Ağacı, Naive Bayes, `iqr-aykiri` ve `olcekleme` sayfaları davranış olarak değişmiyor. Mevcut testlerin hepsi geçiyor.

## Kararlar

| Konu | Karar | Neden |
|---|---|---|
| Sayfa sayısı | İki sayfa: `pca` (PCA + t-SNE) ve `ozellik-secimi` (filtre + sarmalayıcı) | Bölümün dört tekniğinden ikisi (PCA, özellik seçimi) model girdisi üretir; t-SNE PCA ile karşıtlık içinde en iyi anlaşılır. Bölüm 3'teki gibi iki sayfa, ders saatine sığan iki anlatım bloğudur. |
| Yeni kart | `ozellik-secimi`, Bölüm 4, başlık "Özellik seçimi: filtre ve sarmalayıcı" | Kayıtta Bölüm 4 için yalnızca `pca` var; özellik seçimi bölümün üç ana tekniğinden biri ve kitabın 004 örneği tam bir animasyon akışı veriyor. |
| `pca` kart başlığı | "PCA ve t-SNE ile boyut indirgeme" | Kartın içeriği başlıkta görünsün (Bölüm 3 kuralı). |
| Özellik mühendisliği | Animasyon yok; kapsam dışı | Türetme (kıdem, oran, etkileşim) tek satırlık aritmetik; görsel bir "an" taşımıyor. `ozellik-secimi` Lab metninde bir cümleyle anılır. |
| Veri | Kitabın kod örneklerindeki üreteçler aynen: 003 (PCA, `default_rng(7)`), 004 (seçim, `default_rng(3)`), 005 (t-SNE, `default_rng(11)`) | Öğrenci kitapta gördüğü sayıyı ekranda bulur. Python betiği kitabın kodunu aynen çalıştırır. |
| PCA'nin iki boyutlu sahnesi | 003 verisinin ölçeklenmiş 2. ve 9. öznitelikleri (1'den sayarak), 500 müşteri | 12 boyut çizilemez. Bu çift, kitabın kendi verisinden r = 0,82 ile hem PC1'i hem görünür bir PC2'yi veriyor (r = 0,95'lik çiftte PC2 neredeyse görünmez). |
| Ölçek tuzağı | Aynı çiftte 9. öznitelik ×1000 | Kitabın "Hata 1"i (toplam ücret 0–8000 vs hizmet sayısı 0–10) aynı veride tek değişkenle gösterilir; Bölüm 3'ün birim değişimi anına bağlanır. |
| t-SNE'nin yeni müşterisi | 10 boyutun hepsinde 4,0 (kitabın ikinci kümesinin merkezi) | Gerçekçi bir "churn eden" müşteri; PCA'da beklenen kümeye düşer, t-SNE yeniden çalışınca harita değişir (sayılar aşağıda). |
| t-SNE hesabı | Python'da, önceden; sayfa yalnızca koordinatları çizer | t-SNE tarayıcıda yeniden üretilemez ve kitapla aynı sonucu vermez. `perplexity` 5 / 30 / 50 için üç gömme ve yeni müşteriyle bir gömme veriye yazılır. |
| RFE turları | Python'da, kitabın modeliyle; her turun katsayıları veriye yazılır | Lojistik regresyonu tarayıcıda yeniden eğitmek gereksiz risk. Tur sırası sklearn'ün `ranking_`'i ile test edilir. |
| PCA ve F-skoru | TypeScript'te hesaplanır (2×2 özdeğer, tek yönlü ANOVA F), fikstüre karşı test edilir | Lab'deki açı ve ölçek etkileşimi canlı hesap ister. 12 boyutlu açıklanan varyans oranları ise veriden okunur. |

## Kapsam dışı

- Özellik mühendisliği (türetme) animasyonu, otokodlayıcı, Kernel PCA, UMAP, gömülü yöntemler (Lasso). Gerekirse Lab metninde birer cümle.
- PCA'nin test kümesine yeniden `fit` edilmesi (kitabın PCA "Hata 2"si) ve `SelectKBest`'in tüm veriye `fit` edilmesi (seçim "Hata 1"i): bu iki boyutlu veride fark çok küçük çıkıyor (PC1 açısı 1°'den az değişiyor, seçilen dört sütun aynı kalıyor), görünür bir an vermiyor. Kural, iki sayfanın son adımında ve Lab metninde söylenir; sızıntının animasyonu Bölüm 3 `olcekleme` sayfasında zaten var.
- Kitabın 002 örneği (60 sütun → 53) yalnızca Lab metninde bir cümle. Kitap metni bu örnekte "51'e indi" diyor, kodun gerçek çıktısı 53; sayfa 53 yazar.
- Bölüm 3 ve Bölüm 5'ten ertelenen cila maddeleri (`.remember/remember.md` → Deferred polish).

## Kırmızı çizgiler

k-NN tasarımının §3'ü aynen geçerlidir. Bu iki sayfada özellikle:

- **Formül şeritleri, sütun adları ve çubuk değerleri Ders'te gövde boyutundan (≥ 22 px) küçük yazılamaz.** Şerit tek satıra sığmazsa iki satıra kırılır. Yine sığmazsa metin kısaltılır ya da adım ikiye bölünür, yazı küçültülmez.
- **Değer etiketleri** (λ, açıklanan varyans yüzdeleri, F-skorları, katsayılar, eksen başlıkları) Ders'te ≥ 18 px ve birbirinin üstüne binmez.
- **Renk + şekil:** Her nokta türü renkle birlikte şekille de ayrışır:
  - müşteri (etiketsiz bulut): lacivert ●,
  - churn etmeyen: lacivert ●, churn eden: turuncu ▲ (t-SNE ve seçim şeritleri),
  - yeni müşteri: camgöbeği ◆ ve kalın kontur,
  - elenen sütun: gri, üstü çizili ad ve "elendi" yazısı (yalnız renkle değil).
- **500 ve 3200 nokta:** Kitabın verisi küçültülmez. Nokta yarıçapı okunurluk için seçilir; performans, döndürme ve izdüşümün tek bir grup dönüşümü ve tek bir `path` ile çizilmesiyle sağlanır (aşağıda "Performans").

## Ortak görsel öğeler

- **Dağılım grafiği:** Bölüm 3'ün `fitAspect`'li dağılımı; iki eksen aynı ölçekte (PCA'de açı ancak eşit ölçekte doğru görünür).
- **Yön doğrusu:** Merkezden geçen, iki yönde grafiğin kenarına kadar uzanan kalın bir doğru; ucunda Lab'de sürüklenen bir tutamaç (≥ 44 px dokunma alanı) ve açı etiketi ("θ = 30°").
- **İzdüşümler:** Her noktadan doğruya dik ince çizgiler (tek `path`) ve doğrunun üstünde izdüşüm noktaları (tek `path`).
- **Varyans göstergesi:** Sahnenin sağında, izdüşümlerin varyansını gösteren dikey bir çubuk ve değer etiketi; altında açıya göre varyans eğrisi (0°–180°) ve o anki açıyı gösteren işaret.
- **Çubuk grafiği:** Yatay çubuklar; sol tarafta sütun adı (kitabın camelCase adları aynen), sağ uçta değer. Seçilen çubuklar dolu, elenenler gri ve üstü çizili.
- **Formül şeridi:** Sahnenin altında, değerleri yerine konmuş tek ya da iki satır (Bölüm 3 ile aynı bileşen).

## `pca` sayfası — PCA ve t-SNE ile boyut indirgeme

**Kitap atfı:** Bölüm 4, "Boyut indirgeme", "PCA (Temel Bileşenler Analizi)" ve "t-SNE" alt başlıkları.

**Terimler (kitapla uyumlu):** boyut indirgeme (dimensionality reduction), izdüşüm (projection), varyans, temel bileşen (principal component), özvektör (eigenvector), özdeğer (eigenvalue), ortogonal, açıklanan varyans oranı (explained variance ratio), kümülatif varyans, ölçek duyarlılığı, t-SNE, `transform`.

### Bölüm 1 verisi

Kitabın 003 örneği: `default_rng(7)`, 500 müşteri, 12 öznitelik, `StandardScaler` ile ölçeklenmiş. Sahne bu verinin 2. ve 9. sütununu kullanır (sıfırdan sayan dizinle 1 ve 8).

Kontrol değerleri (testlerde sabit; λ, sklearn'ün `explained_variance_`'ı gibi n − 1 ile):

- korelasyon r = **0,82** (0,824),
- açıya göre izdüşüm varyansı: θ = 0° → **1,00**; en büyük değer θ = **45°**,
- λ1 = **1,83** (1,828), λ2 = **0,18** (0,176),
- PC1 = (0,707; 0,707), PC2 ona dik,
- açıklanan varyans oranı: PC1 **%91,2**, PC2 **%8,8**,
- 9. öznitelik ×1000 iken: PC1 = (0,0008; 1,0000) (dikey eksene yapışır), PC1'in oranı %100'e çok yakın ama %100 değil; betik değeri kaydeder, sayfa Bölüm 3'ün biçim kuralıyla yazar.

### Bölüm 2 verisi

Aynı 003 verisinin 12 sütunu. Açıklanan varyans oranları (kitabın çıktısı): **0,441 · 0,31 · 0,188 · 0,02 · 0,012** · 0,006 · 0,005 · 0,005 · 0,004 · 0,004 · 0,003 · 0,002. Kümülatif: 0,441 · 0,751 · **0,938** · 0,958 · … · 1. %90 eşiğini geçen ilk bileşen sayısı **3** (kitapla aynı: "yaklaşık %94").

### Bölüm 3 verisi

Kitabın 005 örneği: `default_rng(11)`, iki küme × 150 nokta, 10 boyut, ölçeklenmiş. Etiket 0 churn etmeyen, 1 churn eden.

- PCA 2B: açıklanan varyans oranları **%82,1** ve **%2,5**.
- t-SNE: `TSNE(n_components=2, perplexity=30, random_state=42, init="pca")`, kitapla aynı. Betik `perplexity` 5 ve 50 için de gömme kaydeder.
- Yeni müşteri: 10 boyutta 4,0. Ölçekleyici ve PCA eğitim verisiyle `fit` edilmiş hâlleriyle `transform` eder; nokta PCA panelinde ikinci kümenin içine düşer, diğer 300 nokta yerinden oynamaz.
- t-SNE yeni müşteriyle birlikte 301 nokta üzerinde yeniden `fit_transform` edilir. Kontrol: ilk noktanın koordinatı yeni müşterisiz gömmede (28,3; 1,2); yeni müşteriyle ilk 300 noktanın ortalama yer değiştirmesi gömmenin genişliğinin yaklaşık %56'sı (≈ 34,4 birim; harita değişir). Betik "ortalama yer değiştirme, gömmenin genişliğinin %25'inden büyük" koşulunu doğrular; tutmazsa hata verir.

### Adımlar (Ders) — 13 adım

**Bölüm 1 — Bir yön bul (iki öznitelik)**

1. **Bulut.** 500 müşteri, ölçeklenmiş 2. ve 9. öznitelik. Eksenler eşit ölçekte, merkezde (0; 0) artısı. Şerit: "r = 0,82: iki sütun büyük ölçüde aynı bilgiyi taşıyor". Terim: korelasyon (correlation).
2. **Bir yön seç.** Yön doğrusu θ = 0°'de belirir. Noktalardan doğruya dik çizgiler iner, izdüşüm noktaları doğrunun üstünde dizilir. Varyans göstergesi 1,00'i gösterir. Terim: izdüşüm (projection).
3. **Yönü çevir.** Doğru 0°'den 180°'ye döner; izdüşümler ve gösterge canlı değişir, varyans eğrisi çizilir. Eğrinin tepesi 45°'de. Mesaj: izdüşümlerin en çok yayıldığı yön aranıyor. Terim: varyans (variance).
4. **PC1.** Doğru 45°'de durur ve "PC1" adını alır. Şerit: λ1 = 1,83. Kitabın tanımı: "bu bulut hangi yönde en çok yayılmış?". Terim: temel bileşen (principal component).
5. **PC2.** PC1'e dik ikinci doğru belirir. Şerit: λ2 = 0,18. Terim: ortogonal (orthogonal).
6. **Yeni eksenler.** Bulut, PC1 yatay olacak şekilde döner; eksen başlıkları "PC1" ve "PC2" olur. Şerit: EVR₁ = 1,83 / (1,83 + 0,18) = %91,2. Terim: açıklanan varyans oranı (explained variance ratio).
7. **Bir boyuta indir.** Noktalar PC1 eksenine iner; PC2 yönündeki uzaklıklar ince çizgilerle kısa bir süre görünüp kaybolur. Şerit: "2 sütun → 1 bileşen; korunan %91,2, kaybolan %8,8". Terim: boyut indirgeme (dimensionality reduction).
8. **Ölçek tuzağı.** Sahne 1. adımın eksenlerine döner. 9. öznitelik ×1000 olur (örneğin TL → kuruş); bulut dikeyde açılır ve PC1 dikey eksene yapışır. Şerit: PC1 = (0,0008; 1,0000), PC1'in oranı ≈ %100. Mesaj (kitabın Hata 1'i): ölçeklemeden PCA, sayısı büyük olan sütunu izler. Terim: ölçek duyarlılığı (scale sensitivity).

**Bölüm 2 — Kaç bileşen yeter? (on iki öznitelik)**

9. **Özdeğerler.** Sahne 12 çubuklu bir grafiğe geçer: her bileşenin açıklanan varyans oranı (%44,1 · %31,0 · %18,8 · %2,0 · …). Mesaj: 12 sütunun bilgisi aslında 3 yönde toplanmış (kitabın verisi 3 gizli sinyalden üretildi). Terim: özdeğer (eigenvalue).
10. **%90 eşiği.** Çubukların üstüne kümülatif eğri çizilir, %90'da kesik kırmızı çizgi (kitabın Şekil 4.1'i). Eğri çizgiyi 3. bileşende keser: %93,8. Şerit: `PCA(n_components=0.90)` → 3 bileşen. Terim: kümülatif varyans (cumulative variance).

**Bölüm 3 — PCA sıkıştırır, t-SNE gösterir**

11. **Yan yana.** İki panel: solda PCA 2B, sağda t-SNE 2B (kitabın 005 verisi, Şekil 4.2). Churn eden turuncu ▲, etmeyen lacivert ●. Şerit: "PCA: PC1 %82,1 · t-SNE: perplexity = 30". Mesaj: t-SNE kümeleri daha net ayırır ama eksenlerinin sayısal anlamı yoktur. Terim: t-SNE.
12. **Yeni müşteri.** Camgöbeği ◆ yeni müşteri, PCA panelinde öğrenilmiş bileşenlerle `transform` edilip ikinci kümeye yerleşir; diğer noktalar yerinden oynamaz. t-SNE panelinde ise `transform` yoktur: 301 nokta yeniden `fit_transform` edilir, harita değişir ve noktalar animasyonla yeni yerlerine geçer. Şerit: "`tsne.transform(yeni)` → AttributeError; yeniden çalıştırınca harita değişti". Terim: `transform`.
13. **Kural.** Üç kutu: "PCA sıkıştırır" (`fit` eğitimde, `transform` her yerde) · "özellik seçimi eler" (`ozellik-secimi` sayfasına bağlantı) · "t-SNE yalnızca gösterir" (model girdisi değil). Kitabın Sınav Notu cümlesi. Terim: model girdisi (model input).

Adım başlıklarının ve metinlerin son hâli builder'ın işidir. Akış ve her adımın göstermesi gereken an bağlayıcıdır. Her adıma Ders'te görünen bir `term` verilir.

### Parametreler

| Parametre | Değerler | Varsayılan |
|---|---|---|
| Yön açısı θ (adım 2–5) | 0°–179°, sürükleme ve kaydırıcı, adım 1° | Adıma bağlı (2: 0°, 3: döner, 4–5: 45°) |
| 9. özniteliğin birimi (adım 1–8) | ×1 / ×1000 | ×1 (8. adımda ×1000) |
| Varyans eşiği (adım 9–10) | %50–%99, kaydırıcı, adım 1 | %90 |
| perplexity (adım 11–12) | 5 / 30 / 50 | 30 |

Adımlar kendi parametrelerini k-NN'deki gibi sahiplenir. Elle verilen değer, adım değişene kadar geçerli kalır.

### Lab modu

- Yön doğrusunun tutamacı sürüklenir; izdüşümler, gösterge ve eğri işareti canlı değişir. "PC1'i bul" düğmesi doğruyu animasyonla 45°'ye (ya da ×1000'de dikeye) götürür.
- ×1000 seçilince bulut, eğri ve PC1 canlı değişir; varyans eğrisinin tepesi 90°'ye kayar.
- Eşik kaydırıcısıyla kesik çizgi ve "gereken bileşen sayısı" canlı değişir (%50 → 2, %90 → 3, %99 → 9; betik her eşik için değeri sklearn'ün `PCA(n_components=eşik)` sonucuyla fikstüre yazar).
- perplexity seçimiyle t-SNE paneli kayıtlı üç gömme arasında animasyonla geçer.
- Açıklama panelinde: boyutun laneti (kitabın 5000 müşteri / 200 boyut örneği), 002 örneği (60 → 53 sütun), "PCA'yi test kümesine yeniden `fit` etmeyin" kuralı, t-SNE'den önce PCA ile 30–50 boyuta indirme ipucu.

## `ozellik-secimi` sayfası — Özellik seçimi: filtre ve sarmalayıcı

**Kitap atfı:** Bölüm 4, "Özellik seçimi" alt başlığı ve 004 örneği.

**Terimler (kitapla uyumlu):** öznitelik (feature), özellik seçimi (feature selection), filtre yöntemi (filter method), varyans eşiği (`VarianceThreshold`), ANOVA F-istatistiği, `SelectKBest`, sarmalayıcı yöntem (wrapper method), RFE (Recursive Feature Elimination), katsayı (coefficient), ölçek, kesişim.

### Veri

Kitabın 004 örneği: `default_rng(3)`, 400 müşteri, 8 sütun (`aylikUcret`, `toplamUcret`, `hizmetSayisi`, `musteriKidemAy`, `sabitDeger`, `gurultuluOznitelik`, `destekTaleplerinSayisi`, `odemeGecikmesi`), hedef `churn = (kıdem < 12) | (destek > 6)`. Churn oranı **%42,25** (169 / 400).

Kontrol değerleri (testlerde sabit; kitabın çıktısıyla aynı):

- **Varyans** (`VarianceThreshold`, `ddof=0`): aylikUcret 406,37 · toplamUcret 629 688,34 · hizmetSayisi 5,22 · musteriKidemAy 302,89 · **sabitDeger 0** · gurultuluOznitelik 0,84 · destekTaleplerinSayisi 8,92 · odemeGecikmesi 1,95. Eşik 0,01 yalnızca `sabitDeger`'i eler.
- **F-skoru** (`f_classif`): destekTaleplerinSayisi **158,44** · musteriKidemAy **94,66** · hizmetSayisi **2,86** · odemeGecikmesi **1,62** · toplamUcret 0,73 · aylikUcret 0,57 · gurultuluOznitelik 0,04 · sabitDeger tanımsız (sklearn `nan`; sayfada "—" ve "varyansı sıfır"). `k = 4`: hizmetSayisi, musteriKidemAy, destekTaleplerinSayisi, odemeGecikmesi.
- **RFE** (ölçeksiz, kitapla aynı), her turda lojistik regresyon yeniden eğitilir ve |katsayı| en küçük sütun elenir:
  - tur 1 (8 sütun): toplamUcret elenir (|β| ≈ 0,0000),
  - tur 2 (7): sabitDeger (0,0005),
  - tur 3 (6): aylikUcret (0,0023),
  - tur 4 (5): hizmetSayisi (0,021).
  - Kalan dört: musteriKidemAy, **gurultuluOznitelik**, destekTaleplerinSayisi, odemeGecikmesi. Sıra, sklearn'ün `ranking_`'i ile aynı (toplamUcret 5, sabitDeger 4, aylikUcret 3, hizmetSayisi 2).
  - Tur 1'in katsayıları: destek 0,6286 · gürültü 0,1511 · kıdem 0,0939 · ödeme 0,0266 · hizmet 0,0219 · sabit 0,0033 · aylık 0,0022 · toplam 0,0000.
- **RFE, `StandardScaler` sonrası:** hizmetSayisi, musteriKidemAy, gurultuluOznitelik, destekTaleplerinSayisi (sıra: sabitDeger 5, toplamUcret 4, aylikUcret 3, odemeGecikmesi 2). Gürültü yine seçilir.
- **Kesişim** (kitap v0.2'nin kurulumu: F-skorlarındaki boşluktan `k = 2`, `Pipeline` + `StandardScaler` içinde RFE `n_features_to_select=2`): `SelectKBest` ve RFE ikisi de musteriKidemAy, destekTaleplerinSayisi'ni seçer; kesişim bu ikisidir. (`k = 4`, ölçeksiz RFE ile kesişim: musteriKidemAy, destekTaleplerinSayisi, odemeGecikmesi.)

### Adımlar (Ders) — 10 adım

**Bölüm 1 — Filtre: sütuna tek başına bak**

1. **Sekiz sütun.** Sekiz satır; her satırda sütun adı ve 400 müşterinin o sütundaki değerleri yatay bir şeritte (satırın kendi ölçeğinde). Churn eden turuncu ▲, etmeyen lacivert ●. Şerit: "400 müşteri, 8 sütun, churn %42,25". Terim: öznitelik (feature).
2. **Varyans eşiği.** Her satırın sağında varyansı yazar. `sabitDeger`'in şeridi tek noktaya çöker (hepsi 1); satır griye döner, adı üstü çizilir, "elendi". Şerit: `VarianceThreshold(threshold=0.01)` → 7 sütun kalır. Mesaj: hedefe hiç bakmadan, en ucuz eleme. Terim: filtre yöntemi (filter method).
3. **F-skoru.** Şeritler çubuklara dönüşür: her sütunun churn ile ilişkisinin F-skoru, büyükten küçüğe sıralanır. Şerit: destek 158,44 · kıdem 94,66 · … Terim: ANOVA F-istatistiği (ANOVA F-statistic).
4. **İlk dört.** En büyük dört çubuk dolu kalır, diğerleri griye döner. Şerit: `SelectKBest(f_classif, k=4)` → hizmetSayisi, musteriKidemAy, destekTaleplerinSayisi, odemeGecikmesi. Terim: `SelectKBest`.
5. **Neden kıdem yüksek, gürültü düşük?** İki satır büyür: `musteriKidemAy` ve `gurultuluOznitelik` şeritleri churn'e göre iki alt şeride ayrılır; kıdemde iki grup belirgin ayrışır (12 ayın altındaki her müşteri churn eder; churn etmeyenlerin alt şeridi orada boştur), gürültüde üst üste biner. Mesaj: filtre her sütunu tek başına değerlendirir, sütunlar arası etkileşimi görmez. Terim: tek değişkenli değerlendirme (univariate).

**Bölüm 2 — Sarmalayıcı: modele sor**

6. **RFE, tur 1.** Çubuklar bu kez lojistik regresyonun |katsayı| değerleri olur (8 sütun). En kısa çubuk (`toplamUcret`) elenir. Şerit: `RFE(LogisticRegression(max_iter=1000), n_features_to_select=4)`; tur 1 → toplamUcret elendi. Terim: sarmalayıcı yöntem (wrapper method).
7. **Turlar 2–4.** Her turda model yeniden eğitilir, çubuklar yeni katsayılarla yeniden boylanır, en kısası elenir: sabitDeger → aylikUcret → hizmetSayisi. Turlar bir adım içinde sırayla oynar. Terim: RFE.
8. **Gürültü seçildi.** Kalan dört çubuk: kıdem, **gürültü**, destek, ödeme. `gurultuluOznitelik` vurgulanır. Mesaj: ölçeksiz veride katsayı sütunun birimine bağlıdır; gürültünün standart sapması 1, kıdeminki ≈ 17 olduğu için gürültünün katsayısı büyük görünür (kitabın Hata 2'si). Terim: ölçek (scale).
9. **Ölçekleyince.** `StandardScaler` sonrası RFE yeniden oynar; seçim hizmetSayisi, musteriKidemAy, gurultuluOznitelik, destekTaleplerinSayisi olur. Gürültü yine içeride. Mesaj (kitabın cümlesi): sarmalayıcı yöntemler de kusursuz değil. Terim: `StandardScaler`.
10. **Kesişim ve kural.** İki sütun yan yana: `SelectKBest` (k = 2) seçimi ve ölçekli RFE (n = 2) seçimi; ikisi de aynı iki sütunu seçer, ortak sütun ortada (kitap v0.2'nin sonucu). Kitabın önerisi: birden fazla yöntemin kesişimine bakın. Altında bölümün kuralı: "PCA sıkıştırır, özellik seçimi eler, t-SNE yalnızca gösterir"; seçim de yalnızca eğitim verisiyle `fit` edilir (kitabın seçim Hata 1'i). Terim: kesişim (intersection).

Adım başlıklarının ve metinlerin son hâli builder'ın işidir. Akış ve her adımın göstermesi gereken an bağlayıcıdır. Her adıma Ders'te görünen bir `term` verilir.

### Parametreler

| Parametre | Değerler | Varsayılan |
|---|---|---|
| Varyans eşiği (adım 2) | 0 / 0,01 / 1 / 10 | 0,01 |
| k (adım 3–5) | 1–7, kaydırıcı | 4 |
| Seçilecek sütun sayısı (adım 6–10) | 1–7, kaydırıcı | 4 (adım 10: 2) |
| Ölçekleme (adım 6–10) | Yok / StandardScaler | Adıma bağlı (6–8: yok; 9–10: StandardScaler; adım 10'da k = 2, kitabın kurulumu) |

RFE tek tek eler; `n_features_to_select`'in her değeri için seçim, betiğin kaydettiği tam eleme sırasından okunur (ölçeksiz ve ölçekli iki sıra). Betik, her değer için sklearn'ün `RFE` sonucunun bu sırayla aynı olduğunu doğrular.

### Kitapla farklar (kitap v0.2, 2026-10-26)

- Kitabın 004 örneği RFE'yi varyans filtresinden geçen 7 sütunla (`filtreliCerceve`) çalıştırır; sayfa 8 sütunla başlar. Ölçekli yolda `sabitDeger` ölçeklemeden sonra hep 0 olduğu için tur 1'de elenir, sonraki turlar kitabın sırasıyla aynıdır (betik bunu denetler); bu yüzden sayfadaki tur numaraları kitabın `ranking_`'inden bir fazladır.
- Kitap `k = 2` seçer; sayfa 4.–9. adımlarda `k = 4` / `n = 4` ile gürültünün nasıl seçildiğini gösterir (kitap bu durumu metinde anlatır), son adımda kitabın `k = 2` kurulumuna döner.

### Lab modu

- k kaydırıcısıyla dolu çubuklar canlı değişir.
- Varyans eşiği 1 seçilince `gurultuluOznitelik` (0,84) da elenir; 10 seçilince ayrıca `odemeGecikmesi` (1,95), `hizmetSayisi` (5,22) ve `destekTaleplerinSayisi` (8,92) elenir — churn'ü en iyi açıklayan sütun dahil. Mesaj: varyans birime bağlıdır; `toplamUcret` 629 688 ile en "değişken" sütun görünür ama churn ile ilişkisi zayıftır.
- Seçilecek sütun sayısı ve ölçekleme seçimiyle RFE sonucu canlı değişir; elenme sırası çubukların yanında "tur 1", "tur 2" … etiketleriyle görünür.
- Açıklama panelinde: özellik mühendisliği bir cümleyle (kıdem, oran, etkileşim; kitabın 001 örneği), gömülü yöntemler (Lasso, ağaç önemleri) bir cümleyle, filtre / sarmalayıcı / gömülü karşılaştırma tablosu (kitabın tablosu, kısaltılmış).

## Arayüzler

- **Kayıt:** `src/concepts/registry.ts` içinde `pca` kaydı `hazir` olur, başlığı "PCA ve t-SNE ile boyut indirgeme"; Bölüm 4'e `ozellik-secimi` kaydı eklenir ("Özellik seçimi: filtre ve sarmalayıcı", `hazir`). Ana sayfa e2e'si iki kartı da açar.
- **Sayfalar:** `src/concepts/pca/` ve `src/concepts/ozellik-secimi/`, `npm run yeni-kavram` iskeletinden; `ConceptPage<P>` (`src/core/shell.ts`). Vite girişleri iskeletin eklediği gibi.
- **Veri betiği:** `scripts/make_boyut_data.py` (diğer `make_*_data.py` betikleri gibi). Kitabın 003, 004, 005 kodlarını aynen çalıştırır, kitabın yazdığı çıktıları (yuvarlanmış) assert eder, uyuşmazlıkta sıfırdan farklı kodla çıkar. Yazdıkları:
  - `src/concepts/pca/data/pca_data.json`: 500 × 2 ölçeklenmiş nokta, 12 açıklanan varyans oranı, eşik → bileşen sayısı tablosu, 005'in PCA koordinatları ve üç perplexity için t-SNE gömmeleri, yeni müşteri koordinatları ve yeni müşterili t-SNE gömmesi;
  - `src/concepts/ozellik-secimi/data/secim_data.json`: 400 × 8 değer, hedef, varyanslar, RFE'nin iki tam eleme sırası ve her turun katsayıları;
  - `tests/fixtures/boyut_sklearn.json`: sklearn'ün tam hassasiyetli referans değerleri (λ, bileşenler, ×1000 durumu, F-skorları, RFE `ranking_`, scikit-learn sürümü).
  - Çıktı belirlenimcidir: iki kez çalıştırmak bayt bayt aynı dosyaları üretir.
- **TypeScript hesapları:** 2×2 kovaryans ve özdeğer / özvektör (açıya göre izdüşüm varyansı dahil), tek yönlü ANOVA F (`f_classif`), varyans (`ddof=0`). Paylaşılabilecek olanlar (`variance`, `covariance2`) `src/core/stats.ts`'e eklenir; sınırını builder belirler.
- **Grafik çekirdeği:** dağılım için Bölüm 3'ün `src/core/plot/` parçaları (`viewport`, `axes`, `fitAspect`); yatay çubuk grafiği iki sayfada da gerekiyorsa `src/core/plot/bars.ts` olarak çekirdeğe girer.

## Kenar durumları

- **sabitDeger'in F-skoru:** sklearn `nan` verir (varyans sıfır). TypeScript aynı durumda `NaN` döndürür; sayfa "—" yazar, sıralamada en sona koyar.
- **Yön açısı 180°'yi geçerse:** θ mod 180 alınır (doğru yönsüzdür).
- **×1000'de varyans eğrisi:** değerler 10⁶ mertebesine çıkar; gösterge ve eğri kendi ölçeğini yeniden kurar, eksen etiketleri binlik ayırıcıyla yazar ("1 000 000").
- **İki sütunun |katsayı|'sı eşitse (RFE):** sklearn'ün sırası esastır; sayfa sırayı veriden okur, kendisi karşılaştırma yapmaz.
- **t-SNE paneline Lab'de perplexity değiştirilirken adım değişirse:** geçiş iptal edilir, yeni adımın durumu çizilir (k-NN'deki iptal kuralı).
- **Sığmayan metin:** Formül şeridi iki satıra kırılır. Yine sığmazsa adım ikiye bölünür. Yazı boyutu düşürülmez.

## Performans

- 500 noktanın dönmesi (adım 6) ve yön sürüklenmesi Lab'de 60 fps hedefler: döndürme tek bir `<g>` dönüşümüyle; izdüşüm çizgileri ve noktaları her karede tek bir `path` `d` dizisiyle yeniden yazılır (500 ayrı öğe güncellenmez).
- Seçim şeritlerindeki 3200 nokta durağandır; adım geçişlerinde yalnızca satırların konumu ve rengi değişir.
- Performans testleri (Playwright, `performans` projesi): `pca` yön sürükleme p95 ≤ k-NN'deki eşik; `ozellik-secimi` k kaydırıcısı ve RFE tur animasyonu p95 ≤ aynı eşik.

## Doğrulama

- **Birim testleri:**
  - 2×2 özdeğer, PC1 / PC2, açıya göre varyans, ×1000 durumu fikstürle aynı;
  - eşik → bileşen sayısı tablosu ve kümülatif oranlar fikstürle aynı;
  - varyanslar ve F-skorları (sabitDeger'in `NaN`'i dahil) fikstürle aynı; `k` için seçim;
  - RFE eleme sırası (iki ölçek) ve `n_features_to_select` 1–7 için seçimler fikstürle aynı;
  - t-SNE verisinin şekli (300 / 301 nokta, üç perplexity) ve yeni müşterinin PCA koordinatı fikstürle aynı;
  - senaryolar: adım sayıları (13 ve 10), kimlikler, terimler ve Ders terimlerinin metindeki İngilizce terimlerle uyumu (k-NN'deki kural);
  - görünüm türetmesi: her adımın şerit metni ve işaretlerin görünürlüğü; hiçbir şeritte sıfır olmayan değerin "0,00" ya da "%100" yazılmaması.
- **e2e (işlevsel):**
  - ana sayfadan iki karta tıklanınca sayfalar açılıyor;
  - Ders'te klavyeyle her adıma gidilebiliyor;
  - her adımda §3'teki yazı boyutu eşikleri, örtüşme, ekran dışı ve sayfa kayması denetimleri (Bölüm 3'teki yardımcılarla), Ders ve Lab'de 1280×720;
  - Lab'de params kartının o adımın denetimlerini kaydırmadan gösterdiği ve kapalı grupların görünmediği (Bölüm 3 cilasının kuralı);
  - her spec adımının "anı" bir DOM öğesine bağlı ve test edilir (ör. adım 4'te `PC1` etiketi 45°'de, adım 8'de PC1 dikey, adım 12'de t-SNE noktalarının yer değiştirmesi, adım 7'de RFE'nin dört eleme etiketi);
  - ekran görüntüsü testleri, k-NN'deki gibi seçilmiş adımlarda Ders ve Lab.
- **e2e (performans):** yukarıdaki "Performans" ölçümleri.
- **Kontrolcü:** Ekran görüntüsü taban çizgilerini kendisi açıp bakar (Bölüm 3'te etiketlerin yanlış noktanın yanına düşmesi ve Lab örtüşmeleri böyle yakalandı).

## Tasarımcının kararları

Hoca kontrol etsin diye hepsi burada:

- **İki sayfa, bir yeni kart:** `pca` (PCA + t-SNE) ve yeni `ozellik-secimi`. Yanlışsa bedeli: `ozellik-secimi` kartı ana sayfadan kaldırılır, sayfa yayından düşer.
- **Özellik mühendisliği animasyonsuz:** yalnızca Lab metninde. Yanlışsa: üçüncü bir küçük sayfa sonraya eklenir.
- **PCA sahnesi 003'ün 2. ve 9. sütunu:** kitabın kendi verisinden, görünür bir PC2 veren çift. Ölçeklenmiş iki sütunda PC1 her zaman 45°'dedir; bu bir kusur değil, anlatıda "korelasyon pozitifse PC1 köşegendir" diye söylenir.
- **Ölçek tuzağı ×1000 ile:** kitabın Hata 1'i aynı veride tek değişkenle. Kitap bu hatayı yalnızca sözle anlatıyor.
- **PCA ve seçim "test kümesine fit" hataları animasyonsuz:** bu verilerde görünür fark yok (ölçüldü). Kural metinde ve son adımlarda.
- **t-SNE yeni müşterisi 10 boyutta 4,0:** harita değişiyor (ölçüldü: ortalama yer değiştirme genişliğin ≈ %56'sı). Betik, etkinin görünür kaldığını her çalıştırmada doğrular.
- **Renk:** yeni müşteri camgöbeği ◆ (Bölüm 3'teki turuncu ◆ değil), çünkü bu sayfalarda turuncu ▲ "churn eden" demek.
- **Kitaptaki 51 / 53 tutarsızlığı:** sayfa kodun gerçek çıktısını (53) yazar.
