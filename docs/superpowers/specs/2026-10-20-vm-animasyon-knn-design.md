# Veri Madenciliği Animasyonları — Site İskeleti ve k-NN Pilot Sayfası

**Tarih:** 2026-10-20
**Durum:** Tasarım (onay bekliyor)
**Kaynak kitap:** *Modern Veri Madenciliğine Giriş*, Prof. Dr. İsmail KIRBAŞ, 1. Baskı 2026.
Kitap projesi: `C:\projects\ModernVeriMadenGiris` (bölüm metinleri `chapters/<bölüm>/content/final.md`, bölüm kavramları `book_manifest.yaml` → `chapters[].key_concepts`).

---

## 1. Amaç ve gerekçe

Kitaptaki temel veri madenciliği kavramlarını **adım adım ilerleyen, parametreleri değiştirilebilen animasyonlu web sayfaları** olarak anlatmak.

Sayfalar iki şekilde kullanılacak:

1. **Derste:** Hoca projeksiyonda kavramı adım adım anlatır.
2. **Evde:** Öğrenci aynı sayfayı açar, parametrelerle oynar ve neyin nasıl değiştiğini kendi gözüyle görür.

Asıl hedef, kavramın **çok anlaşılır** biçimde görselleştirilmesi. Anlatımı yazı değil görsel taşıyacak.

Yayın GitHub Pages üzerinden olacak. Öğrenci yalnızca bir link açar; kurulum, giriş ya da sunucu yoktur.

## 2. Kapsam

### Bu teslimde (pilot)
- **Ortak iskelet:** Her kavram sayfasının kullanacağı yeniden kullanılabilir yapı (§4).
- **Ana sayfa:** Kavramlar kitabın bölüm sırasıyla kartlar halinde listelenir. Yalnızca k-NN aktif, diğerleri "yakında" görünür (§5).
- **k-NN sayfası** (§6).
- GitHub Actions ile GitHub Pages'e otomatik yayın.

### Sonraki teslimler (bu belgenin kapsamı dışında, iskeletin desteklemesi gereken)
Aynı kalıpla eklenecek aday kavramlar: K-Means, DBSCAN, dendrogram, karar ağacı (Gini/entropi), Naive Bayes, PCA, karmaşıklık matrisi ve ROC/eşik, çapraz doğrulama, Apriori, bootstrap/Random Forest, boosting, SMOTE, TF-IDF/kosinüs benzerliği, SHAP. Her biri ayrı bir tasarım/plan turu olacak.

### Kapsam dışı (non-goals)
- Kullanıcı girişi, ilerleme ya da not takibi.
- Quiz/sınav.
- Sunucu tarafı ve veritabanı.
- İngilizce arayüz (yalnızca Türkçe).
- Python kodu çalıştırma (sayfadaki hesaplar tarayıcıda TypeScript ile yapılır).

## 3. Kırmızı çizgiler (anti-goals)

Bunlardan biri olursa sayfa teknik olarak çalışsa bile **başarısız** sayılır (hocanın kendi ifadesi: *"animasyonlar yavaş ve takılırsa, yazılar küçük kalırsa"*):

1. **Akıcılık:** Animasyon ve parametre değişimleri, sıradan bir okul/ofis dizüstü bilgisayarında (entegre GPU) takılmadan akmalı. Hedef ~60 fps.
   - Slider sürüklenirken karar bölgeleri ve komşular gecikmeden güncellenmeli.
   - Karar bölgeleri binlerce SVG elemanıyla **çizilmemeli**. Canvas'a raster olarak çizilmeli, gerekirse çözünürlük düşürülüp ölçeklenmeli.
2. **Okunabilirlik:** Ders modunda bütün metin (eksen başlıkları, adım başlığı, oy sayıları, tahmin) arka sıradan okunabilmeli.
   - Referans projeksiyon çözünürlüğü **1280×720**.
   - Bu çözünürlükte Ders modunda gövde metni ≥ 22 px, adım başlığı ve tahmin ≥ 32 px, eksen etiketleri ≥ 18 px.
   - Laboratuvar modunda gövde metni ≥ 16 px.
   - Renk kontrastı WCAG AA.

## 4. Ortak iskelet (her kavram sayfası)

### Yerleşim
- **Üst çubuk:** Kavram adı, kitap atfı (ör. "Bölüm 5 · Sınıflandırmaya Giriş"), ana sayfaya dönüş ve sağ üstte **🎓 Ders / 🧪 Laboratuvar** mod düğmesi.
- **Sahne:** Animasyon alanı.
- **Adım oynatıcı:** ◀ geri, ▶ oynat/duraklat, ▶| ileri, tıklanabilir adım çubuğu ve "Adım 3 / 5" göstergesi.
- **Parametre paneli.**
- **Adım açıklama paneli:** Kısa başlık, 1–3 cümlelik açıklama ve kavrama özel ek içerik (k-NN'de uzaklık tablosu).

### Modlar
| | Ders modu | Laboratuvar modu |
|---|---|---|
| Amaç | Hoca projeksiyonda anlatır | Öğrenci tek başına keşfeder |
| Sahne | Ekranın neredeyse tamamı | Ekranın ~%60'ı |
| Yazı | Büyük (§3) | Normal |
| Açıklama paneli | Yalnızca adım başlığı (sahne üstünde ya da altında, büyük) | Başlık, açıklama ve tablo |
| Parametre paneli | Daraltılmış, açılabilir | Her zaman açık |
| Etkileşim | Klavye öncelikli | Fare/dokunma; sahneye tıklayıp nokta ekleme |

Mod seçimi URL'de tutulur (ör. `?mod=ders`). Hoca derse doğrudan Ders moduyla açılan bir link götürebilir.

### Klavye (her iki modda)
- `→` / `Boşluk`: sonraki adım
- `←`: önceki adım
- `P`: oynat/duraklat
- `F`: tam ekran
- `Home` / `End`: ilk/son adım

### Adım modeli
Her kavram, sıralı adımlardan oluşan bir "senaryo" tanımlar. Geri gitmek animasyonu tersine oynatmak zorunda değildir, önceki adımın son hâline geçmek yeterli. Parametre değişince geçerli adım korunur ve sahne o adımın yeni parametrelerle hâline geçer.

### Görsel kimlik (kitap kapağından)
- Lacivert `#14365C` (metin, vurgular)
- Turuncu `#F08A00` (ikinci sınıf / vurgu)
- Camgöbeği `#0EA5A4` (birinci sınıf)
- Açık zemin `#F6F9FC`

Sınıflar her zaman **renk + şekil** ile kodlanır. Renk körü öğrenciler ve siyah-beyaz çıktı için yalnızca renge güvenilmez.

Tipografi: sistem sans-serif (Segoe UI / system-ui). Harici font yüklenmez.

### Teknik (builder'ın kararı olarak belirlendi)
- Vite + TypeScript, D3 (ölçekler, geçişler) + SVG (noktalar, eksenler, çizgiler) + Canvas (karar bölgeleri).
- Çok sayfalı statik site; her kavram ayrı bir HTML girişi.
- GitHub Actions → GitHub Pages.
- Harici CDN yok, tüm varlıklar pakete gömülü.
- Sayfa bir kez yüklendikten sonra internet kesilse de çalışmaya devam etmeli.
- Hedef tarayıcılar: güncel Chrome, Edge, Firefox. Mobil açılmalı ama birincil hedef dizüstü bilgisayar ve projeksiyon.

## 5. Ana sayfa
- Kitap adı ve kısa tanıtım (kitabın kimliğiyle).
- Kitabın bölüm sırasıyla gruplanmış kavram kartları. Her kartta kavram adı, bölüm, küçük bir görsel ve durum (aktif/yakında).
- Pilotta yalnızca k-NN kartı aktif.

## 6. k-NN sayfası

**Kitap atfı:** Bölüm 5 — *Sınıflandırmaya Giriş: Karar Ağaçları, k-NN ve Naive Bayes*, "k-En Yakın Komşu (k-NN)" alt başlığı.

### Veri
- Kaynak: kitabın `datasets/telco_churn_synthetic.csv` dosyası (2000 satır, ~%26 ayrılan).
- Kullanılan sütunlar: `tenure` (sözleşme süresi, 1–72 ay), `MonthlyCharges` (aylık fatura, 18–120), `Churn` (Yes/No).
- Sayfada **40–60 müşteri** gösterilir. Örnek sabit tohumla (`random_seed=42`, kitapla tutarlı) seçilir ve derleme sırasında JSON olarak pakete gömülür.
- Örnek, iki sınıfın kısmen iç içe geçtiği, böylece k'nin etkisinin görülebildiği bir alt küme olmalı. Seçim kuralını builder belirler.

**İki veri görünümü (hocanın kararı):** Bu CSV'de `tenure` (std 20.9) ile `MonthlyCharges` (std 23.5) zaten neredeyse aynı ölçekte. Bu yüzden ölçekleme kapatılınca komşular pek değişmez ve "ölçekleme zorunlu" anı bu eksenlerle gösterilemez. Kitaptaki "aylık fatura baskın çıkar" iddiası bu CSV'den değil, bölüm kodundaki farklı bir sentetik örnekten gelir. Bu nedenle sayfada iki veri seti seçeneği bulunur:

| Veri seti | Eksenler | Kullanıldığı yer |
|---|---|---|
| **Sözleşme × Aylık fatura** (varsayılan) | `tenure` × `MonthlyCharges` | Ana anlatım, k ve Öklid/Manhattan anları |
| **Sözleşme × Toplam fatura** | `tenure` × `TotalCharges` (18–8609) | Ölçekleme anı. Ölçekleme kapalıyken toplam fatura mesafeyi tamamen ele geçirir. |

İki görünüm aynı müşteri örneğini kullanır, yalnızca dikey eksen değişir. Toplam faturanın kısmen süre × aylık faturadan türediği, Laboratuvar modundaki açıklamada bir cümleyle belirtilir.

### Terimler (kitapla uyumlu)
- Eksenler: "Sözleşme süresi (ay)", "Aylık fatura".
- Sınıflar: **Kaldı** (camgöbeği ●), **Ayrıldı** (turuncu ▲).
- Sorgulanan nokta: **Yeni müşteri** (◆, tahmin edilince sınıf rengini alır).
- Terimler ilk geçişte Türkçe, parantez içinde İngilizce verilir (kitabın terminoloji kuralı): "en yakın komşu (nearest neighbor)", "tembel öğrenme (lazy learning)".

### Adımlar
1. **Eğitim verisi:** Müşteriler belirir. Açıklama: k-NN eğitimde hiçbir şey öğrenmez, yalnızca veriyi saklar (tembel öğrenme).
2. **Yeni müşteri gelir:** ◆ sahneye girer.
3. **Uzaklıkları ölç:** Yeni müşteriden her noktaya çizgiler uzar. Laboratuvar modunda uzaklık tablosu küçükten büyüğe sıralanarak dolar.
4. **En yakın k komşuyu seç:** Diğer noktalar soluklaşır. Komşular kalın kenarlı görünür ve 1…k sıra numarası alır. Komşuluk sınırı çizilir: Öklid'de daire, Manhattan'da elmas.
5. **Oylama ve tahmin:** Oy çubuğu dolar (Kaldı: x / Ayrıldı: y), ◆ kazanan sınıfın rengini alır ve "Tahmin: AYRILACAK (3/5 oy)" yazısı çıkar.

**Gösteri adımları (hocanın kararı):** 5. adımdan sonra senaryo, "aha" anlarını sırayla gösteren hazır adımlarla devam eder. Her gösteri adımı kendi parametre değerlerini ve gerekirse yeni müşterinin konumunu belirler. Hoca yalnızca → tuşuna basar. Önerilen sıra:

6. **k = 1:** Karar bölgeleri açık. Tırtıklı, gürültüye duyarlı sınır.
7. **k büyüyor:** k 1 → 15 animasyonla artar, sınır yumuşar.
8. **Çok büyük k:** Azınlık sınıfı (Ayrıldı) yutulur.
9. **Öklid → Manhattan:** Yeni müşteri, iki ölçünün farklı komşu seçtiği önceden belirlenmiş bir konuma alınır. Komşuluk sınırı daireden elmasa döner.
10. **Toplam fatura veri setine geç, ölçekleme açık:** Komşular görünür.
11. **Ölçeklemeyi kapat:** Eksenler eşit birim ölçeğe geçer, komşular değişir, tahmin değişebilir.

Gösteri adımlarının kesin sayısı, metni ve önceden belirlenen konumlar builder'ın kararıdır. Konumlar, istenen etkinin gerçekten oluştuğu yerlerden seçilir ve testle doğrulanır.

**Ortak iskelete etkisi:** Adım modeli, bir adımın parametre değerlerini (ve sahneye özel durumu) "sahiplenmesine" izin vermelidir. Kullanıcı bir gösteri adımında parametreyi elle değiştirirse elle verilen değer geçerli olur. Adım değişince o adımın değerleri yeniden uygulanır. Sonraki kavram sayfaları da aynı modeli kullanır.

**Parametre kısayolları (ek olarak):** Hoca senaryo dışına çıkmak isterse diye:
- `+` / `-`: k
- `M`: Öklid/Manhattan
- `S`: ölçekleme
- `D`: veri seti
- `B`: karar bölgeleri

Kısayollar ekranın bir köşesinde `?` tuşuyla açılan küçük bir yardım kutusunda listelenir.

**Karar bölgeleri katmanı:** Arka planın her noktasının hangi sınıfa atanacağını hafif tonla gösterir. Varsayılan olarak 5. adımdan sonra açılır ve bir düğmeyle her an açılıp kapatılabilir. k değiştikçe sınırın yumuşadığını göstermenin ana aracı budur.

### Parametreler
| Parametre | Değerler | Varsayılan |
|---|---|---|
| k | 1–15 arası tek sayılar (slider) | 5 |
| Uzaklık ölçüsü | Öklid / Manhattan | Öklid |
| Oylama | Eşit / Uzaklığa göre ağırlıklı (1/d) | Eşit |
| Ölçekleme | Açık (StandardScaler) / Kapalı (ham değerler) | Açık |
| Karar bölgeleri | Göster / Gizle | Adıma bağlı (yukarıda) |

### Göstermesi gereken "aha" anları
- **k'nin etkisi:** k=1'de karar sınırı tırtıklı ve gürültüye duyarlı. k büyüdükçe sınır yumuşar. Çok büyük k'de azınlık sınıfı (Ayrıldı) yutulur. Kitaptaki yanlılık-varyans anlatımıyla bağlantılı.
- **Öklid ve Manhattan:** Komşuluk sınırının daireden elmasa dönüşmesi ve iki ölçünün farklı komşular seçtiği bir durum.
- **Ölçeklemenin zorunluluğu:** "Sözleşme × Toplam fatura" veri setinde ölçekleme kapatıldığında mesafede toplam faturanın baskın çıkması ve komşuların değişmesi.
  - Ölçekleme kapalıyken grafiğin eksenleri **eşit birim ölçekli** (1 ay = 1 TL) çizilir. Böylece mesafenin hangi yöne "sıkıştığı" gözle görülür.
  - Açıkken eksenler standartlaştırılmış birimlerdedir. Geçiş animasyonlu olmalı.
  - Kitapta bu nokta özellikle vurgulanıyor: "k-NN mesafe tabanlı olduğu için öznitelikleri aynı ölçeğe getirmek ZORUNLUDUR".

### Laboratuvar modu etkileşimleri
- Sahneye tıklamak yeni müşteriyi oraya taşır ve senaryo 2. adımdan yeniden başlar (ya da "anında sonuç" görünümünde doğrudan 5. adıma geçer, bu da açılıp kapanabilir).
- Yeni müşteri sürüklenebilir. Sürüklerken komşular, komşuluk sınırı ve oylama canlı güncellenir.

## 7. Başarı ölçütleri
- Hoca, Ders modunda yalnızca klavyeyle (→ / ←) k-NN'i, gösteri adımları dahil baştan sona anlatabiliyor. 1280×720 projeksiyonda tüm yazılar okunuyor (§3).
- Öğrenci, Laboratuvar modunda yazılı açıklama okumadan bile k'yi değiştirerek sınırın yumuşadığını, Öklid/Manhattan geçişinde sınırın şeklinin değiştiğini ve ölçekleme kapanınca komşuların değiştiğini görebiliyor.
- Slider sürüklemesi ve nokta sürükleme takılmadan akıyor (§3).
- Yeni bir kavram sayfası eklemek, iskelete dokunmadan yalnızca o kavramın senaryosunu, sahnesini ve parametrelerini yazmayı gerektiriyor.
- Hesaplanan komşular ve tahminler, aynı veri ve parametrelerle scikit-learn `KNeighborsClassifier` ile aynı sonucu veriyor. Bu, birim testleriyle sabit beklenen değerler üzerinden doğrulanır.

## 8. Builder'a bırakılanlar
- Dosya/klasör yapısı, bileşen sınırları, durum yönetimi.
- Örnek müşteri seçim kuralı (§6 Veri koşullarını sağlamak şartıyla).
- Animasyon süreleri ve easing.
- Ana sayfa kartlarındaki küçük görsellerin biçimi.
- Ortak iskeletin API'si (§6'daki adım-parametre modeli şartıyla).
- `.superpowers/` klasörünün `.gitignore`'a eklenmesi.

## 9. Tasarımcının kararları (hoca onaylamadı, kontrol için listelendi)
- **Teknoloji:** Vite + TypeScript + D3/SVG/Canvas. GitHub Actions ile Pages'e yayın. Vite `base` yolu depo adına göre ayarlanır.
- **Görünüm ayrıntıları:** Kitap kapağı renkleri ve sınıf eşlemesi (camgöbeği ● Kaldı, turuncu ▲ Ayrıldı). Sistem fontu.
- **Sayılar:** §3'teki sayısal okunabilirlik ve akıcılık eşikleri.
- **Parametreler:** Seçim aralıkları ve varsayılanları (k tek sayılar 1–15, varsayılan 5).
- **Ölçekleyici:** StandardScaler, sayfada gösterilen müşteri örneği üzerinde fit edilir. Burada eğitim-test ayrımı anlatılmadığı için sızıntı konusu bu sayfanın kapsamı dışında.
- **Eşitlik bozma:** Eşit uzaklıkta scikit-learn'deki gibi veri sırası kullanılır. Eşit oyda (k tek olduğu için yalnızca ağırlıklı oylamada olası) daha küçük sınıf etiketi seçilir, scikit-learn ile tutarlı.
- **Ağırlıklı oylama görünümü:** Oy çubuğu ağırlık toplamlarını gösterir. Laboratuvar tablosunda her komşunun ağırlığı (1/d) da yazar.
- **Mod hatırlama:** Mod URL ile seçilir. Kalıcı tercih saklanmaz.
