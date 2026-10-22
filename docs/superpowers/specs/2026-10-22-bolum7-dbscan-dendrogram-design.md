# Bölüm 7 — DBSCAN ve Dendrogram — Tasarım

- **Tarih:** 2026-10-22
- **Kaynak:** Öğretmenin "dbscan ve dendogram kısımlarını da hazırla ve bölüm 7 eksiksiz
  tamamlanmış olsun" talebi; kitabın `ch07_kumeleme_analizi/content/final.md` bölümü
  (Hiyerarşik kümeleme ve dendrogram, DBSCAN). Kitap salt okunurdur.
- **Önceki tasarım:** `docs/superpowers/specs/2026-10-21-bolum7-kmeans-design.md` (aynı bölümün
  K-Means sayfaları; ortak görünüm kuralları oradan devralınır).

## Amaç ve kabul ölçütleri

Öğretmenin cümleleriyle:

- DBSCAN'de öğrencilerin en çok takıldığı yer, **eps ile min_samples'ın noktaları nasıl çekirdek,
  sınır ve gürültü diye ayırdığını görmek**. DBSCAN sayfasının merkezi budur.
- Dendrogramda öğrenci **hepsini** kavramalı: birleşmelerin aşağıdan yukarı adım adım nasıl
  olduğunu, ağacın hangi yükseklikten kesilince kaç küme verdiğini ve Ward / complete / single
  bağlantının aynı veride neden farklı ağaçlar ürettiğini.
- "Önemli olan kitaba bağlılık değil, konunun en iyi şekilde anlatılması; gerekirse kitabı yeniden
  düzenleriz." Veri ve değerler öğretim için seçilir; kitaptan ayrılan sayılar aşağıda
  ("Kitapla farklar") listelenir ki kitap sonradan düzeltilebilsin.

Kabul ölçütleri:

1. İki yeni sayfa yayında: `dbscan/` (DBSCAN, 10 adım) ve `dendrogram/` (Hiyerarşik kümeleme ve
   dendrogram, 10 adım); ikisi de Ders ve Laboratuvar modunda çalışır. Ana sayfada Bölüm 7'nin
   dört kartı da "hazır" olur: 22 kavram, 14 hazır, 8 yakında.
2. DBSCAN sayfasında öğrenci tek bir noktanın eps dairesini, dairedeki komşu sayısını
   (noktanın kendisi dahil) ve bu sayının min_samples ile karşılaştırmasını görür; çekirdek,
   sınır ve gürültü örneklerinin her biri ayrı bir adımda gösterilir.
3. Üç nokta türü ayrı şekille çizilir; renk tek taşıyıcı değildir: çekirdek = küme renginde dolu
   daire, sınır = küme renginde içi boş halka, gürültü = gri ×.
4. Dendrogram sayfasında saçılım ve dendrogram yan yana durur; her birleşme ikisinde aynı anda
   görünür. Kesim çizgisi kaydırılınca küme sayısı ve saçılım renkleri birlikte değişir.
5. Ekrandaki her sayı (komşu sayıları, tür sayıları, küme sayıları, birleşme yükseklikleri,
   küme boyları) sklearn / scipy ile üretilmiş ya da onlarla birim testinde birebir doğrulanmış
   değerdir.
6. 1280×720'de Ders ve Lab adımlarında yazı yazının üstüne binmez, hiçbir şey kırpılmaz; 900 px
   altında tek sütun yerleşimi çalışır.
7. `npm run check` yeşil; kontrolcü ekran görüntülerine kendisi bakar.

## Kararlar

| Konu | Karar | Kimin |
|---|---|---|
| Odak (DBSCAN) | eps ve min_samples → çekirdek / sınır / gürültü | Öğretmen |
| Odak (dendrogram) | Birleşme adımları + kesim + bağlantı farkı, hepsi | Öğretmen ("hepsi") |
| Kitaba bağlılık | Öğretim önce gelir; kitap gerekirse düzeltilir | Öğretmen |
| Sayfa sayısı | İki sayfa: kayıttaki `dbscan` ve `dendrogram` kartları | Benim önerim, öğretmen "devam et" |
| DBSCAN verisi | İki hilal + bilerek eklenmiş dağınık aykırı noktalar (aşağıda) | Öğretmenin ilkesine dayanarak benim kararım |
| Dendrogram verisi | Iris yerine 17 noktalık el yapımı 2B veri (aşağıda) | Benim kararım: 150 yaprak adım adım okunamaz |
| DBSCAN hesabı | Tarayıcıda (210 nokta, O(n²) anlık); sklearn ile birim testinde ızgara üzerinde birebir doğrulanır | Benim kararım: Lab kaydırıcıları sürekli değişir |
| Dendrogram hesabı | Python'da (scipy `linkage`) önceden hesaplanır, JSON'a yazılır | Benim kararım; önceki bölümlerin kalıbı |
| Görünüm | K-Means sayfalarının yerleşimi ve dili (aşağıda) | Benim kararım |

## Kapsam dışı

- OPTICS, HDBSCAN, ortalama kayması (mean shift), Gauss karışımı.
- Divisive (yukarıdan aşağı) hiyerarşik kümeleme; yalnızca aglomeratif.
- Iris dendrogramı ve `truncate_mode`: bir cümleyle anılır (büyük veride ağaç özetlenir), çizilmez.
- Telco segmentasyon mini projesi.
- Kitabın düzeltilmesi (bu işin çıktısı yalnızca "Kitapla farklar" listesidir).

## Ortak öğretim dili ve görünüm

K-Means tasarımının ortak kuralları aynen geçerlidir: metin boyutları yalnız `--fs-*`
belirteçlerinden; SVG'lerde viewBox yok; saçılımlar eşit eksen oranıyla çizilir (uzaklıklar göze
doğru görünsün; eps dairesi daire olarak görünür); sayılar Türkçe ondalık virgülüyle; tanımsız
değer `— (tanımsız)`; tarama bitince taranan değer son değerinde kalır; `prefers-reduced-motion`
altında son durum anında çizilir.

- Sahneler `src/core/plot/` parçalarını kullanır (eksenler, `fitEqualAspect`, biçimlendirme,
  geçişler, `ClusterScatterLayer`). DBSCAN nokta türleri ve dendrogram çizimi için gereken yeni
  katmanlar, ikinci bir sayfanın da kullanabileceği biçimde yazılır; ikinci kullanıcı çıkarsa
  `src/core/plot/` altına taşınır, kopyalanmaz.
- Küme renkleri `CLUSTER` paletinden; gürültü gri (`--muted`). Küme numaraları "Küme 1, 2, …"
  çipleriyle de yazılır.
- Seçili nokta: koyu lacivert halka ve "Nokta N" etiketi (K-Means sayfalarıyla aynı görünüm ve
  etiket yerleştirici).

## Sayfa 1 — DBSCAN (`dbscan/`)

### Öğrenme sonucu

Öğrenci, DBSCAN'in her noktaya "eps yarıçapında kaç komşun var?" diye sorduğunu; cevabın
min_samples'a yetip yetmemesine göre noktanın çekirdek, sınır ya da gürültü olduğunu; kümelerin
çekirdekten çekirdeğe yayılarak büyüdüğünü; eps ve min_samples değişince bu ayrımın nasıl
kaydığını görür. K-Means'in hilallerde neden başarısız olduğunu ve DBSCAN'in neden başarılı
olduğunu yan yana görür; eps'in k-uzaklık grafiğiyle nasıl seçilebileceğini öğrenir.

### Görünüm

Solda eşit oranlı saçılım (ölçeklenmiş iki özellik), sağda okuma paneli: seçili noktanın komşu
sayısı ve kararı, tür sayıları (çekirdek / sınır / gürültü), küme sayısı ve küme boyları.
Seçili noktanın eps dairesi saçılımda yarı saydam dolgu ve kesikli kenarla çizilir; dairenin
içindeki komşular vurgulanır (ince lacivert halka). Adım 10'da panelin yerinde k-uzaklık grafiği
durur.

### Adımlar (eps = 0,3, min_samples = 5 aksi söylenmedikçe)

1. **Hilaller ve birkaç dağınık nokta.** 210 nokta, etiketsiz, gri. "İki hilal; kaç grup var?"
2. **K-Means burada yanılır.** `KMeans(n_clusters=2)` sonucu: hilaller ortadan, düz bir çizgiyle
   bölünür; aykırı noktalar da bir kümeye zorla atanır. Panel: "K-Means küresel küme varsayar."
3. **eps dairesi.** Seçili bir çekirdek örneği (A) ve eps dairesi; komşu sayısı sayılır
   (sayaç animasyonu). Panel: "eps = 0,3 yarıçap. Daire içinde N nokta (kendisi dahil)."
4. **Çekirdek.** A için "N ≥ min_samples = 5 → çekirdek". A dolu daireye döner.
5. **Sınır.** Seçili sınır örneği (B): "komşu 3 < 5, ama dairesinde bir çekirdek var → sınır".
   Dairesindeki çekirdek ayrıca vurgulanır.
6. **Gürültü.** Seçili gürültü örneği (C): "komşu 1 < 5 ve dairesinde çekirdek yok → gürültü".
7. **Bütün noktalar.** Her nokta türüne göre çizilir; panel tür sayılarını verir.
8. **Kümeler yayılır.** Bir çekirdekten başlayıp eps içindeki çekirdeklere dalga dalga yayılma
   (tarama); önce Küme 1, sonra Küme 2 renklenir; sınırlar ulaşıldıkları kümenin rengini alır;
   gürültü gri kalır. Sonda: "2 küme, 11 gürültü" (gerçek sayılar üreticiden).
9. **eps'i değiştir.** Tarama: eps 0,15 → 0,3 → 0,6. Küçük eps'te çok sayıda gürültü ve parçalı
   küme, büyük eps'te iki hilal tek kümede birleşir. Panel her durakta küme ve gürültü sayısını
   verir. (Durak değerleri üreticinin kontrolüyle kesinleşir; ölçüt: küçük uçta gürültü ≥ %20,
   büyük uçta küme sayısı 1.)
10. **eps nasıl seçilir: k-uzaklık grafiği.** Her noktanın 5. en yakın komşusuna uzaklığı
    (kendisi dahil sayılarak, min_samples ile tutarlı) küçükten büyüğe sıralanır; grafiğin
    büküldüğü yer eps için iyi bir adaydır; 0,3 çizgisi grafikte işaretlidir. Altında kitabın
    kod satırı: `DBSCAN(eps=0.3, min_samples=5)`.

### Laboratuvar

- eps kaydırıcısı 0,05–1,00 (adım 0,01) ve min_samples kaydırıcısı 2–15. Değiştikçe nokta
  türleri, kümeler, tür ve küme sayıları anında güncellenir.
- Bir noktaya tıklayınca (ve klavyeyle "Nokta N" sayı alanıyla) o noktanın eps dairesi, komşu
  sayısı ve türünün gerekçesi panelde görünür.
- Adıma göre yalnızca o adımın kontrolleri görünür (önceki bölümlerin kuralı): 1–2 kontrol yok;
  3–8 nokta seçimi + eps + min_samples; 9 eps; 10 min_samples (k-uzaklık grafiği min_samples'a
  göre yeniden çizilir).

## Sayfa 2 — Hiyerarşik kümeleme ve dendrogram (`dendrogram/`)

### Öğrenme sonucu

Öğrenci aglomeratif kümelemenin her noktayı ayrı küme sayarak başladığını ve her adımda en yakın
iki kümeyi birleştirdiğini; her birleşmenin dendrogramda birleşme uzaklığı yüksekliğinde bir dal
olduğunu; ağacı bir yükseklikten kesmenin kesilen dal sayısı kadar küme verdiğini ve en uzun
dikey boşluğun doğal bir kesim olduğunu; bağlantı yönteminin (Ward / complete / single) "iki
kümenin uzaklığı"nı farklı tanımladığı için farklı ağaçlar ürettiğini, single bağlantının
zincirleme eğilimini görür.

### Görünüm

Solda eşit oranlı saçılım (17 nokta, her nokta numaralı), sağda dendrogram (yapraklar altta,
yükseklik ekseni solda, birleşme uzaklığı). Altta ya da sağda dar bir okuma paneli: adım
sayacı ("Birleşme 5 / 16"), küme sayısı, son birleşmenin iki kümesi ve yüksekliği. Birleşen iki
küme saçılımda bir kapsayıcı (dışbükey zarf ya da yuvarlatılmış halka) ile, dendrogramda yeni dal
vurgusuyla gösterilir. Yaprak sırası scipy `dendrogram` yaprak sırasıdır (dallar kesişmez).

### Adımlar (Ward aksi söylenmedikçe)

1. **Her nokta kendi kümesi.** 17 nokta, 17 küme; dendrogramda yalnız yapraklar.
2. **İlk birleşme.** En yakın iki nokta birleşir; dendrogramda ilk dal o uzaklık yüksekliğinde.
3. **Birleşmeye devam.** Tarama: birleşme 2 → 8; küme sayacı azalır.
4. **İki kümenin uzaklığı ne demek?** Ward tanımı: birleşince küme içi kareler toplamının en az
   arttığı çift. Bir birleşme için artış sayısı panelde (üreticiden).
5. **Ağaç tamamlanır.** Tarama: kalan birleşmeler; sonda tek küme ve tam dendrogram.
6. **Kesim çizgisi.** Yatay kesim çizgisi bir yükseklikte; kestiği dal sayısı = küme sayısı;
   saçılım bu kümelere göre boyanır.
7. **Kesimi kaydır.** Tarama: kesim yüksekten alçağa; küme sayısı 1, 2, 3, … artar.
8. **Doğal kesim.** Ardışık birleşme yükseklikleri arasındaki en uzun boşluk vurgulanır; kesim
   oraya yerleşir: 3 küme (A, B, C grupları). Kitaptaki "8,00 ile 12,64 arasındaki geniş boşluk"
   fikrinin aynısı.
9. **Bağlantı değişince ağaç değişir.** Aynı veride single bağlantı: zincir noktaları A ile B'yi
   alçak yükseklikte birbirine bağlar; 3 kümeye kesince A + zincir + B tek küme olur. Ward ile
   yan yana (iki küçük dendrogram ya da hızlı geçiş).
10. **Üç bağlantı, bir tablo.** Ward / complete / single: tanım (bir cümle), 3 kümede küme
    boyları, ne zaman uygun. Altında kitabın kod satırları:
    `linkage(X, method="ward")` ve `AgglomerativeClustering(n_clusters=3, linkage="ward")`.

### Laboratuvar

- Bağlantı seçici: Ward, complete, average, single.
- Birleşme adımı: "◀ birleşme", "birleşme ▶", "Sona git" ve 0..16 kaydırıcı.
- Kesim: kesim yüksekliği kaydırıcısı (sürüklenebilir kesim çizgisi de olabilir) ve "küme sayısı"
  okuması; bir küme sayısı düğmesi (1–6) kesimi o sayının ortasına yerleştirir.
- Bir noktaya tıklayınca yaprağı dendrogramda vurgulanır; dendrogramda bir dala tıklayınca o
  dalın altındaki noktalar saçılımda vurgulanır.
- Adıma göre yalnızca o adımın kontrolleri görünür: 1–5 birleşme adımı (+ bağlantı); 6–8 kesim
  (+ bağlantı); 9–10 bağlantı + kesim.

## Veri üretimi ve sayısal doğrulama

Tek üretici: `scripts/make_dbscan_dendrogram_data.py` (ya da iki ayrı betik; yapıcıya bırakılır)
JSON'u `src/concepts/dbscan/data/` ve `src/concepts/dendrogram/data/` altına yazar; elle düzenlenmez.

### DBSCAN verisi (benim kararım; üretici kontrol eder)

- `make_moons(n_samples=200, noise=0.08, random_state=42)` + `RandomState(7)` ile hilallerin
  sınır kutusunun 0,15 dışına taşan bir dikdörtgende düzgün dağılımlı 10 aykırı nokta; birlikte
  `StandardScaler` ile ölçeklenir. Koordinatlar 6 ondalıkla yazılır.
- Ön deneme (2026-10-22): eps = 0,3, min_samples = 5 → 2 küme, 191 çekirdek, 8 sınır, 11 gürültü.
  Üretici bu sayıları sklearn ile yeniden hesaplar ve JSON'a yazar. Ölçüt: 2 küme, sınır ≥ 5,
  gürültü ≥ 5. Tutmazsa aykırı nokta tohumu 7'den itibaren sırayla denenir; seçilen tohum
  JSON'a yazılır.
- Örnek noktalar (adım 3–6): A = komşu sayısı en büyük çekirdeklerden hilalin ortasına en yakını;
  B = en az bir sınır noktası, dairesinde tam bir çekirdek bulunan tercih edilir; C = en yakın
  komşusu en uzak olan gürültü noktası. Üretici seçer ve yazar.
- Eşik güvenliği: bkz. "Yapıcı kontrolünden çıkan kararlar" madde 2.
- K-Means karşılaştırması: `KMeans(n_clusters=2, n_init=10, random_state=42)` etiketleri JSON'da.
- k-uzaklık: min_samples 2..15 için her noktanın min_samples'ıncı en yakın komşu uzaklığı
  (kendisi dahil; sklearn `NearestNeighbors(n_neighbors=min_samples)` ile aynı tanım), sıralı.

### DBSCAN tarayıcı hesabı

- `src/concepts/dbscan/` içinde saf bir `dbscan(points, eps, minSamples)` fonksiyonu: komşuluk
  `d ≤ eps` (sklearn ile aynı, kendisi dahil), çekirdek = komşu sayısı ≥ min_samples, kümeler
  sklearn'in genişleme sırasıyla (nokta indeks sırası) numaralanır. Sonuç: her nokta için tür
  ve küme, ayrıca yayılma sırası (adım 8 animasyonu için).
- Birim testi: üreticinin yazdığı fixture'daki her (eps, min_samples) çifti için (eps ∈ {0,10;
  0,15; …; 1,00}, min_samples ∈ {2, 3, 5, 8, 10, 15}) çekirdek kümesi ve gürültü kümesi birebir,
  küme bölünmesi etiket permütasyonuna kadar birebir. İki kümeye de ulaşılabilen sınır noktaları
  fixture'da işaretlenir ve o noktalarda iki küme de kabul edilir.

### Dendrogram verisi (benim kararım; üretici kontrol eder)

- 17 nokta, aynı birimde iki özellik (ölçekleme yok, ölçek ve gerekçe panelde bir cümle):
  A grubu 5 nokta, B grubu 5 nokta, C grubu 3 nokta, A ile B arasında 4 noktalık ince bir zincir.
  Ön deneme koordinatları (üretici ince ayar yapabilir):
  A (1,0; 1,0) (1,4; 1,3) (0,8; 1,6) (1,6; 0,8) (1,2; 2,0);
  B (6,0; 1,2) (6,5; 1,6) (5,7; 0,7) (6,3; 0,6) (6,8; 1,1);
  C (3,3; 5,0) (3,8; 5,4) (3,0; 5,6);
  zincir (2,3; 1,2) (3,2; 1,1) (4,1; 1,15) (5,0; 1,1).
- Ölçütler (üretici doğrular, tutmazsa koordinatları sistematik oynatır ve kuralı yazar):
  1. Ward, complete, average ve single için ardışık birleşme yükseklikleri arasında en az 0,05
     fark (eşit yükseklik yok; birleşme sırası tek anlamlı).
  2. Ward'da ardışık yükseklikler arasındaki en büyük boşluk, ağacı 3 kümeye kesen boşluktur ve
     bu 3 küme A, B, C gruplarını içerir (zincir noktaları A ile B arasında bölünür).
  3. Single bağlantıda 3 kümeye kesince A, zincir ve B aynı kümededir (zincirleme görünür).
  4. scipy `fcluster(Z, 3, "maxclust")` bölünmesi sklearn
     `AgglomerativeClustering(n_clusters=3, linkage=…)` bölünmesiyle etiket permütasyonuna kadar
     aynıdır (dört bağlantının hepsinde).
- JSON: noktalar; her bağlantı için scipy `linkage` matrisi (birleşen iki küme, yükseklik, boyut),
  yaprak sırası (`dendrogram(no_plot=True)["leaves"]`), k = 1..6 için kesim aralıkları ve küme
  etiketleri, Ward adım 4'teki örnek birleşmenin kareler toplamı artışı.
- Ön deneme (Ward) son beş yükseklik: 1,51 / 1,64 / 3,94 / 8,99 / 10,99 → en büyük boşluk
  3,94 → 8,99, yani 3 küme. Single'da 0,90 yüksekliğinde eşitlik var; ölçüt 1 için koordinatlar
  ayarlanacak.

### Dendrogram tarayıcı tarafı

- Ağaç geometrisi (yaprak x konumları, dal yükseklikleri) JSON'daki linkage matrisinden ve yaprak
  sırasından türetilir; kesim yüksekliğinden küme etiketleri türetme fonksiyonu birim testinde
  JSON'daki k = 1..6 etiketleriyle birebir karşılaştırılır.

## Kitapla farklar (kitap düzeltmesi için liste)

- DBSCAN: kitap `make_moons(300, noise=0.07)` kullanır ve eps = 0,3, min_samples = 5 ile
  "2 küme, 0 gürültü" bulur; sayfa 200 nokta + 10 aykırı nokta kullanır ve aynı değerlerle
  2 küme, ≈8 sınır, ≈11 gürültü gösterir (gürültü ve sınırın görünmesi için).
- DBSCAN: sayfa min_samples'ın noktanın kendisini de saydığını açıkça söyler (sklearn tanımı);
  kitapta bu açık değil.
- Dendrogram: kitap Iris (150 nokta, `truncate_mode="lastp"`) kullanır; sayfa 17 noktalık el
  yapımı veri kullanır. "En uzun dikey boşluk = doğal kesim" fikri aynıdır.
- Kitabın bağlantı tablosu (Ward / complete / single) sayfada average ile birlikte Lab'de
  denenebilir.

## Arayüzler

- Her sayfa mevcut `ConceptPage<Params>` sözleşmesini (`scenario`, `mountScene`, `mountParams`,
  gerekirse `mountExplainExtra`) sağlar; `StepPlayer` adım/tarama sözleşmesi değişmez; adım
  indeksleri `stepIndex` ile adım kimliklerinden türetilir.
- Kimlikler ve yollar: `dbscan` → `dbscan/`, başlık "DBSCAN"; `dendrogram` → `dendrogram/`,
  başlık "Hiyerarşik kümeleme ve dendrogram". Registry'deki iki `soon(...)` kaydı "hazır" olur
  (sıra: k-means, k-secimi, dbscan, dendrogram).
- Parametre adları (öneri, yapıcıya bırakılır): DBSCAN `{ eps: number; minSamples: number;
  point: number | null; spread: number }`; dendrogram `{ linkage: 'ward' | 'complete' |
  'average' | 'single'; merges: number; cut: number | null; point: number | null }`.

## Hata durumları

- min_samples = 2 ve küçük eps'te tek noktalı "küme" oluşmaz (DBSCAN tanımı gereği iki nokta
  gerekir); panel bunu doğru sayar.
- Hiç çekirdek yokken: "Çekirdek yok: bütün noktalar gürültü."
- Kesim çizgisi tam bir birleşme yüksekliğine denk gelirse: kesim o birleşmenin üstünde sayılır
  (scipy `fcluster(criterion="distance")` ile aynı: yükseklik ≤ t olan birleşmeler yapılır);
  kaydırıcı değerleri birleşme yüksekliklerine denk gelmeyecek biçimde de seçilebilir.
- Hiçbir durumda NaN / Infinity ekrana basılmaz.

## Doğrulama

- Birim: DBSCAN fonksiyonu sklearn fixture ızgarasına karşı; k-uzaklık değerleri; dendrogram
  geometrisi ve kesim → etiket fonksiyonu JSON'a karşı; senaryo adım kimlikleri ve parametreleri;
  sahne testleri (her adımın anahtar DOM öğesi: eps dairesi, komşu sayacı, tür işaretleri,
  kesim çizgisi, küme sayacı).
- e2e (yalın): her sayfa için Ders anahtar adımları (DBSCAN 4, 5, 6, 8, 10; dendrogram 2, 6, 8, 9)
  ve birer Lab etkileşimi (eps kaydırıcısı + nokta tıklama; bağlantı değişimi + kesim) ekran
  görüntüsü temeliyle; etiket çakışması ve sahne dışına taşma kontrolleri; 800×900 dar yerleşim
  kontrolü.
- Performans: DBSCAN Lab eps sürükleme ve dendrogram kesim sürükleme p95 ≤ 25 ms (bölüm sonunda
  bir kez).
- Kapanış: `npm run check` çıkış 0; kontrolcü ekran görüntülerine kendisi bakar.

## Yapıcı kontrolünden çıkan kararlar (benim kararlarım)

1. **Sayılar veriden gelir.** "Ön deneme" sayıları ve koordinatları yalnızca başlangıçtır.
   Ekrandaki her sayı JSON'dan okunur; testler JSON'a karşı yazılır, sabit sayıya değil.
   Üretici ilk görevdir ve ekran görüntüsü temelleri onun çıktısından sonra alınır. Üretici
   ölçütleri tutturamazsa tasarımı kendisi değiştirmez: durur ve hangi ölçütün tutmadığını
   raporlar.
2. **Yuvarlama tek kaynakta.** Üretici koordinatları önce 6 ondalığa yuvarlar, sonra bütün
   sklearn / scipy hesaplarını bu yuvarlanmış veride yapar; tarayıcı aynı sayıları kullanır.
   eps kaydırıcısı yalnız 0,01'lik ızgarada durur. Üretici ızgaradaki her eps için
   |uzaklık − eps| ≥ 1e-9 olduğunu doğrular; ihlal olursa durup raporlar (ızgaradan değer
   çıkarılmaz).
3. **Panel her zaman doğruyu söyler.** Okuma panelindeki komşu sayısı, karşılaştırma ve tür
   cümlesi canlı parametrelerden hesaplanır (Lab'de eps / min_samples değişince doğru kalır).
   Adım kartının metni Ders değerlerini anlatır. Adıma geçmek o adımın noktasını seçer
   (adım 3–4 A, 5 B, 6 C; 1–2 ve 7–10 seçim yok); kullanıcı aynı adımda başka bir noktaya
   tıklarsa seçim onun olur. K-Means sayfalarındaki kural budur.
4. **Bağlantı değişince küme sayısı korunur.** Kesim, yeni bağlantının ağacında aynı küme
   sayısının aralığının ortasına yeniden yerleşir. Kesim kaydırıcısının aralığı her bağlantının
   en büyük birleşme yüksekliğinden türetilir. Parametre küme sayısını (`k`) ya da yüksekliği
   tutabilir; ekranda ikisi de yazılır.
5. **Average bağlantısı yalnızca Lab'de.** Ders adımı ve adım 10 tablosu üç bağlantıdır
   (Ward, complete, single).
6. **Dendrogram adım 9 tek görünüm.** Aynı dendrogram Ward'dan single'a geçişle değişir;
   panel iki bağlantının 3 küme boylarını yan yana yazar. İki küçük ağaç çizilmez.
7. **k-uzaklık bükülmesi denetlenir.** Üretici min_samples = 5 eğrisinin bükülme noktasını
   (Kneedle ya da en büyük eğrilik) hesaplar ve JSON'a yazar; adım 10 hem bükülmeyi hem 0,3
   çizgisini işaretler. İkisi arasındaki fark 0,1'i aşarsa üretici durup raporlar.

## Yapıcıya bırakılanlar

- Dosya bölünmesi, parametre adları, panel iç düzeni, dendrogramın kapsayıcı çizimi (zarf ya da
  halka), tarama aralıkları, renk tonları (palet içinde).
- Üreticinin tek mi iki mi betik olacağı.
