# Bölüm 8 — Birliktelik kuralları: destek, güven, kaldıraç; Apriori ve FP-Growth — Tasarım

- **Tarih:** 2026-10-22
- **Kaynak:** Öğretmen: "sorulara girmeden başla yönetim sende. push için de onay bekleme işlem
  sonunda merge + push". Kitabın `ch08_birliktelik_kurallari/content/final.md` bölümü (salt okunur).
- **Yetki:** Bütün tasarım kararları benimdir (aşağıda "Benim kararım"); öğretmen soru
  sorulmamasını istedi. Kararlar ledger'da `Ruling:` satırı olarak da durur ve iş sonunda
  öğretmene listelenir.
- **Önceki tasarımlar:** Bölüm 7 tasarımları (`2026-10-21-bolum7-kmeans-design.md`,
  `2026-10-22-bolum7-dbscan-dendrogram-design.md`); ortak görünüm kuralları oradan devralınır.

## Amaç ve kabul ölçütleri

Öğrenci iki şeyi kavramalı:

1. **Bir kural ne kadar iyi?** Destek "ne kadar yaygın", güven "X alanların ne kadarı Y de
   alıyor", kaldıraç "bu oran Y'nin zaten herkesteki oranından büyük mü". Merkezdeki an:
   ekmek → süt kuralının %63,6'lık güveni göz alıcıdır ama süt zaten fişlerin %66,7'sinde var;
   kaldıraç 0,955 < 1, yani kural hiçbir şey söylemez. ("Yüksek güven tuzağı", kitabın üç
   kez vurguladığı hata.)
2. **Sık öğe kümeleri nasıl bulunur?** Apriori seviye seviye aday üretir; sık olmayan bir
   kümenin üst kümeleri sayılmadan budanır (aşağı doğru kapanış). FP-Growth veriyi bir ağaca
   sıkıştırıp aday üretmeden aynı kümeleri bulur.

Kabul ölçütleri:

1. İki yeni sayfa yayında: `birliktelik-olculeri/` ("Destek, güven ve kaldıraç", 10 adım) ve
   `apriori/` ("Apriori ve FP-Growth", 11 adım); ikisi de Ders ve Laboratuvar modunda çalışır.
   Ana sayfada Bölüm 8'in iki kartı "hazır" olur: 24 kavram, 19 hazır, 5 yakında.
2. Ekrandaki her sayı (destek, güven, kaldıraç, sayımlar, sık küme sayıları, kural sayısı,
   FP-ağacı düğüm sayaçları) tarayıcıda hesaplanır ve birim testinde mlxtend çıktısıyla
   (üreticinin yazdığı fixture) birebir doğrulanır.
3. Her oran payı ve paydasıyla da yazılır ("7 / 11 = 0,636"); öğrenci kitabın "en az bir kuralı
   elle doğrula" hedefini sayfada yapabilir.
4. 1280×720'de Ders ve Lab adımlarında yazı yazının üstüne binmez, hiçbir şey kırpılmaz;
   900 px altında tek sütun, 390 px'te yatay taşma yok (mevcut `dar-ekran.spec.ts` kayıt
   defterindeki hazır sayfaları otomatik kapsar).
5. `npm run check` yeşil; kontrolcü ekran görüntülerine kendisi bakar.

## Kararlar

| Konu | Karar | Kimin |
|---|---|---|
| Sayfa sayısı | İki sayfa: ölçütler + algoritmalar (Bölüm 7'nin iki sayfa kalıbı) | Benim kararım |
| Kimlikler | `birliktelik-olculeri` (yeni) ve `apriori` (kayıttaki `soon('apriori')` kaydı hazır olur) | Benim kararım |
| Veri | Kitabın 18 fişlik, 6 ürünlü sentetik sepeti, değiştirilmeden | Benim kararım: kitapla birebir, elle doğrulanabilir |
| Hesap | Tarayıcıda (6 ürün, 63 öğe kümesi: anlık); mlxtend fixture'ına karşı birim testi | Benim kararım: Lab'de sepet ve eşikler değişir |
| Ders eşiği (Apriori) | min_support = 0,2 (en az 4 fiş) | Benim kararım: 0,3'te 3. seviye hiç aday üretmez; 0,2'de hem "sayılıp elenen" hem "sayılmadan budanan" aday görünür, kitabın kural üretimi de 0,2 kullanır |
| Kural eşikleri | min_support 0,2, min güven 0,5, kaldıraç > 1,1 (kitabın Blok 6'sı) | Kitap |
| "Kaldıraç" terimi | Kitaptaki gibi kaldıraç = lift; ilk geçtiği yerde "kaldıraç (lift)" yazılır | Kitap; mlxtend `leverage` farklı bir ölçüttür (bkz. Kitapla farklar) |
| Ürün adları | Ekranda Türkçe karakterli: Ekmek, Süt, Yumurta, Tereyağı, Peynir, Reçel; kısaltma harfleri E, S, Y, T, P, R | Benim kararım |
| Görünüm | Bölüm 7 sayfalarının yerleşimi ve dili | Benim kararım |

## Kapsam dışı

- Eclat, conviction, leverage, zhang ölçütleri (conviction ve leverage yalnızca Lab'deki bir
  bilgi cümlesinde adıyla anılır).
- Sıralı örüntü madenciliği, çok düzeyli kurallar, büyük veri performans ölçümü (kitabın süre
  karşılaştırması sayfada bir cümle ve kitabın ölçtüğü sayılarla anılır, tarayıcıda ölçülmez).
- Kitabın "Kavramdan karara" bölümündeki varsayımsal 10 fişlik örnek.
- Kitabın düzeltilmesi (çıktı yalnızca "Kitapla farklar" listesidir).

## Ortak öğretim dili ve görünüm

Bölüm 7 kuralları aynen: metin boyutları yalnız `--fs-*` belirteçlerinden; SVG'lerde viewBox
yok; sayılar Türkçe ondalık virgülüyle (oranlar 3 ondalık, yüzdeler 1 ondalık); tanımsız değer
`— (tanımsız)` (ör. hiç X içermeyen sepette güven); tarama bitince taranan değer son değerinde
kalır; `prefers-reduced-motion` altında son durum anında çizilir; adım kartı Lab'de
`labText` gösterir (Lab'in değiştirdiği sayıları içermez).

- Sahneler `src/core/plot/` parçalarını kullanır (eksenler, biçimlendirme, geçişler, etiket
  yerleştirici). İki sayfanın ortak verisi ve hesabı `src/concepts/birliktelik/` altında durur
  (Bölüm 6'daki `degerlendirme/` kalıbı).
- Renkler: X (öncül) lacivert, Y (sonuç) turuncu, ikisi birden mor/koyu; sık = dolu, sık değil =
  içi boş ve üstü çizili, sayılmadan budanmış = taralı gri. Renk tek taşıyıcı değildir: durumlar
  ayrıca simge/çizgi biçimiyle ve metinle verilir.

## Ortak veri ve hesap (`src/concepts/birliktelik/`)

- `data/sepet.json` (yalnız üretici yazar): 18 fiş (kitabın sırası), ürün sırası, ürünlerin
  ekran adları, fixture:
  - her min_support ∈ {1/18, 2/18, …, 18/18} için mlxtend `apriori` sık öğe kümeleri (küme →
    destek) ve `fpgrowth` sonucunun aynı olduğu;
  - min_support 0,2 / güven 0,5 için `association_rules` çıktısı (öncül, sonuç, destek, güven,
    kaldıraç = lift);
  - ek ızgara: min_support ∈ {0,10; 0,15; 0,20; 0,30} × min güven ∈ {0,3; 0,5; 0,7} kural sayıları.
- Saf TS fonksiyonları (hepsi fiş listesi alır; Lab'de düzenlenmiş sepetle de çalışır):
  - `support(itemset)`, `count(itemset)`, `confidence(X, Y)`, `lift(X, Y)`; payda 0 ise `null`.
  - `aprioriTrace(transactions, minCount)`: seviye seviye her aday için durum
    (`frequent` | `infrequent` (sayıldı, eşiğin altında) | `pruned` (bir alt kümesi sık değil,
    sayılmadı)), sayım, hangi alt küme yüzünden budandığı; toplam sayılan aday sayısı.
    Aday üretimi klasik birleştirme (join: ilk k−1 öğesi aynı iki sık k−1 kümesi) + budama.
    Sonuç kümesi mlxtend ile birebir.
  - `fpTree(transactions, minCount)`: öğe sıklık sırası (eşit sıklıkta ürün sırasına göre),
    her fişin sıralanmış ve süzülmüş hâli, fişler tek tek eklenirken ağacın her ara hâli
    (düğüm: öğe, sayaç, çocuklar), başlık tablosu; `conditionalBase(item)` (önek yolları ve
    sayaçları) ve `fpGrowth` sonucu (sık kümeler = Apriori ile aynı).
  - `rules(transactions, minSupport, minConfidence)`: mlxtend `association_rules` ile aynı
    kural kümesi ve ölçütler.
- Birim testleri: her min_support için `aprioriTrace` ve `fpGrowth` sık kümeleri = fixture;
  `rules` = fixture (0,2 / 0,5 tam liste; ızgara sayıları); kitabın sayıları (ekmek 11/18,
  süt 12/18, {ekmek, süt} 7/18, güven 0,636 ve 0,583, kaldıraç 0,955; 0,5 / 0,3 / 0,15 → 4 / 7 /
  16 küme; 13 kural) fixture'dan okunarak.
- Üretici: `scripts/make_birliktelik_data.py` (`--check` ile kayma denetimi; diğer üreticilerin
  kalıbı). `scripts/requirements.txt`'e `mlxtend` eklenir. Üretici kitabın sayılarını
  doğrular (yukarıdaki liste); tutmazsa durur ve raporlar.

## Sayfa 1 — Destek, güven ve kaldıraç (`birliktelik-olculeri/`)

### Öğrenme sonucu

Öğrenci destek, güven ve kaldıracı fişleri sayarak hesaplar; güvenin yönlü olduğunu
(ekmek → süt ≠ süt → ekmek) ve kaldıracın simetrik olduğunu; güvenin Y'nin genel oranıyla
kıyaslanmadan yanıltıcı olduğunu; kaldıracın 1'den büyük / 1 / küçük olmasının anlamını;
`association_rules` + kaldıraç süzgecinin hangi kuralları bıraktığını görür.

### Görünüm

Solda **fiş tablosu**: 18 satır (Fiş 1–18) × 6 ürün sütunu (one-hot; dolu hücre = ürün sepette).
X içeren satırlar lacivert şeritle, Y içerenler turuncu işaretle, ikisini birden içerenler
vurguyla belirir; sütun altlarında ürün sayıları. Sağda **okuma paneli**: kural "X → Y",
sayımlar ve üç ölçüt; ölçütler formül şeridiyle ("destek = 7 / 18 = 0,389"). Güven adımlarında
panelde **güven çubuğu**: X'li fişlerde Y oranı (çubuk) ve Y'nin genel oranı (kesikli dikey
çizgi, "taban oran"); kaldıraç = çubuk / çizgi.

### Adımlar (Ders)

1. **Fişler.** 18 kasa fişi, her biri bir sepet (liste görünümü: "Fiş 4: Ekmek, Süt, Tereyağı,
   Yumurta"). "Her satır bir müşterinin tek alışverişi."
2. **İşlem–öğe tablosu.** Liste one-hot tabloya dönüşür (TransactionEncoder); 18 × 6. Altında
   kitabın satırı: `TransactionEncoder().fit(...).transform(...)`.
3. **Destek: tek ürün.** Ekmek sütunu vurgulanır, 11 dolu hücre sayılır (sayaç animasyonu):
   destek(Ekmek) = 11 / 18 = 0,611. Bütün ürünlerin destek çubukları tablonun altında.
4. **Destek: ürün çifti.** {Ekmek, Süt}: iki ürünü birden içeren 7 fiş → 7 / 18 = 0,389.
5. **Güven: Ekmek → Süt.** Yalnız Ekmek'li 11 fiş öne çıkar (diğerleri soluk); bunların 7'sinde
   Süt var → güven = 7 / 11 = 0,636. "Ekmek alanların %63,6'sı süt de almış."
6. **Güven yönlüdür.** Süt → Ekmek: Süt'lü 12 fişin 7'si → 7 / 12 = 0,583. Destek aynı, güven
   farklı; payda değişti.
7. **Yüksek güven tuzağı.** Güven çubuğu 0,636; Süt'ün genel oranı 12 / 18 = 0,667 (taban
   çizgi). Kaldıraç = 0,636 / 0,667 = 0,955 < 1: ekmek alan biri süt almaya *daha az* yatkın.
   "Kaldıraç 1 ≈ bağımsız; kural bir şey söylemiyor."
8. **Gerçek bir birliktelik.** Yumurta → Süt: güven 9 / 10 = 0,900, taban 0,667, kaldıraç 1,350.
   Kaldıraç simetriktir: Süt → Yumurta da 1,350 (güveni 0,750 olsa da).
9. **Bütün kurallar.** min_support 0,2 ve min güven 0,5 ile 13 kural (`association_rules`):
   destek (x) – güven (y) saçılımı, nokta rengi/boyu kaldıraç; kaldıraç = 1 sınırının iki
   yanı farklı biçimde. Ekmek → Süt noktası işaretli.
10. **Kaldıraçla süz.** `lift > 1.1` süzgeci: 9 kural kalır, 4 kural (kaldıraç ≤ 1,1) soluklaşır;
    en üstte {Yumurta, Ekmek} → Süt (güven 1,000, kaldıraç 1,500). Altında kitabın satırları:
    `association_rules(..., metric="confidence", min_threshold=0.5)` ve
    `kurallar[kurallar["lift"] > 1.1]`. Bir cümle: "Kaldıraç birlikteliği ölçer, nedenselliği
    değil."

(Sayılar üreticiden okunur; yukarıdakiler kitabın ve mlxtend ön denemesinin değerleridir —
13 kuralın 9'u kaldıraç > 1,1, bunu üretici doğrular.)

### Laboratuvar

- **Kural seçici:** X (öncül) ve Y (sonuç) için ürün çipleri (çoklu seçim; X ∩ Y boş olmalı,
  çakışan çip devre dışı). Panel üç ölçütü, payları ve paydaları canlı yazar.
- **Sepeti düzenle:** tablo hücresine tıklamak (ve klavyeyle hücre gezinme + Boşluk) o fişte
  ürünü ekler/çıkarır; bütün sayılar, çubuklar ve kural saçılımı anında güncellenir. "Sıfırla"
  düğmesi kitabın sepetine döner.
- **Eşikler (adım 9–10):** min_support, min güven, min kaldıraç kaydırıcıları; kural sayısı ve
  saçılım güncellenir; bir kural noktasına tıklamak onu X → Y seçimine getirir.
- Adıma göre yalnızca o adımın kontrolleri görünür: 1–2 sepet düzenleme; 3–4 X seçici +
  sepet; 5–8 X ve Y seçici + sepet; 9–10 eşikler + sepet.

## Sayfa 2 — Apriori ve FP-Growth (`apriori/`)

### Öğrenme sonucu

Öğrenci 6 ürünün 63 öğe kümesi verdiğini (kaba kuvvet); Apriori'nin seviye seviye aday
ürettiğini, bir adayın iki yolla elendiğini (sayılıp eşiğin altında kalmak / bir alt kümesi sık
olmadığı için hiç sayılmamak) ve kaç sayımdan kurtulduğunu; min_support'un sık küme sayısını nasıl
değiştirdiğini; FP-Growth'un fişleri sıklık sırasına dizip ortak önekleri paylaşan bir ağaca
sıkıştırdığını ve aynı kümeleri aday üretmeden bulduğunu görür.

### Görünüm

**Öğe kümesi kafesi** (lattice): 6 satır (seviye 1–6; 6, 15, 20, 15, 6, 1 düğüm). Düğüm = harf
kısaltması (E, S, Y, T, P, R; ör. "ES") ve sayıldıysa sayım ("7"). Durumlar: henüz bakılmadı
(soluk), aday — sayılıyor (vurgulu çerçeve), sık (dolu), sık değil (içi boş + üstü çizili),
budandı (taralı gri, sayım yok). Kafesin üstünde eşik okuması ("min_support 0,2 → en az 4 fiş")
ve sayaçlar ("sayılan aday: N / 63", "sık küme: M"). Harf açıklaması kafesin yanında.
FP-Growth adımlarında kafesin yerinde **FP-ağacı**: kök "∅", düğümler "Süt:12" biçiminde; solda
başlık tablosu (ürün, toplam sayı); eklenen fişin yolu vurgulu.

### Adımlar (Ders, min_support = 0,2 → en az 4 fiş)

1. **Arama uzayı.** 6 ürün → 2⁶ − 1 = 63 öğe kümesi; kafes soluk. "Kaba kuvvet hepsini sayar."
2. **Seviye 1: tek ürünler sayılır.** 6 aday sayılır (tarama): Reçel 3 < 4 → sık değil; diğer
   5'i sık.
3. **Apriori özelliği.** Reçel'i içeren bütün üst kümeler (31 düğüm) budanır, hiç sayılmaz.
   "Sık olmayan bir kümenin üst kümesi de sık olamaz."
4. **Seviye 2 adayları.** Sık 5 üründen 10 çift aday; tek tek sayılır (tarama): 6'sı sık
   (ES 7, ET 6, EY 5, SY 9, SP 4, YP 4), 4'ü değil (ST 3, TY 2, EP 1, PT 0).
5. **Seviye 3: budama.** Birleştirmeden çıkan adaylar: alt kümelerinden biri sık değilse
   sayılmadan budanır (ör. EST: ST sık değil); kalan 2 aday sayılır: ESY 5 (sık), SYP 3 (değil).
6. **Dur.** Seviye 4'te aday kalmaz. Toplam: 12 sık küme; 18 aday sayıldı, kaba kuvvet 63
   sayardı.
7. **Eşiği değiştir.** Tarama: min_support 0,5 → 0,3 → 0,2 → 0,15: sık küme sayısı 4 → 7 → 12 →
   16 (kitabın 0,5 / 0,3 / 0,15 sayıları ve 0,2); kafes her durakta yeniden boyanır.
8. **FP-Growth 1. tarama: sıklık sırası.** Ürünler sayılır ve sıralanır (Süt 12, Ekmek 11,
   Yumurta 10, Tereyağı 7, Peynir 5); Reçel eşik altında, atılır. Her fiş bu sıraya dizilir.
9. **FP-ağacı kurulur.** Tarama: fişler tek tek eklenir; ortak önek paylaşılırsa sayaç artar,
   yoksa yeni dal açılır. Sonda düğüm sayısı ve "18 fiş, N düğüm" yazılır.
10. **Koşullu örüntü tabanı.** Peynir için ağaçtaki yollar: önekler ve sayaçları; içinden Süt 4
    ve Yumurta 4 sık → {Süt, Peynir}, {Yumurta, Peynir}; {Süt, Yumurta, Peynir} 3 < 4 değil.
    "Aday üretmeden, yalnız ilgili dallara bakarak."
11. **Aynı sonuç, farklı yol.** Apriori ve FP-Growth'un sık kümeleri yan yana: aynı 12 küme.
    Küçük tablo: veri tarama sayısı (Apriori seviye başına 1 → burada 3; FP-Growth 2), aday
    üretimi (var / yok). Kitabın ölçtüğü süreler bir cümlede ("0,75 ms / 0,49 ms; küçük veride
    fark küçüktür, büyük ve yoğun veride açılır"). Altında kitabın satırları:
    `apriori(islemMatrisi, min_support=0.2, use_colnames=True)` ve `fpgrowth(...)`.

### Laboratuvar

- **min_support** kaydırıcısı, fiş sayısı ızgarasında (1–18 fiş; "0,222 · en az 4 fiş"
  biçiminde yazılır). Kafes ve sayaçlar anında güncellenir.
- **Seviye adımlayıcı** (adım 2–6): "◀ seviye", "seviye ▶", "Sona git"; kafes o seviyeye kadar
  boyanır.
- **FP-ağacı:** fiş ekleme kaydırıcısı 0–18 (adım 9) ve koşullu taban için ürün seçici
  (adım 10).
- Bir kafes düğümüne tıklamak (ve klavyeyle) panelde o kümenin durumunu ve gerekçesini yazar
  ("EST budandı: ST sık değil (3 < 4)").
- Adıma göre yalnızca o adımın kontrolleri görünür: 1 yok; 2–6 seviye adımlayıcı + min_support;
  7 min_support; 8–9 fiş ekleme + min_support; 10 ürün seçici + min_support; 11 min_support.

## Kitapla farklar (kitap düzeltmesi için liste)

- Kitap açılışta "ekmek ve tereyağı alanların %86'sı reçel de alıyor" der; veride böyle bir kural
  yok (tereyağı → ekmek güveni 0,857). Sayfa yalnız veride olan kuralları anar.
- Kitabın alternatifler tablosu conviction ve "leverage"ı "kaldıracın farklı formülasyonları"
  diye anar; mlxtend'de `leverage` = destek(X∪Y) − destek(X)·destek(Y) farktır, `lift`
  (kitabın kaldıracı) oran. Sayfa "kaldıraç (lift)" yazar.
  **2026-10-26 (kitap v0.2):** kitap artık lift = "lift (ilgi oranı)", leverage = "kaldıraç"
  der. Sayfa buna göre güncellendi: başlık "Destek, güven ve lift", terim "lift (ilgi
  oranı)", sonra "lift"; Lab notu leverage'ı kaldıraç diye tanıtır. Bu belgenin geri kalanında
  "kaldıraç" lift anlamındadır.
- Sayfa Apriori'yi min_support 0,2 ile adım adım gösterir; kitap 0,5 / 0,3 / 0,15 sayılarını
  verir (sayfanın eşik taramasında hepsi var).
- Sayfa FP-ağacını çizer ve koşullu örüntü tabanını bir örnekle gösterir; kitapta yalnız akış
  şeması var.

## Arayüzler

- Her sayfa mevcut `ConceptPage<Params>` sözleşmesini sağlar; `StepPlayer` adım/tarama
  sözleşmesi değişmez; adım indeksleri `stepIndex` ile adım kimliklerinden türetilir; Lab
  metni `Step.labText`.
- Kimlikler ve yollar: `birliktelik-olculeri` → `birliktelik-olculeri/`, başlık "Destek, güven
  ve kaldıraç"; `apriori` → `apriori/`, başlık "Apriori ve FP-Growth". Kayıt defterinde
  `soon('apriori', 8, 'Apriori')` iki hazır kayıtla değişir (sıra: birliktelik-olculeri, apriori).
- Parametre adları (öneri, yapıcıya bırakılır): sayfa 1 `{ x: string[]; y: string[];
  minSupport: number; minConfidence: number; minLift: number; edits: number[] }` (edits:
  değiştirilmiş hücrelerin kodlanmış listesi); sayfa 2 `{ minCount: number; level: number;
  inserted: number; baseItem: string | null; node: string | null }`.

## Hata durumları

- X boş ya da Y boş: panel "Bir öncül ve bir sonuç seç." yazar, ölçüt yok.
- destek(X) = 0 (sepet düzenlenince): güven ve kaldıraç `— (tanımsız)`.
- destek(Y) = 0: kaldıraç `— (tanımsız)`.
- min_support hiçbir kümeyi bırakmazsa: "Bu eşikte sık küme yok."
- Hiçbir durumda NaN / Infinity ekrana basılmaz.

## Doğrulama

- Birim: ortak hesap fixture'a karşı (yukarıda); senaryo adım kimlikleri, parametreleri ve
  metinlerdeki sayıların veriden geldiği; sahne testleri (her adımın anahtar DOM öğesi: vurgulu
  sütun, sayaç, güven çubuğu ve taban çizgisi, kural noktaları, kafes düğüm durumları, FP-ağacı
  düğümleri ve sayaçları).
- e2e (yalın): her sayfa için Ders anahtar adımları (sayfa 1: 2, 5, 7, 10; sayfa 2: 3, 5, 9, 10)
  ve birer Lab etkileşimi (hücre değiştir + X/Y seç; min_support kaydır + kafes düğümüne tıkla)
  ekran görüntüsü temeliyle; etiket çakışması ve sahne dışına taşma kontrolleri.
- Performans: sayfa 1 Lab hücre değiştirme ve sayfa 2 min_support sürükleme p95 ≤ 25 ms
  (bölüm sonunda bir kez).
- Kapanış: `npm run check` çıkış 0; kontrolcü ekran görüntülerine kendisi bakar.

## Yapıcıya bırakılanlar

- Dosya bölünmesi, parametre adları, panel iç düzeni, kafes düğüm boyutları ve satır
  yerleşimi (1280×720'de 20 düğümlük seviye 3 tek satıra sığmalı), FP-ağacı yerleşim algoritması
  (katmanlı, kesişmesiz), tarama hızları, palet içindeki renk tonları.
