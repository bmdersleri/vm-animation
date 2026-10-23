# Bölüm 9 — Topluluk öğrenmesi: bootstrap, bagging, Random Forest, OOB ve öznitelik önemi — Tasarım

- **Tarih:** 2026-10-23
- **Kaynak:** Öğretmen: "sıradaki bölüme geçelim", ardından "soruları atla, sen öner ve başla".
  Kitabın `ch09_topluluk_ogrenmesi/content/final.md` bölümü (salt okunur).
- **Yetki:** Bütün tasarım kararları benimdir (aşağıda "Benim kararım"); öğretmen soru
  sorulmamasını istedi. Kararlar ledger'da `Ruling:` satırı olarak da durur ve iş sonunda
  öğretmene listelenir. Yayın (main'e push) için öğretmenin onayı ayrıca beklenir.
- **Önceki tasarımlar:** Bölüm 8 (`2026-10-22-bolum8-birliktelik-design.md`) ve Bölüm 5
  karar ağacı sayfası; ortak görünüm kuralları oradan devralınır.
- **Ön deneme (2026-10-23, scikit-learn 1.9.0):** kitabın bütün sayıları yerelde birebir çıktı:
  bootstrap örneği `[0 7 6 4 4 8 0 6 2 0]`, OOB {1, 3, 5, 9}; tek ağaç 0,749 / 0,033, bagging
  0,835 / 0,028; OOB 0,899, 5 katlı CV 0,896; 10 ağaçta OOB 0,798; öznitelik önemleri
  (hizmetSayisi 0,176 … sozlesmeTipi 0,048).

## Amaç ve kabul ölçütleri

Öğrenci üç şeyi kavramalı:

1. **Bootstrap aynı veriden farklı eğitim kümeleri üretir.** Yerine koyarak çekiliş: bazı
   müşteriler iki üç kez, bazıları hiç seçilmez; hiç seçilmeyenler (OOB) ortalama %36,8'dir.
2. **Bagging tek ağacın kararsızlığını oylamayla söndürür.** Bölüm 5'teki 25 müşterilik veride
   her bootstrap başka bir ağaç verir (merkezdeki an: üç ağacın bölgeleri yan yana, birbirine hiç
   benzemiyor); 50 ağacın oyu kararlı bir sınır çizer. Kazanç, ağaçların hataları farklı olduğu
   ölçüde gelir.
3. **Random Forest ağaçları birbirinden uzaklaştırır; OOB ve öznitelik önemi bedavaya gelir.**
   Sıradan bagging'de köklerin neredeyse hepsi aynı iki özniteliği seçer; `max_features = √p`
   kökleri dağıtır, ağaçlar arası korelasyon düşer. Her ağacın görmediği müşteriler onun
   sınavıdır (OOB skoru ≈ CV, tek eğitimle). Önem, modelin neye dayandığını söyler; nedeni değil.

Kabul ölçütleri:

1. İki yeni sayfa yayında: `bagging/` ("Bootstrap ve bagging", 10 adım) ve `random-forest/`
   ("Random Forest, OOB ve öznitelik önemi", 10 adım); ikisi de Ders ve Laboratuvar modunda
   çalışır. Ana sayfada Bölüm 9'un iki kartı "hazır" olur: 26 kavram, 22 hazır, 4 yakında.
2. Ekrandaki her model sayısı (ağaçlar, oylar, OOB, doğruluklar, korelasyonlar, önemler)
   üreticinin scikit-learn ile yazdığı veriden gelir ya da tarayıcıda o veriden hesaplanır ve
   birim testinde üreticinin fixture'ıyla birebir doğrulanır. Kitabın sayıları üreticide
   doğrulanır; tutmazsa üretici durur.
3. Her oran payı ve paydasıyla da yazılır ("4 / 10 = %40,0", "50 ağaçtan 31'i Ayrıldı").
4. 1280×720'de Ders ve Lab adımlarında yazı yazının üstüne binmez, hiçbir şey kırpılmaz;
   900 px altında tek sütun, 390 px'te yatay taşma yok (`dar-ekran.spec.ts` hazır sayfaları
   kayıt defterinden otomatik kapsar).
5. `npm run check` yeşil; kontrolcü ekran görüntülerine kendisi bakar.

## Kararlar

| Konu | Karar | Kimin |
|---|---|---|
| Sayfa sayısı | İki sayfa: bootstrap + bagging; Random Forest + OOB + önem (Bölüm 7–8'in iki sayfa kalıbı) | Benim kararım |
| Kimlikler | `bagging` ve `random-forest`; kayıttaki `soon('bootstrap-rf', 9, …)` iki hazır kayıtla değişir | Benim kararım |
| Bootstrap örneği | Kitabın 10 kimliği (0–9) ve `default_rng(42)` örneği, değiştirilmeden | Kitap |
| İki boyutlu sahne verisi | Bölüm 5 karar ağacı sayfasının 25 eğitim müşterisi (sözleşme ayı × şikâyet, `karar-agaci/data/churn_tree.json`); üretici okur, kopyalar, değiştirmez | Benim kararım: kitap "Bölüm 5'teki tek ağacı yeniden ölç" der; öğrenci veriyi tanır, bölgeler çizilebilir |
| Ağaçlar | Üretici 50 bootstrap örneği ve her birine tam derinlikte bir `DecisionTreeClassifier` (gini) üretir; ağaç yapıları JSON'a yazılır, tarayıcı ağaç *eğitmez*, yalnız yapıdan tahmin eder | Benim kararım: sklearn'ün eşitlik bozma kuralı tarayıcıda yeniden üretilmez, sayılar birebir kalır |
| Oylama | Sert çoğunluk oyu (kitaptaki gibi "en çok oy alan sınıf"); eşitlikte Kaldı (sınıf 0) ve ekranda "berabere" | Benim kararım |
| Sayısal deneyler | Kitabın kendi kodları ve verileri (`make_classification`, kitabın tohumları): 10 bölünme deneyi, OOB/CV, OOB–ağaç sayısı eğrisi, öznitelik önemi | Kitap |
| Random Forest sahne verisi | Kitabın 8 adlandırılmış öznitelikli verisi (600 gözlem, `random_state=21`), 250 ağaç | Kitap; köklerin sayımı, korelasyon, kimlik sütunu benim eklemem |
| Korelasyon ölçüsü | %25 katmanlı test kümesinde ağaçların Ayrıldı olasılıkları arasındaki ortalama ikili Pearson korelasyonu | Benim kararım |
| Kimlik sütunu tuzağı | Veriye rastgele bir `musteriNo` (0–599 karışık) eklenir; MDI ve permütasyon önemi yan yana | Benim kararım: kitabın "yüksek kardinalite" uyarısının görünür hâli |
| Ürün/öznitelik adları | Ekranda kitabın değişken adları (`hizmetSayisi`, `faturaOdemeGecikmesi` …) kod yazımıyla | Kitap |
| Görünüm | Bölüm 5 karar ağacı sayfasının bölge dili (Kaldı turkuaz ●, Ayrıldı turuncu ▲, bölge tonu) ve Bölüm 7–8'in yerleşimi | Benim kararım |

## Kapsam dışı

- Boosting, stacking, Extra Trees (karşılaştırma yalnızca bir bilgi cümlesinde adıyla).
- Kitabın `ch09_kod03` hiperparametre taraması ve sınıf dengesizliği raporu (Bölüm 11'in konusu).
- Regresyon (`p/3`, ortalama alma) — yalnız bir cümle.
- Tarayıcıda ağaç eğitimi, gerçek süre ölçümü (kitabın ölçtüğü süreler bir cümlede anılır).
- SHAP (Bölüm 13; son adımda yalnızca ileri bağlantı cümlesi).
- Kitabın düzeltilmesi (çıktı yalnızca "Kitapla farklar" listesidir).

## Ortak öğretim dili ve görünüm

Bölüm 7–8 kuralları aynen: metin boyutları yalnız `--fs-*` belirteçlerinden; SVG'lerde viewBox
yok; sayılar Türkçe ondalık virgülüyle (oranlar ve doğruluklar 3 ondalık, yüzdeler 1 ondalık);
tarama bitince taranan değer son değerinde kalır; `prefers-reduced-motion` altında son durum
anında çizilir; adım kartı Lab'de `labText` gösterir (Lab'in değiştirdiği sayıları içermez);
etkileşimli sahne öğeleri yalnız Lab'de (Ders ok tuşu / Boşluk ile adımlar).

- Sahneler `src/core/plot/` parçalarını kullanır (eksenler, bölge ızgarası `GridLayer`,
  biçimlendirme, geçişler, etiket yerleştirici, formül şeridi). İkinci sayfanın da kullandığı
  çizim parçası (ör. yatay çubuk listesi, kök sayım çubukları) `src/core/plot/`'a taşınır.
- İki sayfanın ortak verisi ve hesabı `src/concepts/topluluk/` altında durur (Bölüm 8'deki
  `birliktelik/` kalıbı).
- Renkler: Kaldı turkuaz ● / Ayrıldı turuncu ▲ (Bölüm 5); torbada = dolu ve sayısı kadar büyük,
  dışarıda (OOB) = içi boş kesikli çerçeve; bagging lacivert, Random Forest yeşil. Renk tek
  taşıyıcı değildir: durumlar simge, çizgi biçimi ve metinle de verilir.

## Ortak veri ve hesap (`src/concepts/topluluk/`)

- `data/topluluk.json` (yalnız üretici yazar):
  - **kitap bootstrap'ı:** kimlikler 0–9, örnek, tekrar sayıları, OOB kümesi;
  - **müşteriler:** Bölüm 5'in 25 eğitim müşterisi (t, c, y, jy) — `churn_tree.json`'dan;
  - **tek ağaç:** 25 müşterinin hepsiyle tam derinlik ağaç (Bölüm 5 sayfasının sınırsız
    derinlikteki gini ağacıyla aynı olduğu üreticide denetlenir);
  - **50 bootstrap:** her biri için 25 çekilişin dizini, müşteri başına tekrar sayısı ve ağaç
    yapısı (düğüm: öznitelik, eşik, sol, sağ, sınıf sayıları);
  - **sayısal deneyler:** 10 bölünmenin tek ağaç ve bagging doğrulukları (kitap kodu
    `ch09_kod02`); OOB 0,899 ve 5 katlı CV skorları (`ch09_kod04`); `n_estimators` = 10, 20, …,
    500 için OOB skoru (aynı veri, `random_state=3`);
  - **Random Forest verisi (8 öznitelik):** öznitelik adları; `max_features` = 1…8 için 250
    ağacın kök öznitelik sayımları, OOB skoru, test doğruluğu, ağaç başına ortalama test
    doğruluğu ve ortalama ikili korelasyon ρ; kitabın MDI önemleri (600 gözlemin hepsi);
    `musteriNo` eklenmiş modelin MDI ve permütasyon önemleri (`n_repeats=10`, test kümesinde).
- Saf TS fonksiyonları:
  - `predictTree(tree, x)` → yaprak sınıf sayıları ve sınıf; `voteGrid` için hücre başına oy
    sayısı (ilk M ağaç); `majority(votes, M)`.
  - `oobVotes(m, M)`: müşteri m için ilk M ağaçtan onu görmeyenlerin oyları; `oobScore(M)`.
  - `majorityAccuracy(p, M)`: M bağımsız, her biri p doğrulukta sınıflandırıcının çoğunluk
    doğruluğu (binom toplamı; M tek).
  - `ensembleVariance(rho, sigma2, M)` = ρσ² + (1 − ρ)σ²/M.
  - Lab bootstrap'ı: tohumlu, deterministik bir TS rastgele üreteci ile n kimlikten n çekiliş
    (numpy ile eşleşmesi gerekmez; kitabın örneği verideki sabit örnektir).
- Birim testleri: `predictTree` bütün 50 ağaçta fixture ızgarasının (ör. 24 × 24 nokta)
  sklearn tahminleriyle birebir; oy sayıları ve OOB oyları üreticinin Python'da aynı ağaçlarla
  saydığı değerlerle; `majorityAccuracy(0.8, 3)` = 0,896; kitabın bütün sayıları fixture'dan.
- Üretici: `scripts/make_topluluk_data.py` (`--check` ile kayma denetimi; diğer üreticilerin
  kalıbı; iki kez çalışınca bayt bayt aynı). Bootstrap tohumu aranır (0, 1, 2, …) ve ilk uygun
  tohum alınır: ilk üç bootstrap ağacının kök bölünmesi ya da yaprak sayısı birbirinden farklı;
  ilk bootstrap'ın OOB oranı %28–%44; 50 ağacın çoğunluk haritası iki sınıfı da içerir ve tek
  ağaçtan en az bir müşteride farklı karar verir. Üretici kitabın yukarıdaki sayılarını ve
  "10 ağaçta 0,798" değerini doğrular; tutmazsa durur ve raporlar.

## Sayfa 1 — Bootstrap ve bagging (`bagging/`)

### Öğrenme sonucu

Öğrenci yerine koyarak çekilişi izler; tekrar sayılarını ve OOB kümesini okur; OOB oranının
(1 − 1/n)ⁿ → 1/e ≈ %36,8'e gittiğini görür; tek derin ağacın bootstrap'tan bootstrap'a nasıl
değiştiğini; çoğunluk oyunun bu değişkenliği söndürdüğünü; bağımsız hatalarda çoğunluğun neden
daha doğru olduğunu ve kitabın 10 bölünme deneyinde bagging'in hem ortalamayı hem kararlılığı
artırdığını görür.

### Görünüm

Adım 1–4'te **torba sahnesi**: üstte 10 numaralı müşteri kartı (torba), altta 10 yuvalı
bootstrap şeridi; çekilen kart yuvaya iner, torbadaki kart yerinde kalır (yerine koyma); kartın
üstünde tekrar rozeti (×2, ×3); hiç çekilmeyen kartlar kesikli çerçeveyle "OOB". Adım 4'te
torbanın yerine (1 − 1/n)ⁿ eğrisi (n = 1–100) ve 1/e çizgisi.
Adım 5–7'de **bölge sahnesi**: Bölüm 5'in saçılımı (x: sözleşme süresi, ay; y: şikâyet sayısı),
ağacın bölgeleri tonla; bootstrap ağaçlarında torbadaki müşteri tekrar sayısı kadar büyük,
OOB müşteri içi boş. Adım 6'da üç küçük panel yan yana (bootstrap 1, 2, 3). Adım 7'de oy
haritası: hücre tonu Ayrıldı oy payıyla kademeli, çoğunluk sınırı koyu çizgiyle.
Adım 8–10'da **grafik sahnesi**: çoğunluk doğruluğu eğrisi; 10 bölünmenin nokta şeritleri.

### Adımlar (Ders)

1. **Torba.** 10 müşteri, kimlik 0–9. "Bagging her ağaca aynı büyüklükte ama farklı bir eğitim
   kümesi verir. Nasıl?"
2. **Yerine koyarak çek.** Tarama: 10 çekiliş, kitabın örneği `[0 7 6 4 4 8 0 6 2 0]`; her
   çekilişte kart torbaya geri döner. Altında kitabın satırı:
   `rng.choice(musteriKimlikleri, size=10, replace=True)`.
3. **Tekrar ve dışarıda kalanlar.** 0 ×3, 4 ×2, 6 ×2; 2, 7, 8 ×1; 1, 3, 5, 9 hiç çekilmedi:
   OOB = 4 / 10 = %40,0. "OOB müşteriler bu ağacın görmediği, bedava bir sınav kümesidir."
4. **Neden %36,8?** Bir müşterinin n çekilişte hiç seçilmeme olasılığı (1 − 1/n)ⁿ; n = 10'da
   0,349, n büyüdükçe 1/e ≈ 0,368. Her bootstrap verinin ≈ %63,2'sini görür.
5. **Tek ağaç.** Bölüm 5'in 25 müşterisi ve tam derinlikteki ağacı: eğitimde 25 / 25 doğru.
   "Derin ağaç her ayrıntıyı ezberler; yanlılığı düşük, varyansı yüksek."
6. **Üç bootstrap, üç ağaç.** Üç küçük panel: her bootstrap'ın müşterileri (büyüklük = tekrar,
   içi boş = OOB) ve ağacının bölgeleri. Kök bölünmeleri panel başlığında
   ("sözleşme ≤ 13,5 ay"). "Veride küçük bir oynama, kökten farklı bir ağaç."
7. **Oylama.** Tarama: M = 1 → 50 ağaç; oy haritası her durakta yeniden boyanır, çoğunluk sınırı
   durulur. Bir müşteri işaretli: "50 ağaçtan 31'i Ayrıldı → Ayrıldı" (sayı veriden).
8. **Çoğunluk neden kazanır?** Her biri %80 doğru, bağımsız 3 model: çoğunluk yanlışsa en az
   ikisi yanılmıştır: 3 · 0,2² · 0,8 + 0,2³ = 0,104 → doğruluk 0,896. Eğri: M = 1, 3, …, 51 için
   çoğunluk doğruluğu. "Hatalar aynıysa kazanç yok": ρ = 1 çizgisi 0,8'de düz kalır.
9. **Kitabın deneyi.** 10 farklı eğitim/test bölünmesi (500 gözlem, 10 öznitelik): iki nokta
   şeridi; tek ağaç ortalama 0,749, std 0,033; bagging (50 ağaç) ortalama 0,835, std 0,028.
   "Bagging hem daha doğru hem daha kararlı." Altında kitabın satırı:
   `BaggingClassifier(estimator=DecisionTreeClassifier(), n_estimators=50)`.
10. **Bagging'in sınırı.** Ağaçlar aynı güçlü öznitelikleri seçerse hataları benzer olur, oylama
    az kazandırır. Ders sonu bağlantıları: Random Forest sayfasına ("Ağaçları birbirinden nasıl
    uzaklaştırırız?") ve Bölüm 5 karar ağacı sayfasına.

### Laboratuvar

- **Adım 1–3:** "Yeni çekiliş" düğmesi (Lab bootstrap'ı) ve "Kitabın örneği" düğmesi; n
  kaydırıcısı 5–20 (kart sayısı). Tekrar rozetleri ve OOB oranı canlı.
- **Adım 4:** n kaydırıcısı 1–100; eğri üstünde nokta ve "(1 − 1/n)ⁿ = …"; "100 kez çek"
  düğmesi Lab örneklerinin ortalama OOB oranını eğrinin yanına yazar.
- **Adım 5–7:** ağaç no kaydırıcısı 1–50 (o bootstrap'ın müşterileri ve ağacı); adım 7'de ağaç
  sayısı M kaydırıcısı 1–50; saçılımda bir müşteriye tıklamak (ve klavyeyle) onun oy
  dökümünü yazar ("M ağaçtan k'si Ayrıldı").
- **Adım 8:** tek model doğruluğu p (0,50–0,95) ve M (1–51, tek sayılar) kaydırıcıları.
- **Adım 9–10:** kontrol yok.
- Adıma göre yalnızca o adımın kontrolleri görünür.

## Sayfa 2 — Random Forest, OOB ve öznitelik önemi (`random-forest/`)

### Öğrenme sonucu

Öğrenci bagging'de köklerin baskın özniteliklerde toplandığını, `max_features`'ın her düğümde
öznitelik alt kümesi çektiğini ve kökleri dağıttığını; ρ'nun düşmesinin topluluk varyansını
nasıl azalttığını (ρσ² terimi ağaç sayısıyla küçülmez); `max_features` küçüldükçe ağaçların
zayıflayıp korelasyonun düştüğünü (denge); OOB oylamasını müşteri müşteri; OOB skorunun CV'ye
yakın olduğunu ve ağaç sayısıyla doyduğunu; MDI önemini, kimlik sütunu tuzağını ve önemin
nedensellik olmadığını görür.

### Görünüm

Adım 1–4'te **kök sahnesi**: 8 özniteliğin yatay çubukları = 250 ağaçta kökte seçilme sayısı
(bagging lacivert, Random Forest yeşil; iki çubuk yan yana gösterilebilir). Adım 2'de bir düğüm
kartı: 8 öznitelik çipinden 2'si çekilir, en iyisi bölünür. Adım 3'te varyans formülü şeridi ve
M'ye göre iki eğri (ρ bagging, ρ RF). Adım 4'te `max_features` 1–8 için ρ ve test doğruluğu
eğrileri.
Adım 5–6'da **OOB matrisi**: satırlar 25 müşteri (Kaldı ●/Ayrıldı ▲ simgesiyle), sütunlar ilk 12
bootstrap ağacı; hücre = tekrar sayısı (dolu) ya da OOB (boş, kesikli); OOB hücrelerinde o
ağacın o müşteri için oyu (● / ▲). Sağda müşteri başına OOB çoğunluğu ve doğru/yanlış işareti.
Adım 7–8'de **eğri sahnesi**: OOB ve CV yan yana çubuk; OOB – ağaç sayısı eğrisi.
Adım 9–10'da **önem sahnesi**: yatay çubuklar büyükten küçüğe (en önemli üstte); adım 10'da MDI
ve permütasyon iki sütun.

### Adımlar (Ders)

1. **Bagging'de kökler.** 8 öznitelikli veri, 250 ağaç, her düğümde 8 özniteliğin hepsi aday:
   köklerin 247'si iki özniteliğe düşer (`faturaOdemeGecikmesi` 131, `hizmetSayisi` 116; sayılar
   veriden). "Ağaçlar birbirinin kopyasına döner."
2. **Her düğümde rastgele alt küme.** Düğüm kartında 8 çipten √8 → 2'si çekilir; en iyi bölünme
   yalnız bunlar arasında aranır. Kök çubukları Random Forest için yeniden boyanır: kökler
   dağılır. Altında: `RandomForestClassifier(max_features="sqrt")`.
3. **Neden işe yarar?** Topluluk varyansı = ρσ² + (1 − ρ)σ²/M. Ağaç sayısı yalnız ikinci terimi
   küçültür; ilk terim ρ ile kalır. Ölçülen ρ: bagging 0,535, Random Forest 0,454 (veriden);
   iki eğri M = 1–250.
4. **Ne kadar rastgele?** Tarama: `max_features` = 1 → 8; ρ yükselir (0,354 → 0,535), tek ağacın
   doğruluğu da yükselir; topluluğun test doğruluğu ortada en iyi. "Sınıflandırmada öneri √p;
   regresyonda p/3."
5. **OOB matrisi.** Bölüm 5'in 25 müşterisi × ilk 12 bootstrap ağacı. Bir müşteri satırı
   vurgulanır: onu görmeyen ağaçlar oy verir ("12 ağaçtan 4'ü onu görmedi: 3 Ayrıldı, 1 Kaldı →
   Ayrıldı"; sayılar veriden).
6. **OOB skoru.** 50 ağaç: her müşteri kendi OOB çoğunluğuyla tahmin edilir; doğru olanlar
   işaretlenir: OOB skoru = 21 / 25 = 0,840 (veriden). "Ayrı test kümesi ayırmadan."
7. **OOB ≈ çapraz doğrulama.** Kitabın verisi (1000 gözlem, 15 öznitelik, 300 ağaç): OOB 0,899,
   5 katlı CV 0,896. "OOB modeli bir kez eğitir; CV beş kez" (kitabın ölçtüğü 0,27 s / 1,23 s
   bir cümlede). `oob_score=True` satırı.
8. **Kaç ağaç?** OOB – ağaç sayısı eğrisi 10 → 500: 10 ağaçta 0,798, 100–150 civarında ≈ 0,90'da
   doyar. "Bir noktadan sonra ağaç eklemek yalnız süre ekler."
9. **Öznitelik önemi.** Kitabın 8 özniteliği, MDI (ortalama Gini azalımı): `hizmetSayisi` 0,176 …
   `sozlesmeTipi` 0,048; toplam 1. `feature_importances_` satırı.
10. **Önem tuzakları.** Veriye anlamsız `musteriNo` eklenir: MDI ona 0,044 verir (`sozlesmeTipi`
    ile neredeyse eşit), test kümesinde permütasyon önemi 0,001. Sıralama da değişebilir
    (permütasyonda `internetHizi` birinci). Son cümle: "Önem, modelin neye dayandığını söyler;
    nedeni değil: destek çağrısı churn'e yol açmaz, churn'e yatkın müşteri daha çok arar."
    Ders sonu bağlantıları: bagging sayfasına ve Bölüm 13 (yakında, SHAP) yerine Bölüm 4
    özellik seçimi sayfasına.

### Laboratuvar

- **Adım 1–4:** `max_features` kaydırıcısı 1–8; kök çubukları, ρ, OOB ve test doğruluğu canlı
  (veriden). Adım 1'de bagging (8) ile seçili değer yan yana.
- **Adım 3:** ρ (0–1) ve M (1–250) kaydırıcıları; formül şeridi canlı.
- **Adım 5–6:** ağaç sayısı M kaydırıcısı 1–50 (matris en çok 12 sütun gösterir, oylar M ağaçtan);
  bir satıra tıklamak (ve klavyeyle) o müşteriyi seçer.
- **Adım 8:** ağaç sayısı kaydırıcısı 10–500 (10'ar); eğride nokta ve değer.
- **Adım 9–10:** "MDI / permütasyon" anahtarı ve "`musteriNo` ekle" anahtarı.
- Adıma göre yalnızca o adımın kontrolleri görünür.

## Kitapla farklar (kitap düzeltmesi için liste)

- Kitabın kodları 10–15 boyutlu sentetik veride çalışır; sayfa ağaçları çizebilmek için Bölüm 5'in
  iki boyutlu 25 müşterisini kullanır, kitabın sayısal deneylerini kendi verisiyle gösterir.
- Kitap Gini tabanlı önemin "yüksek kardinaliteli özniteliklere yanlı" olduğunu söyler; kitabın
  verisindeki bütün öznitelikler sürekli olduğu için fark görünmez. Sayfa bunu eklenmiş bir
  `musteriNo` sütunuyla gösterir.
- Kitap OOB'u "her bootstrap verinin %63,2'sini içerir" diye verir; sayfa n = 10'da bunun 0,651
  olduğunu (sınır değer değil) da yazar.
- Kitabın akış şeması (bootstrap → ağaçlar → oylama) sayfada canlı çizilir; ağaç korelasyonu
  kitapta yalnız sözle geçer, sayfa ölçer.

## Arayüzler

- Her sayfa mevcut `ConceptPage<Params>` sözleşmesini sağlar; `StepPlayer` adım/tarama
  sözleşmesi değişmez; adım indeksleri `stepIndex` ile adım kimliklerinden türetilir; Lab metni
  `Step.labText`.
- Kimlikler ve yollar: `bagging` → `bagging/`, başlık "Bootstrap ve bagging"; `random-forest` →
  `random-forest/`, başlık "Random Forest, OOB ve öznitelik önemi". Kayıt defterinde
  `soon('bootstrap-rf', 9, 'Bootstrap ve Random Forest')` iki hazır kayıtla değişir
  (sıra: bagging, random-forest).
- Parametre adları (öneri, yapıcıya bırakılır): sayfa 1 `{ n: number; draw: number; tree: number;
  trees: number; p: number; m: number; pick: number | null }`; sayfa 2 `{ maxFeatures: number;
  rho: number; trees: number; pick: number | null; nEstimators: number; method: 'mdi' | 'perm';
  withId: boolean }`.

## Hata durumları

- Oy eşitliği (çift M): "berabere → Kaldı" yazılır.
- Bir müşteri M ağacın hepsinde torbadaysa (OOB oyu yok): "OOB oyu yok (her ağaç onu gördü)";
  OOB skorunun paydası yalnız oyu olan müşterilerdir ve ekranda yazar ("21 / 25").
- Lab bootstrap'ında hiç OOB çıkmazsa (küçük n): "Bu çekilişte dışarıda kalan yok".
- Hiçbir durumda NaN / Infinity ekrana basılmaz.

## Doğrulama

- Birim: ortak hesap fixture'a karşı (yukarıda); senaryo adım kimlikleri, parametreleri ve
  metinlerdeki sayıların veriden geldiği; sahne testleri (her adımın anahtar DOM öğesi: torba
  kartları ve tekrar rozetleri, OOB çerçeveleri, eğri ve 1/e çizgisi, üç panelin kök başlıkları,
  oy haritası ve çoğunluk sınırı, nokta şeritleri; kök çubukları, düğüm kartı çipleri, formül
  şeridi, OOB matrisi hücreleri, OOB/CV çubukları, önem çubukları).
- e2e (yalın): her sayfa için Ders anahtar adımları (sayfa 1: 2, 3, 6, 7; sayfa 2: 1, 2, 5, 10)
  ve birer Lab etkileşimi (ağaç no + M kaydır, müşteriye tıkla; `max_features` kaydır + MDI /
  permütasyon anahtarı) ekran görüntüsü temeliyle; etiket çakışması ve sahne dışına taşma
  kontrolleri.
- Performans: sayfa 1 adım 7 M sürükleme (oy haritası yeniden boyanır) ve sayfa 2
  `max_features` sürükleme p95 ≤ 25 ms (bölüm sonunda bir kez).
- Kapanış: `npm run check` çıkış 0; kontrolcü ekran görüntülerine kendisi bakar.

## Yapıcıya bırakılanlar

- Dosya bölünmesi, parametre adları, panel iç düzeni, torba kartı ve matris hücre boyutları
  (1280×720'de 25 × 12 matris ve 10 kart sığmalı), oy haritasının ton kademeleri (`GridLayer`
  ikiden çok kademe gerektirirse çekirdekte genişletilir), tarama hızları, palet içindeki renk
  tonları, Lab bootstrap üretecinin algoritması.
