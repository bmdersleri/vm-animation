# Bölüm 7 — K-Means: döngü ve k sayısının seçimi — Tasarım

- **Tarih:** 2026-10-21
- **Kaynak:** Öğretmenin "K-Means'e geçelim" talebi; kitabın `ch07_kumeleme_analizi/content/final.md` bölümü (K-Means, Dirsek yöntemi, Silhouette skoru). Kitap salt okunurdur.

## Amaç ve kabul ölçütleri

Öğretmenin cümlesiyle hedef: öğrenci **k sayısını belirleyebilmeli**; bunun için **k değerinin neleri değiştirdiğini iyi anlamalı**. Öğrenci ayrıca K-Means'in kümeleri nasıl bulduğunu (ata → taşı → dur döngüsü) adım adım görmeli ve kötü bir başlangıcın sonucu nasıl bozduğunu izlemeli. Ezber "dirseği bul" refleksi değil; k değişince noktaların küme değiştirmesi, merkezlerin kayması, kümelerin bölünmesi ve inertia/silhouette sayılarının buna tepkisi yan yana görülür.

Kabul ölçütleri:

1. İki yeni sayfa yayında: `k-means/` (K-Means döngüsü, 8 adım) ve `k-secimi/` (k sayısının seçimi, 9 adım); her ikisi Ders ve Laboratuvar modunda çalışır.
2. Ekrandaki bütün sayılar (merkezler, küme boyları, inertia, silhouette, nokta bazlı silhouette) üreticinin sklearn ile hesapladığı değerlerdir ve birim testleri bunları sklearn çıktısına karşı doğrular (aşağıdaki referans tablosu).
3. Döngü sayfasında her ata/taşı anı ayrı görülür; döngü yalnız hiçbir nokta küme değiştirmediğinde durur; kötü başlangıç 79,4 civarında takılır, `n_init=10` 43,0'ı bulur.
4. k sayfasında k=1..10 için inertia (dirsek) ve k=2..10 için silhouette aynı anda okunur; seçili k iki grafikte de işaretlidir; dirsek k=3, silhouette k=2 önerir ve bu çelişki bir adımda açıkça anlatılır.
5. Ana sayfada Bölüm 7 altında iki kart "hazır" olur; DBSCAN ve Dendrogram "yakında" kalır.
6. 1280×720 Ders ve Lab ekranlarında örtüşen ya da kesilen yazı yoktur (kontrolcü ekran görüntülerine kendisi bakar); `npm run check` yeşildir.

## Kararlar

| Konu | Karar | Neden |
|---|---|---|
| Odak | k sayısının seçimi ve k'nın neyi değiştirdiği | Öğretmenin kararı |
| Veri | Iris, 2 özellik: sepal length, petal length; `StandardScaler` ile ölçeklenmiş; 150 çiçek | Öğretmenin kararı: ekrandaki uzaklık hesabın kullandığı uzaklıkla aynı olsun. Kitabın ilk K-Means örneğiyle aynı iki özellik; k=3 küme boyları kitapla birebir (43/53/54) |
| Döngü | Ata/taşı döngüsü adım adım gösterilir | Öğretmenin kararı |
| Kötü başlangıç | Gösterilir, `n_init` ile çözümü de gösterilir | Öğretmenin kararı; kitapta "tek başlangıca güvenmek" sık yapılan hata olarak geçer |
| Bölüm kapsamı | Yalnız K-Means; DBSCAN ve Dendrogram "yakında" kalır | Öğretmenin kararı ("şimdilik kmeans") |
| Sayfa sayısı | İki sayfa: döngü (`k-means/`) ve k seçimi (`k-secimi/`) | Benim önerim, öğretmen itiraz etmedi: tek sayfa 15–18 adım olurdu, önceki sayfalar 8–13 adım |
| Sayfa tarifleri | Aşağıdaki adım listeleri | Öğretmen onayladı ("önerilerin onaylandı") |
| Hesaplama | Bütün çalıştırmalar Python'da önceden hesaplanır; tarayıcıda K-Means çalışmaz | Önceki bölümlerin kalıbı: doğrulanabilir sayılar, gecikmesiz etkileşim (benim kararım) |
| Döngü kaydı | sklearn tur geçmişini vermediği için üretici Lloyd döngüsünü numpy ile kaydeder ve son durumu `KMeans(init=<aynı merkezler>, n_init=1, algorithm="lloyd")` ile birebir doğrular | Benim kararım; gösterilen her tur gerçek ve sklearn ile tutarlı |
| İyi başlangıç | k-means++ başlangıcından 4–7 turda inertia 43,0'a varan ilk tohum | Benim kararım: animasyon ne çok kısa ne çok uzun |
| Kötü başlangıç | `init="random"` ile inertia'sı en iyinin 1,5 katını aşan ilk tohum (beklenen ≈79,4: iki merkez aynı grubu paylaşır) | Benim kararım |

## Kapsam dışı

- DBSCAN, hiyerarşik kümeleme, dendrogram (ayrı bölüm işi).
- Telco segmentasyon mini projesi, gap statistic, Davies–Bouldin, Calinski–Harabasz.
- Ölçeklemesiz verinin dirseği bozması (kitapta var; bu sayfaya alınmadı — ölçekleme Bölüm 3'te işlendi).
- Tarayıcıda serbest K-Means (öğrencinin merkezi sürükleyip yeni çalıştırma üretmesi): hesaplar önceden üretilmiş çalıştırmalarla sınırlıdır.
- Kabuk düzeyindeki 390 px Ders kırpılması (önceki bölümlerden ertelenen, kabuk işi).

## Ortak öğretim dili ve görünüm

- Veri her yerde "150 çiçek" ve eksen adları "sepal length (ölçeklenmiş)", "petal length (ölçeklenmiş)" olarak yazılır. Gerçek tür etiketi hiçbir adımda renk olarak kullanılmaz ("etiketsiz veri"); yalnız k sayfasının son adımında bağlam olarak "Iris'te 3 tür olduğu biliniyor" denir.
- İki sayfa aynı nokta konumlarını, aynı küme renk sırasını ve aynı merkez işaretini (artı) kullanır. Renk yanında küme numarası/etiketi verilir; renk tek bilgi taşıyıcı değildir. Küme renkleri en az 6 kümeyi (k sayfası 10'a kadar) birbirinden ayırt edilebilir taşır; 7–10 kümede renk tekrarı olursa küme numarası etiketle ayırt edilir.
- Terimler Türkçe, gerektiğinde İngilizcesiyle: küme merkezi (centroid), atama (assignment), güncelleme (update), inertia (küme içi kareler toplamı), dirsek yöntemi (elbow method), silhouette skoru, yerel optimum (local optimum), başlangıç (initialization).
- Ondalık ayırıcı virgüldür (43,0; 0,545). Tanımsız değer `— (tanımsız)` yazılır; NaN/Infinity ekrana basılmaz.
- Sahneler mümkün olan her yerde `src/core/plot/` parçalarını kullanır (eksenler, `fitEqualAspect` ile eşit oranlı saçılım, biçimlendirme, geçişler). İki sayfanın ortak saçılım/merkez katmanı `src/core/plot/` altına veya iki sayfanın ortak modülüne bir kez yazılır, kopyalanmaz.
- Saçılım eşit eksen oranıyla çizilir (uzaklıklar göze doğru görünsün).
- Tarama (sweep) bitince taranan değer son değerinde kalır; tarama başa dönmez (Bölüm 6 dersi).

## Sayfa 1 — K-Means döngüsü (`k-means/`)

### Öğrenme sonucu

Öğrenci K-Means'in iki adımlı döngüsünü (her noktayı en yakın merkeze ata; her merkezi kendi kümesinin ortalamasına taşı) ve durma koşulunu görür; inertia'nın her turda düştüğünü okur; sonucun başlangıca bağlı olduğunu ve `n_init`'in neden kullanıldığını anlar.

### Adımlar (k=3 sabit)

1. **Etiketsiz noktalar:** 150 nokta gri; "gerçek grup bilinmiyor; K-Means grupları kendisi bulacak, ama kaç grup olacağını (k) biz söylüyoruz" fikri.
2. **Başlangıç (k-means++):** Üç merkez iyi başlangıcın gerçek konumlarına yerleşir; k-means++'ın merkezleri birbirinden uzak seçtiği kısaca söylenir.
3. **Ata:** Her nokta en yakın merkezin rengini alır. Seçili birkaç noktadan üç merkeze uzaklık çizgileri çizilir; en kısa olan vurgulanır. Tur 1 atama sonucu küme boyları görünür.
4. **Taşı:** Her merkez kendi kümesinin ortalamasına kayar; eski konum soluk iz olarak kalır. Tur 1 sonrası inertia görünür.
5. **Tekrar:** Kalan turlar ata/taşı alt anlarıyla oynar (tarama). Her turda tur numarası, renk değiştiren nokta sayısı ve inertia görünür; inertia'nın her turda düştüğü (artmadığı) okunur.
6. **Dur:** Son turda hiçbir nokta renk değiştirmez, merkezler kıpırdamaz; sonuç küme boyları 43 / 53 / 54 ve inertia 43,0. Durma koşulu açıkça yazılır.
7. **Kötü başlangıç:** Rastgele başlangıçta iki merkez aynı gruba düşer; döngü kurallara uyarak çalışır ama yerel optimumda (≈79,4) durur. İyi sonuçla inertia karşılaştırması yan yana gösterilir.
8. **`n_init=10`:** On ayrı başlangıcın son inertia değerleri liste/çubuk olarak görünür; en düşüğü seçilir (43,0). Kitaptaki `KMeans(n_clusters=3, n_init=10, random_state=42)` satırıyla bağ kurulur.

### Laboratuvar

- "Yeni başlangıç" düğmesi önceden hesaplanmış başlangıçlar arasında sırayla dolaşır (en az 10 başlangıç; iyi, biraz kötü ≈44,2 ve kötü ≈79,4 sonuçların her biri en az bir kez bulunur). Seçilen başlangıcın döngüsü adım adım (ata/taşı) veya sürekli oynatılabilir.
- Tur kontrolü yalnız döngü adımlarında (3–7) görünür; adım 8'de on başlangıç listesinden biri seçilince o başlangıcın son durumu gösterilir.
- Ders ve Lab aynı sahneyi kullanır; Lab'da sayısal ayrıntı (merkez koordinatları, tur tablosu) açıklama altında görünür.

## Sayfa 2 — k sayısının seçimi (`k-secimi/`)

### Öğrenme sonucu

Öğrenci k değiştikçe nelerin değiştiğini görür (kümelerin bölünmesi, merkezlerin kayması, küme boyları); inertia'nın k ile her zaman düştüğünü ve bu yüzden tek başına k seçtiremeyeceğini; dirsek yönteminin azalan getiriyi, silhouette'in ayrışma netliğini ölçtüğünü; ikisinin farklı k önerebileceğini ve kararı bağlamın verdiğini öğrenir.

### Görünüm

Solda saçılım (noktalar küme renginde, merkezler artı); sağda iki küçük grafik: dirsek (inertia, k=1..10) ve silhouette (k=2..10); seçili k iki grafikte de vurgulu. Altta okuma kutusu: k, inertia, bir önceki k'ya göre düşüş, silhouette, negatif skorlu nokta sayısı, küme boyları. (Onaylı taslak, ana çalışma kopyasında: `C:/projects/vmAnimation/.superpowers/brainstorm/58387-1792591714/content/kmeans-layout.html`.)

### Adımlar

1. **k=1:** Tek merkez veri ortasında; inertia 300,0 (ölçeklenmiş 2 özellikte toplam varyans: 150×2). Silhouette `— (tanımsız)`: karşılaştırılacak komşu küme yok.
2. **k=2:** Alttaki küçük grup kopar; inertia 84,7.
3. **k=3:** Üstteki büyük grup ikiye bölünür; inertia 43,0; küme boyları 43 / 53 / 54. Noktaların hangi kümeye geçtiği k=2'ye göre görünür (renk değiştiren noktalar vurgulu).
4. **Inertia hep düşer:** k=4..10 taranır; inertia her k'da düşer (10'da 8,5). "k=n olsaydı inertia 0 olurdu; en düşük inertia'yı seçmek her zaman en çok kümeyi seçmek demek" fikri.
5. **Dirsek:** Ardışık düşüşler gösterilir (215,3 · 41,7 · 14,5 · 6,1 …); kazancın k=3'ten sonra belirgin biçimde küçüldüğü, dirseğin k=3 olduğu okunur.
6. **Silhouette nedir:** k=3'te seçili bir nokta için a (kendi kümesine ortalama uzaklık) ve b (en yakın komşu kümeye ortalama uzaklık) gösterilir; s = (b − a) / max(a, b) o noktanın gerçek sayılarıyla hesaplanır; -1..+1 yorumu.
7. **Silhouette eğrisi:** k=2..10 ortalama silhouette; zirve k=2 (0,632).
8. **k=3 mü k=4 mü:** k=3 (0,545) ile k=4 (0,547) neredeyse eşit; k=4'te 12 çiçeklik küçük bir küme kopar ve bir noktanın silhouette'i negatife düşer (kırmızı halka). "Neredeyse eşit skor, çok farklı bölünme" fikri.
9. **Çelişki ve karar:** Dirsek 3 diyor, silhouette 2 diyor; ikisi farklı soruları yanıtlar (kitaptaki ipucu: "ekstra küme eklemenin faydası azalıyor mu" ve "kümeler ne kadar net ayrışıyor"). Kararı bağlam verir; Iris'te 3 tür olduğu bilinir.

### Laboratuvar

- k kaydırıcısı 1..10; saçılım, iki grafikteki vurgu ve okuma kutusu birlikte güncellenir.
- Silhouette adımlarında (6–9) bir noktaya tıklanınca (ve klavyeyle seçilebilir bir liste/kaydırıcıyla) o noktanın a, b, s değerleri gösterilir; k=1'de bu kontrol gizlenir.
- k değişince bir önceki k'dan renk değiştiren noktalar kısa süre vurgulanır.

## Veri üretimi ve sayısal doğrulama

- Tek üretici `scripts/make_kmeans_data.py` (sabit tohumlar; sklearn sürümü ve parametreler JSON'a yazılır); çıktı `src/concepts/kmeans/data/` altındadır ve elle düzenlenmez.
- Kaydedilenler: 150 ölçeklenmiş nokta; sayfa 1 için başlangıçlar (her biri: başlangıç yöntemi, tohum, tur tur atamalar ve merkezler, tur başına inertia ve renk değiştiren nokta sayısı, son inertia); `n_init=10` için on başlangıcın son inertia değerleri; sayfa 2 için k=1..10 her biri: etiketler, merkezler, inertia, ortalama silhouette (k≥2), nokta bazlı silhouette (k≥2), her nokta için a ve b (k≥2).
- k sayfası çalıştırmaları kitaptaki çağrıyla aynıdır: `KMeans(n_clusters=k, n_init=10, random_state=42)`.
- Küme numaraları k'lar arasında kararlı tutulur (bir k'dan diğerine renkler gereksiz yere değişmesin): üretici küme numaralarını, bir önceki k'nın kümeleriyle en çok örtüşene göre yeniden numaralandırır; yeniden numaralandırma inertia ve silhouette'i değiştirmez (test edilir).
- Referans değerler (2 özellik, ölçeklenmiş, `n_init=10, random_state=42`; üreticiyle 2026-10-21'de hesaplandı):

| k | inertia | silhouette | küme boyları |
|---|---|---|---|
| 1 | 300,00 | tanımsız | 150 |
| 2 | 84,72 | 0,6324 | 56 / 94 |
| 3 | 43,03 | 0,5445 | 43 / 53 / 54 |
| 4 | 28,49 | 0,5468 | 12 / 41 / 44 / 53 |
| 5 | 22,40 | 0,5038 | 12 / 26 / 31 / 31 / 50 |
| 6 | 16,85 | 0,4355 | |
| 7 | 13,90 | 0,4444 | |
| 8 | 11,72 | 0,4638 | |
| 9 | 9,83 | 0,4656 | |
| 10 | 8,46 | 0,4650 | |

  k=4'te 1 nokta, k=7, 8'de 1'er, k=10'da 2 nokta negatif silhouette alır; k=2, 3, 5, 6, 9'da negatif yoktur. Tek başlangıçlı 200 denemede k=3 için son inertia 43,0 / 44,2 / ≈79,4 çıkar.

## Başlangıçlar, seçili noktalar ve adım değerleri (benim kararlarım)

- **Lab başlangıç listesi (sayfa 1):** 12 başlangıç, sırası sabit. 0 = iyi başlangıç (k-means++, Ders adım 2–6), 1 = kötü başlangıç (`init="random"`, ≈79,4, Ders adım 7), kalan 10'u üreticinin sabit kuralla seçtiği k-means++ ve rastgele başlangıçların karışımı; listede en az bir ≈44,2 bulunur. Hepsinin tur tur geçmişi saklanır. "Yeni başlangıç" bu listeyi sırayla dolaşır, sonda başa döner.
- **İyi/kötü tohum:** Üretici tohumları 0'dan başlayarak sırayla dener; iyi = k-means++ ile 4–7 turda 43,0'a varan ilk tohum, kötü = `init="random"` ile son inertia'sı en iyinin 1,5 katını aşan ilk tohum. Seçilen tohumlar JSON'a yazılır. 4–7 aralığında tohum bulunmazsa aralık 3–8'e genişletilir ve bu ledger'a yazılır.
- **`n_init=10` (sayfa 1, adım 8):** sklearn'ün varsayılanı gibi on k-means++ başlangıcı: `KMeans(n_clusters=3, init="k-means++", n_init=1, random_state=s)`, s=0..9. Lab listesinden ayrı bir kümedir; her biri için yalnız son etiketler, merkezler, inertia ve tur sayısı saklanır. En düşük inertia'nın, kitaptaki `KMeans(n_clusters=3, n_init=10, random_state=42)` çağrısının inertia'sına (43,03) iki ondalıkta eşit olduğu testle doğrulanır.
- **Sayfa 1 adım 3 uzaklık çizgileri:** 3 nokta, her tur-1 kümesinden bir tane: kümesindeki üyelerin kendi merkezine uzaklığı sıralandığında ortanca olan üye (eşitlikte küçük indeks).
- **Sayfa 2 adım 6 silhouette noktası:** k=3'te silhouette'i k=3 ortalamasına (0,545) en yakın nokta (eşitlikte küçük indeks).
- **Sayfa 2 adım değerleri:** adım 1–3 sabit k=1, 2, 3 (bir önceki k'dan geçiş animasyonlu); adım 4 k=4..10 taraması (k=10'da kalır); adım 5 k=3, dirsek düşüşleri; adım 6 k=3; adım 7 k=2..10 taraması, silhouette eğrisi nokta nokta çizilir, zirve (k=2) işaretli kalır; adım 8 k=4, okuma kutusunda k=3 ile yan yana; adım 9 k=3, dirsek ve silhouette önerileri iki grafikte işaretli.
- **Seçili nokta görünümü:** nokta kendi küme renginde kalır, çevresine koyu lacivert halka ve kısa etiket eklenir; negatif silhouette işareti kırmızı halkadır ve seçim halkasıyla birlikte görünebilir.

## Arayüzler

- Her sayfa mevcut `ConceptPage<Params>` sözleşmesini (`scenario`, `mountScene`, `mountParams`, gerekirse `mountExplainExtra`) sağlar; `StepPlayer` adım/tarama sözleşmesi değişmez.
- Sayfa kimlikleri ve yolları: `k-means` → `k-means/`, başlık "K-Means döngüsü"; `k-secimi` → `k-secimi/`, başlık "k sayısının seçimi". Registry'de `soon('k-means', 7, 'K-Means')` bu iki "hazır" kayıtla değiştirilir (sıra: k-means, k-secimi, sonra dbscan, dendrogram). Ana sayfa: 22 kavram, 12 hazır, 10 yakında.
- Ortak veri/hesap modülü `src/concepts/kmeans/` (veri yükleme, tip tanımları); sayfalar `src/concepts/k-means/` ve `src/concepts/k-secimi/`.
- Parametre adları (öneri, yapıcıya bırakılır): sayfa 1 `{ start: number; turn: number; phase: 'ata' | 'tasi' }`; sayfa 2 `{ k: number; point: number | null }`.

## Hata durumları

- k=1'de silhouette ve a/b sorulursa → `— (tanımsız)` ve kısa gerekçe; nokta seçimi kontrolü gizli.
- Bir küme boşalırsa (gösterilen çalıştırmalarda olmamalı) → üretici hata verip durur; sayfa boş küme göstermez.
- Lab'da tarama sürerken parametre değişirse → tarama durur, yeni değer anında ve tutarlı gösterilir (skor/merkez erken ya da yarım açılmaz).
- `prefers-reduced-motion` → geçişler anında; her adımın son durumu aynıdır.
- Veri dosyası yüklenemezse → mevcut sayfaların davranışı (derleme anında JSON içe aktarımı; çalışma anı hatası beklenmez).

## Doğrulama

- `tests/unit/kmeans/data.test.ts`: referans tablosundaki inertia/silhouette/küme boyları; her tur atamasının o turun merkezlerine en yakın merkez olduğu; her merkezin kendi kümesinin ortalaması olduğu; inertia'nın turlar boyunca artmadığı; son turda renk değiştiren nokta sayısının 0 olduğu; a/b/s'nin `s=(b−a)/max(a,b)` ile tutarlı olduğu; yeniden numaralandırmanın metrikleri değiştirmediği.
- `tests/fixtures/kmeans_sklearn.json`: üreticiden bağımsız sklearn referans çıktısı (Bölüm 6 kalıbı).
- `tests/unit/k-means/*.test.ts` ve `tests/unit/k-secimi/*.test.ts` (jsdom): her adımın ana anı bir DOM öğesine ve bir teste eşlenir (ör. adım 3'te uzaklık çizgileri ve renkler, adım 6'da `data-changed=0`, adım 8'de en düşük inertia'nın seçili olması; k sayfasında adım 4 taramasının k=10'da kalması, adım 8'de negatif nokta işareti).
- `tests/e2e/k-means.spec.ts`, `tests/e2e/k-secimi.spec.ts`: yalnız ana adımlar (Ders ve Lab), 1280×720 ekran görüntüleri; ana sayfa testi güncellenir.
- Performans testleri bölüm sonunda bir kez çalışır.
- Kapanış: `npm run check` çıkış 0; kontrolcü ekran görüntülerine kendisi bakar.
