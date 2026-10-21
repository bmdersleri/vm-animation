# Bölüm 6 — Model Değerlendirme, Çapraz Doğrulama ve Metrikler

- **Tarih:** 2026-10-21
- **Kaynak:** Kullanıcının bölüm 6'yı hazırlama talebi; kitabın ilgili bölümü.

## Amaç

Kitabın `ch06_model_degerlendirme_metrikler/content/final.md` bölümünü, mevcut Ders/Laboratuvar kabuğunda üç kavram animasyonuna dönüştürmek. Öğrenci yalnızca bir metriğin tanımını okumamalı; müşterileri, karar eşiğini ve doğrulama katlarını değiştirerek sayının neden değiştiğini görmeli.

İş sınıfı: architectural. Yeni kavram sayfaları, üretilmiş veri sözleşmeleri ve birden fazla uygulama görevi içerir. Kullanıcının talebi: “bölüm 6 yı sen hazırla”. Aşağıdaki öğretim ve veri seçimleri ajanın önerisidir; ayrıca onaylandığı iddia edilmez.

## Kaynak ve sınırlar

- Kitap salt okunur kaynak olarak kullanılır; kitaptaki içerik değiştirilmez.
- Mevcut TypeScript, SVG ve ortak `mountConceptPage` / `StepPlayer` kullanılır.
- Bölüm 4 çalışmasından bağımsız `feat/bolum6` dalı, `.worktrees/bolum6` çalışma ağacı kullanılır.
- `main` dalına merge veya push yapılmaz. 5180 portundaki sunucuya dokunulmaz.
- Veri dosyaları yalnızca `scripts/make_degerlendirme_data.py` üzerinden üretilir. Veri gerçek Telco müşterileri değil, açıklanan deterministik öğretim örnekleridir.
- Küresel kabuk yeniden tasarlanmaz; bölüm 3 ve 5'in renk, tipografi ve adım düzeni korunur.

## Ortak öğretim dili ve davranış

Pozitif sınıf her sahnede **Ayrılan müşteri (churn=1)** olarak açıkça yazılır. Renk yanında şekil/etiket kullanılır. Matrisin satırı gerçek, sütunu tahmindir. Eşik kuralı `skor >= eşik` olur; eşit skorlar birlikte sınıf değiştirir. Oranlar sıfır paydada `— (tanımsız)` gösterir; NaN/Infinity ekrana basılmaz. F1 doğrudan `2TP/(2TP+FP+FN)` ile hesaplanır; payda sıfırsa tanımsızdır.

Ders modunda tek adımın görsel fikri öne çıkar, terim Türkçe ve gerektiğinde İngilizce verilir. Laboratuvar modunda adım açıklaması, ilgili parametreler ve sayısal ayrıntı görünür. Parametre panelinde yalnızca o adımda anlamlı kontroller yer alır. Adım değişimi önceki Laboratuvar değişikliklerini mevcut oynatıcı sözleşmesine göre sıfırlar. Oynatma, geri/ileri, klavye ve azaltılmış hareket tercihi korunur. Her adımın gözle görülür bir sahne karşılığı ve doğrulanabilir durumu olur.

1280×720 Ders/Lab ile dar ekranlar doğrulanır. Grafik ve etiketler taşmaz; ek açıklamalar sahneyi örtmez. SVG etiketleri erişilebilir bir metin özetiyle desteklenir. Kayıtlı olay dinleyicileri ve abonelikler `destroy()` ile temizlenir.

## 1. Karmaşıklık matrisi — `karmasiklik-matrisi/`

### Öğrenme sonucu

Öğrenci TN, FP, FN, TP hücrelerini gerçek/tahmin ayrımından oluşturur; accuracy, precision, recall ve F1'i aynı sayımla ilişkilendirir. Yüksek accuracy'nin azınlık sınıfını tamamen kaçırabileceğini görür.

### Adımlar

1. **Gerçek ve tahmin:** Etiketleri bilinen 100 öğretim müşterisi, 10 ayrılan ve 90 kalan; gerçek sınıf ile tahmin ayrı görsel kodlarla gösterilir.
2. **Dört sonuca ayır:** Müşteri işaretleri 2×2 matrise taşınır. Başlangıç sayımı TN=80, FP=10, FN=4, TP=6.
3. **Doğru tahminler:** TN ve TP vurgulanır; accuracy=(80+6)/100=%86.
4. **Kesinlik:** Pozitif tahmin sütunu vurgulanır; precision=6/(6+10)=%37,5. Gereksiz teklif maliyeti anlatılır.
5. **Duyarlılık:** Gerçek pozitif satırı vurgulanır; recall=6/(6+4)=%60. Kaçırılan müşteriler görünür kalır.
6. **F1 dengesi:** Precision ve recall birlikte, F1=12/(12+10+4)≈%46,15; bunun aritmetik ortalama olmadığı anlatılır.
7. **Accuracy tuzağı:** Herkese “kalır” diyen model: TN=90, FP=0, FN=10, TP=0; accuracy=%90, recall=%0, precision tanımsız. Önceki modelle karşılaştırma, hiçbir ayrılanın yakalanmadığını gösterir.
8. **Hatanın maliyeti:** Lab'da FP/FN birim maliyetleri değişir; `FP×maliyetFP + FN×maliyetFN` iki model için hesaplanır. Tek bir evrensel “en iyi model” sonucu verilmez.

Lab'da model seçimi ve ilgili adımlarda dört sayım hücresi için negatif olmayan tamsayı kontrolleri bulunur. Toplam, oranlar ve görsel müşteri işaretleri tutarlıdır; toplam sıfır durumu açıkça anlatılır. Aşırı büyük girişler görselleştirme sınırına göre kontrol edilir; sayımlar sessizce farklılaştırılmaz. Sayım değişirse başlangıç örneğine ait açıklamaların “başlangıç örneği” olduğu belirgindir; canlı formüller güncel değerleri kullanır.

Her sayım 0–100 arası tamsayıdır. Toplam 100'ü aşarsa müşteri başına işaret yerine sayımla etiketlenmiş hücre alanları kullanılır. “Herkese kalır” modeli güncel müşteri grubundan türetilir: `TN′=TN+FP`, `FN′=FN+TP`, `FP′=TP′=0`. Böylece maliyet karşılaştırması aynı gerçek sınıf dağılımını kullanır.

## 2. ROC, PR ve eşik — `roc-esik/`

### Öğrenme sonucu

Öğrenci skor ile sınıf etiketini ayırır; eşik değişince hangi müşterilerin ve matris hücrelerinin değiştiğini izler. ROC'de FPR/TPR, PR'de recall/precision ilişkisini aynı skorlar üzerinde görür. Eşiğin test kümesinde seçilmemesi gerektiğini öğrenir.

### Adımlar

1. **Skor etiket değildir:** Sabit doğrulama müşterileri 0–1 skor doğrusu üzerinde, gerçek sınıflarıyla gösterilir. Skorların kalibre olasılık olduğuna ilişkin garanti verilmez.
2. **0,50 karar eşiği:** Dikey eşik çizgisi, pozitif/negatif tahmin bölgeleri ve canlı matris gösterilir.
3. **Eşiği düşür:** Oynatıcı birkaç eşiği tarar; işaretler eşik geçişinde tahmin değiştirir. Recall artabilir, FP artabilir; precision'ın her veri üzerinde monoton olmadığı açıkça korunur.
4. **Eşiği yükselt:** Yakalanan/kaçırılan müşteriler karşılaştırılır; tek eşik için canlı precision, recall ve F1.
5. **ROC eğrisi:** Bütün farklı skor eşikleri, tüm-negatif başlangıç ve tüm-pozitif bitiş dahil çizilir. Nokta=(FPR,TPR). Rastgele sıralama referansı diyagonaldir; seçili eşik noktası hareket eder.
6. **ROC-AUC:** Trapez alanı ve skora dayalı sıralama yorumu gösterilir. Eşik değişince AUC sabit kalır. Bağlı skorlar blok halinde işlenir.
7. **PR eğrisi:** Aynı model için recall/precision ve pozitif oranı referans çizgisi. AP (average precision) basamak alanı olarak adlandırılır; trapez PR-AUC ile eşitmiş gibi sunulmaz. Boş pozitif tahmin ucunda eğri çizimi için kullanılan precision=1 konvansiyonu ile metrik kartındaki tanımsız precision ayrımı açıklanır.
8. **Sınıf dengesizliği:** İki üretilmiş dengeli/dengesiz örnek arasında geçiş; ROC ile PR referanslarının farkı görünür. Farklı örneklerde AUC'nin değişmeyeceği iddia edilmez.
9. **İş hedefine göre eşik:** FP ve FN maliyetleriyle doğrulama verisinde maliyet taraması; eşit maliyetli eşiklerde deterministik seçim kuralı. En düşük maliyet önerisi ile varsayılan 0,50 karşılaştırılır.
10. **Testi saklı tut:** Eğitim → doğrulamada eşik seçimi → dondurulmuş eşikle bağımsız test akışı. Test skorları hiçbir eşik/maliyet optimizasyonuna girmez; nihai test raporu ayrı gösterilir.

Lab'da eşik kaydırıcısı, örnek seçimi ve yalnız ilgili adımlarda maliyetler bulunur. SVG üzerinde sürükleme eklenirse klavye kaydırıcısı eşdeğer işlev sağlar. Skor aralığı dışındaki tüm-negatif uç, özel uç seçenekle veya >1 sentinel ile desteklenir; UI bunu “hiç pozitif tahmin yok” diye anlatır. Eğri/alan sayıları Python referansıyla doğrulanır.

Maliyet taramasının adayları bütün farklı doğrulama skorları, 0 ve açık tüm-negatif uçtur; aynı tahminleri veren adaylar tekilleştirilir. Eşit en düşük maliyette daha yüksek eşik seçilir; tüm-negatif uç en yüksek kabul edilir. Kullanıcıya bunun bir iş tercihi olduğu, daha az müşteriye teklif vermeyi seçtiği anlatılır. Dış test bu adayları üretmekte de kullanılmaz.

## 3. Çapraz doğrulama — `capraz-dogrulama/`

### Öğrenme sonucu

Öğrenci aynı verinin farklı rollerde kullanıldığını, her turun yeni bir model olduğunu ve dış testin bütün seçimler boyunca saklı tutulduğunu görür. K-Fold ile StratifiedKFold arasındaki sınıf dağılımı farkını ve skor dağılımını okur.

### Adımlar

1. **Bir bölünme bir sonuç:** Geliştirme verisi ve baştan ayrılmış dış test; tek train/validation skorunun bölünmeye bağlılığı.
2. **K parçaya ayır:** Geliştirme örnekleri K=5 kata ayrılır, kimlikleri görünür kalır. Dış test ayrı, kilitli bölgede.
3. **Bir katı doğrulamaya ayır:** İlk doğrulama katı ve kalan eğitim katları belirginleşir.
4. **Her tur yeni model:** Aktif kat sırayla değişir; ölçekleyici ve sınıflandırıcı yalnız o turun eğitim örnekleriyle fit edilir. Her turun skor kartı tur tamamlanınca açılır.
5. **Her örnek bir kez doğrulamada:** Örnek bazında doğrulama katı vurgulanır; eğitim/doğrulama kimlikleri hiçbir turda kesişmez.
6. **Ortalama ve yayılma:** Kat skorları, aritmetik ortalama ve popülasyon std (`ddof=0`) çizilir. Bu yayılmanın güven aralığı olmadığı anlatılır.
7. **Dengesiz veri: düz K-Fold:** Kat başına gerçek sınıf sayıları gösterilir; pozitif sınıfsız bir doğrulama katı varsa recall/F1'in anlamı açıkça işaretlenir.
8. **StratifiedKFold:** Aynı örnekler sınıf oranını yaklaşık koruyan katlara hareket eder. Her sınıfın örnek sayısının K'den az olduğu yapılandırma engellenir veya açıklayıcı hata gösterilir.
9. **Pipeline her turun içinde:** Eğitimden öğrenilen ortalama/ölçek ile doğrulama dönüşümünün ayrılığı; yanlış “tüm veride fit” akışı karşılaştırılır. Sızıntının skoru her zaman artırdığı iddia edilmez.
10. **Son karar, son test:** CV ile model/yapılandırma seçimi, tüm geliştirme verisiyle yeniden fit ve bir defa dış test; test seçim döngüsüne geri bağlanmaz. Zaman ve grup bağımlı veride rastgele K-Fold'un uygun olmayabileceği not edilir.

Lab'da K=3/5, düz/katmanlı katlama ve aktif kat seçilir. Her desteklenen bileşim için kimlikler, sınıf sayıları, eğitimden fit edilen parametreler, tahminler ve skorlar aynı Python üretiminden gelir. Tarayıcıda yeni eğitim yapılmaz; bunların önceden hesaplanmış gerçek çalıştırmalar olduğu belirtilir. Aktif tur değişince renk, skor ve veri rolleri birlikte güncellenir.

Son seçim örneğinin adayları aynı `StandardScaler → LogisticRegression` Pipeline'ının `C=0.1` ve `C=1` yapılandırmalarıdır; diğer parametreler sabittir. Seçim, varsayılan K=5 StratifiedKFold üzerinde ortalama pozitif-sınıf F1 ile yapılır; eşitlikte küçük C seçilir. Dış test sonuçları yalnız bu seçilen yapılandırmanın bütün geliştirme verisine yeniden fit edilmesinden sonra açılır. Katlama kontrolü keşif içindir; son seçim adımının sabit protokolü ekranda belirtilir.

## Veri üretimi ve sayısal doğrulama

Tek üretici sabit seed kullanır; sklearn sürümü/üretim parametreleri kaydedilir. Matris için açıklanmış öğretim sayımları; ROC/PR için tekrarlı skor içeren küçük örnek ve daha dengesiz örnek; CV için eğitim/doğrulama/test kimlikleri ile Pipeline sonuçları üretilir. Üretici, matris metriklerini `confusion_matrix`, `roc_curve`, `roc_auc_score`, `precision_recall_curve`, `average_precision_score` ve CV referanslarıyla kontrol eder. İkinci üretimde dosyalar değişmez.

Saf TypeScript hesapları DOM'dan ayrılır. Unit testler başlangıç örneğini, sıfır paydaları, tüm-pozitif/tüm-negatif uçları, bağlı skorları, AUC/AP ayrımını, kat kapsamını ve dış test ayrımını doğrular. Senaryo testleri adım kimlikleri ile varsayılanları kontrol eder. DOM testleri her öğretim anının bir öğeye karşılık geldiğini doğrular. E2E, üç yeni girişin açılması, adım gezinme/oynatma/sıfırlama, Lab kontrollerinin sayılara etkisi, mod değişimi ve klavyeyi kapsar.

## Kabul ölçütleri

- Ana sayfada bölüm 6'nın üç kartı hazırdır; Ders ve Lab bağlantıları çalışır.
- Yukarıdaki her adımda anlatılan değişim sahnede görünür ve testte izlenebilir.
- Matris, ROC, PR, AUC/AP ve CV sayıları aynı girdilerde Python referansıyla uyumludur.
- Test kümesi eşik veya model seçimine katılmaz; veri rolü UI'da anlaşılır.
- 1280×720 Ders/Lab ekranlarında ve dar görünümde örtüşme/taşma yoktur; erişilebilir kontroller ve azaltılmış hareket çalışır.
- Odak testler, `npx tsc --noEmit`, `npm test` ve son `npm run check` yeşildir. Taze worktree baseline sonucu uygulamadan önce kaydedilir.
- Başarılı adımlar proje trailer'ıyla commit edilir; push/merge yapılmaz.

## Kapsam dışı

Gerçek müşteri verisi, sunucu/API, tarayıcı içinde model eğitimi, çok sınıflı metrikler, nested CV, bootstrap güven aralıkları, kalibrasyon, otomatik hiperparametre araması ve diğer bölümlerin geliştirilmesi.

## Kararlar

| Konu | Önerilen karar | Neden |
|---|---|---|
| Sayfa sayısı | Mevcut üç bölüm 6 kartının her biri ayrı sayfa | Ana sayfadaki öğretim ayrımını ve kısa odaklı akışları korumak |
| Bağlam | Ayrılan müşteri pozitif sınıf | Önceki sınıflandırma kavramları ve kitapla süreklilik |
| Grafik | Ortak SVG altyapısı ve sayısal kartlar | Sahne değişimini adım oynatıcısıyla eşlemek |
| Eğitim | Deterministik Python referansları; tarayıcıda hesap ve gösterim | Doğrulanabilir sayılar, gecikmesiz etkileşim |
| PR alanı | AP açık adıyla ve basamak alanıyla | PR-AUC ile farklı integral tanımlarının karışmasını önlemek |
| Teslim | Yerel feature dalında test edilmiş commitler | Yayın için öğretmen onayı zorunlu |

## Arayüzler

Her kavram mevcut `ConceptPage<Params>` sözleşmesini sağlar; `scenario`, `mountScene`, `mountParams` ve gerekirse `mountExplainExtra` kullanır. Yeni ortak hesap modülünün dış sözleşmesi `Confusion { tn, fp, fn, tp }`, `Metrics { accuracy, precision, recall, f1, specificity }` (tanımsız değer `null`) ve `ScoredSample { id, actual: 0 | 1, score }` kayıtlarıdır. Eğri noktaları eşik ve karışıklık sayımlarını taşır; tüm-negatif uç JSON'da Infinity yerine açık `kind: 'none-positive'` ile temsil edilir.

CV veri sözleşmesi `sample.id`, `split: development | test`, desteklenen her K/yöntem için `folds[].trainIds`, `validationIds`, eğitimden hesaplanan dönüşüm parametreleri, doğrulama tahminleri ve skorlarını içerir. UI'nın kimlik ve skorlarını ayrı bağımsız örneklerden birleştirmesine izin verilmez. Dosya adları ve kesin export isimleri uygulama planında sabitlenir.

## Hata durumları

Geçersiz sayım, maliyet veya eşik girdisi model hesabına geçmez; kontrol sınırları ve erişilebilir açıklama kullanılır. Desteklenmeyen K/veri yapılandırması kullanıcıya gerekçesiyle gösterilir. Bir eğri için tek gerçek sınıf varsa ROC-AUC tanımsızdır; eğri ve metrik alanı bunu açıkça anlatır. Veri yükleme veya alan uyumsuzluğu test/derleme sırasında hata vermelidir; sayfa sessizce yanlış örneğe dönmez.

## Doğrulama özeti

Uygulama öncesi taze worktree baseline; görev başına odak unit/DOM/e2e; her commit öncesi TypeScript ve testler; bitişte bağımsız bütün-dal incelemesi, tek düzeltme dalgası ve `npm run check`. Görsel incelemede her sayfanın Ders/Lab başlangıcı, en yoğun adımı ve uç parametreleri kontrol edilir. Hook düzeltmesi ürün testlerinden ayrı, hata veren gerçek shell çağrısıyla doğrulanır.

## Ayrı ek iş: hook hatası

Kullanıcının ayrıca bildirdiği hook hatası, ürün kapsamından bağımsız teşhis edilir. Güncel kayıt ve tekrar üretimle kök neden kanıtlanır; ilgili kullanıcı ayarı yedeklenir, en küçük düzeltme uygulanır ve aynı koşulda yeniden çalıştırılır. Hook'lar topluca kapatılmaz. Kitap, bölüm 4 çalışma ağacı ve 5180 sunucusu değiştirilmez.
