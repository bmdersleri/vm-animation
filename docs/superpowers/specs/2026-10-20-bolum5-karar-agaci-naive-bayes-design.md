# Bölüm 5'i tamamlama — Karar Ağacı ve Naive Bayes sayfaları — Tasarım

- **Tarih:** 2026-10-20
- **Kaynak:** Hocanın isteği: "öncelikle bölüm 5'i tamamlayalım, karar ağaçları ve naive bayes". Beyin fırtınası sohbeti ve görsel taslaklar `.superpowers/brainstorm/8650-1792513767/content/` altında (`agac-bolum1.html`, `agac-bolum2.html`, `nb-guncelleme.html`).
- **Kitap:** *Modern Veri Madenciliğine Giriş*, Bölüm 5, `C:\projects\ModernVeriMadenGiris\chapters\ch05_siniflandirma_temelleri\content\final.md`. Karar ağaçları 91–512. satırlar, Naive Bayes 667–835. satırlar.
- **Önceki tasarım:** `docs/superpowers/specs/2026-10-20-vm-animasyon-knn-design.md`. Ortak iskelet (§4), kırmızı çizgiler (§3) ve görsel kimlik oradan aynen geçerlidir. Bu belge yalnızca yeni olanı anlatır.

## Amaç ve kabul ölçütleri

Bölüm 5'teki üç algoritmanın üçü de sitede animasyonlu sayfaya sahip olmalı. Hocanın öğrencilerin en çok takıldığını söylediği iki an hedeflenir:

- **Karar ağacı:** Gini ve bilgi kazancının nasıl hesaplandığı, ve **hangi bölünmenin neden seçildiği**.
- **Naive Bayes:** **Öncül ve sonsal olasılığın nasıl güncellendiği.**

Hoca, konuyu en iyi anlatan örneklerin kullanılmasını istedi. k-NN'deki churn verisini her sayfada kullanmak zorunlu değil.

1. `karar-agaci/` ve `naive-bayes/` sayfaları yayında. Ana sayfadaki iki kart `hazir` durumunda ve bu sayfalara bağlı.
2. Hoca, her iki sayfayı Ders modunda yalnızca klavyeyle (→ / ←) baştan sona anlatabiliyor. 1280×720'de k-NN tasarımının §3'teki yazı boyutu eşikleri her adımda sağlanıyor.
3. Karar ağacında, her adayın Gini (ya da entropi) değeri, sayıları yerine konmuş formülüyle görünüyor. Kazanan aday görsel olarak işaretleniyor.
4. Naive Bayes'te "sonsal, bir sonraki öncül olur" anı, tek bir kayan olasılık çubuğu ve geride bıraktığı izle görülüyor.
5. Sayfalardaki her sayı, aynı veri ve parametrelerle scikit-learn'ün verdiği sonuçla aynı. Bu, Python betiğinin ürettiği sabit beklenen değerlere karşı birim testleriyle doğrulanır. Bağlantılı sınıflar: `DecisionTreeClassifier`, `MultinomialNB` ve `GaussianNB`.
6. Eşik taraması, derinlik kaydırıcısı, nokta sürükleme ve 1.000 kişilik tablo animasyonu takılmadan akıyor. Bunlar Playwright performans testleriyle ölçülür (k-NN'deki gibi p95 bütçeleri).
7. k-NN sayfası davranış olarak değişmiyor ve mevcut testlerinin hepsi geçiyor.

## Kararlar

| Konu | Karar | Neden |
|---|---|---|
| Sayfa sayısı | İki ayrı kavram sayfası: Karar Ağacı ve Naive Bayes | Ana sayfadaki kayıtlar zaten ayrı (`karar-agaci`, `naive-bayes`) |
| Örnekler | Her bölüm için konuyu en iyi anlatan örnek seçilir | Hocanın kararı |
| Ağaç, sıra | Önce kategorik soru seçimi (tenis), sonra sayısal eşik taraması | Hocanın kararı ("bu sıra uygun") |
| Ağaç, Bölüm 1 düzeni | Dört aday kart yan yana yarışır. Altta, değerleri yerine konmuş formül şeridi (taslak A) | Hocanın seçimi |
| Ağaç, Bölüm 2 düzeni | Dağılım ve Gini eğrisi aynı yatay ekseni paylaşır, eğri grafiğin altındadır. Ağaç sağ sütunda baştan görünür ve büyür (taslak A) | Hocanın seçimi |
| Ağaç, şikâyet ekseni eğrisi | Alttaki eğri paneli o an süren taramanın eğrisini gösterir (sözleşme taramasında sözleşme eşikleri, şikâyet taramasında şikâyet eşikleri). 9. adımda iki eksenin en iyi eşikleri, Bölüm 1'deki gibi iki kart olarak yarışır | Hoca onayladı; ağaç sütunu daralmaz, iki bölüm aynı görsel dili konuşur |
| Ağaç, Lab'de eşik sürükleme | Yalnızca kök bölünmesinde (7–9. adımlar), iki eksende de. Bırakılan yerde bölgeler, yaprak sayıları ve Gini canlı değişir; alt dallar yeniden büyümez | Hoca onayladı; ikinci bir ağaç motoru gerekmez, her sayı scikit-learn ile doğrulanabilir kalır |
| Ağaç, 12 adımlık akış | Aşağıda, §Karar Ağacı → Adımlar | Hoca onayladı |
| NB, üç bölüm | 1.000 kişilik nokta tablosu → kelime kelime spam filtresi → kitabın GaussianNB örneği | Hocanın kararı (üçüncü bölüm hocanın isteğiyle eklendi) |
| NB, güncelleme düzeni | Kayan olasılık çubuğu, altında adım izi, değerleri yerine konmuş hesap şeridi (taslak A) | Hocanın seçimi |
| NB, 13 adımlık akış | Aşağıda, §Naive Bayes → Adımlar | Hoca onayladı |
| Ortak iskelet | k-NN'deki `mountConceptPage`, `StepPlayer`, mod, klavye ve adım terimi (`term`) aynen kullanılır | Mevcut altyapı |

## Kapsam dışı

- Üç algoritmayı aynı veride yan yana karşılaştıran sayfa (kitaptaki Şekil 5.3). Ayrı bir kavram olarak sonraya kalır.
- Karar ağacında regresyon ağaçları, çok sınıflı örnekler, post-pruning (`ccp_alpha`) animasyonu. Budama, derinlik sınırı üzerinden anlatılır; `ccp_alpha` yalnızca Lab metninde bir cümleyle anılır.
- Naive Bayes'te `BernoulliNB` ve `CategoricalNB`. Kitaptaki "Hata 1" (kategorik veride GaussianNB) yalnızca Lab metninde anılır.
- k-NN'den ertelenen iki madde: sürüklerken rozet sıçraması ve dar Ders penceresinde terim satırının kırılması.
- K-Means ve diğer bölümler.

## Kırmızı çizgiler

k-NN tasarımının §3'ü aynen geçerlidir. Bu iki sayfada özellikle:

- **Formül şeritleri ve kartlar, Ders'te gövde boyutundan (≥ 22 px) küçük yazılamaz.** Sığmazsa metin kısaltılır ya da adım ikiye bölünür, yazı küçültülmez.
- **1.000 kişilik tablo** 1280×720 Ders sahnesinde, her simge en az 12 px çapında olacak şekilde yerleşir. 60 fps'te yeniden renklenmelidir; binlerce SVG elemanı yerine Canvas önerilir.
- **Karar bölgeleri** (GaussianNB, ağacın dikdörtgenleri) k-NN'deki gibi Canvas'a raster çizilir.

## Karar Ağacı sayfası

**Kitap atfı:** Bölüm 5, "Karar ağaçları" alt başlığı.
**Ölçüt:** Gini (varsayılan) ya da entropi. Ölçüt bir parametredir ve sayfanın tamamına uygulanır. Kartlar, formül şeridi ve eğri seçili ölçüte göre hesaplanır. Entropi seçiliyken kazanç "bilgi kazancı (bit)" olarak, Gini seçiliyken "Gini azalması" olarak etiketlenir.

### Bölüm 1 verisi — tenis (Quinlan, 1986)

14 gün, dört kategorik öznitelik. Değerler Türkçeleştirilir. Hedef: **Oynanır mı?** (evet ● camgöbeği / hayır ▲ turuncu).

| Gün | Hava | Sıcaklık | Nem | Rüzgâr | Oyun |
|---|---|---|---|---|---|
| G1 | Güneşli | Sıcak | Yüksek | Zayıf | hayır |
| G2 | Güneşli | Sıcak | Yüksek | Güçlü | hayır |
| G3 | Bulutlu | Sıcak | Yüksek | Zayıf | evet |
| G4 | Yağmurlu | Ilık | Yüksek | Zayıf | evet |
| G5 | Yağmurlu | Serin | Normal | Zayıf | evet |
| G6 | Yağmurlu | Serin | Normal | Güçlü | hayır |
| G7 | Bulutlu | Serin | Normal | Güçlü | evet |
| G8 | Güneşli | Ilık | Yüksek | Zayıf | hayır |
| G9 | Güneşli | Serin | Normal | Zayıf | evet |
| G10 | Yağmurlu | Ilık | Normal | Zayıf | evet |
| G11 | Güneşli | Ilık | Normal | Güçlü | evet |
| G12 | Bulutlu | Ilık | Yüksek | Güçlü | evet |
| G13 | Bulutlu | Sıcak | Normal | Zayıf | evet |
| G14 | Yağmurlu | Ilık | Yüksek | Güçlü | hayır |

Kontrol değerleri (testlerde sabit):

- **Kök:** 9 evet / 5 hayır. Gini 0,459, entropi 0,940.
- **Aday dallarına göre evet/hayır sayıları:**
  - Hava: Güneşli 2/3, Bulutlu 4/0, Yağmurlu 3/2.
  - Sıcaklık: Sıcak 2/2, Ilık 4/2, Serin 3/1.
  - Nem: Yüksek 3/4, Normal 6/1.
  - Rüzgâr: Zayıf 6/2, Güçlü 3/3.
- **Ağırlıklı Gini ve Gini azalması:**

  | Aday | Ağırlıklı Gini | Gini azalması |
  |---|---|---|
  | Hava | 0,343 | 0,116 |
  | Nem | 0,367 | 0,092 |
  | Rüzgâr | 0,429 | 0,031 |
  | Sıcaklık | 0,440 | 0,019 |

- **Bilgi kazancı:** Hava 0,247, Nem 0,152, Rüzgâr 0,048, Sıcaklık 0,029.

Bölüm 1 çok yollu (kategori başına bir dal) bölünme kullanır, ID3'teki gibi. scikit-learn ikili bölünme yaptığı için bu bölümün sayıları scikit-learn'e değil, yukarıdaki elle hesaplanmış değerlere karşı test edilir. Lab metni bir cümleyle şunu belirtir: "scikit-learn (CART) her düğümü ikiye böler; burada kategorileri ayrı dallar olarak gösteriyoruz."

### Bölüm 2 verisi — churn, sayısal

Kitaptaki kural: "kısa sözleşme **ve** çok şikâyet → ayrılma riski" (final.md 103 ve 144–150).

- **Öznitelikler:** sözleşme süresi (1–59 ay) ve şikâyet sayısı (0–5).
- **Örneklem:** Sabit tohumla üretilen **24–30 eğitim müşterisi** ve **10–12 test müşterisi**. Etiket, kitabın kuralına az miktarda gürültü eklenerek üretilir; böylece birkaç "aykırı" nokta olur.
- **Görünüm:** Şikâyet sayısı tam sayı olduğu için noktalar dikeyde yalnızca görünümde hafifçe kaydırılır (jitter). Hesaplar kaydırılmamış değerlerle yapılır.
- **Seçim koşulları** (betik doğrular, testler sabitler):
  1. `DecisionTreeClassifier(criterion="gini", max_depth=2, random_state=0)` ile kurulan iki seviyeli ağaç, kitabın kuralını eşikleriyle birlikte bulmalı (yaklaşık "sözleşme < 12" ve "şikâyet ≥ 3").
  2. Derinlik sınırsızken eğitim doğruluğu %100 olmalı, test doğruluğu ise derinlik 2'deki değerinden belirgin biçimde düşük olmalı (aşırı öğrenme anı).
  3. Kök düğümün en iyi eşiği tek ve belirgin olmalı: eğrinin dibi, en yakın rakip eşikten en az 0,02 Gini daha düşük.
- **Eşik adayları:** CART'taki gibi, sıralı benzersiz değerlerin orta noktaları.
- **Eşitlik bozma:** İki öznitelikte eşit Gini çıkarsa veri sırasındaki ilk öznitelik seçilir. Seçim koşulları zaten bu durumun kökte oluşmamasını ister.

### Adımlar (hoca onayladı)

**Tenis verisi**

1. **Tablo.** 14 gün ve hedef soru "Bugün oynanır mı?". Kartlar henüz boş.
2. **Kökün karışıklığı.** 9 evet / 5 hayır çubuğu, Gini = 1 − (9/14)² − (5/14)² = 0,459.
3. **Hava adayı.** Kartın çubukları dolar. Formül şeridinde her dalın Gini değeri ve ağırlıklı ortalama, değerleri yerine konmuş olarak görünür.
4. **Diğer üç aday.** Sıcaklık, Nem ve Rüzgâr kartları sırayla ve hızla dolar. Şerit en son hesaplanan adayı gösterir.
5. **Kazanan: Hava.** En büyük Gini azalmasının kartı vurgulanır. "Bulutlu" dalı saf bir yaprak olarak işaretlenir.
6. **Entropiyle de Hava.** Ölçüt entropiye geçer, kartlar bilgi kazancını gösterir. Kazanan yine Hava (0,247 bit). Mesaj: iki ölçüt çoğu zaman aynı soruyu seçer.

**Sayısal veri**

7. **Dağılım.** Sözleşme süresi × şikâyet sayısı. Ağaç sütununda yalnızca kök düğüm vardır.
8. **Eşik taraması.** Dikey eşik çizgisi sözleşme ekseninde soldan sağa kayar ve altındaki panelde Gini eğrisi çizilir. Ardından aynı tarama şikâyet ekseninde yatay çizgiyle yapılır; alttaki panel şikâyet eşiklerinin eğrisine geçer. Sözleşme eğrisinin en düşük değeri panelin köşesinde küçük bir not olarak kalır.
9. **En iyi eşik.** İki eksenin en iyi eşikleri, Bölüm 1'deki kart görünümüyle iki aday olarak yarışır (ör. "sözleşme < 12" ve "şikâyet ≥ 3", her biri dal sayıları ve ağırlıklı Gini ile). Kazanan kartın çizgisi grafiğe yerleşir, grafik iki bölgeye ayrılır, ağaçta kökün sorusu ve iki yaprak belirir.
10. **Alt dallarda tekrar.** Alt dallardaki arama aynı şekilde hızla oynar. Derinlik 2'de ağaç, kitabın kuralını kendisi bulmuş olur. Terim: "etkileşim (interaction)".
11. **Daha derin = ezber.** Derinlik 2'den sınırsıza animasyonla artar. Grafik küçük dikdörtgenlere bölünür, eğitim doğruluğu %100'e çıkar. Test noktaları (içi boş işaretler) belirir ve test doğruluğu düşer. Terimler: "aşırı öğrenme (overfitting)" ve "budama (pruning)".
12. **Kitabın örneği.** 100 müşteri, 40 ayrılan ve 60 kalan. Dallar 35/15 ve 5/45. Gini 0,480'den 0,300'e, entropi 0,971'den 0,675'e iner. Bilgi kazancı 0,296 bittir. Bu adım Bölüm 1'deki kart görünümüyle tek bir aday olarak gösterilir.

Adım başlıklarının ve metinlerin son hâli builder'ın işidir. Akış ve her adımın göstermesi gereken an bağlayıcıdır. Her adıma Ders'te görünen bir `term` verilir.

### Parametreler

| Parametre | Değerler | Varsayılan |
|---|---|---|
| Ölçüt | Gini / Entropi | Gini |
| En fazla derinlik (Bölüm 2) | 1–6 ve "sınırsız" (kaydırıcı) | Adıma bağlı |
| Test noktaları (Bölüm 2) | Göster / Gizle | 11. adımdan itibaren açık |

Adımlar kendi parametrelerini k-NN'deki gibi sahiplenir. Elle verilen değer, adım değişene kadar geçerli kalır.

### Lab modu

- Açıklama panelinde, Bölüm 1 boyunca 14 günlük tablo görünür. Seçili adaya göre satırlar dal renkleriyle işaretlenir.
- **Bölüm 2'de eşik çizgisi sürüklenebilir (hoca onayladı).**
  - Yalnızca kök bölünmesinde, 7–9. adımlarda, iki eksende de: sözleşme için dikey, şikâyet için yatay çizgi. Öğrenci hangi ekseni sürükleyeceğini çizgiyi tutarak seçer.
  - Sürüklerken ve bırakınca grafiğin iki bölgesi, yaprak sayıları, ağırlıklı Gini ve eğri üzerindeki nokta canlı değişir. Ağacın kendi seçtiği eşik soluk bir çizgi ve eğride bir işaretle görünür kalır; öğrenci kendi seçiminin ne kadar kötü olduğunu karşılaştırır.
  - Alt dallar öğrencinin seçimine göre yeniden büyümez. 10. adım ve sonrasında sürükleme kapalıdır.
- Derinlik kaydırıcısıyla ağaç ve bölgeler canlı güncellenir. Eğitim ve test doğrulukları yan yana yazar.

### Kısayollar

`G`: ölçüt (Gini/Entropi). `+` / `-`: derinlik. `T`: test noktaları. Hepsi `?` yardımında listelenir. Yerleşik tuşlarla (`P`, `F`, `?`, oklar, Boşluk, Home/End) çakışamaz.

## Naive Bayes sayfası

**Kitap atfı:** Bölüm 5, "Naive Bayes" alt başlığı.
**Terimler (kitapla uyumlu):** öncül olasılık (prior), olabilirlik (likelihood), sonsal olasılık (posterior), koşullu bağımsızlık (conditional independence), Laplace düzeltmesi (Laplace smoothing).

### Bölüm 1 — 1.000 kişi (doğal sıklıklar)

- 1.000 kişilik simge tablosu.
- **Varsayılan senaryo:** Hastalığın görülme oranı (öncül) %1 → 10 hasta. Duyarlılık %90 → 9 doğru pozitif. Yanlış pozitif oranı %10 → 990 sağlıklıdan 99'u pozitif çıkar.
- **Sonsal:** 9 / (9 + 99) = 9/108 ≈ **%8,3**.
- **Öncül %10 iken:** 100 hasta, 90 doğru pozitif. 900 sağlıklıdan 90'ı pozitif çıkar. Sonsal 90/180 = **%50**.
- **Simge renkleri:**
  - hasta ve pozitif: turuncu ▲,
  - hasta ama negatif: soluk turuncu,
  - sağlıklı ama pozitif: lacivert,
  - sağlıklı ve negatif: gri.
- Renkler şekil ya da desenle de ayrışmalıdır, k-NN tasarımındaki renk + şekil kuralı gereği. Simge şeklini builder seçer.
- **Kesirli kişi olmaz (tasarımcının kararı).**
  - Kaydırıcılar değiştiğinde sayımlar tam kişiye yuvarlanır: hasta = round(1000 · öncül), doğru pozitif = round(hasta · duyarlılık), yanlış pozitif = round(sağlıklı · yanlış pozitif oranı).
  - Simgeler, hesap şeridi ve sonsal **aynı yuvarlanmış sayılarla** hesaplanır. Öğretmenin saydığı simgeler ile ekrandaki oran her zaman birebir tutar.
  - Kesin Bayes değeri, fark 0,1 puandan büyükse Lab metninde ayrıca yazar ("kesin değer: …").
  - Kaydırıcı adımları: öncül %0,1, diğer ikisi %1.

### Bölüm 2 — kelime kelime spam filtresi

- **Eğitim kümesi:** Küçük bir kurgu e-posta kümesi; spam oranı %40 (öncül). Sözlük 6–10 kelime.
- **Model:** `MultinomialNB` mantığı: P(kelime | sınıf) = (sayım + α) / (sınıf toplamı + α·V).
  - Bölüm 2'nin ilk adımları α = 0 ile ham oranları gösterir.
  - α = 1 (Laplace) 10. adımda devreye girer.
- **E-postanın hikâyesi bağlayıcıdır:**
  1. İlk kelime ("bedava") olasılığı belirgin biçimde yükseltir (%40'tan %85'in üstüne).
  2. İkinci kelime ("kazandınız") daha da yükseltir (%95'in üstü).
  3. Üçüncü kelime ("toplantı") olasılığı biraz düşürür, ama sonuç spam olarak kalır.
  4. Eğitimde spam sınıfında hiç görülmemiş bir kelime, α = 0 iken spam olasılığını sıfırlar. α = 1 ile hikâye yeniden anlamlı hâle gelir.
- Taslaktaki çarpanlar (×15, ×20, ×0,13) temsilîdir. Kesin sayımları builder, hikâyeyi sağlayacak şekilde seçer; testler hikâyenin her adımını sabitler.

### Bölüm 3 — kitabın GaussianNB örneği

- **Veri:** Kitaptaki kod aynen kullanılır (final.md 708–744): `np.random.seed(23)`, 220 müşteri, churn = (sözleşme < 15) VEYA (şikâyet ≥ 3), `train_test_split(test_size=0.3, random_state=23)`.
- **Kitapla aynı sayılar:** Öncüller 0,383 (kalan) ve 0,617 (ayrılan). İlk test müşterisinin sonsalı 0,815 / 0,185.
- **Sahne:** Eğitim noktaları sözleşme süresi × şikâyet sayısı dağılımında gösterilir; şikâyet ekseninde görünümde hafif jitter vardır. Eksen kenarlarında her sınıf için her öznitelikte bir çan eğrisi (Gauss) çizilir.
- **Eğitim kümesi:** 154 müşteri (220'nin %70'i).
- **Yeni müşteri:** Kitabın ilk test örneğidir: 18 ay sözleşme, 1 şikâyet. Lab modunda sürüklenebilir.

### Adımlar (hoca onayladı)

**1.000 kişi**

1. **Öncül.** 1.000 kişi, 10'u hasta renginde. Hesap şeridi: P(hasta) = 10/1000.
2. **Test (olabilirlik).** Hastaların 9'u ve sağlıklıların 99'u "pozitif" olarak işaretlenir.
3. **Sonsal.** Negatifler soluklaşır, yalnızca 108 pozitif kalır: 9/108 ≈ %8. Ardından Bayes formülü aynı sayılarla gösterilir.
4. **Öncülün ağırlığı.** Öncül %10'a çıkar, tablo yeniden renklenir, sonsal %50 olur.

**Spam**

5. **Öncül çubuğu.** %40 spam. Lab'de kelime olasılık tablosu görünür.
6. **"bedava".** Çubuk kayar, iz başlar. Hesap şeridi: öncül × olabilirlik, sonra normalize.
7. **"kazandınız".** Hesap şeridinde önceki sonsal "yeni öncül" olarak yazar. Bu adım, hocanın hedeflediği andır.
8. **"toplantı".** Çubuk biraz geri gelir. Mesaj: kanıt ters yönde de iter.
9. **Sıra fark etmez.** Kelimeler başka sırayla oynatılır, iz farklı yoldan aynı noktaya varır. Mesaj: olasılıklar çarpılır; bu, koşullu bağımsızlık varsayımıdır ("naive").
10. **Görülmemiş kelime.** α = 0 iken spam olasılığı sıfıra düşer. α = 1 (Laplace) ile çubuk geri gelir.

**GaussianNB**

11. **Dağılım ve çan eğrileri.** Eğitim noktaları belirir, eksen kenarlarında sınıf başına çan eğrileri çizilir.
12. **Yeni müşteri.** Müşterinin iki öznitelikteki eğri yükseklikleri işaretlenir. Bu yükseklikler öncülle çarpılır ve bir oran çubuğuna dönüşür: 0,815 / 0,185.
13. **Karar sınırı.** Bölgeler boyanır. Mesaj: Naive Bayes de bir karar sınırı çizer, ama bunu olasılıklardan çıkarır.

Bölüm 2 ve Bölüm 3'teki olasılık çubukları aynı bileşendir. 2. bölümdeki iz (adım başına bir nokta) yalnızca kelime adımlarında görünür.

### Parametreler

| Parametre | Değerler | Varsayılan |
|---|---|---|
| Öncül (Bölüm 1) | %0,1–%50 (kaydırıcı) | %1 |
| Duyarlılık (Bölüm 1) | %50–%99 | %90 |
| Yanlış pozitif oranı (Bölüm 1) | %1–%50 | %10 |
| E-postadaki kelimeler (Bölüm 2) | Sözlükten aç/kapat düğmeleri | Adıma bağlı |
| Laplace α (Bölüm 2) | 0 / 1 | Adıma bağlı |
| Karar bölgeleri (Bölüm 3) | Göster / Gizle | 13. adımda açık |

### Lab modu

- Bölüm 1'deki üç kaydırıcı tabloyu ve sonsalı canlı günceller.
- Bölüm 2'de öğrenci e-postaya kelimeleri kendisi ekleyip çıkarır. Çubuk ve iz canlı güncellenir.
- Bölüm 3'te yeni müşteri sürüklenebilir. Eğri yükseklikleri ve sonsal çubuğu canlı güncellenir.
- Lab metninde kitaptaki "Hata 2" anılır: Naive Bayes olasılıkları, bağımsızlık varsayımı ihlal edildiğinde 0'a ya da 1'e aşırı yakın çıkar; bunlar risk sıralaması olarak okunmalıdır.

### Kısayollar

`L`: Laplace α. `B`: karar bölgeleri. `+` / `-`: Bölüm 1'de öncül. Hepsi `?` yardımında listelenir. Çakışma kuralı karar ağacındakiyle aynıdır.

## Ortak çekirdek ve araçlar

Hocanın kabul ettiği öneriler doğrultusunda bu iş şunları da içerir:

1. **Ortak 2B grafik çekirdeği.** k-NN'deki eksen ve yerleşim (`scene-layout.ts`), nokta şekilleri (`scene-shapes.ts`) ve Canvas bölge çizimi (`scene-regions.ts`), kavramdan bağımsız kısımlarıyla `src/core/` altına taşınır. Karar ağacının Bölüm 2'si ve Naive Bayes'in Bölüm 3'ü bu çekirdeği kullanır.
   - Sınırları builder belirler.
   - k-NN davranışı değişmez ve testleri geçmeye devam eder (kabul ölçütü 7).
2. **Kavram iskeleti betiği.** `npm run yeni-kavram <id>` şunları oluşturur:
   - `<id>/index.html`,
   - `src/concepts/<id>/` altında `main.ts` ve `scenario.ts` iskeleti,
   - birim ve e2e test iskeletleri,
   - `vite.config.ts` girdisi.
   `registry.ts` kaydını elle `hazir`a çevirmek, README'deki "Yeni kavram ekleme" adımlarıyla birlikte kalır. İki yeni sayfa bu betikle başlatılır.
3. **e2e bölünmesi.** Playwright yapılandırması iki projeye ayrılır:
   - **performans:** tek işçi, şu anki performans testleri ve yenileri;
   - **işlevsel:** paralel.
   `npm run check` ikisini de koşar.
4. **Ekran görüntüsü testleri.** Her sayfa için Ders ve Lab görünümlerinde, 1280×720'de, birkaç anahtar adımın `toHaveScreenshot` karşılaştırması yapılır. Testler hep aynı makinede yerel olarak koşar.

## Arayüzler

- **Kayıt:** `src/concepts/registry.ts` içinde `karar-agaci` ve `naive-bayes` kayıtları `hazir` yapılır, `href` değerleri `karar-agaci/` ve `naive-bayes/` olur.
- **Sayfa sözleşmesi:** Her sayfa `ConceptPage<P>` arayüzünü uygular (`src/core/shell.ts`). Adımlar `Step` türündedir: `{id, title, text, term?, params?, sweep?}`.
- **Veri betikleri:** `scripts/make_tree_data.py` ve `scripts/make_nb_data.py`, `make_knn_data.py` kalıbında yazılır.
  - Çıktılar: `src/concepts/<id>/data/*.json` ve `tests/fixtures/<id>_sklearn.json`.
  - Betikler deterministiktir: iki çalıştırma bayt bayt aynı dosyaları üretir.
  - Tenis tablosu ve 1.000 kişi senaryosu sabit veridir. Betik, bunların kontrol değerlerini de fikstüre yazar.

## Hata durumları

- **Sığmayan metin:** Formül şeridi Ders'te tek satıra sığmazsa iki satıra kırılır. Yine sığmazsa adım ikiye bölünür. Yazı boyutu düşürülmez.
- **Lab'de tüm kelimeler kapalı:** Spam çubuğu öncülde kalır. Hesap şeridi "Henüz kelime yok: sonsal = öncül" yazar.
- **α = 0 iken iki sınıfta da sıfır:** İki sınıfın olasılığı da sıfırsa çubuk %50'de gri durur ve şerit "İki sınıf da sıfır: karar verilemiyor" yazar. NaN gösterilmez.
- **Derinlik sınırsızken ağaç ekrana sığmıyor:** Ağaç sütunu, düğümler okunabilir boyutta kalacak şekilde kaydırılabilir olur. Düğüm metni ≥ 18 px kalır.
- **Lab'de eşik çizgisi grafiğin dışına sürüklenmek istenirse:** Çizgi verinin uç değerlerinde durur.
- **Lab'de eşik, tüm noktaları bir tarafa bırakırsa:** Boş dal "0 müşteri" olarak gösterilir, ağırlıklı Gini ebeveyninkine eşit olur. Hata ya da NaN gösterilmez.

## Doğrulama

- **Birim testleri:**
  - Gini, entropi ve kazanç hesapları tenis kontrol değerlerini veriyor.
  - Eşik taraması ve ağaç kurma, fikstürdeki `DecisionTreeClassifier` eşiklerini ve yapraklarını veriyor.
  - Derinlik ve doğruluk koşulları sağlanıyor.
  - `MultinomialNB` sonsalları (α = 0 ve α = 1) fikstürle aynı, e-posta hikâyesinin her adımı doğru.
  - `GaussianNB` öncülleri ve ilk test sonsalı kitapla aynı (0,383/0,617 ve 0,815/0,185).
  - 1.000 kişi sayıları (9, 99, 9/108; 90, 90, %50) doğru.
  - Senaryolar: adım sayıları, kimlikler, terimler, ve Ders terimlerinin metindeki İngilizce terimlerle uyumu (k-NN'deki kural).
- **e2e (işlevsel):**
  - Ana sayfadan iki karta tıklanınca sayfalar açılıyor.
  - Ders'te klavyeyle her adıma gidilebiliyor.
  - Her adımda §3 yazı boyutları sağlanıyor.
  - Parametre paneli açıkken sahnede hiçbir şey örtülmüyor.
- **e2e (performans):** p95 bütçeleri, k-NN'dekilerle aynı ölçüm yöntemiyle:
  - eşik sürükleme,
  - derinlik kaydırıcısı,
  - 1.000 kişi yeniden renklenmesi,
  - GaussianNB'de müşteri sürükleme.
- **Ekran görüntüleri:** İki sayfanın anahtar adımları, Ders ve Lab modunda.
- **Kapı:** `npm run check` sıfır koduyla çıkmalı.

## Builder'a bırakılanlar

- Dosya ve bileşen sınırları, ortak çekirdeğin API'si.
- Animasyon süreleri ve easing.
- Adım başlıklarının ve metinlerinin son hâli (akış ve gösterilecek anlar bağlayıcı).
- Bölüm 2 (ağaç) müşteri örneğinin üretim kuralı ve gürültü oranı (seçim koşullarını sağlamak şartıyla).
- Spam kurgu kümesinin kelimeleri ve sayımları (hikâyeyi sağlamak şartıyla).
- Simge ve düğüm biçimleri, ağacın çizim düzeni.
- Performans bütçelerinin kesin değerleri (k-NN'dekilerden gevşek olamaz).

## Tasarımcının kararları (hoca onaylamadı, kontrol için listelendi)

- **Ölçüt:** Gini/Entropi geçişi sayfa genelinde. Varsayılan Gini, çünkü kitap ve scikit-learn varsayılanı Gini.
- **Bölüm 1 bölünmesi:** Tenis örneğinde çok yollu bölünme (ID3 tarzı). scikit-learn'ün ikili bölünmesi Lab metninde bir cümleyle anılır.
- **Bölüm 2 verisi:** Kitabın "kısa sözleşme ve çok şikâyet" kuralından sentetik veri. Aşırı öğrenme anı için ayrı test noktaları kullanılır.
- **1.000 kişi senaryosu:** Öncül %1, duyarlılık %90, yanlış pozitif oranı %10, ikinci durumda öncül %10.
- **Spam modeli:** `MultinomialNB` formülü. Ham oranlar (α = 0) önce, Laplace (α = 1) sonra.
- **Bölüm 3:** Kitabın kodu ve tohumu aynen kullanılır, sayılar kitapla birebir aynıdır.
- **Kısayol harfleri:** Ağaçta `G`, `+`/`-`, `T`; Naive Bayes'te `L`, `B`, `+`/`-`.
- **Ortak çekirdek ve araçlar:** Önceki konuşmada kabul edilen öneriler (iskelet betiği, e2e bölünmesi, ekran görüntüsü testleri) bu işe dahil edildi.
