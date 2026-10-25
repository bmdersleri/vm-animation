# Bölüm 1 ve 14 — CRISP-DM döngüsü ve model kayması — Tasarım

- **Tarih:** 2026-10-25
- **Kaynak:** Öğretmen: "önerilerin kabul edildi bitirdikten sonra merge + push" (Bölüm 1 ve 14 için
  birer sayfa önerisi). Kitabın `ch01_giris_crisp_dm/content/final.md` ve
  `ch14_buyuk_veri_mlops_etik/content/final.md` bölümleri (salt okunur).
- **Yetki:** Bütün tasarım kararları benimdir (aşağıda "Benim kararım"). Kararlar ledger'da
  `Ruling:` satırı olarak da durur ve iş sonunda öğretmene listelenir. Bu dalga için yayın onayı
  verildi: `npm run check` yeşilse iş sonunda main'e merge + push.
- **Önceki tasarımlar:** Bölüm 13 (`2026-10-25-bolum13-xai-design.md`) biçim ve görünüm kurallarının
  kaynağıdır. İki sayfa farklı bölümlerden gelir; ortak veri yoktur, ortak yalnız bir sahne parçası
  vardır (akış grafiği, aşağıda).
- **Ön deneme (2026-10-25, Python 3, numpy 2.5.2, scikit-learn 1.9.0, pandas 3.0.5; geçici betikler,
  depoya girmez):**
  - Kitabın sayıları: `[45, 51, 54, 62, 67]` ortalaması 55,80; `[58, 64, 71, 76, 82]` ortalaması
    70,20; fark 14,40 > 8,0 → UYARI (kitabın kod03 çıktısı). Mini uygulama `[45, 51, 54]` /
    `[65, 71, 78]` → 21,33 (kitapla aynı). Hata ayıklama kodunda `"12.5" > 10` →
    `TypeError: '>' not supported between instances of 'str' and 'int'`.
  - Kitabın kafe verileri (pandas): 4 satırlık `kafeVerisi`'nde `groupby("sinav_haftasi")` 68,5 /
    70,0 (kahve ile sandviç karışık); `satisKayitlari` 63,5 / 70,5 (kitapla aynı); `hamVeri`
    temizliğinde Kahve ortalaması `fillna(0)` ile 40,0, eksik atlanınca 80,0 (genel 38,33 / 57,5);
    düzeltilmiş `KafeAnalizi` ortalama 90,0, kayıt sayısı 2 (ortalamaya giren değer 1).
  - Kayma verisi (aşağıdaki üretim kuralı, tohum 5): referans ortalaması 66,84, std 14,70, ayrılma
    oranı 0,322; model (`LogisticRegression`, yalnız aylık ücret) katsayı 0,0534, kesişim −4,413;
    referans doğruluğu 0,701. Ortalama farkı eşiği 8: "kayma yok"ta 0 yanlış alarm, eşik 4'te 4
    (ay 10, 21, 22, 23: mevsim); "ani kayma"da ay 15'te alarm (fark 15,73, gecikme 0); "yavaş
    kayma"da eşik 4 → gecikme 2 ay, 8 → 10 ay, 12 → kaçırıldı; "yalnız yayılım"da 15–24. aylarda
    fark en çok 4,96 (ay 18'de 0,09) ama PSI 0,46–0,74 (ay 18: 0,582); "kavram kayması"nda fark ve
    PSI hiç eşiği aşmaz, doğruluk 15. aydan sonra 0,57–0,63 (referans 0,701). Kavram kaymasında
    15–24. ayların yeniden uydurulmuş eğrisinin katsayısı −0,0242 (işaret döner), ayrılma oranı
    0,307 (neredeyse aynı).
  - Kafe verisi (aşağıdaki üretim kuralı, tohum 4): eğitimdeki 14 sınav gününün hepsinde stok
    tükenir; "satış = talep" ile sınav ortalaması tam 50,00, "satış + soran" ile 59,00 (gerçek
    talep ortalaması 59,79); eksikler 0 yapılınca sınav ortalaması 50,57. Test (14 gün): sabit 50
    siparişin israf oranı %10,9, kaçan talep %11,5. 56 gün + eksik çıkar + satış = talep: israf
    %55 düşer ama kaçan talep %6,5 → koşul tutmaz; satış + soran: israf %30 düşer, kaçan %0,0 →
    tutar; aynısı sızıntılı: değerlendirme %69 düşüş / %1,1 kaçan (tutar), yaygınlaştırma israfı
    %42 artırır (tutmaz); 4 ve 14 gün: hiç sınav günü yok → "Veri yeterli mi? Hayır".
  - Tohumlar üreticinin rastgele sayı çekme sırasına bağlıdır; üretici aşağıdaki denetimlerin
    hepsini geçen en küçük tohumu (0'dan başlayarak) bir kez arar, sabit yazar ve veriye kaydeder.

## Amaç ve kabul ölçütleri

Öğrenci dört şeyi kavramalı:

1. **CRISP-DM doğrusal değil, döngüseldir.** Altı evre bir çemberdir; iki karar düğümü
   ("Veri yeterli mi?", "Sonuç uygun mu?") projeyi geri gönderir; yaygınlaştırmadan sonra döngü
   iş anlamaya döner. Modelleme ilk evre değildir.
2. **Veri bağlamıyla okunur.** Satış talep değildir (stok tükenince alt sınırdır); eksik kayıt sıfır
   değildir; tahmin anında bilinmeyen alan (sızıntı) değerlendirmeyi güzel, sahayı kötü yapar;
   başarı ölçütü baştan yazılır ve tek ölçüt yanıltabilir.
3. **Model zamanla bozulabilir; izleme bir eşik kararıdır.** Referans ile güncel dönem
   karşılaştırılır (ortalama farkı, PSI); eşik tarihsel dalgalanma, gecikme ve yanlış alarm
   maliyetiyle seçilir; ortalama dağılım biçimini kaçırır.
4. **Veri kayması ile kavram kayması farklıdır.** Girdi izleme P(X)'i görür; P(Y|X) değişirse girdi
   sessiz kalır, ancak gecikmeli gelen etiketle doğruluk düşüşü görülür. Alarm otomatik yeniden
   eğitim emri değil, insan incelemesinin başlangıcıdır.

Kabul ölçütleri:

1. İki yeni sayfa yayında: `crisp-dm/` ("CRISP-DM döngüsü: altı evre ve geri dönüşler", 10 adım,
   Bölüm 1) ve `model-kaymasi/` ("Model kayması ve izleme eşiği", 10 adım, Bölüm 14); ikisi de Ders
   ve Laboratuvar modunda çalışır. Ana sayfada 32 kavram, 32 hazır, 0 yakında.
2. Ekrandaki her sayı (ortalamalar, farklar, PSI ve terimleri, doğruluklar, alarm ayları, yanlış
   alarm sayısı, gecikme, grup ortalamaları, sipariş miktarları, israf oranı, kaçan talep, düşüş
   yüzdesi, gün sayıları) üreticinin pandas / scikit-learn ile yazdığı veriden gelir ya da
   tarayıcıda o veriden hesaplanır ve birim testinde fixture'la doğrulanır. Kitabın sayıları
   (55,80 / 70,20 / 14,40 / UYARI; 21,33; 63,5 / 70,5; 80,0 / 40,0; 90,0 / 2) üreticide denetlenir;
   tutmazsa üretici durur.
3. Her hesap sayılarıyla da yazılır ("fark = |70,20 − 55,80| = 14,40 > 8,0", "PSI = 0,153 + 0,001 +
   … = 0,582", "israf oranı = atılan / hazırlanan" sayılarıyla).
4. 1280×720'de Ders ve Lab adımlarında yazı yazının üstüne binmez, hiçbir şey kırpılmaz; sahne
   genişliği 900 px altında tek sütun (`data-narrow`, sahnenin kendi genişliğinden), 390 px'te yatay
   taşma yok ve sahne oynatıcı çubuğunun altında kalmaz (`dar-ekran.spec.ts` hazır sayfaları kayıt
   defterinden otomatik kapsar).
5. Alarm ve "tutmadı" durumları renkten bağımsız da okunur (metin ve şekil).
6. `npm run check` yeşil; kontrolcü ekran görüntülerine kendisi bakar.

## Kararlar

| Konu | Karar | Kimin |
|---|---|---|
| Sayfalar | Bölüm başına bir sayfa: `crisp-dm` (Bölüm 1) ve `model-kaymasi` (Bölüm 14) | Öğretmen onayı (öneri) |
| Kayıt defteri | `CH[1]` = "Modern Veri Madenciliğine Giriş ve CRISP-DM Metodolojisi", `CH[14]` = "Büyük Veri, MLOps Temelleri, Etik ve Veri Gizliliği" (kitabın başlıkları); `crisp-dm` kaydı listenin başına, `model-kaymasi` sonuna; `soon` yardımcısı kullanılmadan kalır | Benim kararım |
| Veri ve üretici | Ortak veri yok: `scripts/make_crisp_data.py` → `src/concepts/crisp-dm/data/crisp.json`; `scripts/make_kayma_data.py` → `src/concepts/model-kaymasi/data/kayma.json`. Diğer üreticilerin kalıbı (`--check`, iki çalıştırmada bayt bayt aynı, sürümler dosyada); `scripts/requirements.txt` değişmez | Benim kararım: iki sayfa farklı bölümlerden, paylaşacak sayı yok |
| Tohum | Her üretici, denetimlerinin hepsini geçen en küçük tohumu bir kez arar, sabit yazar ve `meta.seed` olarak kaydeder; veri tohuma göre bükülmez | Benim kararım: çekme sırası yapıcıya kalır, denetimler sabittir |
| Ortak parça | Yeni `src/core/plot/flow-graph.ts` (`FlowGraphLayer`): kutu ve eşkenar dörtgen düğümler, etiketli ileri / geri / dış kenarlar, bir jeton, vurgulu yol. Sayfa B'nin döngüsü ve Sayfa A adım 9'un alarm akışı (Şekil 14.4) kullanır. Diğerleri mevcut parçalar: `NumberLineLayer`, `LineChartLayer`, `HBarsLayer`, `AxesLayer`, `code-panel.ts`, formül şeridi (`strip.ts`), `label-place`, `format` | AGENTS.md ortak parça kuralı |
| Histogram | Sayfa A'nın üst üste iki dönem histogramı sayfaya özgüdür; yapıcı önce `dagilim-carpiklik/scene-hist.ts`'e bakar, uygunsa `src/core/plot/`'a taşır | AGENTS.md ortak parça kuralı |
| Renkler | Referans dönem lacivert (`NAVY`), güncel dönem turuncu (`MARK[1]` / yazıda `ACCENT`); eşik çizgisi kesikli lacivert; alarm `NEGATIVE` kırmızı + "UYARI" yazısı + üçgen işaret; normal ay içi boş daire + "NORMAL". Sayfa B: geçerli evre lacivert dolgu; geri kenar turuncu kesikli + "Hayır" etiketi; dış döngü gri kesikli; ölçüt ✓ / ✗ işareti + "tutar" / "tutmaz" yazısı. XAI'nin turuncu / mavi katkı kuralı burada geçmez | Benim kararım |
| Birim | Aylık ücret para birimsiz yazılır (kitap birim vermez); 2 ondalık | Benim kararım |
| Sayfa A adım düzeni | Kısa önerinin 2. ve 3. adımı birleşir (iki dönem tek adımda, tarama ile); adım 9 alarm akışı (Şekil 14.4), adım 10 hata ayıklama; toplam 10 adım | Benim kararım: hata ayıklama ile akış tek adıma sığmaz |
| Kayma verisi | 24 ay, ayda 250 müşteri; referans aylar 1–6 (model bunlarla eğitilir), izleme ayları 7–24. Aylık ücret = round(clip(μ(ay) + σ(ay) · z, 18, 120), 2); μ = 65 + 2,5 · sin(2π(ay − 1) / 12) (mevsim), σ = 15. Beş senaryo **ortak rastgele sayılarla** üretilir: z ve etiket için u her ay bütün senaryolarda aynıdır; senaryolar yalnız kayma başladıktan sonra ayrışır | Benim kararım: aynı referans, aynı model; fark yalnız senaryodan gelir |
| Senaryolar | `yok`; `ani` (ay 15'ten itibaren μ + 14); `yavas` (ay 13'ten itibaren μ + 1,2 · (ay − 12)); `yayilim` (ay 15'ten itibaren σ = 30, μ aynı); `kavram` (ay 15'ten itibaren P(ayrılma \| ücret) değişir, ücret dağılımı aynı). Değişim ayı: `ani`, `yayilim`, `kavram` 15; `yavas` 13; `yok` yok | Benim kararım |
| Ayrılma ilişkisi | Eski: p = σ(−5,2 + 0,065 · ücret); yeni (kavram): p = σ(0,8 − 0,025 · ücret) ("rakibin ucuz tarifesi düşük ücretlileri çeker"); etiket = u < p | Benim kararım: kavram kaymasında oran neredeyse aynı kalırken yön döner |
| Model | `LogisticRegression()` (varsayılanlar), tek girdi aylık ücret, referans aylarının 1500 müşterisiyle; karar eşiği 0,5. Aylık doğruluk o ayın 250 müşterisinde | Benim kararım |
| Etiket gecikmesi ve başarım alarmı | Etiket 3 ay gecikir (ay m'nin doğruluğu ay m + 3'te bilinir). Başarım alarmı: doğruluk < referans doğruluğu − 0,05; sabittir, kaydırıcı değildir | Benim kararım (kitap: "Başarım etiketi gecikmeli geliyorsa…") |
| Alarm kuralı | Kitabın kuralı: değer > eşik (kesin büyük). Yalnız izleme ayları (7–24) sayılır. Yanlış alarm: değişim ayından önceki (ya da `yok`ta her) alarm ayı. Gecikme: değişim ayında ya da sonrasındaki ilk alarm ayı − değişim ayı; yoksa "kaçırıldı" | Benim kararım |
| PSI | Bölmeler: referansın 1500 değerinin onda birlikleri (9 iç sınır, uçlar açık) → her bölmede pᵢ = 0,1. Boş bölmede qᵢ 0,0001'e yükseltilir (yalnız ln içinde değil, terimin tamamında). Doğal logaritma. 0,1 / 0,25 sınırları yalnız "yaygın uygulama (kitapta sınır yok)" etiketiyle gösterilir; Lab'de PSI eşiği varsayılanı 0,25 | Kitap formülü; sınırlar benim kararım |
| Ekran histogramı | 5 birim genişlikli 22 bölme (15–125); PSI bölmelerinden ayrı | Benim kararım |
| Alarm akışı (adım 9) | Şekil 14.4'ün üç nedeni (veri kalitesi, kavram kayması, adillik / gizlilik) ve kitabın Kuramsal Çerçeve metnindeki "mevsimsel etki" dördüncü dal olarak | Benim kararım |
| Kafe verisi | 2026-03-06 – 2026-05-14 (70 gün, haftanın her günü). Eğitim havuzu ilk 56 gün (06.03–30.04), test son 14 gün (01.05–14.05). Talep = round(40 + 20 · sınav + ay düzeyi + ε), ε ~ N(0, 3); ay düzeyi Mart −5, Nisan +5, Mayıs 0. Sınav haftaları (Pzt–Paz) 23–29.03, 20–26.04, 04–10.05. Üretici talebi ayların bütün günleri için (01.03–31.05) üretir; tabloya yalnız 70 gün girer | Benim kararım |
| Eski sipariş | Kafe bugüne dek her gün 50 sandviç hazırlamış: satış = min(talep, 50), stok_tukendi = talep ≥ 50. Bu aynı zamanda "her gün aynı miktar" karşılaştırma tabanıdır | Benim kararım |
| Stok tükenmesi | Kasada "tükenince soran müşteri" çetelesi tutulur: soran ~ Binom(talep − 50, 0,9). Lab seçeneği "satış = talep say" ya da "tükenen günde satış alt sınır: talep ≈ satış + soran" (yine alt sınır, çünkü her müşteri sormaz) | Benim kararım: "alt sınır" bir sayıya dönüşmeli; kitabın önerisi ("stokta yok bilgisini veri kümesine eklemek") bu |
| Eksik kayıt | Eğitim havuzunda 2 sınav günü ve 2 normal gün `satis_adedi` boş (kasa arızası); sınav günlerinin hepsi stok tükenen gün olduğundan eksik, kitabın beşinci tuzağındaki gibi tükenen günlere düşer. Seçenek: "0 ile doldur" ya da "işaretle ve çıkar" | Benim kararım |
| Sipariş kuralı | `LinearRegression` girdi `sinav_haftasi` (0/1) [+ `ay_sonu_israfi`]; sızıntısız hâli grup ortalamalarıyla aynıdır. Sipariş = round(1,10 · tahmin) | Benim kararım: Ders adım 7'nin grup ortalaması ile Lab aynı kural |
| Başarı ölçütü | (1) Kitabın ölçütü: test penceresinde israf oranı (atılan / hazırlanan) tabana göre en az %15 düşer. (2) Hizmet koşulu: kaçan talep (karşılanamayan / toplam talep) en çok %3. İkisi tutarsa "Sonuç uygun mu? Evet" | (1) kitap; (2) benim kararım: israfı yalnız ölçmek az siparişi ödüllendirir (kitap: "yetersiz sipariş … kaçırılan satış") |
| Test penceresi | Aylık ölçüt 14 günlük test penceresinde oranla ölçülür; gerçek talep simülasyonda bilindiği için test günlerinde israf ve kaçan talep hesaplanır | Benim kararım |
| "Veri yeterli mi?" | Kullanılabilir gün sayısı sınav ve normal grupların her birinde en az 5 ise Evet (kitabın dördüncü tuzağı: örneklem büyüklüğü) | Benim kararım |
| Sızıntı | `ay_sonu_israfi` = ayın bütün günlerinde eski 50'lik siparişin israfı (ay bitince kesinleşir). Değerlendirmede test günlerine kendi ayının (Mayıs) değeri girer; yaygınlaştırmada tahmin anında Mayıs bilinmez, son kesinleşen ayın (Nisan) değeri girer. Sızıntısız kuralda değerlendirme = yaygınlaştırma | Benim kararım |
| Lab yolu | Lab her seçim için döngüde tek turu çizer: hangi karar düğümü geri gönderdi ya da yaygınlaştırmaya varıldı mı; tur saymaz. Çok turlu hikâye Ders'tedir (3 tur) | Benim kararım: seçimler sabitken ikinci tur aynı sonucu verir |
| Hava durumu | Veride ve kuralda yok; adım 1 kartı kitaptaki gibi anar | Benim kararım: dört günlük seçenek tek etkeni bile zor taşır |
| Sayfa B adım 10 | Kitabın `KafeAnalizi` hata ayıklaması (kod paneli); "modelleme evresinden başlamak" hatası adım 2'nin şeridinde | Benim kararım |

## Kapsam dışı

- Bölüm 14'ün büyük veri (parça tabanlı okuma), MLOps sürüm günlüğü, adillik ve KVKK kısımları
  (yalnız adım 9'un "adillik / gizlilik" dalında ve adım 10'un telefon numarası hatasında birer
  cümle). KS testi, sınıflandırıcı tabanlı kayma, kalibrasyon kayması, segment izleme (adım 7
  kartında bir cümle).
- Bölüm 1'in KDD, Jupyter / sanal ortam ve veri türü (tarih sütunu) kısımları.
- Tarayıcıda model eğitimi, kullanıcının elle girdiği veri; sınav / test soruları (proje kapsam
  dışı); kitabın düzeltilmesi (yalnız "Kitapla farklar").

## Ortak öğretim dili ve görünüm

Bölüm 9–13 kuralları aynen: metin boyutları yalnız `--fs-*` belirteçlerinden; SVG'lerde viewBox
yok; sayılar Türkçe ondalık virgülüyle (aylık ücret ve ortalamalar 2 ondalık; PSI ve terimleri 3
ondalık; doğruluk yüzde 1 ondalık; israf oranı, kaçan talep ve düşüş yüzde 1 ondalık; sandviç
sayıları tam sayı, grup ortalamaları 2 ondalık); hesaplanan sayıdan sonra kesme işaretli ek yok
("14 gün", "4 yanlış alarm"); tarama bitince taranan değer son değerinde kalır;
`prefers-reduced-motion` altında son durum anında çizilir (jeton atlamadan yerinde, kenar
vurgusu animasyonsuz); adım kartı Lab'de `labText` gösterir; etkileşimli sahne öğeleri yalnız
Lab'de. Kod adları (`isHedefi`, `ay_sonu_israfi`, `esik`) kod yazı tipinde. Aylar "ay 15",
günler "6 Mart" biçiminde.

Akış grafiği (`src/core/plot/flow-graph.ts`):

- `FlowNode { id; label: string[]; kind: 'phase' | 'decision' | 'end'; x; y }` (konumlar sayfanın
  yerleşim işlevinden, piksel); `FlowEdge { id; from; to; kind: 'forward' | 'back' | 'outer';
  label?; bend? }`; `FlowGraphSpec { nodes; edges; current?: string; path?: string[]; dim?: string[] }`.
- Düğüm `g.flow-node[data-node]` (`.is-current`, `.is-dim`), kenar `path.flow-edge[data-edge]`
  (`.is-path`, `.kind-back`, `.kind-outer`), jeton `circle.flow-token`. Jeton bir kenar boyunca
  `tr()` geçişiyle yürür; azaltılmış harekette doğrudan yerine konur.
- Kenar etiketleri `label-place` ile çakışmasız konur; düğüm etiketleri `TextMeasure` ile ölçülür.

## Sayfa A — Model kayması ve izleme eşiği (`model-kaymasi/`)

### Öğrenme sonucu

Öğrenci kitabın iki dönemini ortalama farkı ve eşikle karşılaştırır; veri kayması ile kavram
kaymasını aynı aylık ücret ekseninde ayırt eder; 24 aylık izlemede alarmları, mevsimsel yanlış
alarmları ve etiket gecikmesini görür; eşiğin yanlış alarm ile geç yakalama arasındaki bedelini
sayar; ortalamanın kaçırdığı yayılım değişimini PSI'nin bölme terimleriyle yakalar; alarmın insan
incelemesine giden bir sinyal olduğunu ve kitabın hata ayıklama kodundaki hataları görür.

### Veri (`src/concepts/model-kaymasi/data/kayma.json`, yalnız üretici yazar)

- `meta`: tohum, sürümler, sabitler (ay sayısı 24, ayda 250, referans ayları 6, değişim ayları,
  etiket gecikmesi 3, başarım payı 0,05, PSI tabanı 0,0001, ekran histogramı sınırları).
- `book`: iki liste, iki ortalama, fark, `esik` 8,0, durum "UYARI" (Python'un `statistics.mean` ve
  kod03 kuralıyla); mini uygulamanın farkı 21,33 (yalnız denetim için).
- `reference`: ortalama, std, n, PSI iç sınırları (9), ekran histogramı sayımları (22), model
  katsayısı ve kesişimi, referans doğruluğu, ayrılma oranı.
- `scenarios` (5; `id`, ad, değişim ayı): her ay için ortalama, std, ortalama farkı, PSI bölme
  sayımları (10), PSI, ekran histogramı sayımları (22), doğruluk, ayrılma oranı.
- `curves`: `ani` ve `kavram` için 15–24. ayların müşterileriyle yeniden uydurulmuş lojistik eğri
  (katsayı, kesişim, ayrılma oranı) — adım 4 bunu referans modelin eğrisiyle yan yana çizer.
- `spreadMonth`: `yayilim`'da 15–24. aylardan ortalama farkı en küçük ay (adım 7–8 bunu gösterir).
- Fixture `tests/fixtures/kayma_sklearn.json`: her senaryo-ay için tam duyarlıkla ortalama farkı,
  PSI, doğruluk; model parametreleri; `curves`.

Üretici denetimleri (`scripts/make_kayma_data.py`; tutmazsa durur ve hangi denetimin tutmadığını
yazar): kitabın sayıları (55,80 / 70,20 / 14,40 / UYARI; 21,33); PSI sayımlardan yeniden hesaplanınca
aynı (1e-12); ortalama farkı eşiği 8'de `yok` 0 yanlış alarm, eşik 4'te en az 2; `ani` eşik 8'de
gecikme 0 ve 0 yanlış alarm; `yavas` eşik 4'ün gecikmesi < eşik 8'in gecikmesi, eşik 12 kaçırır;
`yayilim` 15–24. aylarda ortalama farkı < 8 ve PSI ≥ 0,25; `kavram` bütün aylarda ortalama farkı
< 8 ve PSI < 0,25, 15–24. ayların hepsinde doğruluk < referans − 0,05; bütün senaryolarda 7–14.
aylarda doğruluk ≥ referans − 0,05.

### Hesap (saf TS, `src/concepts/model-kaymasi/calc.ts`)

- `mean(xs)`, `meanDiff(ref, cur)` = |X̄g − X̄r|; `status(diff, esik)` → `'UYARI' | 'NORMAL'`
  (kesin büyük).
- `psiTerms(counts, n, eps = 1e-4)` → her bölme için `{ p: 0.1, q, term }`; `psi(counts, n)` = Σ.
- `alarmMonths(values, threshold, from = 7)` → değeri eşikten büyük aylar.
- `falseAlarms(alarms, changeMonth)`, `detectionDelay(alarms, changeMonth)` → sayı ya da `null`
  ("kaçırıldı").
- `accuracyAlarm(acc, refAcc, margin = 0.05, delay = 3)` → `{ month, knownAt } | null` (ilk düşük
  ay ve bilindiği ay).
- Birim testleri: kitabın sayıları; `psi` 5 senaryo × 24 ayda fixture'la 1e-12; alarm, yanlış alarm
  ve gecikme üreticinin denetlediği durumlarda (eşik 4 / 8 / 12, PSI 0,25); `accuracyAlarm`
  `kavram`da ay 15 / bilinme 18.

### Görünüm

Adım 1'de **zaman şeridi** (24 ay; 1–6 "referans: model burada eğitildi" bandı, 7–24 "izleme").
Adım 2–3'te **sayı doğrusu** (`NumberLineLayer`, 40–90): referans noktaları lacivert, güncel
noktalar turuncu, iki ortalama kısa dikey çizgi, aralarında fark köprüsü; adım 3'te altında
**eşik doğrusu** (0–20; 14,40 işareti, 8,0 eşik çizgisi, "UYARI" rozeti). Adım 4'te **iki panel**
(veri kayması / kavram kayması), her panelde üstte histogram (referans ile 15–24. aylar), altta
ayrılma olasılığı eğrisi (referans modeli ile yeniden uydurulan). Adım 5–6'da **izleme grafiği**
(`LineChartLayer`: aylık metrik çizgisi, eşik çizgisi, referans bandı, alarm aylarında üçgen +
"UYARI") ve altında aynı x eksenli **doğruluk şeridi** (bilinmeyen aylar kesikli çerçeve "etiket
bekleniyor"); adım 6'da yanında **eşik tablosu**. Adım 7'de histogram çifti ve iki sayı kutusu
(ortalama farkı, std). Adım 8'de **PSI çubukları** (`HBarsLayer`, 10 bölme: p, q, terim) ve formül
şeridi. Adım 9'da **alarm akışı** (`FlowGraphLayer`). Adım 10'da **kod paneli**.

### Adımlar (Ders)

1. **Altı ay sonra da çalışacak mı?** Kitabın açılış sorusu: "Bu model altı ay sonra da aynı
   güvenilirlikte çalışacak mı?" Zaman şeridi: model ay 1–6'da (referans) eğitildi; sonrası
   izleme. Telco Churn bağlamı; izlenen öznitelik aylık ücret.
2. **İki dönem.** Tarama: önce referans `[45, 51, 54, 62, 67]` noktaları ve ortalaması 55,80, sonra
   güncel `[58, 64, 71, 76, 82]` ve 70,20 (veriden; kitabın Şekil 14.2'si). Kitabın kod03 satırları
   şeritte.
3. **Fark ve eşik.** Formül şeridi `fark = |X̄g − X̄r|` = |70,20 − 55,80| = 14,40; `esik = 8.0`;
   14,40 > 8,0 → "UYARI" (rozet + metin). Kitabın çıktısı `Kayma farkı: 14.40 | Durum: UYARI`.
   Not: "Mutlak fark yönü değil büyüklüğü ölçer; tek başına bozulmayı kanıtlamaz."
4. **Veri kayması ile kavram kayması.** Sol panel (`ani`): ücret histogramı sağa kayar, eğri
   (P(ayrılma | ücret)) yerinde kalır → veri kayması, P(X) değişti. Sağ panel (`kavram`):
   histogram aynı, eğri döner (katsayı 0,053 → −0,024, veriden) → kavram kayması, P(Y | X)
   değişti (kitabın İzleme ve Yönetişim tanımı). "Kitabın kod03'ü girdiyi izler: veri kaymasını
   görür."
5. **Aylık izleme ve etiket gecikmesi.** `ani` senaryosu, ortalama farkı, eşik 8. Tarama: "bugün"
   imleci ay 7'den 24'e yürür; metrik noktası aynı ay, doğruluk noktası 3 ay sonra belirir. Ay
   15'te alarm (fark 15,73, veriden); 7–14 arası mevsim dalgası eşiğin altında. Kitabın tavsiyesi
   şeritte: "Etiket gecikmeli geliyorsa önce girdi kayması, etiket gelince başarım izlenir."
6. **Eşiği seçmek.** `yok` ve `yavas` senaryoları; eşik 4 → 8 → 12 taranır (eşik çizgisi iner
   kalkar); tablo: eşik, `yok`ta yanlış alarm, `yavas`ta gecikme (veriden: 4 / 0 / 0 yanlış alarm;
   2 / 10 ay / kaçırıldı). Kitabın "Yaygın hatalar"ı: eşik tarihsel dalgalanma, iş riski ve yanlış
   alarm maliyetiyle seçilir; referans aylarının kendi aylık dalgalanmasının en büyüğü yazılı
   (veriden).
7. **Ortalama yanıltır.** `yayilim` senaryosu, `spreadMonth` (ön denemede ay 18): ortalama farkı
   0,09 (veriden), histogram iki yana açılmış, std 14,70 → 28,07. Kitabın tablosu: "Ortalama
   farkı — Dağılım biçimini kaçırabilir." Kartta bir cümle: segmentler ayrı izlenir, KS testi bir
   başka seçenektir.
8. **PSI.** Aynı ay; formül şeridi kitabın `PSI = Σ (qᵢ − pᵢ) ln(qᵢ / pᵢ)` formülü; bölmeler
   referansın onda birlikleri (her pᵢ = 0,1); 10 çubuk tek tek dolar (q, terim), toplam 0,582
   (veriden). Not satırı: "0,1 / 0,25 yaygın uygulamadır; kitap sınır vermez. PSI bölme seçimine,
   örneklem büyüklüğüne ve mevsime duyarlıdır."
9. **Alarm bir emir değildir.** Akış (Şekil 14.4): izleme → "Eşik aşıldı mı?" → alarm ve kayıt →
   insan incelemesi → "Neden?" → veri kalitesi (veri hattını düzelt) / mevsimsellik (eşiği ve
   referansı gözden geçir) / gerçek davranış değişimi (yeniden değerlendirme ve eğitim) / adillik
   veya gizlilik (yönetişim onayı) → izlemeye dönüş. Tarama `ani`nın ay 15 alarmını "gerçek
   davranış değişimi" dalından geçirir. Kitabın ikinci tuzağı şeritte: incelenmeden yapılan
   otomatik yeniden eğitim hatalı veriyi kalıcı öğretebilir.
10. **Hata ayıklama.** Kitabın `HataAyiklama` kodu; tarama dört hatayı sırayla işaretler: (1)
    `kayma_farki` metin → `TypeError` (çalışma burada durur; mesaj kod panelinin altında), (2)
    `toplam_sayi` sıfır → `ZeroDivisionError`, (3) telefon numarası açık yazdırılıyor (kişisel
    veri), (4) eşik 10'un gerekçesi ve kaydı yok (tasarım); sonra düzeltilmiş kod ve çıktısı
    `UYARI: M-1042 segmentinde inceleme gerekli.` / `Risk oranı: 0.00`. Ders sonu bağlantıları:
    `crisp-dm/` (Bölüm 1, yaygınlaştırma) ve Bölüm 13 `shap-degerleri/`.

### Laboratuvar

- **Adım 3:** eşik kaydırıcısı (0–20, adım 0,5, varsayılan 8,0); rozet UYARI / NORMAL canlı.
- **Adım 4:** senaryo seçimi (5); iki panel yerine seçilen senaryonun panel çifti (değişmeyen
  senaryoda "15–24. aylar" = referansla aynı dağılım).
- **Adım 5–6:** senaryo (kayma yok / ani kayma / yavaş kayma / yalnız yayılım değişir / kavram
  kayması), metrik (ortalama farkı / PSI) ve eşik kaydırıcısı (ortalama farkı 1–20, adım 0,5,
  varsayılan 8; PSI 0,05–1,00, adım 0,05, varsayılan 0,25; metrik değişince kendi varsayılanına
  döner). "Bugün" ay 24'te sabit: 22–24. ayların doğruluğu "etiket bekleniyor". Okuma paneli:
  alarm ayları, yanlış alarm sayısı, gecikme (ya da "kaçırıldı"), başarım alarmının ilk ayı ve
  bilindiği ay. `kavram` + varsayılan eşikler: girdi alarmı yok, başarım alarmı ay 15 / bilindiği
  ay 18 — kart: "Girdi izlemesi kavram kaymasını görmez."
- **Adım 7–8:** senaryo ve ay seçimi (7–24); histogram çifti, iki sayı kutusu ve PSI terimleri canlı.
- **Adım 10:** "düzeltilmiş kodu göster" anahtarı.
- Adım 1, 2, 9'da kontrol yok. Adıma göre yalnız o adımın kontrolleri görünür.

## Sayfa B — CRISP-DM döngüsü: altı evre ve geri dönüşler (`crisp-dm/`)

### Öğrenme sonucu

Öğrenci kafe israfı problemini altı evrede izler; iş hedefini ölçülebilir bir başarı ölçütüne
çevirir; dört günlük verinin neden yetmediğini, satışın neden talep olmadığını, eksiğin neden sıfır
olmadığını ve `ay_sonu_israfi`'nin neden girdi olamayacağını sayılarla görür; iki karar düğümünün
projeyi geri gönderdiği ve yaygınlaştırmadan sonra döngünün iş anlamaya döndüğü üç turlu bir
proje yolunu izler; Lab'de kendi seçimlerinin yolu nasıl değiştirdiğini dener.

### Veri (`src/concepts/crisp-dm/data/crisp.json`, yalnız üretici yazar)

- `meta`: tohum, sürümler, sabitler (tarihler, eski sipariş 50, pay 1,10, soran oranı 0,9, sınav
  haftaları, ay düzeyleri, ölçütler 0,15 / 0,03, grup alt sınırı 5).
- `book`: `isHedefi` sözlüğü (üç alan, kitaptaki metin); 4 satırlık `kafeVerisi` (tarih, ürün,
  satış 95 / 110 / 42 / 30, stok_tukendi, sinav_haftasi); `hamVeri` temizliği (önce / sonra
  satırları; ürün ve genel ortalama `fillna(0)` ile ve eksik atlanınca); sızıntı örneği
  (`gunlukKayit`, `yanlisGirdiler`, `dogruGirdiler`); `KafeAnalizi` çıktısı (ortalama 90,0, kayıt
  sayısı 2, ortalamaya giren 1); denetim için `satisKayitlari` 63,5 / 70,5 ve 4 satırlık tablonun
  karışık gruplaması 68,5 / 70,0.
- `days` (70): tarih, haftanın günü, sınav, ay, `satis_adedi` (eksikse `null`), `stok_tukendi`,
  `tukenince_soran`, `ay_sonu_israfi`, gerçek talep (yalnız test günlerinde ekranda; simülasyonun
  bildiği değer).
- `baseline`: test günlerinde sabit 50'nin israf oranı ve kaçan talep payı.
- `grid` (32 = gün {4, 14, 28, 56} × eksik {sifir, cikar} × stok {satis, soran} × sızıntı {yok,
  var}): kullanılabilir gün sayısı (normal / sınav), "Veri yeterli mi?" sonucu, grup tahminleri
  (normal, sınav), sızıntı katsayısı, 14 test gününün siparişleri (değerlendirme ve
  yaygınlaştırma), iki sonuç (israf oranı, kaçan talep payı, düşüş, iki koşul).
- Fixture `tests/fixtures/crisp_pandas.json`: her hücrenin tam duyarlıklı tahminleri ve sonuçları;
  kitabın pandas sayıları.

Üretici denetimleri (`scripts/make_crisp_data.py`): kitabın sayıları (63,5 / 70,5; 80,0 / 40,0;
57,5 / 38,33; 90,0 / 2); 4 ve 14 günde "Veri yeterli mi? Hayır", 28 ve 56 günde Evet; 56 gün +
çıkar + soran + sızıntısız hücrede iki koşul tutar; 56 + çıkar + satış hücresinde hizmet koşulu
tutmaz; 56 + sıfır + soran hücresinde koşullardan biri tutmaz; 56 + çıkar + soran + sızıntılı
hücrede değerlendirme tutar, yaygınlaştırma tutmaz; eğitimdeki sınav günlerinin en az yarısında
stok tükenir; sızıntısız her hücrede `LinearRegression` tahmini grup ortalamasıyla 1e-9 içinde.

### Hesap (saf TS, `src/concepts/crisp-dm/calc.ts`)

- `evaluate(orders, demand)` → `{ prepared, wasted, lost, demand, wasteRate, lostShare }`.
- `verdict(result, base)` → `{ reduction, wasteOk: reduction ≥ 0.15, serviceOk: lostShare ≤ 0.03,
  ok }`.
- `enoughData(cell)` → her grupta ≥ 5 gün.
- `projectPath(cell)` → evre ve kenar kimlikleri dizisi ile bitiş türü: `'yetersiz'` (◇1 Hayır →
  İş anlama), `'uygun-degil'` (◇2 Hayır → Veri anlama; hangi koşulun tutmadığıyla),
  `'sahada-dustu'` (◇2 Evet → Yaygınlaştırma → izleme → İş anlama, dış döngü kırmızı),
  `'yaygin'` (◇2 Evet → Yaygınlaştırma → dış döngü gri, "sonraki tur").
- `cycleLayout(w, h, narrow)` → altı evrenin ve iki karar düğümünün konumu.
- Birim testleri: `evaluate` 32 hücrenin iki sonucunda fixture'la 1e-12; `projectPath` dört bitiş
  türü (denetlenen hücrelerle); kitabın sayıları; `cycleLayout` 390 ve 1280 genişlikte düğümler
  çakışmaz.

### Görünüm

Sahnenin solunda (dar ekranda üstte) **döngü** (`FlowGraphLayer`): altı evre çember üzerinde saat
yönünde (tepeden: İş anlama, Veri anlama, Veri hazırlama, Modelleme, Değerlendirme,
Yaygınlaştırma); ◇1 "Veri yeterli mi?" Veri anlama ile Veri hazırlama arasında, ◇2 "Sonuç uygun
mu?" Değerlendirme ile Yaygınlaştırma arasında; geri kenarlar çemberin içinden kirişler (◇1 → İş
anlama, ◇2 → Veri anlama); dış döngü Yaygınlaştırma → İş anlama yayı. Jeton geçerli evrede.
Sağda (dar ekranda altta) **evre kartı**: o evrenin kafe çıktısı (sözlük, tablo, çubuklar, sonuç
panosu ya da kod paneli). Grup ortalamaları `HBarsLayer`; tablolar HTML; adım 10 `code-panel.ts`.

### Adımlar (Ders)

1. **Sorun.** Kampüs kafeteryasında bazı günler sandviç öğleden önce biter, bazı günler çok ürün
   atılır. "Daha çok sipariş" yanıt değildir: gün, sınav haftası, hava, ürün, satış ve stok birlikte
   okunmalı (kitabın açılışı). Döngü ilk kez çizilir; altı evre adlarıyla, jeton İş anlama'da.
2. **İş anlama.** Kart: kitabın `isHedefi` sözlüğü (amaç "Sandviç israfını azaltmak", başarı ölçütü
   "Aylık israf oranını yüzde 15 azaltmak", veri sorusu "Hangi günlerde talep daha yüksektir?").
   Sayfanın eklediği hizmet koşulu ayrı satırda: "kaçan talep en çok %3 (israfı sıfırlamanın yolu
   hiç hazırlamamaktır)". Şerit: kitabın "En sık hata, modelleme evresinden başlamaktır."
3. **Veri anlama.** Jeton Veri anlama'ya yürür. Kitabın 4 satırlık `kafeVerisi` tablosu; gözlem
   birimi "gün-ürün"; 3 Mart Kahve satırı (110, stok tükendi) vurgulu: "satış, talebin alt
   sınırıdır" (kitabın ikinci tuzağı).
4. **Veri yeterli mi? Hayır.** ◇1 yanar; sandviç için 2 kayıt, sınav haftasında 1 (veriden); geri
   kenar ◇1 → İş anlama canlanır (kitabın dördüncü tuzağı). İş anlama kartına "veri sorusu: 8
   haftalık günlük kayıt" eklenir; jeton yeniden Veri anlama'ya, bu kez 56 günlük tablo (özet:
   normal ve sınav gün sayıları, stok tükenen gün sayısı, eksik 4 kayıt; veriden) → ◇1 Evet.
5. **Veri hazırlama: eksik sıfır değildir.** Kitabın `hamVeri`'si ("kahve", " Kahve ", None) →
   `strip().title()`; Kahve ortalaması `fillna(0)` ile 40,0, eksik atlanınca 80,0 (veriden). Aynı
   hata 56 günde: sınav günü ortalaması eksikler 0 yapılınca düşer (ön denemede 59,00 → 50,57;
   veriden). Kart: eksik kayıtlar stok tükenen sınav günlerinde (kitabın beşinci tuzağı) →
   "işaretle ve çıkar".
6. **Veri hazırlama: sızıntı.** Kitabın `gunlukKayit` örneği; `ay_sonu_israfi` ayın sonunda
   kesinleşir, tahmin günü bilinmez → girdilerden çıkar (`dogruGirdiler` kitaptaki gibi). Kart:
   "Değerlendirmede iyi görünür, sahada yoktur" (Lab'de denenir).
7. **Modelleme: ilk hipotez.** Jeton Modelleme'de. 56 günde sınav haftasına göre ortalama satış
   (çubuklar; ön denemede normal 40,05, sınav 50,00; veriden) ve sipariş kuralı "sipariş =
   1,10 × grup ortalaması" (ör. 44 / 55). Not: "satış talep sayıldı."
8. **Değerlendirme: Sonuç uygun mu? Hayır.** Test penceresi (01–14 Mayıs): sabit 50 ile kural yan
   yana; israf oranı ve kaçan talep (veriden; ön denemede israf %55 düşer ✓, kaçan talep %6,5 ✗).
   ◇2 Hayır → geri kenar Veri anlama'ya. Kart: eğitimdeki sınav günlerinin hepsinde stok tükenmiş,
   satış hep 50 (veriden) → sınav talebi 50 sanıldı.
9. **İkinci tur ve yaygınlaştırma.** Veri anlama'da "tükenince soran" sütunu açılır; sınav tahmini
   satış + soran ile yükselir (ön denemede 59,00); değerlendirme yeniden: israf düşüşü ve kaçan
   talep iki koşulu da sağlar (veriden; ön denemede %30, %0,0) → ◇2 Evet → Yaygınlaştırma: "Sınav
   haftasında X, diğer günler Y sandviç" kuralı ve izleme; dış döngü İş anlama'ya döner ("talep
   değişirse"). Köprü: "Kural kullanılırken bozulabilir → Bölüm 14, model kayması" (`model-kaymasi/`
   bağlantısı).
10. **Hata ayıklama.** Kitabın `KafeAnalizi` kodu; altı hata sırayla (`=` atama, `"100"` metin,
    `mean` çağrılmamış, metin + sayı, olmayan sütun, eksik değerin ele alınmaması); düzeltilmiş kod
    ve çıktısı `Ortalama: 90.0` / `Kayıt sayısı: 2`; not: "ortalamaya giren 1 değer" (veriden).
    Ders sonu bağlantıları: `model-kaymasi/` ve Bölüm 2 `dagilim-carpiklik/`.

### Laboratuvar

- **Adım 4–9:** dört seçim tek kartta, her adımda görünür: gün sayısı (4 / 14 / 28 / 56;
  varsayılan 56), eksik değer (0 ile doldur / işaretle ve çıkar; varsayılan çıkar), stok tükenen
  gün (satış = talep / satış + soran (alt sınır); varsayılan satış + soran), `ay_sonu_israfi`
  (girdide değil / girdide; varsayılan değil). Döngüde seçimlerin tek tur yolu canlı (jeton yolu
  izler; geri gönderen düğüm ve neden yazılı). Evre kartı adımın evresini gösterir: adım 4 grup gün
  sayıları ve ◇1; 5 eksik sayımı ve grup ortalamalarına etkisi; 6 sızıntılı / sızıntısız katsayı;
  7 grup tahminleri ve siparişler; 8–9 sonuç panosu: taban, değerlendirme ve yaygınlaştırma
  sütunları (israf oranı, kaçan talep, düşüş, iki koşul ✓ / ✗). "Veri yeterli mi? Hayır" olan
  seçimlerde sonuçlar soluk ve "yine de denenseydi" başlıklı.
- **Adım 10:** "düzeltilmiş kodu göster" anahtarı.
- Adım 1–3'te kontrol yok. Lab yarışma ya da sınav değildir; puan, doğru / yanlış rozeti yoktur.

## Kitapla farklar (kitap düzeltmesi için liste)

- Bölüm 14: kod03 "Kavram kayması" başlığı altında ve `kavram_kaymasi_izleme.py` adıyla verilir,
  ama girdinin ortalamasını karşılaştırır, yani veri (girdi) kaymasını ölçer; Şekil 14.2'nin
  altyazısı da "veri kayması (data drift)" der, İzleme ve Yönetişim bölümü kavram kaymasını
  P(Y | X)'in değişmesi olarak tanımlar. Sayfa A adım 4 ikisini ayırır.
- Bölüm 14: kod06'nın `for grup in {"A", "B"}` döngüsü kümenin sırasına bağlıdır; Python'da dizgi
  kümelerinin sırası `PYTHONHASHSEED`'e göre değişir (ön denemede 6 tohumun 4'ünde önce "B").
  Kitabın çıktısındaki "Grup A … Grup B" sırası güvence altında değildir.
- Bölüm 14: kod03'ün yorumundaki "# Çıktı: İnsan incelemesi gereklidir." satırını kod yazdırmaz
  (çıktı bloğunda da yok).
- Bölüm 14: hata ayıklama kodunda yalnız ilk hata çalışırken görülür (`TypeError`, program durur);
  telefon numarası yazdırılmaz, sıfıra bölme hiç çalışmaz. Dördüncü "hata" (eşiğin gerekçesi) kod
  hatası değil tasarım eksiğidir. Kitap PSI formülünü verir ama eşik vermez.
- Bölüm 1: 4 satırlık `kafeVerisi` üzerinde `groupby("sinav_haftasi")` kahve ile sandviçi aynı
  grupta ortalar (68,5 / 70,0); kitabın kendi "gözlem birimi gün-ürün" uyarısıyla çelişir ve sınav
  grubunda stok tükenen kahve satırı vardır.
- Bölüm 1: Şekil 1.1 beş kutu çizer ("Model kur", "Kararı uygula"); ayrı bir Değerlendirme
  evresi ve yaygınlaştırmadan iş anlamaya dış döngü yoktur, metin ise altı evre ve yinelemeli süreç
  der. Sayfa B metnin altı evresini ve şeklin iki karar düğümünü birlikte çizer.
- Bölüm 1: düzeltilmiş `KafeAnalizi`'nin "Kayıt sayısı: 2" çıktısı süzülen satırları sayar;
  ortalama 90,0 bunlardan yalnız birinden gelir (diğeri eksik).

## Arayüzler

- Her sayfa mevcut `ConceptPage<Params>` sözleşmesini sağlar; `StepPlayer` adım/tarama
  sözleşmesi değişmez; adım indeksleri `stepIndex` ile adım kimliklerinden türetilir; Lab metni
  `Step.labText`.
- Kimlikler ve yollar: `crisp-dm` → `crisp-dm/`, başlık "CRISP-DM döngüsü: altı evre ve geri
  dönüşler", Bölüm 1; `model-kaymasi` → `model-kaymasi/`, başlık "Model kayması ve izleme eşiği",
  Bölüm 14. `vite.config.ts` girdileri, `<kimlik>/index.html`, README "Canlı site" listesi ve
  giriş paragrafı, "Veriyi yeniden üretme" satırları (`make_crisp_data.py`, `make_kayma_data.py`).
- Ana sayfa testi (`tests/unit/home.test.ts`): 32 kart, 32 bağlantı, 0 "yakında"; Bölüm 1 kartı
  ilk sırada.
- Çekirdek: `src/core/plot/flow-graph.ts` (yukarıda); yeni sahne parçası yalnız ikinci sayfa da
  kullanırsa `src/core/plot/`'a girer.
- Parametre adları (öneri, yapıcıya bırakılır): Sayfa A `{ esik: number; scenario: number; metric:
  'mean' | 'psi'; threshold: number; month: number; fixed: boolean }`; Sayfa B `{ days: 4 | 14 |
  28 | 56; missing: 'sifir' | 'cikar'; stock: 'satis' | 'soran'; leak: boolean; fixed: boolean }`.

## Hata durumları

- PSI'de boş bölme: q 0,0001'e yükseltilir; terim tabloda "q = 0" ve bir dipnot işaretiyle yazılır.
- Gecikme hesaplanamazsa (alarm yok) "kaçırıldı"; değişimi olmayan senaryoda gecikme satırı "—".
- Başarım alarmı yoksa "başarım düşüşü yok"; bilinme ayı 24'ü aşarsa "henüz bilinmiyor".
- Sayfa B'de bir grupta hiç gün yoksa (4 / 14 gün: sınav grubu boş) o grubun tahmini "veri yok"
  yazılır; kural genel ortalamayı kullanır (`LinearRegression` sabit sütunda katsayıyı 0 verir) ve
  sonuçlar "yine de denenseydi" başlığıyla soluk gösterilir.
- NaN / Infinity ekrana basılmaz; yüzde paydası sıfırsa "—".

## Doğrulama

- Birim: iki sayfanın hesabı fixture'a karşı (yukarıda); `flow-graph` (düğüm / kenar / jeton DOM'u,
  vurgulu yol, azaltılmış harekette anında konum); senaryo adım kimlikleri, parametreleri ve
  metinlerdeki sayıların veriden geldiği; sahne testleri (her adımın anahtar DOM öğesi: zaman
  şeridi, sayı doğrusu noktaları ve ortalamalar, UYARI rozeti, iki panel, izleme çizgisi ve alarm
  üçgenleri, doğruluk şeridi ve "etiket bekleniyor" hücreleri, eşik tablosu, PSI çubukları, alarm
  akışı, kod paneli işaretleri; döngü düğümleri, jeton, geri kenarlar, dış döngü, evre kartları,
  kafe tabloları, grup çubukları, sonuç panosu ✓ / ✗).
- e2e (yalın): Sayfa A Ders adım 3, 5, 7, 8; Lab adım 5'te "kavram kayması"nı seç (girdi alarmı
  yok, başarım alarmı ay 15 / 18). Sayfa B Ders adım 4 (◇1 geri kenarı), 8 (◇2 geri kenarı), 9 (dış
  döngü), 10; Lab adım 8'de sızıntıyı aç (değerlendirme ✓, yaygınlaştırma ✗) ve gün sayısını 4 yap
  (◇1 Hayır). Ekran görüntüsü temelleriyle; etiket çakışması ve sahne dışına taşma kontrolleri.
- Performans (dalga sonunda bir kez, `tests/e2e/bolum1-14.perf.spec.ts`): Sayfa A adım 5'te eşik
  kaydırıcısı ve Sayfa B adım 8'de seçim değişimi p95 ≤ 25 ms.
- Kapanış: `npm run check` çıkış 0; kontrolcü ekran görüntülerine kendisi bakar.

## Görev kesimi (plan için öneri, 7 görev)

1. İki üretici, veri ve fixture'lar, README "Veriyi yeniden üretme" satırları (veri riski: görev
   incelemesi).
2. `src/core/plot/flow-graph.ts` ve birim testleri; kayıt defteri (`CH[1]`, `CH[14]`, iki kayıt),
   ana sayfa testi, iki sayfanın iskeleti ve `vite.config.ts` girdileri.
3. Sayfa B hesap + senaryo + görünüm (görev incelemesi).
4. Sayfa B sahne + kontroller + Lab (sahne bütünleşmesi: görev incelemesi).
5. Sayfa A hesap + senaryo + görünüm (görev incelemesi).
6. Sayfa A sahne + kontroller + Lab (görev incelemesi).
7. İki sayfanın e2e'si ve ekran görüntüsü temelleri, dar ekran, performans spec'i, README
   bölümleri.

## Yapıcıya bırakılanlar

- Dosya bölünmesi, parametre adları, döngünün yarıçapı ve düğüm boyutları, akış grafiğinin
  yerleşimi, panel oranları, tarama hızları, nokta ve çubuk boyutları, renk tonları (anlamları
  yukarıda sabit), evre kartlarının metin ayrıntısı, üreticide rastgele sayı çekme sırası (tohum
  kuralı yukarıda).
