# Bölüm 12 — Metin madenciliği: TF-IDF, kosinüs benzerliği ve duygu analizi — Tasarım

- **Tarih:** 2026-10-25
- **Kaynak:** Öğretmen: "Bölüm 12'ye geç"; soru sorulmaması kuralı Bölüm 9'dan sürer ("soruları
  atla, sen öner ve başla"). Kitabın `ch12_metin_madenciligi_nlp/content/final.md` bölümü (salt
  okunur).
- **Yetki:** Bütün tasarım kararları benimdir (aşağıda "Benim kararım"). Kararlar ledger'da
  `Ruling:` satırı olarak da durur ve iş sonunda öğretmene listelenir. Yayın (main'e push) için
  öğretmenin onayı ayrıca beklenir.
- **Önceki tasarımlar:** Bölüm 11 (`2026-10-24-bolum11-dengesiz-veri-design.md`); ortak görünüm
  kuralları ve iki sayfa kalıbı oradan devralınır. Lojistik regresyon Bölüm 5–11'de, sızıntı ve
  Pipeline Bölüm 3 ve 11'de, karışıklık matrisi Bölüm 6'da işlendi; burada yalnız metin açısından
  kullanılır.
- **Ön deneme (2026-10-25, scikit-learn 1.9.0, kitabın kodları aynen):**
  - `bolum12_kod02` (3 belge, `TfidfVectorizer()` varsayılanı): sözlük 9 terim; IDF = ln((1+N) /
    (1+df)) + 1 → df 1 için 1,6931, df 2 için 1,2877; L2 normlu satırlarda 0,428 / 0,563 —
    kitabın tablosuyla aynı (0,43 / 0,56).
  - `bolum12_kod03` (sorgu "internet bağlantısı sürekli kopuyor"): skorlar 1,0000 / 0,1429 /
    0,0000 (kitap 1,00 / 0,14 / 0,00). Ortak terim yalnız "internet"tir: "bağlantısı" ile
    "bağlantı" ayrı terimlerdir (kitap "internet ve bağlantı" der).
  - `bolum12_kod04` (8 yorum, `ngram_range=(1, 2)`, `stratify`, `random_state=42`): test 2 yorum
    (etiket 0, 1), tahmin 1, 1; doğruluk 0,50 — kitabın raporuyla aynı. Yeni yorum "bağlantı
    sorunu çözüldü destek ekibi çok ilgili": p(olumlu) = 0,542 → 1.
  - Mini uygulama (`MusteriYorumuAnalizcisi`, 4 eğitim yorumu): "internet yavaş ve destek ekibi
    sorunu çözmedi" için p(olumlu) = 0,500 (tam ortada; `predict` 1 der), en yüksek benzerlik
    0,5 iki yorumda eşit (biri olumlu, biri olumsuz), `argmax` ilkini seçer. Sözlükte olmayan
    terimlerden oluşan yorumun vektörü sıfırdır; tahmin yalnız kesişimden gelir (burada 0,5).

## Amaç ve kabul ölçütleri

Öğrenci dört şeyi kavramalı:

1. **Metin önce sayıya döner.** Ham yorum küçük harfe çevrilir (Türkçe İ/I özel durumu), harf
   dışı karakterler atılır, token'lara bölünür, stop-word'ler süzülür; her karar sözlüğü ve
   anlamı değiştirir ("değil" silinirse "kötü değil" tersine döner).
2. **TF-IDF ayırt ediciliği tartar.** Bag-of-Words sayar; TF-IDF her belgede geçen terimi
   hafifletir, az belgede geçeni ağırlaştırır; satırlar L2 normuyla birim uzunluğa getirilir.
   Her sayı formülüyle ve sayılarıyla yazılır.
3. **Kosinüs benzerliği yönü ölçer, anlamı değil.** Ortak sözlükte iki vektörün açısının
   kosinüsü; uzunluk farkını yok sayar; ortak terim yoksa 0. Türkçe ekler ("bağlantı" /
   "bağlantısı") ortak terimi böler; zıt duygulu iki yorum yüksek benzerlik alabilir.
4. **Duygu sınıflandırıcısı ağırlıklı kelime toplamıdır.** `Pipeline(TfidfVectorizer,
   LogisticRegression)`: bir yorumun skoru, terimlerinin TF-IDF ağırlığı × model katsayısı
   toplamı + kesişimdir. Vektörleştirici yalnız eğitimde öğrenilir; sözlükte olmayan kelime yok
   sayılır (sözlük kayması); duygu etiketi churn etiketi değildir.

Kabul ölçütleri:

1. İki yeni sayfa yayında: `tfidf-kosinus/` ("TF-IDF ve kosinüs benzerliği", 10 adım) ve
   `duygu-analizi/` ("Duygu analizi: TF-IDF ve lojistik regresyon", 10 adım); ikisi de Ders ve
   Laboratuvar modunda çalışır. Ana sayfada Bölüm 12'nin iki kartı "hazır" olur: 29 kavram,
   28 hazır, 1 yakında.
2. Ekrandaki her model sayısı (IDF, TF-IDF ağırlıkları, kosinüs skorları, katsayılar,
   olasılıklar, karışıklık matrisleri, sözlük sayımları) üreticinin scikit-learn ile yazdığı
   veriden gelir ya da tarayıcıda o veriden hesaplanır ve birim testinde üreticinin fixture'ıyla
   doğrulanır. Kitabın tutan sayıları (0,43 / 0,56; 0,14; doğruluk 0,50; 0,542) üreticide
   denetlenir; tutmazsa üretici durur.
3. Her hesap sayılarıyla da yazılır ("IDF(destek) = ln(4 / 3) + 1 = 1,288",
   "cos = 0,402 · 0,355 = 0,143").
4. 1280×720'de Ders ve Lab adımlarında yazı yazının üstüne binmez, hiçbir şey kırpılmaz;
   900 px altında tek sütun, 390 px'te yatay taşma yok ve sahne oynatıcı çubuğunun altında
   kalmaz (`dar-ekran.spec.ts` hazır sayfaları kayıt defterinden otomatik kapsar).
5. Lab metin kutusuna yazarken sayfa klavye kısayolları (ok tuşları, boşluk) adım değiştirmez.
6. `npm run check` yeşil; kontrolcü ekran görüntülerine kendisi bakar.

## Kararlar

| Konu | Karar | Kimin |
|---|---|---|
| Sayfa sayısı | İki sayfa: temsil ve benzerlik (sayfa 1); duygu sınıflandırıcısı, sızıntı, sözlük kayması (sayfa 2) | Benim kararım (Bölüm 7–11'in iki sayfa kalıbı) |
| Kimlikler | `tfidf-kosinus` ve `duygu-analizi`; kayıttaki `soon('tfidf-kosinus', 12, …)` iki hazır kayıtla değişir | Benim kararım |
| Sayfa 1 verisi | Kitabın küçük örnekleri aynen: kod01 yorumu, kod02'nin 3 belgesi, kod03'ün 3 yorumu | Kitap |
| Sayfa 2 verisi | Kitabın 8 yorumu yetmez (test 2 yorum). Üretici, telekom yorum kalıplarından tohumlu (42) yaklaşık 400 etiketli Türkçe yorum üretir: olumlu / olumsuz kalıplar, olumsuzlama ("kötü değil", "hızlı değil"), ortak teknik terimler; ayrıca 40 yorumluk "yeni dönem" kümesi (eğitimde hiç geçmeyen terimler: "fiber", "eSIM", "5G" gibi). Kitabın 8 yorumu ve mini uygulaması ayrıca aynen hesaplanır | Benim kararım: sızıntı, olumsuzlama ve kayma ancak yeterli veriyle ölçülür |
| TF-IDF tanımı | Ekranda sklearn'ün varsayılanı: tf = ham sayı, IDF = ln((1+N)/(1+df)) + 1, satır L2 normu. Kitabın ders kitabı tanımı (TF = f / n_d, IDF = log(N / df)) adım 5'te karşılaştırma olarak bir satır | Benim kararım: kitabın tablosundaki sayılar sklearn tanımından gelir |
| Tarayıcı hesabı | Sayfa 1: tokenizer, BoW, TF-IDF, kosinüs TS'de canlı (fixture'la 1e-12). Sayfa 2: üreticinin eğittiği modellerin sözlüğü, IDF'i, katsayıları ve kesişimi; TS yalnız yeni metni dönüştürür ve skorlar (fixture'la 1e-9). Tarayıcıda model eğitimi yok | Benim kararım: lbfgs ikizi gereksiz; Lab yazılan yorumu canlı skorlar |
| Sayfa 2 model seti | Üreticide eğitilir: {unigram, unigram+bigram} × {"değil" stop-word'de: hayır, evet} × {vektörleştirici: yalnız eğitim, tüm veri (sızıntılı)} = 8 model; hepsi `LogisticRegression(max_iter=1000)` (C = 1) | Benim kararım |
| Isı tablosu | BoW / TF-IDF tablosu: `korelasyon-isi-haritasi/scene-heat.ts` uygunsa `src/core/plot/`'a taşınır ve iki sayfa kullanır; değilse yeni `src/core/plot/heat-table.ts` | AGENTS.md ortak parça kuralı |
| Metin kutusu | Lab'de yeni kontrol türü: tek satırlık metin kutusu (en çok 200 karakter); yazarken klavye kısayolları devre dışı; yazım 150 ms sonra işlenir | Benim kararım |
| Görünüm | Olumlu lacivert, olumsuz turuncu; süzülen token üstü çizili gri; sözlük dışı token kesikli çerçeve; ısı tablosunda BoW mavi, TF-IDF turuncu (kitabın Şekil 12.2'si) | Benim kararım |

## Kapsam dışı

- Kök bulma / lemmatization, kelime gömmeleri, dönüştürücü modeller (yalnız kitabın alternatifler
  tablosundan birer satır, adım 10 kartlarında).
- Üç sınıflı duygu (nötr), emoji özellikleri, kişisel veri maskeleme deneyi (kartta bir cümle).
- Sınıf dengesizliği deneyi (Bölüm 11 `dengesiz-veri/` bağlantısı; sayfa 2 adım 5'te bir cümle).
- Tarayıcıda model eğitimi; kitabın düzeltilmesi (yalnız "Kitapla farklar").

## Ortak öğretim dili ve görünüm

Bölüm 9–11 kuralları aynen: metin boyutları yalnız `--fs-*` belirteçlerinden; SVG'lerde viewBox
yok; sayılar Türkçe ondalık virgülüyle (TF-IDF, IDF, kosinüs, olasılık 3 ondalık; doğruluk yüzde
1 ondalık; katsayılar 2 ondalık); hesaplanan sayıdan sonra kesme işaretli ek yok ("9 terim",
"3 belge"); tarama bitince taranan değer son değerinde kalır; `prefers-reduced-motion` altında
son durum anında çizilir; adım kartı Lab'de `labText` gösterir; etkileşimli sahne öğeleri yalnız
Lab'de. Token'lar ekranda kod yazı tipinde, küçük kutucuklar ("çip") olarak.

- Sahneler `src/core/plot/` parçalarını kullanır (`AxesLayer`, `HBarsLayer` (IDF, katsayılar,
  katkılar), formül şeridi, etiket yerleştirici, biçimlendirme, geçişler, ısı tablosu). İki
  sayfanın ortak verisi ve hesabı `src/concepts/metin/` altında (Bölüm 10–11 kalıbı).
- Karışıklık matrisi: `src/concepts/dengesiz/matrix.ts` üçüncü kez gerekiyorsa
  `src/core/plot/`'a taşınır (Bölüm 11 son incelemesinin notu).
- Sınıf adları ekranda: "olumlu" ve "olumsuz".

## Ortak veri ve hesap (`src/concepts/metin/`)

- `data/metin.json` (yalnız üretici yazar):
  - **kitap örnekleri:** kod01 yorumu ve token listesi; kod02'nin 3 belgesi, sözlüğü, BoW ve
    TF-IDF matrisi, IDF; kod03'ün 3 yorumu, sözlüğü, TF-IDF matrisi ve skorları; kod04'ün 8
    yorumu, etiketleri, bölmesi, test tahminleri, raporu ve yeni yorumun olasılığı; mini
    uygulamanın 4 yorumu, örnek yorumun olasılığı ve skorları;
  - **yorum külliyatı:** yaklaşık 400 yorum (metin, etiket, kalıp türü: düz / olumsuzlama /
    karışık), katmanlı 75/25 bölmedeki yeri; 40 yorumluk "yeni dönem" kümesi;
  - **8 model:** her biri için ayarlar, sözlük (terim → sütun), IDF, katsayılar, kesişim, test
    karışıklık matrisi, test doğruluğu, olumsuzlama altkümesindeki doğruluk, sözlük boyutu,
    yalnız testte geçen terim sayısı (sızıntılı modelde sözlüğe girenler);
  - **kayma:** yeni dönem kümesinde sözlük dışı token oranı ve doğruluk (eğitim modeliyle).
- Saf TS fonksiyonları:
  - `tokenize(text, stopWords)` → `{ tokens, dropped }`: kitabın kod01'i: `İ→i`, `I→ı`,
    küçük harf, `[^a-zçğıöşü\s]` → boşluk, bölme, 1 karakterlik token'ları atma, sonra stop-word
    süzme. Python eşiyle aynı çıktı (fixture).
  - `bow(docs, vocab?)`, `tfidf(docs, vocab?, idf?)` → sklearn `CountVectorizer` /
    `TfidfVectorizer` varsayılanıyla aynı: sözlük alfabetik (sklearn'ün kod noktası sırası),
    `token_pattern` `(?u)\b\w\w+\b`, ngram (1, n); IDF ve L2 normu; verilen sözlük ve IDF ile
    `transform` (sözlük dışı terim atılır ve sayılır).
  - `cosine(a, b)` → sıfır vektörde 0.
  - `score(model, text)` → `{ terms: { term, weight, coef, contribution }[], z, p, oov }`.
- Birim testleri: TS `tfidf` kitap örneklerinde ve külliyatta (her model ayarıyla) fixture'daki
  sklearn matrisleriyle 1e-12 içinde; `score` 8 modelde test yorumlarının olasılığını fixture'la
  1e-9 içinde; `tokenize` fixture'daki 20 örnek yorumda (Türkçe İ/I, rakam, noktalama) birebir.
- Üretici: `scripts/make_metin_data.py` (`--check` ile kayma denetimi; diğer üreticilerin
  kalıbı; iki kez çalışınca bayt bayt aynı). Denetimler: kod02 TF-IDF 0,43 / 0,56 (2 ondalık);
  kod03 skoru 0,14; kod04 doğruluğu 0,50; yeni yorum p > 0,5; olumsuzlama altkümesinde
  "değil" korunan unigram+bigram modelin doğruluğu "değil" silinen modelinkinden yüksek; yeni
  dönem kümesinin sözlük dışı oranı eğitim testininkinden yüksek; tutmazsa durur ve raporlar.
  Fixture: `tests/fixtures/metin_sklearn.json`.

## Sayfa 1 — TF-IDF ve kosinüs benzerliği (`tfidf-kosinus/`)

### Öğrenme sonucu

Öğrenci ham bir yorumun token listesine dönüşmesini karakter karakter izler; stop-word ve
Türkçe karakter kararlarının sözlüğü nasıl değiştirdiğini görür; BoW sayımından TF-IDF
ağırlığına bir hücrenin yolunu sayılarıyla hesaplar; kosinüs benzerliğinin yön ölçtüğünü, uzunluğu
yok saydığını ve ortak terim olmadan sıfır olduğunu fark eder; yüksek benzerliğin aynı anlam
demek olmadığını görür.

### Görünüm

Adım 1–3'te **token şeridi**: üstte ham yorum, altında token çipleri (süzülen çip üstü çizili
gri, atılan karakterler soluk). Adım 4–7'de **ısı tablosu**: satırlar belgeler, sütunlar terimler;
yanında IDF çubukları (`HBarsLayer`) ve formül şeridi. Adım 8–9'da **vektör düzlemi** (iki
terimli izdüşüm: iki ok ve aradaki açı yayı, `AxesLayer`) ve yanında sıralı benzerlik listesi.
Adım 10'da **kartlar**.

### Adımlar (Ders)

1. **Ham yorumdan token'a.** Kitabın yorumu "İnternetim 3 gündür çok yavaş; destek ekibi dönüş
   yapmadı!": küçük harf (İ → i), rakam ve noktalama atılır, 8 token (veriden). Kitabın kod01
   satırları şeritte.
2. **Türkçe karakter tuzağı.** `[^a-z\s]` deseni "bağlantı kötü"yü "ba lant kötü" yapar;
   `[^a-zçğıöşü\s]` korur. Ayrıca Python'un `lower()`'ı "İ"yi iki karaktere çevirir; kitabın
   `replace` adımı bunu önler. İki satır yan yana, bozulan çipler turuncu çerçeveli.
3. **Stop-word süzme.** Kitabın kümesi {ve, ile, bir, bu, şu, için, çok, ama}; çipler süzülür,
   `Counter` satırı. Uyarı: "değil" listeye girerse "hizmet kötü değil" → [hizmet, kötü] (anlam
   ters döner).
4. **Bag-of-Words.** Kitabın kod02 belgeleri (3 belge, 9 terim); sayım tablosu; "destek" 0. ve
   1. belgede 1, "yavaş" yalnız 0. belgede 1. "Sayım her terimi eşit tartar."
5. **IDF.** Her terimin belge sıklığı (df) ve IDF çubukları: df 1 → 1,693, df 2 → 1,288
   (veriden); formül şeridi IDF = ln((1 + 3) / (1 + df)) + 1, sayılarıyla. Kitabın ders kitabı
   tanımı log(N / df) karşılaştırma satırı: "sklearn 1 ekleyerek sıfıra bölmeyi ve sıfır
   ağırlığı önler."
6. **TF × IDF ve L2 normu.** 0. belgenin satırı: ham ağırlıklar (1 · 1,288; 1 · 1,693 …), norm
   3,008 (veriden), bölünce 0,428 / 0,563. Tarama hücre hücre ilerler.
7. **BoW ile TF-IDF yan yana.** İki ısı tablosu (mavi / turuncu, kitabın Şekil 12.2'si):
   "destek" BoW'da "yavaş" kadar, TF-IDF'te daha hafif.
8. **Kosinüs benzerliği.** Kitabın kod03'ü: sorgu "internet bağlantısı sürekli kopuyor";
   skorlar 1,000 / 0,143 / 0,000 (veriden), sıralı liste; formül şeridi cos = A·B / (‖A‖‖B‖)
   sayılarıyla (satırlar birim uzunlukta; ortak terim yalnız "internet": 0,402 · 0,355 = 0,143). Vektör düzleminde "internet" ×
   "bağlantı" izdüşümü. "'bağlantısı' ile 'bağlantı' ayrı terim: ek, ortak kelimeyi böldü."
9. **Uzunluk değil yön.** Sorgunun iki kez yazılmış hâli: kosinüs 1,000, Öklid uzaklığı
   (ham sayımlarda) büyür; vektör düzleminde aynı yönde iki farklı uzunlukta ok. "Uzun ve kısa
   yorum aynı konuyu anlatıyorsa yönleri aynıdır."
10. **Ortak sözlük ve sınır.** İki kart: (a) kitabın "her belge ayrı sözlük" hatası — iki ayrı
    vektörleştiricinin sütunları farklı anlama gelir, karşılaştırma anlamsız; doğrusu tek
    vektörleştirici; (b) "Sık yanlış anlama": "internet bağlantısı çok iyi" ile "internet
    bağlantısı çok kötü" kosinüsü 0,603 (veriden), duyguları zıt. Ders sonu bağlantıları:
    duygu analizi sayfasına ve Bölüm 7 `k-means/` sayfasına (benzerlik → kümeleme).

### Laboratuvar

- **Adım 1–3:** metin kutusu (yorum yazılır; hazır örnek seçimi de var) ve stop-word anahtarları
  (kitabın kümesi açık / kapalı, "değil" ekle); çipler canlı.
- **Adım 4–7:** üç belgenin metin kutuları (hazır: kitabın kod02'si) ve terim seçimi; tablo, IDF
  ve formül canlı.
- **Adım 8–9:** sorgu belgesi seçimi ve dördüncü belge metin kutusu; skorlar, sıralama ve düzlem
  canlı (düzlemin iki terimi seçilebilir).
- **Adım 10:** "ayrı sözlük" anahtarı: iki belge ayrı vektörleştiricilerle; sütun adları
  yan yana gösterilir.
- Adıma göre yalnızca o adımın kontrolleri görünür.

## Sayfa 2 — Duygu analizi: TF-IDF ve lojistik regresyon (`duygu-analizi/`)

### Öğrenme sonucu

Öğrenci TF-IDF + lojistik regresyon boru hattının bir yorumu nasıl skorladığını terim katkılarından
okur; en olumlu ve en olumsuz kelimeleri görür; bigram'ın ve "değil"in olumsuzlamayı nasıl
taşıdığını ölçer; vektörleştiriciyi tüm veride öğrenmenin sözlüğe test kelimelerini soktuğunu,
sözlükte olmayan kelimelerin yok sayıldığını ve bunun yeni şikâyet türlerini görünmez kıldığını
fark eder; kitabın hata ayıklama kodundaki dört hatayı görür.

### Görünüm

Adım 1–2'de **akış şeridi** (yorum → temizle → TF-IDF → lojistik regresyon → olumlu / olumsuz)
ve külliyat sayımları. Adım 3'te **katsayı çubukları** (en olumlu 10 ve en olumsuz 10 terim,
`HBarsLayer` iki yönlü). Adım 4, 7, 9'da **skor panosu**: yorumun token çipleri, her terimin
katkı çubuğu (ağırlık × katsayı), toplam z, sigmoid eğrisi üstünde p. Adım 5'te **karışıklık
matrisi**. Adım 6'da iki modelin yan yana katkı panoları. Adım 8'de **sözlük şeridi** (eğitim
sözlüğü / yalnız testte geçen terimler). Adım 10'da **kod paneli**.

### Adımlar (Ders)

1. **Görev.** Yorum külliyatı (sayılar veriden): olumlu / olumsuz sayımları; birkaç örnek yorum
   etiketleriyle. Kitabın uyarısı: "Duygu etiketi, müşteri kaybı etiketi değildir."
2. **Boru hattı.** Akış şeridi ve kitabın satırı `Pipeline(steps=[("tfidf", TfidfVectorizer(…)),
   ("siniflandirici", LogisticRegression(max_iter=1000))])`; katmanlı 75/25 bölme sayımları.
   "fit yalnız eğitimde: sözlük ve IDF eğitimden öğrenilir."
3. **Kelimelerin ağırlığı.** Unigram modelin en olumlu ve en olumsuz 10 terimi (katsayılar
   veriden). "Model her kelimeye bir ağırlık verir; yorum bu ağırlıkların TF-IDF'le tartılmış
   toplamıdır."
4. **Bir yorumu skorlamak.** Kitabın yeni yorumu "bağlantı sorunu çözüldü destek ekibi çok
   ilgili": token çipleri, katkı çubukları, z = Σ katkı + kesişim, p = 1 / (1 + e^−z) (külliyat
   modeliyle, veriden); altında kitabın 8 yorumluk modeliyle p = 0,542.
5. **Test sonucu.** Unigram modelin test matrisi, doğruluk, olumsuz sınıfın kesinlik /
   duyarlılığı (veriden). Kitabın 8 yorumluk örneğinin raporu (test 2 yorum, doğruluk 0,50):
   "iki yorumla ölçülen başarı ölçüm değildir." Dengesizlik için Bölüm 11 bağlantısı.
6. **Bigram ve olumsuzlama.** Aynı olumsuzlamalı yorum ("hizmet kötü değil" türü, külliyattan)
   unigram ve unigram+bigram modelde: "kötü değil" bigram'ının katsayısı ve iki p; olumsuzlama
   altkümesindeki iki doğruluk (veriden).
7. **"değil" stop-word olursa.** Aynı yorum, "değil" süzülmüş modelde: [hizmet, kötü] kalır,
   tahmin olumsuz; olumsuzlama altkümesindeki doğruluk düşer (veriden). Kitabın "Hizmet kötü
   değil" cümlesi.
8. **Sızıntı: vektörleştirici tüm veride.** Sızıntılı modelin sözlüğünde yalnız testte geçen N
   terim (veriden) ve onların IDF'i; sızıntısız modelde bu terimler sözlük dışı. Test doğruluğu
   iki modelde (veriden; fark küçükse "fark küçük; ama test artık görülmemiş veri değil" yazılır).
9. **Sözlük kayması.** Yeni dönem yorumları ("fiber", "eSIM" gibi): sözlük dışı token oranı
   eğitim testinde ve yeni dönemde (veriden); yalnız yeni terimlerden oluşan yorumun vektörü
   sıfır, p yalnız kesişimden (veriden). Kitabın önerisi: sözlük dışı oranını izleyip eşikte
   yeniden eğitmek.
10. **Hata ayıklama.** Kitabın `DuyguHata` kodu; dört hata sırayla işaretlenir (liste yerine
    demet, boş metinle `fit_transform`, olmayan satıra erişim, doğrulanmamış stop-word listesi);
    sonra düzeltilmiş kod. Kitabın sınav notu: "'Model çalıştı' ifadesi, modelin güvenilir
    olduğu anlamına gelmez." Ders sonu bağlantıları: TF-IDF sayfasına ve Bölüm 11
    `smote-sizinti/` sayfasına.

### Laboratuvar

- **Adım 1–3:** model seçimi (unigram / unigram+bigram); katsayı çubuklarında terim sayısı (5–20).
- **Adım 4, 6, 7, 9:** metin kutusu (kendi yorumunuz; hazır örnek seçimi de var) ve model
  ayarları (bigram açık / kapalı, "değil" stop-word'de evet / hayır); katkılar, z ve p canlı
  (TS `score`); sözlük dışı token'lar kesikli çerçeveli. Adım 9'da hazır örnekler yeni dönem
  yorumlarıdır.
- **Adım 5:** model seçimi; matris ve metrikler (veriden).
- **Adım 8:** sızıntılı / sızıntısız seçimi; sözlük şeridi ve sayılar.
- **Adım 10:** "düzeltilmiş kodu göster" anahtarı.
- Adıma göre yalnızca o adımın kontrolleri görünür.

## Kitapla farklar (kitap düzeltmesi için liste)

- Kod03 açıklaması ortak terimleri "internet ve bağlantı" sayar; "bağlantısı" ile "bağlantı"
  ayrı terimdir, ortak terim yalnız "internet"tir (0,14 bu yüzden düşük). Sayfa bunu adım 8'de
  gösterir.
- TF / IDF formülü (TF = f / n_d, IDF = log(N / df)) kitabın tablosundaki sayıları vermez;
  tablo sklearn'ün yumuşatılmış IDF'i ve L2 normundan gelir (kitabın "Metin Temsili" bölümü bunu
  doğru yazar). Sayfa ikisini adım 5'te yan yana koyar.
- Mini uygulamanın örnek yorumu için p = 0,500 tam ortadadır ve en yüksek benzerlik iki yorumda
  eşittir; "Duygu tahmini: olumlu" ve "En benzer yorum" çıktısı eşitlik kırılmasından gelir.
- Kod04'ün 2 yorumluk test kümesi bir ölçüm değildir (kitap da küçük veri uyarısı verir); sayfa
  külliyatla ölçer, kitabın raporunu yalnız karşılaştırma olarak gösterir.

## Arayüzler

- Her sayfa mevcut `ConceptPage<Params>` sözleşmesini sağlar; `StepPlayer` adım/tarama
  sözleşmesi değişmez; adım indeksleri `stepIndex` ile adım kimliklerinden türetilir; Lab metni
  `Step.labText`.
- Kimlikler ve yollar: `tfidf-kosinus` → `tfidf-kosinus/`, başlık "TF-IDF ve kosinüs
  benzerliği"; `duygu-analizi` → `duygu-analizi/`, başlık "Duygu analizi: TF-IDF ve lojistik
  regresyon". Kayıt defterinde `soon('tfidf-kosinus', 12, …)` iki hazır kayıtla değişir.
- Çekirdek: Lab metin kutusu (`src/core/` altında küçük bir yardımcı; klavye kısayollarını
  odakta devre dışı bırakır — `src/core/keyboard.ts` bunu denetler); ısı tablosu `src/core/plot/`.
- Parametre adları (öneri, yapıcıya bırakılır): sayfa 1 `{ text: string; stop: boolean; degil:
  boolean; docs: [string, string, string]; term: string; query: number; extra: string; plane:
  [string, string]; separate: boolean }`; sayfa 2 `{ bigram: boolean; degilStop: boolean; leaky:
  boolean; topN: number; text: string; fixed: boolean }`.

## Hata durumları

- Boş ya da yalnız stop-word'den oluşan yorum: "Boş yorum analiz edilemez." (kitabın mini
  uygulaması); sayfa 2'de p yazılmaz.
- Bütün token'ları sözlük dışı yorum: vektör sıfır, "sözlükte bilinen kelime yok; tahmin yalnız
  kesişimden" notu, p gösterilir.
- Sıfır vektörlü belgenin kosinüsü 0 yazılır (sklearn'le aynı), NaN değil.
- Sayfa 1 Lab'de belge sayısı 1'e düşerse (diğer kutular boş) IDF tek değerlidir; tablo yine
  çizilir.
- Hiçbir durumda NaN / Infinity ekrana basılmaz.

## Doğrulama

- Birim: ortak hesap fixture'a karşı (yukarıda); senaryo adım kimlikleri, parametreleri ve
  metinlerdeki sayıların veriden geldiği; sahne testleri (her adımın anahtar DOM öğesi: token
  çipleri ve süzülen / bozulan çipler, ısı tablosu hücreleri, IDF çubukları, formül şeridi,
  vektör okları ve açı yayı, benzerlik listesi, kartlar; akış şeridi, katsayı çubukları, katkı
  çubukları ve p, karışıklık matrisi, sözlük şeridi, kod paneli işaretleri); metin kutusunda ok
  tuşunun adım değiştirmediği.
- e2e (yalın): her sayfa için Ders anahtar adımları (sayfa 1: 1, 5, 6, 8; sayfa 2: 3, 4, 7, 8)
  ve birer Lab etkileşimi (sayfa 1: adım 8'de dördüncü belgeyi yaz; sayfa 2: adım 4'te yorum yaz,
  bigram aç) ekran görüntüsü temeliyle; etiket çakışması ve sahne dışına taşma kontrolleri.
- Performans: sayfa 1 adım 6'da belge metnine yazma (TF-IDF yeniden) ve sayfa 2 adım 4'te yorum
  yazma (skor yeniden) p95 ≤ 25 ms (bölüm sonunda bir kez).
- Kapanış: `npm run check` çıkış 0; kontrolcü ekran görüntülerine kendisi bakar.

## Yapıcıya bırakılanlar

- Dosya bölünmesi, parametre adları, külliyat kalıplarının metinleri (Türkçe, doğal, telekom
  bağlamında; kişisel veri yok), panel oranları, çip boyutları, vektör düzleminin terim seçimi
  kuralı, tarama hızları, kod panelinin yazı tipi.
